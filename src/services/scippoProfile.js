/**
 * Profilo locale di SCIPPO!: statistiche, mazzi salvati, preferenze e sfida
 * giornaliera. Non esiste ancora un backend dedicato al gioco, quindi i dati
 * vivono nel browser dell'utente (isolati per account/dispositivo) e non
 * vengono mai presentati come classifiche globali.
 */

import {
    DEFAULT_DECK_COMPOSITION,
    REGULATION_TURNS,
    deckCompositionLabel,
    deckTotal,
    normalizeSeed,
    validateDeckComposition
} from './scippoEngine.js';

export const SCIPPO_STORAGE_KEY = 'taverna:scippo:v1';
const VERSION = 1;
const MAX_DECKS = 6;

const memory = new Map();
const memoryStorage = {
    getItem: key => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)); },
    removeItem: key => { memory.delete(key); }
};

function resolveStorage(storage) {
    if (storage) return storage;
    try {
        if (globalThis.localStorage) return globalThis.localStorage;
    } catch {
        /* Storage negato: si continua in memoria. */
    }
    return memoryStorage;
}

const clampCount = value => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
};

export function defaultDeck() {
    return { id: 'standard', name: 'Mazzo standard', composition: { ...DEFAULT_DECK_COMPOSITION }, builtin: true };
}

export function createDefaultProfile() {
    return {
        version: VERSION,
        stats: {
            played: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            streak: 0,
            bestStreak: 0,
            bestScore: null,
            pointsScored: 0,
            pointsAllowed: 0,
            jollylessWins: 0,
            winsByLevel: { facile: 0, normale: 0, difficile: 0 },
            lastPlayedAt: null
        },
        decks: [],
        activeDeckId: 'standard',
        settings: { sound: true, reduceFx: false, taunts: true },
        daily: { date: '', attempts: 0, bestScore: null, completed: false, lastOutcome: null },
        challenge: { lastSeed: '', bestScore: null }
    };
}

function normalizeDeck(raw, index) {
    const validation = validateDeckComposition(raw?.composition);
    if (!validation.valid) return null;
    const name = String(raw?.name || `Mazzo ${index + 1}`).trim().slice(0, 28);
    return {
        id: String(raw?.id || `deck-${index + 1}`),
        name: name || `Mazzo ${index + 1}`,
        composition: validation.composition,
        createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
    };
}

export function normalizeScippoProfile(raw) {
    const profile = createDefaultProfile();
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION) return profile;

    const stats = raw.stats || {};
    profile.stats.played = clampCount(stats.played);
    profile.stats.wins = Math.min(clampCount(stats.wins), profile.stats.played);
    profile.stats.losses = Math.min(clampCount(stats.losses), profile.stats.played - profile.stats.wins);
    profile.stats.draws = Math.max(0, profile.stats.played - profile.stats.wins - profile.stats.losses);
    profile.stats.streak = clampCount(stats.streak);
    profile.stats.bestStreak = Math.max(profile.stats.streak, clampCount(stats.bestStreak));
    profile.stats.bestScore = Number.isFinite(Number(stats.bestScore)) && stats.bestScore !== null ? Number(stats.bestScore) : null;
    profile.stats.pointsScored = clampCount(stats.pointsScored);
    profile.stats.pointsAllowed = clampCount(stats.pointsAllowed);
    profile.stats.jollylessWins = clampCount(stats.jollylessWins);
    ['facile', 'normale', 'difficile'].forEach(level => {
        profile.stats.winsByLevel[level] = clampCount(stats.winsByLevel?.[level]);
    });
    profile.stats.lastPlayedAt = typeof stats.lastPlayedAt === 'string' ? stats.lastPlayedAt : null;

    if (Array.isArray(raw.decks)) {
        profile.decks = raw.decks.map(normalizeDeck).filter(Boolean).slice(0, MAX_DECKS);
    }
    profile.activeDeckId = profile.decks.some(deck => deck.id === raw.activeDeckId) ? raw.activeDeckId : 'standard';

    profile.settings.sound = raw.settings?.sound !== false;
    profile.settings.reduceFx = raw.settings?.reduceFx === true;
    profile.settings.taunts = raw.settings?.taunts !== false;

    if (raw.daily && typeof raw.daily === 'object') {
        profile.daily.date = typeof raw.daily.date === 'string' ? raw.daily.date : '';
        profile.daily.attempts = clampCount(raw.daily.attempts);
        profile.daily.bestScore = Number.isFinite(Number(raw.daily.bestScore)) && raw.daily.bestScore !== null
            ? Number(raw.daily.bestScore) : null;
        profile.daily.completed = raw.daily.completed === true;
        profile.daily.lastOutcome = ['win', 'loss', 'draw'].includes(raw.daily.lastOutcome) ? raw.daily.lastOutcome : null;
    }
    if (raw.challenge && typeof raw.challenge === 'object') {
        profile.challenge.lastSeed = typeof raw.challenge.lastSeed === 'string' ? raw.challenge.lastSeed : '';
        profile.challenge.bestScore = Number.isFinite(Number(raw.challenge.bestScore)) && raw.challenge.bestScore !== null
            ? Number(raw.challenge.bestScore) : null;
    }
    return profile;
}

export function loadScippoProfile(storage) {
    try {
        const raw = resolveStorage(storage).getItem(SCIPPO_STORAGE_KEY);
        return raw ? normalizeScippoProfile(JSON.parse(raw)) : createDefaultProfile();
    } catch {
        return createDefaultProfile();
    }
}

export function saveScippoProfile(profile, storage) {
    try {
        resolveStorage(storage).setItem(SCIPPO_STORAGE_KEY, JSON.stringify(profile));
        return true;
    } catch {
        return false;
    }
}

export function getActiveDeck(profile) {
    if (!profile) return defaultDeck();
    const custom = profile.decks.find(deck => deck.id === profile.activeDeckId);
    return custom || defaultDeck();
}

export function getActiveComposition(profile) {
    return { ...getActiveDeck(profile).composition };
}

export function saveDeck(profile, { name, composition } = {}) {
    const validation = validateDeckComposition(composition);
    if (!validation.valid) return { profile, deck: null, error: validation.errors[0] };
    const cleanName = String(name || '').trim().slice(0, 28);
    if (!cleanName) return { profile, deck: null, error: 'Dai un nome al mazzo.' };
    if (profile.decks.length >= MAX_DECKS) {
        return { profile, deck: null, error: `Hai già ${MAX_DECKS} mazzi salvati: eliminane uno.` };
    }
    const deck = {
        id: `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        composition: validation.composition,
        createdAt: new Date().toISOString()
    };
    const next = {
        ...profile,
        decks: [...profile.decks, deck],
        activeDeckId: deck.id
    };
    saveScippoProfile(next);
    return { profile: next, deck, error: null };
}

export function setActiveDeck(profile, deckId) {
    if (deckId !== 'standard' && !profile.decks.some(deck => deck.id === deckId)) {
        return { profile, error: 'Mazzo non trovato.' };
    }
    const next = { ...profile, activeDeckId: deckId };
    saveScippoProfile(next);
    return { profile: next, error: null };
}

export function deleteDeck(profile, deckId) {
    const decks = profile.decks.filter(deck => deck.id !== deckId);
    const next = {
        ...profile,
        decks,
        activeDeckId: profile.activeDeckId === deckId ? 'standard' : profile.activeDeckId
    };
    saveScippoProfile(next);
    return next;
}

export function updateScippoSettings(profile, patch = {}) {
    const next = {
        ...profile,
        settings: {
            ...profile.settings,
            ...(typeof patch.sound === 'boolean' ? { sound: patch.sound } : {}),
            ...(typeof patch.reduceFx === 'boolean' ? { reduceFx: patch.reduceFx } : {}),
            ...(typeof patch.taunts === 'boolean' ? { taunts: patch.taunts } : {})
        }
    };
    saveScippoProfile(next);
    return next;
}

export function resetScippoStats(profile) {
    const next = { ...profile, stats: createDefaultProfile().stats };
    saveScippoProfile(next);
    return next;
}

export function recordScippoMatch(profile, { outcome, mode = 'bot', difficulty = 'normale', score = 0, match = null } = {}) {
    if (!['win', 'loss', 'draw'].includes(outcome)) return profile;
    const stats = { ...profile.stats, winsByLevel: { ...profile.stats.winsByLevel } };
    stats.played += 1;
    if (outcome === 'win') {
        stats.wins += 1;
        stats.streak += 1;
        stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
        if (mode === 'bot' && stats.winsByLevel[difficulty] !== undefined) stats.winsByLevel[difficulty] += 1;
        if (match && (match.stats?.[0]?.jollyPlayed || 0) === 0) stats.jollylessWins += 1;
    } else if (outcome === 'loss') {
        stats.losses += 1;
        stats.streak = 0;
    } else {
        stats.draws += 1;
        stats.streak = 0;
    }
    const numericScore = Number(score);
    if (Number.isFinite(numericScore)) {
        stats.bestScore = stats.bestScore === null ? numericScore : Math.max(stats.bestScore, numericScore);
    }
    if (match?.scores) {
        stats.pointsScored += Number(match.scores[0]) || 0;
        stats.pointsAllowed += Number(match.scores[1]) || 0;
    }
    stats.lastPlayedAt = new Date().toISOString();
    const next = { ...profile, stats };
    saveScippoProfile(next);
    return next;
}

/** Chiave giornaliera in ora locale: la stessa per tutti il stesso giorno. */
export function dailyChallengeKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getDailyChallenge(date = new Date()) {
    const key = dailyChallengeKey(date);
    return {
        key,
        seed: normalizeSeed(`scippo-daily-${key}`),
        difficulty: 'difficile',
        label: `Sfida del ${key.split('-').reverse().join('/')}`,
        composition: { ...DEFAULT_DECK_COMPOSITION },
        maxTurns: REGULATION_TURNS
    };
}

/** Allinea lo stato della sfida quotidiana alla data corrente. */
export function syncDaily(profile, date = new Date()) {
    const key = dailyChallengeKey(date);
    if (profile.daily.date === key) return profile;
    const next = {
        ...profile,
        daily: { date: key, attempts: 0, bestScore: null, completed: false, lastOutcome: null }
    };
    saveScippoProfile(next);
    return next;
}

export function recordDailyResult(profile, { date = new Date(), score = 0, outcome = 'draw' } = {}) {
    const synced = syncDaily(profile, date);
    const daily = { ...synced.daily };
    daily.attempts += 1;
    daily.completed = true;
    daily.lastOutcome = outcome;
    const numericScore = Number(score);
    if (Number.isFinite(numericScore)) {
        daily.bestScore = daily.bestScore === null ? numericScore : Math.max(daily.bestScore, numericScore);
    }
    const next = { ...synced, daily };
    saveScippoProfile(next);
    return next;
}

export function recordChallengeResult(profile, { seed = '', score = 0 } = {}) {
    const key = String(seed);
    const best = profile.challenge.lastSeed === key ? profile.challenge.bestScore : null;
    const numericScore = Number(score);
    const next = {
        ...profile,
        challenge: {
            lastSeed: key,
            bestScore: Number.isFinite(numericScore)
                ? (best === null ? numericScore : Math.max(best, numericScore))
                : best
        }
    };
    saveScippoProfile(next);
    return next;
}

export function winRate(profile) {
    if (!profile?.stats?.played) return null;
    return Math.round((profile.stats.wins / profile.stats.played) * 100);
}

export function deckSummary(deck) {
    return deckCompositionLabel(deck?.composition || DEFAULT_DECK_COMPOSITION);
}

export function deckIsValid(deck) {
    return validateDeckComposition(deck?.composition).valid;
}

export function deckCount(deck) {
    return deckTotal(deck?.composition || {});
}

export function scippoBadges(profile) {
    const stats = profile?.stats || createDefaultProfile().stats;
    return [
        { id: 'first-blood', label: 'Primo scappo', icon: '🥇', description: 'Vinci la prima partita.', earned: stats.wins >= 1 },
        { id: 'regular', label: 'Habitué', icon: '🍺', description: 'Gioca 10 partite.', earned: stats.played >= 10 },
        { id: 'streak', label: 'Mano calda', icon: '🔥', description: 'Vinci 3 partite di fila.', earned: stats.bestStreak >= 3 },
        { id: 'hard', label: 'Cacciatore di bot', icon: '🎯', description: 'Batti il BOT difficile.', earned: (stats.winsByLevel?.difficile || 0) >= 1 },
        { id: 'purist', label: 'Senza jolly', icon: '😎', description: 'Vinci una partita senza giocare JOLLY.', earned: stats.jollylessWins >= 1 },
        { id: 'builder', label: 'Mazziere', icon: '🎨', description: 'Salva un mazzo personalizzato.', earned: (profile?.decks?.length || 0) >= 1 },
        { id: 'daily', label: 'Rituale quotidiano', icon: '📅', description: 'Completa una sfida giornaliera.', earned: Boolean(profile?.daily?.completed) }
    ];
}

export { MAX_DECKS };
