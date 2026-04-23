import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { getUnlockedLevel, unlockNextLevel, renderLevelLadder } from '../../services/levels.js';

/**
 * GIOCO: DAMA - MASTER EDITION
 * Regolamento Classico + Scala Livelli Infiniti + IA Progressiva
 */

export function initDama(container) {
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
    } catch (e) { window.location.reload(); }
};

// --- 1. LAYOUT PRINCIPALE E MENU LIVELLI ---
function renderLayout(container, state) {
    container.innerHTML = `
    <div class="game-master-wrapper fade-in">
        
        <div id="start-screen" class="game-master-wrapper" style="position: absolute; inset: 0; z-index: 10000; justify-content: center; background: #05010a;">
            <img src="/assets/logo.png" style="width: 100px; margin-bottom: 25px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 10px;">DAMA</h1>
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
            Mangia tutte le pedine o blocca l'avversario!
        </div>

    </div>
    `;

    // Disegna la scala dei livelli
    renderLevelLadder('dama', container.querySelector('#levels-container'), (selectedLevel) => {
        state.currentLevel = selectedLevel;
        container.querySelector('#start-screen').remove();
        container.querySelector('#bot-label').innerText = `BOT (LV.${state.currentLevel})`;
        startGame(container, state);
    });

    container.querySelector('#exit-btn').onclick = () => quitGame(container);
}

// --- 2. LOGICA INIZIALIZZAZIONE ---
function startGame(container, state) {
    state.board = Array(8).fill(null).map(() => Array(8).fill(null));
    // Popola Neri (In Alto)
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) if ((r + c) % 2 !== 0) state.board[r][c] = { type: 'pedina', color: 'b' };
    }
    // Popola Bianchi (In Basso)
    for (let r = 5; r < 8; r++) {
        for (let c = 0; c < 8; c++) if ((r + c) % 2 !== 0) state.board[r][c] = { type: 'pedina', color: 'w' };
    }
    state.turn = 'w';
    state.selected = null;
    state.lastMove = null;
    updateUI(container, state);
}

// --- 3. RENDERING SCACCHIERA ---
function updateUI(container, state) {
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
                const isKing = piece.type === 'dama';
                // Bianco = Grigio Pietra | Nero = Matte Black
                const bg = piece.color === 'w' ? '#e0e0e0' : '#121212';
                // Bordo dorato se è Dama, altrimenti bordo scuro/chiaro
                const border = isKing ? '3px solid #ffbd39' : (piece.color === 'w' ? '2px solid #999' : '2px solid rgba(255,255,255,0.1)');
                const shadow = piece.color === 'w' ? '0 4px 6px rgba(0,0,0,0.5)' : '0 4px 10px rgba(0,0,0,0.8)';
                const crown = isKing ? '<span style="color:#ffbd39; font-size: min(4vw, 18px); position:absolute;">👑</span>' : '';
                
                sq.innerHTML = `<div style="width: 75%; height: 75%; border-radius: 50%; background: ${bg}; border: ${border}; box-shadow: inset 0 -4px 10px rgba(0,0,0,0.4), ${shadow}; display: flex; align-items: center; justify-content: center; user-select: none; pointer-events: none;">${crown}</div>`;
            }

            // Highlighting selezioni e ultime mosse
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

                // Promozione a Dama per il giocatore bianco (riga 0)
                if (state.board[r][c].color === 'w' && r === 0) state.board[r][c].type = 'dama';

                state.lastMove = { fr: state.selected.r, fc: state.selected.c, tr: r, tc: c };
                state.turn = 'b';
                state.selected = null;
                
                updateUI(container, state);
                setTimeout(() => aiDamaMove(state, container), 800);
            } else if (piece && piece.color === 'w') {
                state.selected = { r, c }; // Cambia selezione
            } else {
                state.selected = null;
            }
        }
        updateUI(container, state);
    } else if (piece && piece.color === 'w') {
        state.selected = { r, c };
        updateUI(container, state);
    }
}

// Logica Movimento Dama (Semplice)
function getDamaMoves(board, r, c) {
    const piece = board[r][c];
    if (!piece) return [];
    const moves = [];
    
    // Le pedine normali si muovono in 2 direzioni, le Dame in 4
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
                    // Nella dama vera e propria una pedina normale non può mangiare una dama. Qui lo consentiamo per semplicità
                    moves.push({ r: jr, c: jc, capture: { r: nr, c: nc } });
                }
            }
        }
    });
    return moves;
}

// --- 5. INTELLIGENZA ARTIFICIALE BOT ---
function aiDamaMove(state, container) {
    state.isAnimating = true;
    let allMoves = [];
    
    // Raccoglie tutte le mosse possibili per il Nero
    for (let r=0; r<8; r++) {
        for (let c=0; c<8; c++) {
            if (state.board[r][c]?.color === 'b') {
                const moves = getDamaMoves(state.board, r, c);
                moves.forEach(m => allMoves.push({ fr: r, fc: c, tr: m.r, tc: m.c, capture: m.capture }));
            }
        }
    }

    if (allMoves.length === 0) {
        alert(`🏆 VITTORIA!\nHai superato il Livello ${state.currentLevel}! Il bot non ha mosse.`);
        unlockNextLevel('dama', state.currentLevel);
        return quitGame(container);
    }

    // Accuratezza dell'IA in base al livello (Max 95%)
    const accuracy = Math.min(0.95, state.currentLevel * 0.025);
    const isSmart = Math.random() <= accuracy;

    let chosenMove;
    const captures = allMoves.filter(m => m.capture);

    if (captures.length > 0) {
        // La mangiata in Dama è generalmente obbligatoria
        chosenMove = captures[Math.floor(Math.random() * captures.length)];
    } else {
        if (isSmart) {
            // Cerca di fare una mossa che promuova a Dama (riga 7)
            const promotions = allMoves.filter(m => m.tr === 7 && state.board[m.fr][m.fc].type !== 'dama');
            if (promotions.length > 0) {
                chosenMove = promotions[Math.floor(Math.random() * promotions.length)];
            } else {
                chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
            }
        } else {
            chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
        }
    }
    
    // Esecuzione Mossa del Bot
    state.board[chosenMove.tr][chosenMove.tc] = state.board[chosenMove.fr][chosenMove.fc];
    state.board[chosenMove.fr][chosenMove.fc] = null;
    if (chosenMove.capture) state.board[chosenMove.capture.r][chosenMove.capture.c] = null;
    
    // Promozione Bot
    if (state.board[chosenMove.tr][chosenMove.tc].color === 'b' && chosenMove.tr === 7) {
        state.board[chosenMove.tr][chosenMove.tc].type = 'dama';
    }
    
    state.lastMove = chosenMove;
    state.turn = 'w';
    state.isAnimating = false;
    updateUI(container, state);

    // Controllo se il giocatore Bianco è rimasto senza mosse (Sconfitta)
    let playerHasMoves = false;
    for (let r=0; r<8; r++) {
        for (let c=0; c<8; c++) {
            if (state.board[r][c]?.color === 'w') {
                if (getDamaMoves(state.board, r, c).length > 0) playerHasMoves = true;
            }
        }
    }

    if (!playerHasMoves) {
        setTimeout(() => {
            alert(`💀 SCONFITTA!\nSei stato bloccato dal Bot di Livello ${state.currentLevel}.`);
            quitGame(container);
        }, 300);
    }
}