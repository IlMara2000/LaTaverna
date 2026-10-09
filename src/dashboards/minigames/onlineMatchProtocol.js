// Pure protocol helpers: each room has two human seats and one active game.
export const ONLINE_TIMEOUT = 35000;
export const onlineSeat = (room, clientId) => {
    const roster = [...new Set([room.hostClientId, room.guestClientId, ...(room.data?.participants || [])].filter(Boolean))];
    const seat = roster.indexOf(clientId);
    if (seat < 0) throw new Error('Non fai parte di questa stanza. Rientra dal pannello Multiplayer.');
    return seat;
};
export const isPresent = (timestamp, now = Date.now()) => Number.isFinite(timestamp) && now - timestamp < ONLINE_TIMEOUT;
export function enterMatch(data, gameId, seat, initial, roster, now = Date.now(), mode = 'turns') {
    let match = data.onlineMatch;
    const sameRoster = match?.roster?.length === roster.length && match.roster.every((id, i) => id === roster[i]);
    const otherPresent = sameRoster && match?.presence?.some((time, i) => i !== seat && isPresent(time, now));
    if (otherPresent && match.gameId !== gameId) throw new Error('L’altro giocatore ha aperto un altro gioco. Aprite entrambi lo stesso minigioco.');
    if (!sameRoster || match.gameId !== gameId || !match.presence.some(time => isPresent(time, now))) {
        match = { id: globalThis.crypto.randomUUID(), gameId, roster, revision: 0, mode, state: initial, presence: roster.map(() => null) };
    }
    return { ...data, onlineMatch: { ...match, presence: match.presence.map((time, i) => i === seat ? now : time) } };
}
export function changeMatch(data, id, seat, revision, nextState, now = Date.now()) {
    const match = data.onlineMatch;
    if (!match || match.id !== id) throw new Error('La partita non è più attiva. Rientra nel gioco.');
    if (match.revision !== revision) throw new Error('La partita è stata aggiornata. Riprova la mossa.');
    if (!match.presence.every(time => isPresent(time, now))) throw new Error('In attesa dell’altro giocatore.');
    const turn = match.state.turn === 'w' ? 0 : match.state.turn === 'b' ? 1 : match.state.turn;
    if (turn !== seat) throw new Error('Attendi il tuo turno.');
    return { ...data, onlineMatch: { ...match, state: nextState, revision: revision + 1,
        presence: match.presence.map((time, i) => i === seat ? now : time) } };
}
// Local card games always render the current player at index zero.
export function cardPerspective(snapshot, seat, toCanonical = false) {
    const result = structuredClone(snapshot);
    if (!seat) return result;
    const count = result.players?.length || 2;
    const offset = toCanonical ? seat : count - seat;
    const mapOwner = owner => (owner + offset) % count;
    for (const key of ['players', 'scores']) if (result[key]) {
        const original = result[key];
        result[key] = Array.from({length: count}, (_, i) => original[(i - offset + count) % count]);
    }
    if (typeof result.turn === 'number') result.turn = mapOwner(result.turn);
    if (typeof result.winner === 'number') result.winner = mapOwner(result.winner);
    if (result.table) result.table = result.table.map(entry => ({ ...entry, owner: mapOwner(entry.owner) }));
    return result;
}
export const pickState = (state, fields) => Object.fromEntries(fields.map(key => [key, structuredClone(state[key])]));

export function scopaPerspective(match, seat) {
    const copy = structuredClone(match);
    if (!seat) return copy;
    copy.totals.reverse();
    if (copy.winner !== null) copy.winner = 1 - copy.winner;
    const round = copy.round;
    for (const key of ['hands', 'captured', 'sweeps']) round[key].reverse();
    for (const key of ['turn', 'starter', 'lastCapture']) if (round[key] !== null) round[key] = 1 - round[key];
    if (round.lastMove) for (const key of ['player', 'leftoversOwner']) {
        if (typeof round.lastMove[key] === 'number') round.lastMove[key] = 1 - round.lastMove[key];
    }
    if (round.result) {
        for (const key of ['cardCounts', 'diamondCounts', 'primieras', 'totals']) round.result[key].reverse();
        for (const values of Object.values(round.result.points)) values.reverse();
    }
    return copy;
}
