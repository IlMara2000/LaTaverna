import { renderHomeBackButton } from '../components/ui/BackButton.js';
import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { canPairCommanders, isCommanderEligible, validateCommanderDeck } from './magicCommander.js';
import { formatManabrewCommanderList } from './magicManabrew.js';
import { rememberDestination, navigateTo } from '../services/appNavigation.js';
import { enhanceSurfaceMotion } from '../services/motionSystem.js';
import { parseMagicCardList, scanMagicDocument } from '../services/magicDocumentScan.js';
import { MAGIC_DEMO_DECKS } from '../data/magicDemoDecks.js';
import { addManaProduction, canPayMana, emptyManaPool, isManaSource, isPermanentCard, manaPoolLabel, manaProductionOptions, payMana, resolveOracleText } from './magicRules.js';
import { getMagicAccount, listPublicMagicDecks, loadMagicLibrary, loadPublicMagicShare, saveMagicLibrary, setMagicCollectionPublic, setMagicDeckPublic } from '../services/magicLibrary.js';
import { createMinigameRoom, getMinigameClientId, getMinigameRoomByCode, getSavedMagicRoom, isMinigameRoomConnected, joinMagicRoom, updateMinigameRoomData, watchMinigameRoom } from '../services/minigameMultiplayer.js';
import './magic.css';

const COLLECTION_KEY = 'taverna_magic_collection_v1';
const DECKS_KEY = 'taverna_magic_decks_v1';
const COLLECTION_PUBLIC_KEY = 'taverna_magic_collection_public_v1';
const BOT_GAME_KEY = 'taverna_magic_bot_game_v1';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const MANA_SYMBOL_NAMES = { W: 'Bianco', U: 'Blu', B: 'Nero', R: 'Rosso', G: 'Verde', C: 'Incolore' };
const manaSymbolIcon = symbol => {
    const value = String(symbol || '').toUpperCase();
    const slug = value.replace(/[{}]/g, '').replaceAll('/', '');
    if (!/^[0-9WUBRGCXSTQPE]+$/.test(slug)) return esc(symbol);
    const accessibleName = MANA_SYMBOL_NAMES[slug] || (slug === 'X' ? 'Mana X' : `${slug} mana`);
    return `<img class="magic-mana-symbol" src="https://svgs.scryfall.io/card-symbols/${slug}.svg" alt="${esc(accessibleName)}" title="${esc(accessibleName)}" loading="lazy" decoding="async">`;
};
const manaCostIcons = cost => [...String(cost || '').matchAll(/\{([^}]+)\}/g)].map(match => manaSymbolIcon(match[0])).join('') || '<span class="magic-no-mana-cost">—</span>';
const manaPoolIcons = pool => ['W', 'U', 'B', 'R', 'G', 'C'].filter(color => Number(pool?.[color]) > 0).map(color => `<span class="magic-mana-count" title="${esc(MANA_SYMBOL_NAMES[color])}">${manaSymbolIcon(`{${color}}`)}<strong>${Number(pool[color])}</strong></span>`).join('') || '<span class="magic-pool-empty">vuota</span>';
const magicRulesText = text => String(text || '').split(/(\{[^}]+\})/g).map(part => /^\{[^}]+\}$/.test(part) ? manaSymbolIcon(part) : esc(part)).join('');
const read = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const playerId = getMinigameClientId;
const cardFace = card => card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal || '';
const manaValue = card => Number(card?.cmc || 0);
const colorName = card => (card?.colors || []).join('') || 'Incolore';
const MAGIC_PROXY_PRINTER = 'https://bastienpasdeloup.github.io/MtG-Proxy-Printer/';
let catalogQueue = Promise.resolve();
let nextCatalogRequestAt = 0;
const localizedOracleCache = new Map();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const prefersItalianCards = () => /^it(?:-|$)/i.test(navigator.language || navigator.languages?.[0] || '');

const fetchScryfallJson = (url, options = {}) => {
    const request = catalogQueue.then(async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
            const cooldown = Math.max(0, nextCatalogRequestAt - Date.now());
            if (cooldown) await pause(cooldown);
            nextCatalogRequestAt = Date.now() + 125;
            try {
                const response = await fetch(url, { ...options, headers: { Accept: 'application/json', ...options.headers } });
                const payload = await response.json().catch(() => ({}));
                if (response.status !== 429 && response.status !== 503) return { response, payload };
                if (attempt === 3) return { response, payload };
                const retryAfter = Number(response.headers.get('Retry-After')) * 1000;
                await pause(Math.max(retryAfter || 0, 1000 * (attempt + 1)));
            } catch (error) {
                if (attempt === 3) throw error;
                await pause(1000 * (attempt + 1));
            }
        }
        return { response: null, payload: {} };
    });
    catalogQueue = request.then(() => {}, () => {});
    return request;
};

const resolveScannedCard = async entry => {
    const candidates = [...new Set([entry.name, ...(entry.alternatives || [])].filter(Boolean))];
    for (const candidate of candidates) {
        const variants = [candidate, candidate.replace(/\bI(?=['’])/g, 'l').replace(/[’]/g, "'")];
        if (/^y(?=[a-z])/i.test(candidate)) variants.push(candidate.replace(/^y/i, 'V'));
        for (const name of new Set(variants)) {
            const { response, payload } = await fetchScryfallJson(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`);
            if (response?.ok) return { ...entry, card: payload };
            if (response && response.status !== 404) break;
        }
    }
    return { ...entry, card: null };
};

const normalizeCardName = value => String(value || '').normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/[’‘]/g, "'").trim().toLocaleLowerCase();
const resolveScannedCards = async (entries, onProgress = () => {}) => {
    const found = new Map();
    const unique = [...new Map(entries.map(entry => [normalizeCardName(entry.name), entry])).values()];
    for (let index = 0; index < unique.length; index += 75) {
        const batch = unique.slice(index, index + 75);
        onProgress(`Cerco ${Math.min(index + batch.length, unique.length)} nomi su ${unique.length} nel catalogo…`);
        const { response, payload } = await fetchScryfallJson('https://api.scryfall.com/cards/collection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifiers: batch.map(entry => ({ name: entry.name })) })
        });
        if (!response?.ok) throw new Error(payload.details || 'Catalogo Scryfall non disponibile.');
        for (const card of payload.data || []) found.set(normalizeCardName(card.name), card);
    }
    const unresolved = [];
    for (const entry of entries) {
        const card = found.get(normalizeCardName(entry.name));
        if (card) unresolved.push({ ...entry, card });
        else unresolved.push(await resolveScannedCard(entry).catch(() => ({ ...entry, card: null })));
    }
    return unresolved;
};

const italianPrintedText = async card => {
    if (card?.printedText && card.language === 'it') return card.printedText;
    const key = normalizeCardName(card?.name);
    if (!key) return '';
    if (!localizedOracleCache.has(key)) {
        const query = `!"${String(card.name).replace(/"/g, '\\"')}" lang:it`;
        localizedOracleCache.set(key, fetchScryfallJson(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=prints&order=released&dir=desc`)
            .then(({ response, payload }) => {
                if (!response?.ok) return '';
                const localized = (payload.data || []).find(print => print.lang === 'it' && (print.printed_text || print.card_faces?.some(face => face.printed_text)));
                return localized?.printed_text || localized?.card_faces?.map(face => face.printed_text).filter(Boolean).join('\n') || '';
            })
            .catch(() => ''));
    }
    return localizedOracleCache.get(key);
};

async function openMagicProxyPrinter(cards) {
    const list = cards.filter(card => card?.name).map(card => `${Math.max(1, Number(card.quantity) || 1)} ${card.name}`).join('\n');
    if (!list) return;
    window.open(MAGIC_PROXY_PRINTER, '_blank', 'noopener,noreferrer');
    try {
        await navigator.clipboard.writeText(list);
        const node = document.querySelector('#magic-notice');
        if (node) node.textContent = 'Lista copiata: incollala nello stampatore proxy appena aperto, poi scegli italiano per le carte.';
    } catch {
        const blob = new Blob([list], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = 'lista-magic-per-proxy.txt'; link.click(); URL.revokeObjectURL(url);
        const node = document.querySelector('#magic-notice');
        if (node) node.textContent = 'Ho scaricato la lista .txt: importala nello stampatore proxy appena aperto.';
    }
}

async function copyMagicShare(kind, id) {
    const url = new URL('/magic', location.origin);
    url.searchParams.set(kind === 'deck' ? 'magic-deck' : 'magic-collection', id);
    try {
        await navigator.clipboard.writeText(url.href);
        const node = document.querySelector('#magic-notice'); if (node) node.textContent = 'Link pubblico copiato negli appunti.';
    } catch {
        window.prompt('Copia questo link pubblico:', url.href);
    }
}

function showPublicMagicShare(container, share) {
    container.innerHTML = `<main class="magic-page magic-public-share"><div class="magic-back"><a class="magic-button magic-button-secondary" href="/magic">← Apri Magic</a></div><header class="magic-heading"><span class="crystal-eyebrow">LA TAVERNA · CONDIVISIONE PUBBLICA</span><h1>Carte Magic</h1><p>Sto caricando le carte condivise…</p></header><div id="magic-public-share-content" class="magic-public-share-content" aria-live="polite"></div></main>`;
    void loadPublicMagicShare(share).then(data => {
        const root = container.querySelector('#magic-public-share-content');
        if (!root) return;
        const title = data.type === 'deck' ? data.name : 'Collezione condivisa';
        const cards = data.cards || [];
        root.innerHTML = `<h2>${esc(title)}</h2><p>${cards.reduce((sum, card) => sum + card.quantity, 0)} carte · aggiornata dal proprietario</p><div class="magic-card-grid">${cards.map(card => `<article class="magic-owned-card"><div class="magic-owned-art">${card.image ? `<img src="${esc(card.image)}" alt="${esc(card.name)}" loading="lazy">` : '<span>✦</span>'}<span class="magic-quantity">×${card.quantity}</span></div><div class="magic-owned-info"><strong>${esc(card.name)}</strong><small>${esc(card.typeLine || '')}</small></div></article>`).join('') || '<p>Questa raccolta è vuota.</p>'}</div><button type="button" id="magic-public-proxy" class="magic-button">Stampa proxy</button>`;
        root.querySelector('#magic-public-proxy')?.addEventListener('click', () => openMagicProxyPrinter(cards));
        container.querySelector('.magic-heading p').textContent = data.type === 'deck' ? 'Mazzo Commander condiviso pubblicamente.' : 'Collezione Magic condivisa pubblicamente.';
        container.querySelector('.magic-heading h1').textContent = title;
    }).catch(error => {
        const root = container.querySelector('#magic-public-share-content');
        if (root) root.innerHTML = `<p class="magic-error">${esc(error.message || 'Condivisione non disponibile.')}</p>`;
    });
}

export function showMagicDashboard(container, options = {}) {
    const shareParams = new URLSearchParams(location.search);
    const sharedCollectionId = shareParams.get('magic-collection');
    const sharedDeckId = shareParams.get('magic-deck');
    if (sharedCollectionId || sharedDeckId) { showPublicMagicShare(container, { collectionId: sharedCollectionId, deckId: sharedDeckId }); return; }
    window.__magicCleanup?.();
    updateSidebarContext('magic');
    rememberDestination('magic', options);
    let collection = read(COLLECTION_KEY);
    let decks = read(DECKS_KEY);
    let collectionPublic = localStorage.getItem(COLLECTION_PUBLIC_KEY) === 'true';
    let collectionId = null;
    let cloudUserId = null;
    let cloudReady = false;
    let cloudDeckIds = new Set();
    let cloudSaveTimer = null;
    let cloudSaveQueue = Promise.resolve();
    let selectedDeck = decks[0]?.id || '';
    let publicBotDecks = [];
    let botDeckCatalogLoaded = false;
    let botDeckSelections = ['random'];
    let botCount = 1;
    let botTurnTimer = null;
    let botTurnScheduled = '';
    const publicBotDeckCache = new Map();
    let collectionFilter = '';
    const savedBotRoom = read(BOT_GAME_KEY);
    let room = savedBotRoom?.data?.magic?.botMatch ? savedBotRoom : ((getSavedMagicRoom()?.scope === 'magic' || getSavedMagicRoom()?.data?.scope === 'magic') ? getSavedMagicRoom() : null);
    let multiplayerBusy = false;
    let multiplayerHealthy = false;
    let disposed = false;
    let cardResults = [];
    let activeTab = options.tab || 'mazzi';
    let stopWatching = null;
    let pollTimer = null;
    let searchTimer = null;
    let cameraPhoto = '';
    let motionCleanup = null;
    let scannedCards = [];
    let scanInProgress = false;
    let cardHoldTimer = null;
    let cardHoldTriggered = false;
    let observedHandContext = '';
    let observedHandCount = null;
    let drawAnimationTimer = null;
    let manaPulseTimer = null;
    let pseudoFullscreen = false;
    let pseudoFullscreenScrollY = 0;
    let pseudoFullscreenAncestors = [];
    let previousPageOverflow = null;

    const cardSummary = card => ({ id: card.id, name: card.name, image: cardFace(card), manaCost: card.mana_cost || card.card_faces?.[0]?.mana_cost || '', typeLine: card.type_line || '', oracleText: card.oracle_text || card.card_faces?.map(face => face.oracle_text).join('\n') || '', printedText: card.printed_text || card.card_faces?.map(face => face.printed_text).filter(Boolean).join('\n') || '', language: card.lang || 'en', power: card.power ?? '', toughness: card.toughness ?? '', cmc: manaValue(card), colors: card.colors || [], colorIdentity: card.color_identity || [], producedMana: card.produced_mana || [], keywords: card.keywords || [], commanderLegality: card.legalities?.commander || 'unknown', set: card.set_name || '', rarity: card.rarity || '' });
    const renderBotSetup = () => {
        const playerDeckSelect = container.querySelector('#magic-bot-player-deck');
        const countSelect = container.querySelector('#magic-bot-count');
        const botSelects = container.querySelector('#magic-bot-deck-selectors');
        const start = container.querySelector('#magic-start-bot-game');
        if (!playerDeckSelect || !countSelect || !botSelects || !start) return;
        const previousPlayerDeck = playerDeckSelect.value || selectedDeck;
        playerDeckSelect.innerHTML = decks.length
            ? decks.map(deck => `<option value="${esc(deck.id)}">${esc(deck.name)} · ${deck.cards.reduce((sum, card) => sum + card.quantity, 0)} carte</option>`).join('')
            : '<option value="">Carica o crea un mazzo</option>';
        playerDeckSelect.value = decks.some(deck => deck.id === previousPlayerDeck) ? previousPlayerDeck : (decks[0]?.id || '');
        countSelect.value = String(botCount);
        const ownedOptions = decks.map(deck => `<option value="owned:${esc(deck.id)}">Tuo · ${esc(deck.name)}</option>`).join('');
        const publicOptions = publicBotDecks.map(deck => `<option value="public:${esc(deck.id)}">Pubblico · ${esc(deck.name)}</option>`).join('');
        while (botDeckSelections.length < botCount) botDeckSelections.push('random');
        botDeckSelections = botDeckSelections.slice(0, botCount);
        botSelects.innerHTML = Array.from({ length: botCount }, (_, index) => `<label>Bot ${index + 1}<select data-bot-deck="${index}" aria-label="Mazzo del bot ${index + 1}"><option value="random" ${botDeckSelections[index] === 'random' ? 'selected' : ''}>Casuale · mazzi pubblici</option><optgroup label="I tuoi mazzi">${ownedOptions}</optgroup><optgroup label="Mazzi pubblici">${publicOptions || '<option value="" disabled>Nessun mazzo pubblico caricato</option>'}</optgroup></select></label>`).join('');
        botSelects.querySelectorAll('[data-bot-deck]').forEach(select => { select.value = botDeckSelections[Number(select.dataset.botDeck)] || 'random'; });
        start.disabled = !decks.length;
        const loadButton = container.querySelector('#magic-load-public-bot-decks');
        if (loadButton) loadButton.textContent = botDeckCatalogLoaded ? `Mazzi pubblici · ${publicBotDecks.length}` : 'Carica i mazzi pubblici';
    };
    const persist = () => {
        write(COLLECTION_KEY, collection); write(DECKS_KEY, decks);
        localStorage.setItem(COLLECTION_PUBLIC_KEY, String(collectionPublic));
        if (!cloudUserId) return;
        clearTimeout(cloudSaveTimer);
        cloudSaveTimer = setTimeout(() => {
            const snapshot = { userId: cloudUserId, cards: structuredClone(collection), decks: structuredClone(decks) };
            cloudSaveQueue = cloudSaveQueue.catch(() => {}).then(() => saveMagicLibrary(snapshot)).then(result => {
                collectionId = result.collectionId;
                cloudDeckIds = new Set(snapshot.decks.map(deck => deck.id));
                const toggle = container.querySelector('#magic-collection-public'); if (toggle) toggle.disabled = !cloudUserId || !collectionId;
                renderDecks();
            }).catch(error => setNotice(`Non riesco a sincronizzare Magic ora: ${error.message}. La copia resta su questo dispositivo.`));
        }, 500);
    };
    const currentDeck = () => decks.find(deck => deck.id === selectedDeck) || null;
    const deckCards = deck => (deck?.cards || []).flatMap(entry => Array.from({ length: entry.quantity }, () => collection.find(card => card.id === entry.cardId)).filter(Boolean));
    const getCount = cardId => collection.find(card => card.id === cardId)?.quantity || 0;
    const setNotice = message => { const node = container.querySelector('#magic-notice'); if (node) node.textContent = message; };

    container.innerHTML = `<main class="magic-page">
      <div class="magic-back">${renderHomeBackButton({ id: 'magic-home' })}</div>
      <div class="magic-page-tools"><button type="button" id="magic-open-counter" class="magic-counter-link" title="Apri il segnapunti carte">♧ <span>Segnapunti</span></button></div>
      <header class="magic-heading"><span class="crystal-eyebrow">IL TAVOLO DEI PLANESWALKER</span><h1>Magic: The Gathering</h1><p>La tua collezione, i tuoi mazzi, la prossima sfida.</p></header>
      <nav class="magic-tabs" aria-label="Sezioni Magic">
       <button data-tab="collezione" type="button">Collezione</button><button data-tab="mazzi" type="button">Mazzi</button><button data-tab="partita" type="button">Partita online</button>
      </nav>
      <p id="magic-notice" class="magic-notice" role="status" aria-live="polite"></p>
      <section data-panel="collezione" class="magic-panel"><div class="magic-panel-heading"><div><span class="magic-overline">ARCHIVIO PERSONALE</span><h2>La tua bacheca</h2><p>Scansiona carte o liste da immagini e PDF, poi conferma le carte trovate nel catalogo.</p></div><span class="magic-count" id="magic-collection-count"></span></div>
       <div class="magic-scan-box"><div class="magic-scan-icon" aria-hidden="true">⌕</div><div class="magic-scan-copy"><strong>Importa carte o un mazzo</strong><span>Testo .txt: riconoscimento diretto senza Groq. Immagini e PDF: un file per volta, max 30 pagine.</span><span class="magic-mobile-hint">Da smartphone, tocca “SCEGLI FILE” per selezionare una foto o un PDF dal dispositivo.</span></div><label class="magic-button" for="magic-photo">SCEGLI FILE</label><input id="magic-photo" type="file" accept="image/*,.pdf,application/pdf,.txt,text/plain" hidden></div>
       <div class="magic-search-row"><label class="magic-search"><span aria-hidden="true">⌕</span><input id="magic-search" type="search" placeholder="Cerca una carta nel catalogo…" autocomplete="off"><span class="magic-search-hint">Catalogo Scryfall</span></label></div><div id="magic-photo-preview"></div><div id="magic-search-results" class="magic-search-results" aria-live="polite"></div>
       <div class="magic-collection-head"><h3>Carte possedute</h3><label class="magic-sharing-toggle"><input type="checkbox" id="magic-collection-public" ${collectionPublic ? 'checked' : ''} disabled><span>${collectionPublic ? 'Collezione pubblica' : 'Collezione privata'}</span></label><button type="button" id="magic-share-collection" class="magic-text-button" ${collectionPublic ? '' : 'hidden'}>Copia link</button><label class="magic-search magic-collection-search"><span aria-hidden="true">⌕</span><input id="magic-filter" type="search" placeholder="Filtra per nome…"></label></div><div id="magic-collection" class="magic-card-grid"></div>
      </section>
      <section data-panel="mazzi" class="magic-panel"><div class="magic-panel-heading"><div><span class="magic-overline">COSTRUISCI LA TUA STRATEGIA</span><h2>I tuoi mazzi</h2><p>Organizza le carte presenti nella tua bacheca e prepara il duello.</p></div><button id="magic-new-deck" class="magic-button" type="button">＋ Crea un mazzo</button></div><div class="magic-demo-pack"><img src="/images/magic-test-booster.webp" alt="Illustrazione originale della Bustina Prova La Taverna" loading="lazy"><div><span class="magic-overline">KIT DI PROVA · COMMANDER</span><strong>Pronto a giocare?</strong><p>Carica i quattro mazzi demo nella tua bacheca privata. Cerco i nomi tutti insieme, senza usare Groq.</p><button id="magic-load-demos" class="magic-button" type="button">Carica i 4 mazzi demo</button></div></div><div class="magic-deck-layout"><aside id="magic-deck-list" class="magic-deck-list"></aside><div id="magic-deck-editor" class="magic-deck-editor"></div></div></section>
      <section data-panel="partita" class="magic-panel"><div class="magic-panel-heading"><div><span class="magic-overline">GIOCA CON UN AMICO O CON L’OSTE</span><h2>Il tuo tavolo</h2><p>Apri una stanza online o prepara una partita di prova contro i bot.</p></div></div>
       <section class="magic-bot-setup" aria-labelledby="magic-bot-title"><div class="magic-bot-intro"><span class="magic-overline">PARTITA SOLITARIA · DIFFICOLTÀ MEDIA</span><h3 id="magic-bot-title">Sfida i bot della taverna</h3><p>Gioca contro 1 o 3 bot. Per ogni bot scegli un tuo mazzo, uno pubblico oppure lascia scegliere al caso tra i mazzi pubblici.</p></div><div class="magic-bot-controls"><label>Il tuo mazzo<select id="magic-bot-player-deck" aria-label="Scegli il tuo mazzo"></select></label><label>Avversari<select id="magic-bot-count" aria-label="Numero di bot"><option value="1">1 bot</option><option value="3">3 bot</option></select></label><button id="magic-load-public-bot-decks" type="button" class="magic-button magic-button-secondary">Carica i mazzi pubblici</button></div><div id="magic-bot-deck-selectors" class="magic-bot-deck-selectors"><p>Carica i mazzi pubblici per preparare la partita casuale.</p></div><button id="magic-start-bot-game" type="button" class="magic-button" ${decks.length?'':'disabled'}>Apparecchia il tavolo</button><p class="magic-bot-note">Partita locale: i turni dei bot usano mosse semplici e una valutazione tattica media; il motore di regole del prototipo resta parziale.</p></section>
       <div class="magic-room-bar"><button id="magic-host" type="button" class="magic-button">Crea una partita</button><form id="magic-join-form" class="magic-join-form"><select id="magic-join-deck" aria-label="Scegli il mazzo con cui giocare">${decks.map(deck => `<option value="${esc(deck.id)}">${esc(deck.name)}</option>`).join('')}</select><input id="magic-room-code" maxlength="6" autocomplete="off" placeholder="CODICE STANZA" aria-label="Codice stanza"><button class="magic-button magic-button-secondary" type="submit">Entra</button></form></div>
       <div id="magic-room-status" class="magic-room-status">${room?.code ? `Stanza ${esc(room.code)} · ${room.status === 'connected' ? 'Avversario connesso' : 'In attesa di un avversario'}` : 'Nessuna partita attiva'}</div><div id="magic-table"></div>
       <p class="magic-rules-note"><strong>Commander:</strong> partite da 2 a 4 giocatori, 40 punti vita e tassa di {2} per ogni precedente lancio dalla zona di comando. Il tavolo paga i costi di mana colorati, risolve una selezione di effetti Oracle comuni e avvisa quando una carta richiede intervento manuale; priorità, pila e combattimento completo sono ancora in sviluppo.</p>
      </section>
    </main>`;

    const render = () => {
        const joinDeck = container.querySelector('#magic-join-deck'); if (joinDeck) joinDeck.innerHTML = decks.map(deck => `<option value="${esc(deck.id)}">${esc(deck.name)}</option>`).join('');
        renderBotSetup();
        const collectionToggle = container.querySelector('#magic-collection-public');
        if (collectionToggle) { collectionToggle.checked = collectionPublic; collectionToggle.disabled = !cloudUserId || !collectionId; collectionToggle.nextElementSibling.textContent = collectionPublic ? 'Collezione pubblica' : 'Collezione privata'; }
        const collectionShare = container.querySelector('#magic-share-collection'); if (collectionShare) collectionShare.hidden = !collectionPublic || !collectionId;
        container.querySelectorAll('[data-tab]').forEach(button => { button.setAttribute('aria-selected', String(button.dataset.tab === activeTab)); });
        container.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== activeTab; });
        renderCollection(); renderDecks(); renderTable();
        const n = container.querySelector('#magic-collection-count'); if (n) n.textContent = `${collection.reduce((sum, card) => sum + card.quantity, 0)} carte`;
    };
    const renderCollection = () => {
        const root = container.querySelector('#magic-collection'); if (!root) return;
        const query = collectionFilter.trim().toLocaleLowerCase();
        const cards = collection.filter(card => card.name.toLocaleLowerCase().includes(query));
        root.innerHTML = cards.length ? cards.map(card => `<article class="magic-owned-card"><div class="magic-owned-art">${card.image ? `<img src="${esc(card.image)}" alt="${esc(card.name)}" loading="lazy">` : '<span>✦</span>'}<span class="magic-quantity">×${card.quantity}</span></div><div class="magic-owned-info"><strong>${esc(card.name)}</strong><small>${esc(card.typeLine)}</small><div class="magic-owned-actions"><button type="button" data-owned-action="remove" data-card="${esc(card.id)}" aria-label="Rimuovi una copia di ${esc(card.name)}">−</button><button type="button" data-owned-action="add" data-card="${esc(card.id)}" aria-label="Aggiungi una copia di ${esc(card.name)}">＋</button><button type="button" data-owned-action="deck" data-card="${esc(card.id)}">Al mazzo</button><button type="button" data-owned-action="delete" data-card="${esc(card.id)}">Rimuovi</button></div></div></article>`).join('') : `<div class="magic-empty"><span>✧</span><strong>${query ? 'Nessuna carta trovata' : 'La bacheca è ancora vuota'}</strong><p>${query ? 'Prova un altro nome.' : 'Scansiona la tua prima carta o cercala nel catalogo qui sopra.'}</p></div>`;
    };
    const renderResults = () => { const root = container.querySelector('#magic-search-results'); if (!root) return; root.innerHTML = cardResults.length ? `<div class="magic-results-label">Risultati · aggiungi alla bacheca</div>${cardResults.map(card => `<article class="magic-result-card">${cardFace(card) ? `<img src="${esc(cardFace(card))}" alt="${esc(card.name)}" loading="lazy">` : '<div class="magic-result-art">✧</div>'}<div><strong>${esc(card.name)}</strong><small>${esc(card.type_line || '')}</small><small>${esc(card.set_name || '')} · ${esc(card.mana_cost || '—')}</small></div><button type="button" class="magic-add-card" data-add-result="${esc(card.id)}">${getCount(card.id) ? `Aggiungi · ×${getCount(card.id)}` : '＋ Aggiungi'}</button></article>`).join('')}` : ''; };
    const renderDecks = () => {
        const list = container.querySelector('#magic-deck-list'), editor = container.querySelector('#magic-deck-editor'); if (!list || !editor) return;
        list.innerHTML = decks.length ? decks.map(deck => `<button type="button" data-select-deck="${esc(deck.id)}" aria-current="${deck.id === selectedDeck ? 'true' : 'false'}"><span>${esc(deck.name)}</span><small>${deck.cards.reduce((sum, card) => sum + card.quantity, 0)} carte</small></button>`).join('') : '<div class="magic-empty"><span>✧</span><strong>Nessun mazzo</strong><p>Crea un mazzo per iniziare.</p></div>';
        const deck = currentDeck(); if (!deck) { editor.innerHTML = '<div class="magic-empty magic-editor-empty"><span>♢</span><strong>Seleziona o crea un mazzo</strong><p>Il tuo prossimo mazzo comincia da qui.</p></div>'; return; }
        const cards = deckCards(deck); const total = cards.length;
        deck.commanders ||= [];
        const eligible = collection.filter(isCommanderEligible);
        const eligibleSecond = collection.filter(card => isCommanderEligible(card) || /legendary enchantment[^.]*background/i.test(card.typeLine || ''));
        const validation = validateCommanderDeck(cards, deck.commanders);
        editor.innerHTML = `<div class="magic-deck-title"><div><span class="magic-overline">COMMANDER · LISTA DEL MAZZO</span><h3>${esc(deck.name)}</h3></div><label class="magic-sharing-toggle"><input type="checkbox" id="magic-deck-public" ${deck.isPublic ? 'checked' : ''} ${!cloudReady || !cloudDeckIds.has(deck.id) ? 'disabled' : ''}><span>${deck.isPublic ? 'Mazzo pubblico' : 'Mazzo privato'}</span></label><button type="button" class="magic-text-button" id="magic-share-deck" ${deck.isPublic ? '' : 'hidden'}>Copia link</button><button type="button" class="magic-text-button" id="magic-proxy-deck">Stampa proxy</button><button type="button" class="magic-text-button" id="magic-rename-deck">Rinomina</button><button type="button" class="magic-text-button danger" id="magic-delete-deck">Elimina mazzo</button></div><div class="magic-commander-picks"><label>Comandante<select data-commander-slot="0"><option value="">Scegli dalla raccolta…</option>${eligible.map(card=>`<option value="${esc(card.id)}" ${deck.commanders[0]===card.id?'selected':''}>${esc(card.name)} · ${esc(card.colorIdentity.join('')||'Incolore')}</option>`).join('')}</select></label><label>Secondo comandante partner<select data-commander-slot="1"><option value="">Nessuno</option>${eligibleSecond.map(card=>`<option value="${esc(card.id)}" ${deck.commanders[1]===card.id?'selected':''}>${esc(card.name)} · ${esc(card.colorIdentity.join('')||'Incolore')}</option>`).join('')}</select></label></div><div class="magic-deck-stats"><strong>${total}</strong><span>/ 100 carte</span><span class="magic-deck-hint">Comandanti inclusi; una copia per nome, eccetto terre base.</span></div><div class="magic-deck-validation ${validation.valid?'is-valid':'is-invalid'}">${validation.valid?'✓ Mazzo Commander valido.':validation.errors.slice(0,4).map(esc).join('<br>')}</div><div class="magic-deck-cards">${deck.cards.length ? deck.cards.map(entry => { const card = collection.find(item => item.id === entry.cardId); return card ? `<div class="magic-deck-row">${card.image ? `<img src="${esc(card.image)}" alt="">` : ''}<span>${esc(card.name)}<small>${esc(card.typeLine)}${deck.commanders.includes(card.id)?' · COMANDANTE':''}</small></span><strong>×${entry.quantity}</strong><button type="button" data-deck-remove="${esc(entry.cardId)}" aria-label="Rimuovi una copia di ${esc(card.name)}">−</button><button type="button" data-deck-add="${esc(card.id)}" aria-label="Aggiungi una copia di ${esc(card.name)}">＋</button></div>` : ''; }).join('') : '<p class="magic-muted">Questo mazzo è vuoto. Aggiungi carte dalla raccolta.</p>'}</div><div class="magic-deck-play-actions"><button id="magic-play" type="button" class="magic-button magic-button-secondary" ${!validation.valid ? 'disabled' : ''}>Prova il prototipo locale</button><button id="magic-full-rules" type="button" class="magic-button" ${!validation.valid ? 'disabled' : ''}>Apri Manabrew/Forge ↗</button></div><p class="magic-muted">La lista Commander viene copiata negli appunti; incollala nell’importatore del mazzo.</p>`;
    };
    const game = () => room?.data?.magic?.game || null;
    const myTurn = state => state?.activePlayer === playerId() && !state?.winner && !state?.playersData?.[playerId()]?.eliminated;
    const advanceTurn = current => {
        const currentId = current.activePlayer, currentIndex = current.players.indexOf(currentId);
        if (currentIndex < 0) return current;
        let step = 1, nextId = current.players[(currentIndex + step) % current.players.length];
        while (current.playersData[nextId]?.eliminated && step < current.players.length) { step++; nextId = current.players[(currentIndex + step) % current.players.length]; }
        const active = current.playersData[currentId];
        if (active) { active.battlefield.forEach(card => { card.tapped = false; }); active.landsPlayed = 0; }
        current.activePlayer = nextId;
        if (nextId === current.startingPlayer) current.turn++;
        current.turnName = current.playerNames?.[nextId] || `Giocatore ${current.players.indexOf(nextId) + 1}`;
        if (active) {
            active.manaPool = emptyManaPool();
            for (const owner of Object.values(current.playersData)) for (const card of owner.battlefield || []) { delete card.damageMarked; delete card.turnBoost; }
        }
        const next = current.playersData[nextId];
        if (next) {
            next.battlefield.forEach(card => { card.tapped = false; card.summoningSick = false; });
            if (next.library?.length) next.hand.push(next.library.shift());
            else {
                next.eliminated = true;
                current.log.unshift(`${current.playerNames?.[nextId] || `Giocatore ${current.players.indexOf(nextId)+1}`} perde: non può pescare da un grimorio vuoto.`);
                const survivors = current.players.filter(id => !current.playersData[id]?.eliminated);
                if (survivors.length === 1) { current.winner = survivors[0]; return current; }
                return advanceTurn(current);
            }
        }
        current.log.unshift(`Inizia il turno di ${current.playerNames?.[nextId] || (nextId === playerId() ? 'te' : `Giocatore ${current.players.indexOf(nextId) + 1}`)}.`);
        return current;
    };
    const renderTable = () => {
        const root = container.querySelector('#magic-table');
        if (!root) return;
        if (!room?.code) {
            root.innerHTML = '';
            root.classList.remove('magic-table-root', 'magic-pseudo-fullscreen');
            observedHandContext = '';
            observedHandCount = null;
            return;
        }
        const state = game();
        const connected = isMinigameRoomConnected(room);
        if (!state) {
            root.classList.remove('magic-table-root');
            observedHandContext = '';
            observedHandCount = null;
            const players = [...new Set([room.hostClientId, room.guestClientId, ...(room.data?.magic?.participants || [])].filter(Boolean))];
            const loadouts = room.data?.magic?.loadouts || {};
            const ready = players.length >= 2 && players.every(id => loadouts[id]?.cards && validateCommanderDeck(loadouts[id].cards, loadouts[id].commanders || []).valid);
            root.innerHTML = `<div class="magic-table-wait"><div class="magic-table-sigil">✧</div><div><strong>${players.length}/4 giocatori · ${connected ? 'Tavolo aperto' : 'In attesa del secondo giocatore'}</strong><p>${players.map((id, index) => `${index === 0 ? 'Oste' : `Giocatore ${index + 1}`}${loadouts[id]?.cards ? ' · mazzo Commander pronto' : ' · deve confermare un mazzo legale'}`).join('<br>')}<br>${players.length < 4 ? 'La stanza resta aperta fino a 4 giocatori.' : 'Tavolo al completo.'}</p></div>${players.includes(playerId()) && !loadouts[playerId()] ? `<select id="magic-start-deck" aria-label="Scegli il mazzo">${decks.map(deck => `<option value="${esc(deck.id)}" ${selectedDeck === deck.id ? 'selected' : ''}>${esc(deck.name)} · ${deck.cards.reduce((n, c) => n + c.quantity, 0)} carte</option>`).join('')}</select><button id="magic-ready" class="magic-button" type="button" ${decks.length === 0 ? 'disabled' : ''}>Conferma mazzo</button>` : ''}${room.hostClientId === playerId() && players.length >= 2 ? `<button id="magic-start" class="magic-button" type="button" ${!ready ? 'disabled' : ''}>${ready ? 'Inizia partita' : 'In attesa dei mazzi legali'}</button>` : ''}</div>`;
            return;
        }

        root.classList.add('magic-table-root');
        const myId = playerId();
        const opponentIds = state.players.filter(id => id !== myId && !state.playersData[id]?.eliminated);
        const ownState = state.playersData?.[myId] || { hand: [], battlefield: [], graveyard: [], library: [] };
        const isMyTurn = myTurn(state);
        const mulliganActive = Boolean(state.mulliganActive);
        const needsOpeningChoice = mulliganActive && !ownState.keptOpeningHand;
        const mulliganBottomCount = Math.min(ownState.hand.length, Math.max(0, ownState.cardsToBottom ?? Math.max(0, (ownState.mulligans || 0) - 1)));
        const selectedBottomCards = new Set(ownState.mulliganBottom || []);
        const commanders = ownState.commandZone || [];
        const drawContext = `${room.code}:${myId}`;
        let drawnCount = 0;
        if (drawContext !== observedHandContext) {
            observedHandContext = drawContext;
            observedHandCount = ownState.hand.length;
        } else if (observedHandCount !== null && ownState.hand.length > observedHandCount) {
            drawnCount = ownState.hand.length - observedHandCount;
            observedHandCount = ownState.hand.length;
        } else observedHandCount = ownState.hand.length;

        const drawPile = (cards, mine = false) => `<div class="magic-pile ${mine ? 'magic-own-pile' : ''}"><div class="magic-card-back" aria-hidden="true">✧</div><span><strong>${cards.length}</strong> nel grimorio</span></div>`;
        const renderBattlefield = (cards, mine, originalCards = cards) => cards.length ? cards.map(card => {
            const index = originalCards.indexOf(card);
            const sickManaCreature = card.summoningSick && /creature/i.test(card.typeLine || '');
            const manaSource = mine && isManaSource(card, ownState.colorIdentity) && !sickManaCreature;
            const power = (Number.parseInt(card.power, 10) || 0) + (card.counters?.plusOne || 0) + (card.turnBoost?.power || 0);
            const toughness = (Number.parseInt(card.toughness, 10) || 0) + (card.counters?.plusOne || 0) + (card.turnBoost?.toughness || 0);
            return `<button type="button" class="magic-board-card ${card.tapped ? 'is-tapped' : ''}" data-board-action="${manaSource ? 'mana' : 'none'}" data-card-inspect="board:${mine ? myId : opponentIds.find(id => state.playersData[id]?.battlefield === cards)}:${index}" data-board-index="${index}" aria-label="${esc(card.name)} · ${esc(card.typeLine)}${card.tapped ? ' · tappata' : ''}" title="Tieni premuto per leggere ${esc(card.name)}">${card.image ? `<img src="${esc(card.image)}" alt="Carta ${esc(card.name)}" loading="lazy">` : `<span class="magic-board-fallback">${esc(card.name)}</span>`}<span class="magic-board-card-copy"><strong class="magic-board-name">${esc(card.name)}</strong><small>${manaCostIcons(card.manaCost)}</small></span>${card.power !== '' ? `<b>${power}/${toughness}</b>` : ''}${manaSource && !card.tapped ? `<i class="magic-mana-hint">TAPPA · ${manaProductionOptions(card, ownState.colorIdentity).map(option => option.map(color => manaSymbolIcon(`{${color}}`)).join('')).join('<span class="magic-mana-or">o</span>')}</i>` : ''}${card.tapped ? '<i>TAPPATA</i>' : ''}</button>`;
        }).join('') : '<span class="magic-empty-board">Il legno attende le carte…</span>';
        const battlefieldMarkup = (cards, mine, ownerId) => {
            const categories = [
                ['creature', 'CREATURE', /\bcreature\b/i], ['planeswalker', 'PLANESWALKER', /\bplaneswalker\b/i],
                ['enchantment', 'INCANTESIMI', /\benchantment\b/i], ['artifact', 'ARTEFATTI', /\bartifact\b/i],
                ['land', 'TERRE', /\bland\b/i], ['battle', 'BATTAGLIE', /\bbattle\b/i]
            ];
            const categorized = new Set();
            const groups = categories.map(([key, label, test]) => ({ key, label, cards: cards.filter(card => {
                if (categorized.has(card) || !test.test(card.typeLine || '')) return false;
                categorized.add(card);
                return true;
            }) })).filter(group => group.cards.length);
            const other = cards.filter(card => !categorized.has(card));
            if (other.length) groups.push({ key: 'other', label: 'ALTRI PERMANENTI', cards: other });
            return groups.length ? groups.map(group => `<section class="magic-board-group magic-board-group-${group.key}"><h3><span>${group.label}</span><small>${group.cards.length}</small></h3><div class="magic-board-cards">${renderBattlefield(group.cards, mine, cards)}</div></section>`).join('') : renderBattlefield([], mine, cards);
        };
        const playersInGame = state.players.filter(id => !state.playersData[id]?.eliminated);
        const effectTargets = playersInGame.flatMap(id => [
            `<option value="player:${esc(id)}">${esc(state.playerNames?.[id] || `Giocatore ${state.players.indexOf(id) + 1}`)}</option>`,
            ...(state.playersData[id]?.battlefield || []).map(card => `<option value="card:${esc(id)}:${esc(card.id)}">${esc(card.name)}</option>`)
        ]).join('');
        const attackTargets = opponentIds.map(id => `<option value="${esc(id)}">${esc(state.playerNames?.[id] || `Giocatore ${state.players.indexOf(id) + 1}`)}</option>`).join('');
        const fullscreenActive = document.fullscreenElement === root || pseudoFullscreen;
        root.innerHTML = `
            <section class="magic-match-screen" aria-label="Partita Commander">
                <header class="magic-match-hud">
                    <div class="magic-match-heading"><span class="magic-match-emblem" aria-hidden="true">✦</span><div><span class="magic-overline">COMMANDER · ${state.players.length} GIOCATORI · ${esc(room.code)}</span><strong>${state.winner ? `Vince ${esc(state.playerNames?.[state.winner] || `Giocatore ${state.players.indexOf(state.winner) + 1}`)}` : `Turno ${state.turn} · ${esc(state.turnName || 'Taverna')}`}</strong><small>${state.winner ? 'Partita conclusa' : (isMyTurn ? 'Il tuo turno' : `Turno di ${esc(state.playerNames?.[state.activePlayer] || `Giocatore ${state.players.indexOf(state.activePlayer) + 1}`)}`)}</small></div></div>
                    <div class="magic-match-tools"><button type="button" id="magic-fullscreen" aria-pressed="${fullscreenActive}" title="Schermo intero">⛶ <span>${fullscreenActive ? 'Esci' : 'Schermo intero'}</span></button><button type="button" id="magic-concede" title="Abbandona la partita">Lascia il tavolo</button></div>
                </header>
                ${mulliganActive ? `<section class="magic-opening-mulligan" aria-live="polite"><span class="magic-overline">MULLIGAN · COMMANDER</span>${needsOpeningChoice ? `<strong>${ownState.mulligans ? `Hai pescato 7 carte${mulliganBottomCount ? ` · ${mulliganBottomCount} ${mulliganBottomCount === 1 ? 'carta' : 'carte'} da mettere in fondo` : ' · nessuna carta da rimettere'}` : 'Controlla la tua mano iniziale'}</strong><p>${ownState.mulligans ? (mulliganBottomCount ? `Seleziona ${mulliganBottomCount} ${mulliganBottomCount === 1 ? 'carta' : 'carte'} da mettere in fondo al grimorio, poi tieni la mano.` : 'Il primo mulligan è gratuito: puoi tenere queste sette carte oppure rimescolarle ancora.') : 'Puoi tenere queste sette carte oppure rimescolarle e pescarne sette. Il primo mulligan è gratuito; dal secondo rimescolamento dovrai mettere in fondo una carta per ogni mulligan successivo.'}</p><div class="magic-mulligan-actions"><button type="button" class="magic-button" data-mulligan-action="redraw">${ownState.mulligans ? 'Rimescola e pesca di nuovo' : 'Mulligan gratuito'}</button><button type="button" class="magic-button magic-button-secondary" data-mulligan-action="keep" ${selectedBottomCards.size !== mulliganBottomCount ? 'disabled' : ''}>${mulliganBottomCount ? `Conferma · fondo ${mulliganBottomCount}` : 'Tieni questa mano'}</button></div>` : '<strong>In attesa degli altri giocatori…</strong><p>La partita inizierà quando tutti avranno tenuto la propria mano.</p>'}</section>` : ''}
                <div class="magic-life-row" aria-label="Punti vita">
                    <div class="magic-life magic-life-self"><span>Tu</span><strong>${ownState.life ?? 40}</strong><button type="button" data-life="-1" aria-label="Togli un punto vita" ${!isMyTurn ? 'disabled' : ''}>−</button><button type="button" data-life="1" aria-label="Aggiungi un punto vita" ${!isMyTurn ? 'disabled' : ''}>＋</button></div>
                    ${opponentIds.map(id => `<div class="magic-life-opponent"><span>${esc(state.playerNames?.[id] || `Giocatore ${state.players.indexOf(id) + 1}`)}</span><strong>${state.playersData[id]?.life ?? 40}</strong><small>${state.playersData[id]?.hand?.length ?? 0} carte · comandante ${Math.max(0, ...Object.values(ownState.commanderDamage?.[id] || {}))}/21</small></div>`).join('')}
                </div>
                <div class="magic-mana-dock" id="magic-mana-dock">
                    <div class="magic-mana-reserve"><span>Riserva</span><div>${manaPoolIcons(ownState.manaPool)}</div><button type="button" id="magic-clear-mana" title="Svuota la riserva" ${!isMyTurn || !Object.values(ownState.manaPool || {}).some(Number) ? 'disabled' : ''}>Svuota</button></div>
                    <div class="magic-mana-choice" role="group" aria-label="Colore prodotto dalle terre"><span>Produci mana</span><button type="button" data-mana-choice="auto" aria-pressed="${!ownState.manaChoice || ownState.manaChoice === 'auto'}" ${!isMyTurn ? 'disabled' : ''}><span aria-hidden="true">✦</span><small>Auto</small></button>${['W', 'U', 'B', 'R', 'G', 'C'].map(color => `<button type="button" data-mana-choice="${color}" aria-label="${MANA_SYMBOL_NAMES[color]}" aria-pressed="${ownState.manaChoice === color}" ${!isMyTurn ? 'disabled' : ''}>${manaSymbolIcon(`{${color}}`)}</button>`).join('')}</div>
                </div>
                <div class="magic-battlefield">
                    <div class="magic-opponents-row">${opponentIds.map(id => { const foe = state.playersData[id] || {}; return `<div class="magic-opponent-zone"><div class="magic-zone-label"><span>CAMPO · ${esc(state.playerNames?.[id] || `Giocatore ${state.players.indexOf(id) + 1}`)}</span>${drawPile(foe.library || [])}</div>${battlefieldMarkup(foe.battlefield || [], false, id)}</div>`; }).join('')}</div>
                    <div class="magic-own-zone"><div class="magic-zone-label"><span>IL TUO CAMPO</span>${drawPile(ownState.library || [], true)}</div>${battlefieldMarkup(ownState.battlefield || [], true, myId)}</div>
                </div>
                ${commanders.length ? `<details class="magic-command-zone"><summary><span>ZONA COMANDANTE</span><small>${commanders.map(card => esc(card.name)).join(' · ')}</small></summary><div class="magic-commanders">${commanders.map((card, index) => { const casts = ownState.commanderCasts?.[card.id] || 0; const tax = casts * 2; return `<article class="magic-commander-card" data-card-inspect="command:${index}">${card.image ? `<img src="${esc(card.image)}" alt="Carta ${esc(card.name)}">` : ''}<span><strong>${esc(card.name)}</strong><small>${casts} lanci dalla zona di comando</small></span><div class="magic-commander-cost">${manaCostIcons(card.manaCost)}${tax ? `<span class="magic-tax-cost">+ ${manaCostIcons(`{${tax}}`)}</span>` : ''}</div><button type="button" data-cast-commander="${esc(card.id)}" ${!isMyTurn || state.winner || !canPayMana(ownState.manaPool, card.manaCost || '', 0, tax) ? 'disabled' : ''}>Lancia</button></article>`; }).join('')}</div></details>` : ''}
                <div class="magic-action-dock">
                    <label class="magic-action-target"><span>BERSAGLIO</span><select id="magic-effect-target" aria-label="Scegli il bersaglio delle magie"><option value="">Scegli bersaglio…</option>${effectTargets}</select></label>
                    <label class="magic-action-opponent"><span>ATTACCA</span><select id="magic-attack-target" aria-label="Scegli il giocatore da attaccare" ${!isMyTurn || state.winner ? 'disabled' : ''}>${attackTargets}</select></label>
                    <button type="button" class="magic-button magic-attack-button" id="magic-attack" ${!isMyTurn || state.winner ? 'disabled' : ''}>⚔ <span>Attacca</span></button>
                    <button type="button" class="magic-button magic-end-turn" id="magic-end-turn" ${!isMyTurn || state.winner ? 'disabled' : ''}>Fine turno <span aria-hidden="true">→</span></button>
                </div>
                <details class="magic-game-log"><summary>Diario della partita</summary><ol>${(state.log || []).slice(0, 6).map(line => `<li>${magicRulesText(line)}</li>`).join('') || '<li>La partita è pronta.</li>'}</ol></details>
                <div class="magic-hand-heading"><span>LA TUA MANO</span><small>${ownState.hand.length} carte · tieni premuto per leggere</small></div>
                <div class="magic-hand">${(ownState.hand || []).map((card, index) => { const drawn = drawnCount && index >= ownState.hand.length - drawnCount; const land = /\bland\b/i.test(card.typeLine || ''); const hasMana = canPayMana(ownState.manaPool, card.manaCost || '', 0); const blockedReason = !isMyTurn ? 'Puoi lanciare carte solo durante il tuo turno.' : (land && ownState.landsPlayed >= 1 ? 'Hai già giocato una terra in questo turno.' : (!land && !hasMana ? `Mana insufficiente o colori errati. Costo ${card.manaCost || '0'}; riserva: ${manaPoolLabel(ownState.manaPool)}.` : '')); return `<article class="magic-hand-card ${drawn ? 'is-drawn' : ''} ${selectedBottomCards.has(index) ? 'is-mulligan-selected' : ''}" data-card-inspect="hand:${index}" style="--card-index:${index}">${card.image ? `<img src="${esc(card.image)}" alt="Carta ${esc(card.name)}" loading="lazy">` : ''}<div class="magic-hand-overlay"><strong>${esc(card.name)}</strong><small class="magic-hand-card-cost">${manaCostIcons(card.manaCost)}<span>${esc(card.typeLine)}</span></small>${needsOpeningChoice ? `<button type="button" data-mulligan-index="${index}" ${!mulliganBottomCount ? 'disabled' : ''}>${selectedBottomCards.has(index) ? '✓ In fondo' : 'Seleziona per il fondo'}</button>` : `<button type="button" data-play-card="${index}" title="${esc(blockedReason)}" ${mulliganActive || !isMyTurn || state.winner || (land && ownState.landsPlayed >= 1) || (!land && !hasMana) ? 'disabled' : ''}>${land ? 'Gioca terra' : `Lancia · ${manaCostIcons(card.manaCost || '{0}')}`}</button>`}</div></article>`; }).join('') || '<p class="magic-muted">Nessuna carta in mano.</p>'}</div>
                <details class="magic-phase-help"><summary>Regole e azioni della partita</summary><p>Il tavolo paga i costi colorati e applica la tassa Commander. Gli effetti non riconosciuti sono indicati nel diario; pila, priorità, blocchi e abilità avanzate restano da automatizzare.</p></details>
            </section>`;
        root.insertAdjacentHTML('beforeend', `<div class="magic-card-inspector" id="magic-card-inspector" hidden><section role="dialog" aria-modal="true" aria-labelledby="magic-inspector-title"><button type="button" class="magic-inspector-close" data-close-card aria-label="Chiudi dettagli carta">×</button><div id="magic-inspector-content"></div></section></div>`);
        if (drawnCount) {
            const drawnCard = ownState.hand[ownState.hand.length - 1];
            root.insertAdjacentHTML('beforeend', `<div class="magic-draw-toast" role="status" aria-live="polite"><span>HAI PESCATO</span>${drawnCard?.image ? `<img src="${esc(drawnCard.image)}" alt="Carta ${esc(drawnCard.name)}">` : '<span class="magic-draw-placeholder">✦</span>'}<strong>${esc(drawnCard?.name || `${drawnCount} carte`)}</strong></div>`);
            clearTimeout(drawAnimationTimer);
            drawAnimationTimer = setTimeout(() => {
                root.querySelector('.magic-draw-toast')?.remove();
                root.querySelectorAll('.magic-hand-card.is-drawn').forEach(card => card.classList.remove('is-drawn'));
            }, 1500);
        }
        scheduleBotTurn(state);
    };
    const showManaPulse = (colors, sourceName) => {
        const dock = container.querySelector('#magic-mana-dock');
        if (!dock || !colors?.length) return;
        dock.querySelector('.magic-mana-pulse')?.remove();
        const pulse = document.createElement('div');
        pulse.className = 'magic-mana-pulse';
        pulse.setAttribute('role', 'status');
        pulse.setAttribute('aria-live', 'polite');
        pulse.innerHTML = `<span>+ MANA</span><strong>${colors.map(color => manaSymbolIcon(`{${color}}`)).join('')}</strong><small>${esc(sourceName)}</small>`;
        dock.append(pulse);
        clearTimeout(manaPulseTimer);
        manaPulseTimer = setTimeout(() => pulse.remove(), 1900);
    };
    const humansPresent = current => current?.players?.filter(id => !current.playersData[id]?.eliminated)
        .every(id => Date.now() - (room?.data?.magic?.presence?.[id] || 0) < 35000);
    const saveState = async (updater, allowAnyTurn = false) => {
        if (!room?.code || multiplayerBusy || disposed) return false;
        if (room.data?.magic?.botMatch) {
            const next = updater(structuredClone(game()));
            if (!next) return false;
            room = { ...room, data: { ...room.data, magic: { ...room.data.magic, game: next } } };
            try { localStorage.setItem(BOT_GAME_KEY, JSON.stringify(room)); } catch { setNotice('La partita non può essere salvata su questo dispositivo.'); }
            render(); return true;
        }
        if (!multiplayerHealthy || (!allowAnyTurn && !humansPresent(game()))) { setNotice('In attesa dei giocatori online. La partita resta ferma, senza bot.'); return false; }
        const code = room.code, expected = game();
        multiplayerBusy = true;
        try {
            const result = await updateMinigameRoomData(code, data => {
                const current = data.magic?.game;
                if (!current || current.winner || !current.players.includes(playerId()) || current.playersData[playerId()]?.eliminated) throw new Error('Partita non disponibile.');
                if (!allowAnyTurn && !current.mulliganActive && (current.activePlayer !== playerId() || current.turn !== expected.turn || current.revision !== expected.revision)) throw new Error('La partita è cambiata: attendi il tuo turno.');
                if (!allowAnyTurn && current.players.filter(id => !current.playersData[id]?.eliminated).some(id => Date.now() - (data.magic.presence?.[id] || 0) >= 35000)) throw new Error('Un giocatore è disconnesso. In attesa di riconnessione.');
                const next = updater(structuredClone(current));
                if (!next) throw new Error('Mossa non valida.');
                next.revision = (current.revision || 0) + 1;
                return { ...data, magic: { ...data.magic, game: next } };
            });
            if (disposed || room?.code !== code) return false;
            if (result.error) { if (result.room) refreshRoom(result.room); setNotice(result.error.message); return false; }
            refreshRoom(result.room); return true;
        } catch { multiplayerHealthy = false; setNotice('Connessione interrotta. Riprova dopo la riconnessione.'); return false; }
        finally { multiplayerBusy = false; }
    };
    const searchCards = async query => {
        if (!query.trim()) { cardResults = []; renderResults(); return; }
        const root = container.querySelector('#magic-search-results'); if (root) root.innerHTML = '<div class="magic-search-loading">Cerco nel catalogo delle carte…</div>';
        try {
            const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=name`, { headers: { Accept: 'application/json' } });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.details || 'Ricerca non disponibile.');
            cardResults = payload.data.slice(0, 12); renderResults();
        } catch (error) { if (root) root.innerHTML = `<p class="magic-error">${esc(error.message)}</p>`; }
    };
    const addCollectionCard = (card, quantity = 1) => {
        const existing = collection.find(item => item.id === card.id);
        if (existing) existing.quantity += quantity; else collection.unshift({ ...cardSummary(card), quantity });
        persist(); render(); renderResults(); setNotice(`${card.name} aggiunta alla bacheca.`);
    };
    const createGame = async () => {
        if (multiplayerBusy || !room || room.hostClientId !== playerId()) return;
        multiplayerBusy = true;
        try {
            const result = await updateMinigameRoomData(room.code, (data, currentRoom) => {
                if (data.magic?.game) throw new Error('La partita è già iniziata.');
                const hostId = currentRoom.hostClientId;
        const players = [...new Set([currentRoom.hostClientId, currentRoom.guestClientId, ...(data.magic?.participants || [])].filter(Boolean))];
        if (players.length < 2 || players.length > 4) throw new Error('Per avviare la partita servono da 2 a 4 giocatori.');
        const loadouts = data.magic?.loadouts || {};
        const playersData = {};
        for (const id of players) { const loadout=loadouts[id]; if (!loadout?.cards || !validateCommanderDeck(loadout.cards,loadout.commanders||[]).valid) throw new Error('Ogni giocatore deve confermare un mazzo Commander legale da 100 carte.'); const commanders=(loadout.commanders||[]).map(commanderId=>loadout.cards.find(card=>card.id===commanderId));const cards=loadout.cards.filter(card=>!loadout.commanders.includes(card.id));for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];} playersData[id]={hand:cards.splice(0,7),library:cards,battlefield:[],graveyard:[],exile:[],commandZone:commanders,commanderCasts:{},commanderDamage:{},manaPool:emptyManaPool(),colorIdentity:[...new Set(commanders.flatMap(card=>card.colorIdentity||[]))],life:40,landsPlayed:0,mulligans:0,freeMulliganUsed:false,cardsToBottom:0,keptOpeningHand:false,mulliganBottom:[]}; }
        const state = { version: 2, revision: 0, turn: 1, activePlayer: hostId, startingPlayer: hostId, players, playersData, mulliganActive: true, log: [`Partita iniziata con ${players.length} giocatori · primo mulligan gratuito`], turnName: 'Mulligan iniziale' };
                return { ...data, magic: { ...data.magic, game: state } };
            });
            if (result.error) { setNotice(result.error.message); return; }
            refreshRoom(result.room);
        } catch { setNotice('Avvio non riuscito. Verifica la connessione e riprova.'); }
        finally { multiplayerBusy = false; }
    };
    const openingMulliganAction = (current, action, selectedIndex = -1) => {
        if (!current?.mulliganActive) return current;
        const own = current.playersData?.[playerId()];
        if (!own || own.keptOpeningHand) return current;
        if (action === 'select') {
            const required = Math.min(own.hand.length, Math.max(0, own.cardsToBottom ?? Math.max(0, (own.mulligans || 0) - 1)));
            if (!required) return current;
            const selected = new Set(own.mulliganBottom || []);
            if (selected.has(selectedIndex)) selected.delete(selectedIndex);
            else if (selected.size < required) selected.add(selectedIndex);
            else { setNotice(`Con la regola di Londra devi mettere in fondo esattamente ${required} carte.`); return current; }
            own.mulliganBottom = [...selected].sort((a, b) => a - b);
            return current;
        }
        if (action === 'redraw') {
            own.library.push(...own.hand);
            for (let i = own.library.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [own.library[i], own.library[j]] = [own.library[j], own.library[i]];
            }
            own.hand = own.library.splice(0, 7);
            own.freeMulliganUsed ??= (own.mulligans || 0) > 0;
            own.mulligans = (own.mulligans || 0) + 1;
            own.cardsToBottom = own.freeMulliganUsed ? own.mulligans - 1 : 0;
            own.freeMulliganUsed = true;
            own.mulliganBottom = [];
            current.log.unshift(`${current.playerNames?.[playerId()] || 'Un giocatore'} rimescola la mano e fa mulligan (${own.mulligans}).`);
            return current;
        }
        if (action === 'keep') {
            const required = Math.min(own.hand.length, Math.max(0, own.cardsToBottom ?? Math.max(0, (own.mulligans || 0) - 1)));
            const indexes = [...new Set(own.mulliganBottom || [])].sort((a, b) => b - a);
            if (indexes.length !== required) {
                setNotice(`Seleziona esattamente ${required} ${required === 1 ? 'carta' : 'carte'} da mettere in fondo al grimorio.`);
                return current;
            }
            const bottom = indexes.map(index => own.hand.splice(index, 1)[0]).filter(Boolean);
            own.library.push(...bottom);
            own.mulliganBottom = [];
            own.keptOpeningHand = true;
            current.log.unshift(`${current.playerNames?.[playerId()] || 'Un giocatore'} tiene una mano da ${own.hand.length} carte.`);
            if (current.players.every(id => current.playersData[id]?.keptOpeningHand)) {
                current.mulliganActive = false;
                current.turnName = current.playerNames?.[current.activePlayer] || 'Fase principale';
                current.log.unshift('Tutti hanno tenuto la mano iniziale. La partita comincia.');
            }
        }
        return current;
    };
    const resolvePlayedCard = (state, ownerId, card, target = '', xValue = 0, fromCommandZone = false) => {
        const owner = state.playersData[ownerId];
        if (!owner) return false;
        if (isPermanentCard(card)) {
            card.tapped = /enters(?: the battlefield)? tapped(?:[.;,]|$)/i.test(card.oracleText || '');
            card.summoningSick = /creature/i.test(card.typeLine || '') && !((card.keywords || []).some(keyword => String(keyword).toLowerCase() === 'haste') || /\bhaste\b/i.test(card.oracleText || ''));
            card.damageMarked = 0;
            card.turnBoost = { power: 0, toughness: 0 };
            owner.battlefield.push(card);
            const entryEffects = resolveOracleText(card, state, ownerId, target, xValue, true);
            state.log.unshift(...entryEffects.log);
            if (fromCommandZone) state.log.unshift(`${card.name} entra sul campo dalla zona di comando.`);
        } else {
            const effects = resolveOracleText(card, state, ownerId, target, xValue, false);
            owner.graveyard.push(card);
            state.log.unshift(...effects.log);
            if (!effects.resolvedCount && !effects.log.length) state.log.unshift(`${card.name}: magia risolta; controlla il testo Oracle per le istruzioni non automatizzate.`);
        }
        const survivors = state.players.filter(id => !state.playersData[id]?.eliminated);
        if (survivors.length === 1) state.winner = survivors[0];
        return true;
    };
    const runBotTurn = async (botId, turnToken) => {
        const current = game();
        if (!room?.data?.magic?.botMatch || current?.activePlayer !== botId || `${current.turn}:${current.activePlayer}` !== turnToken || current.winner) return;
        await saveState(state => {
            if (state.activePlayer !== botId || state.winner) return state;
            const bot = state.playersData[botId], botName = state.playerNames?.[botId] || 'Oste';
            const isLand = card => (card.typeLine || '').toLowerCase().includes('land');
            const landIndex = bot.hand.findIndex(isLand);
            if (landIndex >= 0 && bot.landsPlayed < 1) {
                const land = bot.hand.splice(landIndex, 1)[0];
                const tapped = /enters the battlefield tapped|enters tapped/i.test(land.oracleText || '');
                bot.battlefield.push({ ...land, tapped }); bot.landsPlayed++;
                state.log.unshift(`${botName} gioca ${land.name}.`);
            }
            bot.manaPool ||= emptyManaPool();
            const sourceCount = bot.battlefield.filter(card => !card.tapped && isManaSource(card, bot.colorIdentity)).length;
            const currentPool = Object.values(bot.manaPool).reduce((sum, count) => sum + (Number(count) || 0), 0);
            const spells = bot.hand.map((card, index) => ({ card, index, cost: Number(card.cmc) || 0 }))
                .filter(entry => !isLand(entry.card) && entry.cost <= sourceCount + currentPool)
                .sort((a, b) => {
                    const score = ({ card, cost }) => ((Number.parseInt(card.power, 10) || 0) + (Number.parseInt(card.toughness, 10) || 0)) * 0.65 + ((card.typeLine || '').toLowerCase().includes('creature') ? 3 : 0) - cost * 0.35;
                    return score(b) - score(a);
                });
            const chosen = spells.find(entry => {
                let pool = structuredClone(bot.manaPool);
                const sources = bot.battlefield.filter(card => !card.tapped && isManaSource(card, bot.colorIdentity));
                for (const source of sources) {
                    if (canPayMana(pool, entry.card.manaCost || '')) break;
                    const options = manaProductionOptions(source, bot.colorIdentity);
                    const needed = [...String(entry.card.manaCost || '').matchAll(/\{([WUBRG])\}/g)].map(match => match[1]);
                    let optionIndex = options.findIndex(option => option.some(color => needed.includes(color) && (pool[color] || 0) === 0));
                    if (optionIndex < 0) optionIndex = 0;
                    addManaProduction({ manaPool: pool, colorIdentity: bot.colorIdentity }, source, optionIndex);
                }
                return canPayMana(pool, entry.card.manaCost || '');
            });
            if (chosen) {
                for (const source of bot.battlefield.filter(card => !card.tapped && isManaSource(card, bot.colorIdentity))) {
                    if (canPayMana(bot.manaPool, chosen.card.manaCost || '')) break;
                    const options = manaProductionOptions(source, bot.colorIdentity);
                    const needed = [...String(chosen.card.manaCost || '').matchAll(/\{([WUBRG])\}/g)].map(match => match[1]);
                    let optionIndex = options.findIndex(option => option.some(color => needed.includes(color) && (bot.manaPool[color] || 0) === 0));
                    if (optionIndex < 0) optionIndex = 0;
                    source.tapped = true;
                    addManaProduction(bot, source, optionIndex);
                }
                const paid = payMana(bot.manaPool, chosen.card.manaCost || '');
                if (paid) {
                    bot.manaPool = paid;
                    bot.hand.splice(chosen.index, 1);
                    const targets = state.players.filter(id => id !== botId && !state.playersData[id]?.eliminated);
                    const requiredTarget = /target creature|target permanent|any target|target player/i.test(chosen.card.oracleText || '');
                    const targetPlayer = [...targets].sort((a,b)=>(state.playersData[a]?.life ?? 40)-(state.playersData[b]?.life ?? 40))[0];
                    const targetCreature = targets.flatMap(id => (state.playersData[id]?.battlefield || []).filter(card => /creature/i.test(card.typeLine || '')).map(card => `card:${id}:${card.id}`))[0];
                    const spellTarget = /target creature/i.test(chosen.card.oracleText || '') ? targetCreature : (targetPlayer ? `player:${targetPlayer}` : '');
                    resolvePlayedCard(state, botId, chosen.card, requiredTarget ? (targetCreature || spellTarget) : '', 0, false);
                    state.log.unshift(`${botName} lancia ${chosen.card.name}.`);
                }
            }
            const targets = state.players.filter(id => id !== botId && !state.playersData[id]?.eliminated)
                .sort((a, b) => (state.playersData[a]?.life ?? 40) - (state.playersData[b]?.life ?? 40));
            const target = targets[0];
            const attackers = bot.battlefield.filter(card => !card.tapped && !card.summoningSick && !(card.keywords||[]).some(keyword=>String(keyword).toLowerCase()==='defender') && !/\bdefender\b/i.test(card.oracleText||'') && (card.typeLine || '').toLowerCase().includes('creature'));
            if (target && attackers.length) {
                const damage = attackers.reduce((sum, card) => sum + (Number.parseInt(card.power, 10) || 0), 0);
                attackers.forEach(card => { if(!((card.keywords||[]).some(keyword=>String(keyword).toLowerCase()==='vigilance')||/\bvigilance\b/i.test(card.oracleText||'')))card.tapped = true; if (card.isCommander) { bot.commanderDamage[target] ||= {}; bot.commanderDamage[target][card.id] = (bot.commanderDamage[target][card.id] || 0) + (Number.parseInt(card.power, 10) || 0); } });
                const foe = state.playersData[target]; foe.life = Math.max(0, foe.life - damage);const lifeGain=attackers.filter(card=>(card.keywords||[]).some(keyword=>String(keyword).toLowerCase()==='lifelink')||/\blifelink\b/i.test(card.oracleText||'')).reduce((sum,card)=>sum+(Number.parseInt(card.power,10)||0),0);if(lifeGain)bot.life+=lifeGain;
                const commanderLethal = Object.values(bot.commanderDamage[target] || {}).some(value => value >= 21);
                if (foe.life <= 0 || commanderLethal) foe.eliminated = true;
                state.log.unshift(`${botName} attacca ${state.playerNames?.[target] || `Giocatore ${state.players.indexOf(target) + 1}`} per ${damage} danni.`);
                const survivors = state.players.filter(id => !state.playersData[id].eliminated);
                if (survivors.length === 1) state.winner = survivors[0];
            }
            if (!state.winner) advanceTurn(state);
            return state;
        });
    };
    const scheduleBotTurn = state => {
        if (!room?.data?.magic?.botMatch || !state || state.winner || state.mulliganActive || !state.botPlayers?.[state.activePlayer]) return;
        const token = `${state.turn}:${state.activePlayer}`;
        if (botTurnScheduled === token) return;
        botTurnScheduled = token;
        clearTimeout(botTurnTimer);
        botTurnTimer = setTimeout(() => { void runBotTurn(state.activePlayer, token); }, 900);
    };
    const loadBotDeck = async selection => {
        if (selection.startsWith('owned:')) {
            const deck = decks.find(item => item.id === selection.slice(6));
            if (!deck) throw new Error('Il mazzo selezionato non è disponibile.');
            return { name: deck.name, commanders: deck.commanders || [], cards: deckCards(deck) };
        }
        let publicId = selection.startsWith('public:') ? selection.slice(7) : '';
        if (!publicId) {
            if (!publicBotDecks.length) throw new Error('Carica prima i mazzi pubblici oppure scegli un tuo mazzo per ogni bot.');
            publicId = publicBotDecks[Math.floor(Math.random() * publicBotDecks.length)].id;
        }
        if (!publicBotDeckCache.has(publicId)) publicBotDeckCache.set(publicId, loadPublicMagicShare({ deckId: publicId }));
        const share = await publicBotDeckCache.get(publicId);
        return { name: share.name, commanders: share.commanders || [], cards: (share.cards || []).flatMap(card => Array.from({ length: Math.max(0, Number(card.quantity) || 0) }, () => ({ ...card, quantity: 1 }))) };
    };
    const startBotGame = async button => {
        const playerDeck = decks.find(deck => deck.id === container.querySelector('#magic-bot-player-deck')?.value);
        if (!playerDeck) { setNotice('Crea o carica un mazzo prima di apparecchiare.'); return; }
        const playerCards = deckCards(playerDeck), playerValidation = validateCommanderDeck(playerCards, playerDeck.commanders || []);
        if (!playerValidation.valid) { setNotice(playerValidation.errors[0]); return; }
        const count = Number(container.querySelector('#magic-bot-count')?.value || botCount);
        if (![1, 3].includes(count) || count + 1 > 4) { setNotice('Scegli 1 o 3 bot: il tavolo ammette al massimo quattro giocatori.'); return; }
        button.disabled = true; setNotice('Preparo i mazzi dei bot…');
        try {
            const botDecks = [];
            for (let index = 0; index < count; index++) {
                const selection = botDeckSelections[index] || 'random';
                const deck = await loadBotDeck(selection);
                const validation = validateCommanderDeck(deck.cards, deck.commanders);
                if (!validation.valid) throw new Error(`${deck.name}: ${validation.errors[0]}`);
                botDecks.push(deck);
            }
            const humanId = playerId(), players = [humanId], playersData = {}, playerNames = { [humanId]: 'Tu' }, botPlayers = {};
            const prepare = (cards, commanders) => {
                const commandIds = commanders || [];
                const commandZone = commandIds.map(id => cards.find(card => card.id === id)).filter(Boolean).map(card => ({ ...card, isCommander: true }));
                const library = cards.filter(card => !commandIds.includes(card.id)).map(card => ({ ...card }));
                for (let i = library.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [library[i], library[j]] = [library[j], library[i]]; }
                return { hand: library.splice(0, 7), library, battlefield: [], graveyard: [], exile: [], commandZone, commanderCasts: {}, commanderDamage: {}, manaPool: emptyManaPool(), colorIdentity: [...new Set(commandZone.flatMap(card => card.colorIdentity || []))], life: 40, landsPlayed: 0, mulligans: 0, freeMulliganUsed: false, cardsToBottom: 0, keptOpeningHand: false, mulliganBottom: [] };
            };
            playersData[humanId] = prepare(playerCards, playerDeck.commanders || []);
            botDecks.forEach((deck, index) => {
                const id = `bot-${crypto.randomUUID()}`;
                players.push(id); playersData[id] = prepare(deck.cards, deck.commanders);
                playersData[id].keptOpeningHand = true;
                playerNames[id] = `Bot ${index + 1} · ${deck.name}`;
                botPlayers[id] = { difficulty: 'media', deckName: deck.name };
            });
            const state = { version: 2, turn: 1, activePlayer: humanId, startingPlayer: humanId, players, playersData, playerNames, botPlayers, mulliganActive: true, log: ['Partita di prova iniziata · Commander · 40 vite · mulligan gratuito disponibile'], turnName: 'Mulligan iniziale' };
            clearTimeout(botTurnTimer); botTurnScheduled = '';
            stopWatching?.(); if (pollTimer) clearInterval(pollTimer); stopWatching = null; pollTimer = null;
            room = { code: 'BOT', hostClientId: humanId, status: 'connected', scope: 'magic', data: { scope: 'magic', magic: { botMatch: true, game: state } } };
            localStorage.removeItem('taverna_magic_room');
            localStorage.setItem(BOT_GAME_KEY, JSON.stringify(room));
            activeTab = 'partita'; render(); setNotice(`Tavolo pronto: tu + ${count} bot. La partita viene salvata su questo dispositivo.`);
        } catch (error) { setNotice(`Non riesco a preparare la partita: ${error.message}`); }
        finally { button.disabled = false; }
    };
    const refreshRoom = next => {
        if (disposed || !next || next.code !== room?.code || next.data?.scope !== 'magic') return;
        if (room.updatedAt && next.updatedAt < room.updatedAt) return;
        room = next; multiplayerHealthy = next.status !== 'closed'; render();
        const status = container.querySelector('#magic-room-status');
        if (status && game() && !humansPresent(game())) status.textContent = `Stanza ${room.code} · in attesa dei giocatori disconnessi, nessun bot`;
    };
    const watchRoom = next => {
        stopWatching?.(); clearInterval(pollTimer); stopWatching = null; pollTimer = null;
        if (!next?.code || next.data?.magic?.botMatch) return;
        const code = next.code;
        let polling = false, lastHeartbeat = 0;
        stopWatching = watchMinigameRoom(code, refreshRoom);
        const poll = async () => {
            if (polling || disposed || multiplayerBusy || room?.code !== code) return;
            polling = true;
            try {
                const result = Date.now() - lastHeartbeat > 10000
                    ? await updateMinigameRoomData(code, (data, currentRoom) => {
                        const members = [currentRoom.hostClientId, currentRoom.guestClientId, ...(data.magic?.participants || [])];
                        if (!members.includes(playerId())) throw new Error('Non fai parte di questa stanza.');
                        return { ...data, magic: { ...data.magic, presence: { ...data.magic?.presence, [playerId()]: Date.now() } } };
                    }) : await getMinigameRoomByCode(code);
                if (Date.now() - lastHeartbeat > 10000) lastHeartbeat = Date.now();
                if (result.error || !result.room) { multiplayerHealthy = false; setNotice(result.error?.message || 'La stanza non è più disponibile.'); }
                else refreshRoom(result.room);
            } catch { multiplayerHealthy = false; setNotice('Connessione interrotta. Riconnessione in corso…'); }
            finally { polling = false; }
        };
        void poll(); pollTimer = setInterval(poll, 2500);
    };
    const ensureRoomScope = next => {
        clearTimeout(botTurnTimer); botTurnScheduled = '';
        localStorage.removeItem(BOT_GAME_KEY); room = { ...next, scope: 'magic' };
        try { localStorage.setItem('taverna_magic_room', JSON.stringify(room)); } catch {}
        watchRoom(room); render();
    };

    container.querySelector('#magic-home').onclick = () => navigateTo('home');
    container.querySelector('#magic-open-counter').onclick = () => navigateTo('cardCounter', container);
    container.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { activeTab = button.dataset.tab; render(); container.querySelector(`[data-panel="${activeTab}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    container.querySelector('#magic-search').addEventListener('input', event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => searchCards(event.target.value), 300); });
    container.querySelector('#magic-filter').addEventListener('input', event => { collectionFilter = event.target.value; renderCollection(); });
    container.querySelector('#magic-collection-public').onchange = async event => {
        const desired = event.target.checked;
        if (!cloudUserId || !collectionId) { event.target.checked = collectionPublic; setNotice('La raccolta pubblica richiede la sincronizzazione con un account.'); return; }
        event.target.disabled = true;
        try {
            await setMagicCollectionPublic(cloudUserId, collectionId, desired);
            collectionPublic = desired; persist(); render();
            setNotice(desired ? 'Collezione pubblica: chiunque abbia il link può vederla.' : 'Collezione privata.');
        } catch (error) { event.target.checked = collectionPublic; setNotice(`Non riesco a cambiare la visibilità: ${error.message}`); }
        finally { event.target.disabled = !cloudUserId || !collectionId; }
    };
    container.querySelector('#magic-share-collection').onclick = () => collectionId && copyMagicShare('collection', collectionId);
    const scanAndResolve = async files => {
        const preview = container.querySelector('#magic-photo-preview');
        preview.innerHTML = '<div class="magic-photo-card"><div><strong>Importazione in corso…</strong><span>Leggo il file e riconosco i nomi delle carte.</span></div></div>';
        try {
            const recognized = [];
            for (const file of files) recognized.push(...await scanMagicDocument(file, message => {
                const label = preview.querySelector('.magic-photo-card span'); if (label) label.textContent = message;
            }));
            const quantities = new Map();
            for (const card of recognized) {
                const key = String(card.name || '').trim().toLocaleLowerCase();
                if (!key) continue;
                const entry = quantities.get(key) || { name: String(card.name).trim(), quantity: 0, alternatives: [] };
                entry.quantity += card.quantity || 1;
                for (const alternative of card.alternatives || []) {
                    if (alternative && !entry.alternatives.some(value => value.toLocaleLowerCase() === alternative.toLocaleLowerCase())) entry.alternatives.push(alternative);
                }
                quantities.set(key, entry);
            }
            const entries = [...quantities.values()];
            if (!entries.length) throw new Error('Non ho riconosciuto carte. Prova con una scansione più nitida.');
            scannedCards = await resolveScannedCards(entries, message => {
                const label = preview.querySelector('.magic-photo-card span'); if (label) label.textContent = message;
            });
            const consolidate = () => {
                const merged = new Map();
                for (const entry of scannedCards) {
                    const key = entry.card ? `card:${entry.card.id}` : `name:${entry.name.toLocaleLowerCase()}`;
                    const saved = merged.get(key);
                    if (saved) saved.quantity += entry.quantity;
                    else merged.set(key, entry);
                }
                scannedCards = [...merged.values()];
            };
            const renderScanPreview = () => {
                const found = scannedCards.filter(entry => entry.card);
                preview.innerHTML = '<div class="magic-photo-card"><div><strong>Trovate ' + found.length + ' carte su ' + scannedCards.length + '</strong><span>Controlla i risultati; correggi il nome delle carte non abbinate.</span></div><button type="button" class="magic-button" id="magic-add-scanned" ' + (found.length ? '' : 'disabled') + '>Aggiungi tutte</button>' + (found.length ? '<button type="button" class="magic-button magic-button-secondary" id="magic-print-scanned">Stampa proxy</button>' : '') + '</div><div class="magic-scan-lines">' + scannedCards.map((entry, index) => '<div><span>' + esc(entry.name) + ' · ×' + entry.quantity + (entry.card ? ' → ' + esc(entry.card.name) : ' · da correggere') + '</span>' + (entry.card ? '' : '<input class="magic-scan-correction" type="search" data-scan-correction="' + index + '" value="' + esc(entry.name) + '" aria-label="Correggi il nome di ' + esc(entry.name) + '"><button type="button" class="magic-text-button" data-scan-find="' + index + '">Cerca</button>') + '<button type="button" class="magic-text-button" data-scan-index="' + index + '" ' + (entry.card ? '' : 'disabled') + '>Aggiungi</button></div>').join('') + '</div>';
                preview.querySelector('#magic-print-scanned')?.addEventListener('click', () => openMagicProxyPrinter(found.map(entry => ({ name: entry.card.name, quantity: entry.quantity }))));
                preview.querySelector('#magic-add-scanned')?.addEventListener('click', () => {
                    for (const entry of scannedCards) if (entry.card) addCollectionCard(entry.card, entry.quantity);
                    scannedCards = []; preview.innerHTML = ''; setNotice('Carte riconosciute aggiunte alla bacheca.');
                });
                preview.querySelectorAll('[data-scan-index]').forEach(button => button.addEventListener('click', () => {
                    const entry = scannedCards[Number(button.dataset.scanIndex)];
                    if (entry?.card) { addCollectionCard(entry.card, entry.quantity); button.disabled = true; button.textContent = 'Aggiunta'; }
                }));
                preview.querySelectorAll('[data-scan-find]').forEach(button => button.addEventListener('click', async () => {
                    const index = Number(button.dataset.scanFind), entry = scannedCards[index];
                    const input = preview.querySelector(`[data-scan-correction="${index}"]`), name = input?.value.trim();
                    if (!entry || !name) return;
                    button.disabled = true; button.textContent = 'Cerco…';
                    try {
                        const result = await resolveScannedCard({ name, quantity: entry.quantity });
                        if (!result.card) { button.disabled = false; button.textContent = 'Non trovata'; return; }
                        entry.name = name; entry.card = result.card; consolidate(); renderScanPreview();
                    } catch { button.disabled = false; button.textContent = 'Riprova'; }
                }));
            };
            consolidate();
            renderScanPreview();
        } catch (error) {
            preview.innerHTML = '<div class="magic-photo-card"><div><strong>Scansione non riuscita</strong><span>' + esc(error.message) + ' Puoi cercare il nome manualmente.</span></div></div>';
        }
    };
    const loadDemoDecks = async button => {
        const pending = MAGIC_DEMO_DECKS.filter(demo => !decks.some(deck => deck.name === demo.name));
        if (!pending.length) { setNotice('I quattro mazzi demo sono già nella tua lista.'); return; }
        button.disabled = true;
        const originalLabel = button.textContent;
        button.textContent = 'Carico…';
        try {
            const parsedDecks = pending.map(demo => {
                const parsed = parseMagicCardList(demo.source);
                const total = parsed.cards.reduce((sum, card) => sum + card.quantity, 0);
                if (total !== 100) throw new Error(`${demo.name}: la lista contiene ${total} carte invece di 100.`);
                return { ...demo, cards: parsed.cards };
            });
            const allEntries = [...new Map(parsedDecks.flatMap(deck => deck.cards).map(card => [normalizeCardName(card.name), { name: card.name, quantity: 1 }])).values()];
            const resolved = await resolveScannedCards(allEntries, message => setNotice(`Carico i mazzi demo · ${message}`));
            const cardsByName = new Map(resolved.filter(entry => entry.card).map(entry => [normalizeCardName(entry.name), entry.card]));
            const missingNames = allEntries.filter(entry => !cardsByName.has(normalizeCardName(entry.name))).map(entry => entry.name);
            if (missingNames.length) throw new Error(`Non trovo nel catalogo: ${missingNames.slice(0, 5).join(', ')}${missingNames.length > 5 ? '…' : ''}. Nessun mazzo è stato aggiunto.`);

            const stagedDecks = parsedDecks.map(demo => {
                const deckCardsList = demo.cards.map(entry => ({ card: cardsByName.get(normalizeCardName(entry.name)), quantity: entry.quantity }));
                const commander = cardsByName.get(normalizeCardName(demo.commander));
                if (!commander) throw new Error(`Comandante non trovato per ${demo.name}.`);
                const validation = validateCommanderDeck(deckCardsList.flatMap(({ card, quantity }) => Array.from({ length: quantity }, () => cardSummary(card))), [commander.id]);
                if (!validation.valid) throw new Error(`${demo.name}: ${validation.errors[0]}`);
                return { name: demo.name, commander, cards: deckCardsList.map(({ card, quantity }) => ({ cardId: card.id, quantity })) };
            });

            const quantityById = new Map();
            for (const deck of stagedDecks) for (const item of deck.cards) quantityById.set(item.cardId, (quantityById.get(item.cardId) || 0) + item.quantity);
            for (const [id, quantity] of quantityById) {
                const source = resolved.find(entry => entry.card?.id === id)?.card;
                if (!source) continue;
                const existing = collection.find(card => card.id === id);
                if (existing) existing.quantity = Math.min(999, existing.quantity + quantity);
                else collection.unshift({ ...cardSummary(source), quantity });
            }
            for (const deck of stagedDecks) decks.push({ id: crypto.randomUUID(), name: deck.name, cards: deck.cards, commanders: [deck.commander.id] });
            selectedDeck = stagedDecks.at(-1)?.name ? decks.find(deck => deck.name === stagedDecks.at(-1).name)?.id || selectedDeck : selectedDeck;
            activeTab = 'mazzi';
            persist();
            render();
            setNotice(`${stagedDecks.length} mazzi Commander demo caricati. Le liste e le carte restano private nel tuo account.`);
        } catch (error) {
            setNotice(`Caricamento demo non riuscito: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = originalLabel;
        }
    };
    container.querySelector('#magic-photo').onchange = async event => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file || scanInProgress) return;
        scanInProgress = true;
        input.disabled = true;
        try { await scanAndResolve([file]); }
        finally { scanInProgress = false; input.disabled = false; input.value = ''; }
    };
    container.querySelector('#magic-load-demos').onclick = event => { void loadDemoDecks(event.currentTarget); };
    container.querySelector('#magic-search-results').onclick = event => { const button = event.target.closest('[data-add-result]'); if (button) { const card = cardResults.find(item=>item.id===button.dataset.addResult); if(card) addCollectionCard(card); } };
    container.querySelector('#magic-collection').onclick = event => {
        const button=event.target.closest('[data-owned-action]'); if(!button) return; const card=collection.find(item=>item.id===button.dataset.card); if(!card)return;
        if(button.dataset.ownedAction==='deck') { const deck=currentDeck();if(!deck){setNotice('Crea o seleziona un mazzo prima di aggiungere carte.');return;}const entry=deck.cards.find(item=>item.cardId===card.id);const inDeck=entry?.quantity||0;if(inDeck>=card.quantity){setNotice(`Non hai altre copie di ${card.name} nella raccolta.`);return;}if(entry)entry.quantity++;else deck.cards.push({cardId:card.id,quantity:1});persist();renderDecks();setNotice(`${card.name} aggiunta a ${deck.name}.`);return; }
        if(button.dataset.ownedAction==='add') card.quantity++; else if(button.dataset.ownedAction==='remove') card.quantity=Math.max(0,card.quantity-1); else card.quantity=0;
        if(!card.quantity) { collection=collection.filter(item=>item.id!==card.id); decks=decks.map(deck=>({...deck,cards:deck.cards.filter(entry=>entry.cardId!==card.id)})); }
        persist(); render();
    };
    container.querySelector('#magic-new-deck').onclick = () => { const name=prompt('Come vuoi chiamare il mazzo?','Nuovo mazzo'); if(!name?.trim())return; const deck={id:crypto.randomUUID(),name:name.trim(),cards:[]}; decks.push(deck); selectedDeck=deck.id; persist(); render(); };
    container.querySelector('#magic-deck-list').onclick = event => { const button=event.target.closest('[data-select-deck]'); if(button){selectedDeck=button.dataset.selectDeck;renderDecks();} };
    container.querySelector('#magic-deck-editor').onclick = async event => {
        const deck=currentDeck(); if(!deck)return;
        if(event.target.closest('#magic-share-deck')) { await copyMagicShare('deck', deck.id); return; }
        if(event.target.closest('#magic-proxy-deck')) { await openMagicProxyPrinter(deck.cards.map(entry=>({name:collection.find(card=>card.id===entry.cardId)?.name,quantity:entry.quantity})).filter(card=>card.name)); return; }
        if(event.target.closest('#magic-full-rules')) {
            const list = formatManabrewCommanderList(deck, deckCards(deck));
            window.open('https://play.manabrew.app', '_blank', 'noopener,noreferrer');
            try {
                await navigator.clipboard.writeText(list);
                setNotice('Lista copiata. In Manabrew crea un mazzo Commander e incollala nell’importatore. Per rispettare il tavolo La Taverna, scegli da 2 a 4 giocatori.');
            } catch {
                const blob = new Blob([list], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob), link = document.createElement('a');
                link.href = url; link.download = `${deck.name.replace(/[^a-z0-9-_]/gi, '-')}-commander.txt`; link.click(); URL.revokeObjectURL(url);
                setNotice('Ho scaricato la lista. Importala in Manabrew, poi crea una stanza Commander da 2 a 4 giocatori.');
            }
        }
        else if(event.target.closest('#magic-rename-deck')) { const name=prompt('Nome del mazzo',deck.name); if(name?.trim()){deck.name=name.trim();persist();renderDecks();} }
        else if(event.target.closest('#magic-delete-deck')) { if(confirm(`Eliminare il mazzo “${deck.name}”?`)){decks=decks.filter(item=>item.id!==deck.id);selectedDeck=decks[0]?.id||'';persist();renderDecks();} }
        else if(event.target.closest('#magic-play')) { activeTab='partita';render(); }
        else { const add=event.target.closest('[data-deck-add]'), remove=event.target.closest('[data-deck-remove]'); const id=(add||remove)?.dataset[add?'deckAdd':'deckRemove']; if(id){let entry=deck.cards.find(item=>item.cardId===id); if(add&&getCount(id)>(entry?.quantity||0)){if(entry)entry.quantity++;else deck.cards.push({cardId:id,quantity:1});} else if(remove&&entry){entry.quantity--;if(!entry.quantity)deck.cards=deck.cards.filter(item=>item!==entry);} persist();renderDecks();} }
    };
    container.querySelector('#magic-deck-editor').onchange = async event => {
        const publicToggle = event.target.closest('#magic-deck-public');
        if (publicToggle) {
            const deck = currentDeck(); if (!deck || !cloudUserId || !cloudDeckIds.has(deck.id)) { publicToggle.checked = deck?.isPublic === true; return; }
            const desired = publicToggle.checked; publicToggle.disabled = true;
            try { await setMagicDeckPublic(cloudUserId, deck.id, desired); deck.isPublic = desired; renderDecks(); persist(); setNotice(desired ? 'Mazzo pubblico: chiunque abbia il link può vederlo.' : 'Mazzo privato.'); }
            catch (error) { publicToggle.checked = deck.isPublic === true; setNotice(`Non riesco a cambiare la visibilità: ${error.message}`); }
            return;
        }
        const selector = event.target.closest('[data-commander-slot]'); if (!selector) return;
        const deck = currentDeck(); if (!deck) return;
        deck.commanders ||= [];
        const slot = Number(selector.dataset.commanderSlot), cardId = selector.value;
        if (cardId) {
            const card = collection.find(item => item.id === cardId);
            const first = slot === 1 ? collection.find(item=>item.id===deck.commanders[0]) : card;
            if (!card || !(slot===0 ? isCommanderEligible(card) : canPairCommanders(first,card))) { setNotice(slot===0?'Scegli una creatura leggendaria legale in Commander.':'La carta selezionata non può affiancare questo comandante.'); return; }
            if (deck.commanders.some((id,index)=>index!==slot&&id===cardId)) { setNotice('Lo stesso comandante non può essere scelto due volte.'); return; }
            deck.commanders[slot] = cardId;
            if (!deck.cards.some(entry=>entry.cardId===cardId)) deck.cards.push({cardId,quantity:1});
        } else deck.commanders[slot] = '';
        deck.commanders = deck.commanders.filter(Boolean);
        persist(); renderDecks();
    };
    container.querySelector('#magic-bot-count').onchange = event => { botCount = Number(event.target.value); renderBotSetup(); };
    container.querySelector('#magic-bot-deck-selectors').onchange = event => { const select = event.target.closest('[data-bot-deck]'); if (select) botDeckSelections[Number(select.dataset.botDeck)] = select.value; };
    container.querySelector('#magic-load-public-bot-decks').onclick = async event => {
        const button = event.currentTarget; button.disabled = true; setNotice('Carico il catalogo dei mazzi pubblici…');
        try { publicBotDecks = await listPublicMagicDecks(); botDeckCatalogLoaded = true; renderBotSetup(); setNotice(publicBotDecks.length ? `${publicBotDecks.length} mazzi pubblici disponibili per i bot.` : 'Non ci sono ancora mazzi Commander pubblici. Puoi scegliere i tuoi mazzi per i bot.'); }
        catch (error) { botDeckCatalogLoaded = false; setNotice(`Catalogo pubblico non disponibile: ${error.message}`); }
        finally { button.disabled = false; }
    };
    container.querySelector('#magic-start-bot-game').onclick = event => { void startBotGame(event.currentTarget); };
    container.querySelector('#magic-host').onclick = async event => { const button=event.currentTarget;button.disabled=true;setNotice('Creo la stanza…'); localStorage.removeItem(BOT_GAME_KEY);const result=await createMinigameRoom({scope:'magic'});button.disabled=false; if(result.error){setNotice(result.unavailable?'Multiplayer non configurato. Verifica Supabase e lo schema minigame_rooms.':result.error.message);return;} const initialized=await updateMinigameRoomData(result.room.code, data=>({...data,scope:'magic',magic:{participants:[],loadouts:{}}}));if(initialized.error){setNotice(initialized.error.message);return;}ensureRoomScope(initialized.room);setNotice('Stanza pronta. Condividi il codice: da 2 a 4 giocatori.'); };
    container.querySelector('#magic-join-form').onsubmit = async event => { event.preventDefault(); const selected=decks.find(deck=>deck.id===container.querySelector('#magic-join-deck').value);if(!selected){setNotice('Crea un mazzo e aggiungilo alla tua bacheca prima di entrare.');return;}const cards=deckCards(selected).map(card=>({...card}));const validation=validateCommanderDeck(cards,selected.commanders||[]);if(!validation.valid){setNotice(validation.errors[0]);return;} const result=await joinMagicRoom(container.querySelector('#magic-room-code').value,{cards,commanders:selected.commanders||[],name:selected.name});if(result.error){setNotice(result.error.message);return;} ensureRoomScope(result.room);setNotice('Sei al tavolo.'); };
    const showCardDetails = async target => {
        const state = game(); if (!state || !target) return;
        const [zone, ownerId, position] = target.split(':');
        let card;
        if (zone === 'hand') card = state.playersData[playerId()]?.hand?.[Number(ownerId)];
        else if (zone === 'command') card = state.playersData[playerId()]?.commandZone?.[Number(ownerId)];
        else if (zone === 'board') card = state.playersData[ownerId]?.battlefield?.[Number(position)];
        if (!card) return;
        const modal = container.querySelector('#magic-card-inspector');
        const content = container.querySelector('#magic-inspector-content');
        if (!modal || !content) return;
        const italian = prefersItalianCards();
        const requestKey = `${card.id}:${Date.now()}`;
        modal.dataset.localizationRequest = requestKey;
        const renderInspector = (rulesText, label) => {
            if (!modal.isConnected || modal.dataset.localizationRequest !== requestKey) return;
            content.innerHTML = `<div class="magic-inspector-card">${card.image ? `<img src="${esc(card.image)}" alt="Illustrazione di ${esc(card.name)}">` : ''}<div><span class="magic-overline">CARTA · ${esc(card.typeLine || 'Magic')}</span><h3 id="magic-inspector-title">${esc(card.name)}</h3><p class="magic-inspector-cost"><span>Costo mana</span><strong>${manaCostIcons(card.manaCost)}</strong>${card.isCommander ? `<span>· Tassa comandante</span><strong>${manaCostIcons(`{${2 * (state.playersData[playerId()]?.commanderCasts?.[card.id] || 0)}}`)}</strong>` : ''}</p>${card.power !== '' ? `<p class="magic-inspector-stats">Forza/Costituzione ${esc(card.power)}/${esc(card.toughness)}</p>` : ''}<h4>${label}</h4><p class="magic-inspector-oracle">${magicRulesText(rulesText || 'Nessun testo Oracle disponibile.')}</p></div></div>`;
        };
        const englishRulesText = card.oracleText || 'Nessun testo Oracle.';
        renderInspector(italian && !card.printedText ? 'Cerco la stampa italiana…' : (italian ? card.printedText : englishRulesText), italian ? 'Testo Oracle · Italiano' : 'Testo Oracle');
        modal.hidden = false;
        if (italian && !card.printedText && card.language !== 'it') {
            const localizedText = await italianPrintedText(card);
            if (modal.dataset.localizationRequest === requestKey) renderInspector(localizedText || englishRulesText, localizedText ? 'Testo Oracle · Italiano' : 'Testo Oracle · Italiano non disponibile; mostrato in inglese');
        }
    };
    const tableRoot = container.querySelector('#magic-table');
    const updateFullscreenViewport = () => {
        if (!pseudoFullscreen) return;
        const height = window.visualViewport?.height || window.innerHeight;
        tableRoot.style.setProperty('--magic-fullscreen-height', `${Math.ceil(height)}px`);
    };
    const enterPseudoFullscreen = () => {
        if (pseudoFullscreen) return;
        pseudoFullscreen = true;
        pseudoFullscreenScrollY = window.scrollY;
        previousPageOverflow = {
            html: document.documentElement.style.overflow,
            body: document.body.style.overflow,
            htmlPriority: document.documentElement.style.getPropertyPriority('overflow'),
            bodyPriority: document.body.style.getPropertyPriority('overflow')
        };
        document.documentElement.style.setProperty('overflow', 'hidden', 'important');
        document.body.style.setProperty('overflow', 'hidden', 'important');
        document.body.classList.add('magic-game-pseudo-fullscreen');
        pseudoFullscreenAncestors = [];
        for (let ancestor = tableRoot.parentElement; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
            const computed = getComputedStyle(ancestor);
            const properties = ['transform', 'filter', 'perspective', 'contain', 'will-change'];
            const active = properties.some(property => {
                const value = computed.getPropertyValue(property);
                return value && value !== 'none' && value !== 'auto' && value !== 'normal';
            });
            if (!active) continue;
            const inline = Object.fromEntries(properties.map(property => [property, {
                value: ancestor.style.getPropertyValue(property),
                priority: ancestor.style.getPropertyPriority(property)
            }]));
            pseudoFullscreenAncestors.push({ element: ancestor, inline });
            for (const property of properties) ancestor.style.setProperty(property, 'none', 'important');
        }
        tableRoot.classList.add('magic-pseudo-fullscreen');
        updateFullscreenViewport();
        window.visualViewport?.addEventListener('resize', updateFullscreenViewport);
        window.addEventListener('resize', updateFullscreenViewport);
        window.addEventListener('orientationchange', updateFullscreenViewport);
        syncFullscreenButton();
    };
    const exitPseudoFullscreen = () => {
        if (!pseudoFullscreen) return;
        pseudoFullscreen = false;
        tableRoot.classList.remove('magic-pseudo-fullscreen');
        document.body.classList.remove('magic-game-pseudo-fullscreen');
        window.visualViewport?.removeEventListener('resize', updateFullscreenViewport);
        window.removeEventListener('resize', updateFullscreenViewport);
        window.removeEventListener('orientationchange', updateFullscreenViewport);
        for (const { element, inline } of pseudoFullscreenAncestors) {
            for (const [property, saved] of Object.entries(inline)) {
                if (saved.value) element.style.setProperty(property, saved.value, saved.priority);
                else element.style.removeProperty(property);
            }
        }
        pseudoFullscreenAncestors = [];
        if (previousPageOverflow) {
            document.documentElement.style.setProperty('overflow', previousPageOverflow.html, previousPageOverflow.htmlPriority);
            document.body.style.setProperty('overflow', previousPageOverflow.body, previousPageOverflow.bodyPriority);
            previousPageOverflow = null;
        }
        tableRoot.style.removeProperty('--magic-fullscreen-height');
        window.scrollTo(0, pseudoFullscreenScrollY);
        syncFullscreenButton();
    };
    const syncFullscreenButton = () => {
        const button = tableRoot.querySelector('#magic-fullscreen');
        if (!button) return;
        const active = document.fullscreenElement === tableRoot || document.webkitFullscreenElement === tableRoot || pseudoFullscreen;
        button.setAttribute('aria-pressed', String(active));
        button.title = active ? 'Esci dallo schermo intero' : 'Entra a schermo intero';
        button.innerHTML = `⛶ <span>${active ? 'Esci' : 'Schermo intero'}</span>`;
    };
    const handleFullscreenChange = () => {
        if (!document.fullscreenElement && pseudoFullscreen) exitPseudoFullscreen();
        syncFullscreenButton();
    };
    const handleFullscreenEscape = event => {
        if (event.key !== 'Escape' || !pseudoFullscreen) return;
        exitPseudoFullscreen();
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleFullscreenEscape);
    tableRoot.addEventListener('pointerdown', event => {
        const cardNode = event.target.closest('[data-card-inspect]'); if (!cardNode || event.button > 0) return;
        clearTimeout(cardHoldTimer); cardHoldTriggered = false;
        cardHoldTimer = setTimeout(() => { cardHoldTriggered = true; showCardDetails(cardNode.dataset.cardInspect); }, 520);
    });
    tableRoot.addEventListener('contextmenu', event => { if (event.target.closest('[data-card-inspect]')) event.preventDefault(); });
    for (const eventName of ['pointerup', 'pointercancel', 'pointerleave']) tableRoot.addEventListener(eventName, () => clearTimeout(cardHoldTimer));
    tableRoot.addEventListener('click', event => { if (event.target.closest('[data-close-card]')) { container.querySelector('#magic-card-inspector').hidden = true; cardHoldTriggered = false; } });
    container.querySelector('#magic-table').onclick = async event => {
        if (event.target.closest('[data-close-card]')) return;
        if (cardHoldTriggered) { cardHoldTriggered = false; return; }
        if(event.target.closest('#magic-ready')) {const deck=decks.find(item=>item.id===container.querySelector('#magic-start-deck')?.value);if(!deck){setNotice('Crea prima un mazzo.');return;}const cards=deckCards(deck).map(card=>({...card}));const validation=validateCommanderDeck(cards,deck.commanders||[]);if(!validation.valid){setNotice(validation.errors[0]);return;}const loadout={cards,commanders:deck.commanders||[],name:deck.name};const result=await updateMinigameRoomData(room.code,data=>{if(data.magic?.game)throw new Error('La partita è già iniziata.');return {...data,scope:'magic',magic:{...(data.magic||{}),loadouts:{...(data.magic?.loadouts||{}),[playerId()]:loadout}}};});if(result.error){setNotice(result.error.message);return;}room=result.room||room;render();return;}
        if(event.target.closest('#magic-start')) {if(room.hostClientId!==playerId())return;await createGame(null);return;}
        const state=game(); if(!state)return;
        if(event.target.closest('#magic-fullscreen')) {
            if(document.fullscreenElement===tableRoot || document.webkitFullscreenElement===tableRoot) {
                if (document.exitFullscreen) await document.exitFullscreen();
                else document.webkitExitFullscreen?.();
            } else if(pseudoFullscreen) exitPseudoFullscreen();
            else {
                if (document.fullscreenElement || document.webkitFullscreenElement) {
                    if (document.exitFullscreen) await document.exitFullscreen();
                    else document.webkitExitFullscreen?.();
                }
                let enteredNative = false;
                if (tableRoot.requestFullscreen) {
                    try { await tableRoot.requestFullscreen({ navigationUI: 'hide' }); enteredNative = document.fullscreenElement === tableRoot; }
                    catch { enteredNative = false; }
                } else if (tableRoot.webkitRequestFullscreen) {
                    try { await tableRoot.webkitRequestFullscreen(); enteredNative = document.webkitFullscreenElement === tableRoot; }
                    catch { enteredNative = false; }
                }
                if (!enteredNative) enterPseudoFullscreen();
            }
            syncFullscreenButton(); return;
        }
        const mulliganAction = event.target.closest('[data-mulligan-action]')?.dataset.mulliganAction;
        if (mulliganAction) { await saveState(current => openingMulliganAction(current, mulliganAction)); return; }
        const mulliganIndex = event.target.closest('[data-mulligan-index]')?.dataset.mulliganIndex;
        if (mulliganIndex !== undefined) { await saveState(current => openingMulliganAction(current, 'select', Number(mulliganIndex))); return; }
        if (state.mulliganActive && !event.target.closest('#magic-concede')) return;
        if(event.target.closest('#magic-concede')) {
            if (!confirm('Abbandonare la partita?')) return;
            if (!room.data?.magic?.botMatch) {
                const saved = state.winner || state.playersData[playerId()]?.eliminated || await saveState(current => {
                    current.playersData[playerId()].eliminated = true;
                    current.playersData[playerId()].keptOpeningHand = true;
                    const survivors = current.players.filter(id => !current.playersData[id].eliminated);
                    if (survivors.length === 1) current.winner = survivors[0];
                    else if (current.activePlayer === playerId()) advanceTurn(current);
                    if (current.mulliganActive && survivors.every(id => current.playersData[id].keptOpeningHand)) current.mulliganActive = false;
                    current.log.unshift(`Giocatore ${current.players.indexOf(playerId()) + 1} ha abbandonato.`);
                    return current;
                }, true);
                if (!saved) return;
                localStorage.removeItem('taverna_magic_room');
            } else localStorage.removeItem(BOT_GAME_KEY);
            clearTimeout(botTurnTimer); stopWatching?.(); clearInterval(pollTimer); botTurnScheduled = '';
            if(document.fullscreenElement===tableRoot)await document.exitFullscreen?.();
            if(pseudoFullscreen)exitPseudoFullscreen(); room=null; render(); return;
        }
        if(!myTurn(state))return;
        const manaChoice=event.target.closest('[data-mana-choice]');if(manaChoice){const choice=manaChoice.dataset.manaChoice;await saveState(current=>{current.playersData[playerId()].manaChoice=choice;return current;});return;}
        if(event.target.closest('#magic-end-turn')) { await saveState(advanceTurn); return; }
        if(event.target.closest('[data-cast-commander]')) {const id=event.target.closest('[data-cast-commander]')?.dataset.castCommander;await saveState(current=>{const own=current.playersData[playerId()],index=own.commandZone.findIndex(card=>card.id===id);if(index<0)return current;const card=own.commandZone[index],tax=(own.commanderCasts[id]||0)*2;own.manaPool ||= emptyManaPool();const paid=payMana(own.manaPool,card.manaCost||'',0,tax);if(!paid){setNotice(`Mana insufficiente per ${card.name}: costo ${card.manaCost||'0'} più tassa comandante di ${tax}. Tappa altre fonti o scegli colori diversi.`);return current;}own.manaPool=paid;own.commandZone.splice(index,1);own.commanderCasts[id]=(own.commanderCasts[id]||0)+1;const cast={...card,isCommander:true};resolvePlayedCard(current,playerId(),cast,container.querySelector('#magic-effect-target')?.value||'',0,true);current.log.unshift(`${card.name} lanciato dalla zona di comando pagando ${manaPoolLabel(paid)} residuo.`);return current;});return;}
        if(event.target.closest('#magic-attack')) {const target=container.querySelector('#magic-attack-target')?.value;if(!target)return;await saveState(current=>{const own=current.playersData[playerId()],foe=current.playersData[target];if(!foe)return current;const attackers=own.battlefield.filter(card=>!card.tapped&&!card.summoningSick&&!(card.keywords||[]).some(keyword=>String(keyword).toLowerCase()==='defender')&&!/\bdefender\b/i.test(card.oracleText||'')&&(card.typeLine||'').toLowerCase().includes('creature'));const damage=attackers.reduce((sum,card)=>sum+(Number.parseInt(card.power,10)||0),0);attackers.forEach(card=>{if(!((card.keywords||[]).some(keyword=>String(keyword).toLowerCase()==='vigilance')||/\bvigilance\b/i.test(card.oracleText||'')))card.tapped=true;if(card.isCommander){own.commanderDamage[target] ||= {};own.commanderDamage[target][card.id]=(own.commanderDamage[target][card.id]||0)+(Number.parseInt(card.power,10)||0);}});foe.life=Math.max(0,foe.life-damage);const lifeGain=attackers.filter(card=>(card.keywords||[]).some(keyword=>String(keyword).toLowerCase()==='lifelink')||/\blifelink\b/i.test(card.oracleText||'')).reduce((sum,card)=>sum+(Number.parseInt(card.power,10)||0),0);if(lifeGain)own.life+=lifeGain;const commanderLethal=Object.values(own.commanderDamage[target]||{}).some(value=>value>=21);if(foe.life<=0||commanderLethal)foe.eliminated=true;const survivors=current.players.filter(id=>!current.playersData[id].eliminated);if(survivors.length===1)current.winner=survivors[0];current.log.unshift(`Attacco: ${damage} danni al giocatore ${current.players.indexOf(target)+1}${commanderLethal?' · 21 danni da comandante':''}.`);return current;});return;}
        const life=event.target.closest('[data-life]'); if(life){await saveState(current=>{current.playersData[playerId()].life=Math.max(0,current.playersData[playerId()].life+Number(life.dataset.life));return current;});return;}
        if(event.target.closest('#magic-clear-mana')) { await saveState(current=>{current.playersData[playerId()].manaPool=emptyManaPool();current.log.unshift('La riserva di mana viene svuotata.');return current;});return;}
        const manaSource=event.target.closest('[data-board-action="mana"]'); if(manaSource){let addedColors=[],sourceName='';const saved=await saveState(current=>{const own=current.playersData[playerId()],card=own.battlefield[Number(manaSource.dataset.boardIndex)];if(!card||card.tapped)return current;const options=manaProductionOptions(card,own.colorIdentity),choice=own.manaChoice||'auto';const optionIndex=choice==='auto'?0:options.findIndex(option=>option.includes(choice));if(optionIndex<0){setNotice(`${card.name} non può produrre mana ${choice}; scegli un colore consentito o usa Automatico.`);return current;}addedColors=addManaProduction(own,card,optionIndex);if(!addedColors.length){setNotice(`${card.name} non ha una fonte di mana automatizzata.`);return current;}sourceName=card.name;card.tapped=true;current.log.unshift(`${card.name}: aggiunge ${addedColors.map(color=>({W:'{W}',U:'{U}',B:'{B}',R:'{R}',G:'{G}',C:'{C}'})[color]).join(' ')}.`);return current;});if(saved)showManaPulse(addedColors,sourceName);return;}
        const play=event.target.closest('[data-play-card]'); if(play){const index=Number(play.dataset.playCard),candidate=game()?.playersData?.[playerId()]?.hand?.[index];let xValue=0;if(candidate?.manaCost?.includes('{X}')){const choice=prompt(`Quanto vuoi pagare per X nel costo di ${candidate.name}?`,'0');if(choice===null)return;xValue=Math.max(0,Number.parseInt(choice,10)||0);}const target=container.querySelector('#magic-effect-target')?.value||'';await saveState(current=>{const own=current.playersData[playerId()],card=own.hand[index];if(!card)return current;if((card.typeLine||'').toLowerCase().includes('land')){if(own.landsPlayed>=1){setNotice('Puoi giocare una sola terra per turno.');return current;}own.landsPlayed++;own.hand.splice(index,1);const land={...card,tapped:/enters(?: the battlefield)? tapped(?:[.;,]|$)/i.test(card.oracleText||''),damageMarked:0};own.battlefield.push(land);const entryEffects=resolveOracleText(land,current,playerId(),'',0,true);current.log.unshift(...entryEffects.log);current.log.unshift(`Hai giocato ${card.name}.`);return current;}if(/\btarget\b|any target/i.test(card.oracleText||'')&&!target){setNotice(`Scegli prima il bersaglio per ${card.name}.`);return current;}own.manaPool ||= emptyManaPool();const paid=payMana(own.manaPool,card.manaCost||'',xValue);if(!paid){setNotice(`Mana insufficiente o colori non corretti per ${card.name} (${card.manaCost||'0'}). Tappa le fonti richieste e riprova.`);return current;}own.manaPool=paid;own.hand.splice(index,1);resolvePlayedCard(current,playerId(),{...card},target,xValue,false);current.log.unshift(`${card.name} lanciata pagando ${card.manaCost||'0'}${xValue?` con X=${xValue}`:''}.`);return current;});return;}
    };
    const initializeCloud = async () => {
        try {
            const user = await getMagicAccount();
            if (disposed || !user?.id) return;
            cloudUserId = user.id;
            const remote = await loadMagicLibrary(user.id);
            if (disposed) return;
            collectionId = remote.collectionId;
            collectionPublic = remote.collectionPublic;
            cloudDeckIds = new Set(remote.decks.map(deck => deck.id));
            if (remote.hasCloudData) {
                collection = remote.cards;
                decks = remote.decks;
            } else {
                const migrated = await saveMagicLibrary({ userId: user.id, cards: collection, decks });
                collectionId = migrated.collectionId;
                cloudDeckIds = new Set(decks.map(deck => deck.id));
            }
            cloudReady = true;
            write(COLLECTION_KEY, collection); write(DECKS_KEY, decks);
            localStorage.setItem(COLLECTION_PUBLIC_KEY, String(collectionPublic));
            render();
            setNotice('Collezione e mazzi sincronizzati con il tuo account.');
        } catch (error) {
            cloudReady = false;
            setNotice(`Archivio online non disponibile: ${error.message}. Le modifiche restano salvate su questo dispositivo.`);
        }
    };
    if(room?.code && !room?.data?.magic?.botMatch) watchRoom(room);
    motionCleanup=enhanceSurfaceMotion(container,{selector:'.magic-panel,.magic-scan-box,.magic-room-bar'});
    const cleanupMagic=()=>{disposed=true;lifecycle.disconnect();clearTimeout(botTurnTimer);clearTimeout(drawAnimationTimer);clearTimeout(manaPulseTimer);document.removeEventListener('fullscreenchange',handleFullscreenChange);document.removeEventListener('keydown',handleFullscreenEscape);if(document.fullscreenElement===tableRoot)void document.exitFullscreen?.();if(pseudoFullscreen)exitPseudoFullscreen();stopWatching?.();if(pollTimer)clearInterval(pollTimer);clearTimeout(searchTimer);clearTimeout(cloudSaveTimer);motionCleanup?.();if(cameraPhoto)URL.revokeObjectURL(cameraPhoto);};
    const lifecycle = new MutationObserver(() => { if (!tableRoot.isConnected) cleanupMagic(); });
    window.__magicCleanup = cleanupMagic;
    lifecycle.observe(container, {childList:true});
    render();
    void initializeCloud();
}
