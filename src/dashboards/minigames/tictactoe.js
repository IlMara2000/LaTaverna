import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { getLevelDifficultyChance, renderLevelLadder, unlockNextLevel } from '../../services/levels.js';
import {
    createMinigameRoom,
    getMinigameClientId,
    getMinigameRoomByCode,
    getSavedMinigameRoom,
    isMinigameRoomConnected,
    updateMinigameRoomData,
    watchMinigameRoom
} from '../../services/minigameMultiplayer.js';

const MIN_BOARD_SIZE = 3;
const MAX_BOARD_SIZE = 9;
const ONLINE_GAME_KEY = 'tictactoe';
const PLAYER_SYMBOL = 'x';
const BOT_SYMBOL = 'o';

const ARROW_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12h13"></path>
        <path d="m13 6 6 6-6 6"></path>
    </svg>
`;

const clampBoardSize = (value) => {
    const next = Math.floor(Number(value));
    if (!Number.isFinite(next)) return MIN_BOARD_SIZE;
    return Math.min(MAX_BOARD_SIZE, Math.max(MIN_BOARD_SIZE, next));
};

const createEmptyBoard = (size) => Array(size * size).fill('');

const getWinLength = (size) => size;

const createGameState = () => ({
    mode: 'menu',
    boardSize: MIN_BOARD_SIZE,
    winLength: getWinLength(MIN_BOARD_SIZE),
    board: createEmptyBoard(MIN_BOARD_SIZE),
    turn: PLAYER_SYMBOL,
    currentLevel: 1,
    isAnimating: false,
    status: 'idle',
    winner: null,
    winningLine: [],
    drawReason: '',
    lastMove: null,
    levelUnlocked: false,
    online: {
        room: null,
        symbol: PLAYER_SYMBOL,
        stopWatch: null,
        pollTimer: null,
        busy: false,
        error: ''
    }
});

export function initTicTacToe(container) {
    if (!container) return;
    try { updateSidebarContext('minigames'); } catch (e) { console.log('Sidebar non pronta'); }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#05010a';

    const state = createGameState();
    renderLayout(container, state);
}

const quitGame = async (container, state) => {
    cleanupOnline(state);
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = '';

    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container, { filter: 'party' });
    } catch {
        window.location.reload();
    }
};

function renderLayout(container, state) {
    container.innerHTML = `
        <div class="game-master-wrapper tictactoe-wrapper fade-in">
            <div id="start-screen" class="game-master-wrapper tictactoe-start-screen">
                <img src="/assets/logo.png" class="pulse-logo" alt="">
                <h1 class="main-title">TIC TAC TOE</h1>

                <section class="tictactoe-mode-panel" aria-label="Modalità Tic Tac Toe">
                    <button type="button" id="ttt-size-cycle" class="tictactoe-mode-button is-size">
                        <span class="tictactoe-mode-icon" aria-hidden="true">▦</span>
                        <span class="tictactoe-mode-copy">
                            <strong>AMPLIA GRIGLIA</strong>
                            <small id="ttt-size-copy">${state.boardSize}×${state.boardSize}</small>
                        </span>
                    </button>

                    <button type="button" id="ttt-local-mode" class="tictactoe-mode-button">
                        <span class="tictactoe-mode-icon" aria-hidden="true">👤</span>
                        ${ARROW_ICON}
                        <span class="tictactoe-mode-icon" aria-hidden="true">👤</span>
                        <span class="tictactoe-mode-copy">
                            <strong>LOCALE</strong>
                            <small>Omino contro omino</small>
                        </span>
                    </button>

                    <button type="button" id="ttt-online-mode" class="tictactoe-mode-button">
                        <span class="tictactoe-mode-icon" aria-hidden="true">👤</span>
                        ${ARROW_ICON}
                        <span class="tictactoe-mode-icon" aria-hidden="true">🌐</span>
                        <span class="tictactoe-mode-copy">
                            <strong>ONLINE</strong>
                            <small>Omino contro rete</small>
                        </span>
                    </button>
                </section>

                <div class="tictactoe-size-picker" aria-label="Dimensione griglia">
                    <button type="button" id="ttt-size-down" aria-label="Riduci griglia">−</button>
                    <strong id="ttt-size-value">${state.boardSize}×${state.boardSize}</strong>
                    <button type="button" id="ttt-size-up" aria-label="Aumenta griglia">+</button>
                </div>

                <p id="ttt-online-status" class="tictactoe-online-status" aria-live="polite"></p>

                <section class="tictactoe-bot-levels" aria-label="Modalità contro bot">
                    <span>CONTRO IL BOT</span>
                    <div id="levels-container"></div>
                </section>

                <button id="exit-btn" class="game-btn-action tictactoe-exit-btn">TORNA ALLA TAVERNA</button>
            </div>

            <section class="game-chess-stage tictactoe-stage" aria-label="Tavolo Tic Tac Toe">
                <div class="game-chess-topbar tictactoe-topbar">
                    <button id="back-menu" class="game-btn-action">← ESCI</button>
                    <div id="turn-indicator" class="game-turn-indicator white-turn" aria-live="polite">TIC TAC TOE</div>
                </div>

                <div class="tictactoe-round-card">
                    <div class="tictactoe-players">
                        <span id="ttt-x-label" class="is-x">X</span>
                        <span id="ttt-mode-label">SELEZIONA MODALITÀ</span>
                        <span id="ttt-o-label" class="is-o">O</span>
                    </div>
                    <div class="tictactoe-board-frame">
                        <div id="board-ui" class="tictactoe-board" role="grid" aria-label="Griglia Tic Tac Toe"></div>
                    </div>
                    <div class="game-chess-meta tictactoe-meta">
                        <span id="ttt-size-meta">3×3 · linea da 3</span>
                        <span id="ttt-online-meta">Locale</span>
                        <span id="ttt-status" class="game-chess-status" aria-live="polite">Scegli una modalità.</span>
                    </div>
                    <div class="tictactoe-actions">
                        <button type="button" id="ttt-reset" class="game-btn-action">NUOVA PARTITA</button>
                        <button type="button" id="ttt-menu" class="game-btn-action">CAMBIA MODALITÀ</button>
                    </div>
                </div>
            </section>
        </div>
    `;

    const startScreen = container.querySelector('#start-screen');
    const onlineStatus = container.querySelector('#ttt-online-status');

    const renderSize = () => {
        state.boardSize = clampBoardSize(state.boardSize);
        state.winLength = getWinLength(state.boardSize);
        container.querySelector('#ttt-size-copy').textContent = `${state.boardSize}×${state.boardSize}`;
        container.querySelector('#ttt-size-value').textContent = `${state.boardSize}×${state.boardSize}`;
    };

    const setOnlineStatus = (message = '') => {
        if (onlineStatus) onlineStatus.textContent = message;
    };

    container.querySelector('#ttt-size-cycle').onclick = () => {
        state.boardSize = state.boardSize >= MAX_BOARD_SIZE ? MIN_BOARD_SIZE : state.boardSize + 1;
        renderSize();
    };
    container.querySelector('#ttt-size-down').onclick = () => {
        state.boardSize = clampBoardSize(state.boardSize - 1);
        renderSize();
    };
    container.querySelector('#ttt-size-up').onclick = () => {
        state.boardSize = clampBoardSize(state.boardSize + 1);
        renderSize();
    };

    container.querySelector('#ttt-local-mode').onclick = () => {
        startLocalGame(container, state);
        startScreen?.remove();
    };

    container.querySelector('#ttt-online-mode').onclick = async () => {
        setOnlineStatus('Controllo stanza online...');
        const started = await startOnlineGame(container, state);
        if (started) {
            startScreen?.remove();
        } else {
            setOnlineStatus(state.online.error || 'Crea o inserisci un codice multiplayer nella Sala Giochi, poi riapri Tic Tac Toe.');
            if (state.online.room?.code) {
                startOnlineWaiting(container, state, async () => {
                    setOnlineStatus('Giocatore connesso. Avvio partita online...');
                    const ready = await startOnlineGame(container, state);
                    if (ready) startScreen?.remove();
                });
            }
        }
    };

    renderLevelLadder('tictactoe', container.querySelector('#levels-container'), (selectedLevel) => {
        state.currentLevel = selectedLevel;
        startBotGame(container, state);
        startScreen?.remove();
    }, false, { windowSize: 2 });

    container.querySelector('#exit-btn').onclick = () => quitGame(container, state);
    container.querySelector('#back-menu').onclick = () => quitGame(container, state);
    container.querySelector('#ttt-menu').onclick = () => {
        cleanupOnline(state);
        renderLayout(container, createGameState());
    };
    container.querySelector('#ttt-reset').onclick = () => resetCurrentGame(container, state);

    renderSize();
}

function startBotGame(container, state) {
    cleanupOnline(state);
    state.mode = 'bot';
    resetBoardState(state, state.boardSize);
    state.currentLevel = Math.max(1, Math.floor(Number(state.currentLevel) || 1));
    state.status = 'playing';
    state.levelUnlocked = false;
    updateUI(container, state);
}

function startLocalGame(container, state) {
    cleanupOnline(state);
    state.mode = 'local';
    resetBoardState(state, state.boardSize);
    state.status = 'playing';
    updateUI(container, state);
}

async function startOnlineGame(container, state) {
    cleanupOnline(state);
    state.online.error = '';
    let room = getCurrentOnlineRoom();

    if (!room?.code) {
        const { room: createdRoom, error, unavailable } = await createMinigameRoom();
        if (createdRoom) {
            state.online.room = createdRoom;
            state.online.error = `Codice ${createdRoom.code} creato. Condividilo e attendi il secondo giocatore.`;
            return false;
        }

        state.online.error = unavailable
            ? 'Multiplayer non attivo su Supabase: esegui lo schema aggiornato.'
            : (error?.message || 'Codice online non creato.');
        return false;
    }

    const latest = await getMinigameRoomByCode(room.code);
    if (latest.room) room = latest.room;

    if (!isMinigameRoomConnected(room)) {
        state.online.room = room;
        state.online.error = room?.code
            ? `Codice ${room.code} in attesa. Fai inserire questo codice all'altro giocatore.`
            : 'Nessuna stanza online connessa.';
        return false;
    }

    state.mode = 'online';
    state.online.room = room;
    state.online.symbol = getOnlineSymbol(room);
    state.status = 'syncing';

    const remoteGame = normalizeRemoteGame(room.data?.[ONLINE_GAME_KEY]);
    if (remoteGame) {
        applyRemoteGame(remoteGame, state);
    } else {
        resetBoardState(state, state.boardSize);
        state.status = 'playing';
        const { error, room: nextRoom } = await pushOnlineGame(state);
        if (error) {
            state.online.error = error.message || 'Sincronizzazione online non riuscita.';
            return false;
        }
        if (nextRoom) state.online.room = nextRoom;
        state.online.error = '';
    }

    startOnlineWatch(container, state);
    updateUI(container, state);
    return true;
}

function getCurrentOnlineRoom() {
    const exposed = window.__tavernaMultiplayerConnection?.room || null;
    return exposed?.code ? exposed : getSavedMinigameRoom();
}

function getOnlineSymbol(room) {
    const clientId = getMinigameClientId();
    return room?.guestClientId === clientId ? BOT_SYMBOL : PLAYER_SYMBOL;
}

function resetBoardState(state, size) {
    const boardSize = clampBoardSize(size);
    state.boardSize = boardSize;
    state.winLength = getWinLength(boardSize);
    state.board = createEmptyBoard(boardSize);
    state.turn = PLAYER_SYMBOL;
    state.isAnimating = false;
    state.status = 'playing';
    state.winner = null;
    state.winningLine = [];
    state.drawReason = '';
    state.lastMove = null;
    if (state.online) state.online.error = '';
}

function resetCurrentGame(container, state) {
    if (state.mode === 'online') {
        resetBoardState(state, state.boardSize);
        pushOnlineGame(state).then(({ error, room }) => {
            if (error) state.online.error = error.message || 'Reset online non riuscito.';
            if (room) state.online.room = room;
            if (!error) state.online.error = '';
            updateUI(container, state);
        });
        updateUI(container, state);
        return;
    }

    if (state.mode === 'bot') {
        state.levelUnlocked = false;
    }
    resetBoardState(state, state.boardSize);
    updateUI(container, state);
}

function startOnlineWatch(container, state) {
    const code = state.online.room?.code;
    if (!code) return;

    state.online.stopWatch = watchMinigameRoom(code, (room) => {
        state.online.room = room;
        const remoteGame = normalizeRemoteGame(room.data?.[ONLINE_GAME_KEY]);
        if (remoteGame) {
            applyRemoteGame(remoteGame, state);
            updateUI(container, state);
        }
    });

    state.online.pollTimer = window.setInterval(async () => {
        const { room } = await getMinigameRoomByCode(code);
        if (!room) return;
        state.online.room = room;
        const remoteGame = normalizeRemoteGame(room.data?.[ONLINE_GAME_KEY]);
        if (remoteGame) {
            applyRemoteGame(remoteGame, state);
            updateUI(container, state);
        }
    }, 2500);
}

function startOnlineWaiting(container, state, onConnected) {
    cleanupOnline(state);
    const code = state.online.room?.code;
    if (!code) return;

    const handleRoom = (room) => {
        if (!room) return;
        state.online.room = room;
        if (isMinigameRoomConnected(room)) {
            cleanupOnline(state);
            onConnected?.();
        }
    };

    state.online.stopWatch = watchMinigameRoom(code, handleRoom);
    state.online.pollTimer = window.setInterval(async () => {
        const { room } = await getMinigameRoomByCode(code);
        handleRoom(room);
    }, 2500);

    updateUI(container, state);
}

function cleanupOnline(state) {
    if (state?.online?.stopWatch) state.online.stopWatch();
    if (state?.online?.pollTimer) window.clearInterval(state.online.pollTimer);
    if (state?.online) {
        state.online.stopWatch = null;
        state.online.pollTimer = null;
        state.online.busy = false;
    }
}

async function pushOnlineGame(state) {
    if (!state.online.room?.code || state.online.busy) return { room: state.online.room, error: null };
    state.online.busy = true;
    const game = serializeRemoteGame(state);
    const result = await updateMinigameRoomData(state.online.room.code, (currentData) => ({
        ...currentData,
        [ONLINE_GAME_KEY]: game
    }));
    state.online.busy = false;
    if (!result.error) state.online.error = '';
    return result;
}

function serializeRemoteGame(state) {
    return {
        id: state.remoteGameId || `ttt-${Date.now()}`,
        boardSize: state.boardSize,
        winLength: state.winLength,
        board: state.board,
        turn: state.turn,
        status: state.status,
        winner: state.winner,
        winningLine: state.winningLine,
        drawReason: state.drawReason,
        lastMove: state.lastMove,
        updatedBy: getMinigameClientId(),
        updatedAt: new Date().toISOString()
    };
}

function normalizeRemoteGame(rawGame) {
    if (!rawGame || typeof rawGame !== 'object') return null;
    const boardSize = clampBoardSize(rawGame.boardSize);
    const expectedCells = boardSize * boardSize;
    const board = Array.isArray(rawGame.board)
        ? rawGame.board.slice(0, expectedCells).map(cell => (cell === PLAYER_SYMBOL || cell === BOT_SYMBOL ? cell : ''))
        : createEmptyBoard(boardSize);
    while (board.length < expectedCells) board.push('');

    return {
        id: rawGame.id || `ttt-${Date.now()}`,
        boardSize,
        winLength: Math.min(boardSize, Math.max(MIN_BOARD_SIZE, Math.floor(Number(rawGame.winLength) || getWinLength(boardSize)))),
        board,
        turn: rawGame.turn === BOT_SYMBOL ? BOT_SYMBOL : PLAYER_SYMBOL,
        status: ['playing', 'won', 'draw'].includes(rawGame.status) ? rawGame.status : 'playing',
        winner: rawGame.winner === PLAYER_SYMBOL || rawGame.winner === BOT_SYMBOL ? rawGame.winner : null,
        winningLine: Array.isArray(rawGame.winningLine) ? rawGame.winningLine : [],
        drawReason: rawGame.drawReason || '',
        lastMove: Number.isInteger(rawGame.lastMove) ? rawGame.lastMove : null
    };
}

function applyRemoteGame(remoteGame, state) {
    state.remoteGameId = remoteGame.id;
    state.boardSize = remoteGame.boardSize;
    state.winLength = remoteGame.winLength;
    state.board = remoteGame.board;
    state.turn = remoteGame.turn;
    state.status = remoteGame.status;
    state.winner = remoteGame.winner;
    state.winningLine = remoteGame.winningLine;
    state.drawReason = remoteGame.drawReason;
    state.lastMove = remoteGame.lastMove;
    state.isAnimating = false;
}

function updateUI(container, state) {
    const boardUI = container.querySelector('#board-ui');
    if (!boardUI) return;

    boardUI.style.setProperty('--ttt-size', state.boardSize);
    boardUI.style.setProperty('--ttt-cell-font', `${Math.max(1.05, Math.min(4.2, 11 / state.boardSize)).toFixed(2)}rem`);
    boardUI.innerHTML = state.board.map((cell, index) => {
        const classes = [
            'tictactoe-cell',
            cell ? `is-${cell}` : '',
            state.lastMove === index ? 'last' : '',
            state.winningLine.includes(index) ? 'winning' : ''
        ].filter(Boolean).join(' ');
        const disabled = !canPlayCell(state, index) ? 'disabled' : '';
        const label = cell
            ? `Casella ${index + 1}, ${cell.toUpperCase()}`
            : `Casella ${index + 1}, vuota`;

        return `
            <button type="button" class="${classes}" data-cell-index="${index}" role="gridcell" aria-label="${label}" ${disabled}>
                <span>${cell ? cell.toUpperCase() : ''}</span>
            </button>
        `;
    }).join('');

    boardUI.querySelectorAll('[data-cell-index]').forEach(button => {
        button.onclick = () => handleCellClick(Number(button.dataset.cellIndex), container, state);
    });

    const turnIndicator = container.querySelector('#turn-indicator');
    if (turnIndicator) {
        const playerTurn = state.turn === PLAYER_SYMBOL;
        turnIndicator.textContent = getTurnLabel(state);
        turnIndicator.className = `game-turn-indicator ${playerTurn ? 'white-turn' : 'black-turn'}`;
    }

    const sizeMeta = container.querySelector('#ttt-size-meta');
    if (sizeMeta) sizeMeta.textContent = `${state.boardSize}×${state.boardSize} · linea da ${state.winLength}`;

    const modeMeta = container.querySelector('#ttt-online-meta');
    if (modeMeta) modeMeta.textContent = getModeMeta(state);

    const modeLabel = container.querySelector('#ttt-mode-label');
    if (modeLabel) modeLabel.textContent = getModeTitle(state);

    const status = container.querySelector('#ttt-status');
    if (status) status.textContent = getStatusText(state);

    const xLabel = container.querySelector('#ttt-x-label');
    const oLabel = container.querySelector('#ttt-o-label');
    xLabel?.classList.toggle('active', state.turn === PLAYER_SYMBOL && state.status === 'playing');
    oLabel?.classList.toggle('active', state.turn === BOT_SYMBOL && state.status === 'playing');
}

function canPlayCell(state, index) {
    if (state.status !== 'playing' || state.isAnimating || state.board[index]) return false;
    if (state.mode === 'bot') return state.turn === PLAYER_SYMBOL;
    if (state.mode === 'local') return true;
    if (state.mode === 'online') return state.online.symbol === state.turn;
    return false;
}

function handleCellClick(index, container, state) {
    if (!canPlayCell(state, index)) return;

    const symbol = state.mode === 'online' ? state.online.symbol : state.turn;
    playMove(state, index, symbol);
    updateUI(container, state);

    if (state.mode === 'online') {
        pushOnlineGame(state).then(({ error, room }) => {
            if (error) state.online.error = error.message || 'Mossa online non sincronizzata.';
            if (room) state.online.room = room;
            updateUI(container, state);
        });
        return;
    }

    if (state.mode === 'bot' && state.status === 'playing') {
        state.isAnimating = true;
        state.turn = BOT_SYMBOL;
        updateUI(container, state);
        window.setTimeout(() => makeBotMove(container, state), 520);
    }
}

function playMove(state, index, symbol) {
    if (state.board[index] || state.status !== 'playing') return;
    state.board = state.board.map((cell, cellIndex) => (cellIndex === index ? symbol : cell));
    state.lastMove = index;

    const result = evaluateBoard(state.board, state.boardSize, state.winLength);
    state.status = result.status;
    state.winner = result.winner;
    state.winningLine = result.winningLine;
    state.drawReason = result.drawReason;

    if (state.status === 'playing') {
        state.turn = symbol === PLAYER_SYMBOL ? BOT_SYMBOL : PLAYER_SYMBOL;
    } else {
        handleCompletedGame(state);
    }
}

function makeBotMove(container, state) {
    if (state.status !== 'playing') {
        state.isAnimating = false;
        updateUI(container, state);
        return;
    }

    const botIndex = chooseBotMove(state);
    if (Number.isInteger(botIndex)) playMove(state, botIndex, BOT_SYMBOL);
    state.isAnimating = false;
    updateUI(container, state);
}

function handleCompletedGame(state) {
    if (state.mode === 'bot' && state.winner === PLAYER_SYMBOL && !state.levelUnlocked) {
        unlockNextLevel('tictactoe', state.currentLevel);
        state.levelUnlocked = true;
    }
}

function evaluateBoard(board, boardSize, winLength) {
    const lines = getWinningLines(boardSize, winLength);

    for (const line of lines) {
        const first = board[line[0]];
        if (first && line.every(index => board[index] === first)) {
            return {
                status: 'won',
                winner: first,
                winningLine: line,
                drawReason: ''
            };
        }
    }

    const hasPossibleWin = lines.some(line => {
        const values = line.map(index => board[index]);
        return !values.includes(PLAYER_SYMBOL) || !values.includes(BOT_SYMBOL);
    });

    if (!hasPossibleWin) {
        return {
            status: 'draw',
            winner: null,
            winningLine: [],
            drawReason: 'stalemate'
        };
    }

    if (board.every(Boolean)) {
        return {
            status: 'draw',
            winner: null,
            winningLine: [],
            drawReason: 'full'
        };
    }

    return {
        status: 'playing',
        winner: null,
        winningLine: [],
        drawReason: ''
    };
}

function getWinningLines(boardSize, winLength) {
    const lines = [];
    const indexOf = (row, col) => row * boardSize + col;

    for (let row = 0; row < boardSize; row += 1) {
        for (let col = 0; col <= boardSize - winLength; col += 1) {
            lines.push(Array.from({ length: winLength }, (_, offset) => indexOf(row, col + offset)));
        }
    }

    for (let col = 0; col < boardSize; col += 1) {
        for (let row = 0; row <= boardSize - winLength; row += 1) {
            lines.push(Array.from({ length: winLength }, (_, offset) => indexOf(row + offset, col)));
        }
    }

    for (let row = 0; row <= boardSize - winLength; row += 1) {
        for (let col = 0; col <= boardSize - winLength; col += 1) {
            lines.push(Array.from({ length: winLength }, (_, offset) => indexOf(row + offset, col + offset)));
        }
    }

    for (let row = 0; row <= boardSize - winLength; row += 1) {
        for (let col = winLength - 1; col < boardSize; col += 1) {
            lines.push(Array.from({ length: winLength }, (_, offset) => indexOf(row + offset, col - offset)));
        }
    }

    return lines;
}

function chooseBotMove(state) {
    const emptyCells = state.board
        .map((cell, index) => (cell ? null : index))
        .filter(index => Number.isInteger(index));

    if (!emptyCells.length) return null;

    const accuracy = getLevelDifficultyChance(state.currentLevel, 0.2, 0.96);
    if (Math.random() > accuracy) {
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    const winningMove = findForcedMove(state, BOT_SYMBOL);
    if (Number.isInteger(winningMove)) return winningMove;

    const blockingMove = findForcedMove(state, PLAYER_SYMBOL);
    if (Number.isInteger(blockingMove)) return blockingMove;

    return scoreBestMove(state, emptyCells);
}

function findForcedMove(state, symbol) {
    const emptyCells = state.board
        .map((cell, index) => (cell ? null : index))
        .filter(index => Number.isInteger(index));

    return emptyCells.find(index => {
        const board = state.board.map((cell, cellIndex) => (cellIndex === index ? symbol : cell));
        return evaluateBoard(board, state.boardSize, state.winLength).winner === symbol;
    });
}

function scoreBestMove(state, emptyCells) {
    const lines = getWinningLines(state.boardSize, state.winLength);
    const center = (state.boardSize - 1) / 2;

    let bestScore = -Infinity;
    let bestCells = [];

    emptyCells.forEach(index => {
        const row = Math.floor(index / state.boardSize);
        const col = index % state.boardSize;
        let score = 0;

        lines.forEach(line => {
            if (!line.includes(index)) return;
            const values = line.map(cellIndex => state.board[cellIndex]);
            const botCount = values.filter(value => value === BOT_SYMBOL).length;
            const playerCount = values.filter(value => value === PLAYER_SYMBOL).length;

            if (playerCount === 0) score += 2 + (botCount * botCount * 4);
            if (botCount === 0) score += 1 + (playerCount * playerCount * 3);
        });

        const distanceFromCenter = Math.abs(row - center) + Math.abs(col - center);
        score += Math.max(0, state.boardSize - distanceFromCenter) * 0.25;
        score += Math.random() * 0.01;

        if (score > bestScore) {
            bestScore = score;
            bestCells = [index];
        } else if (score === bestScore) {
            bestCells.push(index);
        }
    });

    return bestCells[Math.floor(Math.random() * bestCells.length)];
}

function getTurnLabel(state) {
    if (state.status === 'won') return state.winner === PLAYER_SYMBOL ? 'VINCE X' : 'VINCE O';
    if (state.status === 'draw') return state.drawReason === 'stalemate' ? 'STALLO' : 'PAREGGIO';
    if (state.mode === 'bot' && state.turn === BOT_SYMBOL) return `BOT LV.${state.currentLevel} PENSA`;
    if (state.mode === 'online') {
        return state.online.symbol === state.turn ? 'TOCCA A TE' : 'TURNO AVVERSARIO';
    }
    return state.turn === PLAYER_SYMBOL ? 'TURNO X' : 'TURNO O';
}

function getModeTitle(state) {
    if (state.mode === 'bot') return `BOT LIVELLO ${state.currentLevel}`;
    if (state.mode === 'local') return 'OMINO → OMINO';
    if (state.mode === 'online') return 'OMINO → RETE';
    return 'TIC TAC TOE';
}

function getModeMeta(state) {
    if (state.mode === 'bot') return `Bot LV.${state.currentLevel}`;
    if (state.mode === 'online') {
        const code = state.online.room?.code || '------';
        return `Online ${code} · tu sei ${state.online.symbol.toUpperCase()}`;
    }
    return 'Locale';
}

function getStatusText(state) {
    if (state.online.error) return state.online.error;
    if (state.status === 'won') {
        if (state.mode === 'bot') {
            return state.winner === PLAYER_SYMBOL
                ? `Hai superato il Livello ${state.currentLevel}.`
                : `Il bot di Livello ${state.currentLevel} ha vinto.`;
        }
        return `Vittoria di ${state.winner.toUpperCase()}.`;
    }
    if (state.status === 'draw') {
        return state.drawReason === 'stalemate'
            ? 'Pareggio per stallo: non esiste più nessuna linea vincibile.'
            : 'Pareggio: griglia completa.';
    }
    if (state.mode === 'bot') {
        return state.turn === PLAYER_SYMBOL
            ? 'Piazza una X. Il bot risponde con O.'
            : 'Il bot sta calcolando la mossa.';
    }
    if (state.mode === 'online') {
        return state.online.symbol === state.turn
            ? `Tocca a te: piazza ${state.online.symbol.toUpperCase()}.`
            : 'Attendi la mossa dell’altro giocatore.';
    }
    if (state.mode === 'local') return `Piazza ${state.turn.toUpperCase()}.`;
    return 'Scegli una modalità.';
}
