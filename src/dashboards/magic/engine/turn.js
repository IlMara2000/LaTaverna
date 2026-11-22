// I passi veri (CR 500–514) e chi ha la priorità dentro ogni passo.
//
// Lo stato del motore storico aveva quattro fasi; qui i dodici passi delle
// regole sono lo stato vero, e la fase storica resta allineata perché gli
// effetti e il tavolo la leggono ancora. Stappa, mantenimento e pescata
// restano dentro `beginTurn` del motore storico: sono azioni di turno che non
// usano lo stack (CR 121.1 per la pescata), quindi non hanno una priorità da
// fermare. Dagli attaccanti in poi ogni passo si attraversa passando la
// priorità, come al tavolo.
//
// La regola d'oro: un passo non si salta se c'è una decisione aperta. Chi
// attacca senza dichiarare attaccanti non attacca (CR 508.8: il passo dei
// bloccanti non esiste), ma chi difende senza dichiarare blocchi ha comunque
// scelto di non bloccare.

import {
    MATCH_RULES, advancePhase, createMatch, declareAttackers
} from '../../magicMatchEngine.js';
import { STEP_INDEX, stepOf } from './state.js';
import { allPassed, alivePlayers, hasPriority, nextHolder, priorityHolder, resetPriority } from './priority.js';
import { openChoice } from './choices.js';
import { resolveTop } from './stack.js';
import { declareBlockers, dealCombatDamage, endCombatMarkers } from './combat.js';
import { applyStateBasedActions } from './sba.js';

export const ENGINE = 'm1';

export const isEngineState = state => Boolean(state && state.engine === ENGINE);

/** Lo stato diventa uno stato M1: passi, priorità, stack e scelte. */
export function withEngine(currentState) {
    const state = structuredClone(currentState);
    state.engine = ENGINE;
    state.step = stepOf(state);
    state.stack = state.stack || [];
    state.stackSeq = Number(state.stackSeq) || 0;
    state.pendingChoice = state.pendingChoice || null;
    resetPriority(state, state.activePlayer);
    return state;
}

/** Una partita nuova già con i passi veri: stessa distribuzione del motore storico. */
export function createEngineMatch(options = {}) {
    const state = withEngine(createMatch(options));
    state.log = ['Partita avviata con passi e priorità: mulligan londinese, primo mulligan gratuito.', ...state.log];
    return state;
}

/** Accetta anche uno stato storico: i test e l'interfaccia non devono saperlo. */
const normalize = state => (isEngineState(state) ? structuredClone(state) : withEngine(state));

function openDiscardChoice(state) {
    const player = state.playersData?.[state.activePlayer];
    if (!player || state.pendingChoice) return state;
    const excess = (player.hand || []).length - MATCH_RULES.openingHand;
    if (excess <= 0) return state;
    openChoice(state, {
        kind: 'discard',
        playerId: state.activePlayer,
        prompt: `Scarta ${excess} ${excess === 1 ? 'carta' : 'carte'} per chiudere il turno`,
        options: (player.hand || []).map(card => ({ id: card.uid, label: card.name || card.uid })),
        min: excess,
        max: excess
    });
    return state;
}

/**
 * Il passo successivo. Non passa dallo stack: i passi non sono magie.
 * `declareAttackers` e `declareBlockers` leggono `state.combat`, che è la
 * verità su chi attacca e chi blocca.
 */
export function advanceStep(currentState) {
    let state = normalize(currentState);
    if (state.winner || state.mulliganActive) return state;
    const active = state.activePlayer;
    const step = stepOf(state);

    if (step === 'main1') {
        state = advancePhase(state, active); // fase storica → combat
        state.step = 'beginCombat';
    } else if (step === 'beginCombat') {
        state.step = 'declareAttackers';
    } else if (step === 'declareAttackers') {
        if (state.combat?.attackerIds?.length) {
            state.combat.step = 'blockers';
            state.combat.blockersDeclared = false;
            state.step = 'declareBlockers';
        } else {
            // Nessun attaccante: il passo dei bloccanti non esiste (CR 508.8).
            state = declareAttackers(state, active, []);
            state.step = 'main2';
        }
    } else if (step === 'declareBlockers') {
        if (state.combat && !state.combat.blockersDeclared) {
            state = declareBlockers(state, state.combat.defender, {});
        }
        if (state.combat) {
            state.combat.step = 'damage';
            state.combat.damageStep = null;
        }
        state.step = 'combatDamage';
    } else if (step === 'combatDamage') {
        if (state.combat && state.combat.damageStep !== 'done') state = dealCombatDamage(state);
        state = endCombatMarkers(state);
        state.step = 'endCombat';
    } else if (step === 'endCombat') {
        state = endCombatMarkers(state);
        state = advancePhase(state, active); // combat → main2
        state.combat = null;
        state.step = 'main2';
    } else if (step === 'main2') {
        state = advancePhase(state, active); // main2 → end
        state.step = 'end';
        openDiscardChoice(state);
    } else if (step === 'end') {
        state.step = 'cleanup';
        state = applyStateBasedActions(state);
    } else if (step === 'cleanup') {
        state = advancePhase(state, active); // end → prossimo turno
        state.step = 'main1';
    }

    if (!state.winner) resetPriority(state, state.activePlayer);
    return state;
}

/**
 * Passo la priorità (CR 117.4). Quando tutti i giocatori vivi hanno passato in
 * successione, con lo stack pieno si risolve la cima; con lo stack vuoto si
 * cambia passo. Con una scelta aperta nessuno riceve la priorità (117.1a).
 */
export function passPriority(currentState, playerId) {
    let state = normalize(currentState);
    if (!state.playersData?.[playerId]) throw new Error('Non fai parte di questa partita.');
    if (state.winner) throw new Error('La partita è conclusa.');
    if (state.mulliganActive) throw new Error('Prima scegliete la mano iniziale.');
    if (state.pendingChoice) throw new Error(`C’è una scelta in sospeso: ${state.pendingChoice.prompt}`);
    if (priorityHolder(state) !== playerId) throw new Error('Non hai la priorità.');

    const passed = [...new Set([...(state.priority.passed || []), playerId])];
    state.priority = { playerId: state.priority.playerId, passed };
    if (!allPassed(state)) {
        state.priority = { playerId: nextHolder(state, playerId), passed };
        return state;
    }

    if ((state.stack || []).length) {
        state = resolveTop(state);
        state = applyStateBasedActions(state);
        if (!state.winner) resetPriority(state, state.activePlayer);
        return state;
    }

    // Danno da combattimento: è un'azione di turno che accade quando tutti
    // passano nel passo del danno (CR 510.2), non un passo da attraversare.
    if (stepOf(state) === 'combatDamage' && state.combat && state.combat.damageStep !== 'done') {
        state = dealCombatDamage(state);
        if (state.winner) return state;
        if (state.combat?.damageStep === 'first') {
            // Seconda passata (danno normale) nello stesso passo (CR 510.4).
            resetPriority(state, state.activePlayer);
            return state;
        }
    }
    return advanceStep(state);
}

/** Le mosse di passo disponibili: chi ha la priorità può sempre passarla. */
export const canPass = (state, playerId) => hasPriority(state, playerId);

export { alivePlayers, nextHolder, priorityHolder, resetPriority, STEP_INDEX };
