import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: STRATEGY (Chess & Checkers)
// Versione Stabile 2.1 - Anti-Crash & Premium UI
// ==========================================

export function initScacchi(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    // FIX: Configurazione mobile-friendly aggressiva (Nessuno scroll consentito sulla scacchiera)
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'hidden'; 
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none'; // Previene lo scrolling quando si toccano i pezzi
    document.body.style.position = 'relative';
    document.body.style.backgroundColor = '#090a0f'; 

    let state = {
        gameMode: 'chess', 
        difficulty: 2,
        board: [],
        turn: 'w',
        selected: null,
        isAnimating: false
    };

    renderSetupMenu(container, state);
}

// --- Funzione centralizzata per uscire in sicurezza ---
const quitGame = async (container) => {
    document.body.style.overflowY = 'auto';
    document.body.style.overflowX = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    document.body.style.backgroundColor = '';
    
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        console.error("Errore navigazione:", e);
        window.location.reload(); 
    }
};

// --- 1. MENU DI CONFIGURAZIONE ---
function renderSetupMenu(container, state) {
    container.innerHTML = `
    <style>
        .strategy-wrapper { 
            width: 100%; max-width: 430px; height: 100dvh; margin: 0 auto;
            background: radial-gradient(circle at center, rgba(26,26,46,0.8) 0%, rgba(7,7,10,0.9) 100%); 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            color: white; font-family: 'Poppins', sans-serif; 
            padding: 20px; box-sizing: border-box;
        }
        @media (min-width: 431px) {
            .strategy-wrapper { border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); height: 90dvh; margin-top: 5vh; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        }
        .setup-card { 
            background: rgba(255,255,255,0.03); backdrop-filter: blur(15px);
            padding: 25px; border-radius: 24px; border: 1px solid rgba(157,78,221,0.3);
            width: 100%; text-align: center; box-sizing: border-box;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .mode-toggle { display: flex; gap: 8px; margin: 20px 0; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 12px; }
        .mode-btn { flex: 1; padding: 12px; border-radius: 8px; border: none; cursor: pointer; background: transparent; color: white; font-weight: 600; font-size: 13px; outline: none; transition: 0.3s; }
        .mode-btn.active { background: #9d4ede; box-shadow: 0 4px 15px rgba(157,78,221,0.4); }
        .diff-btn { padding:10px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; font-size:10px; cursor: pointer; outline: none; transition: 0.2s; }
        .diff-btn.active { background:rgba(157,78,221,0.2); border:1px solid #9d4ede; }
    </style>

    <div class="strategy-wrapper fade-in">
        <div class="setup-card">
            <h1 class="main-title" style="margin-bottom: 5px;">STRATEGY</h1>
            <p style="opacity:0.5; font-size:11px; margin-bottom:25px; letter-spacing: 1px;">SFIDA L'INTELLIGENZA ARTIFICIALE</p>
            
            <div class="mode-toggle">
                <button class="mode-btn ${state.gameMode === 'chess' ? 'active' : ''}" id="btn-chess">SCACCHI</button>
                <button class="mode-btn ${state.gameMode === 'checkers' ? 'active' : ''}" id="btn-checkers">DAMA</button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 25px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                    <button class="diff-btn ${state.difficulty === 1 ? 'active' : ''}" data-diff="1">EASY</button>
                    <button class="diff-btn ${state.difficulty === 2 ? 'active' : ''}" data-diff="2">NORMAL</button>
                    <button class="diff-btn ${state.difficulty === 3 ? 'active' : ''}" data-diff="3">HARD</button>
                </div>
            </div>
            
            <button class="btn-primary" id="start-game" style="background: #00ffa3; color: black; border: none; margin-bottom: 0; box-shadow: 0 5px 15px rgba(0, 255, 163, 0.3);">GIOCA ORA</button>
        </div>
        <button id="btn-quit-setup" class="btn-back-glass" style="margin-top: 20px;">← TORNA ALLA LIBRERIA</button>
    </div>
    `;

    container.querySelector('#btn-quit-setup').onclick = (e) => { e.preventDefault(); quitGame(container); };
    container.querySelector('#btn-chess').onclick = () => { state.gameMode = 'chess'; renderSetupMenu(container, state); };
    container.querySelector('#btn-checkers').onclick = () => { state.gameMode = 'checkers'; renderSetupMenu(container, state); };
    
    container.querySelectorAll('.diff-btn').forEach(btn => {
        btn.onclick = () => { state.difficulty = parseInt(btn.dataset.diff); renderSetupMenu(container, state); };
    });

    container.querySelector('#start-game').onclick = () => startGame(container, state);
}

// --- 2. GIOCO ---
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

function renderBoard(container, state) {
    const chessPieces = {
        'wP': '♙', 'wR': '♖', 'wN': '♘', 'wB': '♗', 'wQ': '♕', 'wK': '♔',
        'bP': '♟', 'bR': '♜', 'bN': '♞', 'bB': '♝', 'bQ': '♛', 'bK': '♚'
    };

    container.innerHTML = `
    <style>
        .game-screen { 
            width: 100%; max-width: 430px; height: 100dvh; margin: 0 auto;
            background: rgba(10,10,12,0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;
            box-sizing: border-box; overflow: hidden;
        }
        @media (min-width: 431px) {
            .game-screen { border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); height: 90dvh; margin-top: 5vh; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        }
        .board { 
            display: grid; grid-template-columns: repeat(8, 1fr); 
            width: 92vw; max-width: 390px; height: 92vw; max-height: 390px;
            border: 4px solid rgba(157, 78, 221, 0.3); border-radius: 8px; overflow: hidden;
            box-shadow: 0 0 30px rgba(0,0,0,0.8);
        }
        .sq { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 30px; position: relative; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .sq.light { background: #d1d9e0; }
        .sq.dark { background: #5c7c99; }
        .sq.selected { background: rgba(157, 78, 221, 0.5) !important; box-shadow: inset 0 0 10px rgba(255,255,255,0.5); }
        .piece { user-select: none; color: black; pointer-events: none; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); }
        .checker { width: 75%; height: 75%; border-radius: 50%; border: 2px solid rgba(0,0,0,0.2); }
        .checker.w { background: #fff; box-shadow: 0 3px 0 #ccc; }
        .checker.b { background: #222; box-shadow: 0 3px 0 #000; }
        
        .game-header { width: 100%; padding: 20px; display: flex; justify-content: space-between; align-items: center; position: absolute; top: env(safe-area-inset-top, 10px); box-sizing: border-box; }
        .status-badge { padding: 8px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; color: #000; transition: 0.3s; }
        
        #btn-reset-container { position: absolute; bottom: calc(25px + env(safe-area-inset-bottom)); width: 100%; padding: 0 20px; box-sizing: border-box; }
    </style>

    <div class="game-screen fade-in">
        <div class="game-header">
            <span style="font-weight:900; font-size:16px; letter-spacing: 1px; font-family:'Montserrat', sans-serif;">${state.gameMode.toUpperCase()}</span>
            <div class="status-badge" style="background: ${state.turn === 'w' ? '#00ffa3' : '#ff416c'}; box-shadow: 0 0 15px ${state.turn === 'w' ? 'rgba(0,255,163,0.3)' : 'rgba(255,65,108,0.3)'};">
                ${state.turn === 'w' ? 'TUO TURNO' : 'IA...'}
            </div>
        </div>
        
        <div class="board" id="board-ui"></div>
        
        <div id="btn-reset-container">
            <button id="btn-reset" class="btn-back-glass" style="margin-bottom: 0;">← TORNA AL MENU</button>
        </div>
    </div>
    `;

    const boardUI = container.querySelector('#board-ui');
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('div');
            square.className = `sq ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            const piece = state.board[r][c];
            if (piece) {
                if (state.gameMode === 'chess') square.innerHTML = `<span class="piece">${chessPieces[piece.color + piece.type]}</span>`;
                else square.innerHTML = `<div class="checker ${piece.color}"></div>`;
            }
            if (state.selected && state.selected.r === r && state.selected.c === c) square.classList.add('selected');
            square.onclick = (e) => { e.preventDefault(); handleSquareClick(r, c, state, container); };
            boardUI.appendChild(square);
        }
    }
    container.querySelector('#btn-reset').onclick = () => renderSetupMenu(container, state);
}

function handleSquareClick(r, c, state, container) {
    if (state.turn !== 'w' || state.isAnimating) return;
    const piece = state.board[r][c];
    if (state.selected) {
        if (state.selected.r === r && state.selected.c === c) state.selected = null;
        else {
            state.board[r][c] = state.board[state.selected.r][state.selected.c];
            state.board[state.selected.r][state.selected.c] = null;
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
    for (let r=0; r<8; r++) {
        for (let c=0; c<8; c++) {
            if (state.board[r][c]?.color === 'b') {
                if (r + 1 < 8) moves.push({fr: r, fc: c, tr: r+1, tc: c});
            }
        }
    }
    if (moves.length > 0) {
        const m = moves[Math.floor(Math.random() * moves.length)];
        state.board[m.tr][m.tc] = state.board[m.fr][m.fc];
        state.board[m.fr][m.fc] = null;
    }
    state.turn = 'w';
    state.isAnimating = false;
    renderBoard(container, state);
}
