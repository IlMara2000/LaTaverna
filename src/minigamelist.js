import {syncDestinationPath} from './services/publicRoutes.js';
import {recordActivity} from './services/communityMetrics.js';
import { setExperienceTheme } from './services/experienceTheme.js';
import { renderHomeBackButton } from './components/ui/BackButton.js';
import { loadView } from './services/navigationLoading.js';
import { updateSidebarContext } from './components/layout/Sidebar.js';
import { MINIGAMES, MINIGAME_CATEGORIES, getGamesByCategory } from './services/experienceCatalog.js';
import { rememberDestination, navigateTo, resetAppSurface } from './services/appNavigation.js';
import { enhanceSurfaceMotion } from './services/motionSystem.js';
import {subscribePlatformRoom} from './services/platformMultiplayer.js';
import {getRoomParticipants} from './services/minigameMultiplayer.js';

const FANTASY_GAME_MARKS = { briscola: '♠︎', scopa: '♦︎', solitario: '♥︎', solo: '✦', burraco: '♣︎', impostore: '◈', numeri: 'Ⅶ', tictactoe: '✕', scacchi: '♞', dama: '◉', blocchi: '▦' };

export function showMinigamesList(container, options = {}) {
    window.__homeCleanup?.();
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

    const cardsOnly = options.filter === 'cards';
    if (typeof updateSidebarContext === 'function') {
        updateSidebarContext(cardsOnly ? "cards" : "minigames");
    }

    let activeFilter = ['cards', 'party', 'strategy'].includes(options.filter) ? options.filter : 'all';
    rememberDestination(cardsOnly ? 'cardGames' : 'minigames', { filter: activeFilter });

    syncDestinationPath(cardsOnly ? 'cardGames' : 'minigames');

    // RIMOSSA la classe .dashboard-container che creava il bordo invisibile!
    // Ora è un layout puro e piatto.
    container.innerHTML = `
        <div id="lobby-wrapper" class="minigames-lobby-wrapper fade-in">

            <div style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 30px;">
                ${cardsOnly ? '<button type="button" class="app-back-button" id="btn-back-main">← La Taverna</button>' : renderHomeBackButton({ id: 'btn-back-main' })}
            </div>

            <header class="world-catalog-header" style="margin: 10px 0 28px 0; text-align: center;">
                <span class="crystal-eyebrow">IL PIACERE DI STARE AL TAVOLO</span>
                <h1 class="main-title">${cardsOnly ? 'Carte' : 'Minigiochi'}</h1>
                <p class="catalog-intro">Ritrova un classico o lasciati sorprendere da una nuova sfida.</p>
            </header>

            <nav class="session-tool-switcher" id="minigame-filters" aria-label="Categorie minigiochi" style="margin-bottom: 18px;">
                ${cardsOnly ? '<button type="button" id="open-collection">Cerchi Magic? → MTCG</button>' : `<button type="button" data-game-filter="all">Tutti i minigiochi</button><button type="button" data-game-filter="party">Da compagnia</button><button type="button" data-game-filter="strategy">Strategia</button><button type="button" id="open-collection">Cerchi i giochi di carte? → Carte</button>`}
            </nav>

            <section class="minigame-multiplayer-panel"><button id="open-multiplayer" type="button">Multiplayer →</button><p id="platform-connection-status" role="status">Collegati nella sezione Multiplayer, poi scegli Online nel gioco.</p></section>

            <div id="minigame-catalog"></div>

        </div>
    `;

    let catalogMotionCleanup=null;
    const stopConnection=subscribePlatformRoom(({room,error})=>{
        const status=container.querySelector('#platform-connection-status');
        if(status)status.textContent=error?error.message:room?`Codice ${room.code} · ${getRoomParticipants(room).length} partecipanti · scegliete lo stesso gioco e premete Online`:'Collegati nella sezione Multiplayer, poi scegli Online nel gioco.';
    });
    container.querySelector('#open-multiplayer').onclick=()=>navigateTo('multiplayer',container);
    window.__minigameMultiplayerCleanup=()=>{stopConnection();catalogMotionCleanup?.();};

    const launchGame = game => loadView(container, async () => {
        const module = await import(`./dashboards/minigames/${game.id}.js`);
        if (typeof module[game.initFn] !== 'function') throw new Error('Gioco non disponibile');
        return context => {
            if (context.beforeRender()) { module[game.initFn](container); void recordActivity('game_started'); }
        };
    }, { label: game.name, beforeRender: resetAppSurface });

    const renderGameCatalog = () => {
        setExperienceTheme(activeFilter, 'catalog');
        const catalog = container.querySelector('#minigame-catalog');
        const visibleCategories = activeFilter === 'all'
            ? MINIGAME_CATEGORIES.filter(category => category.id !== 'cards')
            : MINIGAME_CATEGORIES.filter(category => category.id === activeFilter);

        catalog.innerHTML = visibleCategories.map(category => {
            const games = getGamesByCategory(category.id);
            return `
                <section class="lobby-section" data-game-category="${category.id}" style="margin-top: 26px;">
                    <h2 class="subtitle" style="opacity: 0.72; font-size: 0.82rem; letter-spacing: 2px; margin-bottom: 6px;">${category.name.toUpperCase()}</h2>
                    <div class="grid-layout">
                        ${games.map(game => `
                            <button type="button" class="game-card catalog-game-card" data-launch-game="${game.id}">
                                <span class="catalog-game-art" aria-hidden="true"><span class="catalog-game-icon">${FANTASY_GAME_MARKS[game.id] || game.icon}</span></span>
                                <div class="catalog-game-copy">
                                    <h3>${game.name}</h3>
                                    <small>${game.players} · ${game.duration}</small><p class="world-game-description">${game.description}</p>
                                </div>
                                <span class="catalog-game-arrow" aria-hidden="true">Gioca <b>↗</b></span>
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

        catalogMotionCleanup?.();
        catalogMotionCleanup = enhanceSurfaceMotion(catalog, {
            selector: '.lobby-section, .game-card'
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
            rememberDestination(cardsOnly ? 'cardGames' : 'minigames', { filter: activeFilter });
            renderGameCatalog();
        };
    });
    renderGameCatalog();

    document.getElementById('btn-back-main').onclick=()=>navigateTo('home',container);
    container.querySelector('#open-collection').onclick=()=>navigateTo(cardsOnly?'mtcg':'cards',container);

}

export const showMinigamesLobby = showMinigamesList;
