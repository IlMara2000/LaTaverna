/**
 * SCIPPO! - motore di gioco puro.
 *
 * Nessun accesso al DOM, a Supabase o a localStorage: tutto lo stato di una
 * partita è un oggetto serializzabile e ogni funzione restituisce una nuova
 * partita senza modificare quella ricevuta. Questo permette di testare le
 * regole senza avviare il frontend e di riusare il motore per bot, sfide
 * deterministiche e future modalità online.
 *
 * Regole: BOTTA batte FINTA, SCUDO batte BOTTA, FINTA batte SCUDO, JOLLY
 * batte ogni carta normale. Carte uguali (compreso JOLLY contro JOLLY)
 * producono un pareggio e il bottino del turno non viene assegnato.
 */

export const DECK_SIZE = 20;
export const HAND_SIZE = 4;
export const REGULATION_TURNS = 8;
export const SCIPPO_MULTIPLIER = 2;
export const SCIPPO_USES_PER_MATCH = 1;
export const MIN_NORMAL_COPIES = 3;
export const MAX_NORMAL_COPIES = 10;
export const MAX_JOLLY_COPIES = 2;

export const CARD_IDS = Object.freeze(['botta', 'scudo', 'finta', 'jolly']);
export const NORMAL_CARD_IDS = Object.freeze(['botta', 'scudo', 'finta']);

export const CARD_TYPES = Object.freeze({
    botta: Object.freeze({
        id: 'botta', label: 'BOTTA', name: 'Botta', icon: '👊',
        beats: 'finta', rule: 'Batte la finta', victoryLine: 'TI HO STESO.'
    }),
    scudo: Object.freeze({
        id: 'scudo', label: 'SCUDO', name: 'Scudo', icon: '🛡️',
        beats: 'botta', rule: 'Batte la botta', victoryLine: 'BEL TENTATIVO, CAMPIONE.'
    }),
    finta: Object.freeze({
        id: 'finta', label: 'FINTA', name: 'Finta', icon: '🎭',
        beats: 'scudo', rule: 'Batte lo scudo', victoryLine: 'CI SEI CASCATO COME UN POLLO.'
    }),
    jolly: Object.freeze({
        id: 'jolly', label: 'JOLLY', name: 'Jolly', icon: '🃏',
        beats: null, rule: 'Batte tutto', victoryLine: 'NON ERA NEANCHE UNA SFIDA.'
    })
});

export const DEFAULT_DECK_COMPOSITION = Object.freeze({
    botta: 6, scudo: 6, finta: 6, jolly: 2
});

const BOTTINO_POOL = [1, 1, 2, 2, 2, 2, 3, 3];

export const SCIPPO_TAUNTS = Object.freeze({
    win: Object.freeze([
        'SCIPPATO!',
        'TI HO LETTO COME UN LIBRO.',
        'NON L’AVEVI PREVISTO, EH?',
        'BEL TENTATIVO. QUASI.',
        'QUESTA LA PORTO A CASA.'
    ]),
    lose: Object.freeze([
        'BEL TENTATIVO.',
        'IL BOT TI HA SCIPPATO.',
        'NON CI CREDEVO NEANCHE IO.',
        'RIVINCITA O PAURA?',
        'TI MANCAVA UNA CARTA.'
    ]),
    draw: Object.freeze([
        'PARITÀ. NESSUNO SI PRENDE NIENTE.',
        'STESSA MOSSA, STESSO RISULTATO.',
        'VI SIETE LETTI A VICENDA.',
        'BOTTINO SUL TAVOLO, MANI VUOTE.'
    ]),
    end: Object.freeze([
        'RIVINCITA O PAURA?',
        'LA TAVERNA RICORDA.',
        'IL PROSSIMO BOTTINO È TUO?',
        'BRAVO. O FORTUNATO.'
    ]),
    scippo: Object.freeze([
        'FERMI TUTTI.',
        'QUESTO È UNO SCIPPO.',
        'ADESSO SI FA SUL SERIO.',
        'HO APPENA FIRMATO IL MIO CAPOLAVORO.'
    ])
});

/** Converte seed e stringhe in un intero a 32 bit stabile. */
export function normalizeSeed(seed) {
    if (typeof seed === 'number' && Number.isFinite(seed)) {
        return Math.abs(Math.trunc(seed)) >>> 0;
    }
    const text = String(seed ?? '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

/** Generatore pseudo-casuale deterministico (mulberry32). */
export function createRng(seed = Date.now()) {
    let value = normalizeSeed(seed) || 1;
    return () => {
        value = (value + 0x6d2b79f5) >>> 0;
        let result = value;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

export function shuffle(items, rng = Math.random) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(rng() * (index + 1));
        [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
}

export function deckTotal(composition = {}) {
    return CARD_IDS.reduce((total, id) => total + (Number(composition?.[id]) || 0), 0);
}

/**
 * Valida una composizione di mazzo. Restituisce messaggi leggibili già pronti
 * per la UI, così client e motore applicano le stesse regole.
 */
export function validateDeckComposition(raw) {
    const composition = { botta: 0, scudo: 0, finta: 0, jolly: 0 };
    const errors = [];
    if (!raw || typeof raw !== 'object') {
        return { valid: false, errors: ['Mazzo non valido.'], total: 0, composition };
    }

    CARD_IDS.forEach(id => {
        const value = Number(raw[id]);
        composition[id] = Number.isFinite(value) ? value : 0;
    });

    CARD_IDS.forEach(id => {
        if (!Number.isInteger(composition[id]) || composition[id] < 0) {
            errors.push('Le quantità devono essere numeri interi positivi.');
        }
    });

    NORMAL_CARD_IDS.forEach(id => {
        if (composition[id] < MIN_NORMAL_COPIES) {
            errors.push(`${CARD_TYPES[id].label}: servono almeno ${MIN_NORMAL_COPIES} copie.`);
        }
        if (composition[id] > MAX_NORMAL_COPIES) {
            errors.push(`${CARD_TYPES[id].label}: massimo ${MAX_NORMAL_COPIES} copie.`);
        }
    });
    if (composition.jolly > MAX_JOLLY_COPIES) {
        errors.push(`JOLLY: massimo ${MAX_JOLLY_COPIES} copie.`);
    }

    const total = deckTotal(composition);
    if (total !== DECK_SIZE) {
        errors.push(`Il mazzo deve contenere esattamente ${DECK_SIZE} carte (ora ${total}).`);
    }

    return { valid: errors.length === 0, errors, total, composition };
}

/** Espande una composizione nell'elenco delle carte che compongono il mazzo. */
export function expandDeck(composition) {
    const validated = validateDeckComposition(composition);
    if (!validated.valid) {
        throw new Error(validated.errors[0] || 'Mazzo non valido.');
    }
    const cards = [];
    CARD_IDS.forEach(id => {
        for (let copy = 0; copy < validated.composition[id]; copy += 1) cards.push(id);
    });
    return cards;
}

/**
 * Confronta due carte giocate. `'a'` vince la prima, `'b'` la seconda,
 * `'draw'` pareggia.
 */
export function compareCards(cardA, cardB) {
    if (!CARD_TYPES[cardA] || !CARD_TYPES[cardB]) {
        throw new Error('Carta sconosciuta.');
    }
    if (cardA === cardB) return 'draw';
    if (cardA === 'jolly') return 'a';
    if (cardB === 'jolly') return 'b';
    if (CARD_TYPES[cardA].beats === cardB) return 'a';
    if (CARD_TYPES[cardB].beats === cardA) return 'b';
    return 'draw';
}

export function createBottinoQueue(count = REGULATION_TURNS, rng = Math.random) {
    const pool = [...BOTTINO_POOL];
    const queue = [];
    while (queue.length < count) {
        if (!pool.length) pool.push(1, 1, 2, 2, 3);
        const index = Math.floor(rng() * pool.length);
        queue.push(pool.splice(index, 1)[0]);
    }
    return queue;
}

/**
 * Crea una partita completa. `decks` è un array di due composizioni: la prima
 * appartiene al giocatore (posto 0), la seconda al bot o all'avversario (posto 1).
 */
export function createMatch({
    seed = Date.now(),
    decks = [DEFAULT_DECK_COMPOSITION, DEFAULT_DECK_COMPOSITION],
    maxTurns = REGULATION_TURNS
} = {}) {
    if (!Array.isArray(decks) || decks.length !== 2) {
        throw new Error('Servono due mazzi per iniziare la partita.');
    }
    decks.forEach((deck, seat) => {
        const validation = validateDeckComposition(deck);
        if (!validation.valid) {
            throw new Error(`Mazzo ${seat === 0 ? 'giocatore' : 'avversario'}: ${validation.errors[0]}`);
        }
    });

    const matchSeed = normalizeSeed(seed);
    const rng = createRng(matchSeed);
    const composition = decks.map(deck => ({ ...validateDeckComposition(deck).composition }));
    const hands = [];
    const piles = [];

    composition.forEach(deck => {
        const shuffled = shuffle(expandDeck(deck), rng);
        hands.push(shuffled.splice(0, HAND_SIZE));
        piles.push(shuffled);
    });

    const bottinoQueue = createBottinoQueue(maxTurns, rng);

    return {
        seed: matchSeed,
        maxTurns,
        turn: 1,
        overtime: false,
        pendingOvertime: false,
        phase: 'choose',
        bottino: bottinoQueue[0],
        bottinoQueue,
        composition,
        hands,
        piles,
        discards: [[], []],
        scores: [0, 0],
        pending: [null, null],
        pendingScippo: [false, false],
        scippoUsed: [false, false],
        history: [],
        lastTurn: null,
        stats: [
            { cardsPlayed: 0, jollyPlayed: 0, tricks: 0, points: 0 },
            { cardsPlayed: 0, jollyPlayed: 0, tricks: 0, points: 0 }
        ],
        finished: false,
        winner: null,
        endReason: ''
    };
}

export function getLegalCards(match, seat) {
    if (!match?.hands?.[seat]) return [];
    return [...match.hands[seat]];
}

function finishMatch(match, winner, endReason) {
    match.finished = true;
    match.winner = winner;
    match.endReason = endReason;
}

function resolvePending(match) {
    const plays = [0, 1].map(seat => ({ seat, card: match.pending[seat] }));
    const result = compareCards(plays[0].card, plays[1].card);
    const scippo = match.pendingScippo[0] || match.pendingScippo[1];
    const multiplier = scippo ? SCIPPO_MULTIPLIER : 1;
    const points = match.bottino * multiplier;
    const winnerSeat = result === 'draw' ? null : result === 'a' ? 0 : 1;

    if (winnerSeat !== null) {
        match.scores[winnerSeat] += points;
        match.stats[winnerSeat].tricks += 1;
        match.stats[winnerSeat].points += points;
    }

    plays.forEach(({ seat, card }) => {
        match.stats[seat].cardsPlayed += 1;
        if (card === 'jolly') match.stats[seat].jollyPlayed += 1;
        match.discards[seat].push(card);
    });

    const entry = {
        turn: match.turn,
        overtime: match.overtime,
        bottino: match.bottino,
        multiplier,
        points: winnerSeat === null ? 0 : points,
        scippo,
        scippoBy: match.pendingScippo.map((declared, seat) => declared ? seat : null).filter(seat => seat !== null),
        plays,
        result,
        winnerSeat,
        scores: [...match.scores],
        taunt: pickTaunt(result === 'draw' ? 'draw' : winnerSeat === 0 ? 'win' : 'lose', match.history.length + match.seed)
    };

    match.history.push(entry);
    match.lastTurn = entry;
    match.pending = [null, null];
    match.pendingScippo = [false, false];
    match.phase = 'reveal';

    const tied = match.scores[0] === match.scores[1];
    if (!match.overtime && match.turn >= match.maxTurns) {
        if (!tied) finishMatch(match, match.scores[0] > match.scores[1] ? 0 : 1, 'punti');
        else match.pendingOvertime = true;
    } else if (match.overtime && !tied) {
        finishMatch(match, match.scores[0] > match.scores[1] ? 0 : 1, 'spareggio');
    }
}

/**
 * Gioca una carta coperta. La partita resta in attesa dell'altra carta finché
 * entrambi i posti non hanno scelto; solo allora il turno viene risolto.
 */
export function playCard(match, seat, cardId, { scippo = false } = {}) {
    if (!match || (seat !== 0 && seat !== 1)) {
        return { ok: false, error: 'Partita o giocatore non validi.', match };
    }
    if (match.phase !== 'choose') {
        return { ok: false, error: 'Non è il momento di scegliere.', match };
    }
    if (!CARD_TYPES[cardId]) {
        return { ok: false, error: 'Carta sconosciuta.', match };
    }
    if (match.pending[seat]) {
        return { ok: false, error: 'Hai già giocato questa carta.', match };
    }
    const index = match.hands[seat].indexOf(cardId);
    if (index < 0) {
        return { ok: false, error: 'Questa carta non è nella tua mano.', match };
    }
    if (scippo && !scippoAvailable(match, seat)) {
        return { ok: false, error: 'Hai già usato la SCIPPATA in questa partita.', match };
    }

    const next = structuredClone(match);
    next.hands[seat].splice(index, 1);
    next.pending[seat] = cardId;
    next.pendingScippo[seat] = Boolean(scippo);
    if (scippo) next.scippoUsed[seat] = true;
    if (next.pending[0] && next.pending[1]) resolvePending(next);
    return { ok: true, error: null, match: next };
}

/** La SCIPPATA è disponibile una sola volta e solo prima di confermare. */
export function scippoAvailable(match, seat) {
    return Boolean(match) && (seat === 0 || seat === 1) && match.scippoUsed?.[seat] !== true;
}

/** Bottino che verrebbe assegnato ora, considerando le SCIPPATE già confermate. */
export function effectiveBottino(match) {
    if (!match) return 0;
    const declared = Boolean(match.pendingScippo?.[0] || match.pendingScippo?.[1]);
    return match.bottino * (declared ? SCIPPO_MULTIPLIER : 1);
}

export function cardVictoryLine(cardId) {
    return CARD_TYPES[cardId]?.victoryLine || 'BOTTINO MIO.';
}

/**
 * Chiude la fase di rivelazione: pesca una carta per giocatore, prepara il
 * turno successivo (o lo spareggio) e dichiara la fine quando non ci sono più
 * carte. Non crea mai carte aggiuntive.
 */
export function advanceMatch(match) {
    if (!match || match.phase !== 'reveal') return match;
    const next = structuredClone(match);
    if (next.pendingOvertime) {
        next.overtime = true;
        next.pendingOvertime = false;
    }
    if (next.finished) {
        next.phase = 'over';
        next.pending = [null, null];
        return next;
    }

    for (const seat of [0, 1]) {
        if (next.hands[seat].length < HAND_SIZE && next.piles[seat].length) {
            next.hands[seat].push(next.piles[seat].shift());
        }
    }

    const noCards = next.hands[0].length === 0 && next.hands[1].length === 0;
    if (noCards) {
        finishMatch(next, null, 'carte');
        next.phase = 'over';
        return next;
    }

    next.turn += 1;
    next.bottino = next.overtime ? 1 : (next.bottinoQueue[next.turn - 1] ?? 1);
    next.phase = 'choose';
    next.pending = [null, null];
    next.pendingScippo = [false, false];
    return next;
}

/** Carte dell'avversario non ancora rivelate (mano + mazzo), per la diagnosi del BOT. */
export function getPublicUnknownCards(match, seat) {
    const composition = match?.composition?.[seat] || DEFAULT_DECK_COMPOSITION;
    const pool = expandDeck(composition);
    const revealed = new Map();
    (match?.discards?.[seat] || []).forEach(card => {
        revealed.set(card, (revealed.get(card) || 0) + 1);
    });
    revealed.forEach((count, card) => {
        for (let copy = 0; copy < count; copy += 1) {
            const index = pool.indexOf(card);
            if (index >= 0) pool.splice(index, 1);
        }
    });
    return pool;
}

export function pickTaunt(kind, salt = 0) {
    const pool = SCIPPO_TAUNTS[kind] || SCIPPO_TAUNTS.end;
    return pool[Math.abs(Math.trunc(salt)) % pool.length];
}

export function describeScore(match) {
    if (!match) return '0 – 0';
    return `${match.scores[0]} – ${match.scores[1]}`;
}

export function deckCompositionLabel(composition = DEFAULT_DECK_COMPOSITION) {
    return `👊 ${composition.botta || 0} · 🛡️ ${composition.scudo || 0} · 🎭 ${composition.finta || 0} · 🃏 ${composition.jolly || 0}`;
}

export function outcomeForSeat(match, seat = 0) {
    if (!match?.finished) return null;
    if (match.winner === null) return 'draw';
    return match.winner === seat ? 'win' : 'loss';
}
