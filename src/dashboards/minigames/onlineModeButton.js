import {
    createMinigameRoom,
    getSavedMinigameRoom,
    getMinigameRoomByCode,
    isMinigameRoomConnected,
    watchMinigameRoom
} from '../../services/minigameMultiplayer.js';

const ARROW_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12h13"></path>
        <path d="m13 6 6 6-6 6"></path>
    </svg>
`;

export const renderOnlineModeButton = (gameId = 'game') => `
    <section class="tictactoe-mode-panel minigame-online-mode-panel" aria-label="Modalità online">
        <button type="button" id="${gameId}-online-mode" class="tictactoe-mode-button minigame-online-mode-button">
            <span class="tictactoe-mode-icon" aria-hidden="true">👤</span>
            ${ARROW_ICON}
            <span class="tictactoe-mode-icon" aria-hidden="true">🌐</span>
            <span class="tictactoe-mode-copy">
                <strong>ONLINE</strong>
                <small>Omino contro rete</small>
            </span>
        </button>
    </section>
    <p id="${gameId}-online-status" class="tictactoe-online-status minigame-online-status" aria-live="polite"></p>
`;

const getCurrentRoom = () => {
    const exposed = window.__tavernaMultiplayerConnection?.room || null;
    return exposed?.code ? exposed : getSavedMinigameRoom();
};

const exposeRoom = (room = null) => {
    window.__tavernaMultiplayerConnection = room?.code ? {
        scope: 'minigames',
        code: room.code,
        status: room.status,
        connected: isMinigameRoomConnected(room),
        room
    } : null;
};

export function bindOnlineModeButton(container, {
    gameId = 'game',
    gameName = 'Gioco',
    onConnected = () => {}
} = {}) {
    const button = container.querySelector(`#${gameId}-online-mode`);
    const status = container.querySelector(`#${gameId}-online-status`);
    let stopWatch = null;
    let pollTimer = null;
    let busy = false;

    const setStatus = (message = '') => {
        if (status) status.textContent = message;
    };

    const cleanup = () => {
        if (stopWatch) stopWatch();
        if (pollTimer) window.clearInterval(pollTimer);
        stopWatch = null;
        pollTimer = null;
        busy = false;
        if (button) button.disabled = false;
    };

    const startConnectedGame = (room) => {
        cleanup();
        exposeRoom(room);
        onConnected(room);
    };

    const waitForConnection = (room) => {
        cleanup();
        if (!room?.code) return;
        exposeRoom(room);
        setStatus(`Codice ${room.code} in attesa. Fallo inserire all'altro giocatore.`);

        const handleRoom = (nextRoom) => {
            if (!nextRoom) return;
            exposeRoom(nextRoom);
            if (isMinigameRoomConnected(nextRoom)) {
                setStatus(`${gameName} online connesso. Avvio partita...`);
                startConnectedGame(nextRoom);
            }
        };

        stopWatch = watchMinigameRoom(room.code, handleRoom);
        pollTimer = window.setInterval(async () => {
            const { room: nextRoom } = await getMinigameRoomByCode(room.code);
            handleRoom(nextRoom);
        }, 2500);
    };

    const startOnline = async () => {
        if (busy) return;
        busy = true;
        if (button) button.disabled = true;
        setStatus('Controllo collegamento online...');

        let room = getCurrentRoom();
        if (!room?.code) {
            const { room: createdRoom, error, unavailable } = await createMinigameRoom();
            busy = false;
            if (button) button.disabled = false;

            if (createdRoom) {
                waitForConnection(createdRoom);
                return;
            }

            setStatus(unavailable
                ? 'Multiplayer non attivo su Supabase.'
                : (error?.message || 'Codice online non creato.'));
            return;
        }

        const latest = await getMinigameRoomByCode(room.code);
        if (latest.room) room = latest.room;

        busy = false;
        if (button) button.disabled = false;

        if (isMinigameRoomConnected(room)) {
            startConnectedGame(room);
        } else {
            waitForConnection(room);
        }
    };

    if (button) button.onclick = startOnline;
    return cleanup;
}
