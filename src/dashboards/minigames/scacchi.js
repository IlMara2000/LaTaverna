import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: STRATEGY MASTER (Chess & Checkers)
// Versione Stabile 2.5 - Full Responsive & High Visibility
// ==========================================

export function initScacchi(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    // BLOCCO SCROLL GLOBALE PER IL GIOCO
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
        lastMove: null, // Per evidenziare l'ultima mossa dell'IA
        isAnimating: false
    };

    renderSetupMenu(container, state);
}

// --- Funzione centralizzata per uscire in sicurezza ---
const quitGame = async (container) => {
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        window.location.reload(); 
    }
};

// --- 1. MENU DI CONFIGURAZIONE (FULL-SCREEN PREMIUM) ---
function renderSetupMenu(container, state) {
    container.innerHTML = `
    <style>
        @keyframes fadeInUpOnly {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .strategy-master-wrapper { 
            width: 100%; height: 100dvh; 
            background: radial-gradient(circle at center, #1a0b2e 0%, #05010a 100%); 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            color: white; font-family: 'Poppins', sans-serif; padding: 20px; box-sizing: border-box;
            animation: fadeInUpOnly 0.6s ease-out forwards;
        }

        .setup-card-premium { 
            background: rgba(255,255,255,0.03); backdrop-filter: blur(15px);
            padding: 40px 30px; border-radius: 32px; border: 1px solid rgba(157,78,221,0.3);
            width: 100%; max-width: 400px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }

        .mode-toggle-premium { display: flex; gap: 10px; margin: 25px 0; background: rgba(0,0,0,0.4); padding: 8px; border-radius: 18px; }
        .mode-btn-p { flex: 1; padding: 15px; border-radius: 12px; border: none; cursor: pointer; background: transparent; color: rgba(255,255,255,0.4); font-weight: 800; font-size: 14px; transition: 0.3s; }
        .mode-btn-p.active { background: var(--accent-gradient); color: white; box-shadow: 0 4px 15px var(--amethyst-glow); }

        .diff-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 30px; }
        .diff-btn-p { padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; font-size: 11px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .diff-btn-p.active { background: rgba(157,78,221,0.3); border-color: #9d4ede; box-shadow: 0 0 15px var(--amethyst-glow); }

        .btn-start-master { width: 100%; padding: 18px; border-radius: 16px; border: none; background: #00ffa3; color: #000; font-weight: 900; font-size: 1.2rem; cursor: pointer; transition: 0.3s; }
        .btn-start-master:active { transform: scale(0.95); }
    </style>

    <div class="strategy-master-wrapper">
        <div class="setup-card-premium">
            <img src="/assets/logo.png" style="width: 80px; margin-bottom: 20px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 2.5rem; margin-bottom: 5px;">STRATEGY</h1>
            <p style="opacity:0.5; font-size:12px; letter-spacing: 2px;">CHESS & CHECKERS</p>
            
            <div class="mode-toggle-premium">
                <button class="mode-btn-p ${state.gameMode === 'chess' ? 'active' : ''}" id="p-chess">SCACCHI</button>
                <button class="mode-btn-p ${state.gameMode === 'checkers' ? 'active' : ''}" id="p-checkers">DAMA</button>
            </div>
            
            <div class="diff-grid">
                <button class="diff-btn-p ${state.difficulty === 1 ? 'active' : ''}" data-d="1">EASY</button>
                <button class="diff-btn-p ${state.difficulty === 2 ? 'active' : ''}" data-d="2">NORMAL</button>
                <button class="diff-btn-p ${state.difficulty === 3 ? 'active' : ''}" data-d="3">HARD</button>
            </div>
            
            <button class="btn-start-master" id="begin-btn">GIOCA ORA</button>
        </div>
        <button id="exit-setup" class="btn-back-glass" style="margin-top: 25px; width: 100%; max-width: 400px;">← TORNA INDIETRO</button>
    </div>
    `;

    // Listeners Menu
    container.querySelector('#exit-setup').onclick = () => quitGame(container);
    container.querySelector('#p-chess').onclick = () => { state.gameMode = 'chess'; renderSetupMenu(container, state); };
    container.querySelector('#p-checkers').onclick = () => { state.gameMode = 'checkers'; renderSetupMenu(container, state); };
    container.querySelectorAll('.diff-btn-p').forEach(b => {
        b.onclick = () => { state.difficulty = parseInt(b.dataset.d); renderSetupMenu(container, state); };
    });
    container.querySelector('#begin-btn').onclick = () => startGame(container, state);
}

// --- 2. LOGICA INIZIALIZZAZIONE ---
function startGame(container, state) {
    state.board = state.gameMode === 'chess' ? createChessBoard() : createCheckersBoard();
    state.turn = 'w';
    state.selected = null;
    state.lastMove = null;
    renderBoard(container, state);
}

function createChessBoard() {
    const layout = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    let board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let i = 0; i < 8; i++) {
        board[0][i] = { type: layout[i], color: 'b' };
        board[1][i] = { type: 'P', color: 'b' };
        board[6][i] = { type: 'P', color: 'w' };
        board[7][i] = { type: layout[i], color: 'w' };
    }
    return board;
}

function createCheckersBoard() {
    let board = Array(8).fill(null).map(() => Array(8).fill(null));
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) if ((r + c) % 2 !== 0) board[r][c] = { type: 'D', color: 'b' };
    }
    for (let r = 5; r < 8; r++) {
        for (let c = 0; c < 8; c++) if ((r + c) % 2 !== 0) board[r][c] = { type: 'D', color: 'w' };
    }
    return board;
}

// --- 3. RENDERING SCACCHIERA (FULL RESPONSIVE) ---
function renderBoard(container, state) {
    const chessPieces = {
        'wP': '♙', 'wR': '♖', 'wN': '♘', 'wB': '♗', 'wQ': '♕', 'wK': '♔',
        'bP': '♟', 'bR': '♜', 'bN': '♞', 'bB': '♝', 'bQ': '♛', 'bK': '♚'
    };

    container.innerHTML = `
    <style>
        .game-master-screen { 
            width: 100%; height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: #05010a; position: relative; overflow: hidden;
        }

        /* SCACCHIERA RESPONSIVA: si adatta alla dimensione minore tra altezza e larghezza */
        .master-board { 
            display: grid; grid-template-columns: repeat(8, 1fr); 
            width: min(90vw, 70vh); height: min(90vw, 70vh);
            border: 5px solid rgba(157, 78, 221, 0.3); border-radius: 12px; overflow: hidden;
            box-shadow: 0 0 50px rgba(0,0,0,0.8);
        }

        .sq-m { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: min(8vw, 5vh); cursor: pointer; transition: 0.2s; position: relative; }
        .sq-m.light { background: #d1d9e0; }
        .sq-m.dark { background: #5c7c99; }
        
        /* EFFETTI VISIBILI */
        .sq-m.selected { background: rgba(0, 255, 163, 0.5) !important; box-shadow: inset 0 0 15px #00ffa3; }
        .sq-m.last-move { background: rgba(255, 65, 108, 0.3) !important; }
        
        .piece-m { user-select: none; color: black; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4)); pointer-events: none; }
        .checker-m { width: 80%; height: 80%; border-radius: 50%; box-shadow: 0 4px 0 rgba(0,0,0,0.3); }
        .checker-m.w { background: #fff; border: 2px solid #ccc; }
        .checker-m.b { background: #222; border: 2px solid #000; }

        .game-info-bar { width: min(90vw, 70vh); display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .turn-badge { padding: 10px 20px; border-radius: 50px; font-weight: 900; font-size: 12px; color: #000; text-transform: uppercase; }
    </style>

    <div class="game-master-screen fade-in">
        <div class="game-info-bar">
            <span style="font-weight:900; letter-spacing:1px; color:#9d4ede;">${state.gameMode.toUpperCase()}</span>
            <div class="turn-badge" style="background: ${state.turn === 'w' ? '#00ffa3' : '#ff416c'}; box-shadow: 0 0 20px ${state.turn === 'w' ? 'rgba(0,255,163,0.4)' : 'rgba(255,65,108,0.4)'};">
                ${state.turn === 'w' ? 'Tuo Turno' : 'IA sta pensando...'}
            </div>
        </div>

        <div class="master-board" id="board-ui"></div>

        <button id="back-menu" class="btn-back-glass" style="margin-top: 30px; width: min(90vw, 70vh);">← TORNA AL MENU</button>
    </div>
    `;

    const boardUI = container.querySelector('#board-ui');
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            sq.className = `sq-m ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            
            const piece = state.board[r][c];
            if (piece) {
                if (state.gameMode === 'chess') sq.innerHTML = `<span class="piece-m">${chessPieces[piece.color + piece.type]}</span>`;
                else sq.innerHTML = `<div class="checker-m ${piece.color}"></div>`;
            }

            // Highlighting
            if (state.selected && state.selected.r === r && state.selected.c === c) sq.classList.add('selected');
            if (state.lastMove && ((state.lastMove.fr === r && state.lastMove.fc === c) || (state.lastMove.tr === r && state.lastMove.tc === c))) {
                sq.classList.add('last-move');
            }

            sq.onclick = () => handleSquareClick(r, c, state, container);
            boardUI.appendChild(sq);
        }
    }
    container.querySelector('#back-menu').onclick = () => renderSetupMenu(container, state);
}

function handleSquareClick(r, c, state, container) {
    if (state.turn !== 'w' || state.isAnimating) return;
    const piece = state.board[r][c];

    if (state.selected) {
        if (state.selected.r === r && state.selected.c === c) {
            state.selected = null;
        } else {
            // Mossa Giocatore
            state.board[r][c] = state.board[state.selected.r][state.selected.c];
            state.board[state.selected.r][state.selected.c] = null;
            state.lastMove = { fr: state.selected.r, fc: state.selected.c, tr: r, tc: c };
            state.turn = 'b';
            state.selected = null;
            setTimeout(() => aiMove(state, container), 800);
        }
        renderBoard(container, state);
    } else if (piece && piece.color === 'w') {
        state.selected = { r, c };
        renderBoard(container, state);
    }
}

function aiMove(state, container) {
    state.isAnimating = true;
    let possibleMoves = [];
    
    // IA Base: Cerca pezzi neri e trova mosse legali (molto semplificato)
    for (let r=0; r<8; r++) {
        for (let c=0; c<8; c++) {
            if (state.board[r][c]?.color === 'b') {
                const targetR = r + 1;
                if (targetR < 8) possibleMoves.push({fr: r, fc: c, tr: targetR, tc: c});
            }
        }
    }

    if (possibleMoves.length > 0) {
        const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        state.board[move.tr][move.tc] = state.board[move.fr][move.fc];
        state.board[move.fr][move.fc] = null;
        state.lastMove = move;
    }

    state.turn = 'w';
    state.isAnimating = false;
    renderBoard(container, state);
}