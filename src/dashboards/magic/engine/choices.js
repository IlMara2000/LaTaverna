// Scelte in sospeso (`pendingChoice`).
//
// Una scelta non è una mossa e non è un effetto: è una domanda che il motore
// deve fare a un giocatore preciso, e finché non risponde nessuno riceve la
// priorità (CR 117.1a: durante la risoluzione nessuno gioca). Lo schema è
// serializzabile e non porta con sé il testo intero delle carte avversarie: chi
// non deve scegliere vede solo che c'è una scelta in corso.

import { discardCards } from '../../magicMatchEngine.js';

export const CHOICE_KINDS = Object.freeze(['discard', 'orderBlockers']);

let counter = 0;

const nextId = kind => {
    counter += 1;
    return `choice:${kind}:${counter}`;
};

/** Costruisce la scelta senza applicarla: la usa anche `openChoice`. */
export const makeChoice = ({ kind, playerId, prompt = '', options = [], min = 1, max = 1, sourceId = '', meta = {} } = {}) => {
    if (!CHOICE_KINDS.includes(kind)) throw new Error(`Tipo di scelta non riconosciuto: ${kind}.`);
    const list = (options || []).map(option => (typeof option === 'string'
        ? { id: option, label: option }
        : { id: String(option.id ?? ''), label: String(option.label ?? option.id ?? '') }));
    return {
        id: nextId(kind),
        kind,
        playerId: playerId || '',
        prompt: prompt || 'Scegli.',
        min: Math.max(0, Number(min) || 0),
        max: Math.max(0, Number(max) || 0),
        sourceId: sourceId || '',
        meta: { ...(meta || {}) },
        options: list
    };
};

export function openChoice(state, spec) {
    if (!state) throw new Error('openChoice: stato mancante.');
    if (state.pendingChoice) throw new Error('C’è già una scelta in sospeso.');
    state.pendingChoice = makeChoice(spec);
    return state;
}

/**
 * La scelta vista da `playerId`. A chi non deve scegliere non si mostrano le
 * opzioni: sono informazioni che non gli appartengono (una mano da scartare, un
 * ordine di bloccanti scelto dall'attaccante).
 */
export function choiceViewFor(state, playerId) {
    const choice = state?.pendingChoice;
    if (!choice) return null;
    const mine = choice.playerId === playerId;
    const base = {
        id: choice.id,
        kind: choice.kind,
        mine,
        forPlayerId: choice.playerId || '',
        prompt: mine ? choice.prompt : 'In attesa di una scelta dell’avversario',
        min: choice.min,
        max: choice.max,
        sourceId: choice.sourceId || '',
        hidden: !mine
    };
    return mine
        ? { ...base, options: choice.options.map(option => ({ id: option.id, label: option.label })) }
        : { ...base, options: [] };
}

/**
 * Risposta alla scelta in sospeso. Le opzioni valgono solo per il giocatore a
 * cui la scelta è stata fatta: senza quel controllo chiunque potrebbe scartare
 * le carte di un altro o riordinargli i bloccanti.
 */
export function answerChoice(currentState, playerId, selection = []) {
    const state = structuredClone(currentState);
    const choice = state.pendingChoice;
    if (!choice) throw new Error('Non c’è nessuna scelta in sospeso.');
    if (choice.playerId !== playerId) throw new Error('Questa scelta non spetta a te.');
    const picked = [...new Set((selection || []).map(String))];
    const allowed = new Set(choice.options.map(option => option.id));
    if (picked.some(id => !allowed.has(id))) throw new Error('Una delle opzioni scelte non è valida.');
    if (picked.length < choice.min || picked.length > choice.max) {
        throw new Error(choice.min === choice.max
            ? `Devi scegliere esattamente ${choice.min} ${choice.min === 1 ? 'opzione' : 'opzioni'}.`
            : `Scegli fra ${choice.min} e ${choice.max} opzioni.`);
    }
    if (choice.kind === 'discard') {
        const out = discardCards(state, playerId, picked);
        out.pendingChoice = null;
        out.pendingDiscard = false;
        return out;
    }
    if (choice.kind === 'orderBlockers') {
        const attackerId = String(choice.meta?.attackerId || '');
        if (!attackerId || !applyBlockerOrder(state, attackerId, picked)) {
            throw new Error('L’ordine scelto non corrisponde ai bloccanti di quell’attaccante.');
        }
        state.pendingChoice = null;
        return state;
    }
    throw new Error(`Scelta non gestita: ${choice.kind}.`);
}

/** Scrive `combat.order[attackerId]`, verificando che sia una permutazione dei bloccanti. */
function applyBlockerOrder(state, attackerId, picked) {
    const blockers = state.combat?.blockers?.[attackerId];
    const list = Array.isArray(blockers) ? blockers : (blockers ? [blockers] : []);
    if (list.length !== picked.length) return false;
    if (picked.some(id => !list.includes(id))) return false;
    state.combat.order = { ...(state.combat.order || {}), [attackerId]: picked };
    return true;
}
