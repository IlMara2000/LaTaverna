import { supabase, isSupabaseConfigured } from '../../../services/supabase.js';
import { createReadingLibrary, bookTitleFromFilename, readingErrorMessage, READING_PAGE_SIZE } from '../../../services/readingLibrary.js';
import { updateSidebarContext } from '../../layout/Sidebar.js';
import { navigateTo } from '../../../services/appNavigation.js';
import './reading.css';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const bookIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 5v15M12 5C8 2 3 3 2 4v15c3-2 7-1 10 1 3-2 7-3 10-1V4c-1-1-6-2-10 1Z"/></svg>';
const fileSize = bytes => bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString('it-IT', { maximumFractionDigits: 1 })} MB`;

export async function showReading(container) {
    window.__readingCleanup?.();
    updateSidebarContext('reading');
    const library = createReadingLibrary(supabase);
    const root = document.createElement('main');
    root.className = 'reading-page';
    container.replaceChildren(root);
    let alive = true;
    let request = 0;
    let searchTimer;
    let user = null;
    let view = 'mine';
    let page = 0;
    let collectionId = null;
    let books = [];
    let collections = [];
    let favorites = new Set();
    const dialogs = new Set();
    const aliveHere = () => alive && root.isConnected;

    root.innerHTML = `
        <header class="reading-header">
            <button type="button" class="reading-back" data-home>← La Taverna</button>
            <span class="reading-eyebrow">UN POSTO PER OGNI STORIA</span>
            <div class="reading-heading"><div><h1>Lettura<span>.</span></h1>
                <p>La tua biblioteca, un libro alla volta.</p></div>
                <button type="button" class="reading-primary" data-upload disabled>+ Carica un PDF</button>
            </div>
            <div class="reading-welcome"><span class="reading-book-mark">${bookIcon}</span>
                <p>Custodisci le tue letture. Raccogli le tue ispirazioni.<br>
                <span>Condividi un libro in bacheca, solo se lo desideri.</span></p>
                <span class="reading-welcome-note">IL TUO ANGOLO DI QUIETE</span>
            </div>
        </header>
        <p class="reading-account-note" data-account-note hidden></p>
        <nav class="reading-tabs" aria-label="Biblioteca">
            <button type="button" data-view="mine" aria-current="page">I miei libri</button>
            <button type="button" data-view="board">Bacheca</button>
            <button type="button" data-view="favorites">Preferiti</button>
            <button type="button" data-view="collections">Raccolte</button>
        </nav>
        <p class="reading-feedback" data-feedback role="status" aria-live="polite" hidden></p>
        <section class="reading-shelf" aria-labelledby="reading-shelf-title">
            <div class="reading-shelf-heading"><div><h2 id="reading-shelf-title">I miei libri</h2>
                <p data-description>Visibili solo a te, finché non scegli di condividerli.</p></div>
                <button type="button" class="reading-secondary" data-create hidden>+ Nuova raccolta</button>
                <span class="reading-order" data-order>INDICE A–Z</span>
            </div>
            <div data-list aria-live="polite" aria-busy="true"><p class="reading-empty">Apro la biblioteca…</p></div>
            <form class="reading-search" role="search" data-search-form>
                <label for="reading-search">Cerca nell’elenco</label>
                <div><span aria-hidden="true">⌕</span><input id="reading-search" type="search" maxlength="160"
                    placeholder="Titolo o autore…" autocomplete="off"><button type="submit" class="reading-secondary">Cerca</button></div>
            </form>
            <div class="reading-pagination"><span data-count></span><div>
                <button type="button" class="reading-secondary" data-prev disabled aria-label="Pagina precedente">←</button>
                <span data-page></span><button type="button" class="reading-secondary" data-next disabled aria-label="Pagina successiva">→</button>
            </div></div>
        </section>
        <footer class="reading-footer">I tuoi preferiti e le tue raccolte sono personali, anche per i libri della bacheca.</footer>
    `;
    const find = selector => root.querySelector(selector);
    const list = find('[data-list]');
    const search = find('#reading-search');

    function feedback(message = '', error = false) {
        if (!aliveHere()) return;
        const element = find('[data-feedback]');
        element.textContent = message;
        element.hidden = !message;
        element.classList.toggle('is-error', error);
    }

    function dialog(title, content, className = '') {
        const element = document.createElement('dialog');
        element.className = `reading-dialog ${className}`;
        element.setAttribute('aria-labelledby', 'reading-dialog-title-' + dialogs.size);
        element.innerHTML = `<div class="reading-dialog-top"><h2 id="reading-dialog-title-${dialogs.size}">${escapeHTML(title)}</h2>
            <button type="button" class="reading-close" aria-label="Chiudi">×</button></div>${content}
            <p class="reading-dialog-error" role="alert" hidden></p>`;
        root.append(element);
        dialogs.add(element);
        let busy = false;
        let onClose = () => {};
        const close = () => { element.close(); };
        element.querySelector('.reading-close').onclick = close;
        element.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
        element.addEventListener('close', () => {
            dialogs.delete(element);
            onClose();
            element.remove();
        }, { once: true });
        element.showModal();
        return {
            element, close,
            set onClose(fn) { onClose = fn; },
            async run(action) {
                if (busy) return;
                busy = true;
                const controls = [...element.querySelectorAll('button, input')];
                const disabled = controls.map(control => control.disabled);
                controls.forEach(control => { control.disabled = true; });
                const errorBox = element.querySelector('.reading-dialog-error');
                errorBox.hidden = true;
                try { await action(); }
                catch (error) { errorBox.textContent = readingErrorMessage(error); errorBox.hidden = false; }
                finally {
                    busy = false;
                    controls.forEach((control, index) => { control.disabled = disabled[index]; });
                }
            }
        };
    }

    function setView(next, selectedId = null) {
        view = next;
        collectionId = selectedId;
        page = 0;
        search.value = '';
        feedback();
        void load();
    }

    async function load() {
        const current = ++request;
        const stillCurrent = () => aliveHere() && current === request;
        const headings = {
            mine: ['I miei libri', 'Tutti i PDF che hai caricato. Sei tu a scegliere quali condividere.'],
            board: ['Bacheca', 'I libri condivisi dalla comunità, in ordine alfabetico.'],
            favorites: ['Preferiti', 'Le letture che vuoi ritrovare al volo.'],
            collections: ['Le mie raccolte', 'Piccoli scaffali per le tue passioni. Visibili soltanto a te.'],
            collection: [collections.find(item => item.id === collectionId)?.name || 'Raccolta', 'I libri di questa raccolta personale.']
        };
        find('#reading-shelf-title').textContent = headings[view][0];
        find('[data-description]').textContent = headings[view][1];
        root.querySelectorAll('[data-view]').forEach(button => {
            const active = button.dataset.view === (view === 'collection' ? 'collections' : view);
            if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
        });
        find('[data-create]').hidden = !user || view !== 'collections';
        find('[data-order]').hidden = view === 'collections';
        find('[data-search-form]').hidden = view === 'collections';
        find('.reading-pagination').hidden = view === 'collections';
        find('[data-prev]').disabled = true;
        find('[data-next]').disabled = true;
        list.setAttribute('aria-busy', 'true');
        list.innerHTML = '<p class="reading-empty">Caricamento…</p>';
        try {
            if (!isSupabaseConfigured) throw new Error('La biblioteca non è ancora disponibile. Riprova tra poco.');
            if (!user && view !== 'board') {
                list.innerHTML = '<div class="reading-empty"><h3>Uno scaffale tutto tuo</h3><p>Accedi a un account per caricare PDF, salvare preferiti e creare raccolte.</p><button type="button" class="reading-secondary" data-browse>Esplora la bacheca</button></div>';
                find('[data-browse]').onclick = () => setView('board');
                find('[data-count]').textContent = '';
                find('[data-page]').textContent = '';
                return;
            }
            if (view === 'collections') {
                collections = await library.listCollections(user.id);
                if (!stillCurrent()) return;
                renderCollections();
                return;
            }
            const result = await library.listBooks({ view, userId: user?.id, collectionId, search: search.value, page });
            if (!stillCurrent()) return;
            // A deletion or privacy change can empty the final page.
            if (page > 0 && result.count <= page * READING_PAGE_SIZE) { page--; void load(); return; }
            const marked = await library.listFavorites(user?.id, result.books.map(book => book.id));
            if (!stillCurrent()) return;
            books = result.books;
            favorites = marked;
            renderBooks();
            find('[data-count]').textContent = `${result.count} ${result.count === 1 ? 'libro' : 'libri'}`;
            find('[data-page]').textContent = `${page + 1} / ${Math.max(1, Math.ceil(result.count / READING_PAGE_SIZE))}`;
            find('[data-prev]').disabled = page === 0;
            find('[data-next]').disabled = (page + 1) * READING_PAGE_SIZE >= result.count;
        } catch (error) {
            if (!stillCurrent()) return;
            list.innerHTML = '<div class="reading-empty"><h3>Non riesco ad aprire lo scaffale</h3><p data-load-error></p><button type="button" class="reading-secondary" data-retry>Riprova</button></div>';
            find('[data-load-error]').textContent = readingErrorMessage(error);
            find('[data-retry]').onclick = load;
            find('[data-count]').textContent = '';
            find('[data-page]').textContent = '';
        } finally { if (stillCurrent()) list.setAttribute('aria-busy', 'false'); }
    }

    function renderBooks() {
        if (!books.length) {
            const copy = search.value.trim() ? ['Nessun libro trovato', 'Prova un altro titolo o autore.'] : {
                mine: ['Il primo capitolo comincia qui', 'Carica il tuo primo PDF: resterà privato finché non scegli di condividerlo.'],
                board: ['Una bacheca ancora da scrivere', 'Qui appariranno automaticamente i libri condivisi dalla comunità.'],
                favorites: ['Tieni vicine le tue storie', 'Premi la stella accanto a un libro per ritrovarlo qui.'],
                collection: ['Questo scaffale ti aspetta', 'Usa “Raccolte” accanto a un libro per aggiungerlo qui.']
            }[view];
            list.innerHTML = `<div class="reading-empty"><span class="reading-empty-icon">${bookIcon}</span><h3>${copy[0]}</h3><p>${copy[1]}</p></div>`;
            return;
        }
        list.innerHTML = `<ol class="reading-book-list">${books.map(book => `
            <li class="reading-book-row" data-book="${escapeHTML(book.id)}">
                <span class="reading-spine" aria-hidden="true">${bookIcon}<small>PDF</small></span>
                <div class="reading-book-info"><h3>${escapeHTML(book.title)}</h3>
                    <p>${escapeHTML(book.author || 'Autore non indicato')} <span>· ${fileSize(book.size_bytes)}</span></p>
                    <span class="reading-visibility ${book.is_public ? 'is-public' : ''}">${book.is_public ? 'In bacheca' : 'Solo tu'}</span>
                </div>
                <div class="reading-book-actions">
                    <button type="button" class="reading-secondary" data-action="read">Leggi <span aria-hidden="true">↗</span></button>
                    ${user ? `<button type="button" class="reading-star ${favorites.has(book.id) ? 'is-favorite' : ''}" data-action="favorite"
                        aria-label="${favorites.has(book.id) ? 'Rimuovi dai' : 'Aggiungi ai'} preferiti: ${escapeHTML(book.title)}" aria-pressed="${favorites.has(book.id)}">${favorites.has(book.id) ? '★' : '☆'}</button>
                    <button type="button" class="reading-secondary" data-action="organize">Raccolte</button>` : ''}
                    ${book.owner_id === user?.id ? `<button type="button" class="reading-text-button" data-action="visibility">${book.is_public ? 'Rendi privato' : 'Condividi'}</button>` : ''}
                </div>
            </li>`).join('')}</ol>`;
    }

    function renderCollections() {
        list.innerHTML = collections.length ? `<ul class="reading-collections">${collections.map(item => `
            <li><button type="button" class="reading-collection-open" data-collection="${escapeHTML(item.id)}"><span aria-hidden="true">▤</span><strong>${escapeHTML(item.name)}</strong><small>Apri raccolta →</small></button>
            <div><button type="button" class="reading-text-button" data-rename="${escapeHTML(item.id)}">Rinomina</button><button type="button" class="reading-text-button" data-delete="${escapeHTML(item.id)}">Elimina</button></div></li>
        `).join('')}</ul>` : '<div class="reading-empty"><h3>Fai spazio alle tue passioni</h3><p>Crea una raccolta, poi aggiungi i libri con il pulsante “Raccolte”.</p></div>';
    }

    function openUpload() {
        if (!user) return;
        const modal = dialog('Un nuovo libro sul tuo scaffale', `
            <p>Carica un PDF. Alla fine potrai scegliere se condividerlo con la comunità.</p>
            <form class="reading-form" data-upload-form>
                <label class="reading-dropzone">${bookIcon}<strong>Scegli un PDF o trascinalo qui</strong><span>PDF · massimo 50 MB</span>
                    <input name="pdf" type="file" accept=".pdf,application/pdf" required aria-label="File PDF"></label>
                <label>Titolo<input name="title" required maxlength="200" placeholder="Il titolo del libro"></label>
                <label>Autore <span>(facoltativo)</span><input name="author" maxlength="160" placeholder="Nome autore"></label>
                <p class="reading-form-note">Il caricamento è privato. Nessuna condivisione automatica.</p>
                <button type="submit" class="reading-primary">Carica nella mia biblioteca</button>
                <span data-upload-status role="status"></span>
            </form>`);
        const form = modal.element.querySelector('form');
        let file;
        const choose = selected => {
            file = selected;
            if (!file) return;
            form.elements.title.value = bookTitleFromFilename(file.name);
            form.querySelector('.reading-dropzone strong').textContent = file.name;
        };
        form.elements.pdf.onchange = () => choose(form.elements.pdf.files[0]);
        const dropzone = form.querySelector('.reading-dropzone');
        dropzone.ondragover = event => { event.preventDefault(); dropzone.classList.add('is-dragging'); };
        dropzone.ondragleave = () => dropzone.classList.remove('is-dragging');
        dropzone.ondrop = event => {
            event.preventDefault(); dropzone.classList.remove('is-dragging');
            choose(event.dataTransfer.files[0]);
            if (file) form.elements.pdf.required = false;
        };
        form.onsubmit = event => {
            event.preventDefault();
            const title = form.elements.title.value;
            const author = form.elements.author.value;
            void modal.run(async () => {
                const status = form.querySelector('[data-upload-status]');
                status.textContent = 'Caricamento in corso…';
                try {
                    const book = await library.uploadBook(file, { title, author, userId: user.id });
                    if (!aliveHere()) return;
                    modal.close();
                    setView('mine');
                    openConsent(book, true);
                } finally { status.textContent = ''; }
            });
        };
    }

    function openConsent(book, justUploaded = false) {
        const modal = dialog(justUploaded ? 'PDF caricato con successo' : 'Condividi questo libro', `
            <div class="reading-success-icon" aria-hidden="true">✓</div>
            <p><strong>${escapeHTML(book.title)}</strong> è nella tua biblioteca privata.</p>
            <p>Vuoi renderlo disponibile al pubblico per contribuire alla crescita e allo sviluppo della piattaforma?</p>
            <label class="reading-consent"><input type="checkbox" name="publish">
                <span>Sì, voglio rendere questo PDF pubblico nella Bacheca della Taverna.</span></label>
            <p class="reading-form-note">Senza la spunta, il libro resta visibile solo al tuo account. Puoi cambiare scelta in qualsiasi momento.</p>
            <div class="reading-dialog-actions"><button type="button" class="reading-secondary" data-private>Solo per me</button>
                <button type="button" class="reading-primary" data-confirm>Conferma scelta</button></div>`);
        modal.element.querySelector('[data-private]').onclick = () => { modal.close(); feedback('Libro salvato nella tua biblioteca privata.'); };
        modal.element.querySelector('[data-confirm]').onclick = () => {
            const publish = modal.element.querySelector('[name="publish"]').checked;
            void modal.run(async () => {
                if (publish) await library.setVisibility(book.id, true, user.id);
                if (!aliveHere()) return;
                modal.close();
                feedback(publish ? 'Il libro è ora disponibile in Bacheca.' : 'Libro salvato nella tua biblioteca privata.');
                await load();
            });
        };
    }

    function makePrivate(book) {
        const modal = dialog('Rendi privato il libro', `<p>“${escapeHTML(book.title)}” sarà rimosso dalla bacheca e resterà accessibile soltanto a te.</p>
            <p>Non sarà più apribile dalla bacheca, dai preferiti o dalle raccolte degli altri account. Le copie già aperte o scaricate possono restare disponibili a chi le ha ricevute.</p>
            <button type="button" class="reading-primary" data-confirm>Rendi privato</button>`);
        modal.element.querySelector('[data-confirm]').onclick = () => void modal.run(async () => {
            await library.setVisibility(book.id, false, user.id);
            if (!aliveHere()) return;
            modal.close(); feedback('Il libro è ora visibile soltanto a te.'); await load();
        });
    }

    function editCollection(item = null, afterSave = null) {
        const modal = dialog(item ? 'Rinomina raccolta' : 'Nuova raccolta', `<form class="reading-form">
            <label>Nome della raccolta<input name="name" required maxlength="80" value="${escapeHTML(item?.name || '')}" placeholder="Es. Mondi da esplorare" autofocus></label>
            <button type="submit" class="reading-primary">${item ? 'Salva nome' : 'Crea raccolta'}</button></form>`);
        modal.element.querySelector('form').onsubmit = event => {
            event.preventDefault();
            const name = event.currentTarget.elements.name.value;
            void modal.run(async () => {
                await library.saveCollection(name, user.id, item?.id);
                if (!aliveHere()) return;
                modal.close();
                if (afterSave) await afterSave(); else await load();
            });
        };
    }

    function deleteCollection(item) {
        const modal = dialog('Elimina raccolta', `<p>Eliminare “${escapeHTML(item.name)}”? I libri resteranno nella biblioteca e nella bacheca.</p>
            <button type="button" class="reading-primary" data-confirm>Elimina raccolta</button>`);
        modal.element.querySelector('[data-confirm]').onclick = () => void modal.run(async () => {
            await library.deleteCollection(item.id, user.id);
            if (!aliveHere()) return;
            modal.close(); await load();
        });
    }

    async function organize(book) {
        const modal = dialog('Aggiungi alle tue raccolte', `<p>${escapeHTML(book.title)}</p><div data-memberships>Caricamento…</div>
            <div class="reading-dialog-actions"><button type="button" class="reading-secondary" data-new>+ Nuova raccolta</button><button type="button" class="reading-primary" data-done>Fatto</button></div>`);
        modal.element.querySelector('[data-done]').onclick = modal.close;
        modal.element.querySelector('[data-new]').onclick = () => { modal.close(); editCollection(null, () => organize(book)); };
        await modal.run(async () => {
            const [items, selected] = await Promise.all([library.listCollections(user.id), library.bookCollections(book.id, user.id)]);
            if (!aliveHere() || !modal.element.open) return;
            const target = modal.element.querySelector('[data-memberships]');
            target.innerHTML = items.length ? items.map(item => `<label class="reading-consent"><input type="checkbox" value="${escapeHTML(item.id)}" ${selected.has(item.id) ? 'checked' : ''}><span>${escapeHTML(item.name)}</span></label>`).join('') : '<p>Non hai ancora raccolte. Creane una per iniziare.</p>';
            target.onchange = event => {
                const checkbox = event.target;
                if (!(checkbox instanceof HTMLInputElement)) return;
                const included = checkbox.checked;
                void modal.run(async () => {
                    try { await library.setBookCollection(book.id, checkbox.value, included, user.id); }
                    catch (error) { checkbox.checked = !included; throw error; }
                    if (aliveHere() && view === 'collection') await load();
                });
            };
        });
    }

    async function readBook(book) {
        const modal = dialog(book.title, '<p data-reader-loading>Preparazione del PDF…</p><div data-reader></div>', 'reading-reader');
        let objectUrl;
        modal.onClose = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
        // Reading remains cancellable while the file is downloaded.
        try {
            const blob = await library.downloadBook(book);
            if (!aliveHere() || !modal.element.open) return;
            objectUrl = URL.createObjectURL(blob);
            modal.element.querySelector('[data-reader-loading]').remove();
            const holder = modal.element.querySelector('[data-reader]');
            const link = document.createElement('a');
            link.href = objectUrl; link.download = `${book.title}.pdf`; link.className = 'reading-secondary'; link.textContent = 'Scarica PDF';
            const frame = document.createElement('iframe');
            frame.title = `Lettore PDF: ${book.title}`; frame.src = objectUrl;
            holder.append(link, frame);
        } catch (error) {
            if (modal.element.open) modal.element.querySelector('[data-reader-loading]').textContent = readingErrorMessage(error);
        }
    }

    list.onclick = async event => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        const itemId = button.dataset.collection || button.dataset.rename || button.dataset.delete;
        if (button.dataset.collection) { setView('collection', itemId); return; }
        if (button.dataset.rename) { editCollection(collections.find(item => item.id === itemId)); return; }
        if (button.dataset.delete) { deleteCollection(collections.find(item => item.id === itemId)); return; }
        const book = books.find(item => item.id === button.closest('[data-book]')?.dataset.book);
        if (!book) return;
        if (button.dataset.action === 'read') { void readBook(book); return; }
        if (button.dataset.action === 'organize') { void organize(book); return; }
        if (button.dataset.action === 'visibility') { book.is_public ? makePrivate(book) : openConsent(book); return; }
        if (button.dataset.action === 'favorite') {
            button.disabled = true;
            try {
                const marked = !favorites.has(book.id);
                await library.setFavorite(book.id, marked, user.id);
                if (!aliveHere()) return;
                feedback(marked ? 'Libro aggiunto ai tuoi preferiti.' : 'Libro rimosso dai preferiti.');
                await load();
            } catch (error) { feedback(readingErrorMessage(error), true); }
            finally { button.disabled = false; }
        }
    };

    find('[data-home]').onclick = () => navigateTo('home', container);
    find('[data-upload]').onclick = openUpload;
    find('[data-create]').onclick = () => editCollection();
    root.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => setView(button.dataset.view); });
    find('[data-prev]').onclick = () => { page--; void load(); };
    find('[data-next]').onclick = () => { page++; void load(); };
    search.oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { page = 0; void load(); }, 250); };
    find('[data-search-form]').onsubmit = event => { event.preventDefault(); clearTimeout(searchTimer); page = 0; void load(); };
    const refresh = () => { if (aliveHere()) void load(); };
    window.addEventListener('tavernaViewRefresh', refresh);
    const subscription = supabase.auth.onAuthStateChange?.((_event, session) => {
        if (user && session?.user?.id !== user.id && aliveHere()) {
            // Supabase auth callbacks run under its session lock. Re-enter after it is released.
            setTimeout(() => {
                if (!aliveHere()) return;
                window.__readingCleanup?.();
                void showReading(container);
            }, 0);
        }
    });
    window.__readingCleanup = () => {
        alive = false;
        ++request;
        clearTimeout(searchTimer);
        window.removeEventListener('tavernaViewRefresh', refresh);
        subscription?.data?.subscription?.unsubscribe();
        dialogs.forEach(element => element.close());
    };

    try {
        user = isSupabaseConfigured ? await library.getUser() : null;
        if (!aliveHere()) return;
        find('[data-upload]').disabled = !user;
        const note = find('[data-account-note]');
        if (!user || user.is_anonymous) {
            note.hidden = false;
            note.textContent = user ? 'Stai usando un account ospite: la biblioteca è legata a questo accesso. Usa un account registrato per ritrovarla anche su altri dispositivi.' : 'Puoi esplorare la bacheca. Accedi al tuo account per caricare e organizzare i libri.';
        }
        view = user ? 'mine' : 'board';
        await load();
    } catch (error) { feedback(readingErrorMessage(error), true); list.textContent = 'Impossibile verificare l’account. Riapri Lettura per riprovare.'; list.setAttribute('aria-busy', 'false'); }
}
