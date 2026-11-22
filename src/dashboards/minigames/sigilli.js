import { getUnlockedLevel, renderLevelLadder, unlockNextLevel } from '../../services/levels.js';
import { recordMinigameResult } from '../../services/minigameRecords.js';
import './sigilli.css';

const SAMPLE_COUNT = 64;
const TOLERANCE = 0.30;      // distanza media (unità di riquadro) che vale 0%
const ROTATION_STEP = 5;     // passo della ricerca sull'inclinazione
const HEARTS = 3;
const STORAGE_KEY = 'taverna_sigilli_v1';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ rune */

function arcPoints() {
    const points = [];
    const center = { x: 0.5, y: 0.72 };
    const radius = 0.42;
    for (let i = 0; i <= 32; i += 1) {
        const angle = Math.PI + (i / 32) * Math.PI;
        points.push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
    }
    return points;
}

// Ogni runa batte quella indicata: Fulmine > Anello > Arco > Fulmine.
const RUNES = [
    {
        id: 'fulmine', name: 'Fulmine', glyph: 'ᛉ', beats: 'anello',
        points: [{ x: 0.18, y: 0.12 }, { x: 0.60, y: 0.38 }, { x: 0.36, y: 0.50 }, { x: 0.80, y: 0.88 }]
    },
    {
        id: 'anello', name: 'Anello', glyph: 'ᛟ', beats: 'arco',
        points: [{ x: 0.50, y: 0.12 }, { x: 0.82, y: 0.50 }, { x: 0.50, y: 0.88 }, { x: 0.18, y: 0.50 }, { x: 0.50, y: 0.12 }]
    },
    {
        id: 'arco', name: 'Arco', glyph: 'ᚨ', beats: 'fulmine',
        points: arcPoints()
    }
];

const counterOf = rune => RUNES.find(entry => entry.beats === rune.id);
const runeById = id => RUNES.find(entry => entry.id === id);

/* -------------------------------------------------------------- geometria */

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i += 1) total += dist(points[i - 1], points[i]);
    return total;
}

function centroid(points) {
    let x = 0;
    let y = 0;
    for (const point of points) { x += point.x; y += point.y; }
    return { x: x / points.length, y: y / points.length };
}

function rotated(points, radians, center) {
    const pivot = center || centroid(points);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return points.map(point => {
        const dx = point.x - pivot.x;
        const dy = point.y - pivot.y;
        return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
    });
}

function resample(points, count) {
    if (points.length < 2) return Array.from({ length: count }, () => ({ ...points[0] }));
    const source = points.map(point => ({ x: point.x, y: point.y }));
    const total = pathLength(source);
    if (!total) return Array.from({ length: count }, () => ({ ...source[0] }));
    const step = total / (count - 1);
    const out = [{ ...source[0] }];
    let carried = 0;
    let index = 1;
    let previous = { ...source[0] };
    while (index < source.length && out.length < count) {
        const segment = dist(previous, source[index]);
        if (segment > 0 && carried + segment >= step) {
            const ratio = (step - carried) / segment;
            const next = {
                x: previous.x + ratio * (source[index].x - previous.x),
                y: previous.y + ratio * (source[index].y - previous.y)
            };
            out.push(next);
            previous = next;
            carried = 0;
        } else {
            carried += segment;
            previous = source[index];
            index += 1;
        }
    }
    while (out.length < count) out.push({ ...out[out.length - 1] });
    return out;
}

function normalized(points) {
    let shape = resample(points, SAMPLE_COUNT);
    const origin = centroid(shape);
    shape = rotated(shape, -Math.atan2(origin.y - shape[0].y, origin.x - shape[0].x));
    const box = shape.reduce((acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        maxX: Math.max(acc.maxX, point.x),
        minY: Math.min(acc.minY, point.y),
        maxY: Math.max(acc.maxY, point.y)
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    const size = Math.max(box.maxX - box.minX, box.maxY - box.minY) || 1;
    const scaled = shape.map(point => ({
        x: (point.x - box.minX) / size,
        y: (point.y - box.minY) / size
    }));
    const middle = centroid(scaled);
    return scaled.map(point => ({ x: point.x - middle.x, y: point.y - middle.y }));
}

// Confronta forma e verso: chi disegna al contrario non viene penalizzato.
function compare(userShape, templateShape) {
    let best = Infinity;
    for (const reversed of [false, true]) {
        const candidate = reversed ? [...userShape].reverse() : userShape;
        for (let angle = -180; angle < 180; angle += ROTATION_STEP) {
            const aligned = rotated(candidate, (angle * Math.PI) / 180, { x: 0, y: 0 });
            let sum = 0;
            for (let i = 0; i < SAMPLE_COUNT; i += 1) sum += dist(aligned[i], templateShape[i]);
            const distance = sum / SAMPLE_COUNT;
            if (distance < best) best = distance;
        }
    }
    return best;
}

for (const rune of RUNES) {
    rune.shape = normalized(rune.points);
    rune.length = pathLength(rune.points);
}

function evaluateStroke(rawPoints) {
    if (rawPoints.length < 6) return null;
    const rawLength = pathLength(rawPoints);
    if (rawLength < 0.25) return null;
    const shape = normalized(rawPoints);
    return RUNES.map((rune, index) => {
        const distance = compare(shape, rune.shape);
        let score = Math.max(0, Math.min(1, 1 - distance / TOLERANCE)) ** 0.9;
        const ratio = rawLength / rune.length;
        if (ratio < 0.35) score = 0;
        else if (ratio < 0.8) score *= (ratio / 0.8) ** 1.2;
        return { index, score };
    });
}

/* ------------------------------------------------------------- stato gioco */

const state = {
    level: 1,
    phase: 'menu',            // menu | telegraph | answer | clash | over
    you: HEARTS,
    foe: HEARTS,
    exchange: 0,
    wins: 0,
    losses: 0,
    best: 0,
    foeRune: null,
    answer: null,
    foeRoll: 0,
    stroke: [],
    window: 7000,
    timerStart: 0,
    result: null,
    particles: [],
    soundOn: true,
    raf: 0,
    timers: [],
    audio: null
};

try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved && typeof saved.soundOn === 'boolean') state.soundOn = saved.soundOn;
} catch { /* memoria non disponibile */ }

const saveSettings = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ soundOn: state.soundOn })); } catch { /* niente */ }
};

/* ------------------------------------------------------------------ vista */

export function initSigilli(container) {
    window.__homeCleanup?.();
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    container.innerHTML = `
        <div class="game-master-wrapper sigilli-game">
            <header class="sigilli-topbar">
                <button class="game-btn-action sigilli-exit" id="sigilli-exit" type="button">← ESCI</button>
                <div class="sigilli-brand"><span aria-hidden="true">✶</span> SIGILLI</div>
                <button class="sigilli-icon" id="sigilli-sound" type="button" aria-label="Suoni attivi">♪</button>
            </header>

            <section class="sigilli-hud" id="sigilli-hud" hidden>
                <div class="sigilli-hearts">
                    <span class="sigilli-hearts-label">TU</span>
                    <div class="sigilli-hearts-row" id="sigilli-hearts-you"></div>
                    <span class="sigilli-hearts-label">OSTE</span>
                    <div class="sigilli-hearts-row" id="sigilli-hearts-foe"></div>
                </div>
                <div class="sigilli-cast">
                    <canvas class="sigilli-cast-shape" id="sigilli-cast-shape" width="88" height="88" aria-hidden="true"></canvas>
                    <div class="sigilli-cast-copy">
                        <strong id="sigilli-cast-title">L'Oste prepara la runa…</strong>
                        <small id="sigilli-cast-hint">Rispondi con la runa che la batte</small>
                    </div>
                    <div class="sigilli-timer" aria-hidden="true"><i id="sigilli-timer-fill"></i></div>
                </div>
            </section>

            <main class="sigilli-stage">
                <canvas id="sigilli-canvas" aria-label="Aria: traccia la runa di risposta"></canvas>
                <p class="sigilli-stage-hint" id="sigilli-stage-hint">Traccia la runa che batte quella dell'Oste</p>
            </main>

            <footer class="sigilli-footer" aria-live="polite">
                <span class="sigilli-last" id="sigilli-last">—</span>
                <span class="sigilli-verdict" id="sigilli-verdict">Livello <b id="sigilli-level">1</b></span>
            </footer>

            <section class="sigilli-screen" id="sigilli-screen">
                <div class="sigilli-card">
                    <span class="sigilli-eyebrow">DUST OF THE ARCANE</span>
                    <h1 class="main-title">SIGILLI <em>(duello di rune)</em></h1>
                    <p class="sigilli-intro">L'Oste traccia una runa nell'aria. Tu rispondi con quella che la batte: Fulmine → Anello → Arco → Fulmine. La precisione del tratto è la tua lama.</p>
                    <div class="sigilli-legend" aria-label="Contro-rune">
                        ${RUNES.map(rune => `
                            <span class="sigilli-rune-card">
                                <b aria-hidden="true">${rune.glyph}</b>
                                <em>${rune.name}</em>
                                <small>batte ${runeById(rune.beats).name}</small>
                            </span>
                        `).join('')}
                    </div>
                    <div class="sigilli-levels" id="sigilli-levels"></div>
                    <button class="game-btn-action sigilli-start" id="sigilli-start" type="button">SFIDA L'OSTE</button>
                    <button class="sigilli-quiet" id="sigilli-quit" type="button">Torna ai minigiochi</button>
                </div>
            </section>

            <section class="sigilli-overlay" id="sigilli-overlay" hidden>
                <div class="sigilli-card" role="status">
                    <span class="sigilli-eyebrow" id="sigilli-over-eyebrow">FINE DEL DUELLO</span>
                    <h2 class="sigilli-over-title" id="sigilli-over-title">Vittoria</h2>
                    <p class="sigilli-over-copy" id="sigilli-over-copy">—</p>
                    <button class="game-btn-action sigilli-start" id="sigilli-again" type="button">RIGIOCA</button>
                    <button class="sigilli-quiet" id="sigilli-over-quit" type="button">Torna ai minigiochi</button>
                </div>
            </section>
        </div>
    `;

    const els = {
        game: container.querySelector('.sigilli-game'),
        canvas: container.querySelector('#sigilli-canvas'),
        stageHint: container.querySelector('#sigilli-stage-hint'),
        hud: container.querySelector('#sigilli-hud'),
        heartsYou: container.querySelector('#sigilli-hearts-you'),
        heartsFoe: container.querySelector('#sigilli-hearts-foe'),
        castShape: container.querySelector('#sigilli-cast-shape'),
        castTitle: container.querySelector('#sigilli-cast-title'),
        castHint: container.querySelector('#sigilli-cast-hint'),
        timerFill: container.querySelector('#sigilli-timer-fill'),
        last: container.querySelector('#sigilli-last'),
        verdict: container.querySelector('#sigilli-verdict'),
        level: container.querySelector('#sigilli-level'),
        screen: container.querySelector('#sigilli-screen'),
        overlay: container.querySelector('#sigilli-overlay'),
        overTitle: container.querySelector('#sigilli-over-title'),
        overCopy: container.querySelector('#sigilli-over-copy'),
        sound: container.querySelector('#sigilli-sound'),
        levels: container.querySelector('#sigilli-levels')
    };

    const stage = container.querySelector('.sigilli-stage');
    const ctx = els.canvas.getContext('2d');
    const castCtx = els.castShape.getContext('2d');
    let box = { x: 0, y: 0, size: 300 };
    let ghost = [];
    let castProgress = 1;

    const screenOf = point => ({ x: box.x + point.x * box.size, y: box.y + point.y * box.size });
    const boxOf = point => ({ x: (point.x - box.x) / box.size, y: (point.y - box.y) / box.size });
    const later = (fn, ms) => { const id = setTimeout(fn, ms); state.timers.push(id); return id; };

    /* ---------------------------------------------------------- interfaccia */

    const heartsMarkup = value => Array.from({ length: HEARTS }, (_, i) => (
        `<span class="sigilli-heart${i < value ? ' is-full' : ''}" aria-hidden="true">✶</span>`
    )).join('');

    function updateHud() {
        els.heartsYou.innerHTML = heartsMarkup(state.you);
        els.heartsFoe.innerHTML = heartsMarkup(state.foe);
        els.level.textContent = String(state.level);
        els.hud.hidden = state.phase === 'menu';
        els.screen.hidden = state.phase !== 'menu';
        els.overlay.hidden = state.phase !== 'over';
        els.game.classList.toggle('is-playing', state.phase !== 'menu' && state.phase !== 'over');
        els.sound.textContent = state.soundOn ? '♪' : '×';
        els.sound.setAttribute('aria-pressed', String(!state.soundOn));
    }

    function setCast(label, hint) {
        els.castTitle.textContent = label;
        els.castHint.textContent = hint;
    }

    /* ------------------------------------------------------------- misura */

    function measure() {
        if (!stage?.isConnected) return;
        // Si misura il palco, non la tela: la tela è assoluta e prenderebbe le
        // proprie dimensioni, crescendo di 2px a ogni misura per via del bordo.
        const rect = stage.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        els.canvas.width = Math.max(1, Math.round(rect.width * ratio));
        els.canvas.height = Math.max(1, Math.round(rect.height * ratio));
        // Dimensioni esplicite: con `height: 100%` la tela ricadeva sul rapporto
        // intrinseco del bitmap e restava più bassa del palco.
        els.canvas.style.width = `${rect.width}px`;
        els.canvas.style.height = `${rect.height}px`;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        const size = Math.min(rect.width * 0.88, rect.height * 0.9, 420);
        box = { x: (rect.width - size) / 2, y: (rect.height - size) / 2, size };
        rebuildGhost();
    }

    function rebuildGhost() {
        const rune = state.answer || RUNES[0];
        ghost = resample(rune.points.map(screenOf), SAMPLE_COUNT);
    }

    /* ------------------------------------------------------------- duello */

    function startMatch(level) {
        state.level = Math.max(1, Number(level) || 1);
        state.you = HEARTS;
        state.foe = HEARTS;
        state.exchange = 0;
        state.wins = 0;
        state.losses = 0;
        state.best = 0;
        state.stroke = [];
        state.result = null;
        state.foeRune = null;
        state.phase = 'telegraph';
        state.particles = [];
        state.exchange = 0;
        els.last.textContent = 'Scambio 1';
        els.verdict.innerHTML = `Livello <b>${state.level}</b>`;
        updateHud();
        measure();
        beginExchange();
        startLoop();
    }

    function beginExchange() {
        state.exchange += 1;
        const pool = RUNES.filter(rune => rune !== state.foeRune);
        state.foeRune = pool[Math.floor(Math.random() * pool.length)];
        state.answer = counterOf(state.foeRune);
        state.foeRoll = Math.min(0.95, 0.55 + (state.level - 1) * 0.045 + Math.random() * 0.1);
        state.window = Math.max(4200, 7200 - (state.level - 1) * 220);
        state.stroke = [];
        state.result = null;
        state.phase = 'telegraph';
        castProgress = 0;
        setCast(`L'Oste scaglia ${state.foeRune.name}`, `Rispondi con ${state.answer.name}`);
        els.stageHint.textContent = 'Osserva la runa in arrivo…';
        els.stageHint.classList.remove('is-hidden');
        // Il piede conserva l'esito dello scambio appena chiuso finché non ne arriva uno nuovo.
        els.timerFill.style.transform = 'scaleX(0)';
        rebuildGhost();
        updateHud();
        later(() => {
            if (state.phase !== 'telegraph') return;
            state.phase = 'answer';
            state.timerStart = performance.now();
            els.stageHint.textContent = `Traccia ${state.answer.name}: ${Math.round(state.window / 1000)} secondi`;
            els.stageHint.classList.remove('is-hidden');
        }, 900);
    }

    function timerLeft(now) {
        if (state.phase !== 'answer') return 1;
        return Math.max(0, 1 - (now - state.timerStart) / state.window);
    }

    function resolveAnswer(reason) {
        if (state.phase !== 'answer') return;
        state.phase = 'clash';
        const targetIndex = RUNES.indexOf(state.answer);
        const raw = state.stroke.map(boxOf);
        const scores = reason ? null : evaluateStroke(raw);
        let power = 0;
        let note = reason || '';

        if (scores) {
            power = scores[targetIndex].score;
            const strongest = scores.reduce((best, entry) => (entry.score > best.score ? entry : best), scores[0]);
            if (power < 0.45 && strongest.index !== targetIndex && strongest.score > 0.6) {
                note = `hai tracciato ${RUNES[strongest.index].name}: serviva ${state.answer.name}`;
                power = 0;
            } else if (power < 0.45) {
                note = 'il tratto non regge';
                power = 0;
            }
        }

        const gone = (state.window - (performance.now() - state.timerStart)) < 0;
        if (!note && gone) note = 'tempo scaduto';

        state.best = Math.max(state.best, power);

        if (power > state.foeRoll + 0.02) {
            state.foe -= 1;
            state.wins += 1;
            note = note || 'colpo all\'Oste';
        } else if (Math.abs(power - state.foeRoll) <= 0.02) {
            note = 'le rune si annullano';
        } else {
            state.you -= 1;
            state.losses += 1;
            if (!note) note = power >= 0.45 ? 'la sua runa era più ferma' : note;
        }

        state.result = { power, foeRoll: state.foeRoll, note };
        els.last.textContent = `Tu ${Math.round(power * 100)}% · Oste ${Math.round(state.foeRoll * 100)}%`;
        els.verdict.textContent = note;
        els.timerFill.style.transform = 'scaleX(1)';
        updateHud();
        if (power > 0.6) burst();
        chime(power > state.foeRoll ? 0.9 : 0.4);

        later(() => {
            if (state.you <= 0 || state.foe <= 0) finishMatch();
            else beginExchange();
        }, 1150);
    }

    function finishMatch() {
        state.phase = 'over';
        const won = state.foe <= 0;
        const percent = Math.round(state.best * 100);
        recordMinigameResult('sigilli', won ? 'win' : 'loss', { score: percent });
        if (won) unlockNextLevel('sigilli', state.level);
        const unlocked = getUnlockedLevel('sigilli');
        els.overTitle.textContent = won ? 'L\'Oste si inchina' : 'L\'Oste ha vinto';
        els.overCopy.textContent = won
            ? `Hai spezzato la sua guardia in ${state.exchange} scambi. Migliore precisione ${percent}%. Livelli disponibili: fino al ${unlocked}.`
            : `Scambi vinti ${state.wins}, persi ${state.losses}. Migliore precisione ${percent}%. La rivincita è a un tocco.`;
        updateHud();
        renderLadder();
    }

    /* ------------------------------------------------------------ disegno */

    let stageSize = { width: 0, height: 0 };

    function frame(now) {
        if (!els.canvas.isConnected) return;
        state.raf = requestAnimationFrame(frame);
        // Il palco cambia altezza quando compaiono HUD e verdetto: si rimisura
        // qui invece di fidarsi del solo ResizeObserver.
        if (stage.clientWidth !== stageSize.width || stage.clientHeight !== stageSize.height) {
            measure();
            stageSize = { width: stage.clientWidth, height: stage.clientHeight };
        }
        draw(now);
    }

    function startLoop() {
        cancelAnimationFrame(state.raf);
        state.raf = requestAnimationFrame(frame);
    }

    function draw(now) {
        const width = els.canvas.clientWidth;
        const height = els.canvas.clientHeight;
        ctx.clearRect(0, 0, width, height);
        if (state.phase === 'menu' || state.phase === 'over') return;

        const left = timerLeft(now);
        els.timerFill.style.transform = `scaleX(${left.toFixed(3)})`;

        if (left <= 0 && state.phase === 'answer') {
            resolveAnswer('tempo scaduto');
        }

        drawEmbers(now, width, height);
        if (state.phase === 'answer' || state.phase === 'clash') drawGhost(now);
        drawStroke(now);
        drawParticles();
        drawCastChip(now);
    }

    function drawEmbers(now, width, height) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#c77dff';
        for (let i = 0; i < (REDUCED ? 6 : 16); i += 1) {
            const x = ((i * 97.3) % width + Math.sin(now / 1800 + i) * 8) | 0;
            const y = ((i * 53.7 + now / 60) % height) | 0;
            ctx.beginPath();
            ctx.arc(x, y, 1.3, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
    }

    function drawGhost(now) {
        if (!ghost.length) return;
        const path = new Path2D();
        for (let i = 1; i < ghost.length; i += 1) {
            path.moveTo(ghost[i - 1].x, ghost[i - 1].y);
            path.lineTo(ghost[i].x, ghost[i].y);
        }
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(199, 125, 255, 0.32)';
        ctx.lineWidth = 4;
        ctx.stroke(path);
        const start = ghost[0];
        const pulse = 1 + Math.sin(now / 320) * 0.2;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#f5dd62';
        ctx.beginPath();
        ctx.arc(start.x, start.y, 4.2 * pulse, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function drawStroke(now) {
        if (state.stroke.length < 2) return;
        const path = new Path2D();
        path.moveTo(state.stroke[0].x, state.stroke[0].y);
        for (let i = 1; i < state.stroke.length; i += 1) path.lineTo(state.stroke[i].x, state.stroke[i].y);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (!REDUCED) {
            ctx.shadowColor = 'rgba(199, 125, 255, 0.65)';
            ctx.shadowBlur = 20;
        }
        ctx.strokeStyle = 'rgba(157, 78, 222, 0.4)';
        ctx.lineWidth = 12;
        ctx.stroke(path);
        ctx.shadowBlur = 0;
        const gradient = ctx.createLinearGradient(box.x, box.y, box.x + box.size, box.y + box.size);
        gradient.addColorStop(0, '#f4e9ff');
        gradient.addColorStop(0.55, '#c77dff');
        gradient.addColorStop(1, '#9d4edd');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 5;
        ctx.stroke(path);
        if (state.phase === 'answer') {
            const tip = state.stroke[state.stroke.length - 1];
            const glow = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 24);
            glow.addColorStop(0, 'rgba(255,255,255,0.85)');
            glow.addColorStop(0.4, 'rgba(199,125,255,0.5)');
            glow.addColorStop(1, 'rgba(157,78,222,0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(tip.x, tip.y, 24, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
        void now;
    }

    function drawCastChip(now) {
        const rune = state.foeRune || RUNES[0];
        const size = 88;
        castCtx.clearRect(0, 0, size, size);
        if (state.phase === 'telegraph') castProgress = Math.min(1, castProgress + 0.018);
        const points = rune.points;
        const total = pathLength(points);
        let budget = total * (state.phase === 'telegraph' ? castProgress : 1);
        castCtx.save();
        castCtx.strokeStyle = 'rgba(245, 221, 98, 0.9)';
        castCtx.lineWidth = 3;
        castCtx.lineCap = 'round';
        castCtx.lineJoin = 'round';
        if (!REDUCED) {
            castCtx.shadowColor = 'rgba(245, 221, 98, 0.6)';
            castCtx.shadowBlur = 8;
        }
        castCtx.beginPath();
        castCtx.moveTo(10 + points[0].x * (size - 20), 10 + points[0].y * (size - 20));
        for (let i = 1; i < points.length && budget > 0; i += 1) {
            const segment = dist(points[i - 1], points[i]);
            const ratio = Math.min(1, budget / segment);
            castCtx.lineTo(
                10 + (points[i - 1].x + (points[i].x - points[i - 1].x) * ratio) * (size - 20),
                10 + (points[i - 1].y + (points[i].y - points[i - 1].y) * ratio) * (size - 20)
            );
            budget -= segment;
        }
        castCtx.stroke();
        castCtx.restore();
        void now;
    }

    function burst() {
        if (REDUCED) return;
        const last = state.stroke[state.stroke.length - 1] || { x: box.x + box.size / 2, y: box.y + box.size / 2 };
        for (let i = 0; i < 18; i += 1) {
            const angle = Math.random() * TAU;
            const speed = 30 + Math.random() * 110;
            state.particles.push({
                x: last.x, y: last.y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 20,
                life: 1, radius: 1.2 + Math.random() * 2
            });
        }
    }

    function drawParticles() {
        if (!state.particles.length) return;
        ctx.save();
        for (const particle of state.particles) {
            particle.life -= 0.035;
            particle.x += particle.vx * 0.016;
            particle.y += particle.vy * 0.016;
            particle.vy += 160 * 0.016;
            ctx.globalAlpha = Math.max(0, particle.life) * 0.9;
            ctx.fillStyle = '#f5dd62';
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, TAU);
            ctx.fill();
        }
        ctx.restore();
        state.particles = state.particles.filter(particle => particle.life > 0);
    }

    /* -------------------------------------------------------------- audio */

    function ensureAudio() {
        if (!state.soundOn || state.audio) return;
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        try { state.audio = new AudioCtor(); } catch { state.audio = null; }
    }

    function chime(strength) {
        if (!state.soundOn) return;
        // Fuori dal gesto: la creazione del dispositivo può bloccare il thread.
        later(() => {
            ensureAudio();
            if (!state.audio) return;
            if (state.audio.state === 'suspended') state.audio.resume?.();
            const now = state.audio.currentTime;
            const base = 260 + strength * 320;
            [1, 1.5].forEach((multiplier, index) => {
                const osc = state.audio.createOscillator();
                const gain = state.audio.createGain();
                osc.type = 'sine';
                osc.frequency.value = base * multiplier;
                gain.gain.setValueAtTime(0.0001, now + index * 0.02);
                gain.gain.exponentialRampToValueAtTime(0.09 / (index + 1), now + 0.02 + index * 0.02);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
                osc.connect(gain).connect(state.audio.destination);
                osc.start(now + index * 0.02);
                osc.stop(now + 0.8);
            });
        }, 0);
    }

    /* ------------------------------------------------------------ input */

    function localPoint(event) {
        const rect = els.canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    els.canvas.addEventListener('pointerdown', event => {
        if (state.phase !== 'answer') return;
        if (event.button !== undefined && event.button > 0) return;
        state.stroke = [localPoint(event)];
        try { els.canvas.setPointerCapture?.(event.pointerId); } catch { /* evento sintetico */ }
        els.stageHint.classList.add('is-hidden');
        ensureAudio();
    });

    els.canvas.addEventListener('pointermove', event => {
        if (state.phase !== 'answer' || !state.stroke.length) return;
        const point = localPoint(event);
        if (dist(state.stroke[state.stroke.length - 1], point) < 1.4) return;
        state.stroke.push(point);
    });

    const endStroke = event => {
        if (state.phase !== 'answer' || !state.stroke.length) return;
        if (event && event.pointerId !== undefined) {
            try { els.canvas.releasePointerCapture?.(event.pointerId); } catch { /* idem */ }
        }
        resolveAnswer(null);
    };

    els.canvas.addEventListener('pointerup', endStroke);
    els.canvas.addEventListener('pointercancel', endStroke);

    /* ------------------------------------------------------------ comandi */

    function renderLadder() {
        renderLevelLadder('sigilli', els.levels, level => startMatch(level));
    }

    let leaving = false;

    async function quit() {
        if (leaving) return;
        leaving = true;
        cancelAnimationFrame(state.raf);
        window.removeEventListener('keydown', onKeyDown);
        state.timers.forEach(clearTimeout);
        state.timers = [];
        try { await state.audio?.close(); } catch { /* già chiuso */ }
        state.audio = null;
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.overflowY = 'auto';
        document.body.style.touchAction = '';
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container, { filter: 'strategy' });
    }

    container.querySelector('#sigilli-start').onclick = () => startMatch(getUnlockedLevel('sigilli'));
    container.querySelector('#sigilli-again').onclick = () => startMatch(state.level);
    container.querySelector('#sigilli-exit').onclick = quit;
    container.querySelector('#sigilli-quit').onclick = quit;
    container.querySelector('#sigilli-over-quit').onclick = quit;
    els.sound.onclick = () => {
        state.soundOn = !state.soundOn;
        saveSettings();
        updateHud();
    };

    function onKeyDown(event) {
        if (event.key === 'Escape') quit();
    }

    window.addEventListener('keydown', onKeyDown);

    window.addEventListener('resize', measure);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(stage);

    /* ------------------------------------------------------------- avvio */

    renderLadder();
    updateHud();
    measure();
    startLoop();
}
