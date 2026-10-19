import { renderCardSymbols } from '../services/cardSymbols.js';
import { buildWantlistExport, downloadWantlist } from '../services/magicWantlistExport.js';
import { rememberDestination } from '../services/appNavigation.js';
import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { scanMagicDocument } from '../services/magicDocumentScan.js';
import { getMagicAccount, loadMagicLibrary, loadPublicMagicShare, saveMagicLibrary } from '../services/magicLibrary.js';
import './magic-viewer.css';

const COLLECTION_KEY = 'taverna_magic_collection_v1';
const DECKS_KEY = 'taverna_magic_decks_v1';
const WANTLIST_KEY = 'taverna_magic_wantlist_v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const read = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

const face = card => card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal || card.image || '';
const summary = card => ({
    id: card.id, name: card.name, image: face(card), manaCost: card.mana_cost || card.card_faces?.[0]?.mana_cost || card.manaCost || '',
    typeLine: card.type_line || card.card_faces?.map(item => item.type_line).filter(Boolean).join(' // ') || card.typeLine || '',
    oracleText: card.oracle_text || card.card_faces?.map(item => item.oracle_text).filter(Boolean).join('\n//\n') || card.oracleText || '',
    printedText: card.printed_text || card.card_faces?.map(item => item.printed_text).filter(Boolean).join('\n//\n') || card.printedText || '',
    printedName: card.printed_name || card.printedName || '', language: card.lang || card.language || 'en', oracleId: card.oracle_id || card.oracleId || '',
    set: card.set_name || card.set || '', rarity: card.rarity || '', quantity: Math.max(1, Number(card.quantity) || 1), cmc: card.cmc || 0
});

async function lookupExactCards(names) {
    const found = new Map();
    for (let offset = 0; offset < names.length; offset += 75) {
        const identifiers = names.slice(offset, offset + 75).map(item => ({ name: item.name }));
        const response = await fetch('https://api.scryfall.com/cards/collection', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers })
        });
        if (!response.ok) throw new Error('Catalogo carte temporaneamente non disponibile. Riprova tra poco.');
        const payload = await response.json();
        for (const card of payload.data || []) found.set(normalize(card.name), card);
    }
    return names.map(item => ({ ...item, card: found.get(normalize(item.name)) || null }));
}

async function getLocalizedText(card) {
    if (card.printedText && card.language === 'it') return { text: card.printedText, translated: false };
    if (card.id) {
        try {
            let oracleId = card.oracleId;
            if (!oracleId) {
                const canonical = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(card.id)}`);
                if (canonical.ok) oracleId = (await canonical.json()).oracle_id;
            }
            if (!oracleId) throw new Error('ID Oracle non disponibile');
            const query = `oracleid:${oracleId} lang:it`;
            const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=prints&order=released&dir=desc`);
            if (response.ok) {
                const data = await response.json();
                const printing = data.data?.find(item => item.lang === 'it' && (item.printed_text || item.card_faces?.some(part => part.printed_text)));
                const text = printing?.printed_text || printing?.card_faces?.map(part => part.printed_text).filter(Boolean).join('\n//\n');
                if (text) return { text, name: printing.printed_name || '', translated: false };
            }
        } catch { /* translation fallback below */ }
    }
    const response = await fetch('/api/magic/translate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: card.name, typeLine: card.typeLine, text: card.oracleText })
    });
    if (!response.ok) throw new Error('Traduzione italiana non disponibile. Mostro il testo originale.');
    const data = await response.json();
    return { text: data.translation, name: '', translated: true };
}

export function showMagicDashboard(container, options = {}) {
    const shareParams = new URLSearchParams(location.search);
    const sharedCollectionId = shareParams.get('magic-collection'), sharedDeckId = shareParams.get('magic-deck');
    if (sharedCollectionId || sharedDeckId) { renderShare(container, { collectionId: sharedCollectionId, deckId: sharedDeckId }); return; }
    window.__magicCleanup?.(); updateSidebarContext('magic'); rememberDestination('magic', options);

    let cards = read(COLLECTION_KEY), decks = read(DECKS_KEY), wantlist = read(WANTLIST_KEY);
    let tab = options.tab === 'wantlist' ? 'wantlist' : ['collezione','mazzi'].includes(options.tab) ? options.tab : 'collezione';
    let activeDeckId = decks[0]?.id || '';
    let exportLanguage = 'it', exportFormat = 'txt';
    let filter = '', notice = '', pending = [], busy = false, cloudUserId = null, disposed = false, modalCard = null;
    let cloudQueue = Promise.resolve(), searchResults = [];

    const persist = () => {
        save(COLLECTION_KEY, cards); save(DECKS_KEY, decks); save(WANTLIST_KEY, wantlist);
        if (cloudUserId) {
            const userId = cloudUserId;
            cloudQueue = cloudQueue.catch(() => {}).then(() => saveMagicLibrary({ userId, cards, decks, wantlist }));
            cloudQueue.catch(error => { if (!disposed) setNotice(`Salvato sul dispositivo. Sincronizzazione: ${error.message}`); });
        }
    };
    const setNotice = value => { notice = value || ''; const node = container.querySelector('#magic-viewer-notice'); if (node) node.textContent = notice; };
    const byId = () => new Map(cards.map(card => [String(card.id), card]));
    const cardTile = (card, area) => `<article class="mv-card" data-card-id="${esc(card.id)}">
        <button class="mv-card-open" type="button" data-open-card="${esc(card.id)}" aria-label="Apri ${esc(card.name)}">
          <span class="mv-art">${card.image ? `<img src="${esc(card.image)}" alt="${esc(card.name)}" loading="lazy">` : '<span class="mv-no-art">Carta</span>'}</span>
          <span class="mv-card-meta"><strong>${esc(card.printedName || card.name)}</strong><small>${renderCardSymbols(card.manaCost)} · ${esc(card.typeLine)}</small><span>×${Math.max(1, Number(card.quantity) || 1)}</span></span>
        </button>
        <button type="button" class="mv-want ${wantlist.some(item => String(item.id) === String(card.id)) ? 'is-wanted' : ''}" data-want="${esc(card.id)}" aria-label="${wantlist.some(item => String(item.id) === String(card.id)) ? 'Rimuovi dalla' : 'Aggiungi alla'} wantlist">${wantlist.some(item => String(item.id) === String(card.id)) ? '◆' : '◇'}</button>
        ${area === 'wantlist' ? `<button type="button" class="mv-remove" data-remove-want="${esc(card.id)}">Rimuovi</button>` : ''}
      </article>`;

    const render = () => {
        if (disposed) return;
        const visible = cards.filter(card => normalize(`${card.name} ${card.printedName}`).includes(normalize(filter)));
        const wanted = wantlist.filter(card => normalize(`${card.name} ${card.printedName}`).includes(normalize(filter)));
        const activeDeck = decks.find(deck => deck.id === activeDeckId) || decks[0];
        const cardMap = byId();
        const deckCards = activeDeck ? activeDeck.cards.map(entry => ({ ...cardMap.get(String(entry.cardId)), quantity: entry.quantity })).filter(card => card.id) : [];
        container.innerHTML = `<main class="magic-page magic-viewer">
          <header class="mv-heading"><div><span class="mv-eyebrow">LA TAVERNA · ARCHIVIO MAGIC</span><h1>Le tue carte</h1><p>Cerca, consulta e organizza la tua raccolta.</p></div></header>
          <nav class="mv-tabs" aria-label="Sezioni Magic">
            <button type="button" data-tab="collezione" aria-selected="${tab==='collezione'}">Collezione <span>${cards.length}</span></button>
            <button type="button" data-tab="mazzi" aria-selected="${tab==='mazzi'}">Mazzi <span>${decks.length}</span></button>
            <button type="button" data-tab="wantlist" aria-selected="${tab==='wantlist'}">Wantlist <span>${wantlist.length}</span></button>
          </nav>
          <p id="magic-viewer-notice" class="mv-notice" aria-live="polite">${esc(notice)}</p>
          ${tab === 'collezione' ? `<section class="mv-panel">
            <div class="mv-panel-heading"><div><span class="mv-eyebrow">LA TUA RACCOLTA</span><h2>Collezione</h2><p>Apri una carta per leggere l’effetto. Il simbolo ◇ la aggiunge alla wantlist.</p></div><strong>${cards.reduce((sum,card)=>sum+(Number(card.quantity)||1),0)} carte</strong></div>
            <div class="mv-import"><div><h3>Importa una lista</h3><p>Carica un file PDF, TXT o DOCX. I nomi vengono cercati nel catalogo ufficiale.</p></div><label class="mv-file">Scegli file<input id="mv-file" type="file" accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label></div>
            <label class="mv-search"><span>⌕</span><input id="mv-filter" type="search" placeholder="Filtra le carte per nome…" value="${esc(filter)}"></label>
            ${pending.length ? `<div class="mv-review"><h3>Controlla le carte trovate</h3><p>Verifica i nomi prima di salvarli; gli elementi in rosso non sono stati associati a una carta.</p>${pending.map((item,index)=>`<div class="mv-review-row"><label>${esc(item.name)} <small>×${item.quantity}</small><select data-resolve="${index}"><option value="">${item.card ? `Trovata: ${esc(item.card.name)}` : 'Scegli il risultato esatto'}</option>${(item.matches||[]).map(card=>`<option value="${esc(card.id)}">${esc(card.name)} · ${esc(card.set_name||card.set||'')}</option>`).join('')}</select></label></div>`).join('')}<div class="mv-actions"><button type="button" class="mv-button" id="mv-confirm-import" ${pending.some(item=>!item.card)?'disabled':''}>Aggiungi carte selezionate</button><button type="button" class="mv-button mv-soft" id="mv-cancel-import">Annulla</button></div></div>` : ''}
            <div class="mv-grid">${visible.map(card=>cardTile(card,'collection')).join('') || `<p class="mv-empty">${cards.length?'Nessuna carta corrisponde alla ricerca.':'La collezione è vuota. Importa un PDF, TXT o DOCX per iniziare.'}</p>`}</div>
          </section>` : tab === 'mazzi' ? `<section class="mv-panel">
            <div class="mv-panel-heading"><div><span class="mv-eyebrow">ORGANIZZAZIONE</span><h2>I tuoi mazzi</h2><p>Crea un mazzo dalle carte della collezione e gestiscine le copie.</p></div><button type="button" class="mv-button" id="mv-new-deck">Nuovo mazzo</button></div>
            ${decks.length ? `<div class="mv-deck-layout"><aside class="mv-deck-list">${decks.map(deck=>`<button type="button" data-select-deck="${esc(deck.id)}" aria-current="${deck.id===activeDeck?.id}"><strong>${esc(deck.name)}</strong><small>${deck.cards.reduce((sum,item)=>sum+(Number(item.quantity)||1),0)} carte</small></button>`).join('')}</aside><div class="mv-deck-content"><div class="mv-deck-tools"><h3>${esc(activeDeck?.name||'')}</h3><button class="mv-text-button" id="mv-rename-deck" type="button">Rinomina</button><button class="mv-text-button" id="mv-delete-deck" type="button">Elimina</button></div><label class="mv-search"><span>⌕</span><input id="mv-deck-search" type="search" placeholder="Aggiungi una carta…"></label><div id="mv-search-results" class="mv-search-results">${searchResults.map(card=>`<button type="button" data-add-deck-card="${esc(card.id)}"><img src="${esc(face(card))}" alt=""><span>${esc(card.name)}</span><small>+ Aggiungi</small></button>`).join('')}</div><div class="mv-grid">${deckCards.map(card=>`${cardTile(card,'deck')}<div class="mv-quantity-tools"><button data-deck-quantity="${esc(card.id)}" data-delta="-1">−</button><span>${card.quantity}</span><button data-deck-quantity="${esc(card.id)}" data-delta="1">+</button></div>`).join('')||'<p class="mv-empty">Questo mazzo è vuoto. Cerca una carta qui sopra o importane una lista.</p>'}</div></div></div>` : '<p class="mv-empty">Non hai ancora creato mazzi.</p>'}
          </section>` : `<section class="mv-panel"><div class="mv-panel-heading"><div><span class="mv-eyebrow">DA CERCARE</span><h2>Wantlist</h2><p>Le carte che vuoi trovare, pronte da esportare in italiano o inglese.</p></div><strong>${wantlist.length} carte</strong></div><label class="mv-search"><span>⌕</span><input id="mv-filter" type="search" placeholder="Filtra la wantlist…" value="${esc(filter)}"></label><div class="mv-export"><label>Lingua<select id="mv-export-language"><option value="it" ${exportLanguage === 'it' ? 'selected' : ''}>Italiano</option><option value="en" ${exportLanguage === 'en' ? 'selected' : ''}>English</option></select></label><label>Formato<select id="mv-export-format"><option value="txt" ${exportFormat === 'txt' ? 'selected' : ''}>TXT · lista</option><option value="csv" ${exportFormat === 'csv' ? 'selected' : ''}>CSV</option><option value="json" ${exportFormat === 'json' ? 'selected' : ''}>JSON</option></select></label><button type="button" class="mv-button" id="mv-export" ${wanted.length ? '' : 'disabled'}>Esporta ${wanted.length} carte</button><small>Esporta le carte mostrate. In italiano usa i nomi italiani disponibili, altrimenti conserva il nome originale. Funziona anche offline.</small></div><div class="mv-grid">${wanted.map(card=>cardTile(card,'wantlist')).join('') || '<p class="mv-empty">La wantlist è vuota. Nella collezione tocca il simbolo ◇ su una carta per aggiungerla.</p>'}</div></section>`}
          ${modalCard ? `<div class="mv-modal-backdrop" role="presentation"><section class="mv-modal" role="dialog" aria-modal="true" aria-labelledby="mv-modal-title"><button type="button" class="mv-modal-close" aria-label="Chiudi">×</button>${modalCard.image?`<img class="mv-modal-art" src="${esc(modalCard.image)}" alt="${esc(modalCard.name)}">`:''}<div class="mv-modal-copy"><span class="mv-eyebrow">${renderCardSymbols(modalCard.manaCost)} · ${esc(modalCard.typeLine)}</span><h2 id="mv-modal-title">${esc(modalCard.printedName||modalCard.name)}</h2><p class="mv-modal-effect" id="mv-modal-effect">${renderCardSymbols(modalCard.localizedText || modalCard.printedText || modalCard.oracleText || 'Nessun testo disponibile.')}</p><small id="mv-modal-language">${modalCard.localizedText ? (modalCard.translated ? 'Traduzione italiana automatica' : 'Stampa italiana ufficiale') : 'Testo Oracle originale'}</small></div></section></div>` : ''}
        </main>`;
        bind();
    };

    const closeCard = () => { modalCard = null; render(); };
    const openCard = async card => {
        modalCard = { ...card }; render();
        const textNode = container.querySelector('#mv-modal-effect'), languageNode = container.querySelector('#mv-modal-language');
        if (!textNode || !languageNode) return;
        textNode.textContent = 'Cerco la stampa italiana…';
        try {
            const localized = await getLocalizedText(card);
            if (modalCard?.id !== card.id) return;
            modalCard = { ...modalCard, localizedText: localized.text, translated: localized.translated };
            textNode.innerHTML = renderCardSymbols(localized.text); languageNode.textContent = localized.translated ? 'Traduzione italiana automatica' : 'Stampa italiana ufficiale';
        } catch {
            textNode.innerHTML = renderCardSymbols(card.printedText || card.oracleText || 'Nessun testo disponibile.');
            languageNode.textContent = card.printedText ? 'Testo della stampa italiana' : 'Testo Oracle originale · traduzione non disponibile';
        }
    };
    const toggleWant = card => {
        const exists = wantlist.some(item => String(item.id) === String(card.id));
        wantlist = exists ? wantlist.filter(item => String(item.id) !== String(card.id)) : [...wantlist, { ...card }];
        persist(); render(); setNotice(exists ? 'Carta rimossa dalla wantlist.' : 'Carta aggiunta alla wantlist.');
    };

    async function importFile(file) {
        if (busy) return;
        busy = true; setNotice('Leggo il file…');
        try {
            const scanned = await scanMagicDocument(file, message => setNotice(message));
            if (!scanned.length) throw new Error('Non ho trovato nomi di carte nel file.');
            setNotice(`Cerco ${scanned.length} nomi esatti nel catalogo…`);
            pending = await lookupExactCards(scanned);
            for (const entry of pending) {
                if (!entry.card) {
                    const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`name:${entry.name}`)}&unique=cards&order=name`);
                    if (response.ok) entry.matches = (await response.json()).data?.slice(0, 5) || [];
                }
            }
            render();
            setNotice(`Controlla i risultati: ${pending.filter(item=>item.card).length} esatti, ${pending.filter(item=>!item.card).length} da associare.`);
        } catch (error) { setNotice(error.message || 'Importazione non riuscita.'); }
        finally { busy = false; }
    }

    async function finishImport(makeDeck, deckName = '') {
        const accepted = pending.filter(item => item.card).map(item => ({ ...summary(item.card), quantity: item.quantity }));
        if (!accepted.length) { setNotice('Seleziona almeno una carta riconosciuta.'); return; }
        for (const card of accepted) {
            const existing = cards.find(item => String(item.id) === String(card.id));
            if (existing) existing.quantity = Math.min(99, existing.quantity + card.quantity);
            else cards.push(card);
        }
        if (makeDeck) {
            const deck = { id: id(), name: deckName.trim().slice(0,80) || 'Nuovo mazzo', cards: accepted.map(card=>({cardId:card.id,quantity:card.quantity})) };
            decks.push(deck); activeDeckId = deck.id; tab = 'mazzi';
        }
        pending = []; persist(); render(); setNotice(makeDeck ? 'Carte aggiunte alla collezione e salvate nel nuovo mazzo.' : 'Carte aggiunte alla collezione.');
    }

    function bind() {
        container.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { tab = button.dataset.tab; filter = ''; searchResults = []; render(); }));
        container.querySelector('#mv-file')?.addEventListener('change', event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ''; });
        container.querySelector('#mv-filter')?.addEventListener('input', event => { filter = event.target.value; const start=event.target.selectionStart; render(); const input=container.querySelector('#mv-filter'); input?.focus(); try { input?.setSelectionRange(start,start); } catch { /* search inputs may not support selection */ } });
        container.querySelectorAll('[data-open-card]').forEach(button => button.addEventListener('click', () => { const card = byId().get(button.dataset.openCard) || wantlist.find(item=>String(item.id)===button.dataset.openCard); if(card) void openCard(card); }));
        container.querySelectorAll('[data-want]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); const card=byId().get(button.dataset.want)||wantlist.find(item=>String(item.id)===button.dataset.want); if(card) toggleWant(card); }));
        container.querySelectorAll('[data-remove-want]').forEach(button => button.addEventListener('click', () => { wantlist=wantlist.filter(item=>String(item.id)!==button.dataset.removeWant); persist(); render(); }));
        container.querySelector('.mv-modal-close')?.addEventListener('click', closeCard);
        if (modalCard) container.querySelector('.mv-modal-close')?.focus();
        container.querySelector('.mv-modal-backdrop')?.addEventListener('click', event => { if(event.target.classList.contains('mv-modal-backdrop')) closeCard(); });
        container.querySelector('#mv-cancel-import')?.addEventListener('click', () => { pending=[]; render(); setNotice('Importazione annullata.'); });
        container.querySelectorAll('[data-resolve]').forEach(select => select.addEventListener('change', () => { const item=pending[Number(select.dataset.resolve)]; const selected=item.matches?.find(card=>card.id===select.value); if(selected) item.card=selected; else if(select.value==='') item.card=null; const button=container.querySelector('#mv-confirm-import'); if(button) button.disabled=pending.some(entry=>!entry.card); }));
        container.querySelector('#mv-confirm-import')?.addEventListener('click', () => {
            const count=pending.length;
            if(count>1 && window.confirm('Vuoi creare un mazzo con questo caricamento?\n\nOK: assegna un nome al mazzo.\nAnnulla: aggiungi le carte solo alla collezione.')) {
                const name=window.prompt('Come vuoi chiamare il mazzo?','Nuovo mazzo'); if(name===null) return; void finishImport(true,name);
            } else void finishImport(false);
        });
        container.querySelector('#mv-new-deck')?.addEventListener('click', () => { const name=window.prompt('Nome del nuovo mazzo:'); if(!name?.trim()) return; const deck={id:id(),name:name.trim().slice(0,80),cards:[]}; decks.push(deck); activeDeckId=deck.id; persist(); render(); });
        container.querySelectorAll('[data-select-deck]').forEach(button=>button.addEventListener('click',()=>{activeDeckId=button.dataset.selectDeck;searchResults=[];render();}));
        container.querySelector('#mv-rename-deck')?.addEventListener('click',()=>{const deck=decks.find(item=>item.id===activeDeckId);const name=window.prompt('Nuovo nome del mazzo:',deck?.name||'');if(name?.trim()){deck.name=name.trim().slice(0,80);persist();render();}});
        container.querySelector('#mv-delete-deck')?.addEventListener('click',()=>{if(!window.confirm('Eliminare questo mazzo? Le carte resteranno nella collezione.'))return;decks=decks.filter(item=>item.id!==activeDeckId);activeDeckId=decks[0]?.id||'';persist();render();});
        container.querySelector('#mv-deck-search')?.addEventListener('input', async event=>{const value=event.target.value.trim();if(value.length<2){searchResults=[];container.querySelector('#mv-search-results').innerHTML='';return;}try{const response=await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`name:${value}`)}&unique=cards&order=name`);if(!response.ok)return;searchResults=(await response.json()).data?.slice(0,8)||[];const root=container.querySelector('#mv-search-results');if(root)root.innerHTML=searchResults.map(card=>`<button type="button" data-add-deck-card="${esc(card.id)}"><img src="${esc(face(card))}" alt=""><span>${esc(card.name)}</span><small>+ Aggiungi</small></button>`).join('');root?.querySelectorAll('[data-add-deck-card]').forEach(button=>button.addEventListener('click',()=>{const found=searchResults.find(card=>card.id===button.dataset.addDeckCard);if(!found)return;let own=cards.find(card=>card.id===found.id);if(!own){own=summary(found);cards.push(own);}const deck=decks.find(item=>item.id===activeDeckId);const entry=deck.cards.find(item=>item.cardId===own.id);if(entry)entry.quantity++;else deck.cards.push({cardId:own.id,quantity:1});persist();render();setNotice(`${own.name} aggiunta al mazzo e alla collezione.`);}));}catch{setNotice('Ricerca non disponibile.');}});
        container.querySelectorAll('[data-deck-quantity]').forEach(button=>button.addEventListener('click',()=>{const deck=decks.find(item=>item.id===activeDeckId),cardId=button.dataset.deckQuantity,entry=deck?.cards.find(item=>String(item.cardId)===cardId);if(!entry)return;entry.quantity+=Number(button.dataset.delta);if(entry.quantity<=0)deck.cards=deck.cards.filter(item=>String(item.cardId)!==cardId);persist();render();}));
        container.querySelector('#mv-export-language')?.addEventListener('change', event => { exportLanguage = event.target.value; });
        container.querySelector('#mv-export-format')?.addEventListener('change', event => { exportFormat = event.target.value; });
        container.querySelector('#mv-export')?.addEventListener('click', () => {
            try {
                const selected = wantlist.filter(card => normalize(`${card.name} ${card.printedName}`).includes(normalize(filter)));
                const file = buildWantlistExport(selected, { language: exportLanguage, format: exportFormat });
                downloadWantlist(file);
                setNotice(`Download avviato: ${file.count} carte.${file.originalNames ? ` Per ${file.originalNames} carte è stato conservato il nome originale.` : ''}`);
            } catch (error) { setNotice(`Esportazione non riuscita: ${error.message}`); }
        });
    }

    window.__magicCleanup = () => { disposed = true; };
    render();
    if (navigator.onLine) void (async()=>{
        try {
            const user=await getMagicAccount(); cloudUserId=user?.id||null;
            if(!cloudUserId)return;
            const remote=await loadMagicLibrary(cloudUserId);
            if(disposed)return;
            if(remote.hasCloudData){cards=remote.cards||[];decks=remote.decks||[];wantlist=remote.wantlist||[];activeDeckId=decks[0]?.id||'';save(COLLECTION_KEY,cards);save(DECKS_KEY,decks);save(WANTLIST_KEY,wantlist);render();}
            else persist();
        }catch(error){ if(!disposed)setNotice(`Archivio sul dispositivo pronto. Sincronizzazione cloud non disponibile: ${error.message}`); }
    })();
}

function renderShare(container, share) {
    window.__magicCleanup?.();
    container.innerHTML='<main class="magic-page magic-viewer"><header class="mv-heading"><div><span class="mv-eyebrow">LA TAVERNA · CONDIVISIONE</span><h1>Carte Magic</h1><p>Carico le carte condivise…</p></div></header><section id="mv-shared" class="mv-panel"></section></main>';
    void loadPublicMagicShare(share).then(data=>{const root=container.querySelector('#mv-shared');if(!root)return;root.innerHTML=`<h2>${esc(data.name||'Collezione condivisa')}</h2><div class="mv-grid">${(data.cards||[]).map(card=>`<article class="mv-card"><span class="mv-art">${card.image?`<img src="${esc(card.image)}" alt="${esc(card.name)}">`:''}</span><strong>${esc(card.name)}</strong><small>×${card.quantity}</small></article>`).join('')}</div>`;}).catch(error=>{const root=container.querySelector('#mv-shared');if(root)root.textContent=error.message;});
}
