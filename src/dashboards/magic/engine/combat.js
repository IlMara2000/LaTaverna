// Combattimento (CR 508–510).
//
// Due cose che il motore storico non aveva: un attaccante può essere bloccato
// da più creature, e il danno si assegna *in ordine* (CR 509.2, 510.1c). Con un
// solo bloccante l'ordine non esiste e il risultato è identico a prima; con due
// o più, l'attaccante sceglie chi colpisce per primo, e non può passare al
// secondo finché il primo non ha ricevuto danno letale.
//
// Il danno da combattimento è simultaneo (CR 510.2): si raccolgono tutti i danni
// e solo alla fine si scrivono sulle carte, altrimenti una creatura già morta
// smetterebbe di fare danno alle altre.

import { powerOf, settleState, toughnessOf } from '../../magicMatchEngine.js';
import { hasKeyword } from '../../magicEffects.js';
import { openChoice } from './choices.js';
import { hasPriority, resetPriority } from './priority.js';
import { applyStateBasedActions } from './sba.js';

const idOf = card => String(card?.instanceId ?? card?.uid ?? card?.id ?? '');
const isCreature = card => /\bcreature\b/i.test(String(card?.typeLine || ''));
const playerName = (state, id) => state.playerNames?.[id] || `Giocatore ${state.players.indexOf(id) + 1}`;
const log = (state, line) => { state.log = [line, ...(state.log || [])].slice(0, 40); };

const asList = value => (Array.isArray(value) ? value.map(String) : (value ? [String(value)] : []));

/**
 * Bloccanti dichiarati. Accetta sia una creatura per attaccante (la forma dei
 * dati vecchi) sia un elenco: `{ attaccante: ['bloccante-1', 'bloccante-2'] }`.
 * Volare e portata si applicano a ogni bloccante, non all'elenco.
 */
export function declareBlockers(currentState, playerId, { blockers = {}, order = {} } = {}) {
    const state = structuredClone(currentState);
    const player = state.playersData?.[playerId];
    if (!player) throw new Error('Non fai parte di questa partita.');
    if (state.winner) throw new Error('La partita è conclusa.');
    if (state.phase !== 'combat' || !state.combat) throw new Error('Non ci sono attaccanti da bloccare.');
    if (state.combat.step !== 'blockers') throw new Error('I blocchi sono già stati dichiarati.');
    if (state.combat.defender !== playerId) throw new Error('Solo il giocatore attaccato dichiara i blocchi.');
    if (state.combat.blockersDeclared) throw new Error('I blocchi sono già stati dichiarati.');
    if (state.pendingChoice) throw new Error('C’è una scelta in sospeso: prima si risolve quella.');
    const active = state.playersData[state.activePlayer];
    const record = {};
    const chosen = {};
    const used = new Set();
    for (const [attackerId, value] of Object.entries(blockers || {})) {
        const list = asList(value);
        if (!list.length) continue;
        if (!state.combat.attackerIds.includes(attackerId)) throw new Error('Attaccante non valido.');
        const attacker = (active.battlefield || []).find(card => idOf(card) === attackerId);
        const ids = [];
        for (const blockerId of list) {
            const blocker = (player.battlefield || []).find(card => idOf(card) === blockerId);
            if (!blocker || !isCreature(blocker)) throw new Error('Bloccante non valido.');
            if (blocker.tapped) throw new Error(`${blocker.name} è tappata e non può bloccare.`);
            if (blocker.cannotBlock) throw new Error(`${blocker.name} non può bloccare in questo turno.`);
            if (used.has(blockerId)) throw new Error(`${blocker.name} non può bloccare due attaccanti.`);
            if (attacker && hasKeyword(attacker, 'flying')
                && !hasKeyword(blocker, 'flying') && !hasKeyword(blocker, 'reach')) {
                throw new Error(`${blocker.name} non ha volare né portata: non può bloccare ${attacker.name}.`);
            }
            used.add(blockerId);
            blocker.blocking = attackerId;
            ids.push(blockerId);
        }
        record[attackerId] = ids;
    }

    // Ordine del danno (CR 509.3): lo sceglie l'attaccante. Se arriva già con la
    // dichiarazione si usa quello, altrimenti vale l'ordine di dichiarazione e
    // l'attaccante riceve la domanda prima che si possa passare la priorità.
    const orderRecord = {};
    for (const [attackerId, ids] of Object.entries(record)) {
        const requested = asList(order?.[attackerId]);
        if (requested.length && requested.length === ids.length && requested.every(id => ids.includes(id))) {
            orderRecord[attackerId] = requested;
        } else {
            orderRecord[attackerId] = ids;
        }
    }
    state.combat.blockers = record;
    state.combat.order = orderRecord;
    state.combat.blockersDeclared = true;
    log(state, Object.keys(record).length
        ? `${playerName(state, playerId)} blocca ${Object.values(record).reduce((sum, ids) => sum + ids.length, 0)} ${Object.keys(record).length === 1 ? 'attaccante' : 'attaccanti'}.`
        : `${playerName(state, playerId)} non blocca.`);

    const ambiguous = Object.entries(record).find(([attackerId, ids]) => ids.length > 1
        && !(asList(order?.[attackerId]).length));
    if (ambiguous) {
        const [attackerId, ids] = ambiguous;
        const attacker = (active.battlefield || []).find(card => idOf(card) === attackerId);
        openChoice(state, {
            kind: 'orderBlockers',
            playerId: state.activePlayer,
            prompt: `Ordine del danno di ${attacker?.name || 'attaccante'}`,
            options: ids.map(id => ({
                id,
                label: (player.battlefield || []).find(card => idOf(card) === id)?.name || id
            })),
            min: ids.length,
            max: ids.length,
            sourceId: attackerId,
            meta: { attackerId }
        });
    }
    resetPriority(state, state.activePlayer);
    return state;
}

/** L'attaccante cambia l'ordine dei propri bloccanti (CR 509.3) prima del danno. */
export function setBlockerOrder(currentState, playerId, { attackerId, order = [] } = {}) {
    const state = structuredClone(currentState);
    if (!state.combat) throw new Error('Non c’è nessun combattimento.');
    if (state.activePlayer !== playerId) throw new Error('L’ordine dei bloccanti spetta a chi attacca.');
    if (state.combat.step !== 'blockers') throw new Error('L’ordine si sceglie prima del danno.');
    const blockers = asList(state.combat.blockers?.[attackerId]);
    const requested = asList(order);
    if (!blockers.length) throw new Error('Quell’attaccante non è bloccato.');
    if (requested.length !== blockers.length || requested.some(id => !blockers.includes(id)) || new Set(requested).size !== requested.length) {
        throw new Error('L’ordine deve contenere tutti i bloccanti di quell’attaccante, una volta ciascuno.');
    }
    state.combat.order = { ...(state.combat.order || {}), [attackerId]: requested };
    if (state.pendingChoice?.kind === 'orderBlockers' && state.pendingChoice.sourceId === attackerId) {
        state.pendingChoice = null;
    }
    return state;
}

const strikesFirst = card => hasKeyword(card, 'first strike') || hasKeyword(card, 'double strike');
const strikesNormally = card => !hasKeyword(card, 'first strike') || hasKeyword(card, 'double strike');

/** Danno letale da assegnare in ordine: con tocco letale ne basta uno (CR 510.1c). */
const lethalNeeded = (attacker, blocker, marked) => (hasKeyword(attacker, 'deathtouch')
    ? 1
    : Math.max(0, toughnessOf(blocker) - Math.max(0, Number(marked) || 0)));

function firstStrikePassNeeded(state) {
    const active = state.playersData[state.activePlayer];
    const defender = state.playersData[state.combat.defender];
    const attackers = (state.combat.attackerIds || [])
        .map(uid => (active?.battlefield || []).find(card => idOf(card) === uid))
        .filter(Boolean);
    const blockers = Object.values(state.combat.blockers || {})
        .flatMap(ids => asList(ids))
        .map(id => (defender?.battlefield || []).find(card => idOf(card) === id))
        .filter(Boolean);
    return [...attackers, ...blockers].some(card => strikesFirst(card));
}

/**
 * Applica una passata di danno (CR 510.4: una sola se nessuno ha prima colpo).
 * `damageStep` dice a che punto siamo: null (inizio), 'first', 'done'.
 */
export function dealCombatDamage(currentState) {
    const state = structuredClone(currentState);
    if (!state.combat) throw new Error('Nessun combattimento da risolvere.');
    if (state.winner) return state;
    if (state.combat.damageStep === 'done') throw new Error('Il danno da combattimento è già stato assegnato.');
    const pass = !state.combat.damageStep
        ? (firstStrikePassNeeded(state) ? 'first' : 'normal')
        : 'normal';
    const active = state.playersData[state.activePlayer];
    const defender = state.playersData[state.combat.defender];
    const inPass = (card, which) => (which === 'first' ? strikesFirst(card) : strikesNormally(card));
    const attackers = (state.combat.attackerIds || [])
        .map(uid => (active?.battlefield || []).find(card => idOf(card) === uid))
        .filter(Boolean);
    const damage = new Map();
    const add = (card, amount) => {
        if (amount <= 0 || !card) return;
        const uid = idOf(card);
        damage.set(uid, (damage.get(uid) || 0) + amount);
    };
    let toPlayer = 0;
    const commanderHits = [];

    for (const attacker of attackers) {
        if (!inPass(attacker, pass)) continue;
        const attackerId = idOf(attacker);
        const ordered = asList(state.combat.order?.[attackerId] || state.combat.blockers?.[attackerId])
            .map(id => (defender?.battlefield || []).find(card => idOf(card) === id))
            .filter(Boolean);
        let remaining = Math.max(0, powerOf(attacker));
        if (!remaining) continue;
        if (!ordered.length) {
            // Non bloccato: il danno va al giocatore. Se i bloccanti sono spariti
            // dopo il primo colpo, ci va solo con trapassare (CR 510.1c).
            const wasBlocked = asList(state.combat.blockers?.[attackerId]).length > 0;
            if (!wasBlocked || hasKeyword(attacker, 'trample')) {
                toPlayer += remaining;
                if (attacker.isCommander) commanderHits.push({ attacker, amount: remaining });
                if (hasKeyword(attacker, 'lifelink')) active.life += remaining;
            }
            continue;
        }
        const trample = hasKeyword(attacker, 'trample');
        const lifelink = hasKeyword(attacker, 'lifelink');
        // CR 510.1c: si assegna in ordine, e non si passa al bloccante dopo
        // finché quello prima non ha ricevuto danno letale. Senza trapassare il
        // danno che avanza resta comunque sull'ultimo bloccante dell'ordine: è
        // la scelta predefinita, perché il tavolo non chiede ancora di
        // distribuire il danno a mano.
        let last = null;
        for (const blocker of ordered) {
            last = blocker;
            if (remaining <= 0) break;
            const needed = lethalNeeded(attacker, blocker, damage.get(idOf(blocker)) || blocker.damageMarked || 0);
            const amount = Math.min(remaining, needed);
            add(blocker, amount);
            // Il danno da tocco letale uccide anche se non arriva alla
            // costituzione: la SBA 704.5h ha bisogno di saperlo.
            if (amount > 0 && hasKeyword(attacker, 'deathtouch')) blocker.deathtouchDamage = 1;
            if (lifelink) active.life += amount;
            remaining -= amount;
        }
        if (remaining > 0 && trample) {
            toPlayer += remaining;
            if (attacker.isCommander) commanderHits.push({ attacker, amount: remaining });
            if (lifelink) active.life += remaining;
            remaining = 0;
        }
        if (remaining > 0 && last) {
            add(last, remaining);
            if (lifelink) active.life += remaining;
        }
    }

    // I bloccanti rispondono nello stesso istante, anche se stanno per morire.
    for (const attacker of attackers) {
        if (!inPass(attacker, pass)) continue;
        const ordered = asList(state.combat.order?.[idOf(attacker)] || state.combat.blockers?.[idOf(attacker)])
            .map(id => (defender?.battlefield || []).find(card => idOf(card) === id))
            .filter(Boolean);
        for (const blocker of ordered) {
            if (!inPass(blocker, pass)) continue;
            const amount = Math.max(0, powerOf(blocker));
            add(attacker, amount);
            if (hasKeyword(blocker, 'lifelink')) defender.life += amount;
            if (hasKeyword(blocker, 'deathtouch') && amount > 0) attacker.deathtouchDamage = 1;
        }
    }

    for (const [uid, amount] of damage) {
        const owner = state.players.find(id => (state.playersData[id]?.battlefield || []).some(card => idOf(card) === uid));
        const card = owner ? (state.playersData[owner].battlefield || []).find(item => idOf(item) === uid) : null;
        if (card) card.damageMarked = (Number(card.damageMarked) || 0) + amount;
    }

    if (toPlayer > 0 && defender) {
        defender.life -= toPlayer;
        log(state, `${toPlayer} danni a ${playerName(state, state.combat.defender)}.`);
    }
    for (const { attacker, amount } of commanderHits) {
        if (!defender || amount <= 0) continue;
        defender.commanderDamage = defender.commanderDamage || {};
        const key = attacker.uid || idOf(attacker);
        defender.commanderDamage[key] = (Number(defender.commanderDamage[key]) || 0) + amount;
    }

    state.combat.damageStep = pass === 'first' ? 'first' : 'done';
    // Le SBA vanno applicate sul danno appena scritto: `applyStateBasedActions`
    // restituisce una copia, quindi il risultato va ripreso, non ignorato.
    return settleState(applyStateBasedActions(state));
}

/**
 * Chiusura del combattimento: si tolgono i segnalini di attacco e difesa.
 * Il passo lo decide `turn.js`, che sa a che passo siamo.
 */
export function endCombatMarkers(currentState) {
    const state = structuredClone(currentState);
    for (const player of Object.values(state.playersData || {})) {
        for (const card of player.battlefield || []) {
            delete card.attacking;
            delete card.blocking;
            delete card.deathtouchDamage;
        }
    }
    if (state.combat) state.combat.step = 'done';
    return state;
}

/** Comandi di combattimento per chi ha la priorità. Il tavolo non li calcola. */
export function combatActions(state, playerId) {
    const out = [];
    if (!hasPriority(state, playerId) || !state.combat) return out;
    const step = state.step || '';
    if (step === 'declareBlockers' && state.combat.defender === playerId && !state.combat.blockersDeclared) {
        const defender = state.playersData[playerId];
        const choices = {};
        for (const attackerId of state.combat.attackerIds || []) {
            const attacker = (state.playersData[state.activePlayer]?.battlefield || []).find(card => idOf(card) === attackerId);
            choices[attackerId] = (defender.battlefield || [])
                .filter(card => isCreature(card) && !card.tapped && !card.cannotBlock)
                .filter(card => !attacker || !hasKeyword(attacker, 'flying') || hasKeyword(card, 'flying') || hasKeyword(card, 'reach'))
                .map(idOf);
        }
        out.push({
            type: 'declareBlockers', playerId, blockers: {}, legal: true, requiresSelection: true,
            multi: true, choices, id: 'declareBlockers:select', label: 'Scegli chi blocca'
        });
    }
    return out;
}
