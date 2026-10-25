import { PRESETS, createMatch, changeScore, changeCommanderDamage, loadMatch, saveMatch } from '../services/cardCounter.js';
import { navigateTo } from '../services/appNavigation.js';
import { updateSidebarContext } from '../components/layout/Sidebar.js';
import './cardCounter-lotus.css';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function showCardCounter(container, options = {}) {
    window.__counterCleanup?.();
    updateSidebarContext('cardCounter');
    let storage; try { storage = localStorage; } catch { /* Private browsing. */ }
    const saved = loadMatch(storage);
    let state = saved || createMatch(PRESETS[options.preset] ? options.preset : 'commander');
    let playing = false, gesture = null, suppressClickUntil = 0, coinTimer;
    const modes = new Map(), sources = new Map(), slots = new Map(), presses = new Map();
    const root = document.createElement('section');
    root.className = 'card-counter';
    container.replaceChildren(root);
    const find = selector => root.querySelector(selector);
    const clearFeedback = () => { for (const press of presses.values()) clearTimeout(press.timer); presses.clear(); };
    window.__counterCleanup = () => { clearFeedback(); clearTimeout(coinTimer); };
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
        <dialog id="counter-menu" class="counter-menu" aria-label="Menu partita"><button type="button" data-mode="commander">Danni Comandante</button><button type="button" data-mode="poison">Danni Veleno</button><button type="button" data-new>Nuova Partita</button></dialog>
    </section><p class="counter-sr" data-status role="status" aria-live="polite"></p>`;
    const form = find('form'), menu = find('.counter-menu');
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
    function render() {
        root.dataset.players = state.players.length;
        root.dataset.playing = String(playing);
        find('.counter-intro').hidden = playing;
        find('.counter-board').hidden = !playing;
        find('[data-mode="commander"]').disabled = state.preset !== 'commander';
        find('.counter-players').innerHTML = state.players.map((player, i) => {
            const mode = modes.get(i) || 'life', source = sources.get(i) ?? (i === 0 ? 1 : 0), slot = slots.get(i) || 0;
            const poison = player.counters.find(c => c.name === 'Veleno');
            const value = mode === 'commander' ? player.commanderDamage[source][slot] : mode === 'poison' ? poison?.value || 0 : player.value;
            const label = mode === 'commander' ? `Danni comandante ${slot + 1} di ${state.players[source].name}` : mode === 'poison' ? 'Danni veleno' : PRESETS[state.preset].label;
            return `<article class="counter-player" data-player="${i}" data-mode="${mode}" aria-label="${escape(player.name)}">
                ${mode === 'commander' ? `<div class="counter-damage-source"><select data-source aria-label="Comandante che infligge danni a ${escape(player.name)}">${state.players.map((p,j) => `<option value="${j}" ${j === source ? 'selected' : ''}>${escape(p.name)}</option>`).join('')}</select><button type="button" data-slot aria-label="Cambia comandante o partner">${slot ? 'Partner' : 'Comandante'}</button></div>` : ''}
                <div class="counter-face"><button type="button" class="counter-tap" data-delta="-1" aria-label="Riduci ${escape(label)} di ${escape(player.name)}"><span>−</span><small data-count="-1"></small></button>
                <output class="counter-value" style="--score-digits:${String(value.toLocaleString('it-IT')).length}" data-swipe tabindex="0" aria-label="${escape(player.name)}, ${escape(label)}: ${value}. Scorri in basso per danni comandante, in alto per punti.">${value.toLocaleString('it-IT')}${mode !== 'life' ? `<small>${mode === 'poison' ? 'Veleno · / 10' : 'Comandante · / 21'}</small>` : ''}</output>
                <button type="button" class="counter-tap" data-delta="1" aria-label="Aumenta ${escape(label)} di ${escape(player.name)}"><span>+</span><small data-count="1"></small></button></div>
            </article>`;
        }).join('');
        for (const i of presses.keys()) paintPress(i);
    }
    function persist() { if (!saveMatch(state, storage)) announce('Salvataggio non disponibile. Tieni aperta la pagina.'); }
    function setMode(index, mode) {
        if (mode === 'commander' && state.preset !== 'commander') return;
        clearFeedback(); modes.set(index, mode); render();
        find(`[data-player="${index}"] [data-swipe]`)?.focus({ preventScroll: true });
    }
    form.elements.preset.onchange = () => { form.elements.initial.value = PRESETS[form.elements.preset.value].initial; };
    form.onsubmit = event => {
        event.preventDefault();
        try { state = createMatch(form.elements.preset.value, Number(form.elements.players.value), Number(form.elements.initial.value)); }
        catch (error) { announce(error.message); return; }
        clearFeedback(); modes.clear(); sources.clear(); slots.clear(); playing = true; render(); persist(); find('[data-menu]').focus();
    };
    find('[data-home]').onclick = () => navigateTo(options.returnTo === 'magic' ? 'magic' : 'mtcg', container);
    find('[data-resume]').onclick = () => { playing = true; render(); find('[data-menu]').focus(); };
    find('[data-menu]').onclick = () => { menu.showModal(); find('[data-menu]').setAttribute('aria-expanded', 'true'); };
    find('[data-new]').onclick = () => {
        closeMenu(); clearFeedback(); playing = false; render();
        form.elements.preset.value = state.preset; form.elements.players.value = state.players.length; form.elements.initial.value = state.initial;
        find('[data-resume]').hidden = false; form.elements.preset.focus();
    };
    root.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => {
        const mode = button.dataset.mode;
        const nextMode = state.players.every((_, i) => modes.get(i) === mode) ? 'life' : mode;
        closeMenu(); clearFeedback(); state.players.forEach((_, i) => modes.set(i, nextMode)); render();
    });
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
        if (button.hasAttribute('data-slot')) { slots.set(i, (slots.get(i) || 0) ? 0 : 1); clearFeedback(); render(); return; }
        if (!button.hasAttribute('data-delta')) return;
        const mode = modes.get(i) || 'life', delta = Number(button.dataset.delta);
        if (mode === 'commander') state = changeCommanderDamage(state, i, sources.get(i) ?? (i === 0 ? 1 : 0), slots.get(i) || 0, delta, true);
        else if (mode === 'poison') {
            let poison = state.players[i].counters.find(c => c.name === 'Veleno');
            if (!poison) { state = structuredClone(state); poison = { id: crypto.randomUUID(), name: 'Veleno', value: 0, step: 1 }; state.players[i].counters.push(poison); }
            state = changeScore(state, i, delta, poison.id);
        } else state = changeScore(state, i, delta * PRESETS[state.preset].steps[0]);
        render(); registerPress(i, mode, delta); persist();
        find(`[data-player="${i}"] [data-delta="${delta}"]`)?.focus({ preventScroll: true });
        announce(state.log.at(-1));
    };
    area.onchange = event => { if (!event.target.matches('[data-source]')) return; sources.set(Number(event.target.closest('[data-player]').dataset.player), Number(event.target.value)); clearFeedback(); render(); };
    area.addEventListener('pointerdown', event => {
        const target = event.target.closest('[data-swipe]'); if (!target || !event.isPrimary || event.button !== 0) return;
        gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, index: Number(target.closest('[data-player]').dataset.player) }; target.setPointerCapture(event.pointerId);
    });
    area.addEventListener('pointerup', event => {
        if (!gesture || gesture.id !== event.pointerId) return;
        const g = gesture; gesture = null; const dy = event.clientY - g.y, dx = event.clientX - g.x;
        if (Math.abs(dy) < 45 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
        suppressClickUntil = Date.now() + 400; setMode(g.index, dy > 0 ? 'commander' : 'life');
    });
    area.addEventListener('pointercancel', () => { gesture = null; });
    let wheelTotal = 0, wheelIndex, wheelTime = 0, wheelLock = 0;
    area.addEventListener('wheel', event => {
        const target = event.target.closest('[data-swipe]'); if (!target || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        event.preventDefault(); const now = Date.now(), i = Number(target.closest('[data-player]').dataset.player);
        if (now < wheelLock) return;
        if (wheelIndex !== i || now - wheelTime > 250) wheelTotal = 0;
        wheelIndex = i; wheelTime = now; wheelTotal += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
        if (Math.abs(wheelTotal) >= 55) { setMode(i, wheelTotal > 0 ? 'commander' : 'life'); wheelTotal = 0; wheelLock = now + 350; }
    }, { passive: false });
    area.addEventListener('keydown', event => {
        if (!event.target.matches('[data-swipe]') || !['ArrowDown','ArrowUp'].includes(event.key)) return;
        event.preventDefault(); setMode(Number(event.target.closest('[data-player]').dataset.player), event.key === 'ArrowDown' ? 'commander' : 'life');
    });
    render();
}
