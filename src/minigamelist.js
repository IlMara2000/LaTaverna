import { updateSidebarContext } from './components/layout/Sidebar.js';
import { showLobby } from './lobby.js';
import { MINIGAMES, MINIGAME_CATEGORIES, getGamesByCategory } from './services/experienceCatalog.js';
import { rememberDestination } from './services/appNavigation.js';
import {
    createMinigameRoom,
    getMinigameRoomByCode,
    getSavedMinigameRoom,
    isMinigameRoomConnected,
    joinMinigameRoom,
    watchMinigameRoom
} from './services/minigameMultiplayer.js';

export function showMinigamesList(container, options = {}) {
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

    let activeFilter = ['cards', 'party', 'strategy'].includes(options.filter) ? options.filter : 'all';
    rememberDestination('minigames', { filter: activeFilter });

    // RIMOSSA la classe .dashboard-container che creava il bordo invisibile!
    // Ora è un layout puro e piatto.
    container.innerHTML = `
        <div id="lobby-wrapper" class="minigames-lobby-wrapper fade-in">
            
            <div style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 30px;">
                <button id="btn-back-main" class="btn-back-glass" style="width: auto; margin-bottom: 0;">
                    ← TORNA ALLA TAVERNA
                </button>
            </div>
            
            <header style="margin: 10px 0 28px 0; text-align: center;">
                <h1 class="main-title" style="margin: 0; font-size: 3rem; filter: drop-shadow(0 0 15px rgba(157,78,221,0.4));">SALA GIOCHI</h1>
            </header>

            <nav class="session-tool-switcher" id="minigame-filters" aria-label="Categorie minigiochi" style="margin-bottom: 18px;">
                <button type="button" data-game-filter="all">Tutti</button>
                <button type="button" data-game-filter="cards">Carte</button>
                <button type="button" data-game-filter="party">Con amici</button>
                <button type="button" data-game-filter="strategy">Strategia</button>
            </nav>

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

            <div id="minigame-catalog"></div>
            
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

    const launchGame = async (game) => {
        try {
            stopWatchingRoom();
            const module = await import(`./dashboards/minigames/${game.id}.js`);
            if (module && module[game.initFn]) {
                module[game.initFn](container);
            }
        } catch (err) {
            console.error(`Errore nel caricamento del gioco ${game.id}:`, err);
        }
    };

    const renderGameCatalog = () => {
        const catalog = container.querySelector('#minigame-catalog');
        const visibleCategories = activeFilter === 'all'
            ? MINIGAME_CATEGORIES
            : MINIGAME_CATEGORIES.filter(category => category.id === activeFilter);

        catalog.innerHTML = visibleCategories.map(category => {
            const games = getGamesByCategory(category.id);
            return `
                <section class="lobby-section" data-game-category="${category.id}" style="margin-top: 26px;">
                    <h2 class="subtitle" style="opacity: 0.72; font-size: 0.82rem; letter-spacing: 2px; margin-bottom: 6px;">${category.name.toUpperCase()}</h2>
                    <div class="grid-layout">
                        ${games.map(game => `
                            <button type="button" class="game-card" data-launch-game="${game.id}" style="background: ${game.color}; min-height: 176px; align-items: center; justify-content: space-between; text-align: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 20px rgba(0,0,0,0.3);">
                                <div style="font-size: 2.4rem; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));">${game.icon}</div>
                                <div>
                                    <h3 style="margin: 0; font-size: 1rem; font-weight: 900; color: white; letter-spacing: 1px; text-transform: uppercase;">${game.name}</h3>
                                    <small style="color: rgba(255,255,255,0.58); font-weight: 800;">${game.players} · ${game.duration}</small>
                                </div>
                            </button>
                        `).join('')}
                    </div>
                </section>
            `;
        }).join('');

        container.querySelectorAll('[data-launch-game]').forEach(button => {
            const game = MINIGAMES.find(item => item.id === button.dataset.launchGame);
            if (game) button.onclick = () => launchGame(game);
        });

        container.querySelectorAll('[data-game-filter]').forEach(button => {
            const active = button.dataset.gameFilter === activeFilter;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    };

    container.querySelectorAll('[data-game-filter]').forEach(button => {
        button.onclick = () => {
            activeFilter = button.dataset.gameFilter || 'all';
            rememberDestination('minigames', { filter: activeFilter });
            renderGameCatalog();
        };
    });
    renderGameCatalog();

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

}

export const showMinigamesLobby = showMinigamesList;
