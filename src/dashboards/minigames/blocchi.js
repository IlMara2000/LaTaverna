import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { renderLevelLadder, unlockNextLevel } from '../../services/levels.js';
import './blocchi.css';

const COLS = 10;
const ROWS = 20;
const LOCK_DELAY = 420;
const STORAGE_KEY = 'taverna_blocchi_arcani_v1';

const PIECES = {
    I: {
        color: '#55dffc',
        matrix: [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ]
    },
    J: {
        color: '#6577ff',
        matrix: [
            [1, 0, 0],
            [1, 1, 1],
            [0, 0, 0]
        ]
    },
    L: {
        color: '#ffad55',
        matrix: [
            [0, 0, 1],
            [1, 1, 1],
            [0, 0, 0]
        ]
    },
    O: {
        color: '#f5dd62',
        matrix: [
            [1, 1],
            [1, 1]
        ]
    },
    S: {
        color: '#5de2a1',
        matrix: [
            [0, 1, 1],
            [1, 1, 0],
            [0, 0, 0]
        ]
    },
    T: {
        color: '#c77dff',
        matrix: [
            [0, 1, 0],
            [1, 1, 1],
            [0, 0, 0]
        ]
    },
    Z: {
        color: '#ff668f',
        matrix: [
            [1, 1, 0],
            [0, 1, 1],
            [0, 0, 0]
        ]
    }
};

const PIECE_TYPES = Object.keys(PIECES);
const SCORE_TABLE = [0, 100, 300, 500, 800];

const createBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(''));
const cloneMatrix = matrix => matrix.map(row => [...row]);
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));

const loadLocalState = () => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch {
        return {};
    }
};

const saveLocalState = (patch = {}) => {
    const previous = loadLocalState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...previous, ...patch }));
};

const shuffledBag = () => {
    const bag = [...PIECE_TYPES];
    for (let index = bag.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1));
        [bag[index], bag[target]] = [bag[target], bag[index]];
    }
    return bag;
};

const rotateMatrix = (matrix, direction = 1) => {
    const size = matrix.length;
    return Array.from({ length: size }, (_, row) => (
        Array.from({ length: size }, (_, col) => (
            direction > 0 ? matrix[size - col - 1][row] : matrix[col][size - row - 1]
        ))
    ));
};

const getDropInterval = level => Math.max(70, Math.round(920 * Math.pow(0.86, Math.max(0, level - 1))));
const getObjective = challengeLevel => Math.min(50, 8 + (Math.max(1, challengeLevel) - 1) * 2);

const createState = () => {
    const saved = loadLocalState();
    return {
        board: createBoard(),
        active: null,
        queue: [],
        bag: [],
        hold: null,
        canHold: true,
        score: 0,
        highScore: Number(saved.highScore) || 0,
        lines: 0,
        combo: -1,
        challengeLevel: 1,
        level: 1,
        objective: 8,
        challengeComplete: false,
        phase: 'menu',
        paused: false,
        soundOn: saved.soundOn !== false,
        lastTime: 0,
        dropAccumulator: 0,
        lockAccumulator: 0,
        animationFrame: 0,
        clearTimer: 0,
        clearingRows: [],
        audioContext: null,
        cleanup: []
    };
};

export function initBlocchi(container) {
    if (!container) return;
    try { updateSidebarContext('minigames'); } catch { /* sidebar opzionale */ }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#05010a';

    const state = createState();
    renderLayout(container, state);
}

function renderLayout(container, state) {
    window.cancelAnimationFrame(state.animationFrame);
    window.clearTimeout(state.clearTimer);
    state.cleanup.forEach(cleanup => cleanup());
    state.cleanup = [];
    state.phase = 'menu';

    container.innerHTML = `
        <div class="game-master-wrapper blocks-game fade-in">
            <section id="blocks-start" class="game-master-wrapper blocks-start" aria-label="Menu Blocchi Arcani">
                <div class="blocks-start-mark" aria-hidden="true">
                    <i></i><i></i><i></i><i></i><i></i><i></i>
                </div>
                <span class="blocks-eyebrow">PUZZLE DELLA TAVERNA</span>
                <h1 class="main-title">BLOCCHI <em>ARCANI</em></h1>
                <p>Incastra i sigilli, completa le righe e resisti alla caduta.</p>

                <div class="blocks-feature-row" aria-label="Funzioni del gioco">
                    <span>OMBRA</span><span>RISERVA</span><span>ANTEPRIMA</span><span>COMBO</span>
                </div>

                <details class="blocks-help">
                    <summary>COME SI GIOCA</summary>
                    <div>
                        <span><kbd>← →</kbd> Muovi</span>
                        <span><kbd>↑ / X</kbd> Ruota</span>
                        <span><kbd>Z</kbd> Ruota indietro</span>
                        <span><kbd>↓</kbd> Discesa</span>
                        <span><kbd>SPAZIO</kbd> Caduta</span>
                        <span><kbd>C</kbd> Riserva</span>
                    </div>
                </details>

                <section class="blocks-level-select" aria-label="Sfide contro il tempo">
                    <span>SELEZIONA LA VELOCITÀ INIZIALE</span>
                    <div id="levels-container"></div>
                </section>
                <button id="blocks-exit-menu" class="game-btn-action blocks-quiet-action">TORNA ALLA TAVERNA</button>
            </section>

            <header class="blocks-topbar" hidden>
                <button id="blocks-exit" class="game-btn-action" aria-label="Esci da Blocchi Arcani">← ESCI</button>
                <div class="blocks-brand"><span aria-hidden="true">▦</span><strong>BLOCCHI ARCANI</strong></div>
                <div class="blocks-top-actions">
                    <button id="blocks-sound" type="button" aria-label="Attiva o disattiva suoni">${state.soundOn ? '♪' : '×'}</button>
                    <button id="blocks-pause" type="button" aria-label="Pausa">Ⅱ</button>
                    <button id="blocks-restart" type="button" aria-label="Ricomincia">↻</button>
                </div>
            </header>

            <main class="blocks-stage" hidden>
                <aside class="blocks-hud blocks-hud-left">
                    <section>
                        <span>PUNTEGGIO</span>
                        <strong id="blocks-score">0</strong>
                    </section>
                    <section>
                        <span>RECORD</span>
                        <strong id="blocks-high-score">${state.highScore.toLocaleString('it-IT')}</strong>
                    </section>
                    <section class="blocks-hold-panel">
                        <span>RISERVA <small>C</small></span>
                        <canvas id="blocks-hold" width="96" height="96" aria-label="Pezzo in riserva"></canvas>
                    </section>
                </aside>

                <section class="blocks-board-shell">
                    <div class="blocks-board-topline">
                        <span id="blocks-level-copy">LIVELLO 1</span>
                        <span id="blocks-status" aria-live="polite">PREPARATI</span>
                    </div>
                    <canvas id="blocks-board" width="300" height="600" aria-label="Campo di gioco, dieci colonne per venti righe"></canvas>
                    <div class="blocks-objective">
                        <div><span>OBIETTIVO SFIDA</span><strong id="blocks-objective-copy">0 / 8 RIGHE</strong></div>
                        <div class="blocks-objective-track"><i id="blocks-objective-fill"></i></div>
                    </div>
                </section>

                <aside class="blocks-hud blocks-hud-right">
                    <section>
                        <span>RIGHE</span>
                        <strong id="blocks-lines">0</strong>
                    </section>
                    <section>
                        <span>COMBO</span>
                        <strong id="blocks-combo">—</strong>
                    </section>
                    <section class="blocks-next-panel">
                        <span>PROSSIMI</span>
                        <div>
                            <canvas data-next-piece="0" width="84" height="68" aria-label="Prossimo pezzo"></canvas>
                            <canvas data-next-piece="1" width="84" height="68" aria-label="Secondo pezzo"></canvas>
                            <canvas data-next-piece="2" width="84" height="68" aria-label="Terzo pezzo"></canvas>
                        </div>
                    </section>
                </aside>
            </main>

            <nav class="blocks-touch-controls" hidden aria-label="Comandi touch">
                <button type="button" data-block-action="left" aria-label="Muovi a sinistra">←</button>
                <button type="button" data-block-action="rotate-left" aria-label="Ruota a sinistra">↶</button>
                <button type="button" data-block-action="down" aria-label="Muovi in basso">↓</button>
                <button type="button" data-block-action="rotate" aria-label="Ruota a destra">↷</button>
                <button type="button" data-block-action="right" aria-label="Muovi a destra">→</button>
                <button type="button" data-block-action="hold" aria-label="Metti in riserva">RISERVA</button>
                <button type="button" data-block-action="drop" aria-label="Caduta immediata">CADUTA</button>
            </nav>

            <section id="blocks-overlay" class="blocks-overlay" hidden>
                <div>
                    <span id="blocks-overlay-eyebrow">PAUSA</span>
                    <h2 id="blocks-overlay-title">FIATO SOSPESO</h2>
                    <p id="blocks-overlay-copy">La caduta è ferma.</p>
                    <div id="blocks-final-stats" class="blocks-final-stats" hidden></div>
                    <div class="blocks-overlay-actions">
                        <button id="blocks-resume" class="game-btn-action">RIPRENDI</button>
                        <button id="blocks-play-again" class="game-btn-action">RIGIOCA</button>
                        <button id="blocks-levels" class="game-btn-action">CAMBIA LIVELLO</button>
                    </div>
                </div>
            </section>

            <div id="blocks-toast" class="blocks-toast" role="status" aria-live="polite"></div>
        </div>
    `;

    const startScreen = container.querySelector('#blocks-start');
    renderLevelLadder('blocchi', container.querySelector('#levels-container'), selectedLevel => {
        startScreen?.remove();
        startGame(container, state, selectedLevel);
    }, false, { windowSize: 2 });

    const quit = () => quitGame(container, state);
    container.querySelector('#blocks-exit-menu').onclick = quit;
    container.querySelector('#blocks-exit').onclick = quit;
    container.querySelector('#blocks-pause').onclick = () => togglePause(container, state);
    container.querySelector('#blocks-restart').onclick = () => startGame(container, state, state.challengeLevel);
    container.querySelector('#blocks-sound').onclick = event => {
        state.soundOn = !state.soundOn;
        event.currentTarget.textContent = state.soundOn ? '♪' : '×';
        event.currentTarget.classList.toggle('is-muted', !state.soundOn);
        saveLocalState({ soundOn: state.soundOn });
        if (state.soundOn) playTone(state, 540, 0.05, 'sine', 0.025);
    };
    container.querySelector('#blocks-resume').onclick = () => togglePause(container, state, false);
    container.querySelector('#blocks-play-again').onclick = () => startGame(container, state, state.challengeLevel);
    container.querySelector('#blocks-levels').onclick = () => renderLayout(container, state);

    bindControls(container, state);
    drawAll(container, state);
}

function startGame(container, state, selectedLevel = 1) {
    window.clearTimeout(state.clearTimer);
    window.cancelAnimationFrame(state.animationFrame);
    state.board = createBoard();
    state.active = null;
    state.queue = [];
    state.bag = [];
    state.hold = null;
    state.canHold = true;
    state.score = 0;
    state.lines = 0;
    state.combo = -1;
    state.challengeLevel = Math.max(1, Math.floor(Number(selectedLevel) || 1));
    state.level = state.challengeLevel;
    state.objective = getObjective(state.challengeLevel);
    state.challengeComplete = false;
    state.phase = 'playing';
    state.paused = false;
    state.lastTime = 0;
    state.dropAccumulator = 0;
    state.lockAccumulator = 0;
    state.clearingRows = [];

    ['.blocks-topbar', '.blocks-stage', '.blocks-touch-controls'].forEach(selector => {
        const element = container.querySelector(selector);
        if (element) element.hidden = false;
    });

    fillQueue(state);
    spawnPiece(state);
    hideOverlay(container);
    updateHud(container, state);
    drawAll(container, state);
    playTone(state, 360, 0.06, 'triangle', 0.025);
    state.animationFrame = window.requestAnimationFrame(time => gameLoop(container, state, time));
}

function fillQueue(state) {
    while (state.queue.length < 6) {
        if (!state.bag.length) state.bag = shuffledBag();
        state.queue.push(state.bag.shift());
    }
}

function createPiece(type) {
    const matrix = cloneMatrix(PIECES[type].matrix);
    return {
        type,
        matrix,
        x: Math.floor((COLS - matrix[0].length) / 2),
        y: type === 'I' ? -2 : -1
    };
}

function spawnPiece(state, forcedType = '') {
    fillQueue(state);
    const type = forcedType || state.queue.shift();
    fillQueue(state);
    state.active = createPiece(type);
    state.canHold = true;
    state.lockAccumulator = 0;
    if (collides(state.board, state.active)) return false;
    return true;
}

function collides(board, piece, offsetX = 0, offsetY = 0, matrix = piece?.matrix) {
    if (!piece || !matrix) return true;
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < matrix[row].length; col += 1) {
            if (!matrix[row][col]) continue;
            const boardX = piece.x + col + offsetX;
            const boardY = piece.y + row + offsetY;
            if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
            if (boardY >= 0 && board[boardY][boardX]) return true;
        }
    }
    return false;
}

function movePiece(state, dx, dy = 0) {
    if (!canControl(state) || collides(state.board, state.active, dx, dy)) return false;
    state.active.x += dx;
    state.active.y += dy;
    state.lockAccumulator = 0;
    return true;
}

function rotatePiece(state, direction = 1) {
    if (!canControl(state) || state.active.type === 'O') return false;
    const rotated = rotateMatrix(state.active.matrix, direction);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
        if (!collides(state.board, state.active, kick, 0, rotated)) {
            state.active.matrix = rotated;
            state.active.x += kick;
            state.lockAccumulator = 0;
            playTone(state, 500, 0.025, 'sine', 0.016);
            return true;
        }
    }
    if (!collides(state.board, state.active, 0, -1, rotated)) {
        state.active.matrix = rotated;
        state.active.y -= 1;
        state.lockAccumulator = 0;
        return true;
    }
    return false;
}

function softDrop(state) {
    if (!canControl(state)) return false;
    if (movePiece(state, 0, 1)) {
        state.score += 1;
        return true;
    }
    return false;
}

function hardDrop(container, state) {
    if (!canControl(state)) return;
    let distance = 0;
    while (!collides(state.board, state.active, 0, distance + 1)) distance += 1;
    state.active.y += distance;
    state.score += distance * 2;
    playTone(state, 170, 0.055, 'square', 0.02);
    lockPiece(container, state);
}

function holdPiece(container, state) {
    if (!canControl(state) || !state.canHold) return;
    const outgoing = state.active.type;
    const incoming = state.hold;
    state.hold = outgoing;
    state.canHold = false;
    state.active = incoming ? createPiece(incoming) : null;
    if (!incoming) {
        fillQueue(state);
        state.active = createPiece(state.queue.shift());
        fillQueue(state);
    }
    if (collides(state.board, state.active)) {
        finishGame(container, state);
        return;
    }
    playTone(state, 410, 0.05, 'triangle', 0.018);
    updateHud(container, state);
}

function canControl(state) {
    return state.phase === 'playing' && !state.paused && Boolean(state.active);
}

function gameLoop(container, state, time) {
    if (!container.isConnected || state.phase === 'menu') return;
    const delta = state.lastTime ? Math.min(80, time - state.lastTime) : 0;
    state.lastTime = time;

    if (state.phase === 'playing' && !state.paused && state.active) {
        state.dropAccumulator += delta;
        if (state.dropAccumulator >= getDropInterval(state.level)) {
            state.dropAccumulator = 0;
            if (!movePiece(state, 0, 1)) state.lockAccumulator += delta;
        }

        if (collides(state.board, state.active, 0, 1)) {
            state.lockAccumulator += delta;
            if (state.lockAccumulator >= LOCK_DELAY) lockPiece(container, state);
        } else {
            state.lockAccumulator = 0;
        }
    }

    drawAll(container, state);
    if (state.phase !== 'gameover') {
        state.animationFrame = window.requestAnimationFrame(nextTime => gameLoop(container, state, nextTime));
    }
}

function lockPiece(container, state) {
    if (!state.active || state.phase !== 'playing') return;
    let aboveTop = false;
    state.active.matrix.forEach((row, matrixY) => {
        row.forEach((filled, matrixX) => {
            if (!filled) return;
            const boardY = state.active.y + matrixY;
            const boardX = state.active.x + matrixX;
            if (boardY < 0) aboveTop = true;
            else state.board[boardY][boardX] = state.active.type;
        });
    });
    if (aboveTop) {
        finishGame(container, state);
        return;
    }

    const fullRows = state.board
        .map((row, index) => row.every(Boolean) ? index : -1)
        .filter(index => index >= 0);
    state.active = null;

    if (fullRows.length) {
        state.phase = 'clearing';
        state.clearingRows = fullRows;
        playLineTone(state, fullRows.length);
        state.clearTimer = window.setTimeout(() => finishLineClear(container, state, fullRows), 170);
        return;
    }

    state.combo = -1;
    if (!spawnPiece(state)) finishGame(container, state);
    updateHud(container, state);
}

function finishLineClear(container, state, rows) {
    [...rows].sort((a, b) => b - a).forEach(row => {
        state.board.splice(row, 1);
        state.board.unshift(Array(COLS).fill(''));
    });
    state.combo += 1;
    const lineScore = SCORE_TABLE[Math.min(4, rows.length)] * Math.max(1, state.level);
    const comboScore = state.combo > 0 ? state.combo * 50 * Math.max(1, state.level) : 0;
    state.score += lineScore + comboScore;
    state.lines += rows.length;
    state.level = state.challengeLevel + Math.floor(state.lines / 10);
    state.clearingRows = [];
    state.phase = 'playing';

    if (!state.challengeComplete && state.lines >= state.objective) {
        state.challengeComplete = true;
        unlockNextLevel('blocchi', state.challengeLevel);
        showToast(container, `SFIDA ${state.challengeLevel} COMPLETATA · LIVELLO SUCCESSIVO SBLOCCATO`);
        playSuccessTone(state);
    } else {
        showToast(container, rows.length === 4 ? 'QUATTRO RIGHE · SIGILLO PERFETTO' : `${rows.length} ${rows.length === 1 ? 'RIGA' : 'RIGHE'} COMPLETE`);
    }

    if (!spawnPiece(state)) finishGame(container, state);
    updateHud(container, state);
}

function finishGame(container, state) {
    state.phase = 'gameover';
    state.paused = false;
    state.active = null;
    state.highScore = Math.max(state.highScore, state.score);
    saveLocalState({ highScore: state.highScore, soundOn: state.soundOn });
    updateHud(container, state);
    playTone(state, 110, 0.28, 'sawtooth', 0.025);

    const overlay = container.querySelector('#blocks-overlay');
    overlay.hidden = false;
    overlay.dataset.mode = 'gameover';
    container.querySelector('#blocks-overlay-eyebrow').textContent = state.challengeComplete ? 'SFIDA COMPLETATA' : 'TORRE SPEZZATA';
    container.querySelector('#blocks-overlay-title').textContent = state.challengeComplete ? 'IL SIGILLO RESISTE' : 'FINE PARTITA';
    container.querySelector('#blocks-overlay-copy').textContent = state.challengeComplete
        ? 'Hai sbloccato la sfida successiva. Puoi migliorare ancora il punteggio.'
        : 'I blocchi hanno raggiunto la sommità. Riprova con un nuovo incastro.';
    const stats = container.querySelector('#blocks-final-stats');
    stats.hidden = false;
    stats.innerHTML = `
        <span><small>PUNTI</small><strong>${state.score.toLocaleString('it-IT')}</strong></span>
        <span><small>RIGHE</small><strong>${state.lines}</strong></span>
        <span><small>LIVELLO</small><strong>${state.level}</strong></span>
    `;
    container.querySelector('#blocks-resume').hidden = true;
    container.querySelector('#blocks-play-again').hidden = false;
    container.querySelector('#blocks-levels').hidden = false;
}

function togglePause(container, state, force) {
    if (state.phase !== 'playing') return;
    state.paused = typeof force === 'boolean' ? force : !state.paused;
    state.lastTime = 0;
    const overlay = container.querySelector('#blocks-overlay');
    if (!state.paused) {
        hideOverlay(container);
        return;
    }
    overlay.hidden = false;
    overlay.dataset.mode = 'pause';
    container.querySelector('#blocks-overlay-eyebrow').textContent = 'PAUSA';
    container.querySelector('#blocks-overlay-title').textContent = 'FIATO SOSPESO';
    container.querySelector('#blocks-overlay-copy').textContent = 'La caduta è ferma. Riprendi quando sei pronto.';
    container.querySelector('#blocks-final-stats').hidden = true;
    container.querySelector('#blocks-resume').hidden = false;
    container.querySelector('#blocks-play-again').hidden = true;
    container.querySelector('#blocks-levels').hidden = false;
}

function hideOverlay(container) {
    const overlay = container.querySelector('#blocks-overlay');
    if (overlay) overlay.hidden = true;
}

function bindControls(container, state) {
    const perform = action => {
        if (action === 'left') movePiece(state, -1);
        if (action === 'right') movePiece(state, 1);
        if (action === 'down') softDrop(state);
        if (action === 'rotate') rotatePiece(state, 1);
        if (action === 'rotate-left') rotatePiece(state, -1);
        if (action === 'drop') hardDrop(container, state);
        if (action === 'hold') holdPiece(container, state);
        updateHud(container, state);
        drawAll(container, state);
    };

    const keyHandler = event => {
        const key = event.key.toLowerCase();
        const action = {
            arrowleft: 'left',
            arrowright: 'right',
            arrowdown: 'down',
            arrowup: 'rotate',
            x: 'rotate',
            z: 'rotate-left',
            c: 'hold',
            shift: 'hold',
            ' ': 'drop'
        }[key];
        if (action) {
            event.preventDefault();
            if (event.repeat && !['left', 'right', 'down'].includes(action)) return;
            perform(action);
        }
        if ((key === 'p' || key === 'escape') && state.phase !== 'menu') {
            event.preventDefault();
            togglePause(container, state);
        }
    };
    window.addEventListener('keydown', keyHandler, { passive: false });
    state.cleanup.push(() => window.removeEventListener('keydown', keyHandler));

    const visibilityHandler = () => {
        if (document.hidden && state.phase === 'playing' && !state.paused) togglePause(container, state, true);
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    state.cleanup.push(() => document.removeEventListener('visibilitychange', visibilityHandler));

    container.querySelectorAll('[data-block-action]').forEach(button => {
        const action = button.dataset.blockAction;
        if (['left', 'right', 'down'].includes(action)) {
            let delayTimer = 0;
            let repeatTimer = 0;
            const stop = () => {
                window.clearTimeout(delayTimer);
                window.clearInterval(repeatTimer);
            };
            button.addEventListener('pointerdown', event => {
                event.preventDefault();
                perform(action);
                delayTimer = window.setTimeout(() => {
                    repeatTimer = window.setInterval(() => perform(action), action === 'down' ? 45 : 70);
                }, 180);
            });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => button.addEventListener(type, stop));
            state.cleanup.push(stop);
        } else {
            button.onclick = () => perform(action);
        }
    });
}

function updateHud(container, state) {
    const setText = (selector, value) => {
        const element = container.querySelector(selector);
        if (element) element.textContent = value;
    };
    state.highScore = Math.max(state.highScore, state.score);
    setText('#blocks-score', state.score.toLocaleString('it-IT'));
    setText('#blocks-high-score', state.highScore.toLocaleString('it-IT'));
    setText('#blocks-lines', state.lines);
    setText('#blocks-combo', state.combo > 0 ? `×${state.combo + 1}` : '—');
    setText('#blocks-level-copy', `LIVELLO ${state.level}`);
    setText('#blocks-objective-copy', `${Math.min(state.lines, state.objective)} / ${state.objective} RIGHE`);
    setText('#blocks-status', state.paused ? 'PAUSA' : (state.challengeComplete ? 'SFIDA COMPLETATA' : `${getDropInterval(state.level)} ms`));
    const fill = container.querySelector('#blocks-objective-fill');
    if (fill) fill.style.width = `${Math.min(100, (state.lines / state.objective) * 100)}%`;
    const pause = container.querySelector('#blocks-pause');
    if (pause) pause.textContent = state.paused ? '▶' : 'Ⅱ';
    drawPreview(container.querySelector('#blocks-hold'), state.hold);
    container.querySelectorAll('[data-next-piece]').forEach(canvas => {
        drawPreview(canvas, state.queue[Number(canvas.dataset.nextPiece)]);
    });
}

function drawAll(container, state) {
    const canvas = container.querySelector('#blocks-board');
    if (!canvas) return;
    const width = Math.max(1, Math.round(canvas.clientWidth || 300));
    const height = Math.max(1, Math.round(canvas.clientHeight || 600));
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const cell = width / COLS;

    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#10091d');
    gradient.addColorStop(1, '#07040d');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(214, 168, 255, 0.055)';
    context.lineWidth = 1;
    for (let col = 0; col <= COLS; col += 1) {
        context.beginPath();
        context.moveTo(Math.round(col * cell) + 0.5, 0);
        context.lineTo(Math.round(col * cell) + 0.5, height);
        context.stroke();
    }
    for (let row = 0; row <= ROWS; row += 1) {
        context.beginPath();
        context.moveTo(0, Math.round(row * cell) + 0.5);
        context.lineTo(width, Math.round(row * cell) + 0.5);
        context.stroke();
    }

    state.board.forEach((row, y) => row.forEach((type, x) => {
        if (type) drawCell(context, x, y, cell, type, state.clearingRows.includes(y) ? 0.28 : 1);
    }));

    if (state.active) {
        let ghostY = state.active.y;
        while (!collides(state.board, state.active, 0, ghostY - state.active.y + 1)) ghostY += 1;
        drawPiece(context, { ...state.active, y: ghostY }, cell, 0.17, true);
        drawPiece(context, state.active, cell, 1, false);
    }

    context.strokeStyle = 'rgba(199, 125, 255, 0.24)';
    context.lineWidth = 2;
    context.strokeRect(1, 1, width - 2, height - 2);
}

function drawPiece(context, piece, cell, alpha = 1, outline = false) {
    piece.matrix.forEach((row, matrixY) => row.forEach((filled, matrixX) => {
        if (!filled || piece.y + matrixY < 0) return;
        drawCell(context, piece.x + matrixX, piece.y + matrixY, cell, piece.type, alpha, outline);
    }));
}

function drawCell(context, x, y, size, type, alpha = 1, outline = false) {
    const inset = Math.max(1.5, size * 0.055);
    const px = x * size + inset;
    const py = y * size + inset;
    const dimension = size - inset * 2;
    context.save();
    context.globalAlpha = alpha;
    if (outline) {
        context.strokeStyle = PIECES[type].color;
        context.lineWidth = Math.max(1.2, size * 0.07);
        context.strokeRect(px + 1, py + 1, dimension - 2, dimension - 2);
        context.restore();
        return;
    }
    const gradient = context.createLinearGradient(px, py, px + dimension, py + dimension);
    gradient.addColorStop(0, PIECES[type].color);
    gradient.addColorStop(1, shadeColor(PIECES[type].color, -38));
    context.fillStyle = gradient;
    context.shadowColor = PIECES[type].color;
    context.shadowBlur = size * 0.13;
    context.fillRect(px, py, dimension, dimension);
    context.shadowBlur = 0;
    context.fillStyle = 'rgba(255,255,255,0.22)';
    context.fillRect(px + size * 0.08, py + size * 0.08, dimension - size * 0.16, Math.max(1, size * 0.08));
    context.fillStyle = 'rgba(0,0,0,0.16)';
    context.fillRect(px + size * 0.08, py + dimension - size * 0.13, dimension - size * 0.16, Math.max(1, size * 0.06));
    context.restore();
}

function drawPreview(canvas, type) {
    if (!canvas) return;
    const width = canvas.clientWidth || Number(canvas.getAttribute('width')) || 84;
    const height = canvas.clientHeight || Number(canvas.getAttribute('height')) || 68;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (!type || !PIECES[type]) return;
    const matrix = PIECES[type].matrix;
    const occupied = [];
    matrix.forEach((row, y) => row.forEach((filled, x) => { if (filled) occupied.push({ x, y }); }));
    const minX = Math.min(...occupied.map(cell => cell.x));
    const maxX = Math.max(...occupied.map(cell => cell.x));
    const minY = Math.min(...occupied.map(cell => cell.y));
    const maxY = Math.max(...occupied.map(cell => cell.y));
    const pieceWidth = maxX - minX + 1;
    const pieceHeight = maxY - minY + 1;
    const cellSize = Math.min(width / (pieceWidth + 1), height / (pieceHeight + 1));
    const offsetX = (width - pieceWidth * cellSize) / 2 - minX * cellSize;
    const offsetY = (height - pieceHeight * cellSize) / 2 - minY * cellSize;
    occupied.forEach(cell => drawCell(context, (offsetX / cellSize) + cell.x, (offsetY / cellSize) + cell.y, cellSize, type));
}

function shadeColor(hex, amount) {
    const value = parseInt(hex.slice(1), 16);
    const red = clamp((value >> 16) + amount, 0, 255);
    const green = clamp(((value >> 8) & 0xff) + amount, 0, 255);
    const blue = clamp((value & 0xff) + amount, 0, 255);
    return `rgb(${red}, ${green}, ${blue})`;
}

function showToast(container, message) {
    const toast = container.querySelector('#blocks-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('is-visible');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    window.setTimeout(() => toast.classList.remove('is-visible'), 1900);
}

function playTone(state, frequency, duration = 0.05, type = 'sine', volume = 0.02) {
    if (!state.soundOn) return;
    try {
        state.audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = state.audioContext.createOscillator();
        const gain = state.audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, state.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, state.audioContext.currentTime + duration);
        oscillator.connect(gain).connect(state.audioContext.destination);
        oscillator.start();
        oscillator.stop(state.audioContext.currentTime + duration);
    } catch { /* audio non essenziale */ }
}

function playLineTone(state, count) {
    [0, 1, 2].forEach((step, index) => {
        window.setTimeout(() => playTone(state, 420 + count * 90 + step * 70, 0.07, 'triangle', 0.024), index * 55);
    });
}

function playSuccessTone(state) {
    [520, 660, 820].forEach((frequency, index) => {
        window.setTimeout(() => playTone(state, frequency, 0.11, 'sine', 0.026), index * 90);
    });
}

async function quitGame(container, state) {
    window.cancelAnimationFrame(state.animationFrame);
    window.clearTimeout(state.clearTimer);
    state.cleanup.forEach(cleanup => cleanup());
    state.cleanup = [];
    try { await state.audioContext?.close(); } catch { /* nessuna azione */ }
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = '';
    saveLocalState({ highScore: state.highScore, soundOn: state.soundOn });
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container, { filter: 'strategy' });
    } catch {
        window.location.reload();
    }
}
