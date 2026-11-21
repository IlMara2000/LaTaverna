/**
 * Tavolo di gioco: markup, viste e comandi del solo campo.
 *
 * Non conosce le regole e non possiede lo stato: riceve le carte dal chiamante
 * e gli restituisce intenzioni. `onTogglePermanent` è una richiesta, non una
 * scrittura: la carta cambia dopo che il motore ha confermato.
 *
 * Opzioni: own, hand, opponents, commands, zones, status, mana, tileExtra,
 * onTogglePermanent, onPreview, onExit, onAbandon.
 */

import './table.css';
import './rotate-gate.css';
import './arena.css';
import { exitImmersive } from './immersive.js';

/* ───────────────────────────── markup ───────────────────────────── */

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));
const statLine = card => (card.power && card.toughness ? `${card.power}/${card.toughness}` : '');
const counterLabel = card => (card.counters > 0 ? `+${card.counters}` : '');

function tileHtml(card, side, zone = 'board', extra = '') {
  const art = card.image
    ? `<img class="mt-card__art" src="${esc(card.image)}" alt="" loading="lazy" decoding="async">`
    : '<span class="mt-card__art mt-card__art--empty" aria-hidden="true"></span>';
  const pressed = zone === 'board' ? ` aria-pressed="${card.tapped ? 'true' : 'false'}"` : '';
  const badges = [
    card.commander ? '<span class="mt-card__badge mt-card__badge--commander">CMD</span>' : '',
    card.attacking ? '<span class="mt-card__badge mt-card__badge--attack">ATTACCA</span>' : '',
    card.blocking ? '<span class="mt-card__badge mt-card__badge--block">BLOCCA</span>' : '',
    counterLabel(card) ? `<span class="mt-card__badge mt-card__badge--counter">${esc(counterLabel(card))}</span>` : '',
    card.damage > 0 ? `<span class="mt-card__badge mt-card__badge--damage">−${esc(card.damage)}</span>` : '',
  ].join('');
  const stat = statLine(card);
  const classes = ['mt-card'];
  if (card.tapped) classes.push('is-tapped');
  if (card.attacking) classes.push('is-attacking');
  if (card.blocking) classes.push('is-blocking');
  return `<div class="${classes.join(' ')}" data-card-id="${esc(card.id)}" data-side="${esc(side)}" data-zone="${esc(zone)}"${pressed}>
    ${art}
    <span class="mt-card__name">${esc(card.name)}</span>
    ${stat ? `<span class="mt-card__stat">${esc(stat)}</span>` : ''}
    ${badges}
    ${extra ? `<div class="mt-card__actions">${extra}</div>` : ''}
  </div>`;
}

function rowHtml(inner, side) {
  const empty = side === 'opponent' ? 'Nessun permanente avversario' : 'Il tuo campo è vuoto';
  return `<div class="mt-row mt-row--${esc(side)}">${inner || `<p class="mt-row__empty">${empty}</p>`}</div>`;
}

const handHtml = inner => `<div class="mt-hand">${inner || '<p class="mt-row__empty">Nessuna carta in mano</p>'}</div>`;

function opponentHeadHtml(foe) {
  if (!foe) return '<div class="mt-opponent-head"><span>In attesa di un avversario</span></div>';
  const commandDamage = Math.max(0, ...Object.values(foe.commanderDamage || {}).map(Number));
  return `<div class="mt-opponent-head${foe.eliminated ? ' is-out' : ''}">
    <span class="mt-opponent-head__name">${esc(foe.name)}</span>
    <span class="mt-opponent-head__life"><b>${esc(foe.life)}</b> ♥</span>
    ${commandDamage > 0 ? `<span class="mt-opponent-head__cmd">CMD ${commandDamage}/21</span>` : ''}
    <span class="mt-opponent-head__count">${foe.cards.length} in campo · ${foe.handCount ?? '?'} in mano · ${foe.graveyardCount ?? 0} al cimitero</span>
  </div>`;
}

function opponentSwitcherHtml(opponents, activeId) {
  if (!opponents || opponents.length < 2) return '';
  return `<div class="mt-opponents" role="group" aria-label="Avversari">${opponents.map(foe => `
    <button type="button" class="mt-opponents__chip" data-opponent="${esc(foe.id)}" aria-pressed="${foe.id === activeId}">
      <span class="mt-opponents__name">${esc(foe.name)}</span>
      <span class="mt-opponents__stat">${esc(foe.life)} ♥ · ${foe.cards.length} in campo</span>
    </button>`).join('')}</div>`;
}

function menuHtml(open) {
  return `<div class="mt-menu${open ? ' is-open' : ''}">
    <button type="button" class="mt-menu__toggle" data-menu-toggle aria-expanded="${open ? 'true' : 'false'}" aria-label="${open ? 'Chiudi il menu' : 'Apri il menu'}">☰</button>
    <div class="mt-menu__scrim" data-menu-close></div>
    <div class="mt-menu__drawer" role="dialog" aria-modal="true" aria-label="Partita">
      <p class="mt-menu__title">Partita</p>
      <button type="button" class="mt-menu__item" data-menu-close>Chiudi</button>
      <button type="button" class="mt-menu__item" data-menu-exit>Esci e torna a Magic</button>
      <button type="button" class="mt-menu__item mt-menu__item--danger" data-menu-abandon>Abbandona la partita</button>
    </div>
  </div>`;
}

const zoneList = (label, cards, zone) => `<details class="mt-zones__zone">
  <summary>${label} <b>${(cards || []).length}</b></summary>
  <ul>${(cards || []).map(card => `<li><button type="button" class="mt-zones__card" data-card-id="${esc(cardId(card))}" data-side="opponent" data-zone="${esc(zone)}">${esc(card?.name || 'Carta')}</button></li>`).join('') || '<li class="mt-zones__empty">Vuoto</li>'}</ul>
</details>`;

/** Cimiteri, esilio e zone di comando di tutti: in Commander sono parte del gioco. */
function zonesHtml(zones, open) {
  if (!zones) return '';
  const groups = [zones.own, ...(zones.opponents || [])].filter(Boolean);
  return `<div class="mt-zones${open ? ' is-open' : ''}" data-zones-panel>
    <div class="mt-zones__scrim" data-zones-close></div>
    <div class="mt-zones__panel" role="dialog" aria-modal="true" aria-label="Cimitero ed esilio">
      <header class="mt-zones__head">
        <p class="mt-zones__title">Cimiteri e zone</p>
        <button type="button" class="mt-zones__close" data-zones-close>Chiudi</button>
      </header>
      ${groups.map(group => `<section class="mt-zones__group">
        <p class="mt-zones__name">${esc(group.name || 'Giocatore')} <span>grimorio ${group.library ?? 0}</span></p>
        ${zoneList('Cimitero', group.graveyard, 'graveyard')}
        ${zoneList('Esilio', group.exile, 'exile')}
        ${zoneList('Zona di comando', group.command, 'command')}
      </section>`).join('')}
    </div>
  </div>`;
}

/* ───────────────────────────── viste ────────────────────────────── */

const ACTIONS = '[data-menu-toggle],[data-menu-close],[data-menu-exit],[data-menu-abandon],[data-opponent],[data-arena-exit],[data-zones],[data-zones-close]';

/** Lo stesso ordine di `idOf` in magicPlay.js: `instanceId` prima di `uid`. */
const cardId = card => String(card?.instanceId ?? card?.uid ?? card?.id ?? '');
const isCreature = card => /\bcreature\b/i.test(String(card?.typeLine || ''));
const isNumeric = value => /^-?\d+$/.test(String(value ?? ''));

function stat(card, which) {
  const raw = which === 'power' ? card?.power : card?.toughness;
  if (!isNumeric(raw)) return String(raw ?? '');
  const base = Number.parseInt(raw, 10) || 0;
  const plusOne = Number(card?.counters?.plusOne || 0) || 0;
  const boost = which === 'power' ? card?.turnBoost?.power : card?.turnBoost?.toughness;
  const anthem = which === 'power' ? card?.anthemBoost?.power : card?.anthemBoost?.toughness;
  return String(base + plusOne + (Number(boost) || 0) + (Number(anthem) || 0));
}

function toView(card, side, zone) {
  const onBoard = zone === 'board';
  const creature = onBoard && isCreature(card);
  return {
    id: cardId(card),
    name: card?.name || 'Carta',
    image: card?.image || '',
    tapped: onBoard ? Boolean(card?.tapped) : false,
    counters: Number(card?.counters?.plusOne || 0) || 0,
    power: creature ? stat(card, 'power') : '',
    toughness: creature ? stat(card, 'toughness') : '',
    damage: onBoard ? Number(card?.damageMarked || 0) || 0 : 0,
    attacking: onBoard ? Boolean(card?.attacking) : false,
    blocking: onBoard ? Boolean(card?.blocking) : false,
    commander: Boolean(card?.isCommander),
    side,
    zone,
  };
}

/* ───────────────────────────── tavolo ───────────────────────────── */

export function showMatchTable(host, options = {}) {
  if (!host) throw new Error('showMatchTable: host mancante');

  const state = {
    own: options.own || [],
    hand: options.hand || [],
    opponents: options.opponents || [],
    activeOpponentId: options.opponents?.[0]?.id || null,
    commands: options.commands || '',
    zones: options.zones || null,
    status: options.status || '',
    mana: options.mana || '',
    life: options.life ?? '',
    tileExtra: options.tileExtra || null,
    menuOpen: false,
    zonesOpen: false,
    keyboardFocus: false,
    views: new Map(),
    disposed: false,
  };

  // Ambiente separato, come la sessione D&D: la pagina sotto il tavolo non
  // scorre e la shell dell'app si spegne via CSS (body.magic-arena-active).
  const pageOverflow = {
    html: document.documentElement.style.overflow,
    body: document.body.style.overflow,
  };
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.body.classList.add('magic-arena-active');

  host.innerHTML = `<div class="mt-table">
    <header class="mt-arena-bar">
      <span class="mt-arena-bar__tag">TAVOLO · MAGIC</span>
      <p class="mt-arena-bar__status" data-slot="status"></p>
      <p class="mt-arena-bar__vitals" data-slot="vitals"></p>
      <div class="mt-arena-bar__actions">
        <button type="button" class="mt-arena-bar__button" data-zones aria-haspopup="dialog">Cimiteri</button>
        <button type="button" class="mt-arena-bar__button mt-arena-bar__exit" data-arena-exit>ESCI</button>
      </div>
    </header>
    <div class="mt-stage">
      <div data-slot="board"></div>
      <div data-slot="zones"></div>
      <div data-slot="menu"></div>
    </div>
  </div>
  <div class="rotate-gate" data-rotate-gate role="status" aria-live="polite">
    <div class="rotate-gate__panel">
      <div class="rotate-gate__icon" aria-hidden="true"></div>
      <p class="rotate-gate__text">La partita si gioca in orizzontale.</p>
      <p class="rotate-gate__hint">Ruota il dispositivo per continuare.</p>
      <button type="button" class="rotate-gate__exit" data-gate-exit>Esci dal tavolo</button>
    </div>
  </div>`;
  const root = host.firstElementChild;
  const stage = root.querySelector('.mt-stage');
  const slots = {
    board: root.querySelector('[data-slot="board"]'),
    zones: root.querySelector('[data-slot="zones"]'),
    menu: root.querySelector('[data-slot="menu"]'),
    status: root.querySelector('[data-slot="status"]'),
    vitals: root.querySelector('[data-slot="vitals"]'),
    rotateGate: host.querySelector('[data-rotate-gate]'),
  };

  // Gate di rotazione: osserva il viewport e mostra il gate in verticale.
  // Il solo evento 'change' di matchMedia non scatta in alcuni browser/ambienti
  // (es. ridimensionamento programmatico o schermo che non emette orientationchange),
  // quindi si rivaluta anche su resize e orientationchange.
  const PORTRAIT_QUERY = '(orientation: portrait)';
  // Tre casi, tre comportamenti:
  // - mouse: nessun gate, il tavolo resta un riquadro 16:9 (vedi arena.css);
  // - touch con screen.orientation.lock: avviso di 2 secondi, una volta per partita;
  // - touch senza lock (iOS Safari): gate pieno, perché la rotazione non si può
  //   imporre e in verticale il campo resterebbe illeggibile.
  const coarsePointer = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
  const canLockOrientation = typeof screen !== 'undefined'
    && Boolean(screen.orientation)
    && typeof screen.orientation.lock === 'function';
  let noticeConsumed = false;
  let portraitMql = null;
  let onOrientationChange = null;
  let onResize = null;
  const applyRotation = (portrait) => {
    const vertical = Boolean(portrait);
    const notice = vertical && coarsePointer && canLockOrientation && !noticeConsumed;
    const blocking = vertical && coarsePointer && !canLockOrientation;
    if (notice) noticeConsumed = true;
    if (slots.rotateGate) {
      slots.rotateGate.classList.toggle('is-visible', notice || blocking);
      slots.rotateGate.classList.toggle('is-blocking', blocking);
    }
    if (stage) stage.inert = blocking;
  };
  const gateExit = slots.rotateGate?.querySelector('[data-gate-exit]');
  const onGateExit = () => options.onExit?.();
  gateExit?.addEventListener('click', onGateExit);
  const recomputeRotation = () => {
    if (portraitMql) applyRotation(portraitMql.matches);
    else if (typeof window !== 'undefined') applyRotation(window.innerHeight > window.innerWidth);
  };
  if (typeof window !== 'undefined') {
    if (typeof window.matchMedia === 'function') {
      portraitMql = window.matchMedia(PORTRAIT_QUERY);
      onOrientationChange = () => recomputeRotation();
      portraitMql.addEventListener('change', onOrientationChange);
    }
    onResize = () => recomputeRotation();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    recomputeRotation();
  }

  const activeOpponent = () => state.opponents.find(foe => foe.id === state.activeOpponentId) || state.opponents[0] || null;
  const cardsHtml = (cards, side, zone) => (cards || []).map(card => {
    const view = toView(card, side, zone);
    state.views.set(view.id, view);
    // I comandi valgono solo per le carte proprie: sulle carte avversarie un
    // pulsante Mana/Attacca sarebbe una richiesta che il motore rifiuta.
    const extra = side === 'own' && state.tileExtra ? state.tileExtra(card) : '';
    return tileHtml(view, side, zone, extra);
  }).join('');

  function renderBar() {
    if (slots.status) slots.status.textContent = state.status || '';
    if (slots.vitals) {
      slots.vitals.textContent = [
        state.life === '' ? '' : `Vite ${state.life}`,
        state.mana ? `Riserva ${state.mana}` : '',
      ].filter(Boolean).join(' · ');
    }
  }

  function renderBoard() {
    const foe = activeOpponent();
    state.views.clear();
    slots.board.innerHTML = `<div class="mt-board">
      ${opponentHeadHtml(foe)}
      ${rowHtml(cardsHtml(foe?.cards, 'opponent', 'board'), 'opponent')}
      <div class="mt-commands">${opponentSwitcherHtml(state.opponents, foe?.id || '')}${state.commands}</div>
      ${rowHtml(cardsHtml(state.own, 'own', 'board'), 'own')}
      ${handHtml(cardsHtml(state.hand, 'own', 'hand'))}
    </div>`;
  }

  function renderMenu() {
    slots.menu.innerHTML = menuHtml(state.menuOpen);
    if (state.menuOpen && state.keyboardFocus) {
      slots.menu.querySelector('[data-menu-close]')?.focus({ preventScroll: true });
    }
  }

  function renderZones() {
    if (!slots.zones) return;
    slots.zones.innerHTML = zonesHtml(state.zones, state.zonesOpen);
    if (state.zonesOpen && state.keyboardFocus) {
      slots.zones.querySelector('[data-zones-close]')?.focus({ preventScroll: true });
    }
  }

  function render(part = 'all') {
    if (part === 'all' || part === 'board') renderBoard();
    if (part === 'all' || part === 'menu') renderMenu();
    if (part === 'all' || part === 'zones') renderZones();
    if (part === 'all' || part === 'bar') renderBar();
  }

  const focusToggle = () => {
    if (state.keyboardFocus) root.querySelector('[data-menu-toggle]')?.focus({ preventScroll: true });
  };

  const onClick = event => {
    const action = event.target.closest(ACTIONS);
    if (action) {
      if (action.matches('[data-arena-exit]')) {
        options.onExit?.();
        return;
      }
      if (action.matches('[data-opponent]')) {
        state.activeOpponentId = action.dataset.opponent;
        render('board');
        if (state.keyboardFocus) {
          slots.board.querySelector('[data-opponent][aria-pressed="true"]')?.focus({ preventScroll: true });
        }
        return;
      }
      if (action.matches('[data-zones]')) {
        state.zonesOpen = true;
        render('zones');
        return;
      }
      if (action.matches('[data-zones-close]')) {
        state.zonesOpen = false;
        render('zones');
        return;
      }
      if (action.matches('[data-menu-toggle]')) {
        state.menuOpen = !state.menuOpen;
        render('menu');
        if (!state.menuOpen) focusToggle();
        return;
      }
      if (action.matches('[data-menu-close]')) {
        state.menuOpen = false;
        render('menu');
        focusToggle();
        return;
      }
      state.menuOpen = false;
      render('menu');
      if (action.matches('[data-menu-exit]')) options.onExit?.();
      else options.onAbandon?.();
      return;
    }

    const card = event.target.closest('[data-card-id]');
    if (!card) return;
    // I comandi dentro la tile non sono un tocco sulla carta.
    if (event.target.closest('button:not([data-card-id]), select, input, textarea')) return;
    const id = card.dataset.cardId;
    if (!id) return;
    if (card.dataset.side === 'own' && card.dataset.zone === 'board') {
      const view = state.views.get(id);
      options.onTogglePermanent?.({ id, tapped: !view?.tapped });
    } else {
      options.onPreview?.({ id });
    }
  };

  const markKeyboard = event => {
    if (event.key === 'Tab') state.keyboardFocus = true;
  };
  // Il focus può stare fuori dal tavolo (i comandi vengono ridisegnati spesso),
  // quindi Escape si ascolta sul documento e vale solo a pannello aperto.
  const onEscape = event => {
    if (event.key !== 'Escape') return;
    if (state.zonesOpen) {
      event.stopPropagation();
      state.zonesOpen = false;
      render('zones');
      return;
    }
    if (!state.menuOpen) return;
    event.stopPropagation();
    state.menuOpen = false;
    render('menu');
    focusToggle();
  };
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', markKeyboard);
  document.addEventListener('keydown', onEscape);
  render('all');

  return {
    // Ritorna true solo quando ha ridisegnato: chi chiama rilega i comandi
    // soltanto se i nodi sono nuovi, altrimenti aggiungerebbe doppi listener.
    update(next = {}) {
      if (state.disposed) return false;
      let changed = false;
      let barChanged = false;
      if (next.own) { state.own = next.own; changed = true; }
      if (next.hand) { state.hand = next.hand; changed = true; }
      if (next.opponents) {
        state.opponents = next.opponents;
        if (!state.opponents.some(foe => foe.id === state.activeOpponentId)) {
          const fallback = state.opponents.find(foe => !foe.eliminated) || state.opponents[0];
          state.activeOpponentId = fallback?.id || null;
        }
        changed = true;
      }
      if (next.commands !== undefined) { state.commands = next.commands; changed = true; }
      if (next.zones !== undefined) { state.zones = next.zones; }
      if (next.status !== undefined) { state.status = next.status; barChanged = true; }
      if (next.mana !== undefined) { state.mana = next.mana; barChanged = true; }
      if (next.life !== undefined) { state.life = next.life; barChanged = true; }
      if (changed) {
        render('board');
        if (barChanged) renderBar();
        // I cimiteri cambiano a ogni rimozione: se il pannello è aperto si
        // aggiorna insieme al campo, senza richiedere un altro tocco.
        if (state.zonesOpen) updateZonesPanel();
        return true;
      }
      if (barChanged) {
        renderBar();
        if (state.zonesOpen) render('zones');
        updateZonesPanel();
      }
      return false;
    },

    destroy() {
      if (state.disposed) return;
      state.disposed = true;
      if (portraitMql && onOrientationChange) portraitMql.removeEventListener('change', onOrientationChange);
      if (onResize) {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
      }
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', markKeyboard);
      document.removeEventListener('keydown', onEscape);
      gateExit?.removeEventListener('click', onGateExit);
      state.views.clear();
      host.innerHTML = '';
      document.documentElement.style.overflow = pageOverflow.html;
      document.body.style.overflow = pageOverflow.body;
      document.body.classList.remove('magic-arena-active');
      exitImmersive();
    },
  };

  function updateZonesPanel() {
    if (!state.zonesOpen || !slots.zones) return;
    const current = slots.zones.querySelector('.mt-zones__panel');
    if (!current) return;
    const scroll = current.scrollTop;
    renderZones();
    const next = slots.zones.querySelector('.mt-zones__panel');
    if (next) next.scrollTop = scroll;
  }
}
