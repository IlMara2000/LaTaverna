import {
    addManaProduction, canPayMana, chooseManaProductionOption, emptyManaPool,
    isManaSource, isPermanentCard, manaPoolLabel, manaProductionOptions,
    payMana, resolveOracleText, tapManaSource
} from './magicRules.js';

// Formato del tavolo: partite fra 2 e 4 persone, mazzo costruito con la sezione
// Mazzi (minimo 60 carte, massimo quattro copie), 20 punti vita, mano iniziale
// di sette carte con mulligan londinese e primo mulligan gratuito (regola
// multiplayer ufficiale). Il motore è puro: ogni azione restituisce un nuovo
// stato e lancia un errore in italiano quando la mossa non è legale.
export const MATCH_RULES = Object.freeze({
    minDeck: 100, maxCopies: 1, startingLife: 40, openingHand: 7, maxPlayers: 4,
    commanderDamageLethal: 21
});

export const PHASES = Object.freeze(['main1', 'combat', 'main2', 'end']);
export const PHASE_LABEL = Object.freeze({
    main1: 'Prima fase principale',
    combat: 'Combattimento',
    main2: 'Seconda fase principale',
    end: 'Fase finale'
});

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];
const typeLine = card => String(card?.typeLine || '');
const oracleText = card => String(card?.oracleText || '');
const isLand = card => /\bland\b/i.test(typeLine(card));
const isBasicLand = card => /\bbasic\b/i.test(typeLine(card)) && isLand(card);
const isCreature = card => /\bcreature\b/i.test(typeLine(card));
const isInstant = card => /\binstant\b/i.test(typeLine(card));
const hasKeyword = (card, word) => (card?.keywords || []).some(keyword => String(keyword).toLowerCase() === word)
    || new RegExp(`\\b${word}\\b`, 'i').test(oracleText(card));
const basePower = card => Number.parseInt(card?.power, 10) || 0;
const baseToughness = card => Number.parseInt(card?.toughness, 10) || 0;
export const powerOf = card => basePower(card) + (card?.counters?.plusOne || 0) + (card?.turnBoost?.power || 0);
export const toughnessOf = card => baseToughness(card) + (card?.counters?.plusOne || 0) + (card?.turnBoost?.toughness || 0);
const clone = value => structuredClone(value);
const shuffle = items => {
    for (let index = items.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [items[index], items[swap]] = [items[swap], items[index]];
    }
    return items;
};
const playerName = (state, id) => state.playerNames?.[id] || `Giocatore ${state.players.indexOf(id) + 1}`;
const requirePlayer = (state, playerId) => {
    const player = state.playersData?.[playerId];
    if (!player) throw new Error('Non fai parte di questa partita.');
    if (player.eliminated) throw new Error('Sei fuori dalla partita.');
    return player;
};
const requireTurn = (state, playerId) => {
    if (state.winner) throw new Error('La partita è conclusa.');
    if (state.mulliganActive) throw new Error('Prima scegliete la mano iniziale.');
    if (state.activePlayer !== playerId) throw new Error('Non è il tuo turno.');
    return requirePlayer(state, playerId);
};
const log = (state, line) => { state.log = [line, ...(state.log || [])].slice(0, 40); };

/** Regole di costruzione Commander: minimo 100 carte, singleton (una copia per carta non terra base). */
export function validateMatchDeck(entries = [], cards = new Map()) {
    const errors = [];
    let total = 0;
    const names = new Map();
    for (const entry of entries) {
        const quantity = Math.max(0, Number(entry.quantity) || 0);
        const card = cards.get(String(entry.cardId)) || cards.get(entry.cardId);
        if (!quantity) continue;
        if (!card) { errors.push('Il mazzo contiene una carta che non è più nella raccolta.'); continue; }
        total += quantity;
        if (!isBasicLand(card)) {
            const key = String(card.name || entry.cardId);
            names.set(key, (names.get(key) || 0) + quantity);
        }
    }
    if (total < MATCH_RULES.minDeck) errors.push(`Servono almeno ${MATCH_RULES.minDeck} carte per giocare: il mazzo ne ha ${total}.`);
    for (const [name, copies] of names) {
        if (copies > MATCH_RULES.maxCopies) errors.push(`${name}: ${copies} copie. In Commander è consentita una sola copia per carta non terra base.`);
    }
    return { valid: errors.length === 0, errors: [...new Set(errors)], total };
}

/** Espande le quantità in copie fisiche, ognuna con un identificativo unico. */
export function expandDeck(cards = [], ownerId = 'p') {
    const copies = [];
    for (const card of cards) {
        const quantity = Math.max(0, Number(card.quantity) || 1);
        for (let index = 0; index < quantity; index += 1) {
            copies.push({ ...card, quantity: 1, uid: `${ownerId}:${card.id}:${copies.length}` });
        }
    }
    return copies;
}

const colorIdentityOf = cards => [...new Set(cards.flatMap(card => card.colorIdentity || card.colors || []).filter(color => COLORS.includes(color)))];

function preparePlayer(cards, name, ownerId, commanders = []) {
    const library = shuffle(expandDeck(cards, ownerId));
    const commanderCards = (commanders || []).map(card => ({ ...card, isCommander: true, uid: `${ownerId}:commander:${card.id}` }));
    return {
        name,
        life: MATCH_RULES.startingLife,
        hand: library.splice(0, MATCH_RULES.openingHand),
        library,
        battlefield: [],
        graveyard: [],
        exile: [],
        commandZone: commanderCards,
        commanderCasts: Object.fromEntries(commanderCards.map(card => [card.uid, 0])),
        commanderDamage: {},
        manaPool: emptyManaPool(),
        colorIdentity: colorIdentityOf([...cards, ...commanderCards]),
        landsPlayed: 0,
        mulligans: 0,
        cardsToBottom: 0,
        keptHand: false,
        mulliganBottom: [],
        eliminated: false
    };
}

/** Crea la partita: mescola i mazzi e distribuisce sette carte a testa. */
export function createMatch({ players = [], startingPlayer = null } = {}) {
    if (players.length < 2) throw new Error('Servono almeno due giocatori con un mazzo confermato.');
    if (players.length > MATCH_RULES.maxPlayers) throw new Error(`Il tavolo ammette al massimo ${MATCH_RULES.maxPlayers} giocatori.`);
    const playersData = {};
    const playerNames = {};
    for (const entry of players) {
        if (!entry?.id) throw new Error('Giocatore senza identificativo.');
        if (!Array.isArray(entry.cards) || !entry.cards.length) throw new Error(`${entry.name || 'Un giocatore'} non ha confermato un mazzo.`);
        playersData[entry.id] = preparePlayer(entry.cards, entry.name || '', entry.id, entry.commanders || []);
        playerNames[entry.id] = entry.name || `Giocatore ${players.indexOf(entry) + 1}`;
    }
    const first = startingPlayer && playersData[startingPlayer] ? startingPlayer : players[0].id;
    return {
        version: 3,
        revision: 0,
        players: players.map(entry => entry.id),
        playerNames,
        playersData,
        startingPlayer: first,
        activePlayer: first,
        turn: 1,
        phase: 'main1',
        combat: null,
        mulliganActive: true,
        winner: null,
        pendingDiscard: false,
        log: ['Partita avviata: mulligan londinese, primo mulligan gratuito.']
    };
}

function settle(state) {
    // Il vincitore si annuncia una volta sola, anche se più azioni lo verificano.
    if (state.winner) return state;
    const survivors = state.players.filter(id => !state.playersData[id]?.eliminated);
    if (survivors.length === 1) {
        state.winner = survivors[0];
        log(state, `${playerName(state, survivors[0])} vince la partita.`);
    } else if (!survivors.length) {
        state.winner = 'draw';
        log(state, 'Nessun giocatore resta in partita: pareggio.');
    }
    return state;
}

function eliminate(state, id, reason) {
    const player = state.playersData[id];
    if (!player || player.eliminated) return state;
    player.eliminated = true;
    player.life = 0;
    log(state, `${playerName(state, id)} è fuori: ${reason}.`);
    return settle(state);
}

function drawCard(state, id, count = 1) {
    const player = state.playersData[id];
    for (let index = 0; index < count; index += 1) {
        if (!player.library.length) { eliminate(state, id, 'grimorio esaurito'); return state; }
        player.hand.push(player.library.shift());
    }
    return state;
}

function clearUntilPlayer(state) {
    for (const player of Object.values(state.playersData)) {
        for (const card of player.battlefield) { card.damageMarked = 0; card.turnBoost = { power: 0, toughness: 0 }; }
    }
}

/** Inizio turno: stappare, pulire i danni, pescare (il primo giocatore salta la prima pesca). */
function beginTurn(state, id) {
    state.activePlayer = id;
    state.combat = null;
    state.phase = 'main1';
    state.pendingDiscard = false;
    clearUntilPlayer(state);
    const player = state.playersData[id];
    // Lo stappare del turno toglie anche la debolezza da evocazione: una creatura
    // lanciata dopo questo momento resta "malata" fino al prossimo stappare.
    for (const card of player.battlefield) { card.tapped = false; card.summoningSick = false; }
    player.landsPlayed = 0;
    player.manaPool = emptyManaPool();
    const firstTurnSkipDraw = id === state.startingPlayer && state.turn === 1;
    if (!firstTurnSkipDraw) {
        drawCard(state, id);
        log(state, `Inizia il turno ${state.turn} di ${playerName(state, id)}: pesca una carta.`);
    } else {
        log(state, `Inizia la partita: tocca a ${playerName(state, id)} (nessuna pesca al primo turno).`);
    }
    return state;
}

function requiredBottom(player) {
    return Math.min(player.hand.length, Math.max(0, player.cardsToBottom || 0));
}

/** Mulligan: rimescola, pesca sette, poi mette in fondo una carta per mulligan (il primo è gratuito). */
export function mulliganAction(currentState, playerId, action, index = -1) {
    const state = clone(currentState);
    if (!state.mulliganActive) throw new Error('La mano iniziale è già stata scelta.');
    const player = requirePlayer(state, playerId);
    if (player.keptHand) throw new Error('Hai già tenuto la mano.');
    if (action === 'select') {
        const needed = requiredBottom(player);
        if (!needed) throw new Error('Con questa mano non devi mettere carte in fondo.');
        const chosen = new Set(player.mulliganBottom || []);
        if (chosen.has(index)) chosen.delete(index);
        else if (chosen.size < needed) chosen.add(index);
        else throw new Error(`Devi scegliere esattamente ${needed} carte da mettere in fondo.`);
        player.mulliganBottom = [...chosen].sort((a, b) => a - b);
        return state;
    }
    if (action === 'redraw') {
        player.library.push(...player.hand);
        shuffle(player.library);
        player.hand = player.library.splice(0, MATCH_RULES.openingHand);
        player.mulligans = (player.mulligans || 0) + 1;
        player.cardsToBottom = Math.max(0, player.mulligans - 1);
        player.mulliganBottom = [];
        log(state, `${playerName(state, playerId)} rimescola la mano (mulligan ${player.mulligans}).`);
        return state;
    }
    if (action !== 'keep') throw new Error('Azione di mulligan non riconosciuta.');
    const needed = requiredBottom(player);
    const chosen = [...new Set(player.mulliganBottom || [])].sort((a, b) => b - a);
    if (chosen.length !== needed) throw new Error(`Scegli ${needed} ${needed === 1 ? 'carta' : 'carte'} da mettere in fondo al grimorio.`);
    const bottom = chosen.map(position => player.hand.splice(position, 1)[0]).filter(Boolean);
    player.library.push(...bottom);
    player.mulliganBottom = [];
    player.keptHand = true;
    log(state, `${playerName(state, playerId)} tiene una mano da ${player.hand.length} carte.`);
    if (state.players.every(id => state.playersData[id]?.keptHand)) {
        state.mulliganActive = false;
        state.turn = 1;
        beginTurn(state, state.startingPlayer);
    }
    return state;
}

/** Gioca una terra: una sola per turno, solo durante una fase principale. */
export function playLand(currentState, playerId, uid) {
    const state = clone(currentState);
    const player = requireTurn(state, playerId);
    if (!['main1', 'main2'].includes(state.phase)) throw new Error('Le terre si giocano solo durante una fase principale.');
    if (player.landsPlayed >= 1) throw new Error('Hai già giocato una terra in questo turno.');
    const index = player.hand.findIndex(card => card.uid === uid);
    if (index < 0) throw new Error('La carta non è nella tua mano.');
    const card = player.hand[index];
    if (!isLand(card)) throw new Error(`${card.name} non è una terra.`);
    player.hand.splice(index, 1);
    player.landsPlayed += 1;
    player.battlefield.push({
        ...card,
        instanceId: card.uid,
        tapped: /enters(?: the battlefield)? tapped/i.test(oracleText(card)),
        summoningSick: false,
        counters: { plusOne: 0 },
        turnBoost: { power: 0, toughness: 0 }
    });
    log(state, `${playerName(state, playerId)} gioca ${card.name}.`);
    return state;
}

const manaUsable = (player, card) => isManaSource(card, player.colorIdentity)
    && !card.tapped
    && !(card.summoningSick && isCreature(card) && !hasKeyword(card, 'haste'));

/** Attiva una fonte di mana. Il colore è scelto dall'utente o automatico. */
export function tapMana(currentState, playerId, uid, color = 'auto') {
    const state = clone(currentState);
    const player = requireTurn(state, playerId);
    if (!['main1', 'combat', 'main2'].includes(state.phase)) throw new Error('Non puoi attivare mana adesso.');
    const card = player.battlefield.find(item => (item.instanceId || item.uid) === uid);
    if (!card) throw new Error('La carta non è sul tuo campo.');
    const options = manaProductionOptions(card, player.colorIdentity);
    if (!options.length) throw new Error(`${card.name} non produce mana.`);
    const desired = player.hand.filter(item => !isLand(item)).map(item => item.manaCost || '');
    tapManaSource(player, card, color, desired);
    log(state, `${playerName(state, playerId)} tappa ${card.name} per mana.`);
    return state;
}

function autoPay(state, player, cost, extraGeneric = 0) {
    if (!cost) return;
    if (canPayMana(player.manaPool, cost, 0, extraGeneric)) {
        player.manaPool = payMana(player.manaPool, cost, 0, extraGeneric);
        return;
    }
    const desired = player.hand.filter(card => !isLand(card)).map(card => ({ manaCost: card.manaCost || '', extraGeneric }));
    const sources = player.battlefield.filter(card => manaUsable(player, card));
    for (const source of sources) {
        if (canPayMana(player.manaPool, cost, 0, extraGeneric)) break;
        const options = manaProductionOptions(source, player.colorIdentity);
        if (!options.length) continue;
        const choice = options.length === 1 ? 0 : chooseManaProductionOption(player, source, desired);
        const index = choice >= 0 ? choice : 0;
        addManaProduction(player, source, index);
        source.tapped = true;
    }
    if (!canPayMana(player.manaPool, cost, 0, extraGeneric)) {
        throw new Error(`Mana insufficiente o colori errati per ${cost}. Riserva: ${manaPoolLabel(player.manaPool)}.`);
    }
    player.manaPool = payMana(player.manaPool, cost, 0, extraGeneric);
}

/** Lancia una magia dalla mano pagando il costo con la riserva e le terre disponibili. */
export function castSpell(currentState, playerId, uid, target = '') {
    const state = clone(currentState);
    const player = requireTurn(state, playerId);
    const instantSpeed = isInstant(player.hand.find(card => card.uid === uid) || {});
    if (!['main1', 'main2'].includes(state.phase) && !(state.phase === 'combat' && instantSpeed)) {
        throw new Error('Durante il combattimento puoi lanciare solo istantanei.');
    }
    let index = player.hand.findIndex(card => card.uid === uid);
    let fromCommandZone = false;
    if (index < 0) {
        const czIndex = (player.commandZone || []).findIndex(card => card.uid === uid);
        if (czIndex >= 0) { fromCommandZone = true; index = czIndex; }
        else throw new Error('La carta non è nella tua mano.');
    }
    const card = fromCommandZone ? player.commandZone[index] : player.hand[index];
    if (isLand(card)) throw new Error('Le terre si giocano dal pulsante Gioca terra.');
    // Tax del comandante: +2 incolore per ogni lancio precedente.
    const tax = fromCommandZone ? (player.commanderCasts?.[card.uid] || 0) * 2 : 0;
    const cost = tax > 0 ? `${card.manaCost || ''}{${tax}}` : (card.manaCost || '');
    autoPay(state, player, cost);
    if (fromCommandZone) {
        player.commandZone.splice(index, 1);
        player.commanderCasts = player.commanderCasts || {};
        player.commanderCasts[card.uid] = (player.commanderCasts[card.uid] || 0) + 1;
    } else {
        player.hand.splice(index, 1);
    }
    if (isPermanentCard(card)) {
        const permanent = {
            ...card,
            instanceId: card.uid,
            tapped: /enters(?: the battlefield)? tapped/i.test(oracleText(card)),
            summoningSick: isCreature(card) && !hasKeyword(card, 'haste'),
            damageMarked: 0,
            counters: { plusOne: 0 },
            turnBoost: { power: 0, toughness: 0 }
        };
        player.battlefield.push(permanent);
        log(state, `${playerName(state, playerId)} lancia ${card.name}.`);
        state.log = [...resolveOracleText(permanent, state, playerId, target, 0, true).log, ...state.log];
    } else {
        player.graveyard.push(card);
        log(state, `${playerName(state, playerId)} lancia ${card.name}.`);
        state.log = [...resolveOracleText(card, state, playerId, target, 0, false).log, ...state.log];
    }
    return settle(state);
}

/** Dichiarazione degli attaccanti: creature stappate, non appena evocate, senza Defender. */
export function declareAttackers(currentState, playerId, uids = [], defenderId = '') {
    const state = clone(currentState);
    const player = requireTurn(state, playerId);
    if (state.phase !== 'combat') throw new Error('Siamo fuori dal combattimento.');
    if (state.combat) throw new Error('Gli attaccanti sono già stati dichiarati.');
    const opponents = state.players.filter(id => id !== playerId && !state.playersData[id]?.eliminated);
    if (!opponents.length) throw new Error('Non ci sono avversari da attaccare.');
    const defender = defenderId && opponents.includes(defenderId) ? defenderId : opponents[0];
    const attackers = [];
    for (const uid of uids) {
        const card = player.battlefield.find(item => (item.instanceId || item.uid) === uid);
        if (!card) throw new Error('Una creatura scelta non è sul tuo campo.');
        if (!isCreature(card)) throw new Error(`${card.name} non è una creatura.`);
        if (card.tapped) throw new Error(`${card.name} è tappata.`);
        if (card.summoningSick) throw new Error(`${card.name} ha ancora la debolezza da evocazione.`);
        if (hasKeyword(card, 'defender')) throw new Error(`${card.name} non può attaccare.`);
        attackers.push(card);
    }
    if (!attackers.length) {
        state.combat = null;
        state.phase = 'main2';
        log(state, `${playerName(state, playerId)} non attacca.`);
        return state;
    }
    for (const card of attackers) {
        if (!hasKeyword(card, 'vigilance')) card.tapped = true;
        card.attacking = true;
    }
    state.combat = {
        step: 'blockers',
        attackerIds: attackers.map(card => card.instanceId || card.uid),
        defender,
        blockers: {},
        damageDone: false
    };
    log(state, `${playerName(state, playerId)} attacca ${playerName(state, defender)} con ${attackers.length} ${attackers.length === 1 ? 'creatura' : 'creature'}.`);
    return state;
}

/** Blocchi: il difensore assegna una creatura stappata a ciascun attaccante. */
export function declareBlockers(currentState, playerId, assignments = {}) {
    const state = clone(currentState);
    requirePlayer(state, playerId);
    if (state.phase !== 'combat' || !state.combat) throw new Error('Non ci sono attaccanti da bloccare.');
    if (state.combat.step !== 'blockers') throw new Error('I blocchi sono già stati dichiarati.');
    if (state.combat.defender !== playerId) throw new Error('Solo il giocatore attaccato dichiara i blocchi.');
    const player = state.playersData[playerId];
    const blockers = {};
    const used = new Set();
    for (const [attackerId, blockerId] of Object.entries(assignments || {})) {
        if (!blockerId) continue;
        if (!state.combat.attackerIds.includes(attackerId)) throw new Error('Attaccante non valido.');
        const blocker = player.battlefield.find(item => (item.instanceId || item.uid) === blockerId);
        if (!blocker || !isCreature(blocker)) throw new Error('Bloccante non valido.');
        if (blocker.tapped) throw new Error(`${blocker.name} è tappata e non può bloccare.`);
        if (used.has(blockerId)) throw new Error(`${blocker.name} non può bloccare due attaccanti.`);
        used.add(blockerId);
        blocker.blocking = attackerId;
        blockers[attackerId] = blockerId;
    }
    state.combat.blockers = blockers;
    state.combat.step = 'damage';
    log(state, Object.keys(blockers).length
        ? `${playerName(state, playerId)} blocca ${Object.keys(blockers).length} ${Object.keys(blockers).length === 1 ? 'attaccante' : 'attaccanti'}.`
        : `${playerName(state, playerId)} non blocca.`);
    return state;
}

const damageAssignments = state => {
    const active = state.playersData[state.activePlayer];
    const defender = state.playersData[state.combat.defender];
    return { active, defender };
};

const lethal = (card, damage) => (hasKeyword(card, 'deathtouch') && damage > 0) || damage >= toughnessOf(card);

function damagePass(state, firstStrikeOnly) {
    const { active, defender } = damageAssignments(state);
    const strike = card => hasKeyword(card, 'first strike') || hasKeyword(card, 'double strike');
    const attackers = state.combat.attackerIds
        .map(uid => active.battlefield.find(card => (card.instanceId || card.uid) === uid))
        .filter(Boolean);
    const damageTo = new Map();
    const note = (card, amount) => {
        if (amount <= 0) return;
        const uid = card.instanceId || card.uid;
        damageTo.set(uid, (damageTo.get(uid) || 0) + amount);
    };
    // Prima colpo e doppio colpo colpiscono in due passaggi; le altre creature
    // una sola volta. Una creatura bloccata resta bloccata anche se il bloccante
    // è già morto nel passaggio di prima colpo.
    const strikesFirst = card => strike(card);
    const strikesNormally = card => !strike(card) || hasKeyword(card, 'double strike');
    let toPlayer = 0;
    for (const attacker of attackers) {
        if (firstStrikeOnly ? !strikesFirst(attacker) : !strikesNormally(attacker)) continue;
        const uid = attacker.instanceId || attacker.uid;
        const damage = powerOf(attacker);
        const blockerId = state.combat.blockers?.[uid];
        const blocker = blockerId ? defender.battlefield.find(card => (card.instanceId || card.uid) === blockerId) : null;
        if (!blockerId) {
            // Attaccante non bloccato: il danno va al giocatore attaccato.
            toPlayer += damage;
            if (attacker.isCommander) {
                defender.commanderDamage = defender.commanderDamage || {};
                const key = attacker.uid || uid;
                defender.commanderDamage[key] = (defender.commanderDamage[key] || 0) + damage;
            }
            if (hasKeyword(attacker, 'lifelink')) active.life += damage;
            continue;
        }
        if (!blocker) continue;
        if (firstStrikeOnly ? strikesFirst(blocker) : strikesNormally(blocker)) {
            const blockerDamage = powerOf(blocker);
            note(attacker, blockerDamage);
            if (hasKeyword(blocker, 'lifelink')) defender.life += blockerDamage;
        }
        // Trapassare assegna solo il danno letale al bloccante e il resto al giocatore.
        const already = blocker.damageMarked || 0;
        const needed = Math.max(0, toughnessOf(blocker) - already);
        const trample = hasKeyword(attacker, 'trample');
        const toBlocker = trample ? Math.min(damage, needed) : damage;
        note(blocker, toBlocker);
        if (hasKeyword(attacker, 'lifelink')) active.life += toBlocker;
        if (trample) {
            toPlayer += damage - toBlocker;
            if (attacker.isCommander && (damage - toBlocker) > 0) {
                defender.commanderDamage = defender.commanderDamage || {};
                const key = attacker.uid || uid;
                defender.commanderDamage[key] = (defender.commanderDamage[key] || 0) + (damage - toBlocker);
            }
        }
    }
    for (const [uid, amount] of damageTo) {
        const owner = Object.values(state.playersData)
            .find(player => player.battlefield.some(card => (card.instanceId || card.uid) === uid));
        const card = owner?.battlefield.find(item => (item.instanceId || item.uid) === uid);
        if (card) card.damageMarked = (card.damageMarked || 0) + amount;
    }
    if (toPlayer > 0) {
        defender.life -= toPlayer;
        log(state, `${toPlayer} danni a ${playerName(state, state.combat.defender)}.`);
    }
    for (const player of Object.values(state.playersData)) {
        const dead = player.battlefield.filter(card => (card.damageMarked || 0) > 0 && lethal(card, card.damageMarked || 0));
        if (!dead.length) continue;
        player.battlefield = player.battlefield.filter(card => !dead.includes(card));
        for (const card of dead) {
            const cleaned = (() => { const { instanceId, damageMarked, turnBoost, counters, attacking, blocking, summoningSick, tapped, ...rest } = card; return rest; })();
            if (card.isCommander) { player.commandZone = player.commandZone || []; player.commandZone.push(cleaned); }
            else { player.graveyard.push(cleaned); }
        }
        for (const card of dead) log(state, `${card.name} muore.`);
    }
    const defenderId = state.combat.defender;
    if (state.playersData[defenderId]?.life <= 0) eliminate(state, defenderId, 'punti vita a zero');
    // Danni da comandante: 21 da un singolo comandante eliminano il giocatore.
    const def = state.playersData[defenderId];
    if (def && !def.eliminated && def.commanderDamage) {
        for (const [key, amount] of Object.entries(def.commanderDamage)) {
            if (amount >= MATCH_RULES.commanderDamageLethal) { eliminate(state, defenderId, '21 danni da un singolo comandante'); break; }
        }
    }
    return state;
}

/** Risolve il danno da combattimento: prima colpo, poi danno normale, simultanei. */
export function resolveCombat(currentState, playerId) {
    const state = clone(currentState);
    requireTurn(state, playerId);
    if (state.phase !== 'combat' || !state.combat) throw new Error('Nessun combattimento da risolvere.');
    if (state.combat.step !== 'damage') throw new Error('Prima vanno dichiarati i blocchi.');
    if (state.winner) return state;
    damagePass(state, true);
    if (!state.winner) damagePass(state, false);
    state.combat.damageDone = true;
    state.combat.step = 'done';
    for (const player of Object.values(state.playersData)) {
        for (const card of player.battlefield) { delete card.attacking; delete card.blocking; }
    }
    return settle(state);
}

/** Passa alla fase successiva; a fine turno tocca al giocatore seguente. */
export function advancePhase(currentState, playerId) {
    const state = clone(currentState);
    const player = requireTurn(state, playerId);
    if (state.phase === 'main1') {
        state.phase = 'combat';
        state.combat = null;
        log(state, `${playerName(state, playerId)} entra nella fase di combattimento.`);
        return state;
    }
    if (state.phase === 'combat') {
        if (state.combat && state.combat.step !== 'done') throw new Error('Dichiara gli attaccanti, i blocchi e risolvi il danno.');
        state.phase = 'main2';
        state.combat = null;
        log(state, `${playerName(state, playerId)} passa alla seconda fase principale.`);
        return state;
    }
    if (state.phase === 'main2') {
        state.phase = 'end';
        state.pendingDiscard = player.hand.length > MATCH_RULES.openingHand;
        if (state.pendingDiscard) log(state, `${playerName(state, playerId)} deve scartare fino a sette carte.`);
        return state;
    }
    if (player.hand.length > MATCH_RULES.openingHand) {
        throw new Error(`Scarta ${player.hand.length - MATCH_RULES.openingHand} carte prima di chiudere il turno.`);
    }
    const index = state.players.indexOf(playerId);
    let step = 1, nextId = state.players[(index + step) % state.players.length];
    while (state.playersData[nextId]?.eliminated && step < state.players.length) {
        step += 1;
        nextId = state.players[(index + step) % state.players.length];
    }
    if (nextId === state.startingPlayer) state.turn += 1;
    player.manaPool = emptyManaPool();
    return beginTurn(state, nextId);
}

/** Scarta le carte scelte (solo nella fase finale, fino a sette in mano). */
export function discardCards(currentState, playerId, uids = []) {
    const state = clone(currentState);
    const player = requirePlayer(state, playerId);
    if (!uids.length) throw new Error('Scegli almeno una carta da scartare.');
    for (const uid of uids) {
        const index = player.hand.findIndex(card => card.uid === uid);
        if (index < 0) throw new Error('Una delle carte scelte non è in mano.');
        const [card] = player.hand.splice(index, 1);
        player.graveyard.push(card);
        log(state, `${playerName(state, playerId)} scarta ${card.name}.`);
    }
    return state;
}

/** Aggiunge o toglie punti vita: serve per gli effetti che il risolutore non automatizza. */
export function adjustLife(currentState, playerId, targetId, delta) {
    const state = clone(currentState);
    requirePlayer(state, playerId);
    const target = state.playersData[targetId];
    if (!target) throw new Error('Giocatore non valido.');
    target.life += Number(delta) || 0;
    log(state, `${playerName(state, targetId)}: ${delta > 0 ? '+' : ''}${Number(delta)} punti vita (${target.life}).`);
    if (target.life <= 0) eliminate(state, targetId, 'punti vita a zero');
    return settle(state);
}

/** Abbandono: il giocatore esce e la partita prosegue fra i superstiti. */
export function concedeMatch(currentState, playerId) {
    const state = clone(currentState);
    if (!state.playersData?.[playerId]) throw new Error('Non fai parte di questa partita.');
    if (state.winner) return state;
    eliminate(state, playerId, 'ha lasciato il tavolo');
    if (!state.winner && state.activePlayer === playerId) {
        const index = state.players.indexOf(playerId);
        let step = 1, nextId = state.players[(index + step) % state.players.length];
        while (state.playersData[nextId]?.eliminated && step < state.players.length) {
            step += 1;
            nextId = state.players[(index + step) % state.players.length];
        }
        return beginTurn(state, nextId);
    }
    return state;
}

export const matchSummary = state => ({
    turn: state.turn,
    phase: PHASE_LABEL[state.phase] || state.phase,
    active: state.playerNames?.[state.activePlayer] || '',
    winner: state.winner
});
