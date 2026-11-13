import { PRESETS, createMatch, changeScore, changeCommanderDamage, addExtraCounter, changeExtraCounter, removeExtraCounter, loadMatch, saveMatch } from '../services/cardCounter.js';
import { navigateTo } from '../services/appNavigation.js';
import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { getCachedAppPreference } from '../services/appPreferences.js';
import './cardCounter-lotus.css';
const COMMANDER_LIMIT = 21, POISON_LIMIT = 10, CORNER_HOLD_MS = 450;
const COMMANDER_ICON = '<svg viewBox="0 0 24 24" focusable="false"><path d="M2.8 18h18.4l1-9.2-5.8 3.7L12 5.4 7.6 12.5 1.8 8.8l1 9.2Z"/><path d="M4.6 19.7h14.8a1.1 1.1 0 0 1 0 2.2H4.6a1.1 1.1 0 0 1 0-2.2Z"/></svg>';
const POISON_ICON = '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 2.4c.4 0 .8.2 1 .6 2 3.3 5.5 7.9 5.5 11.1a6.5 6.5 0 1 1-13 0c0-3.2 3.5-7.8 5.5-11.1.2-.4.6-.6 1-.6Z"/></svg>';
// Ciak letale sintetizzato (nessun file audio), sul modello di scippoAudio.js:
// il contesto nasce solo dentro un gesto dell'utente e resta chiuso con la dashboard.
let audioContext = null;
function playLethalCue() {
    try {
        if (!getCachedAppPreference('music.enabled', true)) return;
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioContext) audioContext = new AudioContextClass();
        if (audioContext.state === 'suspended') void audioContext.resume();
        const start = audioContext.currentTime;
        [[196, 0], [147, 0.14]].forEach(([frequency, offset]) => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(frequency, start + offset);
            gain.gain.setValueAtTime(0.0001, start + offset);
            gain.gain.exponentialRampToValueAtTime(0.06, start + offset + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
            oscillator.connect(gain).connect(audioContext.destination);
            oscillator.start(start + offset);
            oscillator.stop(start + offset + 0.22);
        });
    } catch { /* un suono non deve mai rompere il conteggio */ }
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function showCardCounter(container, options = {}) {
    window.__counterCleanup?.();
    updateSidebarContext('cardCounter');
    let storage; try { storage = localStorage; } catch { /* Private browsing. */ }
    const saved = loadMatch(storage);
    let state = saved || createMatch(PRESETS[options.preset] ? options.preset : 'commander');
    let playing = false, suppressClickUntil = 0, coinTimer;
    const presses = new Map(), lethalCards = new Map();
    let hold = null, cornerHold = null;
    const root = document.createElement('section');
    root.className = 'card-counter';
    container.replaceChildren(root);
    const find = selector => root.querySelector(selector);
    const clearFeedback = () => { for (const press of presses.values()) clearTimeout(press.timer); presses.clear(); };
    window.__counterCleanup = () => {
        clearFeedback(); clearTimeout(coinTimer); endCornerHold();
        if (hold) { clearInterval(hold.timer); hold = null; }
        window.removeEventListener('pointerup', endHold); window.removeEventListener('pointercancel', endHold);
        window.removeEventListener('pointerup', endCornerHold); window.removeEventListener('pointercancel', endCornerHold);
        if (audioContext) { try { void audioContext.close(); } catch { /* già chiuso */ } audioContext = null; }
    };
    root.innerHTML = `<section class="counter-intro">
        <button type="button" data-home class="counter-back" aria-label="Torna a MTCG">←</button>
        <h1>Segnapunti</h1>
        <form class="counter-setup">
            <label>Gioco<select name="preset">${Object.entries(PRESETS).map(([id, p]) => `<option value="${id}" ${id === (options.preset || state.preset) ? 'selected' : ''}>${p.name}</option>`).join('')}</select></label>
            <label>Giocatori<select name="players">${[2,3,4,5,6].map(n => `<option ${n === state.players.length ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <label>Punti partita<input name="initial" type="number" min="0" max="999999" step="1" required value="${state.initial}"></label>
            <button type="submit" class="counter-start">Inizia partita</button>
        </form>
        <button type="button" data-resume ${saved ? '' : 'hidden'}>Riprendi partita salvata</button>
        <button type="button" data-coin class="counter-coin" aria-label="Lancia la moneta: testa o croce?"><span class="counter-coin-object" aria-hidden="true"><span>Testa</span><span>Croce</span></span><span>Testa o croce?</span></button>
        <p data-coin-result role="status" aria-live="polite"></p>
    </section>
    <section class="counter-board" hidden aria-label="Segnapunti della partita">
        <div class="counter-players"></div>
        <button type="button" class="counter-menu-trigger" data-menu aria-label="Menu partita" aria-expanded="false" aria-controls="counter-menu">☰</button>
        <dialog id="counter-menu" class="counter-menu" aria-label="Menu partita"><button type="button" data-other>Altri Danni</button><button type="button" data-summary>Riepilogo partita</button><button type="button" data-reset-all>Azzera contatori di tutti</button><button type="button" data-new>Torna indietro</button></dialog>
        <dialog id="counter-summary" class="counter-menu counter-summary" aria-label="Riepilogo della partita">
            <header class="counter-extra-head"><strong>Riepilogo partita</strong><button type="button" class="counter-extra-close" data-summary-close aria-label="Chiudi">✕</button></header>
            <ul class="counter-summary-list" data-summary-list></ul>
        </dialog>
        <dialog id="counter-reset-confirm" class="counter-menu counter-reset-confirm" aria-labelledby="counter-reset-title">
            <header class="counter-extra-head"><strong id="counter-reset-title">Azzerare i contatori?</strong><button type="button" class="counter-extra-close" data-reset-cancel aria-label="Annulla">✕</button></header>
            <p class="counter-reset-text" data-reset-text></p>
            <div class="counter-reset-actions"><button type="button" data-reset-cancel>Annulla</button><button type="button" data-reset-apply>Azzera</button></div>
        </dialog>
        <dialog id="counter-extra" class="counter-menu counter-extra" aria-label="Altri Danni">
            <header class="counter-extra-head"><strong>Altri Danni</strong><button type="button" class="counter-extra-close" data-extra-close aria-label="Chiudi">✕</button></header>
            <label class="counter-extra-player">Giocatore<select data-extra-player></select></label>
            <div class="counter-extra-list" data-extra-list></div>
            <button type="button" class="counter-extra-add" data-extra-add aria-label="Configura un nuovo contatore">+</button>
            <form class="counter-extra-form" data-extra-form hidden>
                <label>Nome del contatore<input name="extra-name" maxlength="30" autocomplete="off" required></label>
                <label>Limite del danno<input name="extra-limit" type="number" min="1" max="999" step="1" value="10" required></label>
                <div class="counter-extra-form-actions"><button type="submit">Crea</button><button type="button" data-extra-cancel>Annulla</button></div>
            </form>
        </dialog>
    </section><p class="counter-sr" data-status role="status" aria-live="polite"></p>`;
    const form = find('form'), menu = find('.counter-menu');
    const summaryMenu = find('.counter-summary'), summaryList = find('[data-summary-list]');
    const resetDialog = find('.counter-reset-confirm'), resetText = find('[data-reset-text]');
    let summaryShown = false, resetPending = null;
    if (options.preset && PRESETS[options.preset]) form.elements.initial.value = PRESETS[options.preset].initial;
    const announce = text => { find('[data-status]').textContent = text; };
    const closeMenu = () => { menu.close(); find('[data-menu]').setAttribute('aria-expanded', 'false'); };
    menu.addEventListener('close', () => { find('[data-menu]').setAttribute('aria-expanded', 'false'); find('[data-menu]').focus(); });
    menu.addEventListener('click', event => { if (event.target === menu) { const r = menu.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeMenu(); } });
    function paintPress(index) {
        const press = presses.get(index);
        root.querySelectorAll(`[data-player="${index}"] [data-count]`).forEach(el => {
            el.textContent = press && Number(el.dataset.count) === press.sign ? `${press.count}` : '';
        });
    }
    function registerPress(index, key, delta) {
        const previous = presses.get(index), now = Date.now();
        const same = previous && previous.key === key && previous.sign === Math.sign(delta) && now - previous.time < 1800;
        clearTimeout(previous?.timer);
        const press = { key, sign: Math.sign(delta), count: same ? previous.count + 1 : 1, time: now };
        presses.set(index, press); paintPress(index);
        press.timer = setTimeout(() => { presses.delete(index); paintPress(index); }, 1800);
    }
    const counterLabel = kind => kind === 'commander' ? 'Danni da comandante' : 'Danni da veleno';
    const counterLimit = kind => kind === 'commander' ? COMMANDER_LIMIT : POISON_LIMIT;
    // Un solo comandante per card: il primo avversario nell'ordine di tavolo.
    const commanderSource = index => index === 0 ? 1 : 0;
    function counterValue(index, kind) {
        const player = state.players[index];
        if (kind === 'commander') return Math.min(player.commanderDamage?.[commanderSource(index)]?.[0] || 0, COMMANDER_LIMIT);
        return Math.min(player.counters.find(c => c.name === 'Veleno')?.value || 0, POISON_LIMIT);
    }
    function counterAria(index, kind) {
        return `${counterLabel(kind)} di ${state.players[index].name}: ${counterValue(index, kind)} su ${counterLimit(kind)}. Tocca per aumentare, tieni premuto per diminuire.`;
    }
    function cornerMarkup(index, kind) {
        const value = counterValue(index, kind);
        return `<button type="button" class="counter-corner counter-corner-${kind}${value > 0 ? ' is-open' : ''}" data-counter="${kind}" aria-label="${escape(counterAria(index, kind))}">
            <span class="counter-drawer" aria-hidden="true"><span data-drawer-value>${value}</span></span>
            <span class="counter-corner-icon" aria-hidden="true">${kind === 'commander' ? COMMANDER_ICON : POISON_ICON}</span>
        </button>`;
    }
    function paintValue(index) {
        const el = find(`[data-player="${index}"] [data-value]`);
        if (!el) return;
        const value = state.players[index].value;
        el.style.setProperty('--score-digits', String(value.toLocaleString('it-IT')).length);
        el.textContent = value.toLocaleString('it-IT');
        el.setAttribute('aria-label', `${state.players[index].name}, ${PRESETS[state.preset].label}: ${value}`);
    }
    // Card letale: 21 danni da comandante oppure 10 veleno.
    const threatOf = index => state.preset !== 'commander' ? ''
        : counterValue(index, 'commander') >= COMMANDER_LIMIT ? 'commander'
        : counterValue(index, 'poison') >= POISON_LIMIT ? 'poison' : '';
    function renderSummary() {
        const rows = state.players.map((player, i) => ({ player, i, threat: threatOf(i) })).filter(row => row.threat);
        summaryList.innerHTML = rows.length
            ? rows.map(({ player, i, threat }) => `<li class="counter-summary-row"><span class="counter-summary-who"><strong>${escape(player.name)}</strong><span class="counter-summary-stats">Vita ${player.value} · Danni subiti ${Math.max(0, state.initial - player.value)}</span><span class="counter-summary-counters">Commander ${counterValue(i, 'commander')}/21 · Veleno ${counterValue(i, 'poison')}/10</span></span><span class="counter-summary-reason counter-summary-reason--${threat}">${threat === 'commander' ? '21 danni da comandante' : '10 veleno'}</span></li>`).join('')
            : '<li class="counter-summary-empty">Nessun giocatore eliminato: la partita continua.</li>';
    }
    function openSummary() {
        renderSummary();
        summaryShown = true;
        if (!summaryMenu.open) summaryMenu.showModal();
    }
    function syncThreat(index, silent = false) {
        const card = find(`[data-player="${index}"]`);
        if (!card) return;
        const lethal = threatOf(index);
        const previous = lethalCards.get(index) || '';
        lethalCards.set(index, lethal);
        if (lethal && !previous && !silent) {
            playLethalCue();
            // Riepilogo automatico alla prima eliminazione della partita.
            if (!summaryShown) openSummary();
        }
        if (lethal) card.dataset.lethal = lethal; else delete card.dataset.lethal;
        card.setAttribute('aria-label', `${state.players[index].name}${lethal ? ', danno letale' : ''}`);
    }
    function paintCounter(index, kind) {
        const node = find(`[data-player="${index}"] [data-counter="${kind}"]`);
        if (!node) return;
        const value = counterValue(index, kind);
        node.classList.toggle('is-open', value > 0);
        node.querySelector('[data-drawer-value]').textContent = String(value);
        node.setAttribute('aria-label', counterAria(index, kind));
        syncThreat(index);
    }
    function applyDelta(index, delta) {
        state = changeScore(state, index, delta * PRESETS[state.preset].steps[0]);
        paintValue(index); registerPress(index, 'life', delta); persist(); announce(state.log.at(-1));
    }
    // Le icone d'angolo: pressione normale aggiunge, pressione prolungata toglie.
    function changeCounter(index, kind, delta) {
        if (state.preset !== 'commander') return;
        const value = counterValue(index, kind);
        if (delta > 0 ? value >= counterLimit(kind) : value <= 0) return;
        // Il danno da comandante scala anche il totale vita, come da regole.
        if (kind === 'commander') { state = changeCommanderDamage(state, index, commanderSource(index), 0, delta, true); paintValue(index); }
        else {
            let poison = state.players[index].counters.find(c => c.name === 'Veleno');
            if (!poison) { state = structuredClone(state); poison = { id: crypto.randomUUID(), name: 'Veleno', value: 0, step: 1 }; state.players[index].counters.push(poison); }
            state = changeScore(state, index, delta, poison.id);
        }
        paintCounter(index, kind); persist(); announce(state.log.at(-1));
    }
    // Conferma prima di azzerare: un tocco accidentale non deve cancellare nulla.
    const playerCounters = index => ({
        damage: state.players[index].commanderDamage?.[commanderSource(index)]?.[0] || 0,
        poison: state.players[index].counters.find(c => c.name === 'Veleno')?.value || 0
    });
    function openResetConfirm(index) {
        const player = state.players[index], { damage, poison } = playerCounters(index);
        if (!damage && !poison) return;
        resetPending = index;
        resetText.textContent = `${player.name}: danno da comandante ${damage}/21, veleno ${poison}/10. La vita torna a ${player.value + damage}.`;
        resetDialog.showModal();
        find('[data-reset-cancel]').focus();
    }
    function openResetAllConfirm() {
        if (state.preset !== 'commander') return;
        const totali = state.players.map((_, i) => i).filter(i => { const { damage, poison } = playerCounters(i); return damage || poison; });
        if (!totali.length) return;
        resetPending = 'all';
        resetText.textContent = `Tutti i giocatori (${totali.length} su ${state.players.length}): verranno azzerati danno da comandante e veleno, e la vita scalata dal comandante torna a ciascuno.`;
        resetDialog.showModal();
        find('[data-reset-cancel]').focus();
    }
    // Azzera i contatori di un giocatore e restituisce la vita scalata dal comandante.
    function clearPlayerCounters(index) {
        const { damage, poison } = playerCounters(index);
        if (!damage && !poison) return false;
        const poisonId = state.players[index].counters.find(c => c.name === 'Veleno')?.id;
        if (damage) state = changeCommanderDamage(state, index, commanderSource(index), 0, -damage, true);
        if (poison && poisonId) state = changeScore(state, index, -poison, poisonId);
        paintValue(index); paintCounter(index, 'commander'); paintCounter(index, 'poison');
        return true;
    }
    function resetCounters(index) {
        if (state.preset !== 'commander' || !clearPlayerCounters(index)) return;
        persist(); announce(state.log.at(-1));
    }
    function resetAllCounters() {
        if (state.preset !== 'commander') return;
        let cambiati = 0;
        state.players.forEach((_, i) => { if (clearPlayerCounters(i)) cambiati += 1; });
        if (!cambiati) return;
        persist(); announce(`Contatori azzerati per ${cambiati} giocator${cambiati === 1 ? 'e' : 'i'}.`);
    }
    function endHold() {
        if (!hold) return;
        clearInterval(hold.timer);
        if (hold.fired) suppressClickUntil = Date.now() + 350;
        hold = null;
        root.querySelectorAll('[data-press]').forEach(card => delete card.dataset.press);
    }
    function endCornerHold() {
        if (!cornerHold) return;
        clearTimeout(cornerHold.timer);
        if (cornerHold.fired) suppressClickUntil = Date.now() + 350;
        cornerHold = null;
    }
    function beginCornerHold(index, kind) {
        endCornerHold();
        const press = { index, kind, fired: false, timer: 0 };
        // Pressione prolungata: toglie un punto, una volta sola.
        press.timer = setTimeout(() => { press.fired = true; changeCounter(index, kind, -1); }, CORNER_HOLD_MS);
        cornerHold = press;
    }
    function beginHold(index, delta) {
        endHold();
        const card = find(`[data-player="${index}"]`);
        if (card) card.dataset.press = delta > 0 ? 'plus' : 'minus';
        const press = { index, delta, fired: false, timer: 0 };
        press.timer = setInterval(() => { press.fired = true; applyDelta(index, delta); }, 500);
        hold = press;
    }
    function render() {
        root.dataset.players = state.players.length;
        root.dataset.playing = String(playing);
        find('.counter-intro').hidden = playing;
        find('.counter-board').hidden = !playing;
        find('.counter-players').innerHTML = state.players.map((player, i) => {
            const value = player.value, label = PRESETS[state.preset].label;
            const extras = player.extras || [];
            const chips = extras.length ? `<div class="counter-extras" aria-label="Altri danni">${extras.map(c => `<span class="counter-extra-chip"><span>${escape(c.name)}</span><b>${c.value}/${c.limit}</b></span>`).join('')}</div>` : '';
            const corners = state.preset === 'commander' ? `<div class="counter-corners">${cornerMarkup(i, 'commander')}<button type="button" class="counter-reset" data-reset aria-label="Azzera veleno e danno da comandante di ${escape(player.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></button>${cornerMarkup(i, 'poison')}</div>` : '';
            return `<article class="counter-player" data-player="${i}" aria-label="${escape(player.name)}">
                ${chips}
                <div class="counter-face"><button type="button" class="counter-tap" data-delta="-1" aria-label="Riduci ${escape(label)} di ${escape(player.name)}"><small data-count="-1"></small><span>−</span></button>
                <output class="counter-value" style="--score-digits:${String(value.toLocaleString('it-IT')).length}" data-value aria-label="${escape(player.name)}, ${escape(label)}: ${value}">${value.toLocaleString('it-IT')}</output>
                <button type="button" class="counter-tap" data-delta="1" aria-label="Aumenta ${escape(label)} di ${escape(player.name)}"><small data-count="1"></small><span>+</span></button></div>
                ${corners}
            </article>`;
        }).join('');
        state.players.forEach((_, i) => syncThreat(i, true));
        for (const i of presses.keys()) paintPress(i);
    }
    function persist() { if (!saveMatch(state, storage)) announce('Salvataggio non disponibile. Tieni aperta la pagina.'); }
    form.elements.preset.onchange = () => { form.elements.initial.value = PRESETS[form.elements.preset.value].initial; };
    form.onsubmit = event => {
        event.preventDefault();
        try { state = createMatch(form.elements.preset.value, Number(form.elements.players.value), Number(form.elements.initial.value)); }
        catch (error) { announce(error.message); return; }
        clearFeedback(); playing = true; summaryShown = false; if (summaryMenu.open) summaryMenu.close(); render(); persist(); find('[data-menu]').focus();
    };
    find('[data-home]').onclick = () => navigateTo(options.returnTo === 'magic' ? 'magic' : 'mtcg', container);
    find('[data-resume]').onclick = () => { playing = true; summaryShown = false; render(); find('[data-menu]').focus(); };
    find('[data-menu]').onclick = () => { menu.showModal(); find('[data-menu]').setAttribute('aria-expanded', 'true'); };
    find('[data-new]').onclick = () => { closeMenu(); endHold(); navigateTo(options.returnTo === 'magic' ? 'magic' : 'mtcg', container); };
    // --- Altri Danni: contatori liberi con nome, limite e valore 0..limite ---
    const extraMenu = find('.counter-extra'), extraList = find('[data-extra-list]'), extraForm = find('[data-extra-form]'), extraPlayerSelect = find('[data-extra-player]');
    let extraPlayer = 0;
    function renderExtraPlayers() {
        extraPlayer = Math.max(0, Math.min(extraPlayer, state.players.length - 1));
        extraPlayerSelect.innerHTML = state.players.map((p, i) => `<option value="${i}">${escape(p.name)}</option>`).join('');
        extraPlayerSelect.value = String(extraPlayer);
    }
    function renderExtraList() {
        const extras = state.players[extraPlayer]?.extras || [];
        extraList.innerHTML = extras.length ? extras.map(c => `<div class="counter-extra-row" data-extra="${escape(c.id)}">
            <span class="counter-extra-name"><span>${escape(c.name)}</span><b>${c.value} / ${c.limit}</b></span>
            <div class="counter-extra-buttons">
                <button type="button" data-extra-step="-1" ${c.value <= 0 ? 'disabled' : ''} aria-label="Riduci ${escape(c.name)}">−1</button>
                <button type="button" data-extra-remove aria-label="Elimina ${escape(c.name)}">✕</button>
                <button type="button" data-extra-step="1" ${c.value >= c.limit ? 'disabled' : ''} aria-label="Aumenta ${escape(c.name)}">+1</button>
            </div></div>`).join('') : '<p class="counter-extra-empty">Nessun altro danno per questo giocatore.</p>';
    }
    function openExtras() {
        closeMenu(); endHold(); clearFeedback();
        extraPlayer = state.active ?? 0;
        renderExtraPlayers(); renderExtraList();
        extraForm.hidden = true;
        extraMenu.showModal();
        extraPlayerSelect.focus();
    }
    find('[data-other]').onclick = openExtras;
    find('[data-summary]').onclick = () => { closeMenu(); openSummary(); };
    find('[data-reset-all]').onclick = () => { closeMenu(); openResetAllConfirm(); };
    find('[data-summary-close]').onclick = () => summaryMenu.close();
    root.querySelectorAll('[data-reset-cancel]').forEach(button => { button.onclick = () => resetDialog.close(); });
    find('[data-reset-apply]').onclick = () => {
        const pending = resetPending;
        resetDialog.close();
        if (pending === 'all') resetAllCounters();
        else if (pending !== null) resetCounters(pending);
    };
    resetDialog.addEventListener('close', () => {
        const pending = resetPending;
        resetPending = null;
        if (pending === 'all') find('[data-menu]').focus({ preventScroll: true });
        else if (pending !== null) find(`[data-player="${pending}"] [data-reset]`)?.focus({ preventScroll: true });
    });
    summaryMenu.addEventListener('close', () => find('[data-menu]').focus());
    summaryMenu.addEventListener('click', event => {
        if (event.target !== summaryMenu) return;
        const r = summaryMenu.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) summaryMenu.close();
    });
    find('[data-extra-close]').onclick = () => extraMenu.close();
    extraMenu.addEventListener('close', () => { extraForm.hidden = true; find('[data-menu]').focus(); });
    extraMenu.addEventListener('click', event => {
        if (event.target !== extraMenu) return;
        const r = extraMenu.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) extraMenu.close();
    });
    extraPlayerSelect.onchange = () => { extraPlayer = Number(extraPlayerSelect.value); extraForm.hidden = true; renderExtraList(); };
    extraList.addEventListener('click', event => {
        const row = event.target.closest('[data-extra]'); if (!row) return;
        const id = row.dataset.extra;
        try {
            if (event.target.closest('[data-extra-remove]')) {
                state = removeExtraCounter(state, extraPlayer, id);
                announce(state.log.at(-1));
            } else {
                const step = event.target.closest('[data-extra-step]');
                if (!step || step.disabled) return;
                state = changeExtraCounter(state, extraPlayer, id, Number(step.dataset.extraStep));
                announce(state.log.at(-1));
            }
        } catch (error) { announce(error.message); return; }
        persist(); render(); renderExtraList();
    });
    find('[data-extra-add]').onclick = () => {
        extraForm.hidden = false; extraForm.reset(); find('[data-extra-form] [name="extra-name"]').focus();
    };
    find('[data-extra-cancel]').onclick = () => { extraForm.hidden = true; find('[data-extra-add]').focus(); };
    extraForm.onsubmit = event => {
        event.preventDefault();
        try {
            state = addExtraCounter(state, extraPlayer, event.target.elements['extra-name'].value, Number(event.target.elements['extra-limit'].value));
        } catch (error) { announce(error.message); return; }
        persist(); render(); renderExtraList();
        extraForm.hidden = true;
        announce(state.log.at(-1));
        find('[data-extra-add]').focus();
    };
    find('[data-coin]').onclick = () => {
        const button = find('[data-coin]'); if (button.disabled) return;
        const face = crypto.getRandomValues(new Uint32Array(1))[0] % 2;
        button.disabled = true; button.dataset.face = String(face); button.classList.add('is-tossing'); find('[data-coin-result]').textContent = 'La moneta gira…';
        coinTimer = setTimeout(() => { button.disabled = false; button.classList.remove('is-tossing'); find('[data-coin-result]').textContent = face ? 'Croce' : 'Testa'; }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700);
    };
    const area = find('.counter-players');
    area.onclick = event => {
        const button = event.target.closest('button'); if (!button || button.disabled || Date.now() < suppressClickUntil) return;
        const i = Number(button.closest('[data-player]').dataset.player);
        if (button.hasAttribute('data-reset')) { openResetConfirm(i); return; }
        if (button.hasAttribute('data-counter')) { changeCounter(i, button.dataset.counter, 1); return; }
        if (!button.hasAttribute('data-delta')) return;
        const delta = Number(button.dataset.delta);
        applyDelta(i, delta);
        find(`[data-player="${i}"] [data-delta="${delta}"]`)?.focus({ preventScroll: true });
    };
    area.addEventListener('pointerdown', event => {
        const counter = event.target.closest('[data-counter]');
        if (counter) {
            if (!event.isPrimary || event.button !== 0) return;
            beginCornerHold(Number(counter.closest('[data-player]').dataset.player), counter.dataset.counter);
            return;
        }
        const button = event.target.closest('[data-delta]');
        if (!button || !event.isPrimary || event.button !== 0) return;
        beginHold(Number(button.closest('[data-player]').dataset.player), Number(button.dataset.delta));
    });
    window.addEventListener('pointerup', endHold);
    window.addEventListener('pointercancel', endHold);
    window.addEventListener('pointerup', endCornerHold);
    window.addEventListener('pointercancel', endCornerHold);
    area.addEventListener('contextmenu', event => { if (event.target.closest('[data-delta], [data-counter]')) event.preventDefault(); });
    area.addEventListener('keydown', event => {
        const counter = event.target.closest('[data-counter]');
        if (!counter || !['Backspace','Delete','ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        changeCounter(Number(counter.closest('[data-player]').dataset.player), counter.dataset.counter, -1);
    });
    render();
}
