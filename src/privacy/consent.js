import {
  OPTIONAL_CATEGORIES,
  clearConsent,
  denyAll,
  grantAll,
  hasConsent as coreHasConsent,
  readConsent,
  saveConsent,
} from './consent-core.mjs';
import './consent.css';

const COPY = {
  analytics: {
    label: 'Misurazione (analytics)',
    help: 'Conteggi anonimi di visite e partite giocate, per capire cosa funziona. Senza questo permesso non parte nessuna misurazione.',
  },
  marketing: {
    label: 'Marketing',
    help: 'Oggi non è attivo. Se in futuro servisse, potremo mostrare messaggi pertinenti solo con questo permesso.',
  },
};

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function safeStorage() {
  try {
    window.localStorage.setItem('taverna-consent-probe', '1');
    window.localStorage.removeItem('taverna-consent-probe');
    return window.localStorage;
  } catch {
    return memoryStorage();
  }
}

const storage = safeStorage();
let banner = null;
let modal = null;
let lastFocused = null;
let started = false;
const bannerResize = typeof window.ResizeObserver === 'function'
  ? new window.ResizeObserver(() => reserveBannerSpace())
  : null;

/**
 * `event.target` non è sempre un elemento (click sul documento, nodo rimosso):
 * senza `?.` su `closest` il listener sparisce al primo errore.
 */
function targetOf(event, selector) {
  return event.target?.closest?.(selector) ?? null;
}

function copyFor(category) {
  return COPY[category] ?? { label: category, help: '' };
}

/*
 * Il banner è fisso in basso: senza riservare il suo ingombro copre quello che sta
 * sotto (il footer del tavolo, per esempio) e quei pulsanti diventano irraggiungibili.
 */
function reserveBannerSpace() {
  if (!banner) return;
  const height = Math.ceil(banner.getBoundingClientRect().height) + 12;
  document.documentElement.style.setProperty('--tv-consent-space', `${height}px`);
}

function releaseBannerSpace() {
  bannerResize?.disconnect();
  document.documentElement.style.removeProperty('--tv-consent-space');
}

/* ---------- API pubblica ---------- */

export function getConsent() {
  return readConsent(storage);
}

export function hasConsent(category) {
  return coreHasConsent(storage, category);
}

export function openPreferences() {
  if (!document.body) return;
  if (modal) closePreferences();
  const current = getConsent();
  modal = document.createElement('div');
  modal.className = 'tv-consent-modal';
  modal.innerHTML = `
    <div class="tv-consent-modal__backdrop" data-consent-close></div>
    <div class="tv-consent-modal__panel" role="dialog" aria-modal="true" aria-labelledby="tv-prefs-title">
      <header class="tv-consent-modal__head">
        <h2 id="tv-prefs-title">Preferenze cookie</h2>
        <button type="button" class="tv-consent__icon" data-consent-close aria-label="Chiudi">×</button>
      </header>
      <p class="tv-consent-modal__lead">
        I cookie necessari tengono in piedi il tavolo e non si possono spegnere.
        Gli altri restano spenti finché non li accendi tu.
      </p>
      <ul class="tv-consent-list">
        <li class="tv-consent-list__item">
          <div>
            <strong>Necessari</strong>
            <p>Sessione, sicurezza, preferenze di gioco. Sempre attivi.</p>
          </div>
          <span class="tv-consent-switch tv-consent-switch--locked" aria-hidden="true"></span>
        </li>
        ${OPTIONAL_CATEGORIES.map((category) => `
          <li class="tv-consent-list__item">
            <div>
              <label for="tv-consent-${category}"><strong>${copyFor(category).label}</strong></label>
              <p id="tv-consent-help-${category}">${copyFor(category).help}</p>
            </div>
            <input
              id="tv-consent-${category}"
              class="tv-consent-switch"
              type="checkbox"
              role="switch"
              data-consent-category="${category}"
              aria-describedby="tv-consent-help-${category}"
              ${current && current[category] ? 'checked' : ''}
            />
          </li>`).join('')}
      </ul>
      <footer class="tv-consent-modal__foot">
        <button type="button" class="tv-btn tv-btn--ghost" data-consent="reject-all">Rifiuta tutti</button>
        <button type="button" class="tv-btn tv-btn--ghost" data-consent="save">Salva preferenze</button>
        <button type="button" class="tv-btn tv-btn--solid" data-consent="accept-all">Accetta tutti</button>
      </footer>
      <p class="tv-consent-modal__note">
        Dettaglio dei cookie nella <a href="/cookie.html">pagina Cookie</a>.
      </p>
    </div>`;
  document.body.appendChild(modal);
  lastFocused = document.activeElement;

  modal.addEventListener('click', onModalClick);
  modal.addEventListener('keydown', onModalKeydown);
  const firstSwitch = modal.querySelector('input');
  if (firstSwitch) firstSwitch.focus();
}

export function closePreferences() {
  if (!modal) return;
  modal.removeEventListener('click', onModalClick);
  modal.removeEventListener('keydown', onModalKeydown);
  modal.remove();
  modal = null;
  /* Se chi ha aperto la modale era un pulsante del banner, quel pulsante è già sparito. */
  if (lastFocused?.isConnected) lastFocused.focus();
  lastFocused = null;
}

/** Cancella la scelta salvata e riapre il banner. */
export function revokeConsent() {
  clearConsent(storage);
  closePreferences();
  emit(null);
  showBanner();
}

export function initConsent() {
  if (started) return getConsent();
  started = true;
  document.addEventListener('click', onDocumentClick);

  const start = () => {
    const stored = getConsent();
    if (!stored) {
      showBanner();
      return null;
    }
    syncConsentMode(stored);
    return stored;
  };

  if (document.body) return start();
  /* Chiamato prima del body (script in <head>): il banner compare appena il DOM è pronto. */
  document.addEventListener('DOMContentLoaded', start, { once: true });
  return null;
}

/* ---------- Banner ---------- */

function showBanner() {
  if (banner || !document.body) return;
  banner = document.createElement('section');
  banner.className = 'tv-consent';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-labelledby', 'tv-consent-title');
  banner.innerHTML = `
    <div class="tv-consent__text">
      <h2 id="tv-consent-title">Cookie e dati</h2>
      <p>
        Usiamo cookie necessari per far funzionare il tavolo. Con il tuo permesso useremmo
        anche cookie di misurazione; il marketing oggi è spento. Puoi cambiare idea quando
        vuoi da <button type="button" class="tv-consent__link" data-consent="prefs">Preferenze cookie</button>.
      </p>
    </div>
    <div class="tv-consent__actions">
      <button type="button" class="tv-btn tv-btn--ghost" data-consent="reject">Rifiuta</button>
      <button type="button" class="tv-btn tv-btn--ghost" data-consent="prefs">Preferenze</button>
      <button type="button" class="tv-btn tv-btn--solid" data-consent="accept">Accetta tutti</button>
    </div>`;
  banner.addEventListener('click', onBannerClick);
  document.body.appendChild(banner);
  document.body.classList.add('tv-consent-open');
  reserveBannerSpace();
  bannerResize?.observe(banner);
}

function hideBanner() {
  if (banner) {
    banner.removeEventListener('click', onBannerClick);
    banner.remove();
    banner = null;
  }
  releaseBannerSpace();
  document.body?.classList.remove('tv-consent-open');
}

/* ---------- Azioni ---------- */

function acceptAll() {
  apply(grantAll(storage));
}

function rejectAll() {
  apply(denyAll(storage));
}

function saveFromModal() {
  const patch = {};
  for (const category of OPTIONAL_CATEGORIES) {
    const input = modal?.querySelector(`[data-consent-category="${category}"]`);
    patch[category] = Boolean(input?.checked);
  }
  apply(saveConsent(storage, patch));
}

function apply(consent) {
  hideBanner();
  closePreferences();
  emit(consent);
}

function emit(consent) {
  syncConsentMode(consent);
  window.dispatchEvent(new CustomEvent('taverna:consent-changed', { detail: consent }));
}

function syncConsentMode(consent) {
  if (typeof window.gtag !== 'function') return;
  const analytics = Boolean(consent && consent.analytics);
  const marketing = Boolean(consent && consent.marketing);
  window.gtag('consent', 'update', {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  });
}

/* ---------- Eventi ---------- */

function onBannerClick(event) {
  const action = targetOf(event, '[data-consent]');
  if (!action) return;
  switch (action.dataset.consent) {
    case 'accept': acceptAll(); break;
    case 'reject': rejectAll(); break;
    case 'prefs': openPreferences(); break;
    default: break;
  }
}

function onModalClick(event) {
  if (targetOf(event, '[data-consent-close]')) {
    closePreferences();
    return;
  }
  const action = targetOf(event, '[data-consent]');
  if (!action) return;
  switch (action.dataset.consent) {
    case 'accept-all': acceptAll(); break;
    case 'reject-all': rejectAll(); break;
    case 'save': saveFromModal(); break;
    default: break;
  }
}

function onModalKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closePreferences();
    return;
  }
  if (event.key !== 'Tab' || !modal) return;
  const focusable = modal.querySelectorAll('button, input, a[href]');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function onDocumentClick(event) {
  const opener = targetOf(event, '[data-consent-open]');
  if (!opener) return;
  event.preventDefault();
  openPreferences();
}
