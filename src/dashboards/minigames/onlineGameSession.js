import { getRoomParticipants, getMinigameClientId, getMinigameRoomByCode, updateMinigameRoomData, watchMinigameRoom, isMinigameRoomConnected } from '../../services/minigameMultiplayer.js';
import { onlineSeat, enterMatch, changeMatch, isPresent } from './onlineMatchProtocol.js';

export function connectOnlineGame(container, state, { gameId, room, read, apply, maxPlayers = 2, mode = 'turns', allowInputWhileSyncing = false, onStatus = () => {} }) {
    const seat = onlineSeat(room, getMinigameClientId());
    const roster = getRoomParticipants(room).slice(0, maxPlayers);
    if (seat >= roster.length) throw new Error(`Questo gioco ammette ${maxPlayers} giocatori. Crea una stanza dedicata.`);
    state.onlineSeat = seat;
    state.onlineDisposed = false;
    const root = [...container.children].find(child => child.tagName !== 'STYLE');
    const banner = document.createElement('p');
    banner.setAttribute('role', 'status');
    banner.className = 'minigame-session-status';
    banner.style.cssText = 'position:fixed;bottom:4px;left:50%;transform:translateX(-50%);z-index:20001;background:#170d24;color:white;padding:8px 16px;border-radius:12px;font-size:12px;max-width:90vw;text-align:center;pointer-events:none';
    root.appendChild(banner);
    let disposed = false, pending = false, polling = false, match = null, revision = -1, healthy = false;
    let errorMessage = '', lastHeartbeat = 0;
    const refresh = () => {
        state.onlineReady = !disposed && healthy && (!pending || allowInputWhileSyncing) && match?.presence.every(time => isPresent(time));
        onStatus(Boolean(state.onlineReady));
        banner.textContent = errorMessage || (pending && !allowInputWhileSyncing ? 'Sincronizzazione…' : state.onlineReady
            ? 'Online · avversario umano collegato' : 'In attesa dell’altro giocatore: aprite entrambi lo stesso gioco.');
    };
    const receive = (nextRoom, force = false) => {
        if (disposed) return;
        healthy = isMinigameRoomConnected(nextRoom);
        const next = nextRoom?.data?.onlineMatch;
        if (next?.gameId !== gameId || !next.roster?.every((id, i) => id === roster[i]) || (match && next.id !== match.id)) {
            healthy = false;
            refresh();
            return;
        }
        if (next.revision < revision) { refresh(); return; }
        match = next;
        if (force || next.revision > revision) {
            revision = next.revision;
            apply(structuredClone(next.state), seat);
        }
        refresh();
    };
    // Block gameplay during pairing, writes and connection loss, while keeping exits usable.
    const gate = event => {
        if (state.onlineReady && !state.isAnimating) return;
        const button = event.target.closest('button');
        if (button && /exit|back-menu|help|modal-close|modal-levels/.test(`${button.id} ${button.dataset.action || ''}`)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    root.addEventListener('click', gate, true);
    refresh();
    const stopWatch = watchMinigameRoom(room.code, next => receive(next));
    const controller = {
        async commit(reducer = null) {
            if (disposed || pending || !match) return false;
            const previous = structuredClone(match.state);
            const next = reducer ? null : read(seat);
            const expected = revision;
            pending = true;
            refresh();
            try {
                const result = await updateMinigameRoomData(room.code, data => {
                    if (!reducer) return changeMatch(data, match.id, seat, expected, next);
                    const current = data.onlineMatch;
                    if (current?.id !== match.id || !current.presence.every(time => isPresent(time))) throw new Error('In attesa dei partecipanti.');
                    return { ...data, onlineMatch: { ...current, state: reducer(structuredClone(current.state), seat), revision: current.revision + 1 } };
                });
                if (disposed) return false;
                errorMessage = result.error?.message || '';
                if (result.error) {
                    apply(previous, seat);
                    if (result.room) receive(result.room, true);
                    return false;
                }
                receive(result.room, true);
                return true;
            } catch {
                if (!disposed) apply(previous, seat);
                revision = -1;
                healthy = false;
                errorMessage = 'Connessione interrotta. La mossa non è stata salvata.';
                return false;
            } finally { pending = false; refresh(); }
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            state.onlineDisposed = true;
            state.onlineReady = false;
            stopWatch();
            clearInterval(timer);
            observer.disconnect();
            root.removeEventListener('click', gate, true);
            banner.remove();
            if (match) void updateMinigameRoomData(room.code, data => {
                if (data.onlineMatch?.id !== match.id) return data;
                return { ...data, onlineMatch: { ...data.onlineMatch, presence: data.onlineMatch.presence.map((time, i) => i === seat ? null : time) } };
            }).catch(() => {});
        }
    };
    state.onlineSync = controller;
    const poll = async () => {
        refresh();
        if (disposed || polling || pending) return;
        if (!root.isConnected) { controller.dispose(); return; }
        polling = true;
        try {
            const result = match && Date.now() - lastHeartbeat > 10000
                ? await updateMinigameRoomData(room.code, data => {
                    if (data.onlineMatch?.id !== match.id) throw new Error('La partita è terminata. Rientra nel gioco.');
                    return { ...data, onlineMatch: { ...data.onlineMatch,
                        presence: data.onlineMatch.presence.map((time, i) => i === seat ? Date.now() : time) } };
                })
                : await getMinigameRoomByCode(room.code);
            if (Date.now() - lastHeartbeat > 10000) lastHeartbeat = Date.now();
            errorMessage = result.error?.message || '';
            if (result.error) healthy = false;
            else receive(result.room);
        } catch { healthy = false; errorMessage = 'Connessione interrotta. Riconnessione in corso…'; }
        finally { polling = false; refresh(); }
    };
    const timer = setInterval(poll, 2500);
    const observer = new MutationObserver(() => { if (!root.isConnected) controller.dispose(); });
    observer.observe(container, { childList: true });
    pending = true;
    void updateMinigameRoomData(room.code, data => enterMatch(data, gameId, seat, read(0), roster, Date.now(), mode))
        .then(result => {
            if (disposed) return;
            errorMessage = result.error?.message || '';
            if (!result.error) receive(result.room, true);
        }).catch(() => { errorMessage = 'Impossibile avviare la partita online. Esci e riprova.'; })
        .finally(() => { pending = false; refresh(); });
    return () => controller.dispose();
}
