// Soglia dell'avviso "prezzi vecchi" della lista acquisti Magic.
// Modulo puro (nessun DOM, nessun import) così è verificabile senza montare la dashboard.
//
// Precedenza: la scelta salvata (account o dispositivo) vince sempre; senza scelta
// vale VITE_PRICE_MAX_AGE_DAYS impostata al build; senza nemmeno quella resta il
// valore di partenza, perché una soglia deve pur esistere.

export const PRICE_AGE_MIN = 0;
export const PRICE_AGE_MAX = 3650;
export const PRICE_AGE_FALLBACK = 14;

/** Riporta un valore a giorni interi nella scala ammessa; null se non è un numero. */
export function normalizePriceAge(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const days = Number(String(value).trim());
    if (!Number.isFinite(days)) return null;
    return Math.min(PRICE_AGE_MAX, Math.max(PRICE_AGE_MIN, Math.round(days)));
}

/** Soglia di partenza dell'installazione: variabile di build, altrimenti 14 giorni. */
export function resolveDefaultPriceAge(envValue = undefined) {
    return normalizePriceAge(envValue) ?? PRICE_AGE_FALLBACK;
}

/** Soglia effettiva: prima la scelta salvata, poi la variabile di build, poi 14. */
export function resolvePriceAge({ envValue, storedValue } = {}) {
    return normalizePriceAge(storedValue) ?? resolveDefaultPriceAge(envValue);
}
