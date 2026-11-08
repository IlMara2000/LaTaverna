/**
 * IL QUADERNO DEGLI SBAGLI — la ricetta che il gioco non ha.
 *
 * Questo modulo è puro: nessun DOM, nessun timer, nessuna casualità.
 * La carta del sale NON entra in scippoEngine.js di proposito: il motore
 * verifica `CARD_TYPES` a quattro semi e simula 300 partite deterministiche,
 * quindi un quinto tipo romperebbe le sue invarianti. Il tavolo 0 è uno
 * spettacolo da un turno solo, risolto qui.
 */

import {
    MAX_JOLLY_COPIES,
    MAX_NORMAL_COPIES,
    MIN_NORMAL_COPIES,
    NORMAL_CARD_IDS
} from './scippoEngine.js';

export const QUADERNO_STORAGE_KEY = 'taverna:scippo:quaderno:v1';

/** Il totale che il mazziere può raggiungere: ogni carta al suo massimo. */
const DRUNK_TOTAL = NORMAL_CARD_IDS.length * MAX_NORMAL_COPIES + MAX_JOLLY_COPIES;

/** Gli otto easter egg, nell'ordine degli slot della ricetta. */
export const EGG_IDS = Object.freeze([
    'pulsante',
    'orario',
    'refuso',
    'annulla',
    'tavolo',
    'scontrino',
    'bilancia',
    'turno'
]);

export const SECRET_LINE = 'L’ultimo cucchiaio entra a fuoco spento. Non si assaggia. Chi assaggia l’ultimo cucchiaio non sente più il piatto: sente il sale che non c’è. E allora lo aggiunge. E allora è finita. Per questo non si scrive: chi la scrive, la assaggia.';

/**
 * Le otto righe del Quaderno. Le prime sette si guadagnano; l'ottava non è
 * testo finché non la si perde al tavolo 0, ed è per questo che non ha un
 * `text` utilizzabile prima della rivelazione.
 */
export const FRAGMENTS = Object.freeze([
    {
        id: 'pulsante',
        label: 'IL NOME',
        text: 'Si chiama IL NONO perché è il piatto che il menù non ha. Al tavolo 0 non si ordina: si aspetta.'
    },
    {
        id: 'orario',
        label: 'IL PRIMO GESTO',
        text: 'Si parte da freddo. La pentola non si scalda prima: ci si mette dentro tutto e poi si accende, così nessuno può dire che era già pronto.'
    },
    {
        id: 'refuso',
        label: 'L’INGREDIENTE CHE NON SI DICE',
        text: 'Il sale non c’è. Non è una dimenticanza: è la dose. Chi legge “sale q.b.” ha già rovinato la minestra.'
    },
    {
        id: 'annulla',
        label: 'LA DOSE SBAGLIATA',
        text: 'Le dosi si misurano a residuo: quello che avanza nel barattolo è la dose giusta. Se il barattolo si svuota, hai cucinato per il doppio dei presenti.'
    },
    {
        id: 'tavolo',
        label: 'IL TEMPO',
        text: 'Cuoce il tempo che serve a raccontare una partita di SCIPPO. Quando l’avversario ha perso due volte, è pronto.'
    },
    {
        id: 'scontrino',
        label: 'IL FUOCO',
        text: 'Si spegne prima. Il fuoco non serve a cuocere: serve a convincere l’acqua che è il momento.'
    },
    {
        id: 'bilancia',
        label: 'LA MANO',
        text: 'Si mescola con la mano che non usi. La mano che tiene il mestolo non deve sapere cosa sta facendo, altrimenti corregge.'
    },
    {
        id: 'turno',
        label: 'IL SEGRETO',
        text: SECRET_LINE,
        secret: true
    }
]);

/**
 * La carta che non sta nel mazzo: perde con tutto, anche col jolly, perché non
 * è una carta del gioco. È l'unica cosa che il jolly riesce a vincere — e la
 * vince solo perché non conta niente. Le manca il sale.
 */
export const SALE_CARD = Object.freeze({
    id: 'sale',
    label: 'SALE',
    name: 'La carta del sale',
    rule: 'Perde con tutto. Anche col jolly.',
    icon: '🧂'
});

export const CANTINA_STATES = Object.freeze(['locked', 'revealed', 'transcribed', 'kept']);

export const CANTINA_COPY = Object.freeze({
    refusal: 'NON HAI ANCORA SBAGLIATO ABBASTANZA.',
    door: 'MANCA UN AVVERSARIO.',
    sit: 'SÈDITI AL TAVOLO 0',
    stake: 'BOTTINO ZERO. SE VINCI NON PRENDI NIENTE. SE PERDI PRENDI TUTTO.',
    play: 'GIOCA LA CARTA DEL SALE',
    notYourTurn: 'NON È IL TUO TURNO.',
    eggFound: 'IL QUADERNO HA SEGNATO UNA RIGA.',
    win: 'HO VINTO COL JOLLY.',
    winAfter: 'NON DOVEVO.',
    write: 'SCRIVILA',
    keep: 'LASCIA COSÌ',
    written: 'TRASCRIZIONE SBAGLIATA',
    writtenNote: 'OGNI VOLTA CHE LA RILEGGI È UN PO’ DIVERSA. HAI SENTITO IL SALE CHE NON C’È.',
    kept: 'BRAVO. COSÌ È ANCORA VERA.',
    noStorage: 'IL QUADERNO NON SALVA.'
});

/** Parole sbagliate per la trascrizione: una per visita, nove in tutto. */
const WRONG_WORDS = Object.freeze([
    'pepe',
    'brodo',
    'burro',
    'rosmarino',
    'limone',
    'prezzemolo',
    'dado',
    'vino',
    'zucchero'
]);

const TOTAL_EGGS = EGG_IDS.length;

let memoryQuaderno = null;
let storageProbed = false;
let storageUsable = false;

function defaultStorage() {
    if (storageProbed) return storageUsable ? globalThis.localStorage : null;
    storageProbed = true;
    try {
        const storage = globalThis.localStorage;
        if (!storage) return null;
        // Safari in navigazione privata accetta la proprietà e lancia su setItem.
        const probe = '__scq_probe__';
        storage.setItem(probe, '1');
        storage.removeItem(probe);
        storageUsable = true;
        return storage;
    } catch {
        storageUsable = false;
        return null;
    }
}

/** Dice se il Quaderno sopravvive alla chiusura della scheda. */
export function canPersistQuaderno(storage = defaultStorage()) {
    return Boolean(storage);
}

const clampCount = value => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return Math.min(Math.trunc(number), Number.MAX_SAFE_INTEGER);
};

export function normalizeQuaderno(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const seen = new Set();
    const eggs = [];
    if (Array.isArray(source.eggs)) {
        source.eggs.forEach(id => {
            if (typeof id !== 'string' || !EGG_IDS.includes(id) || seen.has(id)) return;
            seen.add(id);
            eggs.push(id);
        });
    }
    // Forma canonica: ordine degli slot, non ordine di scoperta.
    eggs.sort((a, b) => EGG_IDS.indexOf(a) - EGG_IDS.indexOf(b));
    // Coerenza: la cantina non può essere aperta se manca anche un solo sbaglio.
    const complete = eggs.length === TOTAL_EGGS;
    const requested = typeof source.cantina === 'string' && CANTINA_STATES.includes(source.cantina)
        ? source.cantina
        : 'locked';
    const cantina = complete ? requested : 'locked';

    return {
        version: 1,
        eggs,
        cantina,
        visits: clampCount(source.visits),
        transcriptions: clampCount(source.transcriptions)
    };
}

export function loadQuaderno(storage = defaultStorage()) {
    if (!storage) return normalizeQuaderno(memoryQuaderno);
    try {
        const raw = storage.getItem(QUADERNO_STORAGE_KEY);
        if (!raw) return normalizeQuaderno(null);
        return normalizeQuaderno(JSON.parse(raw));
    } catch {
        return normalizeQuaderno(null);
    }
}

export function saveQuaderno(quaderno, storage = defaultStorage()) {
    const clean = normalizeQuaderno(quaderno);
    if (!storage) {
        memoryQuaderno = clean;
        return clean;
    }
    try {
        storage.setItem(QUADERNO_STORAGE_KEY, JSON.stringify(clean));
    } catch {
        // Quota piena o storage bloccato: il Quaderno resta almeno in memoria.
        memoryQuaderno = clean;
    }
    return clean;
}

export function registerEgg(quaderno, eggId) {
    const clean = normalizeQuaderno(quaderno);
    if (!EGG_IDS.includes(eggId) || clean.eggs.includes(eggId)) {
        return { quaderno: clean, added: false };
    }
    const eggs = EGG_IDS.filter(id => clean.eggs.includes(id) || id === eggId);
    return { quaderno: normalizeQuaderno({ ...clean, eggs }), added: true };
}

export function quadernoProgress(quaderno) {
    const clean = normalizeQuaderno(quaderno);
    const found = clean.eggs.length;
    return {
        found,
        total: TOTAL_EGGS,
        complete: found === TOTAL_EGGS,
        nextEgg: EGG_IDS.find(id => !clean.eggs.includes(id)) || null
    };
}

/** Il frammento di uno slot, leggibile solo se guadagnato. */
export function fragmentFor(eggId, quaderno) {
    const clean = normalizeQuaderno(quaderno);
    const fragment = FRAGMENTS.find(entry => entry.id === eggId);
    if (!fragment) return null;
    return { ...fragment, found: clean.eggs.includes(eggId) };
}


export function openCantina(quaderno) {
    const clean = normalizeQuaderno(quaderno);
    if (clean.eggs.length !== TOTAL_EGGS) return clean;
    if (clean.cantina !== 'locked') return clean;
    return normalizeQuaderno({ ...clean, cantina: 'revealed' });
}

/**
 * Un turno, nessun dado: il giocatore ha la carta del sale, il banco ha il
 * jolly, e il jolly vince. È l'unico esito impossibile del gioco.
 */
export function resolveCantinaTurn() {
    return Object.freeze({
        player: SALE_CARD.id,
        dealer: 'jolly',
        winner: 'dealer',
        points: 0,
        impossible: true
    });
}

export function chooseCantina(quaderno, mode) {
    const clean = normalizeQuaderno(quaderno);
    if (clean.cantina !== 'revealed') return clean;
    if (mode === 'write') {
        return normalizeQuaderno({
            ...clean,
            cantina: 'transcribed',
            transcriptions: clean.transcriptions + 1
        });
    }
    if (mode === 'keep') return normalizeQuaderno({ ...clean, cantina: 'kept' });
    return clean;
}

export function noteQuadernoVisit(quaderno) {
    const clean = normalizeQuaderno(quaderno);
    return normalizeQuaderno({ ...clean, visits: clean.visits + 1 });
}

/** La ricetta trascritta sbagliata: una parola diversa a ogni visita. */
export function transcriptionFor(index = 0) {
    const safe = Math.abs(Math.trunc(Number(index) || 0));
    const word = WRONG_WORDS[safe % WRONG_WORDS.length];
    return {
        word,
        text: SECRET_LINE.replace('il sale che non c’è', `il ${word} che non c’è`)
    };
}

export function wrongWordPool() {
    return [...WRONG_WORDS];
}

/* ------------------------------------------------------------------ *
 * I riconoscitori degli sbagli. Ognuno è una funzione pura: la superficie
 * che li scatena è in scippo.js, la legge che li riconosce è qui.
 * ------------------------------------------------------------------ */

const foldName = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * 2 — Le 03:33: l'ora in cui il banco non dovrebbe aprire. È l'unico
 * sbaglio legato all'orologio, e chiede solo di essere svegli, non di
 * aspettare un timer.
 */
export function isWitchingHour(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    return !Number.isNaN(value.getTime()) && value.getHours() === 3;
}

/** 3 — Il Nome Sbagliato: una P sola, il refuso è l'indizio. */
export function isMisspelledDeckName(name) {
    return foldName(name) === 'scipo';
}

/**
 * 7 — La Bilancia Ubriaca: ogni carta è legale, la somma no. Il mazziere
 * arriva al totale massimo e la bilancia accusa il colpo.
 */
export function isDrunkDeck(composition) {
    if (!composition || typeof composition !== 'object') return false;
    const counts = {};
    let total = 0;
    let legal = true;
    NORMAL_CARD_IDS.forEach(id => {
        const value = Number(composition[id]);
        const count = Number.isFinite(value) ? Math.trunc(value) : 0;
        counts[id] = count;
        total += count;
        if (count < MIN_NORMAL_COPIES || count > MAX_NORMAL_COPIES) legal = false;
    });
    const jolly = Number(composition.jolly);
    const jollyCount = Number.isFinite(jolly) ? Math.trunc(jolly) : 0;
    counts.jolly = jollyCount;
    total += jollyCount;
    if (jollyCount < 0 || jollyCount > MAX_JOLLY_COPIES) legal = false;
    return legal && total === DRUNK_TOTAL;
}

export const DRUNK_DECK_TOTAL = DRUNK_TOTAL;

export const KNOWN_DIFFICULTIES = Object.freeze(['facile', 'normale', 'difficile']);

/**
 * 5 — Il Tavolo Sconosciuto: un codice che il gioco non conosce viene
 * accettato lo stesso. La difficoltà resta giocabile, il tavolo no.
 */
export function parseChallengeCode(raw) {
    if (typeof raw !== 'string') return null;
    const code = raw.trim();
    const match = /^([a-z]+)-([0-9a-z]+)$/i.exec(code);
    if (!match) return null;
    const seed = Number.parseInt(match[2], 36);
    if (!Number.isFinite(seed)) return null;
    const requested = match[1].toLowerCase();
    const unknown = !KNOWN_DIFFICULTIES.includes(requested);
    return {
        code,
        requested,
        difficulty: unknown ? 'normale' : requested,
        seed: seed >>> 0,
        unknown
    };
}
