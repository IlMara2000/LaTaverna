import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

export function initScacchi(container) {
    updateSidebarContext("minigames");

    let state = {
        board: [], // Matrice 8x8
        turn: 'w', // 'w' = white, 'b' = black
        selected: null,
        validMoves: [],
        difficulty: 2, // Default: Medio
        gameActive: false
    };

    renderDifficultySelector(container, state);
}

function renderDifficultySelector(container, state) {
    container.innerHTML = `
    <style>
        .chess-setup { width:100%; height:100dvh; background:#05020a; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; font-family:'Inter',sans-serif; }
        .diff-card { background:rgba(255,255,255,0.05); padding:40px; border-radius:30px; border:1px solid #9d4ede; text-align:center; box-shadow:0 0 30px rgba(157,78,221,0.2); }
        .btn-diff { width:100%; padding:15px; margin:10px 0; border-radius:12px; border:none; font-weight:900; cursor:pointer; transition:0.3s; }
        .easy { background:#2ecc71; color:black; }
        .med { background:#f1c40f; color:black; }
        .hard { background:#e74c3c; color:white; }
    </style>
    <div class="chess-setup fade-in">
        <div class="diff-card">
            <h1 style="font-size:2.5rem; margin-bottom:10px;">SCACCHI</h1>
            <p style="opacity:0.6; margin-bottom:30px;">Seleziona la difficoltà dell'IA</p>
            <button class="btn-diff easy" id="d-1">PRINCIPIANTE (Rapido)</button>
            <button class="btn-diff med" id="d-2">INTERMEDIO (Bilanciato)</button>
            <button class="btn-diff hard" id="d-3">MAESTRO (Lento)</button>
        </div>
    </div>
    `;

    [1, 2, 3].forEach(d => {
        document.getElementById(`d-${d}`).onclick = () => {
            state.difficulty = d;
            state.gameActive = true;
            startGame(container, state);
        };
    });
}

function startGame(container, state) {
    state.board = createStartingBoard();
    renderBoard(container, state);
}

function createStartingBoard() {
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

function renderBoard(container, state) {
    const pieces = {
        'wP': '♙', 'wR': '♖', 'wN': '♘', 'wB': '♗', 'wQ': '♕', 'wK': '♔',
        'bP': '♟', 'bR': '♜', 'bN': '♞', 'bB': '♝', 'bQ': '♛', 'bK': '♚'
    };

    container.innerHTML = `
    <style>
        .chess-container { width:100%; height:100dvh; background:#1a1a1a; display:flex; align-items:center; justify-content:center; }
        .chessboard { display:grid; grid-template-columns: repeat(8, 60px); grid-template-rows: repeat(8, 60px); border:5px solid #333; box-shadow:0 20px 50px rgba(0,0,0,0.5); }
        .square { width:60px; height:60px; display:flex; align-items:center; justify-content:center; font-size:40px; cursor:pointer; position:relative; }
        .square.white { background:#ebecd0; }
        .square.black { background:#779556; }
        .square.selected { background:#f6f669 !important; }
        .square.valid::after { content:''; width:20px; height:20px; background:rgba(0,0,0,0.1); border-radius:50%; position:absolute; }
        .piece { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); z-index:2; }
        .piece:hover { transform: scale(1.1); }
    </style>
    <div class="chess-container fade-in">
        <div class="chessboard" id="board-ui"></div>
    </div>
    `;

    const boardUI = document.getElementById('board-ui');
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement('div');
            square.className = `square ${(r + c) % 2 === 0 ? 'white' : 'black'}`;
            const piece = state.board[r][c];
            
            if (piece) {
                square.innerHTML = `<span class="piece">${pieces[piece.color + piece.type]}</span>`;
            }

            if (state.selected && state.selected.r === r && state.selected.c === c) square.classList.add('selected');
            if (state.validMoves.some(m => m.r === r && m.c === m.c)) { /* Logica pallini */ }

            square.onclick = () => handleSquareClick(r, c, state, container);
            boardUI.appendChild(square);
        }
    }
}

function handleSquareClick(r, c, state, container) {
    if (state.turn !== 'w') return; // Blocca input durante turno IA

    const piece = state.board[r][c];

    if (state.selected) {
        // Tenta movimento
        movePiece(state.selected.r, state.selected.c, r, c, state);
        state.selected = null;
        renderBoard(container, state);
        
        // Turno IA
        if (state.turn === 'b') {
            setTimeout(() => aiMove(state, container), 600);
        }
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
    // IA Semplice: Cerca la prima mossa legale (espandibile con Minimax)
    let moved = false;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = state.board[r][c];
            if (p && p.color === 'b') {
                const targetR = r + (p.type === 'P' ? 1 : 0); // Muove pedone avanti
                if (targetR < 8 && !state.board[targetR][c]) {
                    movePiece(r, c, targetR, c, state);
                    moved = true;
                    break;
                }
            }
        }
        if (moved) break;
    }
    renderBoard(container, state);
}