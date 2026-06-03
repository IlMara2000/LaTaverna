import { updateSidebarContext } from './components/layout/Sidebar.js';
import { showLobby } from './lobby.js';
import {
    createMinigameRoom,
    getMinigameRoomByCode,
    getSavedMinigameRoom,
    isMinigameRoomConnected,
    joinMinigameRoom,
    watchMinigameRoom
} from './services/minigameMultiplayer.js';

export function showMinigamesList(container) {
    if (window.__minigameMultiplayerCleanup) {
        window.__minigameMultiplayerCleanup();
        window.__minigameMultiplayerCleanup = null;
    }

    // Reset dello scroll per evitare blocchi
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    window.scrollTo(0, 0);

    if (typeof updateSidebarContext === 'function') {
        updateSidebarContext("minigames");
    }

    // LISTA GIOCHI (Scopa e Solitario rimossi)
    const games = [
        { id: 'briscola', name: 'BRISCOLA', color: 'linear-gradient(135deg, #2a0a4a, #4a1a6a)', icon: '⚔️', initFn: 'initBriscola' },
        { id: 'solo', name: 'SOLO', color: 'linear-gradient(135deg, #ff4444, #ffcc00)', icon: '🃏', initFn: 'initSoloGame' },
        { id: 'impostore', name: 'IMPOSTORE', color: 'linear-gradient(135deg, #ff3366, #330011)', icon: '🕵️‍♂️', initFn: 'initImpostore' },
        { id: 'burraco', name: 'BURRACO', color: 'linear-gradient(135deg, #004d40, #00241a)', icon: '♣️', initFn: 'initBurraco' },
        { id: 'scacchi', name: 'SCACCHI', color: 'linear-gradient(135deg, #333333, #000000)', icon: '♟️', initFn: 'initScacchi' },
        { id: 'numeri', name: 'NUMERI', color: 'linear-gradient(135deg, #0f766e, #134e4a)', icon: '🔢', initFn: 'initNumeri' }
    ];

    // RIMOSSA la classe .dashboard-container che creava il bordo invisibile!
    // Ora è un layout puro e piatto.
    container.innerHTML = `
        <div id="lobby-wrapper" class="minigames-lobby-wrapper fade-in">
            
            <div style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 30px;">
                <button id="btn-back-main" class="btn-back-glass" style="width: auto; margin-bottom: 0;">
                    ← TORNA ALLA LIBRERIA
                </button>
            </div>
            
            <header style="margin: 10px 0 40px 0; text-align: center;">
                <p style="font-size: 0.8rem; letter-spacing: 3px; opacity: 0.6; margin-bottom: 5px; text-transform: uppercase;">Divertimento Veloce</p>
                <h1 class="main-title" style="margin: 0; font-size: 3rem; filter: drop-shadow(0 0 15px rgba(157,78,221,0.4));">MINI GIOCHI</h1>
            </header>

            <section class="minigame-multiplayer-panel" aria-label="Multiplayer minigiochi">
                <form id="minigame-multiplayer-join" class="minigame-multiplayer-join">
                    <input id="minigame-multiplayer-code-input" type="text" inputmode="latin" maxlength="6" autocomplete="off" aria-label="Codice multiplayer" placeholder="INSERISCI CODICE">
                    <button type="submit">INVIA</button>
                </form>

                <button type="button" id="btn-minigame-multiplayer" class="minigame-multiplayer-main">
                    <span class="minigame-multiplayer-dot" id="minigame-multiplayer-dot" aria-hidden="true"></span>
                    <span>MULTIPLAYER</span>
                </button>

                <div id="minigame-multiplayer-code" class="minigame-multiplayer-code" hidden>
                    <small>Codice collegamento</small>
                    <strong>------</strong>
                </div>

                <p id="minigame-multiplayer-status" class="minigame-multiplayer-status">Non connesso</p>
            </section>

            <div class="grid-layout">
                ${games.map(game => `
                    <div class="game-card" id="btn-${game.id}" style="background: ${game.color}; min-height: 140px; justify-content: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 20px rgba(0,0,0,0.3);">
                        <div style="font-size: 2.8rem; margin-bottom: 10px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));">${game.icon}</div>
                        <h2 style="margin: 0; font-size: 0.9rem; font-weight: 900; color: white; letter-spacing: 1px;">${game.name}</h2>
                    </div>
                `).join('')}
            </div>
            
        </div>
    `;

    let multiplayerRoom = getSavedMinigameRoom();
    let stopRoomWatch = null;
    let pollTimer = null;
    const clientCanPoll = () => Boolean(multiplayerRoom?.code);

    const exposeMultiplayerRoom = () => {
        window.__tavernaMultiplayerConnection = multiplayerRoom ? {
            scope: 'minigames',
            code: multiplayerRoom.code,
            status: multiplayerRoom.status,
            connected: isMinigameRoomConnected(multiplayerRoom),
            room: multiplayerRoom
        } : null;
    };

    const setMultiplayerBusy = (busy) => {
        const hostButton = document.getElementById('btn-minigame-multiplayer');
        const joinButton = document.querySelector('#minigame-multiplayer-join button');
        if (hostButton) hostButton.disabled = busy;
        if (joinButton) joinButton.disabled = busy;
    };

    const renderMultiplayerState = (message = '') => {
        const panel = document.querySelector('.minigame-multiplayer-panel');
        const dot = document.getElementById('minigame-multiplayer-dot');
        const status = document.getElementById('minigame-multiplayer-status');
        const codeBox = document.getElementById('minigame-multiplayer-code');
        const hostButton = document.getElementById('btn-minigame-multiplayer');
        const connected = isMinigameRoomConnected(multiplayerRoom);

        panel?.classList.toggle('is-connected', connected);
        dot?.classList.toggle('is-connected', connected);

        if (codeBox) {
            codeBox.hidden = !multiplayerRoom?.code;
            const codeText = codeBox.querySelector('strong');
            if (codeText) codeText.textContent = multiplayerRoom?.code || '------';
        }

        if (hostButton) {
            hostButton.querySelector('span:last-child').textContent = multiplayerRoom?.code ? 'MULTIPLAYER ATTIVO' : 'MULTIPLAYER';
        }

        if (status) {
            if (message) {
                status.textContent = message;
            } else if (connected) {
                status.textContent = 'Connesso';
            } else if (multiplayerRoom?.code) {
                status.textContent = 'In attesa di connessione';
            } else {
                status.textContent = 'Non connesso';
            }
        }

        exposeMultiplayerRoom();
    };

    const stopWatchingRoom = () => {
        if (stopRoomWatch) stopRoomWatch();
        stopRoomWatch = null;
        if (pollTimer) window.clearInterval(pollTimer);
        pollTimer = null;
    };

    const startWatchingRoom = (room) => {
        stopWatchingRoom();
        if (!room?.code) return;

        stopRoomWatch = watchMinigameRoom(room.code, nextRoom => {
            multiplayerRoom = nextRoom;
            renderMultiplayerState();
        });

        pollTimer = window.setInterval(async () => {
            if (!clientCanPoll()) return;
            const { room: nextRoom } = await getMinigameRoomByCode(multiplayerRoom.code);
            if (nextRoom) {
                multiplayerRoom = nextRoom;
                renderMultiplayerState();
            }
        }, 3500);
    };

    if (multiplayerRoom?.code) {
        renderMultiplayerState();
        startWatchingRoom(multiplayerRoom);
    } else {
        renderMultiplayerState();
    }

    window.__minigameMultiplayerCleanup = () => {
        stopWatchingRoom();
    };

    document.getElementById('minigame-multiplayer-code-input').oninput = (event) => {
        event.target.value = String(event.target.value || '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 6);
    };

    // Torna alla lobby principale
    document.getElementById('btn-back-main').onclick = () => {
        stopWatchingRoom();
        showLobby(container);
    };

    document.getElementById('btn-minigame-multiplayer').onclick = async () => {
        setMultiplayerBusy(true);
        renderMultiplayerState('Creazione codice...');
        const { room, error, unavailable } = await createMinigameRoom();
        setMultiplayerBusy(false);

        if (room) {
            multiplayerRoom = room;
            renderMultiplayerState('Codice creato. Condividilo con l’altro dispositivo.');
            startWatchingRoom(room);
            return;
        }

        renderMultiplayerState(unavailable
            ? 'Multiplayer non attivo su Supabase: esegui lo schema aggiornato.'
            : (error?.message || 'Codice non creato.'));
    };

    document.getElementById('minigame-multiplayer-join').onsubmit = async (event) => {
        event.preventDefault();
        const input = document.getElementById('minigame-multiplayer-code-input');
        const code = input?.value || '';
        setMultiplayerBusy(true);
        renderMultiplayerState('Connessione...');
        const { room, error, unavailable } = await joinMinigameRoom(code);
        setMultiplayerBusy(false);

        if (room) {
            multiplayerRoom = room;
            input.value = '';
            renderMultiplayerState();
            startWatchingRoom(room);
            return;
        }

        renderMultiplayerState(unavailable
            ? 'Multiplayer non attivo su Supabase: esegui lo schema aggiornato.'
            : (error?.message || 'Connessione non riuscita.'));
    };

    // Assegna il caricamento dinamico per ogni bottone
    games.forEach(game => {
        const btn = document.getElementById(`btn-${game.id}`);
        if (btn) {
            btn.onclick = async (e) => {
                e.preventDefault();
                try {
                    stopWatchingRoom();
                    // Percorso relativo esatto per i minigiochi
                    const module = await import(`./dashboards/minigames/${game.id}.js`);
                    if (module && module[game.initFn]) {
                        module[game.initFn](container);
                    }
                } catch (err) {
                    console.error(`Errore nel caricamento del gioco ${game.id}:`, err);
                }
            };
        }
    });
}

export const showMinigamesLobby = showMinigamesList;
