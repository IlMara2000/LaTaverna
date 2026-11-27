// Azioni legali: l'unico modo per far muovere la partita.
//
// Una mossa è un oggetto serializzabile (`{ type, playerId, ... }`), non una
// chiusura JavaScript: così la stessa mossa può essere validata dall'host,
// spedita in multiplayer o riprodotta in un test. `legalActions` è l'elenco
// che l'interfaccia ha il diritto di mostrare: tutto il resto non esiste.
//
// Il motore storico resta l'esecutore: qui non si duplicano le regole, si
// chiede a lui, su una copia, se la mossa è possibile.

import {
    activateAbility, activateLoyalty, adjustLife, advancePhase, castResponse, castSpell, concedeMatch, declareAttackers,
    declareBlockers, discardCards, mulliganAction, passTurn, playLand, resolveCombat, tapMana
} from '../../magicMatchEngine.js';
import { isManaSource, manaProductionOptions, spellNeedsTarget } from '../../magicRules.js';
import { parseCardAbilities } from '../../magicEffects.js';
import { answerChoice } from './choices.js';
import { combatActions, declareBlockers as declareBlockersMulti, setBlockerOrder } from './combat.js';
import { resetPriority } from './priority.js';
import { stepOf } from './state.js';
import { activateToStack, castToStack } from './stack.js';
import { advanceStep, isEngineState, passPriority } from './turn.js';

export const ACTION_TYPES = Object.freeze([
    'mulligan', 'pass', 'playLand', 'castSpell', 'castResponse', 'activateAbility', 'activateLoyalty', 'tapMana',
    'declareAttackers', 'declareBlockers', 'resolveCombat', 'advancePhase', 'discard', 'adjustLife', 'concede',
    // Mosse dello strato M1: priorità, stack, scelte e ordine dei bloccanti.
    'passPriority', 'castToStack', 'activateToStack', 'choose', 'orderBlockers', 'advanceStep'
]);

const isCreature = card => /\bcreature\b/i.test(String(card?.typeLine || ''));
const isLand = card => /\bland\b/i.test(String(card?.typeLine || ''));
const isInstant = card => /\binstant\b/i.test(String(card?.typeLine || ''));
const hasKeyword = (card, word) => (card?.keywords || []).some(keyword => String(keyword).toLowerCase() === word);
const idOf = card => String(card?.instanceId ?? card?.uid ?? card?.id ?? '');
const clone = value => structuredClone(value);

/** Esegue una mossa tipizzata. Le mosse non legali sollevano l'errore del motore. */
export function applyAction(state, action = {}) {
    if (!state) throw new Error('applyAction: stato di partita mancante.');
    const { type, playerId } = action;
    if (!ACTION_TYPES.includes(type)) throw new Error(`Azione non riconosciuta: ${type}.`);
    switch (type) {
        case 'mulligan': return mulliganAction(state, playerId, action.choice, action.index ?? -1);
        case 'pass': return passTurn(state, playerId, { skipCombat: Boolean(action.skipCombat) });
        case 'playLand': return playLand(state, playerId, action.uid);
        case 'castSpell': return castSpell(state, playerId, action.uid, action.target || '', action.mode ?? null, Number(action.xValue) || 0);
        case 'castResponse': return castResponse(state, playerId, action.uid, action.target || '');
        case 'activateAbility': return activateAbility(state, playerId, action.uid, action.index ?? 0, action.target || '');
        case 'activateLoyalty': return activateLoyalty(state, playerId, action.uid, action.index ?? 0, action.target || '');
        case 'tapMana': return tapMana(state, playerId, action.uid, action.color || 'auto');
        case 'declareAttackers': return declareAttackersForState(state, playerId, action);
        case 'declareBlockers': return isEngineState(state)
            ? declareBlockersMulti(state, playerId, { blockers: action.blockers || action.assignments || {}, order: action.order || {} })
            : declareBlockers(state, playerId, action.assignments || {});
        // Nello stato M1 il danno non si «risolve» con un pulsante: accade quando
        // tutti passano la priorità nel passo del danno (CR 510.2).
        case 'resolveCombat': return isEngineState(state)
            ? raise('Il danno da combattimento si risolve passando la priorità nel passo del danno.')
            : resolveCombat(state, playerId);
        case 'passPriority': return passPriority(state, playerId);
        case 'castToStack': return castToStack(state, playerId, { uid: action.uid, target: action.target || '', mode: action.mode ?? null, xValue: Number(action.xValue) || 0 });
        case 'activateToStack': return activateToStack(state, playerId, { uid: action.uid, index: action.index ?? 0, target: action.target || '' });
        case 'choose': return answerChoice(state, playerId, action.selection || []);
        case 'orderBlockers': return setBlockerOrder(state, playerId, { attackerId: action.attackerId, order: action.order || [] });
        case 'advanceStep': return advanceStep(state);
        case 'advancePhase': return advancePhase(state, playerId);
        case 'discard': return discardCards(state, playerId, action.uids || []);
        case 'adjustLife': return adjustLife(state, playerId, action.targetId || playerId, Number(action.delta) || 0);
        case 'concede': return concedeMatch(state, playerId);
        default: throw new Error(`Azione non gestita: ${type}.`);
    }
}

const raise = message => { throw new Error(message); };

/** Dichiarazione degli attaccanti che tiene allineato il passo corrente. */
function declareAttackersForState(state, playerId, action) {
    const next = declareAttackers(state, playerId, action.uids || [], action.defender || '');
    if (!isEngineState(next)) return next;
    if (next.combat) {
        next.combat.step = 'blockers';
        next.combat.blockersDeclared = false;
        next.step = 'declareBlockers';
    } else {
        next.step = 'main2';
    }
    resetPriority(next, next.activePlayer);
    return next;
}

/** La mossa è possibile? La prova si fa su una copia: nessun effetto collaterale. */
export const isLegal = (state, action) => {
    try { applyAction(clone(state), action); return true; } catch { return false; }
};

// L'identificativo della mossa deve essere unico nell'elenco: due «Vite ±1»
// hanno lo stesso bersaglio, e senza il delta la seconda sparirebbe in una mappa.
const legalAction = (action, label, extra = {}) => {
    const key = action.uid
        || action.choice
        || (action.index != null ? `#${action.index}` : '')
        || (action.delta != null ? `${action.delta > 0 ? '+' : ''}${action.delta}` : '')
        || action.targetId
        || 'x';
    return { ...action, id: `${action.type}:${key}`, label, legal: true, ...extra };
};

/**
 * I blocchi possibili: per ogni attaccante, i bloccanti legali del difensore.
 * Volare si blocca solo con volare o portata; una creatura tappata o già
 * assegnata non compare nemmeno fra le opzioni.
 */
function blockersAction(state, playerId, player) {
    const attackers = state.playersData?.[state.activePlayer]?.battlefield || [];
    const choices = {};
    for (const attackerId of state.combat.attackerIds || []) {
        const attacker = attackers.find(card => idOf(card) === attackerId);
        if (!attacker) continue;
        choices[attackerId] = (player.battlefield || [])
            .filter(card => isCreature(card) && !card.tapped && !card.cannotBlock)
            .filter(card => !hasKeyword(attacker, 'flying') || hasKeyword(card, 'flying') || hasKeyword(card, 'reach'))
            .map(card => idOf(card));
    }
    return {
        type: 'declareBlockers', playerId, assignments: {}, legal: true, requiresSelection: true,
        choices, id: 'declareBlockers:select', label: 'Scegli chi blocca'
    };
}

/**
 * L'elenco completo delle mosse che questo giocatore può fare adesso.
 * Le voci con `requiresSelection` chiedono all'interfaccia la scelta: la
 * selezione non è una mossa, quindi il motore espone solo le opzioni valide.
 */
export function legalActions(state, playerId) {
    const out = [];
    const player = state?.playersData?.[playerId];
    if (!state || !player || state.winner) return out;

    if (state.mulliganActive) {
        if (!player.keptHand) {
            out.push(legalAction({ type: 'mulligan', playerId, choice: 'keep' }, 'Tieni la mano'));
            out.push(legalAction({ type: 'mulligan', playerId, choice: 'redraw' }, 'Rimescola e pesca'));
        }
        return out;
    }

    // Stato M1: chi non ha la priorità non ha mosse, e una scelta aperta
    // precede qualunque cosa.
    if (isEngineState(state)) return engineLegalActions(state, playerId, player);

    const mine = state.activePlayer === playerId;
    const blocking = state.phase === 'combat' && state.combat?.step === 'blockers'
        && state.combat.defender === playerId;

    if (!mine) {
        // Fuori turno resta la risposta: istantaneo o lampo, pagabile.
        for (const card of player.hand || []) {
            if (!isInstant(card) && !hasKeyword(card, 'flash')) continue;
            if (!isLegal(state, { type: 'castResponse', playerId, uid: card.uid })) continue;
            out.push(legalAction(
                { type: 'castResponse', playerId, uid: card.uid },
                `Rispondi con ${card.name}`,
                { cardId: card.uid, requiresTarget: spellNeedsTarget(card) }
            ));
        }
        // Chi difende non ha il turno, ma sceglie i blocchi: senza questa voce
        // il difensore vedrebbe il pannello senza alcuna mossa legale.
        if (blocking) out.push(blockersAction(state, playerId, player));
        return out;
    }

    if (!(state.phase === 'combat' && state.combat?.step === 'blockers')) {
        out.push(legalAction(
            { type: 'pass', playerId },
            state.phase === 'combat' && !state.combat ? 'Non attacco' : 'Passa il turno',
            { skipCombat: state.phase === 'combat' && !state.combat }
        ));
    }

    const canPlayLand = ['main1', 'main2'].includes(state.phase) && (player.landsPlayed || 0) < 1;
    if (canPlayLand) {
        for (const card of player.hand || []) {
            if (!isLand(card)) continue;
            out.push(legalAction({ type: 'playLand', playerId, uid: card.uid }, `Gioca ${card.name}`, { cardId: card.uid }));
        }
    }

    for (const card of player.hand || []) {
        if (isLand(card)) continue;
        if (!isLegal(state, { type: 'castSpell', playerId, uid: card.uid })) continue;
        out.push(legalAction(
            { type: 'castSpell', playerId, uid: card.uid },
            `Lancia ${card.name}`,
            { cardId: card.uid, requiresTarget: spellNeedsTarget(card) }
        ));
    }

    for (const card of player.battlefield || []) {
        const uid = idOf(card);
        const canTap = isManaSource(card, player.colorIdentity || [])
            && !card.tapped
            && !(card.summoningSick && isCreature(card) && !hasKeyword(card, 'haste'))
            && manaProductionOptions(card, player.colorIdentity || []).length > 0;
        if (canTap) out.push(legalAction({ type: 'tapMana', playerId, uid }, `Mana da ${card.name}`, { cardId: uid }));
        parseCardAbilities(card).activated.forEach((ability, index) => {
            if (!ability.supported) return;
            if (!isLegal(state, { type: 'activateAbility', playerId, uid, index })) return;
            out.push(legalAction(
                { type: 'activateAbility', playerId, uid, index },
                `Attiva ${card.name}`,
                { cardId: uid, requiresTarget: /target/i.test(ability.text || '') }
            ));
        });
        parseCardAbilities(card).loyalty.forEach((ability, index) => {
            if (!ability.supported) return;
            if (!isLegal(state, { type: 'activateLoyalty', playerId, uid, index })) return;
            out.push(legalAction(
                { type: 'activateLoyalty', playerId, uid, index },
                `${card.name}: ${ability.text.split(':')[0].trim()}`,
                { cardId: uid, requiresTarget: /target/i.test(ability.text || '') }
            ));
        });
    }

    const commanderZone = player.commandZone || [];
    for (const card of commanderZone) {
        if (!isLegal(state, { type: 'castSpell', playerId, uid: card.uid })) continue;
        out.push(legalAction(
            { type: 'castSpell', playerId, uid: card.uid },
            `Lancia il comandante ${card.name}`,
            { cardId: card.uid, requiresTarget: spellNeedsTarget(card) }
        ));
    }

    if (state.phase === 'combat') {
        if (!state.combat) {
            const ready = (player.battlefield || [])
                .filter(card => isCreature(card) && !card.tapped && !card.summoningSick && !hasKeyword(card, 'defender'))
                .map(card => idOf(card));
            if (ready.length) {
                out.push({
                    type: 'declareAttackers', playerId, uids: [], legal: true, requiresSelection: true,
                    choices: ready, id: 'declareAttackers:select',
                    label: 'Scegli chi attacca', defender: state.players.find(id => id !== playerId && !state.playersData?.[id]?.eliminated) || ''
                });
            }
        } else if (blocking) {
            out.push(blockersAction(state, playerId, player));
        } else if (state.combat.step === 'damage') {
            out.push(legalAction({ type: 'resolveCombat', playerId }, 'Risolvi il danno'));
        }
    }

    if (state.pendingDiscard && (player.hand || []).length > 7) {
        out.push({
            type: 'discard', playerId, uids: [], legal: true, requiresSelection: true,
            choices: (player.hand || []).map(card => card.uid), id: 'discard:select',
            label: `Scarta ${(player.hand || []).length - 7}`
        });
    }

    out.push(legalAction({ type: 'adjustLife', playerId, targetId: playerId, delta: 1 }, 'Vite +1', { manual: true }));
    out.push(legalAction({ type: 'adjustLife', playerId, targetId: playerId, delta: -1 }, 'Vite −1', { manual: true }));

    return out;
}

/**
 * Le mosse di uno stato con priorità: passare, lanciare sullo stack, attivare,
 * dichiarare attacchi e blocchi, rispondere a una scelta. Nessuna di queste
 * esiste per chi non ha la priorità (CR 117.1a).
 */
function engineLegalActions(state, playerId, player) {
    const out = [];
    if (state.pendingChoice) {
        const choice = state.pendingChoice;
        if (choice.playerId !== playerId) return out;
        return [{
            type: 'choose', playerId, selection: [], legal: true, requiresSelection: true,
            choices: choice.options.map(option => option.id), min: choice.min, max: choice.max,
            prompt: choice.prompt, id: 'choose:select', label: choice.prompt
        }];
    }

    // Senza priorità non ci sono mosse: nemmeno «passa» (CR 117.1a).
    if (!state.priority || state.priority.playerId !== playerId) return out;

    const step = stepOf(state);
    const mine = state.activePlayer === playerId;
    const passing = { type: 'passPriority', playerId };
    out.push(legalAction(passing,
        step === 'declareAttackers' && mine ? 'Non attaccare' : 'Passa la priorità',
        { step }));

    const sorcerySpeed = ['main1', 'main2'].includes(step) && !(state.stack || []).length;
    if (sorcerySpeed && mine && (player.landsPlayed || 0) < 1) {
        for (const card of player.hand || []) {
            if (!isLand(card)) continue;
            out.push(legalAction({ type: 'playLand', playerId, uid: card.uid }, `Gioca ${card.name}`, { cardId: card.uid }));
        }
    }

    for (const card of [...(player.hand || []), ...(player.commandZone || [])]) {
        if (isLand(card)) continue;
        if (!isLegal(state, { type: 'castToStack', playerId, uid: card.uid })) continue;
        out.push(legalAction(
            { type: 'castToStack', playerId, uid: card.uid },
            `Lancia ${card.name}`,
            { cardId: card.uid, requiresTarget: spellNeedsTarget(card) }
        ));
    }

    for (const card of player.battlefield || []) {
        const uid = idOf(card);
        parseCardAbilities(card).activated.forEach((ability, index) => {
            if (!ability.supported) return;
            if (!isLegal(state, { type: 'activateToStack', playerId, uid, index })) return;
            out.push(legalAction(
                { type: 'activateToStack', playerId, uid, index },
                `Attiva ${card.name}`,
                { cardId: uid, requiresTarget: /target/i.test(ability.text || '') }
            ));
        });
    }

    if (step === 'declareAttackers' && mine) {
        const ready = (player.battlefield || [])
            .filter(card => isCreature(card) && !card.tapped && !card.summoningSick && !hasKeyword(card, 'defender'))
            .map(card => idOf(card));
        out.push({
            type: 'declareAttackers', playerId, uids: [], legal: true,
            requiresSelection: ready.length > 0, allowEmpty: true, choices: ready,
            id: 'declareAttackers:select',
            label: ready.length ? 'Scegli chi attacca' : 'Non attacca',
            defender: state.players.find(id => id !== playerId && !state.playersData?.[id]?.eliminated) || ''
        });
    }

    out.push(...combatActions(state, playerId));
    out.push(legalAction({ type: 'adjustLife', playerId, targetId: playerId, delta: 1 }, 'Vite +1', { manual: true }));
    out.push(legalAction({ type: 'adjustLife', playerId, targetId: playerId, delta: -1 }, 'Vite −1', { manual: true }));
    return out;
}

/** Solo le mosse che l'interfaccia deve mostrare come comandi di turno. */
export const turnActions = actions => actions.filter(action => !action.manual);
