/**
 * Logica pura del consenso: nessun DOM, nessuna rete.
 * Testabile direttamente con `node --test`.
 */

export const CONSENT_KEY = 'taverna-consent';
export const CONSENT_VERSION = 1;
export const OPTIONAL_CATEGORIES = Object.freeze(['analytics', 'marketing']);

export function emptyConsent(now = Date.now()) {
  return { v: CONSENT_VERSION, analytics: false, marketing: false, ts: now };
}

export function isConsent(value) {
  return Boolean(value)
    && value.v === CONSENT_VERSION
    && typeof value.analytics === 'boolean'
    && typeof value.marketing === 'boolean'
    && typeof value.ts === 'number'
    && Number.isFinite(value.ts);
}

export function readConsent(storage) {
  if (!storage) return null;
  let raw = null;
  try {
    raw = storage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isConsent(parsed) ? { ...parsed } : null;
  } catch {
    return null;
  }
}

export function saveConsent(storage, patch = {}, now = Date.now()) {
  const current = readConsent(storage) ?? emptyConsent(now);
  const next = emptyConsent(now);
  for (const category of OPTIONAL_CATEGORIES) {
    next[category] = typeof patch[category] === 'boolean' ? patch[category] : current[category];
  }
  if (storage) {
    try {
      storage.setItem(CONSENT_KEY, JSON.stringify(next));
    } catch {
      /* storage pieno o bloccato: la scelta vale solo per questa pagina */
    }
  }
  return next;
}

export function grantAll(storage, now = Date.now()) {
  return saveConsent(storage, { analytics: true, marketing: true }, now);
}

export function denyAll(storage, now = Date.now()) {
  return saveConsent(storage, { analytics: false, marketing: false }, now);
}

export function hasConsent(storage, category) {
  if (category === 'necessary') return true;
  const consent = readConsent(storage);
  return Boolean(consent && consent[category] === true);
}

export function clearConsent(storage) {
  if (!storage) return;
  try {
    storage.removeItem(CONSENT_KEY);
  } catch {
    /* niente da fare */
  }
}
