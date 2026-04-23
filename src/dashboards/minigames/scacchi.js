import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { getUnlockedLevel, unlockNextLevel, renderLevelLadder } from '../../services/levels.js';

/**
 * GIOCO: SCACCHI - MASTER EDITION
 * Integrazione UI Matte Black + Scala Livelli Infiniti + IA Progressiva
 */

export function initScacchi(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    // BLOCCO SCROLL GLOBALE PER IL GIOCO
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none'; 
    document.body.style.backgroundColor = '#05010a'; 

    let state = {
        board: [],
        turn: 'w',
        selected: null,
        lastMove: null,
        isAnimating: false,
        currentLevel: 1
    };

    renderLayout(container, state);
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

// --- 1. LAYOUT PRINCIPALE E MENU LIVELLI ---
function renderLayout(container, state) {
    container.innerHTML = `
    <div class="game-master-wrapper fade-in">
        
        <div id="start-screen" class="game-master-wrapper" style="position: absolute; inset: 0; z-index: 10000; justify-content: center; background: #05010a;">
            <img src="/assets/logo.png" style="width: 100px; margin-bottom: 25px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 10px;">SCACCHI</h1>
            <p style="color: var(--amethyst-light); font-size: 11px; font-weight: 800; letter-spacing: 2px; margin-bottom: 30px;">SELEZIONA IL LIVELLO</p>
            
            <div id="levels-container" style="display: flex; flex-direction: column; width: 100%; max-width: 280px; max-height: 250px; overflow-y: auto; padding: 10px; margin-bottom: 20px;">
                </div>

            <button id="exit-btn" class="game-btn-action" style="background: transparent; border: none; opacity: 0.6;">TORNA ALLA TAVERNA</button>
        </div>

        <div style="width: min(95vw, 400px); display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; margin-top: 20px;">
            <button id="back-menu" class="game-btn-action" style="padding: 10px 20px;">← ESCI</button>
            <div id="turn-indicator" class="game-turn-indicator white-turn">IL TUO TURNO</div>
        </div>

        <div class="game-chess-board" id="board-ui" style="width: min(95vw, 400px); height: min(95vw, 400px);"></div>
        
        <div style="margin-top: 20px; font-size: 12px; opacity: 0.6; text-align: center; font-weight: 800;">
            <span id="bot-label" style="color: var(--amethyst-bright); font-size: 14px;">BOT (LV.1)</span><br>
            Cattura il Re avversario per vincere!
        </div>

    </div>
    `;

    // Disegna la scala dei livelli
    renderLevelLadder('scacchi', container.querySelector('#levels-container'), (selectedLevel) => {
        state.currentLevel = selectedLevel;
        container.querySelector('#start-screen').remove();
        container.querySelector('#bot-label').innerText = `BOT (LV.${state.currentLevel})`;
        startGame(container, state);
    });

    container.querySelector('#exit-btn').onclick = () => quitGame(container);
}

// --- 2. LOGICA INIZIALIZZAZIONE ---
function startGame(container, state) {
    state.board = createChessBoard();
    state.turn = 'w';
    state.selected = null;
    state.lastMove = null;
    updateUI(container, state);
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

// --- 3. RENDERING SCACCHIERA ---
function updateUI(container, state) {
    const chessSymbols = {
        'wP': '♙', 'wR': '♖', 'wN': '♘', 'wB': '♗', 'wQ': '♕', 'wK': '♔',
        'bP': '♟', 'bR': '♜', 'bN': '♞', 'bB': '♝', 'bQ': '♛', 'bK': '♚'
    };

    const tInd = container.querySelector('#turn-indicator');
    if (tInd) {
        tInd.innerText = state.turn === 'w' ? 'IL TUO TURNO' : `BOT LV.${state.currentLevel} PENSA...`;
        tInd.className = `game-turn-indicator ${state.turn === 'w' ? 'white-turn' : 'black-turn'}`;
    }

    const boardUI = container.querySelector('#board-ui');
    if (!boardUI) return;
    boardUI.innerHTML = '';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = document.createElement('div');
            sq.className = `game-chess-square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
            
            const piece = state.board[r][c];
            if (piece) {
                // Design pulito: Bianchi con ombra nera, Neri scuri con ombra chiara
                const colorStyle = piece.color === 'w' ? 'color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.8);' : 'color: #111111; text-shadow: 0 1px 2px rgba(255,255,255,0.4);';
                sq.innerHTML = `<span class="game-chess-piece" style="font-size: min(8vw, 35px); ${colorStyle}">${chessSymbols[piece.color + piece.type]}</span>`;
            }

            // Highlighting
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

// --- 4. GESTIONE CLICK E REGOLE ---
function handleSquareClick(r, c, state, container) {
    if (state.turn !== 'w' || state.isAnimating) return;
    const piece = state.board[r][c];

    if (state.selected) {
        if (state.selected.r === r && state.selected.c === c) {
            state.selected = null; // Deseleziona se clicco la stessa
        } else {
            // Validazione Mossa
            const validMoves = getValidMoves(state.board, state.selected.r, state.selected.c);
            const isValid = validMoves.some(m => m.r === r && m.c === c);
            
            if (isValid) {
                const targetPiece = state.board[r][c];
                
                // Esegui mossa
                state.board[r][c] = state.board[state.selected.r][state.selected.c];
                state.board[state.selected.r][state.selected.c] = null;
                state.lastMove = { fr: state.selected.r, fc: state.selected.c, tr: r, tc: c };
                
                // Promozione Pedone a Regina
                if(state.board[r][c].type === 'P' && r === 0) state.board[r][c].type = 'Q';

                state.selected = null;
                updateUI(container, state);

                // Controllo Vittoria Giocatore
                if (targetPiece && targetPiece.type === 'K') {
                    setTimeout(() => {
                        unlockNextLevel('scacchi', state.currentLevel);
                        alert(`🏆 SCACCO MATTO!\nHai catturato il Re e superato il Livello ${state.currentLevel}!`);
                        quitGame(container);
                    }, 300);
                    return;
                }

                state.turn = 'b';
                updateUI(container, state);
                setTimeout(() => aiMove(state, container), 800);
            } else if (piece && piece.color === 'w') {
                state.selected = { r, c }; // Cambia selezione
            } else {
                state.selected = null; // Clic a vuoto
            }
        }
        updateUI(container, state);
    } else if (piece && piece.color === 'w') {
        state.selected = { r, c };
        updateUI(container, state);
    }
}

// Calcolo Mosse Legali per un pezzo specifico
function getValidMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const moves = [];
    const color = piece.color;
    const dir = color === 'w' ? -1 : 1;

    const addMove = (tr, tc) => {
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            if (!board[tr][tc]) { moves.push({r: tr, c: tc, target: null}); return true; } // Cella vuota, continua
            if (board[tr][tc].color !== color) { moves.push({r: tr, c: tc, target: board[tr][tc]}); } // Cattura avversario, ferma raggio
        }
        return false;
    };

    if (piece.type === 'P') {
        // Passo Avanti
        if (r+dir >= 0 && r+dir < 8 && !board[r+dir][c]) {
            moves.push({r: r+dir, c, target: null});
            // Doppio passo
            if ((color === 'w' && r === 6) || (color === 'b' && r === 1)) {
                if (!board[r+(dir*2)][c]) moves.push({r: r+(dir*2), c, target: null});
            }
        }
        // Catture Diagonali
        if (r+dir >= 0 && r+dir < 8) {
            if (c-1 >= 0 && board[r+dir][c-1] && board[r+dir][c-1].color !== color) moves.push({r: r+dir, c: c-1, target: board[r+dir][c-1]});
            if (c+1 < 8 && board[r+dir][c+1] && board[r+dir][c+1].color !== color) moves.push({r: r+dir, c: c+1, target: board[r+dir][c+1]});
        }
    } else if (piece.type === 'N') {
        const jumps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        jumps.forEach(j => {
            const tr = r + j[0], tc = c + j[1];
            if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                if (!board[tr][tc]) moves.push({r: tr, c: tc, target: null});
                else if (board[tr][tc].color !== color) moves.push({r: tr, c: tc, target: board[tr][tc]});
            }
        });
    } else {
        const dirs = [];
        if (['R', 'Q'].includes(piece.type)) dirs.push([-1,0],[1,0],[0,-1],[0,1]); // Ortogonali
        if (['B', 'Q'].includes(piece.type)) dirs.push([-1,-1],[-1,1],[1,-1],[1,1]); // Diagonali
        if (piece.type === 'K') dirs.push([-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]); // Re

        dirs.forEach(d => {
            let tr = r + d[0], tc = c + d[1];
            while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                if (!addMove(tr, tc)) break;
                if (piece.type === 'K') break; // Il Re non ha raggio
                tr += d[0]; tc += d[1];
            }
        });
    }
    return moves;
}

// --- 5. INTELLIGENZA ARTIFICIALE A LIVELLI ---
const PIECE_VALUES = { 'Q': 9, 'R': 5, 'B': 3, 'N': 3, 'P': 1, 'K': 100 };

function aiMove(state, container) {
    state.isAnimating = true;
    let allMoves = [];
    
    // Raccoglie tutte le mosse legali
    for (let r=0; r<8; r++) {
        for (let c=0; c<8; c++) {
            if (state.board[r][c]?.color === 'b') {
                const moves = getValidMoves(state.board, r, c);
                moves.forEach(m => allMoves.push({ fr: r, fc: c, tr: m.r, tc: m.c, target: m.target }));
            }
        }
    }

    if (allMoves.length === 0) {
        alert("Il Bot non ha più mosse! Hai Vinto!");
        unlockNextLevel('scacchi', state.currentLevel);
        return quitGame(container);
    }

    // Accuratezza dell'IA in base al livello (Max 95%)
    const accuracy = Math.min(0.95, state.currentLevel * 0.025);
    const isSmart = Math.random() <= accuracy;

    let chosenMove;

    if (isSmart) {
        // Cerca la mossa migliore (Catturare il pezzo di valore più alto)
        let bestScore = -1;
        let bestMoves = [];

        allMoves.forEach(m => {
            let score = 0;
            if (m.target) {
                score = PIECE_VALUES[m.target.type] || 0;
            }
            if (score > bestScore) {
                bestScore = score;
                bestMoves = [m];
            } else if (score === bestScore) {
                bestMoves.push(m);
            }
        });
        
        // Sceglie a caso tra le mosse ugualmente ottime
        chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    } else {
        // Mossa completamente casuale
        chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    }
    
    // Esecuzione Mossa
    state.board[chosenMove.tr][chosenMove.tc] = state.board[chosenMove.fr][chosenMove.fc];
    state.board[chosenMove.fr][chosenMove.fc] = null;
    state.lastMove = chosenMove;

    // Promozione Bot
    if(state.board[chosenMove.tr][chosenMove.tc].type === 'P' && chosenMove.tr === 7) {
        state.board[chosenMove.tr][chosenMove.tc].type = 'Q';
    }

    updateUI(container, state);

    // Controllo Vittoria Bot
    if (chosenMove.target && chosenMove.target.type === 'K') {
        setTimeout(() => {
            alert(`💀 SCONFITTA!\nIl Bot di Livello ${state.currentLevel} ha catturato il tuo Re.`);
            quitGame(container);
        }, 300);
        return;
    }

    state.turn = 'w';
    state.isAnimating = false;
    updateUI(container, state);
}