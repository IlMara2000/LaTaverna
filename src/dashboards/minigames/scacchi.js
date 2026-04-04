import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: STRATEGY (Chess & Checkers)
// Versione Mobile-First ottimizzata
// ==========================================

export function initScacchi(container) {
    updateSidebarContext("minigames");

    // Configurazione fissa per Mobile: previene rimbalzi e scroll di sistema
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#090a0f'; // Sfondo solido 

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
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.backgroundColor = '';
    
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        window.location.hash = "lobby"; 
    }
};

// --- 1. MENU DI CONFIGURAZIONE ---
function renderSetupMenu(container, state) {
    container.innerHTML = `
    <style>
        /* Wrapper integrato per uniformità visiva */
        .strategy-wrapper { 
            width: 100%; max-width: 430px; height: 100dvh; margin: 0 auto;
            background: radial-gradient(circle at center, rgba(26,26,46,0.8) 0%, rgba(7,7,10,0.9) 100%); 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            color: white; font-family: 'Poppins', sans-serif; 
            padding: calc(20px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom)) 20px;
            animation: cardEntrance 0.5s ease-out forwards;
            box-sizing: border-box;
        }

        @media (min-width: 431px) {
            .strategy-wrapper { border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); height: 90dvh; margin-top: 5vh; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        }

        .setup-card { 
            background: rgba(255,255,255,0.03); backdrop-filter: blur(15px);
            padding: 25px; border-radius: 24px; border: 1px solid rgba(157,78,221,0.3);
            width: 100%; text-align: center;
        }
        .mode-toggle { display: flex; gap: 8px; margin: 20px 0; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 12px; }
        .mode-btn { flex: 1; padding: 12px; border-radius: 8px; border: none; cursor: pointer; background: transparent; color: white; font-weight: 600; font-size: 13px; -webkit-tap-highlight-color: transparent; transition: 0.3s; outline: none; }
        .mode-btn.active { background: #9d4ede; box-shadow: 0 4px 15px rgba(157,78,221,0.4); }
        
        .diff-btn { padding:10px; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:white; font-size:10px; cursor: pointer; -webkit-tap-highlight-color: transparent; outline: none; transition: 0.2s; }
        .diff-btn.active { background:rgba(157,78,221,0.2); border:1px solid #9d4ede; }

        .start-btn { width: 100%; padding: 16px; border-radius: 14px; border: none; background: #00ffa3; color: #000; font-weight: 900; font-size: 1.1rem; cursor: pointer; margin-top: 20px; -webkit-tap-highlight-color: transparent; outline: none; box-shadow: 0 4px 15px rgba(0,255,163,0.3); }
        .start-btn:active { transform: scale(0.95); }
    </style>

    <div class="strategy-wrapper">
        <div class="setup-card">
            <h1 style="font-family:'Montserrat'; font-weight:900; letter-spacing:2px; margin-bottom:5px;">STRATEGY</h1>
            <p style="opacity:0.5; font-size:11px; margin-bottom:25px;">Scegli la tua sfida</p>
            
            <div class="mode-toggle">
                <button class="mode-btn ${state.gameMode === 'chess' ? 'active' : ''}" id="btn-chess">SCACCHI</button>
                <button class="mode-btn ${state.gameMode === 'checkers' ? 'active' : ''}" id="btn-checkers">DAMA</button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                <p style="text-align: left; font-size: 11px; opacity: 0.6; margin: 0;">Difficoltà IA:</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                    <button class="diff-btn ${state.difficulty === 1 ? 'active' : ''}" data-diff="1">EASY</button>
                    <button class="diff-btn ${state.difficulty === 2 ? 'active' : ''}" data-diff="2">NORMAL</button>
                    <button class="diff-btn ${state.difficulty === 3 ? 'active' : ''}" data-diff="3">HARD</button>
                </div>
            </div>

            <button class="start-btn" id="start-game">GIOCA ORA</button>
        </div>
        
        <button id="btn-quit-setup" style="margin-top: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px; border-radius: 14px; font-weight: 800; font-size: 12px; cursor: pointer; -webkit-tap-highlight-color: transparent; outline: none; width: 100%; max-width: 250px;">← ESCI DAL GIOCO</button>
    </div>
    `;

    // FIX: Ora usa quitGame()
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
    container.querySelectorAll('.diff-btn').forEach(btn => {
        btn.onclick = () => {
            state.difficulty = parseInt(btn.dataset.diff);
            renderSetupMenu(container, state);
        };
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
            animation: cardEntrance 0.4s ease-out forwards;
            box-sizing: border-box;
        }

        @media (min-width: 431px) {
            .game-screen { border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); height: 90dvh; margin-top: 5vh; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        }

        .board { 
            display: grid; grid-template-columns: repeat(8, 1fr); 
            width: 95vw; max-width: 400px; height: 95vw; max-height: 400px;
            border: 2px solid rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
        .sq { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 32px; position: relative; -webkit-tap-highlight-color: transparent; cursor: pointer; outline: none; }
        .sq.light { background: #d1d9e0; }
        .sq.dark { background: #5c7c99; }
        .sq.selected { background: #f6f669 !important; }
        
        .piece { user-select: none; z-index: 5; color: black; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: none; text-shadow: 0 1px 2px rgba(255,255,255,0.5); }
        
        .checker { width: 75%; height: 75%; border-radius: 50%; border: 2px solid rgba(0,0,0,0.2); pointer-events: none; }
        .checker.w { background: #fff; box-shadow: 0 4px 0 #ccc; }
        .checker.b { background: #222; box-shadow: 0 4px 0 #000; }

        .game-header { width: 100%; padding: 20px; display: flex; justify-content: space-between; align-items: center; color: white; position: absolute; top: env(safe-area-inset-top, 10px); }
        .turn-indicator { padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; transition: 0.3s; }
        
        #btn-reset { position: absolute; bottom: calc(20px + env(safe-area-inset-bottom)); background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 20px; border-radius: 12px; font-size: 11px; font-weight: 800; cursor: pointer; transition: 0.3s; -webkit-tap-highlight-color: transparent; outline: none; }
        #btn-reset:active { transform: scale(0.95); background: rgba(255,255,255,0.1); }
    </style>

    <div class="game-screen">
        <div class="game-header">
            <span style="font-weight:900; letter-spacing:1px; font-size:14px; font-family:'Montserrat';">${state.gameMode.toUpperCase()}</span>
            <div class="turn-indicator" style="background: ${state.turn === 'w' ? '#00ffa3' : '#ff416c'}; color: #000; box-shadow: 0 0 15px ${state.turn === 'w' ? 'rgba(0,255,163,0.3)' : 'rgba(255,65,108,0.3)'};">
                ${state.turn === 'w' ? 'TUO TURNO' : 'IA IN ATTESA...'}
            </div>
        </div>
        
        <div class="board" id="board-ui"></div>
        
        <button id="btn-reset">← TORNA AL MENU</button>
    </div>
    `;

    const boardUI = container.querySelector('#board-ui');
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('div');
            square.className = `sq ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            const piece = state.board[r][c];

            if (piece) {
                if (state.gameMode === 'chess') {
                    square.innerHTML = `<span class="piece">${chessPieces[piece.color + piece.type]}</span>`;
                } else {
                    square.innerHTML = `<div class="checker ${piece.color}"></div>`;
                }
            }

            if (state.selected && state.selected.r === r && state.selected.c === c) square.classList.add('selected');
            
            square.onclick = (e) => {
                e.preventDefault();
                handleSquareClick(r, c, state, container);
            };
            boardUI.appendChild(square);
        }
    }

    container.querySelector('#btn-reset').onclick = (e) => {
        e.preventDefault();
        renderSetupMenu(container, state);
    };
}

function handleSquareClick(r, c, state, container) {
    if (state.turn !== 'w' || state.isAnimating) return;

    const piece = state.board[r][c];

    if (state.selected) {
        if (state.selected.r === r && state.selected.c === c) {
            state.selected = null;
        } else {
            // Muovi pezzo
            movePiece(state.selected.r, state.selected.c, r, c, state);
            state.selected = null;
            
            if (state.turn === 'b') {
                setTimeout(() => aiMove(state, container), 600);
            }
        }
        renderBoard(container, state);
    } else if (piece && piece.color === 'w') {
        state.selected = { r, c };
        renderBoard(container, state);
    }
}

function movePiece(fromR, fromC, toR, toC, state) {
    const piece = state.board[fromR][fromC];
    state.board[toR][toC] = piece;
    state.board[fromR][fromC] = null;
    state.turn = state.turn === 'w' ? 'b' : 'w';
}

function aiMove(state, container) {
    state.isAnimating = true;
    let possibleMoves = [];

    // Logica IA base (cerca mosse legali rudimentali)
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = state.board[r][c];
            if (p && p.color === 'b') {
                const directions = state.gameMode === 'chess' ? [[1,0], [1,1], [1,-1]] : [[1,1], [1,-1]];
                directions.forEach(([dr, dc]) => {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                        if (!state.board[nr][nc] || state.board[nr][nc].color === 'w') {
                            possibleMoves.push({fr: r, fc: c, tr: nr, tc: nc});
                        }
                    }
                });
            }
        }
    }

    if (possibleMoves.length > 0) {
        const move = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        movePiece(move.fr, move.fc, move.tr, move.tc, state);
    }
    
    state.isAnimating = false;
    renderBoard(container, state);
}
