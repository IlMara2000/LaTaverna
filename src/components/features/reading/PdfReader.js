import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import './pdf-reader.css';
import { getReadingPosition, saveReadingPosition, getReaderPreferences, saveReaderPreferences } from '../../../services/readingProgress.js';

GlobalWorkerOptions.workerSrc = workerUrl;

// A real PDF viewer exposes PDF coordinates, unlike the browser's opaque iframe viewer.
export async function mountPdfReader(holder, { data, bookId, userId, signal, downloadLink }) {
    const { EventBus, PDFViewer, PDFLinkService, PDFFindController } = await import('pdfjs-dist/legacy/web/pdf_viewer.mjs');
    if (signal.aborted) return;
    holder.className = 'ebook-reader';
    holder.innerHTML = `
        <div class="ebook-tools" role="group" aria-label="Strumenti di lettura">
            <span class="ebook-kicker">IL TUO SPAZIO DI LETTURA</span>
            <button type="button" data-toggle-search aria-expanded="false">⌕ Cerca</button>
            <button type="button" data-toggle-settings aria-expanded="false">Aa Aspetto</button>
        </div>
        <form class="ebook-search" hidden role="search" aria-label="Cerca nel libro">
            <input type="search" data-search placeholder="Cerca una parola nel libro" aria-label="Cerca nel libro">
            <button type="submit" aria-label="Risultato successivo">↓</button>
            <button type="button" data-search-prev aria-label="Risultato precedente">↑</button>
            <span data-search-status role="status"></span>
        </form>
        <div class="ebook-settings" hidden aria-label="Aspetto della lettura">
            <label>Pagina <select data-theme aria-label="Colore della pagina"><option value="paper">Carta</option><option value="sepia">Seppia</option><option value="night">Notte</option></select></label>
            <label>Zoom <select data-zoom aria-label="Zoom del PDF"><option value="page-width">Larghezza</option><option value="page-fit">Pagina intera</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option></select></label>
            <label>Lettura <select data-mode aria-label="Modalità di lettura"><option value="continuous">Scorrimento</option><option value="page">Una pagina</option></select></label>
            <div class="ebook-settings-actions"><button type="button" data-start>Ricomincia</button><span data-download></span></div>
            <p>Il segnalibro ricorda il punto di lettura su questo dispositivo. Il PDF conserva la sua impaginazione.</p>
        </div>
        <div class="pdf-reader-shell"><div class="pdf-scroll" tabindex="0" aria-label="Pagine del PDF"><div class="pdfViewer"></div></div></div>
        <footer class="ebook-footer">
            <progress data-progress max="100" value="0" aria-label="Avanzamento nel libro"></progress>
            <div class="pdf-toolbar" role="group" aria-label="Controlli del PDF">
                <button type="button" data-prev aria-label="Pagina precedente">←</button>
                <label>Pagina <input data-page type="number" min="1" value="1" aria-label="Pagina del PDF"></label>
                <span data-total></span><button type="button" data-next aria-label="Pagina successiva">→</button>
            </div>
            <p class="pdf-bookmark-status" role="status">Preparazione del libro…</p>
        </footer>`;
    const find = selector => holder.querySelector(selector);
    const status = find('.pdf-bookmark-status');
    if (downloadLink) find('[data-download]').append(downloadLink);
    let preferences = getReaderPreferences(userId);
    holder.dataset.paper = preferences.theme;
    find('[data-theme]').value = preferences.theme;
    find('[data-mode]').value = preferences.mode;
    const controls = [...holder.querySelectorAll('button, input, select')];
    controls.forEach(control => control.disabled = true);
    const container = find('.pdf-scroll');
    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus, externalLinkTarget: 2, externalLinkRel: 'noopener noreferrer' });
    const findController = new PDFFindController({ eventBus, linkService });
    const viewer = new PDFViewer({ container, eventBus, linkService, findController, abortSignal: signal,
        maxCanvasPixels: 4_000_000, imageResourcesPath: `${import.meta.env.BASE_URL}pdfjs-assets/web/images/` });
    linkService.setViewer(viewer);
    let document = null;
    let position = null;
    let restoring = true;
    let timer;
    let resolveReady;
    let saved = getReadingPosition(userId, bookId);
    const assets = `${import.meta.env.BASE_URL}pdfjs-assets/`;
    const task = getDocument({ data, cMapUrl: `${assets}cmaps/`, cMapPacked: true,
        standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`, iccUrl: `${assets}iccs/`,
        isEvalSupported: false });

    function flush() {
        clearTimeout(timer);
        if (!position || restoring) return;
        const success = saveReadingPosition(userId, bookId, position);
        status.textContent = success ? 'Segnalibro salvato su questo dispositivo'
            : 'Il browser non consente di salvare il segnalibro su questo dispositivo.';
    }
    function capture({ location }) {
        if (restoring || signal.aborted) return;
        position = { page: location.pageNumber, left: location.left, top: location.top,
            zoom: typeof location.scale === 'number' ? location.scale / 100 : location.scale,
            fingerprint: document.fingerprints[0] };
        find('[data-page]').value = viewer.currentPageNumber;
        const box = viewer.getPageView(location.pageNumber - 1)?.pdfPage?.view;
        const fraction = box ? Math.max(0, Math.min(1, (box[3] - location.top) / (box[3] - box[1]))) : 0;
        find('[data-progress]').value = Math.min(100, ((location.pageNumber - 1 + fraction) / document.numPages) * 100);
        find('[data-prev]').disabled = viewer.currentPageNumber <= 1;
        find('[data-next]').disabled = viewer.currentPageNumber >= document.numPages;
        clearTimeout(timer);
        timer = setTimeout(flush, 200);
    }
    eventBus.on('updateviewarea', capture);
    const resizeObserver = new ResizeObserver(() => {
        if (restoring || signal.aborted) return;
        if (['page-width', 'page-fit', 'auto'].includes(viewer.currentScaleValue)) {
            viewer.currentScaleValue = viewer.currentScaleValue;
        }
        viewer.update();
    });
    resizeObserver.observe(container);
    const saveNow = () => { if (!restoring) viewer.update(); flush(); };
    window.addEventListener('pagehide', saveNow, { signal });
    window.document.addEventListener('visibilitychange', saveNow, { signal });
    container.addEventListener('scroll', () => { if (!restoring) viewer.update(); }, { passive: true, signal });
    signal.addEventListener('abort', () => {
        // Flush the last observed position even if the dialog has already been removed.
        flush(); clearTimeout(timer);
        eventBus.off('updateviewarea', capture);
        resizeObserver.disconnect();
        viewer.setDocument(null); linkService.setDocument(null);
        void task.destroy();
        resolveReady?.();
    }, { once: true });
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; eventBus.on('pagesinit', async () => {
        try {
        // Page dimensions can differ from the cover. Restore only after layout settles.
        await viewer.pagesPromise;
        if (signal.aborted) return resolve();
        if (saved?.fingerprint !== document.fingerprints[0] || saved.page > document.numPages) saved = null;
        find('[data-total]').textContent = `/ ${document.numPages}`;
        find('[data-page]').max = document.numPages;
        viewer.scrollMode = preferences.mode === 'page' ? 3 : 0;
        if (saved) viewer.currentPageNumber = saved.page;
        viewer.currentScaleValue = saved?.zoom || 'page-width';
        find('[data-zoom]').value = String(saved?.zoom || 'page-width');
        if (saved) viewer.scrollPageIntoView({ pageNumber: saved.page,
            destArray: [null, { name: 'XYZ' }, saved.left, saved.top, null], allowNegativeOffset: true });
        requestAnimationFrame(() => {
            if (signal.aborted) return resolve();
            restoring = false;
            controls.forEach(control => control.disabled = false);
            viewer.update();
            status.textContent = saved ? `Ripreso dal segnalibro · pagina ${saved.page}` : 'Il punto di lettura si salva automaticamente su questo dispositivo.';
            resolve();
        });
        } catch (error) { reject(error); }
    }, { once: true }); });
    for (const name of ['search', 'settings']) {
        find(`[data-toggle-${name}]`).onclick = event => {
            const panel = find(`.ebook-${name}`);
            panel.hidden = !panel.hidden;
            event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
            if (name === 'search' && !panel.hidden) find('[data-search]').focus();
            if (name === 'search' && panel.hidden) eventBus.dispatch('findbarclose', { source: holder });
            viewer.update();
        };
    }
    function search(type = '', findPrevious = false) {
        eventBus.dispatch('find', { source: holder, type, query: find('[data-search]').value,
            caseSensitive: false, entireWord: false, highlightAll: true, findPrevious, matchDiacritics: false });
    }
    find('.ebook-search').onsubmit = event => { event.preventDefault(); search('again'); };
    find('[data-search]').oninput = () => search();
    find('[data-search-prev]').onclick = () => search('again', true);
    eventBus.on('updatefindmatchescount', ({ matchesCount }) => {
        find('[data-search-status]').textContent = `${matchesCount.current} / ${matchesCount.total} risultati`;
    });
    eventBus.on('updatefindcontrolstate', ({ state }) => {
        if (state === 1) find('[data-search-status]').textContent = 'Nessun risultato';
        if (state === 3) find('[data-search-status]').textContent = 'Ricerca…';
    });
    find('[data-theme]').onchange = event => {
        preferences.theme = event.target.value;
        holder.dataset.paper = preferences.theme;
        saveReaderPreferences(userId, preferences);
    };
    find('[data-mode]').onchange = event => {
        preferences.mode = event.target.value;
        const previous = position;
        viewer.scrollMode = preferences.mode === 'page' ? 3 : 0;
        if (previous) viewer.scrollPageIntoView({ pageNumber: previous.page,
            destArray: [null, { name: 'XYZ' }, previous.left, previous.top, null], allowNegativeOffset: true });
        saveReaderPreferences(userId, preferences);
    };
    find('[data-prev]').onclick = () => viewer.currentPageNumber = Math.max(1, viewer.currentPageNumber - 1);
    find('[data-next]').onclick = () => viewer.currentPageNumber = Math.min(document.numPages, viewer.currentPageNumber + 1);
    container.addEventListener('keydown', event => {
        if (event.target !== container || !['ArrowLeft', 'ArrowRight'].includes(event.key) || restoring) return;
        event.preventDefault();
        viewer.currentPageNumber = Math.max(1, Math.min(document.numPages, viewer.currentPageNumber + (event.key === 'ArrowRight' ? 1 : -1)));
    }, { signal });
    find('[data-page]').onchange = event => {
        const page = Math.trunc(Number(event.target.value));
        if (page >= 1 && page <= document.numPages) viewer.currentPageNumber = page;
        else event.target.value = viewer.currentPageNumber;
    };
    find('[data-zoom]').onchange = event => viewer.currentScaleValue = event.target.value;
    find('[data-start]').onclick = () => { viewer.currentPageNumber = 1; container.scrollTo(0, 0); viewer.update(); flush(); };
    try {
        document = await task.promise;
        if (signal.aborted) return;
        await document.getPage(1);
        if (signal.aborted) return;
        linkService.setDocument(document);
        viewer.setDocument(document);
        await ready;
    } catch (error) {
        if (signal.aborted) return;
        status.textContent = 'Questo PDF non si apre nel lettore. Puoi scaricarlo per leggerlo sul dispositivo.';
        find('.ebook-settings').hidden = false;
        find('.pdf-toolbar').hidden = true;
        find('.pdf-reader-shell').hidden = true;
    }
}
