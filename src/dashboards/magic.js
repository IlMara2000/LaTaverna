import { renderHomeBackButton } from '../components/ui/BackButton.js';
import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { canPairCommanders, isCommanderEligible, validateCommanderDeck } from './magicCommander.js';
import { formatManabrewCommanderList } from './magicManabrew.js';
import { rememberDestination, navigateTo } from '../services/appNavigation.js';
import { enhanceSurfaceMotion } from '../services/motionSystem.js';
import { scanMagicDocument } from '../services/magicDocumentScan.js';
import { createMinigameRoom, getMinigameRoomByCode, getSavedMinigameRoom, isMinigameRoomConnected, joinMagicRoom, updateMinigameRoomData, watchMinigameRoom } from '../services/minigameMultiplayer.js';
import './magic.css';

const COLLECTION_KEY = 'taverna_magic_collection_v1';
const DECKS_KEY = 'taverna_magic_decks_v1';
const CLIENT_KEY = 'taverna_minigame_client_id';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const read = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const playerId = () => localStorage.getItem(CLIENT_KEY) || 'local-player';
const cardFace = card => card?.image_uris?.normal || card?.card_faces?.[0]?.image_uris?.normal || '';
const manaValue = card => Number(card?.cmc || 0);
const colorName = card => (card?.colors || []).join('') || 'Incolore';

export function showMagicDashboard(container, options = {}) {
    window.__magicCleanup?.();
    updateSidebarContext('magic');
    rememberDestination('magic', options);
    let collection = read(COLLECTION_KEY);
    let decks = read(DECKS_KEY);
    let selectedDeck = decks[0]?.id || '';
    let collectionFilter = '';
    let room = (getSavedMinigameRoom()?.scope === 'magic' || getSavedMinigameRoom()?.data?.scope === 'magic') ? getSavedMinigameRoom() : null;
    let cardResults = [];
    let activeTab = options.tab || 'mazzi';
    let stopWatching = null;
    let pollTimer = null;
    let searchTimer = null;
    let cameraPhoto = '';
    let motionCleanup = null;
    let scannedCards = [];

    const cardSummary = card => ({ id: card.id, name: card.name, image: cardFace(card), manaCost: card.mana_cost || '', typeLine: card.type_line || '', oracleText: card.oracle_text || card.card_faces?.map(face => face.oracle_text).join('\n') || '', power: card.power ?? '', toughness: card.toughness ?? '', cmc: manaValue(card), colors: card.colors || [], colorIdentity: card.color_identity || [], commanderLegality: card.legalities?.commander || 'unknown', set: card.set_name || '', rarity: card.rarity || '' });
    const persist = () => { write(COLLECTION_KEY, collection); write(DECKS_KEY, decks); };
    const currentDeck = () => decks.find(deck => deck.id === selectedDeck) || null;
    const deckCards = deck => (deck?.cards || []).flatMap(entry => Array.from({ length: entry.quantity }, () => collection.find(card => card.id === entry.cardId)).filter(Boolean));
    const getCount = cardId => collection.find(card => card.id === cardId)?.quantity || 0;
    const setNotice = message => { const node = container.querySelector('#magic-notice'); if (node) node.textContent = message; };

    container.innerHTML = `<main class="magic-page">
      <div class="magic-back">${renderHomeBackButton({ id: 'magic-home' })}</div>
      <header class="magic-heading"><span class="crystal-eyebrow">IL TAVOLO DEI PLANESWALKER</span><h1>Magic: The Gathering</h1><p>La tua collezione, i tuoi mazzi, la prossima sfida.</p></header>
      <nav class="magic-tabs" aria-label="Sezioni Magic">
       <button data-tab="collezione" type="button">Collezione</button><button data-tab="mazzi" type="button">Mazzi</button><button data-tab="partita" type="button">Partita online</button>
      </nav>
      <p id="magic-notice" class="magic-notice" role="status" aria-live="polite"></p>
      <section data-panel="collezione" class="magic-panel"><div class="magic-panel-heading"><div><span class="magic-overline">ARCHIVIO PERSONALE</span><h2>La tua bacheca</h2><p>Scansiona carte o liste da immagini e PDF, poi conferma le carte trovate nel catalogo.</p></div><span class="magic-count" id="magic-collection-count"></span></div>
       <div class="magic-scan-box"><div class="magic-scan-icon" aria-hidden="true">⌕</div><div class="magic-scan-copy"><strong>Scansiona carte o un mazzo</strong><span>Carica foto, pagine scannerizzate o liste PDF. L’estrazione AI passa dal server Groq.</span></div><label class="magic-button" for="magic-photo">Scegli immagini o PDF</label><input id="magic-photo" type="file" accept="image/*,.pdf,application/pdf" multiple capture="environment" hidden></div>
       <div class="magic-search-row"><label class="magic-search"><span aria-hidden="true">⌕</span><input id="magic-search" type="search" placeholder="Cerca una carta nel catalogo…" autocomplete="off"><span class="magic-search-hint">Catalogo Scryfall</span></label></div><div id="magic-photo-preview"></div><div id="magic-search-results" class="magic-search-results" aria-live="polite"></div>
       <div class="magic-collection-head"><h3>Carte possedute</h3><label class="magic-search magic-collection-search"><span aria-hidden="true">⌕</span><input id="magic-filter" type="search" placeholder="Filtra per nome…"></label></div><div id="magic-collection" class="magic-card-grid"></div>
      </section>
      <section data-panel="mazzi" class="magic-panel"><div class="magic-panel-heading"><div><span class="magic-overline">COSTRUISCI LA TUA STRATEGIA</span><h2>I tuoi mazzi</h2><p>Organizza le carte presenti nella tua bacheca e prepara il duello.</p></div><button id="magic-new-deck" class="magic-button" type="button">＋ Crea un mazzo</button></div><div class="magic-deck-layout"><aside id="magic-deck-list" class="magic-deck-list"></aside><div id="magic-deck-editor" class="magic-deck-editor"></div></div></section>
      <section data-panel="partita" class="magic-panel"><div class="magic-panel-heading"><div><span class="magic-overline">GIOCA CON UN AMICO</span><h2>Il tuo tavolo</h2><p>Apri una stanza o inserisci il codice ricevuto dall’avversario.</p></div></div>
       <div class="magic-room-bar"><button id="magic-host" type="button" class="magic-button">Crea una partita</button><form id="magic-join-form" class="magic-join-form"><select id="magic-join-deck" aria-label="Scegli il mazzo con cui giocare">${decks.map(deck => `<option value="${esc(deck.id)}">${esc(deck.name)}</option>`).join('')}</select><input id="magic-room-code" maxlength="6" autocomplete="off" placeholder="CODICE STANZA" aria-label="Codice stanza"><button class="magic-button magic-button-secondary" type="submit">Entra</button></form></div>
       <div id="magic-room-status" class="magic-room-status">${room?.code ? `Stanza ${esc(room.code)} · ${room.status === 'connected' ? 'Avversario connesso' : 'In attesa di un avversario'}` : 'Nessuna partita attiva'}</div><div id="magic-table"></div>
       <p class="magic-rules-note"><strong>Due modalità:</strong> il tavolo qui sotto è ancora un prototipo con regole parziali. Per usare un motore di regole Commander, esporta il mazzo verso Manabrew/Forge: importa la lista, crea una stanza Commander e invita da 1 a 3 avversari. Alcune carte possono risultare non supportate nel motore scelto; controlla gli avvisi prima di giocare.</p>
      </section>
    </main>`;

    const render = () => {
        const joinDeck = container.querySelector('#magic-join-deck'); if (joinDeck) joinDeck.innerHTML = decks.map(deck => `<option value="${esc(deck.id)}">${esc(deck.name)}</option>`).join('');
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
        editor.innerHTML = `<div class="magic-deck-title"><div><span class="magic-overline">COMMANDER · LISTA DEL MAZZO</span><h3>${esc(deck.name)}</h3></div><button type="button" class="magic-text-button" id="magic-rename-deck">Rinomina</button><button type="button" class="magic-text-button danger" id="magic-delete-deck">Elimina mazzo</button></div><div class="magic-commander-picks"><label>Comandante<select data-commander-slot="0"><option value="">Scegli dalla raccolta…</option>${eligible.map(card=>`<option value="${esc(card.id)}" ${deck.commanders[0]===card.id?'selected':''}>${esc(card.name)} · ${esc(card.colorIdentity.join('')||'Incolore')}</option>`).join('')}</select></label><label>Secondo comandante partner<select data-commander-slot="1"><option value="">Nessuno</option>${eligibleSecond.map(card=>`<option value="${esc(card.id)}" ${deck.commanders[1]===card.id?'selected':''}>${esc(card.name)} · ${esc(card.colorIdentity.join('')||'Incolore')}</option>`).join('')}</select></label></div><div class="magic-deck-stats"><strong>${total}</strong><span>/ 100 carte</span><span class="magic-deck-hint">Comandanti inclusi; una copia per nome, eccetto terre base.</span></div><div class="magic-deck-validation ${validation.valid?'is-valid':'is-invalid'}">${validation.valid?'✓ Mazzo Commander valido.':validation.errors.slice(0,4).map(esc).join('<br>')}</div><div class="magic-deck-cards">${deck.cards.length ? deck.cards.map(entry => { const card = collection.find(item => item.id === entry.cardId); return card ? `<div class="magic-deck-row">${card.image ? `<img src="${esc(card.image)}" alt="">` : ''}<span>${esc(card.name)}<small>${esc(card.typeLine)}${deck.commanders.includes(card.id)?' · COMANDANTE':''}</small></span><strong>×${entry.quantity}</strong><button type="button" data-deck-remove="${esc(entry.cardId)}" aria-label="Rimuovi una copia di ${esc(card.name)}">−</button><button type="button" data-deck-add="${esc(card.id)}" aria-label="Aggiungi una copia di ${esc(card.name)}">＋</button></div>` : ''; }).join('') : '<p class="magic-muted">Questo mazzo è vuoto. Aggiungi carte dalla raccolta.</p>'}</div><div class="magic-deck-play-actions"><button id="magic-play" type="button" class="magic-button magic-button-secondary" ${!validation.valid ? 'disabled' : ''}>Prova il prototipo locale</button><button id="magic-full-rules" type="button" class="magic-button" ${!validation.valid ? 'disabled' : ''}>Apri Manabrew/Forge ↗</button></div><p class="magic-muted">La lista Commander viene copiata negli appunti; incollala nell’importatore del mazzo.</p>`;
    };
    const game = () => room?.data?.magic?.game || null;
    const myTurn = state => state?.activePlayer === playerId() && !state?.winner;
    const renderTable = () => {
        const root = container.querySelector('#magic-table'); if (!root) return;
        if (!room?.code) { root.innerHTML = ''; return; }
        const state = game(); const connected = isMinigameRoomConnected(room);
        if (!state) { const players=[...new Set([room.hostClientId,room.guestClientId,...(room.data?.magic?.participants||[])].filter(Boolean))]; const loadouts=room.data?.magic?.loadouts||{}; const ready=players.length>=2 && players.every(id=>loadouts[id]?.cards && validateCommanderDeck(loadouts[id].cards,loadouts[id].commanders||[]).valid); root.innerHTML = `<div class="magic-table-wait"><div class="magic-table-sigil">✧</div><div><strong>${players.length}/4 giocatori · ${connected ? 'Tavolo aperto' : 'In attesa del secondo giocatore'}</strong><p>${players.map((id,index)=>`${index===0?'Oste':`Giocatore ${index+1}`}${loadouts[id]?.cards?' · mazzo Commander pronto':' · deve confermare un mazzo legale'}`).join('<br>')}<br>${players.length<4?'La stanza resta aperta fino a 4 giocatori.':'Tavolo al completo.'}</p></div>${players.includes(playerId()) && !loadouts[playerId()] ? `<select id="magic-start-deck" aria-label="Scegli il mazzo">${decks.map(deck => `<option value="${esc(deck.id)}" ${selectedDeck === deck.id ? 'selected' : ''}>${esc(deck.name)} · ${deck.cards.reduce((n,c)=>n+c.quantity,0)} carte</option>`).join('')}</select><button id="magic-ready" class="magic-button" type="button" ${decks.length===0?'disabled':''}>Conferma mazzo</button>` : ''}${room.hostClientId===playerId() && players.length>=2 ? `<button id="magic-start" class="magic-button" type="button" ${!ready?'disabled':''}>${ready?'Inizia partita':'In attesa dei mazzi legali'}</button>` : ''}</div>`; return; }
        const myId = playerId(), opponentIds = state.players.filter(id => id !== myId && !state.playersData[id]?.eliminated);
        const ownState = state.playersData?.[myId] || { hand: [], battlefield: [], graveyard: [], library: [] };
        const isMyTurn = myTurn(state);
        const drawPile = cards => `<div class="magic-pile"><div class="magic-card-back">✧</div><span>${cards.length} nel grimorio</span></div>`;
        const renderBattlefield = (cards, mine) => cards.length ? cards.map((card, index) => `<button type="button" class="magic-board-card ${card.tapped ? 'is-tapped' : ''}" data-board-action="${mine ? 'tap' : 'none'}" data-board-index="${index}" title="${esc(card.name)} · ${esc(card.typeLine)}"><span class="magic-board-name">${esc(card.name)}</span><small>${esc(card.typeLine)}</small>${card.power !== '' ? `<b>${esc(card.power)}/${esc(card.toughness)}</b>` : ''}${card.tapped ? '<i>STANCATA</i>' : ''}</button>`).join('') : '<span class="magic-empty-board">Nessuna carta sul campo</span>';
        const commanders=ownState.commandZone||[];
        root.innerHTML = `<div class="magic-game-banner"><div><span class="magic-overline">COMMANDER · PARTITA IN CORSO · ${esc(room.code)} · ${state.players.length} GIOCATORI</span><strong>${state.winner?`Vittoria del giocatore ${state.players.indexOf(state.winner)+1}`:esc(state.turnName || 'Turno di gioco')}</strong><small>${state.winner?'Partita conclusa':`${isMyTurn ? 'È il tuo turno' : `Turno del giocatore ${state.players.indexOf(state.activePlayer)+1}`} · turno ${state.turn}`}</small></div><button type="button" class="magic-text-button" id="magic-concede">Abbandona</button></div><div class="magic-life-row"><div class="magic-life"><span>TE</span><strong>${ownState.life ?? 40}</strong><button type="button" data-life="-1" ${!isMyTurn?'disabled':''}>−</button><button type="button" data-life="1" ${!isMyTurn?'disabled':''}>＋</button></div>${opponentIds.map(id=>`<div class="magic-life-opponent"><span>GIOCATORE ${state.players.indexOf(id)+1}</span><strong>${state.playersData[id]?.life ?? 40}</strong><small>${state.playersData[id]?.hand?.length ?? 0} carte · comandante: ${Math.max(0,...Object.values(ownState.commanderDamage?.[id]||{}))}/21</small></div>`).join('')}</div><div class="magic-battlefield">${opponentIds.map(id=>{const foe=state.playersData[id]||{};return `<div class="magic-opponent-zone"><div class="magic-zone-label"><span>CAMPO · GIOCATORE ${state.players.indexOf(id)+1}</span>${drawPile(foe.library||[])}</div><div class="magic-board-cards">${renderBattlefield(foe.battlefield||[],false)}</div></div>`;}).join('')}<div class="magic-own-zone"><div class="magic-zone-label"><span>IL TUO CAMPO DI BATTAGLIA</span>${drawPile(ownState.library || [])}</div><div class="magic-board-cards">${renderBattlefield(ownState.battlefield || [], true)}</div></div></div>${commanders.length?`<section class="magic-command-zone"><span class="magic-zone-label">ZONA DI COMANDO</span><div class="magic-commanders">${commanders.map(card=>`<article class="magic-commander-card">${card.image?`<img src="${esc(card.image)}" alt="">`:''}<span><strong>${esc(card.name)}</strong><small>${(ownState.commanderCasts?.[card.id]||0)*2} mana extra · ${ownState.commanderCasts?.[card.id]||0} lanci</small></span><button type="button" data-cast-commander="${esc(card.id)}" ${!isMyTurn||state.winner?'disabled':''}>Lancia · ${esc(card.manaCost||'0')} + ${2*(ownState.commanderCasts?.[card.id]||0)}</button></article>`).join('')}</div></section>`:''}<div class="magic-game-actions"><button type="button" class="magic-button magic-button-secondary" id="magic-draw" ${!isMyTurn||state.winner?'disabled':''}>Pesca carta</button><select id="magic-attack-target" aria-label="Scegli il bersaglio dell’attacco" ${!isMyTurn||state.winner?'disabled':''}>${opponentIds.map((id)=>`<option value="${esc(id)}">Attacca giocatore ${state.players.indexOf(id)+1}</option>`).join('')}</select><button type="button" class="magic-button magic-button-secondary" id="magic-attack" ${!isMyTurn||state.winner?'disabled':''}>Attacca</button><button type="button" class="magic-button" id="magic-end-turn" ${!isMyTurn||state.winner?'disabled':''}>Termina il turno →</button></div><div class="magic-hand-heading"><span>LA TUA MANO</span><small>${ownState.hand.length} carte</small></div><div class="magic-hand">${(ownState.hand || []).map((card,index)=>`<article class="magic-hand-card" style="--card-index:${index}">${card.image?`<img src="${esc(card.image)}" alt="${esc(card.name)}">`:''}<div class="magic-hand-overlay"><strong>${esc(card.name)}</strong><small>${esc(card.manaCost || '—')} · ${esc(card.typeLine)}</small><button type="button" data-play-card="${index}" ${!isMyTurn||state.winner ? 'disabled' : ''}>${(card.typeLine||'').toLowerCase().includes('land') ? 'Gioca terra' : 'Lancia · ' + esc(card.manaCost || '0')}</button></div></article>`).join('') || '<p class="magic-muted">Nessuna carta in mano.</p>'}</div><p class="magic-muted magic-phase-help">Mana, priorità, fasi, blocchi, abilità e risoluzione degli effetti delle carte non sono ancora gestiti integralmente. Questo tavolo applica le verifiche Commander della lista, vita iniziale, zona di comando, tassa di rilancio e danno da comandante; resta un prototipo, non un arbitro completo delle regole.</p>`;
    };
    const saveState = async updater => {
        if (!room?.code) return;
        const result = await updateMinigameRoomData(room.code, data => ({ ...data, scope: 'magic', magic: { ...(data.magic || {}), game: updater(data.magic?.game || null) } }));
        if (result.error) { setNotice(`Non è stato possibile aggiornare la partita: ${result.error.message}`); return; }
        room = result.room || room; render();
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
    const createGame = async deck => {
        const hostId = playerId();
        const players = [...new Set([room.hostClientId, room.guestClientId, ...(room.data?.magic?.participants || [])].filter(Boolean))];
        if (players.length < 2 || players.length > 4) { setNotice('Per avviare la partita servono da 2 a 4 giocatori.'); return; }
        const loadouts = room.data?.magic?.loadouts || {};
        const playersData = {};
        for (const id of players) { const loadout=loadouts[id]; if (!loadout?.cards || !validateCommanderDeck(loadout.cards,loadout.commanders||[]).valid) { setNotice('Ogni giocatore deve confermare un mazzo Commander legale da 100 carte.'); return; } const commanders=(loadout.commanders||[]).map(commanderId=>loadout.cards.find(card=>card.id===commanderId));const cards=loadout.cards.filter(card=>!loadout.commanders.includes(card.id));for(let i=cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];} playersData[id]={hand:cards.splice(0,7),library:cards,battlefield:[],graveyard:[],commandZone:commanders,commanderCasts:{},commanderDamage:{},life:40,landsPlayed:0}; }
        const state = { version: 1, turn: 1, activePlayer: hostId, startingPlayer: hostId, players, playersData, log: [`Partita iniziata con ${players.length} giocatori`], turnName: 'Fase principale' };
        const result = await updateMinigameRoomData(room.code, data => ({ ...data, scope:'magic', magic: { ...(data.magic||{}), game: state } }));
        if (result.error) { setNotice(result.error.message); return; } room = result.room || room; render();
    };
    const refreshRoom = next => { if (next?.data?.scope !== 'magic' && next?.data?.magic === undefined) return; room = next; render(); };
    const watchRoom = next => {
        stopWatching?.(); if (pollTimer) clearInterval(pollTimer); stopWatching = null; pollTimer = null;
        if (!next?.code) return;
        stopWatching = watchMinigameRoom(next.code, refreshRoom);
        pollTimer = setInterval(async () => { const result = await getMinigameRoomByCode(room?.code); if (result.room) refreshRoom(result.room); }, 4000);
    };
    const ensureRoomScope = next => { room = { ...next, scope: 'magic' }; try { localStorage.setItem('taverna_minigame_room', JSON.stringify(room)); } catch {} watchRoom(room); render(); };

    container.querySelector('#magic-home').onclick = () => navigateTo('home');
    container.querySelectorAll('[data-tab]').forEach(button => button.onclick = () => { activeTab = button.dataset.tab; render(); container.querySelector(`[data-panel="${activeTab}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    container.querySelector('#magic-search').addEventListener('input', event => { clearTimeout(searchTimer); searchTimer = setTimeout(() => searchCards(event.target.value), 300); });
    container.querySelector('#magic-filter').addEventListener('input', event => { collectionFilter = event.target.value; renderCollection(); });
    const scanAndResolve = async files => {
        const preview = container.querySelector('#magic-photo-preview');
        preview.innerHTML = '<div class="magic-photo-card"><div><strong>Scansione in corso…</strong><span>Invio dei documenti a Groq per riconoscere nomi e quantità.</span></div></div>';
        try {
            const recognized = [];
            for (const file of files) recognized.push(...await scanMagicDocument(file, message => {
                const label = preview.querySelector('.magic-photo-card span'); if (label) label.textContent = message;
            }));
            const quantities = new Map();
            for (const card of recognized) quantities.set(card.name, (quantities.get(card.name) || 0) + card.quantity);
            const entries = [...quantities.entries()];
            if (!entries.length) throw new Error('Non ho riconosciuto carte. Prova con una scansione più nitida.');
            scannedCards = [];
            for (let index = 0; index < entries.length; index += 5) {
                const batch = await Promise.all(entries.slice(index, index + 5).map(async ([name, quantity]) => {
                    try {
                        const response = await fetch('https://api.scryfall.com/cards/named?fuzzy=' + encodeURIComponent(name), { headers: { Accept: 'application/json' } });
                        return response.ok ? { name, quantity, card: await response.json() } : { name, quantity, card: null };
                    } catch { return { name, quantity, card: null }; }
                }));
                scannedCards.push(...batch);
            }
            const found = scannedCards.filter(entry => entry.card);
            preview.innerHTML = '<div class="magic-photo-card"><div><strong>Riconosciute ' + found.length + ' carte su ' + entries.length + '</strong><span>Controlla nomi e quantità prima di aggiungerle alla bacheca.</span></div><button type="button" class="magic-button" id="magic-add-scanned" ' + (found.length ? '' : 'disabled') + '>Aggiungi tutte</button></div><div class="magic-scan-lines">' + scannedCards.map((entry, index) => '<div>' + esc(entry.name) + ' · ×' + entry.quantity + (entry.card ? ' → ' + esc(entry.card.name) : ' · non trovata nel catalogo') + '<button type="button" class="magic-text-button" data-scan-index="' + index + '" ' + (entry.card ? '' : 'disabled') + '>Aggiungi</button></div>').join('') + '</div>';
            preview.querySelector('#magic-add-scanned')?.addEventListener('click', () => {
                for (const entry of scannedCards) if (entry.card) addCollectionCard(entry.card, entry.quantity);
                scannedCards = []; preview.innerHTML = ''; setNotice('Carte riconosciute aggiunte alla bacheca.');
            });
            preview.querySelectorAll('[data-scan-index]').forEach(button => button.addEventListener('click', () => {
                const entry = scannedCards[Number(button.dataset.scanIndex)];
                if (entry?.card) { addCollectionCard(entry.card, entry.quantity); button.disabled = true; button.textContent = 'Aggiunta'; }
            }));
        } catch (error) {
            preview.innerHTML = '<div class="magic-photo-card"><div><strong>Scansione non riuscita</strong><span>' + esc(error.message) + ' Puoi cercare il nome manualmente.</span></div></div>';
        }
    };
    container.querySelector('#magic-photo').onchange = async event => {
        const files = [...(event.target.files || [])];
        if (files.length > 30) { setNotice('Puoi selezionare al massimo 30 immagini per volta.'); event.target.value = ''; return; }
        if (files.length) await scanAndResolve(files);
        event.target.value = '';
    };
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
    container.querySelector('#magic-deck-editor').onchange = event => {
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
    container.querySelector('#magic-host').onclick = async event => { const button=event.currentTarget;button.disabled=true;setNotice('Creo la stanza…'); const result=await createMinigameRoom();button.disabled=false; if(result.error){setNotice(result.unavailable?'Multiplayer non configurato. Verifica Supabase e lo schema minigame_rooms.':result.error.message);return;} const initialized=await updateMinigameRoomData(result.room.code, data=>({...data,scope:'magic',magic:{participants:[],loadouts:{}}}));if(initialized.error){setNotice(initialized.error.message);return;}ensureRoomScope(initialized.room);setNotice('Stanza pronta. Condividi il codice: da 2 a 4 giocatori.'); };
    container.querySelector('#magic-join-form').onsubmit = async event => { event.preventDefault(); const selected=decks.find(deck=>deck.id===container.querySelector('#magic-join-deck').value);if(!selected){setNotice('Crea un mazzo e aggiungilo alla tua bacheca prima di entrare.');return;}const cards=deckCards(selected).map(card=>({...card}));const validation=validateCommanderDeck(cards,selected.commanders||[]);if(!validation.valid){setNotice(validation.errors[0]);return;} const result=await joinMagicRoom(container.querySelector('#magic-room-code').value,{cards,commanders:selected.commanders||[],name:selected.name});if(result.error){setNotice(result.error.message);return;} ensureRoomScope(result.room);setNotice('Sei al tavolo.'); };
    container.querySelector('#magic-table').onclick = async event => {
        const state=game(); if(!state)return;
        if(event.target.closest('#magic-ready')) {const deck=decks.find(item=>item.id===container.querySelector('#magic-start-deck')?.value);if(!deck){setNotice('Crea prima un mazzo.');return;}const cards=deckCards(deck).map(card=>({...card}));const validation=validateCommanderDeck(cards,deck.commanders||[]);if(!validation.valid){setNotice(validation.errors[0]);return;}const loadout={cards,commanders:deck.commanders||[],name:deck.name};const result=await updateMinigameRoomData(room.code,data=>({...data,scope:'magic',magic:{...(data.magic||{}),loadouts:{...(data.magic?.loadouts||{}),[playerId()]:loadout}}}));if(result.error){setNotice(result.error.message);return;}room=result.room||room;render();return;}
        if(event.target.closest('#magic-start')) {if(room.hostClientId!==playerId())return;await createGame(null);return;}
        if(event.target.closest('#magic-concede')) {if(confirm('Abbandonare la partita?')){room=null;render();}return;}
        if(!myTurn(state))return;
        if(event.target.closest('#magic-draw')) { await saveState(current=>{const own=current.playersData[playerId()];if(!own.library.length)return current;own.hand.push(own.library.shift());current.log.unshift('Hai pescato una carta.');return current;});return; }
        if(event.target.closest('#magic-end-turn')) { await saveState(current=>{const currentIndex=current.players.indexOf(playerId());let step=1,nextId=current.players[(currentIndex+step)%current.players.length];while(current.playersData[nextId]?.eliminated&&step<current.players.length){step++;nextId=current.players[(currentIndex+step)%current.players.length];}for(const card of current.playersData[playerId()].battlefield)card.tapped=false;current.playersData[playerId()].landsPlayed=0;current.activePlayer=nextId;if(nextId===current.startingPlayer)current.turn++;current.turnName='Fase principale';const foe=current.playersData[nextId];if(foe){foe.battlefield.forEach(card=>{card.tapped=false;card.summoningSick=false;});if(foe.library.length)foe.hand.push(foe.library.shift());}current.log.unshift(`Inizia il turno di ${nextId===playerId()?'te':`Giocatore ${current.players.indexOf(nextId)+1}`}.`);return current;});return; }
        if(event.target.closest('[data-cast-commander]')) {const id=event.target.closest('[data-cast-commander]')?.dataset.castCommander;await saveState(current=>{const own=current.playersData[playerId()],index=own.commandZone.findIndex(card=>card.id===id);if(index<0)return current;const card=own.commandZone[index],tax=(own.commanderCasts[id]||0)*2,cost=(card.cmc||0)+tax,lands=own.battlefield.filter(item=>item.tapped&&(item.typeLine||'').toLowerCase().includes('land'));if(lands.length<cost){setNotice(`Per rilanciare il comandante servono ${cost} mana totali, tassa inclusa.`);return current;}own.commandZone.splice(index,1);own.commanderCasts[id]=(own.commanderCasts[id]||0)+1;own.battlefield.push({...card,tapped:false,summoningSick:true,isCommander:true});current.log.unshift(`${card.name} lanciato dalla zona di comando.`);return current;});return;}
        if(event.target.closest('#magic-attack')) {const target=container.querySelector('#magic-attack-target')?.value;if(!target)return;await saveState(current=>{const own=current.playersData[playerId()],foe=current.playersData[target];if(!foe)return current;const attackers=own.battlefield.filter(card=>!card.tapped&&!card.summoningSick&&(card.typeLine||'').toLowerCase().includes('creature'));const damage=attackers.reduce((sum,card)=>sum+(Number.parseInt(card.power,10)||0),0);attackers.forEach(card=>{card.tapped=true;if(card.isCommander){own.commanderDamage[target] ||= {};own.commanderDamage[target][card.id]=(own.commanderDamage[target][card.id]||0)+(Number.parseInt(card.power,10)||0);}});foe.life=Math.max(0,foe.life-damage);const commanderLethal=Object.values(own.commanderDamage[target]||{}).some(value=>value>=21);if(foe.life<=0||commanderLethal)foe.eliminated=true;const survivors=current.players.filter(id=>!current.playersData[id].eliminated);if(survivors.length===1)current.winner=survivors[0];current.log.unshift(`Attacco: ${damage} danni al giocatore ${current.players.indexOf(target)+1}${commanderLethal?' · 21 danni da comandante':''}.`);return current;});return;}
        const life=event.target.closest('[data-life]'); if(life){await saveState(current=>{current.playersData[playerId()].life=Math.max(0,current.playersData[playerId()].life+Number(life.dataset.life));return current;});return;}
        const board=event.target.closest('[data-board-action="tap"]'); if(board){await saveState(current=>{const card=current.playersData[playerId()].battlefield[Number(board.dataset.boardIndex)];if(card)card.tapped=!card.tapped;return current;});return;}
        const play=event.target.closest('[data-play-card]'); if(play){const index=Number(play.dataset.playCard);await saveState(current=>{const own=current.playersData[playerId()],card=own.hand[index];if(!card)return current;if((card.typeLine||'').toLowerCase().includes('land')){if(own.landsPlayed>=1)return current;own.landsPlayed++;own.hand.splice(index,1);own.battlefield.push({...card,tapped:false});current.log.unshift(`Hai giocato ${card.name}.`);}else{const cost=card.cmc||0;const available=own.battlefield.filter(item=>item.tapped && (item.typeLine||'').toLowerCase().includes('land')).length;if(available<cost){setNotice(`Mana insufficiente: ${card.name} costa ${cost}. Tappa le terre prima di lanciarla.`);return current;}own.battlefield.filter(item=>item.tapped && (item.typeLine||'').toLowerCase().includes('land')).slice(0,cost);own.hand.splice(index,1);if((card.typeLine||'').toLowerCase().includes('creature'))own.battlefield.push({...card,tapped:false,summoningSick:true});else own.graveyard.push(card);current.log.unshift(`Hai lanciato ${card.name}.`);}return current;});return;}
    };
    if(room?.code) watchRoom(room);
    motionCleanup=enhanceSurfaceMotion(container,{selector:'.magic-panel,.magic-scan-box,.magic-room-bar'});
    window.__magicCleanup=()=>{stopWatching?.();if(pollTimer)clearInterval(pollTimer);clearTimeout(searchTimer);motionCleanup?.();if(cameraPhoto)URL.revokeObjectURL(cameraPhoto);};
    render();
}
