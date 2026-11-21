import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { rememberDestination, navigateTo } from '../services/appNavigation.js';
import { renderCardSymbols } from '../services/cardSymbols.js';
import {
    createMinigameRoom, getMinigameClientId, getMinigameRoomByCode, getRoomParticipants,
    getSavedMagicRoom, isMinigameRoomConnected, joinMagicRoom, updateMinigameRoomData, watchMinigameRoom
} from '../services/minigameMultiplayer.js';
import { canPayMana, emptyManaPool, isManaSource, manaAbilityOptions, manaPoolLabel, manaProductionOptions, payMana } from './magicRules.js';
import {
    MATCH_RULES, PHASE_LABEL, adjustLife, advancePhase, castSpell, concedeMatch, createMatch,
    activateAbility, castResponse, declareAttackers, declareBlockers, discardCards, mulliganAction, passTurn,
    playLand, powerOf, resolveCombat, tapMana, toughnessOf
} from './magicMatchEngine.js';
import { abilityLabel, parseCardAbilities, textSupport } from './magicEffects.js';
import { showMatchTable } from '../match/table.js';
import { enterImmersive } from '../match/immersive.js';
import './magicPlay.css';

const COLLECTION_KEY = 'taverna_magic_collection_v1';
const DECKS_KEY = 'taverna_magic_decks_v1';
const DECK_CHOICE_KEY = 'taverna_magic_match_deck';
const CARD_CACHE_KEY = 'taverna_magic_card_details_v1';
const LEFT_ROOM_KEY = 'taverna_magic_room_left';
// I browser rallentano i timer delle schede in background fino a un minuto: una
// soglia troppo stretta farebbe sembrare assente un giocatore che sta solo
// guardando un'altra scheda.
const PRESENCE_TIMEOUT = 120000;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const read = key => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
const isCreature = card => /\bcreature\b/i.test(card?.typeLine || '');
const isLand = card => /\bland\b/i.test(card?.typeLine || '');

const cardArt = card => card?.image ? `<img src="${esc(card.image)}" alt="" loading="lazy">` : '<span class="mp-card-fallback" aria-hidden="true">Senza immagine</span>';

// La grafica della carta è un pulsante: toccandola si apre la carta in grande.
const zoomableArt = card => `<button type="button" class="mp-card-art" data-zoom="${esc(card?.uid || '')}" aria-label="Ingrandisci ${esc(card?.name || 'carta')}">${cardArt(card)}</button>`;

// Il visualizzatore salva solo i dati che servono a leggere le carte: forza,
// costituzione e parole chiave arrivano da Scryfall una volta sola e restano
// in cache, così il tavolo non deve richiederle a ogni turno.
async function hydrateCards(cards) {
    let cache = {};
    try { cache = JSON.parse(localStorage.getItem(CARD_CACHE_KEY) || '{}'); } catch { cache = {}; }
    // Le voci salvate prima di questa versione non hanno l'immagine: vanno richieste
    // una volta, così il tavolo mostra la grafica della carta e non un riquadro vuoto.
    const missing = cards.filter(card => {
        const hit = cache[card.id];
        return !hit || hit.image === undefined || (card.power === undefined || !Array.isArray(card.keywords));
    });
    const ids = [...new Set(missing.map(card => card.id))];
    for (let offset = 0; offset < ids.length; offset += 75) {
        const identifiers = ids.slice(offset, offset + 75).map(id => ({ id }));
        try {
            const response = await fetch('https://api.scryfall.com/cards/collection', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifiers })
            });
            if (!response.ok) continue;
            const payload = await response.json();
            for (const card of payload.data || []) {
                cache[card.id] = {
                    power: card.power ?? '', toughness: card.toughness ?? '', keywords: card.keywords || [],
                    colors: card.colors || [], colorIdentity: card.color_identity || [],
                    producedMana: card.produced_mana || [], cmc: card.cmc || 0,
                    typeLine: card.type_line || '', manaCost: card.mana_cost || '',
                    oracleText: card.oracle_text || '', name: card.name,
                    image: card.image_uris?.normal || card.image_uris?.large
                        || card.card_faces?.[0]?.image_uris?.normal || ''
                };
            }
            localStorage.setItem(CARD_CACHE_KEY, JSON.stringify(cache));
        } catch {
            // Senza rete si gioca con i dati già salvati; le carte senza forza
            // e costituzione restano 0/0 e vanno gestite a mano al tavolo.
        }
    }
    return cards.map(card => {
        const details = cache[card.id] || {};
        return {
            ...card,
            power: card.power ?? details.power ?? '',
            toughness: card.toughness ?? details.toughness ?? '',
            keywords: card.keywords?.length ? card.keywords : details.keywords || [],
            colors: card.colors?.length ? card.colors : details.colors || [],
            colorIdentity: card.colorIdentity?.length ? card.colorIdentity : details.colorIdentity || [],
            cmc: card.cmc || details.cmc || 0,
            oracleText: card.oracleText || details.oracleText || '',
            typeLine: card.typeLine || details.typeLine || '',
            manaCost: card.manaCost || details.manaCost || '',
            image: card.image || details.image || ''
        };
    });
}

export function showMagicPlay(container, options = {}) {
    window.__magicCleanup?.();
    window.__magicPlayCleanup?.();
    updateSidebarContext('magic');
    rememberDestination('magicPlay', {});

    const clientId = getMinigameClientId();
    const collection = new Map(read(COLLECTION_KEY).map(card => [String(card.id), card]));
    let decks = read(DECKS_KEY);
    // Il mazzo ricordato può non esistere più: senza questo controllo la tendina ne
    // mostrerebbe un altro e i comandi di avvio cercherebbero un mazzo fantasma.
    const savedChoice = options.deck || localStorage.getItem(DECK_CHOICE_KEY) || '';
    let chosenDeck = decks.some(deck => deck.id === savedChoice) ? savedChoice : (decks[0]?.id || '');
    // Una stanza lasciata non deve riaprirsi da sola: la copia salvata resta finché
    // un aggiornamento in ritardo non la sostituisce, quindi la ricordiamo per codice.
    const savedRoom = getSavedMagicRoom()?.data?.scope === 'magic' ? getSavedMagicRoom() : null;
    const leftCode = localStorage.getItem(LEFT_ROOM_KEY);
    let room = savedRoom && savedRoom.code !== leftCode ? savedRoom : null;
    if (savedRoom && !room) localStorage.removeItem('taverna_magic_room');
    let notice = '';
    let busy = false;
    let disposed = false;
    // Dopo «Lascia il tavolo» le risposte in arrivo non devono riportare dentro la partita.
    let detached = false;
    let stopWatch = null;
    let pollTimer = null;
    let botMode = false;
    let localGame = null;
    let botTimer = null;
    let selectedAttackers = new Set();
    let selectedDiscards = new Set();
    // Il tavolo si ridisegna a ogni aggiornamento della stanza (anche solo per il
    // battito di presenza): il bersaglio scelto resta, e sparisce solo quando
    // quella carta non è più un'opzione valida.
    let chosenTarget = '';
    // Aggiornamento immediato quando la finestra torna in primo piano: i browser
    // rallentano i timer delle schede nascoste e il tavolo sembrerebbe fermo.
    let syncNow = () => {};

    const idOf = item => item?.instanceId || item?.uid || '';
    const state = () => botMode ? localGame : (room?.data?.magic?.game || null);
    const loadouts = () => room?.data?.magic?.loadouts || {};
    const participants = () => botMode ? [clientId, 'bot'] : (room ? getRoomParticipants(room) : []);
    const label = id => (id === clientId ? 'Tu' : `Giocatore ${participants().indexOf(id) + 1}`);
    // Il nome salvato nello stato è neutro: ognuno deve leggere «Tu» solo per sé.
    const nameOf = id => (id === clientId ? 'Tu' : (gameState()?.playerNames?.[id] || label(id)));
    const gameState = () => state();
    const myData = () => gameState()?.playersData?.[clientId] || null;
    const isMyTurn = () => {
        const current = gameState();
        return Boolean(current && !current.mulliganActive && !current.winner && current.activePlayer === clientId);
    };
    // Due tipi di avviso: 'move' è l'esito di un tentativo (mana insufficiente,
    // carta non giocabile, partita cambiata) e sparisce da solo dopo qualche
    // secondo; 'status' è una situazione (connessione interrotta, attesa degli
    // altri, mazzo confermato) e resta finché qualcosa non la sostituisce,
    // altrimenti si perde proprio l'informazione che serve.
    const NOTICE_MOVE = 'move';
    const NOTICE_TTL = 6000;
    let noticeTimer = 0;
    let noticeKind = 'status';
    const clearMoveNotice = () => {
        if (noticeKind !== NOTICE_MOVE) return;
        clearTimeout(noticeTimer);
        notice = '';
        noticeKind = 'status';
    };
    const setNotice = (message, kind = 'status') => {
        notice = message || '';
        noticeKind = notice ? kind : 'status';
        const node = container.querySelector('#play-notice');
        if (node) node.textContent = notice;
        clearTimeout(noticeTimer);
        if (noticeKind !== NOTICE_MOVE) return;
        noticeTimer = setTimeout(() => {
            clearMoveNotice();
            const current = container.querySelector('#play-notice');
            if (current) current.textContent = '';
        }, NOTICE_TTL);
    };
    const deckCards = deck => (deck?.cards || [])
        .map(entry => ({ ...collection.get(String(entry.cardId)), quantity: Math.max(0, Number(entry.quantity) || 0) }))
        .filter(card => card.id && card.quantity > 0);

    const deckCheck = deck => {
        // Espande le quantità in copie fisiche, come fa il motore di partita.
        const expanded = [];
        for (const entry of deck?.cards || []) {
            const card = collection.get(String(entry.cardId));
            if (!card) continue;
            const quantity = Math.max(0, Number(entry.quantity) || 0);
            for (let i = 0; i < quantity; i += 1) expanded.push({ ...card });
        }
        const commanderCards = (deck?.commanders || [])
            .map(id => collection.get(String(id)))
            .filter(Boolean)
            .map(card => ({ ...card }));
        const allCards = [...expanded, ...commanderCards];
        const errors = [];
        if ((deck?.commanders || []).length < 1) errors.push('Scegli almeno un comandante nel mazzo.');
        if (allCards.length !== 100) errors.push(`Il mazzo deve contenere esattamente 100 carte, comandanti inclusi (ora ${allCards.length}).`);
        const counts = new Map();
        for (const card of allCards) counts.set(card.name, (counts.get(card.name) || 0) + 1);
        for (const [name, count] of counts) {
            const sample = allCards.find(card => card.name === name);
            const isBasic = /\bbasic\b/i.test(sample?.typeLine || '') && /\bland\b/i.test(sample?.typeLine || '');
            const dupAllowed = /a deck can have any number of cards named/i.test(sample?.oracleText || '');
            if (count > 1 && !isBasic && !dupAllowed) errors.push(`${name}: in Commander è consentita una sola copia, eccetto le terre base.`);
        }
        // Identità di colore: ogni carta deve essere un sottoinsieme dei colori del comandante.
        const commanderColors = new Set(commanderCards.flatMap(card => card?.colorIdentity || card?.colors || []));
        if (commanderColors.size > 0) {
            const outOfIdentity = new Set();
            for (const card of allCards) {
                const cardColors = card?.colorIdentity || card?.colors || [];
                if (cardColors.some(color => !commanderColors.has(color))) outOfIdentity.add(card.name);
            }
            for (const name of outOfIdentity) errors.push(`${name}: identità di colore fuori dai colori del comandante.`);
        }
        const total = allCards.length;
        return { valid: errors.length === 0, errors: [...new Set(errors)], total };
    };

    const persistRoom = next => {
        if (detached || !next || next.data?.scope !== 'magic') return;
        room = next;
        try { localStorage.setItem('taverna_magic_room', JSON.stringify(next)); } catch { /* storage pieno o bloccato */ }
    };

    const humansPresent = () => {
        const magic = room?.data?.magic;
        return participants().every(id => Date.now() - (magic?.presence?.[id] || 0) < PRESENCE_TIMEOUT);
    };
    // L'assenza di un avversario non blocca più la mossa: la partita resta
    // sincronizzata dalla revisione, e chi resta al tavolo può continuare a
    // giocare il proprio turno anche se l'altro ha la scheda in secondo piano.
    const warnIfSomeoneAway = () => {
        if (!humansPresent()) setNotice('Un giocatore non dà segni di vita da un po’: la partita resta aperta e riprende quando torna.');
    };

    async function commit(updater) {
        if (botMode) {
            if (busy || disposed || !localGame) return false;
            busy = true;
            try {
                const next = updater(structuredClone(localGame));
                next.revision = (localGame.revision || 0) + 1;
                localGame = next;
                // La mossa è passata: l'avviso del tentativo precedente non serve più.
                clearMoveNotice();
                render();
                scheduleBotIfNeeded();
                return true;
            } catch (error) {
                setNotice(error.message || 'Mossa non valida.', NOTICE_MOVE);
                return false;
            } finally {
                busy = false;
            }
        }
        if (!room?.code || busy || disposed) return false;
        busy = true;
        warnIfSomeoneAway();
        // Nessun confronto con la revisione vista a schermo: la mossa può arrivare
        // mentre l'altro giocatore ha appena risposto. updateMinigameRoomData
        // rilegge la stanza e riapplica la funzione sullo stato più recente, e il
        // motore rifiuta da solo una mossa che non è più valida (carta sparita,
        // turno cambiato). Bloccarla qui perderebbe una mossa legittima.
        // Solo un rifiuto del motore (regola non rispettata) riguarda questo
        // tentativo: un guasto di scrittura o di rete deve restare sul tavolo.
        // Il flag serve perché entrambi possono arrivare come result.error
        // oppure come eccezione, e il messaggio da solo non li distingue.
        let engineRejected = false;
        try {
            const result = await updateMinigameRoomData(room.code, data => {
                const current = data.magic?.game;
                if (!current) throw new Error('La partita non è più attiva.');
                let next;
                try {
                    next = updater(structuredClone(current));
                } catch (error) {
                    engineRejected = true;
                    throw error;
                }
                next.revision = (current.revision || 0) + 1;
                return { ...data, magic: { ...data.magic, game: next, presence: { ...data.magic.presence, [clientId]: Date.now() } } };
            });
            if (result.error) {
                setNotice(result.error.message, engineRejected ? NOTICE_MOVE : 'status');
                return false;
            }
            persistRoom(result.room);
            // La mossa è andata a buon fine: l'avviso della mossa precedente non serve più.
            setNotice('');
            render();
            return true;
        } catch (error) {
            setNotice(error.message || 'Connessione interrotta: la mossa non è stata salvata.', engineRejected ? NOTICE_MOVE : 'status');
            return false;
        } finally {
            busy = false;
        }
    }

    function refreshRoom(next) {
        if (disposed || detached || !next || next.code !== room?.code || next.data?.scope !== 'magic') return;
        if (room?.updatedAt && next.updatedAt < room.updatedAt) return;
        const beforeGame = gameState();
        const beforeStatus = room?.status;
        persistRoom(next);
        const afterGame = gameState();
        if (!beforeGame || !afterGame || beforeGame.revision !== afterGame.revision || next.status !== beforeStatus) render();
        if (afterGame) warnIfSomeoneAway();
    }

    function watch(next) {
        stopWatch?.();
        clearInterval(pollTimer);
        stopWatch = null;
        pollTimer = null;
        if (!next?.code) return;
        const code = next.code;
        if (next.status === 'closed') return;
        let polling = false, lastBeat = 0;
        stopWatch = watchMinigameRoom(code, refreshRoom);
        const tick = async () => {
            if (polling || disposed || busy || room?.code !== code) return;
            polling = true;
            try {
                const writing = Date.now() - lastBeat > 10000;
                const heartbeat = writing
                    ? await updateMinigameRoomData(code, data => {
                        if (!data.magic) return data;
                        return { ...data, magic: { ...data.magic, presence: { ...data.magic.presence, [clientId]: Date.now() } } };
                    })
                    : await getMinigameRoomByCode(code);
                // Il battito di presenza non deve coprire il tavolo con «La stanza
                // è cambiata»: se il suo invio perde la corsa con una mossa, la
                // mossa è comunque salva e il prossimo giro rimanda il battito.
                if (heartbeat.error) {
                    if (!writing) setNotice(heartbeat.error.message);
                    return;
                }
                if (writing) lastBeat = Date.now();
                refreshRoom(heartbeat.room);
            } catch {
                setNotice('Connessione interrotta. Riconnessione in corso…');
            } finally {
                polling = false;
            }
        };
        void tick();
        pollTimer = setInterval(tick, 2800);
        syncNow = () => { if (!polling) void tick(); };
    }

    async function connect(mode, code = '') {
        if (busy) return;
        busy = true;
        setNotice(mode === 'create' ? 'Creo il collegamento…' : 'Entro nella stanza…');
        render();
        try {
            const deck = decks.find(item => item.id === chosenDeck);
            const cards = deck ? await hydrateCards(deckCards(deck)) : null;
            const commanderCards = deck?.commanders?.length ? await hydrateCards(deck.commanders.map(id => collection.get(String(id))).filter(Boolean)) : [];
            const loadout = cards && deckCheck(deck).valid ? { name: deck.name, cards, commanders: commanderCards } : null;
            const result = mode === 'create'
                ? await createMinigameRoom({ scope: 'magic' })
                : await joinMagicRoom(code, loadout);
            if (result.error || !result.room) { setNotice(result.error?.message || 'Collegamento non riuscito.'); return; }
            let next = result.room;
            if (mode === 'create' && loadout) {
                const saved = await updateMinigameRoomData(next.code, data => ({
                    ...data, magic: { ...(data.magic || {}), loadouts: { ...(data.magic?.loadouts || {}), [clientId]: loadout } }
                }));
                if (!saved.error && saved.room) next = saved.room;
            }
            detached = false;
            localStorage.removeItem(LEFT_ROOM_KEY);
            persistRoom({ ...next, scope: 'magic' });
            setNotice(`Collegamento attivo · codice ${next.code}.`);
            watch(room);
            render();
        } catch (error) {
            setNotice(error.message || 'Collegamento non riuscito.');
        } finally {
            busy = false;
            render();
        }
    }

    async function confirmDeck() {
        if (!room?.code || busy) return;
        const deck = decks.find(item => item.id === chosenDeck);
        if (!deck) { setNotice('Scegli un mazzo dalla sezione Mazzi.'); return; }
        const check = deckCheck(deck);
        if (!check.valid) { setNotice(check.errors[0]); return; }
        busy = true;
        setNotice('Preparo il mazzo…');
        try {
            const cards = await hydrateCards(deckCards(deck));
            const commanderCards = deck?.commanders?.length ? await hydrateCards(deck.commanders.map(id => collection.get(String(id))).filter(Boolean)) : [];
            const result = await updateMinigameRoomData(room.code, data => ({
                ...data,
                magic: {
                    ...(data.magic || {}),
                    loadouts: { ...(data.magic?.loadouts || {}), [clientId]: { name: deck.name, cards, commanders: commanderCards } },
                    presence: { ...(data.magic?.presence || {}), [clientId]: Date.now() }
                }
            }));
            if (result.error) { setNotice(result.error.message); return; }
            persistRoom(result.room);
            localStorage.setItem(DECK_CHOICE_KEY, deck.id);
            setNotice('Mazzo confermato. Attendi gli altri giocatori.');
        } catch (error) {
            setNotice(error.message || 'Non riesco a preparare il mazzo.');
        } finally {
            busy = false;
            render();
        }
    }

    async function startMatch() {
        if (!room?.code || busy) return;
        const order = participants();
        const ready = loadouts();
        if (order.length < 2) { setNotice('Serve almeno un altro giocatore collegato.'); return; }
        const missing = order.filter(id => !ready[id]?.cards?.length);
        if (missing.length) { setNotice(`Manca il mazzo di ${missing.map(label).join(', ')}.`); return; }
        busy = true;
        await enterImmersive(document.documentElement);
        setNotice('Distribuisco le carte…');
        try {
            const match = createMatch({
                players: order.map(id => ({ id, name: `Giocatore ${order.indexOf(id) + 1}`, cards: ready[id].cards, commanders: ready[id].commanders || [] }))
            });
            const result = await updateMinigameRoomData(room.code, data => ({
                ...data,
                magic: { ...(data.magic || {}), game: match, presence: { ...(data.magic?.presence || {}), [clientId]: Date.now() } }
            }));
            if (result.error) { setNotice(result.error.message); return; }
            persistRoom(result.room);
            selectedAttackers = new Set();
            selectedDiscards = new Set();
            setNotice('Partita avviata.');
        } catch (error) {
            setNotice(error.message || 'Avvio non riuscito.');
        } finally {
            busy = false;
            render();
        }
    }

    async function returnToLobby() {
        if (!room?.code || busy) return;
        busy = true;
        try {
            const result = await updateMinigameRoomData(room.code, data => {
                const magic = { ...(data.magic || {}) };
                delete magic.game;
                return { ...data, magic: { ...magic, presence: { ...(magic.presence || {}), [clientId]: Date.now() } } };
            });
            if (result.error) { setNotice(result.error.message); return; }
            persistRoom(result.room);
            setNotice('Tavolo di nuovo in attesa: confermate i mazzi e l’oste riavvia con «Avvia match».');
        } catch (error) {
            setNotice(error.message || 'Non riesco a riaprire la sala d’attesa.');
        } finally {
            busy = false;
            render();
        }
    }

    async function leaveRoom() {
        if (botMode) {
            botMode = false;
            localGame = null;
            if (botTimer) { clearTimeout(botTimer); botTimer = null; }
            busy = false;
            setNotice('Hai lasciato il tavolo.');
            render();
            return;
        }
        if (!room?.code) return;
        if (gameState() && !gameState().winner && !window.confirm('Lasciare il tavolo? La partita resta agli altri giocatori.')) return;
        detached = true;
        busy = true;
        try {
            if (gameState() && !gameState().winner) {
                await updateMinigameRoomData(room.code, data => {
                    if (!data.magic?.game || data.magic.game.winner) throw new Error('La partita è già conclusa.');
                    return { ...data, magic: { ...data.magic, game: { ...concedeMatch(data.magic.game, clientId), revision: (data.magic.game.revision || 0) + 1 } } };
                });
            }
            await updateMinigameRoomData(room.code, data => {
                const magic = data.magic || {};
                const nextParticipants = (magic.participants || []).filter(id => id !== clientId);
                const nextLoadouts = { ...(magic.loadouts || {}) };
                delete nextLoadouts[clientId];
                return { ...data, magic: { ...magic, participants: nextParticipants, loadouts: nextLoadouts } };
            });
        } catch { /* la stanza può essere già chiusa */ }
        localStorage.setItem(LEFT_ROOM_KEY, room.code);
        localStorage.removeItem('taverna_magic_room');
        stopWatch?.(); clearInterval(pollTimer); stopWatch = null; pollTimer = null;
        room = null; busy = false;
        setNotice('Hai lasciato il tavolo.');
        render();
    }

    function scheduleBotIfNeeded() {
        if (!botMode || disposed) return;
        if (botTimer) { clearTimeout(botTimer); botTimer = null; }
        const current = localGame;
        if (!current || current.winner) return;
        if (current.mulliganActive) {
            if (!current.playersData?.[BOT_ID]?.keptHand) botTimer = setTimeout(() => botMulliganChoice(), 350);
            return;
        }
        // In attesa dei blocchi: li dichiara il bot se è lui il difensore,
        // altrimenti si aspetta la mossa del giocatore senza fare polling.
        if (current.phase === 'combat' && current.combat?.step === 'blockers') {
            if (current.combat.defender === BOT_ID) botTimer = setTimeout(() => botBlock(), 350);
            return;
        }
        // Un turno da finire, anche ripreso dopo che il giocatore ha dichiarato i blocchi.
        if (current.activePlayer === BOT_ID) botTimer = setTimeout(() => botTurn(), 450);
    }

    function botBlock() {
        if (!botMode || disposed || busy) return;
        try {
            const current = structuredClone(localGame);
            const combat = current.combat;
            const defenderData = current.playersData[BOT_ID];
            const blockerCandidates = defenderData.battlefield.filter(card => isCreature(card) && !card.tapped);
            const assignments = {};
            const used = new Set();
            const attackers = (combat.attackerIds || []).map(uid => {
                const ownerId = current.players.find(id => (current.playersData[id]?.battlefield || []).some(card => idOf(card) === uid));
                const card = ownerId ? (current.playersData[ownerId]?.battlefield || []).find(item => idOf(item) === uid) : null;
                return { uid, card };
            });
            for (const att of attackers) {
                if (!att.card) continue;
                let best = null;
                for (const blk of blockerCandidates) {
                    if (used.has(idOf(blk))) continue;
                    const blkTough = toughnessOf(blk);
                    const attPow = powerOf(att.card);
                    const blkPow = powerOf(blk);
                    const attTough = toughnessOf(att.card);
                    if (blkTough > attPow || blkPow >= attTough) {
                        if (!best || powerOf(blk) < powerOf(best)) best = blk;
                    }
                }
                if (best) {
                    assignments[att.uid] = idOf(best);
                    used.add(idOf(best));
                }
            }
            const next = declareBlockers(current, BOT_ID, assignments);
            next.revision = (localGame.revision || 0) + 1;
            localGame = next;
            render();
            scheduleBotIfNeeded();
        } catch (error) { setNotice(error.message || 'Blocco bot non riuscito.'); }
    }

    // Il turno del bot è una macchina a stati: si ferma quando serve una mossa del
    // giocatore (i blocchi) e riparte da dove era, invece di rifare tutto da capo.
    const BOT_ID = 'bot';

    // Tappa le fonti di mana (terre, artefatti, creature) che aiutano a lanciare
    // le magie in mano: preferisce le fonti non-creatura, per non sprecare un
    // attaccante, e tappa solo se serve davvero mana per una magia non lanciabile.
    function botTapManaSources(current) {
        let next = current;
        for (let outer = 0; outer < 12; outer += 1) {
            const player = next.playersData[BOT_ID];
            const uncastable = player.hand.filter(card => !isLand(card) && !canPayMana(player.manaPool, card.manaCost || ''));
            if (!uncastable.length) break;
            const hasHaste = card => (card?.keywords || []).some(k => String(k).toLowerCase() === 'haste') || /\bhaste\b/i.test(card?.oracleText || '');
            const usable = card => isManaSource(card, player.colorIdentity || [])
                && !card.tapped
                && !(isCreature(card) && card.summoningSick && !hasHaste(card));
            const candidates = player.battlefield
                .filter(card => usable(card))
                .sort((a, b) => (isCreature(a) ? 1 : 0) - (isCreature(b) ? 1 : 0));
            let tapped = false;
            for (const source of candidates) {
                const abilities = manaAbilityOptions(source, player.colorIdentity || []);
                const options = manaProductionOptions(source, player.colorIdentity || []);
                if (!abilities.length || !options.length) continue;
                // Simula il tap prima di farlo davvero: evita di sprecare una fonte.
                let helpful = false;
                for (let i = 0; i < options.length; i += 1) {
                    const paid = payMana(player.manaPool, abilities[i].cost);
                    if (!paid) continue;
                    const simulated = { ...paid };
                    for (const color of options[i]) simulated[color] = (simulated[color] || 0) + 1;
                    if (uncastable.some(card => canPayMana(simulated, card.manaCost || ''))) { helpful = true; break; }
                }
                if (!helpful) continue;
                try {
                    next = tapMana(next, BOT_ID, idOf(source), 'auto');
                    tapped = true;
                    break;
                } catch { /* fonte già tappata o non attivabile */ }
            }
            if (!tapped) break;
        }
        return next;
    }

    function botPlayLandAndSpells(current) {
        let next = current;
        const player = () => next.playersData[BOT_ID];
        if (player().landsPlayed < 1) {
            const landCard = player().hand.find(isLand);
            if (landCard) { try { next = playLand(next, BOT_ID, landCard.uid); } catch { /* terra non giocabile */ } }
        }
        // Attiva le abilità di mana disponibili prima di lanciare, per sfruttare
        // anche artefatti e creature mana, non solo le terre.
        next = botTapManaSources(next);
        // Lancia prima i comandanti dalla zona di comando, se possibile.
        for (let guard = 0; guard < 4; guard += 1) {
            const cmd = (player().commandZone || [])[0];
            if (!cmd) break;
            try { next = castSpell(next, BOT_ID, cmd.uid, ''); } catch { break; }
            next = botTapManaSources(next);
        }
        // Dal costo più alto al più basso: sfrutta tutta la mana disponibile.
        for (let guard = 0; guard < 12; guard += 1) {
            const candidates = player().hand
                .filter(card => !isLand(card))
                .sort((a, b) => (Number(b.cmc) || 0) - (Number(a.cmc) || 0));
            const castable = candidates.find(card => {
                try { next = castSpell(next, BOT_ID, card.uid, ''); return true; } catch { return false; }
            });
            if (!castable) break;
        }
        return next;
    }

    function botMulliganChoice() {
        const data = localGame?.playersData?.[BOT_ID];
        if (!data || data.keptHand) return;
        const lands = data.hand.filter(isLand).length;
        const mulligans = data.mulligans || 0;
        let next = structuredClone(localGame);
        try {
            if ((lands < 2 || lands > 5) && mulligans < 2) {
                next = mulliganAction(next, BOT_ID, 'redraw');
            } else {
                // Se il mulligan non è gratuito, bisogna mettere in fondo le carte peggiori.
                const needed = Math.max(0, next.playersData[BOT_ID].cardsToBottom || 0);
                if (needed > 0) {
                    const hand = next.playersData[BOT_ID].hand;
                    const order = [...hand.keys()]
                        .sort((a, b) => (isLand(hand[b]) ? 1 : 0) - (isLand(hand[a]) ? 1 : 0) || (Number(hand[a].cmc) || 0) - (Number(hand[b].cmc) || 0))
                        .slice(0, needed);
                    for (const index of order) next = mulliganAction(next, BOT_ID, 'select', index);
                }
                next = mulliganAction(next, BOT_ID, 'keep');
            }
        } catch {
            try { next = mulliganAction(next, BOT_ID, 'keep'); } catch { /* mano già tenuta */ }
        }
        next.revision = (localGame.revision || 0) + 1;
        localGame = next;
        render();
        scheduleBotIfNeeded();
    }

    function botTurn() {
        if (!botMode || disposed || !localGame) return;
        busy = true;
        try {
            let current = structuredClone(localGame);
            if (current.mulliganActive || current.winner || current.activePlayer !== BOT_ID) {
                busy = false;
                scheduleBotIfNeeded();
                return;
            }
            for (let guard = 0; guard < 6 && current.activePlayer === BOT_ID && !current.winner; guard += 1) {
                if (current.phase === 'main1' || current.phase === 'main2') {
                    current = botPlayLandAndSpells(current);
                    current = advancePhase(current, BOT_ID);
                    continue;
                }
                if (current.phase === 'combat') {
                    if (!current.combat) {
                        const attackers = current.playersData[BOT_ID].battlefield
                            .filter(card => isCreature(card) && !card.tapped && !card.summoningSick)
                            .map(card => idOf(card));
                        const opponents = current.players.filter(id => id !== BOT_ID && !current.playersData[id]?.eliminated);
                        try { current = declareAttackers(current, BOT_ID, attackers, opponents[0] || ''); }
                        catch { current = advancePhase(current, BOT_ID); }
                        continue;
                    }
                    // Gli attaccanti aspettano i blocchi del giocatore: si riprende dopo.
                    if (current.combat.step === 'blockers') break;
                    if (current.combat.step === 'damage') {
                        current = resolveCombat(current, BOT_ID);
                        if (current.winner) break;
                        // Il danno segnato va reso visibile: proseguendo nello stesso
                        // ciclo, la pulizia di inizio turno lo azzerava prima del
                        // render e l'animazione sulla carta non partiva mai.
                        break;
                    }
                    current = advancePhase(current, BOT_ID);
                    continue;
                }
                if (current.phase === 'end') {
                    const hand = current.playersData[BOT_ID].hand;
                    const overflow = hand.length - 7;
                    if (overflow > 0) {
                        // Scarta prima le terre di troppo, poi le carte più economiche.
                        const uids = [...hand]
                            .sort((a, b) => (isLand(b) ? 1 : 0) - (isLand(a) ? 1 : 0) || (Number(a.cmc) || 0) - (Number(b.cmc) || 0))
                            .slice(0, overflow)
                            .map(card => card.uid);
                        try { current = discardCards(current, BOT_ID, uids); } catch { /* scarto non necessario */ }
                    }
                    current = advancePhase(current, BOT_ID);
                    continue;
                }
                break;
            }
            current.revision = (localGame.revision || 0) + 1;
            localGame = current;
            render();
        } catch (error) {
            setNotice(error.message || 'Turno bot non riuscito.');
        } finally {
            busy = false;
            scheduleBotIfNeeded();
        }
    }

    async function startBotMatch() {
        if (busy) return;
        const deck = decks.find(item => item.id === chosenDeck);
        if (!deck) { setNotice('Scegli un mazzo dalla sezione Mazzi.'); return; }
        const check = deckCheck(deck);
        if (!check.valid) { setNotice(check.errors[0]); return; }
        busy = true;
        await enterImmersive(document.documentElement);
        setNotice('Preparo il mazzo…');
        try {
            const cards = await hydrateCards(deckCards(deck));
            const commanderCards = deck?.commanders?.length ? await hydrateCards(deck.commanders.map(id => collection.get(String(id))).filter(Boolean)) : [];
            const match = createMatch({
                players: [
                    { id: clientId, name: 'Tu', cards: structuredClone(cards), commanders: structuredClone(commanderCards) },
                    { id: BOT_ID, name: 'Bot', cards: structuredClone(cards), commanders: structuredClone(commanderCards) }
                ],
                startingPlayer: clientId
            });
            botMode = true;
            // Il bot tiene o rimischia da solo; il giocatore sceglie la sua mano.
            localGame = match;
            localGame.revision = (localGame.revision || 0) + 1;
            selectedAttackers = new Set();
            selectedDiscards = new Set();
            setNotice('Partita avviata contro il Bot.');
        } catch (error) {
            setNotice(error.message || 'Avvio non riuscito.');
        } finally {
            busy = false;
            render();
            scheduleBotIfNeeded();
        }
    }

    // Le mosse si accodano: un tocco rapido (le vite, per esempio) non deve andare
    // perso solo perché la precedente stava ancora salvando.
    let commitQueue = Promise.resolve();
    // Il turno non scorre da solo: dopo ogni mossa resta fermo e si chiude solo
    // con «Passa il turno», così si vede ogni fase e non si perdono decisioni.
    const act = (updater, { resetTarget = false } = {}) => {
        commitQueue = commitQueue
            .then(() => commit(updater))
            .then(ok => {
                if (!ok) return;
                selectedAttackers = new Set();
                selectedDiscards = new Set();
                // La magia è passata: il bersaglio è stato consumato. Senza questo
                // azzeramento la magia successiva colpirebbe la stessa carta senza
                // che il giocatore l'abbia scelta di nuovo.
                if (resetTarget) clearTarget();
            })
            .catch(() => {});
    };

    function phaseButton(player) {
        if (!isMyTurn()) return '';
        // Con la mano oltre sette carte il turno non si chiude: prima si scarta.
        if (gameState().pendingDiscard && player.hand.length > MATCH_RULES.openingHand) return '';
        // Un solo pulsante: chiude il turno intero. Le fasi intermedie le
        // attraversa il motore, non l'utente.
        return '<button type="button" class="mp-button" data-phase="next">Passa il turno</button>';
    }

    function boardCard(card, mine) {
        const power = powerOf(card);
        const toughness = toughnessOf(card);
        const canTap = mine && isMyTurn() && isManaSource(card, myData()?.colorIdentity || []) && !card.tapped;
        const attacking = gameState().phase === 'combat' && selectedAttackers.has(idOf(card));
        return `<article class="mp-board-card ${card.tapped ? 'is-tapped' : ''} ${attacking ? 'is-marked' : ''}" data-zoom-card="${esc(idOf(card))}">
            ${zoomableArt(card)}
            <div class="mp-board-copy">
                <strong>${esc(card.name)}</strong>
                <small>${renderCardSymbols(card.manaCost || '')}</small>
                ${isCreature(card) ? `<b>${power}/${toughness}</b>` : ''}
                ${card.tapped ? '<i class="mp-tag">tappata</i>' : ''}
            </div>
            ${canTap ? `<button type="button" class="mp-small" data-tap="${esc(idOf(card))}">Mana</button>` : ''}
            ${mine && isMyTurn() && gameState().phase === 'combat' && isCreature(card) && !card.tapped && !card.summoningSick ? `<button type="button" class="mp-small" data-attacker="${esc(idOf(card))}">${attacking ? 'Non attacca' : 'Attacca'}</button>` : ''}
        </article>`;
    }

    // Il campo degli avversari mostra solo le carte evocate: senza permanenti
    // resta il solo intestatario, senza riquadri vuoti che allungano il tavolo.
    function board(cards, mine) {
        if (!cards.length) return mine ? '<p class="mp-empty">Nessun permanente in campo.</p>' : '';
        return `<div class="mp-board">${cards.map(card => boardCard(card, mine)).join('')}</div>`;
    }

    function handPanel(player) {
        const current = gameState();
        // Durante il mulligan la mano serve a scegliere le carte da mettere in fondo: senza
        // questi pulsanti il mulligan londinese resterebbe bloccato dal secondo tentativo.
        if (current.mulliganActive && !player.keptHand) {
            const chosen = new Set(player.mulliganBottom || []);
            return `<div class="mp-hand">${player.hand.map((card, index) => `<article class="mp-hand-card ${chosen.has(index) ? 'is-marked' : ''}" data-zoom-card="${esc(idOf(card))}">
                ${zoomableArt(card)}
                <strong>${esc(card.name)}</strong>
                <button type="button" class="mp-small" data-mulligan-pick="${index}">${chosen.has(index) ? 'Non in fondo' : 'In fondo'}</button>
            </article>`).join('')}</div>`;
        }
        if (!isMyTurn()) return `<div class="mp-hand">${player.hand.map(card => `<article class="mp-hand-card is-idle" data-zoom-card="${esc(idOf(card))}">${zoomableArt(card)}<strong>${esc(card.name)}</strong></article>`).join('')}</div>`;
        return `<div class="mp-hand">${player.hand.map(card => {
            const land = isLand(card);
            const castable = !land;
            const discardMode = current.pendingDiscard && player.hand.length > MATCH_RULES.openingHand;
            const action = discardMode
                ? `<button type="button" class="mp-small" data-discard="${esc(card.uid)}">${selectedDiscards.has(card.uid) ? 'Non scartare' : 'Scarta'}</button>`
                : land
                    ? `<button type="button" class="mp-small" data-play="${esc(card.uid)}" ${player.landsPlayed >= 1 || !['main1', 'main2'].includes(gameState().phase) ? 'disabled' : ''}>Gioca terra</button>`
                    : `<button type="button" class="mp-small" data-play="${esc(card.uid)}" ${castable ? '' : 'disabled'}>Lancia</button>`;
            return `<article class="mp-hand-card ${selectedDiscards.has(card.uid) ? 'is-marked' : ''}" data-zoom-card="${esc(idOf(card))}">
                ${zoomableArt(card)}
                <div class="mp-board-copy"><strong>${esc(card.name)}</strong><small>${renderCardSymbols(card.manaCost || '')}</small></div>
                ${action}
            </article>`;
        }).join('') || '<p class="mp-empty">Nessuna carta in mano.</p>'}</div>`;
    }

    const restoreTarget = () => {
        const select = container.querySelector('#play-target');
        if (!select) return;
        if (!chosenTarget) return;
        if ([...select.options].some(option => option.value === chosenTarget)) select.value = chosenTarget;
        else chosenTarget = '';
    };

    const clearTarget = () => {
        chosenTarget = '';
        const select = container.querySelector('#play-target');
        if (select) select.value = '';
    };

    function targetOptions() {
        const current = gameState();
        return current.players
            .filter(id => !current.playersData[id]?.eliminated)
            .flatMap(id => [
                `<option value="player:${esc(id)}">${esc(nameOf(id))}</option>`,
                ...current.playersData[id].battlefield.map(card => `<option value="card:${esc(id)}:${esc(idOf(card))}">${esc(card.name)}</option>`)
            ]).join('');
    }

    function mulliganPanel() {
        const current = gameState();
        if (!current.mulliganActive) return '';
        const mine = myData();
        if (!mine) return '';
        if (mine.keptHand) return `<section class="mp-mulligan"><strong>Mano tenuta</strong><p>In attesa degli altri giocatori…</p></section>`;
        const needed = Math.min(mine.hand.length, Math.max(0, mine.cardsToBottom || 0));
        const chosen = new Set(mine.mulliganBottom || []);
        return `<section class="mp-mulligan">
            <span class="mp-overline">MULLIGAN LONDINESE · PRIMO MULLIGAN GRATUITO</span>
            <strong>${mine.mulligans ? `Mulligan ${mine.mulligans}${needed ? ` · ${needed} ${needed === 1 ? 'carta' : 'carte'} in fondo` : ''}` : 'Controlla la mano iniziale'}</strong>
            <p>${needed ? `Scegli ${needed} ${needed === 1 ? 'carta' : 'carte'} da mettere in fondo al grimorio, poi tieni la mano.` : 'Puoi tenere queste sette carte o rimescolarle e pescarne altre sette.'}</p>
            <div class="mp-row">
                <button type="button" class="mp-button mp-soft" data-mulligan="redraw">Rimescola e pesca</button>
                <button type="button" class="mp-button" data-mulligan="keep" ${chosen.size !== needed ? 'disabled' : ''}>${needed ? `Tieni · fondo ${needed}` : 'Tieni questa mano'}</button>
            </div>
        </section>`;
    }

    function combatPanel() {
        const current = gameState();
        if (current.phase !== 'combat') return '';
        const mine = myData();
        if (!current.combat) {
            // Chi non sta attaccando aspetta: il pannello dei blocchi arriva dopo
            // la dichiarazione degli attaccanti.
            if (!isMyTurn()) return `<section class="mp-combat"><span class="mp-overline">COMBATTIMENTO</span><p>L’avversario sta scegliendo gli attaccanti.</p></section>`;
            const opponents = current.players.filter(id => id !== clientId && !current.playersData[id]?.eliminated);
            return `<section class="mp-combat"><span class="mp-overline">COMBATTIMENTO</span>
                <p>Seleziona le creature che attaccano, poi dichiara l'attacco. ${selectedAttackers.size} selezionate.</p>
                <div class="mp-row">
                    <label>Chi attacchi<select id="play-defender">${opponents.map(id => `<option value="${esc(id)}">${esc(nameOf(id))}</option>`).join('')}</select></label>
                    <button type="button" class="mp-button" data-declare-attack ${selectedAttackers.size ? '' : 'disabled'}>Dichiara attaccanti</button>
                </div>
            </section>`;
        }
        if (current.combat.step === 'blockers') {
            if (current.combat.defender !== clientId) {
                return `<section class="mp-combat"><span class="mp-overline">IN ATTESA DEI BLOCCHI</span><p>${esc(nameOf(current.combat.defender))} sta scegliendo i bloccanti.</p></section>`;
            }
            const blockers = mine.battlefield.filter(card => isCreature(card) && !card.tapped);
            return `<section class="mp-combat"><span class="mp-overline">DICHIARA I BLOCCANTI</span>
                <p>${blockers.length ? 'Assegna le tue creature a chi ti attacca.' : 'Non hai creature stappate: puoi solo lasciar passare il danno.'}</p>
                ${current.combat.attackerIds.map(uid => {
                    const ownerId = current.players.find(id => (current.playersData[id]?.battlefield || []).some(card => idOf(card) === uid));
                    const attacker = current.playersData[ownerId]?.battlefield.find(card => idOf(card) === uid);
                    return `<label>${esc(attacker?.name || 'Attaccante')}<select data-block="${esc(uid)}"><option value="">Non bloccare</option>${blockers.map(card => `<option value="${esc(idOf(card))}">${esc(card.name)}</option>`).join('')}</select></label>`;
                }).join('')}
                <button type="button" class="mp-button" data-declare-block>Conferma blocchi</button>
            </section>`;
        }
        if (current.combat.step === 'damage') {
            if (current.activePlayer !== clientId) return `<section class="mp-combat"><span class="mp-overline">DANNO DA COMBATTIMENTO</span><p>In attesa che ${esc(nameOf(current.activePlayer))} risolva il danno.</p></section>`;
            return `<section class="mp-combat"><span class="mp-overline">DANNO DA COMBATTIMENTO</span><p>${current.combat.blockers && Object.keys(current.combat.blockers).length ? 'I blocchi sono dichiarati.' : 'Nessun blocco.'} Il danno è simultaneo.</p><button type="button" class="mp-button" data-resolve-combat>Risolvi il danno</button></section>`;
        }
        return '';
    }

    function tableMarkup() {
        const current = gameState();
        const mine = myData();
        if (!mine) return '<p class="mp-notice">Questa partita non ti include.</p>';
        const opponents = current.players.filter(id => id !== clientId && !current.playersData[id]?.eliminated);
        const activeName = nameOf(current.activePlayer);
        if (current.winner) {
            const label2 = current.winner === 'draw'
                ? 'Pareggio'
                : current.winner === clientId ? 'Hai vinto la partita' : `${nameOf(current.winner)} vince la partita`;
            return `<section class="mp-result"><span class="mp-overline">PARTITA CONCLUSA</span><h2>${esc(label2)}</h2><button type="button" class="mp-button" data-new-match>Torna alla sala d’attesa</button></section>`;
        }
        return `<section class="mp-table">
            <header class="mp-hud">
                <div><span class="mp-overline">TURNO ${current.turn} · ${esc(PHASE_LABEL[current.phase] || current.phase)}</span>
                <strong>${current.activePlayer === clientId ? 'Tocca a te' : `Tocca a ${esc(activeName)}`}</strong>
                <small>Vite ${mine.life} · mano ${mine.hand.length} · grimorio ${mine.library.length}${(() => { const cmd = Math.max(0, ...Object.values(mine.commanderDamage || {})); return cmd > 0 ? ` · Cmd ${cmd}/21` : ''; })()}${current.pendingDiscard && mine.hand.length > 7 ? ' · devi scartare' : ''}</small></div>
                <div class="mp-row">${phaseButton(mine)}<button type="button" class="mp-small" data-leave>Lascia il tavolo</button></div>
            </header>
            ${mulliganPanel()}
            <div class="mp-opponents">${opponents.map(id => {
                const foe = current.playersData[id];
                const cmd = Math.max(0, ...Object.values(foe.commanderDamage || {}));
                const cmdLabel = cmd > 0 ? ` · Cmd ${cmd}/21` : '';
                return `<article class="mp-opponent"><header><strong>${esc(nameOf(id))}</strong><span>${foe.life} vite${cmdLabel}</span></header>${board(foe.battlefield, false)}</article>`;
            }).join('')}</div>
            <div class="mp-own">
                <header><strong>Il tuo campo</strong><span>${mine.life} vite${(() => { const cmd = Math.max(0, ...Object.values(mine.commanderDamage || {})); return cmd > 0 ? ` · Cmd ${cmd}/21` : ''; })()}</span></header>
                ${board(mine.battlefield, true)}
            </div>
            <div class="mp-mana">
                <span>Riserva: ${esc(manaPoolLabel(mine.manaPool))}</span>
                <button type="button" class="mp-small" data-clear-mana ${isMyTurn() ? '' : 'disabled'}>Svuota</button>
                <small>Tocca una terra o una fonte con Mana per aggiungere mana.</small>
            </div>
            ${combatPanel()}
            <div class="mp-actions">
                <label class="mp-target">Bersaglio della magia<select id="play-target"><option value="">Nessun bersaglio</option>${targetOptions()}</select></label>
                ${current.pendingDiscard && mine.hand.length > 7 ? `<div class="mp-discard"><span>Fine turno: scarta ${mine.hand.length - 7} ${mine.hand.length - 7 === 1 ? 'carta' : 'carte'} (${selectedDiscards.size} ${selectedDiscards.size === 1 ? 'scelta' : 'scelte'})</span><button type="button" class="mp-button" data-confirm-discard ${selectedDiscards.size === mine.hand.length - 7 ? '' : 'disabled'}>Scarta</button></div>` : ''}
                <div class="mp-life"><span>Vite</span><button type="button" class="mp-small" data-life="-1" ${isMyTurn() ? '' : 'disabled'}>−</button><strong>${mine.life}</strong><button type="button" class="mp-small" data-life="1" ${isMyTurn() ? '' : 'disabled'}>＋</button></div>
            </div>
            <h3 class="mp-hand-title">La tua mano <small>tocca la grafica di una carta per leggerla in grande</small></h3>
            ${handPanel(mine)}
            <details class="mp-log"><summary>Diario della partita</summary><ol>${(current.log || []).slice(0, 12).map(line => `<li>${esc(line)}</li>`).join('')}</ol></details>
        </section>`;
    }

    function lobbyMarkup() {
        const order = participants();
        const ready = loadouts();
        const deck = decks.find(item => item.id === chosenDeck);
        const check = deck ? deckCheck(deck) : { valid: false, errors: ['Nessun mazzo selezionato.'] };
        const allReady = order.length >= 2 && order.every(id => ready[id]?.cards?.length);
        return `<section class="mp-panel">
            <span class="mp-overline">MULTIPLAYER</span>
            <h2>${room?.code ? `Collegamento ${esc(room.code)}` : 'Collegati al tavolo'}</h2>
            ${room?.code ? `<p>Condividi il codice: ogni giocatore entra da qui, conferma il proprio mazzo e poi l’oste avvia la partita.</p>
                <div class="mp-row"><code class="mp-code">${esc(room.code)}</code><button type="button" class="mp-small" data-copy>Copia codice</button><button type="button" class="mp-small" data-leave>Lascia</button></div>`
                : `<p>Un solo collegamento per tutte le partite. Serve un account: il tavolo usa la connessione protetta della Taverna.</p>
                <div class="mp-connect"><button type="button" class="mp-button" data-create ${busy ? 'disabled' : ''}>Crea collegamento</button>
                <form id="play-join"><label>Codice<input id="play-code" maxlength="6" minlength="6" required autocomplete="off" placeholder="ABC234" autocapitalize="characters"></label><button class="mp-button mp-soft" type="submit">Collegati</button></form></div>`}
        </section>
        <section class="mp-panel">
            <span class="mp-overline">IL TUO MAZZO</span>
            <h2>${deck ? esc(deck.name) : 'Nessun mazzo'}</h2>
            <label class="mp-deck-pick">Mazzo<select id="play-deck">${decks.map(item => {
                const itemCheck = deckCheck(item);
                return `<option value="${esc(item.id)}" ${item.id === chosenDeck ? 'selected' : ''}>${esc(item.name)} · ${itemCheck.total} carte${itemCheck.valid ? '' : ' · non legale'}</option>`;
            }).join('') || '<option value="">Crea un mazzo dalla sezione Mazzi</option>'}</select></label>
            <p class="${check.valid ? 'mp-ok' : 'mp-error'}">${check.valid ? `✓ Mazzo valido: ${check.total} carte, massimo ${MATCH_RULES.maxCopies} copie per carta.` : check.errors.map(esc).join('<br>')}</p>
            <button type="button" class="mp-button" data-confirm-deck ${!check.valid || !room?.code || busy ? 'disabled' : ''}>Conferma mazzo</button>
            ${!room?.code ? '<small>Collegati prima al tavolo: il mazzo viene inviato agli altri solo dopo la conferma.</small>' : ''}
        </section>
        <section class="mp-panel">
            <span class="mp-overline">CONTRO IL BOT</span>
            <h2>Partita in solitaria</h2>
            <p>Sfida il Bot della Taverna: stesso mazzo per entrambi, nessun collegamento richiesto.</p>
            ${deck
                ? `<p class="${check.valid ? 'mp-ok' : 'mp-error'}">${check.valid ? `✓ Mazzo pronto: ${esc(deck.name)} · ${check.total} carte.` : check.errors.map(esc).join('<br>')}</p>`
                : '<p class="mp-error">Crea un mazzo dalla sezione Mazzi per giocare.</p>'}
            <button type="button" class="mp-button mp-start" data-start-bot ${busy ? 'disabled' : ''}>AVVIA CONTRO IL BOT</button>
            <p id="play-bot-status" class="mp-note" role="status" aria-live="polite"></p>
        </section>
        ${room?.code ? `<section class="mp-panel">
            <span class="mp-overline">TAVOLO · ${order.length}/${MATCH_RULES.maxPlayers}</span>
            <h2>Chi è pronto</h2>
            <ul class="mp-roster">${order.map(id => `<li><strong>${esc(label(id))}</strong> <span>${ready[id]?.cards?.length ? `· ${esc(ready[id].name)} pronto` : '· mazzo non confermato'}</span></li>`).join('')}</ul>
            <p>${allReady ? 'Tutti hanno un mazzo legale.' : 'Ogni giocatore deve confermare un mazzo legale.'}</p>
            <p class="mp-note">${MATCH_RULES.startingLife} punti vita, mano di ${MATCH_RULES.openingHand} carte, ${MATCH_RULES.minDeck} carte minime nel mazzo, una terra per turno, combattimento con attaccanti, bloccanti e danno simultaneo.</p>
            ${room.hostClientId === clientId
                ? `<button type="button" class="mp-button mp-start" data-start ${!allReady || busy ? 'disabled' : ''}>AVVIA MATCH</button>`
                : '<p class="mp-note">L’oste avvia la partita con «Avvia match».</p>'}
        </section>` : ''}`;
    }

    // Carta in grande: si apre toccando la grafica e si chiude con un tocco fuori,
    // con la × o con Esc. Non ridisegna il tavolo, così la partita resta ferma.
    let zoomOverlay = null;
    const closeCardZoom = () => {
        document.removeEventListener('keydown', onZoomKey);
        zoomOverlay?.remove();
        zoomOverlay = null;
    };
    function onZoomKey(event) { if (event.key === 'Escape') closeCardZoom(); }

    const findCardByUid = uid => {
        const current = gameState();
        if (!current || !uid) return null;
        for (const id of current.players) {
            const data = current.playersData[id] || {};
            const pool = [...(data.battlefield || []), ...(data.hand || []), ...(data.graveyard || []), ...(data.exile || [])];
            const found = pool.find(card => idOf(card) === uid);
            if (found) return found;
        }
        return null;
    };

    const openCardZoom = card => {
        if (!card) return;
        closeCardZoom();
        const overlay = document.createElement('div');
        overlay.className = 'mp-zoom';
        overlay.innerHTML = `<section class="mp-zoom-card" role="dialog" aria-modal="true" aria-label="${esc(card.name || 'Carta')}">
            <button type="button" class="mp-zoom-close" aria-label="Chiudi">×</button>
            ${card.image ? `<img src="${esc(card.image)}" alt="">` : '<p class="mp-zoom-fallback">Senza immagine</p>'}
            <div class="mp-zoom-copy">
                <span class="mp-overline">${renderCardSymbols(card.manaCost || '')} ${esc(card.typeLine || '')}</span>
                <strong>${esc(card.name || 'Carta')}</strong>
                ${isCreature(card) ? `<b>${powerOf(card)}/${toughnessOf(card)}</b>` : ''}
                <p>${renderCardSymbols(card.oracleText || 'Nessun testo disponibile.')}</p>
                ${(() => { const support = textSupport(card); return (support.automated || support.manual)
                    ? `<p class="mp-zoom-support">${support.automated} effetti automatici${support.manual ? ` · ${support.manual} da gestire a mano` : ''}</p>`
                    : ''; })()}
            </div>
        </section>`;
        overlay.addEventListener('click', event => {
            if (event.target === overlay || event.target.closest('.mp-zoom-close')) closeCardZoom();
        });
        document.body.appendChild(overlay);
        document.addEventListener('keydown', onZoomKey);
        zoomOverlay = overlay;
        overlay.querySelector('.mp-zoom-close')?.focus();
    };

    let table = null;

    const teardownTable = () => {
        table?.destroy();
        table = null;
        closeCardZoom();
    };

    // Le liste che il tavolo legge. Gli avversari restano separati: il selettore
    // mostra quello attivo, così le carte di due giocatori non si mescolano.
    const tableView = current => {
        const mine = current.playersData[clientId] || {};
        const zonesOf = data => ({
            graveyard: data.graveyard || [],
            exile: data.exile || [],
            command: data.commandZone || [],
            library: (data.library || []).length
        });
        return {
            own: mine.battlefield || [],
            hand: mine.hand || [],
            opponents: current.players
                .filter(id => id !== clientId)
                .map(id => {
                    const data = current.playersData[id] || {};
                    return {
                        id, name: nameOf(id), life: data.life ?? 0,
                        eliminated: Boolean(data.eliminated), cards: data.battlefield || [],
                        handCount: (data.hand || []).length,
                        graveyardCount: (data.graveyard || []).length,
                        commanderDamage: data.commanderDamage || {}
                    };
                }),
            // Cimiteri, esilio e zona di comando: in Commander sono parte del
            // gioco, prima non erano visibili da nessuna parte.
            zones: {
                own: { name: 'Tu', ...zonesOf(mine) },
                opponents: current.players
                    .filter(id => id !== clientId)
                    .map(id => ({ name: nameOf(id), ...zonesOf(current.playersData[id] || {}) }))
            },
            status: `${PHASE_LABEL[current.phase] || current.phase} · turno ${current.turn}${current.activePlayer === clientId ? ' · tocchi tu' : ` · tocca a ${nameOf(current.activePlayer)}`}`,
            mana: manaPoolLabel(mine.manaPool),
            life: mine.life
        };
    };

    // I pannelli comandi che stavano in tableMarkup() restano gli stessi: cambia
    // solo dove finiscono, cioè nella banda centrale del tavolo.
    // Simboli veri al posto di {2}{W}: la riserva si legge a colpo d'occhio.
    const manaSymbols = pool => {
        const text = ['W', 'U', 'B', 'R', 'G', 'C']
            .flatMap(color => Array.from({ length: Math.max(0, Number(pool?.[color]) || 0) }, () => `{${color}}`))
            .join('');
        return text ? renderCardSymbols(text) : '';
    };

    // Un simbolo per tipo di effetto: si vede subito se il modo distrugge,
    // pesca, fa danno o pompa, senza leggere la frase intera sul pulsante.
    const EFFECT_ICONS = {
        destroy: '☠', exile: '⛓', damage: '⚔', draw: '✦', gainLife: '❤', loseLife: '♡', pump: '↑',
        grantKeyword: '✧', counters: '◈', tokens: '❖', mana: '◊', bounce: '↩', mill: '▤',
        cantBlock: '⊗', support: '✚', searchBasic: '⌕', discard: '✕', sacrifice: '✖', tap: '↻', untap: '↺'
    };
    const effectIcon = effects => (effects || []).map(effect => EFFECT_ICONS[effect?.type]).find(Boolean) || '✦';

    // Rivelatore: elenca gli inneschi delle carte in campo (tue e avversarie) e i
    // modi o le abilità disponibili in mano. Non simula frasi non capite: mostra
    // solo gli effetti che il motore sa applicare, così la catena si costruisce
    // su qualcosa che accade davvero.
    const effectDetectorMarkup = () => {
        const current = gameState();
        const mine = myData();
        if (!current || !mine) return '';
        const rows = [];
        const sides = [[clientId, mine], ...(current.players || []).filter(id => id !== clientId).map(id => [id, current.playersData?.[id]])];
        for (const [id, data] of sides) {
            for (const card of data?.battlefield || []) {
                for (const trigger of parseCardAbilities(card).triggers) {
                    const supported = Boolean(trigger.effects?.length && !trigger.unsupported?.length);
                    rows.push({ side: id === clientId ? 'mine' : 'foe', icon: supported ? '⚡' : '⚠', card: card.name, text: trigger.text, cost: '', manual: !supported });
                }
            }
        }
        for (const card of mine.hand || []) {
            const parsed = parseCardAbilities(card);
            for (const spell of parsed.spells.filter(entry => entry.modes?.length)) {
                for (const mode of spell.modes) {
                    const supported = Boolean(mode.effects.length && !mode.unsupported.length);
                    rows.push({ side: 'hand', icon: supported ? effectIcon(mode.effects) : '⚠', card: card.name, text: mode.text, cost: card.manaCost || '', manual: !supported });
                }
            }
            for (const ability of parsed.activated.filter(entry => entry.supported)) {
                rows.push({ side: 'hand', icon: '⟳', card: card.name, text: ability.text, cost: '', manual: false });
            }
        }
        if (!rows.length) return '';
        const foes = rows.filter(row => row.side === 'foe').length;
        const items = rows.slice(0, 10).map(row => `<li class="mp-effect mp-effect--${row.side}"><span class="mp-effect__icon" aria-hidden="true" title="${row.manual ? 'Da gestire a mano' : 'Automatico'}">${row.icon}</span><span class="mp-effect__body"><strong>${esc(row.card)}</strong> ${esc(row.text)}${row.manual ? ' <em>(a mano)</em>' : ''}${row.cost ? ` <span class="mp-effect__cost">${renderCardSymbols(row.cost)}</span>` : ''}</span></li>`).join('');
        return `<details class="mp-effects"><summary>Rivelatore effetti · ${rows.length}${foes ? ` · ${foes} avversari` : ''}</summary><ol>${items}</ol></details>`;
    };

    // Quando l'avversario mette in campo una carta che innesca, l'avviso arriva
    // subito: è il momento in cui si può ancora rispondere, non a effetto risolto.
    let foeTriggersSeen = new Set();
    const noteFoeTriggers = () => {
        const current = gameState();
        if (!current || current.mulliganActive || current.winner) return;
        const next = new Set();
        for (const id of current.players || []) {
            if (id === clientId) continue;
            for (const card of current.playersData?.[id]?.battlefield || []) {
                for (const trigger of parseCardAbilities(card).triggers) next.add(`${card.name} · ${trigger.text}`);
            }
        }
        const fresh = [...next].filter(key => !foeTriggersSeen.has(key));
        foeTriggersSeen = next;
        if (!fresh.length) return;
        setNotice(`Effetto avversario in gioco — ${fresh[0]}. Se hai una risposta istantanea, giocala dal tavolo.`);
    };

    const commandsMarkup = () => {
        const current = gameState();
        const mine = myData();
        if (!current || !mine) return '';
        const overflow = mine.hand.length - MATCH_RULES.openingHand;
        const discard = current.pendingDiscard && overflow > 0
            ? `<div class="mp-discard"><span>Fine turno: scarta ${overflow} ${overflow === 1 ? 'carta' : 'carte'} (${selectedDiscards.size} ${selectedDiscards.size === 1 ? 'scelta' : 'scelte'})</span><button type="button" class="mp-button" data-confirm-discard ${selectedDiscards.size === overflow ? '' : 'disabled'}>Scarta</button></div>`
            : '';
        // Il comandante resta lanciabile da un pulsante nella banda comandi: una
        // carta intera qui occuperebbe mezza schermata senza aggiungere nulla.
        const commanderButtons = (mine.commandZone || []).map(card => {
            const tax = (mine.commanderCasts?.[card.uid] || 0) * 2;
            const cost = tax > 0 ? `${card.manaCost || ''} +${tax}` : (card.manaCost || '');
            const canCast = isMyTurn() && ['main1', 'main2'].includes(current.phase);
            return `<button type="button" class="mp-small mp-commander-cast" data-cast-commander="${esc(card.uid)}" ${canCast ? '' : 'disabled'}>Comandante · ${esc(card.name)} <small>${renderCardSymbols(cost)}</small></button>`;
        }).join('');
        return `<p id="play-notice" class="mp-notice" role="status" aria-live="polite">${esc(notice)}</p>
            <div class="mp-mana"><span class="mp-mana__pool" title="${esc(`Riserva: ${manaPoolLabel(mine.manaPool)}`)}">Riserva: ${manaSymbols(mine.manaPool) || 'vuota'}</span><button type="button" class="mp-small" data-clear-mana ${isMyTurn() ? '' : 'disabled'}>Svuota</button></div>
            <div class="mp-toolbar">${phaseButton(mine)}${commanderButtons}${discard}<div class="mp-life"><span>Vite</span><button type="button" class="mp-small" data-life="-1" ${isMyTurn() ? '' : 'disabled'}>−</button><strong>${mine.life}</strong><button type="button" class="mp-small" data-life="1" ${isMyTurn() ? '' : 'disabled'}>＋</button></div><button type="button" class="mp-small" data-leave>Lascia il tavolo</button></div>
            ${current.phase !== 'combat' ? `<label class="mp-target">Bersaglio della magia<select id="play-target"><option value="">Nessun bersaglio</option>${targetOptions()}</select></label>` : ''}
            ${combatPanel()}
            ${effectDetectorMarkup()}
            <details class="mp-log"><summary>Diario della partita</summary><ol>${(current.log || []).slice(0, 12).map(line => `<li>${esc(line)}</li>`).join('')}</ol></details>`;
    };

    // Le magie modali («Choose one —») chiedono il modo prima di essere lanciate.
    const modeLabel = text => {
        const clean = String(text || 'Modo').replace(/\s+/g, ' ').trim();
        return clean.length > 22 ? `${clean.slice(0, 21)}…` : clean;
    };

    // Un pulsante per carta, con le stesse condizioni di boardCard() e handPanel().
    const cardActions = card => {
        const current = gameState();
        const mine = myData();
        if (!current || !mine) return '';
        const uid = card.uid || '';
        const nodeId = idOf(card);
        if ((mine.hand || []).some(item => item.uid === uid)) {
            // Fuori dal proprio turno resta una mossa: la risposta con un
            // istantaneo (o una carta con lampo) prima che l'avversario prosegua.
            if (!isMyTurn()) {
                const canRespond = Boolean(current && !current.winner && !current.mulliganActive
                    && ['main1', 'main2', 'combat'].includes(current.phase)
                    && (/\binstant\b/i.test(String(card.typeLine || '')) || /\bflash\b/i.test(String(card.oracleText || ''))));
                return canRespond ? `<button type="button" class="mp-small" data-respond="${esc(uid)}">Rispondi</button>` : '';
            }
            if (current.pendingDiscard && mine.hand.length > MATCH_RULES.openingHand) {
                return `<button type="button" class="mp-small" data-discard="${esc(uid)}">${selectedDiscards.has(uid) ? 'Non scartare' : 'Scarta'}</button>`;
            }
            // Una magia con modi mostra un pulsante per modo: il motore applica
            // quello scelto, non il primo trovato.
            // Solo le magie hanno modi da scegliere al lancio: un permanente con
            // «scegli uno» in ingresso si risolve con i suoi inneschi.
            const permanentCard = /\b(?:creature|artifact|enchantment|planeswalker)\b/i.test(String(card.typeLine || ''));
            const modal = isLand(card) || permanentCard ? null : parseCardAbilities(card).spells.find(spell => spell.modes?.length);
            if (modal) {
                return modal.modes.map((option, modeIndex) => {
                    const supported = option.effects.length > 0 && option.unsupported.length === 0;
                    return `<button type="button" class="mp-small" data-cast-mode="${esc(`${uid}:${modeIndex}`)}" ${supported ? '' : 'disabled'} title="${esc(`${option.text} · costo ${card.manaCost || '0'}`)}"><span class="mp-mode-icon" aria-hidden="true">${effectIcon(option.effects)}</span> ${esc(modeLabel(option.text))}</button>`;
                }).join('');
            }
            const land = isLand(card);
            const disabled = land && (mine.landsPlayed >= 1 || !['main1', 'main2'].includes(current.phase)) ? 'disabled' : '';
            return `<button type="button" class="mp-small" data-play="${esc(uid)}" ${disabled}>${land ? 'Gioca terra' : 'Lancia'}</button>`;
        }
        const buttons = [];
        if (current.phase === 'combat' && isCreature(card) && !card.tapped && !card.summoningSick && isMyTurn()) {
            const attacking = selectedAttackers.has(nodeId);
            buttons.push(`<button type="button" class="mp-small" data-attacker="${esc(nodeId)}">${attacking ? 'Non attacca' : 'Attacca'}</button>`);
        }
        if (isMyTurn() && isManaSource(card, mine.colorIdentity || []) && !card.tapped) {
            buttons.push(`<button type="button" class="mp-small" data-tap="${esc(nodeId)}">Mana</button>`);
        }
        // Abilità attivate: solo quelle che il motore sa applicare davvero. Il
        // resto resta nel diario come «da gestire a mano», non simula nulla.
        if (isMyTurn() && ['main1', 'main2'].includes(current.phase)) {
            parseCardAbilities(card).activated.forEach((ability, index) => {
                if (!ability.supported || (!ability.cost.tap && !ability.cost.manaCost)) return;
                buttons.push(`<button type="button" class="mp-small mp-ability" data-ability="${esc(uid)}" data-ability-index="${index}" title="${esc(ability.text)}">${esc(abilityLabel(ability))}</button>`);
            });
        }
        return buttons.join('');
    };

    // Il tap non scrive la carta: chiede al motore, che è l'unico a poterla tappare.
    const requestTap = ({ id }) => {
        const mine = myData();
        const card = (mine?.battlefield || []).find(item => idOf(item) === id);
        if (!card || card.tapped || !isManaSource(card, mine?.colorIdentity || [])) return;
        void commit(current => tapMana(current, clientId, id, 'auto'));
    };

    function renderPlaying(current) {
        const views = tableView(current);
        if (!table) {
            container.innerHTML = '<main class="magic-page magic-play"><div id="play-table"></div></main>';
            table = showMatchTable(container.querySelector('#play-table'), {
                own: views.own,
                hand: views.hand,
                opponents: views.opponents,
                commands: commandsMarkup(),
                zones: views.zones,
                status: views.status,
                mana: views.mana,
                life: views.life,
                tileExtra: cardActions,
                onTogglePermanent: requestTap,
                onPreview: ({ id }) => openCardZoom(findCardByUid(id)),
                onExit: () => navigateTo('magic', container),
                onAbandon: () => void leaveRoom()
            });
            bindActions();
            restoreTarget();
            return;
        }
        if (table.update({
            own: views.own, hand: views.hand, opponents: views.opponents,
            commands: commandsMarkup(), zones: views.zones,
            status: views.status, mana: views.mana, life: views.life
        })) bindActions();
        restoreTarget();
    }

    const render = () => {
        if (disposed) return;
        const current = gameState();
        noteFoeTriggers();
        document.body.classList.toggle('magic-table-active', Boolean(current && !current.winner));
        // Mulligan, lobby e schermata del vincitore restano le vecchie: il tavolo
        // è uno strato del solo campo, e il mulligan lavora su indici di mano.
        if (current && !current.winner && !current.mulliganActive) { renderPlaying(current); return; }
        teardownTable();
        container.innerHTML = `<main class="magic-page magic-play">
            <div class="mp-topbar"><button type="button" class="app-back-button" data-back>← Magic</button><span class="mp-overline">TAVOLO · MAGIC</span></div>
            <header class="mp-heading"><h1>Gioca la tua partita</h1><p>Mazzo dalla sezione Mazzi, collegamento Multiplayer, poi «Avvia match».</p></header>
            <p id="play-notice" class="mp-notice" role="status" aria-live="polite">${esc(notice)}</p>
            ${current ? tableMarkup() : lobbyMarkup()}
            <p class="legal-inline-note">Magic: The Gathering è un marchio di Wizards of the Coast. Dati e immagini da Scryfall; nessuna affiliazione.</p>
        </main>`;
        bind();
    };

    function bind() {
        container.querySelector('[data-back]')?.addEventListener('click', () => navigateTo('magic', container));
        container.querySelector('[data-create]')?.addEventListener('click', () => void connect('create'));
        container.querySelector('#play-join')?.addEventListener('submit', event => {
            event.preventDefault();
            const code = container.querySelector('#play-code')?.value || '';
            void connect('join', code);
        });
        container.querySelector('[data-copy]')?.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(room.code); setNotice('Codice copiato.'); } catch { setNotice(`Codice ${room.code}`); }
        });
        container.querySelector('[data-leave]')?.addEventListener('click', () => void leaveRoom());
        container.querySelector('#play-deck')?.addEventListener('change', event => {
            chosenDeck = event.target.value;
            localStorage.setItem(DECK_CHOICE_KEY, chosenDeck);
            render();
        });
        container.querySelector('[data-confirm-deck]')?.addEventListener('click', () => void confirmDeck());
        container.querySelector('[data-start]')?.addEventListener('click', () => void startMatch());
        container.querySelector('[data-start-bot]')?.addEventListener('click', () => void startBotMatch());
        container.querySelector('[data-new-match]')?.addEventListener('click', () => void returnToLobby());
        container.querySelector('[data-phase]')?.addEventListener('click', () => act(current => passTurn(current, clientId)));
        // Tutta la scheda apre la carta, tranne i suoi comandi: i pulsanti interni
        // (Lancia, Mana, Attacca, In fondo, Scarta) non devono aprire altro.
        container.querySelectorAll('[data-zoom-card]').forEach(card => card.addEventListener('click', event => {
            if (event.target.closest('button:not(.mp-card-art), select, input, textarea')) return;
            openCardZoom(findCardByUid(card.dataset.zoomCard));
        }));
        container.querySelectorAll('[data-mulligan]').forEach(button => button.addEventListener('click', () => {
            act(current => mulliganAction(current, clientId, button.dataset.mulligan));
        }));
        container.querySelectorAll('[data-mulligan-pick]').forEach(button => button.addEventListener('click', () => {
            const index = Number(button.dataset.mulliganPick);
            act(current => mulliganAction(current, clientId, 'select', index));
        }));
        container.querySelectorAll('[data-play]').forEach(button => button.addEventListener('click', () => {
            const uid = button.dataset.play;
            const card = myData()?.hand.find(item => item.uid === uid);
            if (!card) return;
            act(current => isLand(card)
                ? playLand(current, clientId, uid)
                : castSpell(current, clientId, uid, container.querySelector('#play-target')?.value || ''), { resetTarget: !isLand(card) });
        }));
        container.querySelectorAll('[data-cast-mode]').forEach(button => button.addEventListener('click', () => {
            const [uid, mode] = String(button.dataset.castMode || '').split(':');
            if (!uid) return;
            act(current => castSpell(current, clientId, uid, container.querySelector('#play-target')?.value || '', Number(mode)), { resetTarget: true });
        }));
        container.querySelectorAll('[data-cast-commander]').forEach(button => button.addEventListener('click', () => {
            const uid = button.dataset.castCommander;
            act(current => castSpell(current, clientId, uid, container.querySelector('#play-target')?.value || ''));
        }));
        container.querySelectorAll('[data-tap]').forEach(button => button.addEventListener('click', () => {
            // Tappare per mana è una preparazione, non una mossa conclusa: le
            // fasi non scattano in avanti mentre il giocatore sta pagando.
            act(current => tapMana(current, clientId, button.dataset.tap, 'auto'));
        }));
        container.querySelectorAll('[data-respond]').forEach(button => button.addEventListener('click', () => {
            act(current => castResponse(current, clientId, button.dataset.respond, container.querySelector('#play-target')?.value || ''), { resetTarget: true });
        }));
        container.querySelectorAll('[data-attacker]').forEach(button => button.addEventListener('click', () => {
            const uid = button.dataset.attacker;
            if (selectedAttackers.has(uid)) selectedAttackers.delete(uid); else selectedAttackers.add(uid);
            render();
        }));
        container.querySelector('[data-declare-attack]')?.addEventListener('click', () => {
            const defender = container.querySelector('#play-defender')?.value || '';
            act(current => declareAttackers(current, clientId, [...selectedAttackers], defender));
        });
        container.querySelector('[data-declare-block]')?.addEventListener('click', () => {
            const assignments = {};
            container.querySelectorAll('[data-block]').forEach(select => { assignments[select.dataset.block] = select.value; });
            act(current => declareBlockers(current, clientId, assignments));
        });
        container.querySelector('[data-resolve-combat]')?.addEventListener('click', () => act(current => resolveCombat(current, clientId)));
        container.querySelector('[data-clear-mana]')?.addEventListener('click', () => act(current => {
            current.playersData[clientId].manaPool = emptyManaPool();
            return current;
        }));
        container.querySelectorAll('[data-life]').forEach(button => button.addEventListener('click', () => {
            act(current => adjustLife(current, clientId, clientId, Number(button.dataset.life)));
        }));
        container.querySelectorAll('[data-discard]').forEach(button => button.addEventListener('click', () => {
            const uid = button.dataset.discard;
            if (selectedDiscards.has(uid)) selectedDiscards.delete(uid); else selectedDiscards.add(uid);
            render();
        }));
        container.querySelector('[data-confirm-discard]')?.addEventListener('click', () => {
            act(current => discardCards(current, clientId, [...selectedDiscards]));
        });
    }

    // I comandi del tavolo si rilegano a ogni ridisegno: i nodi sono nuovi, quindi
    // non si accumulano listener. In lobby e nel mulligan resta bind().
    function bindActions() {
        container.querySelectorAll('[data-play]').forEach(button => button.addEventListener('click', () => {
            const uid = button.dataset.play;
            const card = myData()?.hand.find(item => item.uid === uid);
            if (!card) return;
            act(current => isLand(card)
                ? playLand(current, clientId, uid)
                : castSpell(current, clientId, uid, container.querySelector('#play-target')?.value || ''), { resetTarget: !isLand(card) });
        }));
        container.querySelectorAll('[data-cast-mode]').forEach(button => button.addEventListener('click', () => {
            const [uid, mode] = String(button.dataset.castMode || '').split(':');
            if (!uid) return;
            act(current => castSpell(current, clientId, uid, container.querySelector('#play-target')?.value || '', Number(mode)), { resetTarget: true });
        }));
        container.querySelectorAll('[data-cast-commander]').forEach(button => button.addEventListener('click', () => {
            act(current => castSpell(current, clientId, button.dataset.castCommander, container.querySelector('#play-target')?.value || ''), { resetTarget: true });
        }));
        container.querySelectorAll('[data-tap]').forEach(button => button.addEventListener('click', () => {
            // Tappare per mana è una preparazione, non una mossa conclusa: le
            // fasi non scattano in avanti mentre il giocatore sta pagando.
            act(current => tapMana(current, clientId, button.dataset.tap, 'auto'));
        }));
        container.querySelectorAll('[data-respond]').forEach(button => button.addEventListener('click', () => {
            act(current => castResponse(current, clientId, button.dataset.respond, container.querySelector('#play-target')?.value || ''), { resetTarget: true });
        }));
        container.querySelectorAll('[data-ability]').forEach(button => button.addEventListener('click', () => {
            const uid = button.dataset.ability;
            const index = Number(button.dataset.abilityIndex) || 0;
            act(current => activateAbility(current, clientId, uid, index, container.querySelector('#play-target')?.value || ''));
        }));
        container.querySelectorAll('[data-attacker]').forEach(button => button.addEventListener('click', () => {
            const uid = button.dataset.attacker;
            if (selectedAttackers.has(uid)) selectedAttackers.delete(uid); else selectedAttackers.add(uid);
            render();
        }));
        container.querySelector('[data-declare-attack]')?.addEventListener('click', () => {
            const defender = container.querySelector('#play-defender')?.value || '';
            act(current => declareAttackers(current, clientId, [...selectedAttackers], defender));
        });
        container.querySelector('[data-declare-block]')?.addEventListener('click', () => {
            const assignments = {};
            container.querySelectorAll('[data-block]').forEach(select => { assignments[select.dataset.block] = select.value; });
            act(current => declareBlockers(current, clientId, assignments));
        });
        container.querySelector('[data-resolve-combat]')?.addEventListener('click', () => act(current => resolveCombat(current, clientId)));
        container.querySelector('[data-phase]')?.addEventListener('click', () => act(current => passTurn(current, clientId)));
        container.querySelectorAll('[data-life]').forEach(button => button.addEventListener('click', () => {
            act(current => adjustLife(current, clientId, clientId, Number(button.dataset.life)));
        }));
        container.querySelectorAll('[data-discard]').forEach(button => button.addEventListener('click', () => {
            const uid = button.dataset.discard;
            if (selectedDiscards.has(uid)) selectedDiscards.delete(uid); else selectedDiscards.add(uid);
            render();
        }));
        container.querySelector('[data-confirm-discard]')?.addEventListener('click', () => {
            act(current => discardCards(current, clientId, [...selectedDiscards]));
        });
        container.querySelector('[data-clear-mana]')?.addEventListener('click', () => act(current => {
            current.playersData[clientId].manaPool = emptyManaPool();
            return current;
        }));
        container.querySelectorAll('#play-target').forEach(select => select.addEventListener('change', () => {
            chosenTarget = select.value;
        }));
        container.querySelector('[data-leave]')?.addEventListener('click', () => void leaveRoom());
    }

    render();
    if (room?.code) watch(room);

    const onVisible = () => { if (document.visibilityState === 'visible') syncNow(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    const cleanup = () => {
        disposed = true;
        teardownTable();
        closeCardZoom();
        document.body.classList.remove('magic-table-active');
        window.__magicPlayCleanup = null;
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', onVisible);
        stopWatch?.(); stopWatch = null;
        clearInterval(pollTimer); pollTimer = null;
    };
    window.__magicPlayCleanup = cleanup;
}
