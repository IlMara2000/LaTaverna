/**
 * Tavolo di gioco: markup, viste e comandi del solo campo.
 *
 * Non conosce le regole e non possiede lo stato: riceve le carte dal chiamante
 * e gli restituisce intenzioni. `onTogglePermanent` è una richiesta, non una
 * scrittura: la carta cambia dopo che il motore ha confermato.
 *
 * Opzioni: own, hand, opponents, commands, tileExtra, onTogglePermanent,
 * onPreview, onExit, onAbandon.
 */

import './table.css';
import './rotate-gate.css';
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
    card.commander ? '<span class="mt-card__badge mt-card__badge--commander">Comandante</span>' : '',
    counterLabel(card) ? `<span class="mt-card__badge mt-card__badge--counter">${esc(counterLabel(card))}</span>` : '',
    card.damage > 0 ? `<span class="mt-card__badge mt-card__badge--damage">${esc(card.damage)}</span>` : '',
  ].join('');
  const stat = statLine(card);
  return `<div class="mt-card${card.tapped ? ' is-tapped' : ''}" data-card-id="${esc(card.id)}" data-side="${esc(side)}" data-zone="${esc(zone)}"${pressed}>
    ${art}
    <span class="mt-card__name">${esc(card.name)}</span>
    ${stat ? `<span class="mt-card__stat">${esc(stat)}</span>` : ''}
    ${badges}${extra}
  </div>`;
}

function rowHtml(inner, side) {
  const empty = side === 'opponent' ? 'Nessun permanente avversario' : 'Il tuo campo è vuoto';
  return `<div class="mt-row mt-row--${esc(side)}">${inner || `<p class="mt-row__empty">${empty}</p>`}</div>`;
}

const handHtml = inner => `<div class="mt-hand">${inner || '<p class="mt-row__empty">Nessuna carta in mano</p>'}</div>`;

function opponentHeadHtml(foe) {
  if (!foe) return '<div class="mt-opponent-head"><span>In attesa di un avversario</span></div>';
  return `<div class="mt-opponent-head${foe.eliminated ? ' is-out' : ''}">
    <span>${esc(foe.name)}</span>
    <span class="mt-opponent-head__life">${esc(foe.life)} ♥</span>
    <span class="mt-opponent-head__count">${foe.cards.length} sul campo</span>
  </div>`;
}

function opponentSwitcherHtml(opponents, activeId) {
  if (!opponents || opponents.length < 2) return '';
  return `<div class="mt-opponents" role="group" aria-label="Avversari">${opponents.map(foe => `
    <button type="button" class="mt-opponents__chip" data-opponent="${esc(foe.id)}" aria-pressed="${foe.id === activeId}">
      <span class="mt-opponents__name">${esc(foe.name)}</span>
      <span class="mt-opponents__stat">${esc(foe.life)} ♥ · ${foe.cards.length} sul campo</span>
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

/* ───────────────────────────── viste ────────────────────────────── */

const ACTIONS = '[data-menu-toggle],[data-menu-close],[data-menu-exit],[data-menu-abandon],[data-opponent]';

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
  return String(base + plusOne + (Number(boost) || 0));
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
    tileExtra: options.tileExtra || null,
    menuOpen: false,
    keyboardFocus: false,
    views: new Map(),
    disposed: false,
  };

  host.innerHTML = '<div class="mt-table"><div class="mt-stage"><div data-slot="board"></div><div data-slot="menu"></div></div></div><div class="rotate-gate" data-rotate-gate role="status" aria-live="polite"><div class="rotate-gate__icon" aria-hidden="true"></div><p class="rotate-gate__text">La partita si gioca in orizzontale.</p></div>';
  const root = host.firstElementChild;
  const stage = root.querySelector('.mt-stage');
  const slots = {
    board: root.querySelector('[data-slot="board"]'),
    menu: root.querySelector('[data-slot="menu"]'),
    rotateGate: host.querySelector('[data-rotate-gate]'),
  };

  // Gate di rotazione: osserva il viewport e mostra il gate in verticale.
  // Il solo evento 'change' di matchMedia non scatta in alcuni browser/ambienti
  // (es. ridimensionamento programmatico o schermo che non emette orientationchange),
  // quindi si rivaluta anche su resize e orientationchange.
  const PORTRAIT_QUERY = '(orientation: portrait)';
  let portraitMql = null;
  let onOrientationChange = null;
  let onResize = null;
  const applyRotation = (portrait) => {
    const needs = Boolean(portrait);
    if (slots.rotateGate) slots.rotateGate.classList.toggle('is-visible', needs);
    if (stage) stage.inert = needs;
  };
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

  const activeOpponent = () =>
    state.opponents.find(foe => foe.id === state.activeOpponentId) || state.opponents[0] || null;

  const cardsHtml = (cards, side, zone) => (cards || []).map(card => {
    const view = toView(card, side, zone);
    state.views.set(view.id, view);
    return tileHtml(view, side, zone, state.tileExtra ? state.tileExtra(card) : '');
  }).join('');

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

  function render(part = 'all') {
    if (part === 'all' || part === 'board') renderBoard();
    if (part === 'all' || part === 'menu') renderMenu();
  }

  const focusToggle = () => {
    if (state.keyboardFocus) root.querySelector('[data-menu-toggle]')?.focus({ preventScroll: true });
  };

  const onClick = event => {
    const action = event.target.closest(ACTIONS);
    if (action) {
      if (action.matches('[data-opponent]')) {
        state.activeOpponentId = action.dataset.opponent;
        render('board');
        if (state.keyboardFocus) {
          slots.board.querySelector('[data-opponent][aria-pressed="true"]')?.focus({ preventScroll: true });
        }
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
    if (event.target.closest('button, select, input, textarea')) return;
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
  // quindi Escape si ascolta sul documento e vale solo a menu aperto.
  const onEscape = event => {
    if (event.key !== 'Escape' || !state.menuOpen) return;
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
      if (changed) { render('board'); return true; }
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
      state.views.clear();
      host.innerHTML = '';
      exitImmersive();
    },
  };
}
