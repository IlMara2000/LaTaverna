import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONSENT_KEY,
  CONSENT_VERSION,
  clearConsent,
  denyAll,
  grantAll,
  hasConsent,
  readConsent,
  saveConsent,
} from '../../src/privacy/consent-core.mjs';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

test('senza scelta salvata non c’è consenso', () => {
  const storage = memoryStorage();
  assert.equal(readConsent(storage), null);
  assert.equal(hasConsent(storage, 'analytics'), false);
  assert.equal(hasConsent(storage, 'marketing'), false);
});

test('i cookie necessari sono sempre consentiti', () => {
  assert.equal(hasConsent(memoryStorage(), 'necessary'), true);
});

test('la scelta viene salvata e riletta', () => {
  const storage = memoryStorage();
  const consent = saveConsent(storage, { analytics: true });
  assert.equal(consent.v, CONSENT_VERSION);
  assert.equal(consent.analytics, true);
  assert.equal(consent.marketing, false);
  assert.equal(hasConsent(storage, 'analytics'), true);
  assert.equal(hasConsent(storage, 'marketing'), false);
  assert.ok(JSON.parse(storage.dump()[CONSENT_KEY]).ts > 0);
});

test('un salvataggio parziale non azzera le altre categorie', () => {
  const storage = memoryStorage();
  saveConsent(storage, { analytics: true, marketing: true });
  saveConsent(storage, { analytics: false });
  assert.equal(hasConsent(storage, 'analytics'), false);
  assert.equal(hasConsent(storage, 'marketing'), true);
});

test('accetta tutti e rifiuta tutti', () => {
  const storage = memoryStorage();
  grantAll(storage);
  assert.equal(hasConsent(storage, 'analytics'), true);
  assert.equal(hasConsent(storage, 'marketing'), true);
  denyAll(storage);
  assert.equal(hasConsent(storage, 'analytics'), false);
  assert.equal(hasConsent(storage, 'marketing'), false);
});

test('un consenso senza data valida vale come assente', () => {
  const storage = memoryStorage({
    [CONSENT_KEY]: JSON.stringify({ v: CONSENT_VERSION, analytics: true, marketing: true }),
  });
  assert.equal(readConsent(storage), null);
  assert.equal(hasConsent(storage, 'analytics'), false);
});

test('una versione vecchia del consenso vale come assente', () => {
  const storage = memoryStorage({
    [CONSENT_KEY]: JSON.stringify({ v: 0, analytics: true, marketing: true, ts: 1 }),
  });
  assert.equal(readConsent(storage), null);
  assert.equal(hasConsent(storage, 'analytics'), false);
});

test('un valore corrotto non fa esplodere nulla', () => {
  const storage = memoryStorage({ [CONSENT_KEY]: '{non-json' });
  assert.equal(readConsent(storage), null);
  assert.equal(hasConsent(storage, 'analytics'), false);
});

test('la revoca cancella la scelta', () => {
  const storage = memoryStorage();
  grantAll(storage);
  clearConsent(storage);
  assert.equal(readConsent(storage), null);
  assert.equal(hasConsent(storage, 'analytics'), false);
});

test('storage assente o che lancia non rompe la lettura', () => {
  assert.equal(readConsent(null), null);
  assert.equal(hasConsent(null, 'analytics'), false);
  const throwing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.equal(readConsent(throwing), null);
  assert.doesNotThrow(() => saveConsent(throwing, { analytics: true }));
  assert.doesNotThrow(() => clearConsent(throwing));
});
