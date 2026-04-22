import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: STRATEGY MASTER (Chess & Checkers)
// Versione 2.6 - Full Responsive & Global CSS Control
// ==========================================

export function initScacchi(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    // BLOCCO SCROLL GLOBALE
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#05010a';

    let state = {
        gameMode: 'chess',
        difficulty: 2,
        board: [],
        turn: 'w',
        selected: null,
        lastMove: null,
        isAnimating: false
    };

    renderSetupMenu(container, state);
}

const quitGame = async (container) => {
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        window.location.reload();
    }
};

// --- 1. MENU DI CONFIGURAZIONE ---
function renderSetupMenu(container, state) {
    container.innerHTML = `
        <div class="game-master-wrapper">
            <div class="game-setup-overlay">
                <img src="/assets/logo.png" class="game-setup-logo">
                <h1 class="main-title">STRATEGY</h1>
                <p class="game-setup-subtitle">Chess & Checkers</p>
                
                <div class="game-setup-card">
                    <div class="game-mode-toggle">
                        <button class="game-mode-btn ${state.gameMode === 'chess' ? 'active' : ''}" id="btn-chess">SCACCHI</button>
                        <button class="game-mode-btn ${state.gameMode === 'checkers' ? 'active' : ''}" id="btn-checkers">DAMA</button>
                    </div>

                    <div class="game-difficulty-grid">
                        <button class="game-difficulty-btn ${state.difficulty === 1 ? 'active' : ''}" data-diff="1">EASY</button>
                        <button class="game-difficulty-btn ${state.difficulty === 2 ? 'active' : ''}" data-diff="2">NORMAL</button>
                        <button class="game-difficulty-btn ${state.difficulty === 3 ? 'active' : ''}" data-diff="3">HARD</button>
                    </div>

                    <button class="btn-primary game-start-btn" id="start-game">GIOCA ORA</button>
                </div>

                <button class="btn-back-glass" id="btn-quit-setup">← TORNA INDIETRO</button>
            </div>
        </div>
    `;

    container.querySelector('#btn-quit-setup').onclick = (e) => {
        e.preventDefault();
        quitGame(container);
    };

    container.querySelector('#btn-chess').onclick = () => {
        state.gameMode = 'chess';
        renderSetupMenu(container, state);
    };

    container.querySelector('#btn-checkers').onclick = () => {
        state.gameMode = 'checkers';
        renderSetupMenu(container, state);
    };

    container.querySelectorAll('.game-difficulty-btn').forEach(btn => {
        btn.onclick = () => {
            state.difficulty = parseInt(btn.dataset.diff);
            renderSetupMenu(container, state);
        };
    });

    container.querySelector('#start-game').onclick = () => startGame(container, state);
}

// --- 2. AVVIO GIOCO ---
function startGame(container, state) {
    state.board = state.gameMode === 'chess' ? createChessBoard() : createCheckersBoard();
    state.turn = 'w';
    state.selected = null;
    renderBoard(container, state);
}

function createChessBoard() {
    const layout = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    let board = Array(8).fill(null).map(() => Array(8).fill(null));

    for (let i = 0; i < 8; i++) {
        board[i] = { type: layout[i], color: 'b' };
        board[i] = { type: 'P', color: 'b' };
        board[i] = { type: 'P', color: 'w' };
        board[i] = { type: layout[i], color: 'w' };
    }
    return board;
}

function createCheckersBoard() {
    let board = Array(8).fill(null).map(() => Array(8).fill(null));

    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 !== 0) board[r] [c] = { type: 'D', color: 'b' };
        }
    }

    for (let r = 5; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 !== 0) board[r] [c] = { type: 'D', color: 'w' };
        }
    }
    return board;
}

// --- 3. RENDER SCACCHIERA ---
function renderBoard(container, state) {
    const chessPieces = {
        'wP': '♙', 'wR': '♖', 'wN': '♘', 'wB': '♗', 'wQ': '♕', 'wK': '♔',
        'bP': '♟', 'bR': '♜', 'bN': '♞', 'bB': '♝', 'bQ': '♛', 'bK': '♚'
    };

    let boardHTML = `
        <div class="game-master-wrapper">
            <div class="game-master-header">
                <span class="game-title-small">${state.gameMode.toUpperCase()}</span>
                <div class="game-turn-indicator ${state.turn === 'w' ? 'white-turn' : 'black-turn'}">
                    ${state.turn === 'w' ? 'TUO TURNO' : 'IA...'}
                </div>
                <button class="btn-back-glass game-exit-btn" id="btn-reset">← ESCI</button>
            </div>

            <div class="game-board-container">
                <div class="game-chess-board" id="board-ui">
    `;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const isLight = (r + c) % 2 === 0;
            const piece = state.board[r] [c];
            const isSelected = state.selected && state.selected.r === r && state.selected.c === c;

            boardHTML += `
                <div class="game-chess-square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''}" 
                     data-row="${r}" data-col="${c}">
                    ${piece ? `<span class="game-chess-piece">${chessPieces[piece.color + piece.type]}</span>` : ''}
                </div>
            `;
        }
    }

    boardHTML += `
                </div>
            </div>
        </div>
    `;

    container.innerHTML = boardHTML;

    const squares = container.querySelectorAll('.game-chess-square');
    squares.forEach(sq => {
        sq.onclick = (e) => {
            e.preventDefault();
            const r = parseInt(sq.dataset.row);
            const c = parseInt(sq.dataset.col);
            handleSquareClick(r, c, state, container);
        };
    });

    container.querySelector('#btn-reset').onclick = () => renderSetupMenu(container, state);
}

function handleSquareClick(r, c, state, container) {
    if (state.turn !== 'w' || state.isAnimating) return;

    const piece = state.board[r] [c];

    if (state.selected) {
        if (state.selected.r === r && state.selected.c === c) {
            state.selected = null;
        } else {
            state.board[r] [c] = state.board[state.selected.r] [state.selected.c];
            state.board[state.selected.r] [state.selected.c] = null;
            state.turn = 'b';
            state.selected = null;
            setTimeout(() => aiMove(state, container), 600);
        }
        renderBoard(container, state);
    } else if (piece && piece.color === 'w') {
        state.selected = { r, c };
        renderBoard(container, state);
    }
}

function aiMove(state, container) {
    state.isAnimating = true;
    let moves = [];

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (state.board[r] [c]?.color === 'b') {
                moves.push({ fr: r, fc: c, tr: r + 1, tc: c });
            }
        }
    }

    if (moves.length > 0) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        if (m.tr < 8) {
            state.board[m.tr] [m.tc] = state.board[m.fr] [m.fc];
            state.board[m.fr] [m.fc] = null;
        }
    }

    state.turn = 'w';
    state.isAnimating = false;
    renderBoard(container, state);
}