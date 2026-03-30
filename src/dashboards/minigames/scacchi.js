import { updateSidebarContext } from '../../components/layout/Sidebar.js';

export function initScacchi(container) {
    updateSidebarContext("minigames");

    let state = {
        gameMode: 'chess', // 'chess' o 'checkers'
        difficulty: 2,
        board: [],
        turn: 'w',
        selected: null,
        validMoves: [],
        isAnimating: false
    };

    renderSetupMenu(container, state);
}

function renderSetupMenu(container, state) {
    container.innerHTML = `
    <style>
        .setup-screen { 
            width:100%; height:100dvh; 
            background: radial-gradient(circle at center, #1a1a2e 0%, #07070a 100%); 
            display:flex; flex-direction:column; align-items:center; justify-content:center; 
            color:white; font-family:'Poppins',sans-serif; padding: 20px;
        }
        .setup-card { 
            background: rgba(255,255,255,0.03); backdrop-filter: blur(15px);
            padding: 30px; border-radius: 24px; border: 1px solid rgba(157,78,221,0.3);
            width: 100%; max-width: 400px; text-align: center;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .mode-toggle { display: flex; gap: 10px; margin-bottom: 25px; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 12px; }
        .mode-btn { flex: 1; padding: 12px; border-radius: 8px; border: none; cursor: pointer; background: transparent; color: white; font-weight: 600; transition: 0.3s; }
        .mode-btn.active { background: #9d4ede; box-shadow: 0 4px 15px rgba(157,78,221,0.4); }
        
        .diff-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 30px; }
        .diff-btn { padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; cursor: pointer; font-size: 0.8rem; }
        .diff-btn.active { border-color: #9d4ede; background: rgba(157,78,221,0.2); }
        
        .start-btn { width: 100%; padding: 16px; border-radius: 12px; border: none; background: #00ffa3; color: #000; font-weight: 900; font-size: 1.1rem; cursor: pointer; transition: 0.3s; }
        .start-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,255,163,0.3); }
    </style>
    <div class="setup-screen">
        <div class="setup-card">
            <h2 style="margin-bottom: 20px;">SALA GIOCHI</h2>
            
            <p style="text-align: left; font-size: 0.8rem; opacity: 0.6; margin-bottom: 8px;">Scegli il gioco:</p>
            <div class="mode-toggle">
                <button class="mode-btn active" id="btn-chess">SCACCHI</button>
                <button class="mode-btn" id="btn-checkers">DAMA</button>
            </div>

            <p style="text-align: left; font-size: 0.8rem; opacity: 0.6; margin-bottom: 8px;">Difficoltà IA:</p>
            <div class="diff-grid">
                <button class="diff-btn" data-v="1">FACILE</button>
                <button class="diff-btn active" data-v="2">MEDIO</button>
                <button class="diff-btn" data-v="3">ESPERTO</button>
            </div>

            <button class="start-btn" id="start-game">INIZIA PARTITA</button>
        </div>
    </div>
    `;

    // Eventi Menu
    const btnsMode = container.querySelectorAll('.mode-btn');
    btnsMode.forEach(btn => btn.onclick = () => {
        btnsMode.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.gameMode = btn.id === 'btn-chess' ? 'chess' : 'checkers';
    });

    const btnsDiff = container.querySelectorAll('.diff-btn');
    btnsDiff.forEach(btn => btn.onclick = () => {
        btnsDiff.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.difficulty = parseInt(btn.dataset.v);
    });

    container.querySelector('#start-game').onclick = () => startGame(container, state);
}

function startGame(container, state) {
    state.board = state.gameMode === 'chess' ? createChessBoard() : createCheckersBoard();
    state.turn = 'w';
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
        .game-screen { width:100%; height:100dvh; background:#0a0a0c; display:flex; flex-direction:column; align-items:center; justify-content:center; }
        .board { 
            display: grid; grid-template-columns: repeat(8, 1fr); 
            width: 95vw; max-width: 480px; height: 95vw; max-height: 480px;
            border: 4px solid #1a1a1a; box-shadow: 0 0 50px rgba(0,0,0,0.8);
        }
        .sq { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size: clamp(25px, 8vw, 40px); cursor:pointer; position:relative; }
        .sq.light { background: #d1d9e0; }
        .sq.dark { background: #5c7c99; }
        .sq.selected { background: #f6f669 !important; }
        .piece { user-select: none; transition: transform 0.2s; z-index: 5; }
        
        /* Dama */
        .checker { width: 80%; height: 80%; border-radius: 50%; border: 3px solid rgba(0,0,0,0.2); box-shadow: 0 4px 0 rgba(0,0,0,0.3); }
        .checker.w { background: #fff; }
        .checker.b { background: #222; }

        .info-bar { width: 100%; max-width: 480px; display: flex; justify-content: space-between; padding: 15px; color: white; font-weight: bold; }
    </style>
    <div class="game-screen">
        <div class="info-bar">
            <span>${state.gameMode.toUpperCase()}</span>
            <span id="turn-display" style="color: ${state.turn === 'w' ? '#00ffa3' : '#ff416c'}">TURNO: ${state.turn === 'w' ? 'BIANCO' : 'NERO'}</span>
        </div>
        <div class="board" id="board-ui"></div>
        <button onclick="window.location.reload()" style="margin-top:20px; background:none; border:none; color:white; opacity:0.5; cursor:pointer;">↺ RICOMINCIA</button>
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
                    square.innerHTML = `<span class="piece" style="color:${piece.color === 'w' ? '#000' : '#000'}">${chessPieces[piece.color + piece.type]}</span>`;
                } else {
                    square.innerHTML = `<div class="checker ${piece.color}"></div>`;
                }
            }

            if (state.selected && state.selected.r === r && state.selected.c === c) square.classList.add('selected');
            
            square.onclick = () => handleSquareClick(r, c, state, container);
            boardUI.appendChild(square);
        }
    }
}

function handleSquareClick(r, c, state, container) {
    if (state.turn !== 'w' || state.isAnimating) return;

    const piece = state.board[r][c];

    if (state.selected) {
        if (state.selected.r === r && state.selected.c === c) {
            state.selected = null;
        } else {
            // Logica movimento semplificata (da espandere con regole reali)
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
    let moved = false;
    
    // IA Base: Cerca il primo pezzo nero che può muoversi
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = state.board[r][c];
            if (p && p.color === 'b') {
                const dr = state.gameMode === 'chess' ? 1 : 1; 
                if (r + dr < 8 && !state.board[r + dr][c]) {
                    movePiece(r, c, r + dr, c, state);
                    moved = true; break;
                }
            }
        }
        if (moved) break;
    }
    
    state.isAnimating = false;
    renderBoard(container, state);
}