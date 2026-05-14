import { Chess } from 'chess.js';
import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { getLevelDifficultyChance, unlockNextLevel, renderLevelLadder } from '../../services/levels.js';

/**
 * GIOCO: SCACCHI
 * Regole ufficiali gestite da chess.js, UI responsive e IA progressiva.
 */

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PIECE_SYMBOLS = {
    wp: '♙', wr: '♖', wn: '♘', wb: '♗', wq: '♕', wk: '♔',
    bp: '♟', br: '♜', bn: '♞', bb: '♝', bq: '♛', bk: '♚'
};
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

export function initScacchi(container) {
    if (!container) return;
    try { updateSidebarContext('minigames'); } catch (e) { console.log('Sidebar non pronta'); }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#05010a';

    const state = {
        game: new Chess(),
        selectedSquare: null,
        lastMove: null,
        isAnimating: false,
        currentLevel: 1
    };

    renderLayout(container, state);
}

const quitGame = async (container) => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        window.location.reload();
    }
};

function renderLayout(container, state) {
    container.innerHTML = `
    <div class="game-master-wrapper fade-in">
        <div id="start-screen" class="game-master-wrapper" style="position: absolute; inset: 0; z-index: 10000; justify-content: center; background: #05010a;">
            <img src="/assets/logo.png" style="width: 100px; margin-bottom: 25px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 10px;">SCACCHI</h1>
            <p style="color: var(--amethyst-light); font-size: 11px; font-weight: 800; letter-spacing: 2px; margin-bottom: 30px;">SELEZIONA IL LIVELLO</p>
            <div id="levels-container" style="display: flex; flex-direction: column; width: 100%; max-width: 280px; max-height: 250px; overflow-y: auto; padding: 10px; margin-bottom: 20px;"></div>
            <button id="exit-btn" class="game-btn-action" style="background: transparent; border: none; opacity: 0.6;">TORNA ALLA TAVERNA</button>
        </div>

        <section class="game-chess-stage">
            <div class="game-chess-topbar">
                <button id="back-menu" class="game-btn-action" style="padding: 10px 20px;">← ESCI</button>
                <div id="turn-indicator" class="game-turn-indicator white-turn">IL TUO TURNO</div>
            </div>
            <div class="game-chess-board" id="board-ui" aria-label="Scacchiera"></div>
            <div class="game-chess-meta">
                <span id="bot-label">BOT LV.1</span>
                <span id="chess-status" class="game-chess-status">Muovi i bianchi. Scacco matto per vincere.</span>
            </div>
        </section>
    </div>
    `;

    renderLevelLadder('scacchi', container.querySelector('#levels-container'), (selectedLevel) => {
        state.currentLevel = selectedLevel;
        state.game = new Chess();
        state.selectedSquare = null;
        state.lastMove = null;
        state.isAnimating = false;
        container.querySelector('#start-screen').remove();
        container.querySelector('#bot-label').textContent = `BOT LV.${state.currentLevel}`;
        updateUI(container, state);
    });

    container.querySelector('#exit-btn').onclick = () => quitGame(container);
    container.querySelector('#back-menu').onclick = () => quitGame(container);
}

function coordsToSquare(row, col) {
    return `${FILES[col]}${8 - row}`;
}

function getSelectedMoves(state) {
    if (!state.selectedSquare) return [];
    return state.game.moves({ square: state.selectedSquare, verbose: true });
}

function getKingSquare(game, color) {
    const board = game.board();
    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            const piece = board[row][col];
            if (piece?.type === 'k' && piece.color === color) return coordsToSquare(row, col);
        }
    }
    return null;
}

function updateUI(container, state) {
    const boardUI = container.querySelector('#board-ui');
    if (!boardUI) return;

    const playerTurn = state.game.turn() === 'w' && !state.game.isGameOver();
    const turnIndicator = container.querySelector('#turn-indicator');
    if (turnIndicator) {
        turnIndicator.textContent = playerTurn ? 'IL TUO TURNO' : `BOT LV.${state.currentLevel} PENSA`;
        turnIndicator.className = `game-turn-indicator ${playerTurn ? 'white-turn' : 'black-turn'}`;
    }

    const selectedMoves = getSelectedMoves(state);
    const legalTargets = new Set(selectedMoves.map(move => move.to));
    const captureTargets = new Set(selectedMoves.filter(move => move.captured).map(move => move.to));
    const checkedKing = state.game.isCheck() ? getKingSquare(state.game, state.game.turn()) : null;
    const board = state.game.board();

    boardUI.innerHTML = '';
    for (let row = 0; row < 8; row += 1) {
        for (let col = 0; col < 8; col += 1) {
            const square = coordsToSquare(row, col);
            const piece = board[row][col];
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = `game-chess-square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            cell.setAttribute('aria-label', square);
            cell.dataset.square = square;

            if (state.selectedSquare === square) cell.classList.add('selected');
            if (legalTargets.has(square)) cell.classList.add('legal');
            if (captureTargets.has(square)) cell.classList.add('capture');
            if (state.lastMove && (state.lastMove.from === square || state.lastMove.to === square)) cell.classList.add('last');
            if (checkedKing === square) cell.classList.add('in-check');

            if (piece) {
                const symbol = PIECE_SYMBOLS[`${piece.color}${piece.type}`];
                const colorStyle = piece.color === 'w'
                    ? 'color: #fff7e2; text-shadow: 0 2px 3px rgba(0,0,0,0.72);'
                    : 'color: #1b0f0b; text-shadow: 0 1px 2px rgba(255,255,255,0.34);';
                cell.innerHTML = `<span class="game-chess-piece" style="${colorStyle}">${symbol}</span>`;
            }

            if (col === 0) {
                cell.insertAdjacentHTML('beforeend', `<span class="game-chess-coord">${8 - row}</span>`);
            }

            cell.onclick = () => handleSquareClick(square, state, container);
            boardUI.appendChild(cell);
        }
    }

    const status = container.querySelector('#chess-status');
    if (status) status.textContent = getStatusText(state);
}

function handleSquareClick(square, state, container) {
    if (state.isAnimating || state.game.turn() !== 'w' || state.game.isGameOver()) return;

    const piece = state.game.get(square);
    if (!state.selectedSquare) {
        if (piece?.color === 'w') {
            state.selectedSquare = square;
            updateUI(container, state);
        }
        return;
    }

    if (state.selectedSquare === square) {
        state.selectedSquare = null;
        updateUI(container, state);
        return;
    }

    const legalMoves = getSelectedMoves(state);
    const move = legalMoves.find(item => item.to === square && (!item.promotion || item.promotion === 'q'))
        || legalMoves.find(item => item.to === square);

    if (!move) {
        state.selectedSquare = piece?.color === 'w' ? square : null;
        updateUI(container, state);
        return;
    }

    const played = state.game.move(normalizeMove(move));
    if (!played) return;

    state.lastMove = { from: played.from, to: played.to };
    state.selectedSquare = null;
    updateUI(container, state);

    if (handleTerminalState(state, container)) return;

    state.isAnimating = true;
    updateUI(container, state);
    window.setTimeout(() => botMove(state, container), 650);
}

function normalizeMove(move) {
    return {
        from: move.from,
        to: move.to,
        promotion: move.promotion || 'q'
    };
}

function botMove(state, container) {
    const moves = state.game.moves({ verbose: true });
    if (!moves.length) {
        state.isAnimating = false;
        handleTerminalState(state, container);
        return;
    }

    const accuracy = getLevelDifficultyChance(state.currentLevel, 0, 0.95);
    const smartMove = Math.random() <= accuracy;
    const chosen = smartMove ? chooseBestBotMove(state, moves) : moves[Math.floor(Math.random() * moves.length)];
    const played = state.game.move(normalizeMove(chosen));

    state.lastMove = { from: played.from, to: played.to };
    state.isAnimating = false;
    updateUI(container, state);
    handleTerminalState(state, container);
}

function chooseBestBotMove(state, moves) {
    let bestScore = -Infinity;
    let bestMoves = [];

    moves.forEach(move => {
        const score = scoreBotMove(state, move);
        if (score > bestScore) {
            bestScore = score;
            bestMoves = [move];
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    });

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

function scoreBotMove(state, move) {
    let score = 0;
    if (move.captured) score += (PIECE_VALUES[move.captured] || 0) * 10;
    if (move.promotion) score += 18;
    if (move.san?.includes('+')) score += 4;
    if (move.san?.includes('#')) score += 1000;

    state.game.move(normalizeMove(move));
    if (state.game.isCheckmate()) score += 1000;
    const replies = state.game.moves({ verbose: true });
    const strongestReply = replies.reduce((max, reply) => Math.max(max, PIECE_VALUES[reply.captured] || 0), 0);
    score -= strongestReply * 2.5;
    state.game.undo();

    return score + Math.random() * 0.01;
}

function handleTerminalState(state, container) {
    if (!state.game.isGameOver()) return false;

    window.setTimeout(() => {
        if (state.game.isCheckmate()) {
            if (state.game.turn() === 'b') {
                unlockNextLevel('scacchi', state.currentLevel);
                alert(`SCACCO MATTO!\nHai superato il Livello ${state.currentLevel}.`);
            } else {
                alert(`SCONFITTA!\nIl Bot di Livello ${state.currentLevel} ti ha dato matto.`);
            }
        } else {
            alert('Patta. La partita finisce senza vincitore.');
        }
        quitGame(container);
    }, 250);

    return true;
}

function getStatusText(state) {
    if (state.game.isCheckmate()) {
        return state.game.turn() === 'b' ? 'Scacco matto: hai vinto.' : 'Scacco matto: vince il bot.';
    }
    if (state.game.isDraw()) return 'Patta.';
    if (state.game.isStalemate()) return 'Stallo.';
    if (state.game.isCheck()) return state.game.turn() === 'w' ? 'Sei sotto scacco.' : 'Bot sotto scacco.';
    return state.game.turn() === 'w' ? 'Muovi i bianchi.' : 'Il bot sta scegliendo una mossa legale.';
}
