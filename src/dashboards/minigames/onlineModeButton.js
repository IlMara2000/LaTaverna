import {
    createMinigameRoom,
    getMinigameClientId,
    getRoomParticipants,
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
                <small>Gioca con chi è nel multiplayer</small>
            </span>
        </button>
    </section>
    <p id="${gameId}-online-status" class="tictactoe-online-status minigame-online-status" aria-live="polite"></p>
`;

const getCurrentRoom = () => {
    const exposed = window.__tavernaMultiplayerConnection?.room || null;
    return getSavedMinigameRoom() || (exposed?.code && exposed.data?.scope !== 'magic' ? exposed : null);
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
    gameId = 'game', gameName = 'Gioco', minPlayers = 2, maxPlayers = 2, onConnected = () => {}
} = {}) {
    const button = container.querySelector(`#${gameId}-online-mode`);
    const status = container.querySelector(`#${gameId}-online-status`);
    let stopWatch, pollTimer, stopGame;
    let cancelled = false, busy = false, started = false;
    const setStatus = message => { if (status) status.textContent = message; };
    const stopWaiting = () => {
        stopWatch?.();
        clearInterval(pollTimer);
        stopWatch = null;
        pollTimer = null;
    };
    const root = [...container.children].find(child => child.tagName !== 'STYLE');
    const observer = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
    observer.observe(container, { childList: true });
    const cleanup = () => {
        cancelled = true;
        observer.disconnect();
        stopWaiting();
        stopGame?.();
        if (button) button.disabled = false;
    };
    const handleRoom = room => {
        if (cancelled || started) return;
        if (!room || room.status === 'closed') {
            stopWaiting();
            busy = false;
            if (button) button.disabled = false;
            setStatus('La stanza non è più disponibile. Ricollegati dal pannello Multiplayer.');
            return;
        }
        exposeRoom(room);
        if (!isMinigameRoomConnected(room) || getRoomParticipants(room).length < minPlayers) {
            setStatus(`Codice ${room.code}: servono almeno ${minPlayers} giocatori. Nessun bot verrà aggiunto.`); return;
        }
        const client = getMinigameClientId();
        if (!getRoomParticipants(room).slice(0, maxPlayers).includes(client)) {
            setStatus(`Questo gioco ammette ${maxPlayers} giocatori. Crea una stanza dedicata per giocare.`);
            return;
        }
        started = true;
        stopWaiting();
        setStatus(`${gameName}: collegamento al giocatore…`);
        stopGame = onConnected(room);
    };
    const startOnline = async () => {
        if (busy || cancelled || started) return;
        busy = true;
        if (button) button.disabled = true;
        setStatus('Controllo collegamento online…');
        try {
            const saved = getCurrentRoom();
            const result = saved?.code ? await getMinigameRoomByCode(saved.code) : await createMinigameRoom();
            if (cancelled) return;
            if (result.error || !result.room) throw result.error || new Error('Stanza scaduta. Ricollegati dal pannello Multiplayer.');
            const room = result.room;
            handleRoom(room);
            if (started) return;
            setStatus(`Codice ${room.code}: in attesa di almeno ${minPlayers} giocatori. Nessun bot verrà aggiunto.`);
            stopWatch = watchMinigameRoom(room.code, handleRoom);
            let polling = false;
            pollTimer = setInterval(async () => {
                if (polling) return;
                polling = true;
                try {
                    const latest = await getMinigameRoomByCode(room.code);
                    if (!cancelled && !started) {
                        if (latest.error) setStatus('Connessione non disponibile. Riprovo…');
                        else handleRoom(latest.room);
                    }
                } catch { if (!cancelled && !started) setStatus('Connessione non disponibile. Riprovo…'); }
                finally { polling = false; }
            }, 2500);
        } catch (error) {
            if (!cancelled) {
                setStatus(error.message || 'Collegamento online non riuscito. Riprova.');
                busy = false;
                if (button) button.disabled = false;
            }
        }
    };
    if (button) button.onclick = startOnline;
    return cleanup;
}
