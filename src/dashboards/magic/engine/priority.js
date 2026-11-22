// Priorità (CR 117).
//
// In una partita vera nessuno agisce «quando vuole»: agisce chi ha la priorità.
// Dopo ogni mossa o risoluzione la priorità torna al giocatore attivo, e i
// «passo» degli altri si azzerano — è la successione del 117.4: quando tutti
// passano di fila, si risolve la cima dello stack o si cambia passo.

export const alivePlayers = state => (state?.players || [])
    .filter(id => !state?.playersData?.[id]?.eliminated);

/** Chi ha la priorità adesso (nello stato M0 non esiste: vale il giocatore attivo). */
export const priorityHolder = state => state?.priority?.playerId || state?.activePlayer || '';

/** Priorità a `playerId` e nessuno ha ancora passato: dopo una mossa o una risoluzione. */
export function resetPriority(state, playerId = state?.activePlayer) {
    if (!state) return state;
    state.priority = { playerId: playerId || '', passed: [] };
    return state;
}

/** Il prossimo in ordine di turno fra i giocatori ancora in partita. */
export function nextHolder(state, playerId) {
    const order = alivePlayers(state);
    if (!order.length) return '';
    const index = order.indexOf(playerId);
    return order[(index + 1) % order.length];
}

/** Tutti i giocatori vivi hanno passato in successione (CR 117.4). */
export function allPassed(state) {
    const order = alivePlayers(state);
    const passed = new Set(state?.priority?.passed || []);
    return order.length > 0 && order.every(id => passed.has(id));
}

export const hasPriority = (state, playerId) => Boolean(playerId)
    && priorityHolder(state) === playerId
    && !state?.pendingChoice;
