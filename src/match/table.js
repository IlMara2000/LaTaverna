/**
 * Tavolo di gioco: markup, viste e comandi del solo campo.
 *
 * Non conosce le regole e non possiede lo stato: riceve le carte dal chiamante
 * e gli restituisce intenzioni. Un tocco su una carta chiede l'anteprima
 * (`onPreview`); le mosse restano sui pulsanti della carta e della barra.
 *
 * Opzioni: own, hand, opponents, commands, zones, status, mana, phases,
 * priority, priorityMine, actions, stack, pendingChoice, tileExtra, onChoice,
 * onPreview, onExit, onAbandon.
 *
 * `pendingChoice` non è solo un avviso: quando la scelta spetta a chi guarda,
 * il tavolo disegna le opzioni e restituisce l'ordine scelto con `onChoice`.
 * Senza questo pannello una domanda del motore (l'ordine del danno di due
 * bloccanti, CR 509.3) lasciava la partita ferma, perché nessun pulsante
 * poteva rispondere.
 *
 * `phases`, `priority`, `actions`, `stack` e `pendingChoice` arrivano dal view
 * model del motore (engine/view.js): il tavolo li mostra senza calcolare
 * regole, e le mosse che l'interfaccia può offrire sono solo quelle elencate
 * in `actions`. Lo stack si legge come una pila: si risolve l'ultimo arrivato,
 * e il tavolo scrive per primo quello.
 */

import './table.css';
import './arena.css';
import './phases.css';
import { exitImmersive } from './immersive.js';

/* ───────────────────────────── markup ───────────────────────────── */

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[ch]));
const statLine = card => (card.power && card.toughness ? `${card.power}/${card.toughness}` : '');
const counterLabel = card => (card.counters > 0 ? `+${card.counters}` : '');

function tileHtml(card, side, zone = 'board', extra = '') {
  const art = card.image
    ? `<img class="mt-card__art" src="${esc(card.image)}" alt="" loading="lazy" decoding="async" draggable="false">`
    : '<span class="mt-card__art mt-card__art--empty" aria-hidden="true"></span>';
  const pressed = zone === 'board' ? ` aria-pressed="${card.tapped ? 'true' : 'false'}"` : '';
  const label = [card.name, statLine(card)].filter(Boolean).join(' · ');
  const badges = [
    card.commander ? '<span class="mt-card__badge mt-card__badge--commander">CMD</span>' : '',
    card.attacking ? '<span class="mt-card__badge mt-card__badge--attack">ATTACCA</span>' : '',
    card.blocking ? '<span class="mt-card__badge mt-card__badge--block">BLOCCA</span>' : '',
    counterLabel(card) ? `<span class="mt-card__badge mt-card__badge--counter">${esc(counterLabel(card))}</span>` : '',
    card.damage > 0 ? `<span class="mt-card__badge mt-card__badge--damage">−${esc(card.damage)}</span>` : '',
  ].join('');
  const classes = ['mt-card'];
  if (card.tapped) classes.push('is-tapped');
  if (card.attacking) classes.push('is-attacking');
  if (card.blocking) classes.push('is-blocking');
  return `<div class="${classes.join(' ')}" data-card-id="${esc(card.id)}" data-side="${esc(side)}" data-zone="${esc(zone)}"${pressed} aria-label="${esc(label)}">
    ${art}
    ${badges}
    ${extra ? `<div class="mt-card__actions">${extra}</div>` : ''}
  </div>`;
}

/* Il campo si legge su tre corsie: creature, altri permanenti e magie, terre. */
const LANES = [
  { kind: 'creatures', label: 'Creature', match: card => isCreature(card) },
  { kind: 'permanents', label: 'Permanenti e magie', match: card => !isCreature(card) && !isLand(card) },
  { kind: 'lands', label: 'Terre', match: card => isLand(card) },
];

function laneHtml(kind, label, cards, inner) {
  const empty = !cards.length;
  return `<div class="mt-lane mt-lane--${esc(kind)}${empty ? ' is-empty' : ''}">
    <span class="mt-lane__label">${label}</span>
    <div class="mt-lane__cards">${inner}</div>
  </div>`;
}

function fieldHtml(cards, side, paint) {
  const list = cards || [];
  // Campo vuoto: una sola riga, non un riquadro alto quanto una corsia piena.
  // Prima le tre etichette di corsia restavano impilate in mezzo al vuoto e
  // rubavano mezza schermata alla mano.
  if (!list.length) {
    return `<div class="mt-field mt-field--${esc(side)} mt-field--empty"><p class="mt-row__empty">Nessun permanente in campo</p></div>`;
  }
  // Molla elastica: in verticale spinge le tue carte verso il basso (vicino alla
  // mano) e lascia lo spazio libero in mezzo al tavolo. Su un contenitore che
  // scorre il margine automatico vale zero, quindi non nasconde nulla.
  const spring = side === 'own' ? '<div class="mt-field__spring" aria-hidden="true"></div>' : '';
  return `<div class="mt-field mt-field--${esc(side)}">${spring}${LANES.map(lane => {
    const group = list.filter(lane.match);
    return laneHtml(lane.kind, lane.label, group, group.map(card => paint(card, side, 'board')).join(''));
  }).join('')}</div>`;
}

const handHtml = inner => `<div class="mt-hand">${inner || '<p class="mt-row__empty">Nessuna carta in mano</p>'}</div>`;

/* Scelte in sospeso diverse dallo scarto: lo scarto resta sulla mano, dove le
   carte si vedono e si toccano. Per tutto il resto il pannello è generico:
   legge `pendingChoice.options`, e `min`/`max` dicono quante opzioni servono.
   Con `orderBlockers` l'ordine dei tocchi è l'ordine del danno, quindi accanto
   a ogni opzione compare il numero di arrivo. */
function choiceHtml(choice, selection) {
  // Nessuna scelta (o scelta di un altro): la barra resta quella di sempre.
  if (!choice) return '';
  const options = choice.options || [];
  const order = choice.kind === 'orderBlockers';
  const min = Math.max(0, Number(choice.min) || 0);
  const max = Math.max(min, Number(choice.max) || options.length);
  const picked = selection.length;
  const ready = picked >= min && picked <= max;
  const hint = order
    ? 'Tocca i bloccanti nell’ordine in cui devono subire il danno: il primo per primo.'
    : (min === max
      ? `Scegli ${max} ${max === 1 ? 'opzione' : 'opzioni'}.`
      : `Scegli fra ${min} e ${max} opzioni.`);
  return `<section class="mt-choice${ready ? ' is-ready' : ''}" data-choice-panel data-kind="${esc(choice.kind)}" aria-live="polite">
    <p class="mt-choice__title"><span class="mt-choice__kicker">Scelta in sospeso</span>${esc(choice.prompt || 'Scegli.')}</p>
    <p class="mt-choice__hint">${esc(hint)}</p>
    <div class="mt-choice__options">${options.map(option => {
      const at = selection.indexOf(String(option.id));
      return `<button type="button" class="mt-choice__option" data-choice-option="${esc(option.id)}" aria-pressed="${at >= 0}">${at >= 0 ? `<span class="mt-choice__order">${at + 1}</span>` : ''}${esc(option.label || option.id)}</button>`;
    }).join('')}</div>
    <div class="mt-choice__foot">
      <span class="mt-choice__count">${picked} di ${max}</span>
      <button type="button" class="mp-button" data-choice-confirm ${ready ? '' : 'disabled'}>${order ? 'Conferma ordine' : 'Conferma'}</button>
      ${picked ? '<button type="button" class="mp-small" data-choice-clear>Svuota</button>' : ''}
    </div>
  </section>`;
}

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
      <button type="button" class="mt-menu__item" data-zones>Cimiteri e zone</button>
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

const ACTIONS = '[data-menu-toggle],[data-menu-close],[data-menu-exit],[data-menu-abandon],[data-opponent],[data-arena-exit],[data-zones],[data-zones-close],[data-choice-option],[data-choice-confirm],[data-choice-clear]';

/** Lo stesso ordine di `idOf` in magicPlay.js: `instanceId` prima di `uid`. */
const cardId = card => String(card?.instanceId ?? card?.uid ?? card?.id ?? '');
const isCreature = card => /\bcreature\b/i.test(String(card?.typeLine || ''));
const isLand = card => /\bland\b/i.test(String(card?.typeLine || ''));
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
    phases: options.phases || [],
    priority: options.priority || '',
    priorityMine: Boolean(options.priorityMine),
    actions: options.actions || [],
    stack: options.stack || [],
    pendingChoice: options.pendingChoice || null,
    choiceId: '',
    choiceSelection: [],
    tileExtra: options.tileExtra || null,
    life: options.life ?? '',
    lastLife: options.life ?? '',
    boardIds: new Set(),
    handIds: new Set(),
    damageById: new Map(),
    lastFoeLives: new Map(),
    lastPriority: '',
    lastStep: -1,
    lastStack: 0,
    lastChoice: '',
    lastMana: undefined,
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
      <ol class="mt-phases" data-slot="phases" aria-hidden="true"></ol>
      <p class="mt-arena-bar__status" data-slot="status"></p>
      <p class="mt-priority" data-slot="priority" data-mine="false" aria-live="polite"></p>
      <p class="mt-stack" data-slot="stack" aria-live="polite" hidden></p>
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
  </div>`;
  const root = host.firstElementChild;
  const slots = {
    board: root.querySelector('[data-slot="board"]'),
    zones: root.querySelector('[data-slot="zones"]'),
    menu: root.querySelector('[data-slot="menu"]'),
    status: root.querySelector('[data-slot="status"]'),
    vitals: root.querySelector('[data-slot="vitals"]'),
    phases: root.querySelector('[data-slot="phases"]'),
    priority: root.querySelector('[data-slot="priority"]'),
    stack: root.querySelector('[data-slot="stack"]'),
  };

  // Nessun gate di rotazione: il tavolo ha un impaginato anche in verticale,
  // quindi la partita non si blocca più chiedendo di ruotare il dispositivo.

  const activeOpponent = () => state.opponents.find(foe => foe.id === state.activeOpponentId) || state.opponents[0] || null;

  /* La scelta da disegnare: solo se spetta a chi guarda e non è lo scarto,
     che vive già sulla mano e sulla riga dei comandi. */
  const pendingChoiceOf = () => {
    const choice = state.pendingChoice;
    if (!choice || !choice.mine || choice.kind === 'discard') return null;
    return choice;
  };

  // Un lampo breve su un nodo che cambia: la classe si toglie da sola alla fine
  // dell'animazione, così due cambi consecutivi la fanno ripartire.
  const flash = (node, className) => {
    if (!node) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
    node.addEventListener('animationend', () => node.classList.remove(className), { once: true });
  };
  const paintCard = (card, side, zone) => {
    const view = toView(card, side, zone);
    state.views.set(view.id, view);
    // I comandi valgono solo per le carte proprie: sulle carte avversarie un
    // pulsante Mana/Attacca sarebbe una richiesta che il motore rifiuta.
    const extra = side === 'own' && state.tileExtra ? state.tileExtra(card) : '';
    return tileHtml(view, side, zone, extra);
  };
  const cardsHtml = (cards, side, zone) => (cards || []).map(card => paintCard(card, side, zone)).join('');

  /* La striscia dei passi: una tacca per passo, quella corrente più larga.
     Il testo per gli screen reader dice il nome del passo, perché le tacche
     da sole non significano nulla. */
  function renderPhases() {
    if (!slots.phases) return;
    const current = state.phases.find(step => step.active);
    const index = state.phases.findIndex(step => step.active);
    if (state.lastStep !== -1 && index !== state.lastStep) flash(slots.phases, 'is-advancing');
    state.lastStep = index;
    slots.phases.innerHTML = `${state.phases.map(step => `<li class="mt-phases__step${step.active ? ' is-active' : ''}${step.done ? ' is-done' : ''}" title="${step.label}"></li>`).join('')}${current ? `<li class="mt-sr-only">Passo corrente: ${current.label}</li>` : ''}`;
  }

  // Nel tavolo le regole non si calcolano: priorità e mosse legali arrivano dal
  // motore. L'elenco delle mosse resta leggibile come attributo, così un test
  // può verificare che ogni comando mostrato sia una mossa legale.
  function renderPriority() {
    if (slots.priority) {
      const next = state.priority || '';
      const key = `${state.priorityMine ? 'mine' : 'other'}:${next}`;
      if (state.lastPriority && key !== state.lastPriority) {
        flash(slots.priority, state.priorityMine ? 'is-mine-turn' : 'is-handover');
      }
      state.lastPriority = key;
      slots.priority.textContent = next;
      slots.priority.dataset.mine = state.priorityMine ? 'true' : 'false';
    }
    root.dataset.legalActions = state.actions.map(action => action.id).join(' ');
  }

  /* Lo stack è una pila: si risolve per primo l'ultimo arrivato, quindi il
     tavolo scrive per primo quello e non l'ordine di arrivo. Con una scelta
     aperta la barra dice cosa si aspetta, senza mostrare le opzioni di un
     altro giocatore (il view model le nasconde già). */
  function renderStack() {
    root.dataset.stackSize = String((state.stack || []).length);
    root.dataset.pendingChoice = state.pendingChoice ? state.pendingChoice.kind : '';
    if (!slots.stack) return;
    const top = [...(state.stack || [])].reverse().slice(0, 2);
    const parts = [];
    if (top.length) parts.push(top.map(item => item.sourceName).join(' ← '));
    if (state.pendingChoice) parts.push(state.pendingChoice.prompt);
    slots.stack.textContent = parts.join(' · ');
    slots.stack.hidden = parts.length === 0;
    const size = (state.stack || []).length;
    if (size > state.lastStack) flash(slots.stack, 'is-arriving');
    state.lastStack = size;
    const choiceKey = state.pendingChoice ? String(state.pendingChoice.id || state.pendingChoice.prompt) : '';
    if (choiceKey && choiceKey !== state.lastChoice) flash(slots.stack, 'is-choice');
    state.lastChoice = choiceKey;
  }

  function renderBar() {
    if (slots.status) slots.status.textContent = state.status || '';
    renderPhases();
    renderPriority();
    renderStack();
    if (slots.vitals) {
      const mana = state.mana || '';
      if (state.lastMana !== undefined && mana !== state.lastMana) flash(slots.vitals, 'is-mana');
      state.lastMana = mana;
      const lost = state.life !== '' && state.lastLife !== '' && Number(state.life) < Number(state.lastLife);
      slots.vitals.textContent = [
        state.life === '' ? '' : `Vite ${state.life}`,
        state.mana ? `Riserva ${state.mana}` : '',
      ].filter(Boolean).join(' · ');
      if (lost) {
        slots.vitals.classList.remove('is-hit');
        // Riavvia l'animazione anche su due perdite consecutive.
        void slots.vitals.offsetWidth;
        slots.vitals.classList.add('is-hit');
      }
      state.lastLife = state.life;
    }
  }

  /* Corsie appena riempite: l'ingresso è un'animazione breve, una sola volta,
     sfalsata di carta in carta così una mano appena pescata «entra» invece di
     comparire tutta insieme. */
  const markFreshCards = () => {
    const previously = state.boardIds || new Set();
    const nodes = [...slots.board.querySelectorAll('[data-zone="board"]')];
    let fresh = 0;
    nodes.forEach(node => {
      if (!previously.has(node.dataset.cardId)) {
        node.style.setProperty('--mt-enter-i', String(Math.min(fresh, 8)));
        node.classList.add('is-entering');
        fresh += 1;
      }
      const view = state.views.get(node.dataset.cardId);
      const before = state.damageById.get(node.dataset.cardId) || 0;
      if (view && view.damage > before && previously.has(node.dataset.cardId)) {
        node.classList.remove('is-damaged');
        void node.offsetWidth;
        node.classList.add('is-damaged');
      }
    });
    state.boardIds = new Set(nodes.map(node => node.dataset.cardId));
    // Anche la mano: la carta pescata entra con la stessa animazione, mentre
    // quelle già in mano restano ferme.
    const handNodes = [...slots.board.querySelectorAll('.mt-hand [data-card-id]')];
    let freshHand = fresh;
    handNodes.forEach(node => {
      if (state.handIds.has(node.dataset.cardId)) return;
      node.style.setProperty('--mt-enter-i', String(Math.min(freshHand, 8)));
      node.classList.add('is-entering');
      freshHand += 1;
    });
    state.handIds = new Set(handNodes.map(node => node.dataset.cardId));
    state.damageById = new Map([...state.views].map(([id, view]) => [id, view.damage]));
  };

  // Il campo si ridisegna a ogni mossa: senza questo, chi sta scorrendo una
  // corsia o la mano tornerebbe all'inizio a ogni aggiornamento (e il salto si
  // vede come un «frame» sbagliato). Si conserva la posizione e la si rimette
  // subito dopo il nuovo markup.
  function captureBoardScroll() {
    const lanes = new Map();
    const fields = new Map();
    slots.board.querySelectorAll('.mt-field').forEach(field => {
      const side = field.classList.contains('mt-field--own') ? 'own' : 'opponent';
      fields.set(side, field.scrollTop);
      field.querySelectorAll('.mt-lane').forEach(lane => {
        const kind = [...lane.classList].find(name => name.startsWith('mt-lane--'));
        const scroller = lane.querySelector('.mt-lane__cards');
        if (kind && scroller) lanes.set(`${side}:${kind}`, scroller.scrollLeft);
      });
    });
    const hand = slots.board.querySelector('.mt-hand');
    return { lanes, fields, hand: hand ? hand.scrollLeft : 0 };
  }

  function restoreBoardScroll(saved) {
    if (!saved) return;
    slots.board.querySelectorAll('.mt-field').forEach(field => {
      const side = field.classList.contains('mt-field--own') ? 'own' : 'opponent';
      if (saved.fields.has(side)) field.scrollTop = saved.fields.get(side);
      field.querySelectorAll('.mt-lane').forEach(lane => {
        const kind = [...lane.classList].find(name => name.startsWith('mt-lane--'));
        const scroller = lane.querySelector('.mt-lane__cards');
        const x = kind ? saved.lanes.get(`${side}:${kind}`) : undefined;
        if (scroller && x != null) scroller.scrollLeft = x;
      });
    });
    const hand = slots.board.querySelector('.mt-hand');
    if (hand && saved.hand) hand.scrollLeft = saved.hand;
  }

  function renderBoard() {
    const foe = activeOpponent();
    const lives = new Map(state.opponents.map(foe2 => [foe2.id, foe2.life]));
    state.views.clear();
    // La scelta appartiene a una domanda precisa: quando cambia la domanda, la
    // selezione riparte da zero. Le opzioni sparite non restano appese.
    const choice = pendingChoiceOf();
    if (!choice) {
      state.choiceId = '';
      state.choiceSelection = [];
    } else {
      const key = String(choice.id || `${choice.kind}:${choice.prompt}`);
      if (key !== state.choiceId) { state.choiceId = key; state.choiceSelection = []; }
      const valid = new Set((choice.options || []).map(option => String(option.id)));
      state.choiceSelection = state.choiceSelection.filter(id => valid.has(id));
    }
    // Lo stato «campo vuoto» diventa una classe sul tabellone: il CSS non deve
    // dedurlo con :has (fragile, e vince per specificità sulle media query del
    // telefono). Qui la verità è una sola e viene dal dato che disegniamo.
    const boardMods = [
      (state.own || []).length ? '' : 'mt-board--own-empty',
      (foe?.cards || []).length ? '' : 'mt-board--opp-empty'
    ].filter(Boolean).join(' ');
    const html = `<div class="mt-board${boardMods ? ` ${boardMods}` : ''}">
      ${opponentHeadHtml(foe)}
      ${fieldHtml(foe?.cards, 'opponent', paintCard)}
      <div class="mt-commands${choice ? ' is-choice' : ''}">${opponentSwitcherHtml(state.opponents, foe?.id || '')}${choiceHtml(choice, state.choiceSelection)}${state.commands}</div>
      ${fieldHtml(state.own, 'own', paintCard)}
      ${handHtml(cardsHtml(state.hand, 'own', 'hand'))}
    </div>`;
    // Ridisegnare il campo ricrea ogni <img> e ricalcola il layout: se il markup
    // è identico (battito di presenza, notifica uguale) non si tocca il DOM e
    // non si ruba un frame. Il confronto è sul markup già costruito, quindi
    // anche i pulsanti delle abilità restano aggiornati quando cambia la priorità.
    // Il ritorno dice se i nodi sono nuovi: solo allora chi chiama rilega i
    // comandi, altrimenti aggiungerebbe doppi listener.
    let rebuilt = false;
    if (html !== state.lastBoardHtml) {
      rebuilt = true;
      const scroll = captureBoardScroll();
      slots.board.innerHTML = html;
      restoreBoardScroll(scroll);
      markFreshCards();
      state.lastBoardHtml = html;
    }
    // Il colpo sull'avversario attivo si vede sulla sua testata.
    state.opponents.forEach(foe2 => {
      const before = state.lastFoeLives.get(foe2.id);
      if (before === undefined || Number(foe2.life) >= Number(before)) return;
      const head = slots.board.querySelector(`[data-opponent="${foe2.id}"]`)?.closest('.mt-opponent-head')
        || (foe2.id === foe?.id ? slots.board.querySelector('.mt-opponent-head') : null);
      if (head) {
        head.classList.remove('is-hit');
        void head.offsetWidth;
        head.classList.add('is-hit');
      }
    });
    state.lastFoeLives = lives;
    return rebuilt;
  }

  /* Selezione dipinta sul posto: niente ridisegno del campo a ogni tocco, così
     la carta che si sta leggendo non si muove e il focus resta sul pulsante. */
  function paintChoice() {
    const choice = pendingChoiceOf();
    const panel = slots.board.querySelector('[data-choice-panel]');
    if (!choice || !panel) return;
    const min = Math.max(0, Number(choice.min) || 0);
    const max = Math.max(min, Number(choice.max) || (choice.options || []).length);
    panel.querySelectorAll('[data-choice-option]').forEach(button => {
      const at = state.choiceSelection.indexOf(String(button.dataset.choiceOption));
      button.setAttribute('aria-pressed', at >= 0 ? 'true' : 'false');
      let badge = button.querySelector('.mt-choice__order');
      if (at >= 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'mt-choice__order';
          button.prepend(badge);
        }
        badge.textContent = String(at + 1);
      } else if (badge) {
        badge.remove();
      }
    });
    const count = panel.querySelector('.mt-choice__count');
    if (count) count.textContent = `${state.choiceSelection.length} di ${max}`;
    const ready = state.choiceSelection.length >= min && state.choiceSelection.length <= max;
    const confirm = panel.querySelector('[data-choice-confirm]');
    if (confirm) confirm.disabled = !ready;
    panel.classList.toggle('is-ready', ready);
    if (state.choiceSelection.length && !panel.querySelector('[data-choice-clear]')) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'mp-small';
      clear.dataset.choiceClear = '';
      clear.textContent = 'Svuota';
      panel.querySelector('.mt-choice__foot')?.append(clear);
    } else if (!state.choiceSelection.length) {
      panel.querySelector('[data-choice-clear]')?.remove();
    }
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
      if (action.matches('[data-choice-option]')) {
        const choice = pendingChoiceOf();
        if (!choice) return;
        const id = String(action.dataset.choiceOption);
        const at = state.choiceSelection.indexOf(id);
        if (at >= 0) state.choiceSelection.splice(at, 1);
        else {
          const max = Math.max(1, Number(choice.max) || (choice.options || []).length);
          if (state.choiceSelection.length >= max) return;
          state.choiceSelection.push(id);
        }
        paintChoice();
        return;
      }
      if (action.matches('[data-choice-clear]')) {
        state.choiceSelection = [];
        paintChoice();
        return;
      }
      if (action.matches('[data-choice-confirm]')) {
        const choice = pendingChoiceOf();
        if (!choice) return;
        const min = Math.max(0, Number(choice.min) || 0);
        const max = Math.max(min, Number(choice.max) || (choice.options || []).length);
        if (state.choiceSelection.length < min || state.choiceSelection.length > max) return;
        action.disabled = true;
        options.onChoice?.([...state.choiceSelection]);
        return;
      }
      if (action.matches('[data-arena-exit]')) {
        options.onExit?.();
        return;
      }
      if (action.matches('[data-opponent]')) {
        state.activeOpponentId = action.dataset.opponent;
        render('board');
        // Cambio di avversario: il campo entra invece di sostituirsi di scatto.
        flash(slots.board.querySelector('.mt-field--opponent'), 'is-swapping');
        flash(slots.board.querySelector('.mt-opponent-head'), 'is-swapping');
        if (state.keyboardFocus) {
          slots.board.querySelector('[data-opponent][aria-pressed="true"]')?.focus({ preventScroll: true });
        }
        return;
      }
      if (action.matches('[data-zones]')) {
        // Il pannello si apre dal menu: il menu si chiude, altrimenti resta
        // sopra i cimiteri appena aperti.
        state.menuOpen = false;
        state.zonesOpen = true;
        render('menu');
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
    // Un tocco sulla carta apre sempre l'anteprima: tappare il mana resta sul
    // pulsante «Mana» della carta, così non si confonde lettura e mossa.
    options.onPreview?.({ id });
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
  // Niente pressione prolungata: su iOS apre il menu di sistema (copia, «Apri
  // immagine»…) e il tocco sulla carta non arriva mai al tavolo. L'anteprima
  // si apre con un tocco singolo, che è anche il gesto più naturale.
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
      if (next.phases !== undefined) { state.phases = next.phases; barChanged = true; }
      if (next.priority !== undefined) { state.priority = next.priority; barChanged = true; }
      if (next.priorityMine !== undefined) { state.priorityMine = Boolean(next.priorityMine); barChanged = true; }
      if (next.actions !== undefined) { state.actions = next.actions; barChanged = true; }
      if (next.stack !== undefined) { state.stack = next.stack; barChanged = true; }
      // La scelta vive dentro la barra comandi, quindi va ridisegnato il campo:
      // senza questo il pannello comparirebbe solo alla mossa successiva.
      if (next.pendingChoice !== undefined) { state.pendingChoice = next.pendingChoice; changed = true; barChanged = true; }
      if (changed) {
        const rebuilt = renderBoard();
        if (barChanged) renderBar();
        // I cimiteri cambiano a ogni rimozione: se il pannello è aperto si
        // aggiorna insieme al campo, senza richiedere un altro tocco.
        if (state.zonesOpen) updateZonesPanel();
        return rebuilt;
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
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', markKeyboard);
      document.removeEventListener('keydown', onEscape);
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
