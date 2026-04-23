import { updateSidebarContext } from '../../components/layout/Sidebar.js';

export function initDama(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none'; 

    let state = {
        board: [], turn: 'w', selected: null, lastMove: null, isAnimating: false
    };

    renderSetupMenu(container, state);
}

const quitGame = async (container) => {
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) { window.location.reload(); }
};

function renderSetupMenu(container, state) {
    container.innerHTML = `
    <div class="game-setup-overlay">
        <div class="game-setup-card">
            <img src="/assets/logo.png" style="width: 80px; margin-bottom: 10px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 2rem; margin-bottom: 5px;">DAMA</h1>
            <p style="opacity:0.5; font-size:11px; letter-spacing: 2px; text-align:center; margin-bottom:30px;">REGOLAMENTO CLASSICO</p>
            <button class="btn-primary" id="begin-btn" style="background: var(--accent-gradient); border:none;">GIOCA ORA</button>
        </div>
        <button id="exit-setup" class="btn-back-glass" style="width: 100%; max-width: 300px;">← TORNA ALLA TAVERNA</button>
    </div>
    `;
    container.querySelector('#exit-setup').onclick = () => quitGame(container);
    container.querySelector('#begin-btn').onclick = () => startGame(container, state);
}

function startGame(container, state) {
    state.board = Array(8).fill(null).map(() => Array(8).fill(null));
    // Popola Neri
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) if ((r + c) % 2 !== 0) state.board[r][c] = { type: 'pedina', color: 'b' };
    }
    // Popola Bianchi
    for (let r = 5; r < 8; r++) {
        for (let c = 0; c < 8; c++) if ((r + c) % 2 !== 0) state.board[r][c] = { type: 'pedina', color: 'w' };
    }
    state.turn = 'w';
    state.selected = null;
    state.lastMove = null;
    renderBoard(container, state);
}

function renderBoard(container, state) {
    container.innerHTML = `
    <div class="game-master-wrapper fade-in">
        <div style="width: min(95vw, 400px); display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <button id="back-menu" class="game-btn-action" style="padding: 10px;">← ESCI</button>
            <div class="game-turn-indicator ${state.turn === 'w' ? 'white-turn' : 'black-turn'}">
                ${state.turn === 'w' ? 'IL TUO TURNO' : 'IA PENSANDO...'}
            </div>
        </div>

        <div class="game-chess-board" id="board-ui" style="width: min(95vw, 400px); height: min(95vw, 400px);"></div>
    </div>
    `;

    const boardUI = container.querySelector('#board-ui');
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            sq.className = `game-chess-square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            
            const piece = state.board[r][c];
            if (piece) {
                const isKing = piece.type === 'dama';
                const bg = piece.color === 'w' ? '#e0e0e0' : '#1a1a1a';
                const border = isKing ? '3px solid #ffbd39' : (piece.color === 'w' ? '2px solid #999' : '2px solid #000');
                const crown = isKing ? '<span style="color:#ffbd39; font-size:12px; position:absolute;">👑</span>' : '';
                
                sq.innerHTML = `<div style="width: 75%; height: 75%; border-radius: 50%; background: ${bg}; border: ${border}; box-shadow: inset 0 -4px 10px rgba(0,0,0,0.4), 0 4px 6px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; user-select: none; pointer-events: none;">${crown}</div>`;
            }

            if (state.selected && state.selected.r === r && state.selected.c === c) sq.classList.add('selected');
            if (state.lastMove && ((state.lastMove.fr === r && state.lastMove.fc === c) || (state.lastMove.tr === r && state.lastMove.tc === c))) {
                sq.style.background = 'rgba(255, 65, 108, 0.4)';
            }

            sq.onclick = () => handleSquareClick(r, c, state, container);
            boardUI.appendChild(sq);
        }
    }
    container.querySelector('#back-menu').onclick = () => quitGame(container);
}

function handleSquareClick(r, c, state, container) {
    if (state.turn !== 'w' || state.isAnimating) return;
    const piece = state.board[r][c];

    if (state.selected) {
        if (state.selected.r === r && state.selected.c === c) {
            state.selected = null; // Deseleziona
        } else {
            const validMoves = getDamaMoves(state.board, state.selected.r, state.selected.c);
            const move = validMoves.find(m => m.r === r && m.c === c);
            
            if (move) {
                // Esegui Mossa
                state.board[r][c] = state.board[state.selected.r][state.selected.c];
                state.board[state.selected.r][state.selected.c] = null;
                
                // Rimuovi pedina mangiata
                if (move.capture) {
                    state.board[move.capture.r][move.capture.c] = null;
                }

                // Promozione a Dama
                if (state.board[r][c].color === 'w' && r === 0) state.board[r][c].type = 'dama';

                state.lastMove = { fr: state.selected.r, fc: state.selected.c, tr: r, tc: c };
                state.turn = 'b';
                state.selected = null;
                
                setTimeout(() => aiDamaMove(state, container), 600);
            } else if (piece && piece.color === 'w') {
                state.selected = { r, c };
            } else {
                state.selected = null;
            }
        }
        renderBoard(container, state);
    } else if (piece && piece.color === 'w') {
        state.selected = { r, c };
        renderBoard(container, state);
    }
}

// Logica Movimento Dama
function getDamaMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const moves = [];
    const dirs = piece.type === 'dama' ? [[-1,-1], [-1,1], [1,-1], [1,1]] : (piece.color === 'w' ? [[-1,-1], [-1,1]] : [[1,-1], [1,1]]);

    dirs.forEach(d => {
        const nr = r + d[0], nc = c + d[1];
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (!board[nr][nc]) {
                moves.push({ r: nr, c: nc }); // Movimento normale
            } else if (board[nr][nc].color !== piece.color) {
                // Salto per cattura
                const jr = nr + d[0], jc = nc + d[1];
                if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !board[jr][jc]) {
                    moves.push({ r: jr, c: jc, capture: { r: nr, c: nc } });
                }
            }
        }
    });
    return moves;
}

function aiDamaMove(state, container) {
    state.isAnimating = true;
    let allMoves = [];
    
    for (let r=0; r<8; r++) {
        for (let c=0; c<8; c++) {
            if (state.board[r][c]?.color === 'b') {
                const moves = getDamaMoves(state.board, r, c);
                moves.forEach(m => allMoves.push({ fr: r, fc: c, tr: m.r, tc: m.c, capture: m.capture }));
            }
        }
    }

    if (allMoves.length > 0) {
        // Priorità alle mangiate
        const captures = allMoves.filter(m => m.capture);
        const move = captures.length > 0 ? captures[Math.floor(Math.random() * captures.length)] : allMoves[Math.floor(Math.random() * allMoves.length)];
        
        state.board[move.tr][move.tc] = state.board[move.fr][move.fc];
        state.board[move.fr][move.fc] = null;
        if (move.capture) state.board[move.capture.r][move.capture.c] = null;
        
        if (state.board[move.tr][move.tc].color === 'b' && move.tr === 7) state.board[move.tr][move.tc].type = 'dama';
        
        state.lastMove = move;
    } else {
        alert("Non ho più mosse! Hai Vinto!");
    }

    state.turn = 'w';
    state.isAnimating = false;
    renderBoard(container, state);
}