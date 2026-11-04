/**
 * Record dei minigiochi: partite, vittorie, sconfitte, serie e miglior punteggio.
 * Le partite non devono mai interrompersi per un errore di memoria: ogni
 * funzione degrada su un archivio in memoria se localStorage non è disponibile
 * o contiene dati corrotti.
 */

const STORAGE_KEY = 'taverna:minigame-records:v1';
const VERSION = 1;
const OUTCOMES = new Set(['win', 'loss', 'draw']);

const emptyRecord = () => ({
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    bestScore: null,
    lastOutcome: null,
    lastPlayedAt: null
});

const memory = new Map();
const memoryStorage = {
    getItem: key => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)); },
    removeItem: key => { memory.delete(key); }
};

function resolveStorage(storage) {
    if (storage) return storage;
    try {
        if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch {
        /* Storage negato dal browser: si continua in memoria. */
    }
    return memoryStorage;
}

function sanitizeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

export function normalizeRecord(raw) {
    const record = emptyRecord();
    if (!raw || typeof raw !== 'object') return record;
    record.played = sanitizeNumber(raw.played);
    record.wins = Math.min(sanitizeNumber(raw.wins), record.played);
    record.losses = Math.min(sanitizeNumber(raw.losses), record.played);
    record.draws = Math.min(sanitizeNumber(raw.draws), record.played);
    record.streak = sanitizeNumber(raw.streak);
    record.bestStreak = Math.max(sanitizeNumber(raw.bestStreak), record.streak);
    record.bestScore = Number.isFinite(Number(raw.bestScore)) && raw.bestScore !== null ? Number(raw.bestScore) : null;
    record.lastOutcome = OUTCOMES.has(raw.lastOutcome) ? raw.lastOutcome : null;
    record.lastPlayedAt = typeof raw.lastPlayedAt === 'string' ? raw.lastPlayedAt : null;
    return record;
}

function readAll(storage) {
    const store = resolveStorage(storage);
    try {
        const raw = store.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== VERSION || typeof parsed.games !== 'object' || !parsed.games) return {};
        return parsed.games;
    } catch {
        return {};
    }
}

function writeAll(games, storage) {
    const store = resolveStorage(storage);
    try {
        store.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, games }));
        return true;
    } catch {
        return false;
    }
}

export function getMinigameRecord(gameId, options = {}) {
    if (typeof gameId !== 'string' || !gameId.trim()) return emptyRecord();
    return normalizeRecord(readAll(options.storage)[gameId]);
}

export function getAllMinigameRecords(options = {}) {
    return Object.fromEntries(
        Object.entries(readAll(options.storage)).map(([gameId, record]) => [gameId, normalizeRecord(record)])
    );
}

/**
 * Registra l'esito di una partita. `score` è facoltativo: `betterWhen` decide
 * se il record migliore è il punteggio più alto (scopa, briscola) o più basso
 * (mosse del solitario).
 */
export function recordMinigameResult(gameId, outcome, options = {}) {
    if (typeof gameId !== 'string' || !gameId.trim()) return null;
    if (!OUTCOMES.has(outcome)) return null;
    const { score = null, betterWhen = 'higher', storage, at = Date.now() } = options || {};
    const games = readAll(storage);
    const record = normalizeRecord(games[gameId]);

    record.played += 1;
    if (outcome === 'win') {
        record.wins += 1;
        record.streak += 1;
        record.bestStreak = Math.max(record.bestStreak, record.streak);
    } else if (outcome === 'loss') {
        record.losses += 1;
        record.streak = 0;
    } else {
        record.draws += 1;
        record.streak = 0;
    }

    const numericScore = Number(score);
    if (score !== null && Number.isFinite(numericScore)) {
        const isBetter = record.bestScore === null
            || (betterWhen === 'lower' ? numericScore < record.bestScore : numericScore > record.bestScore);
        if (isBetter) record.bestScore = numericScore;
    }

    record.lastOutcome = outcome;
    record.lastPlayedAt = new Date(Number.isFinite(at) ? at : Date.now()).toISOString();
    games[gameId] = record;
    writeAll(games, storage);
    return record;
}

export function resetMinigameRecord(gameId, options = {}) {
    const games = readAll(options.storage);
    if (!Object.prototype.hasOwnProperty.call(games, gameId)) return false;
    delete games[gameId];
    return writeAll(games, options.storage);
}

export function describeMinigameRecord(gameId, options = {}) {
    const record = getMinigameRecord(gameId, options);
    if (!record.played) return 'Nessuna partita';
    const parts = [`${record.wins} vinte`, `${record.losses} perse`];
    if (record.draws) parts.push(`${record.draws} patte`);
    if (record.streak > 1) parts.push(`serie di ${record.streak}`);
    return parts.join(' · ');
}

export function renderMinigameRecordLine(gameId, options = {}) {
    const record = getMinigameRecord(gameId, options);
    if (!record.played) return '';
    const score = record.bestScore === null ? '' : ` · record ${record.bestScore}`;
    return `Record: ${describeMinigameRecord(gameId, options)}${score}`;
}

export { STORAGE_KEY };
