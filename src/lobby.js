import { updateSidebarContext } from './components/layout/Sidebar.js';
import { APP_DESTINATIONS } from './services/experienceCatalog.js';
import { getLastDestination, navigateTo } from './services/appNavigation.js';

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const getGuestState = () => {
    try {
        const guestUser = JSON.parse(localStorage.getItem('taverna_guest_user') || 'null');
        return {
            isGuest: Boolean(guestUser),
            isLocalDndGuest: Boolean(guestUser?.isLocalDnd),
            name: guestUser?.name || guestUser?.user_metadata?.full_name || 'Ospite'
        };
    } catch {
        return { isGuest: false, isLocalDndGuest: false, name: 'Viandante' };
    }
};

export function showLobby(container) {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    document.body.style.backgroundColor = '';
    window.scrollTo(0, 0);

    updateSidebarContext('home');

    const guest = getGuestState();
    const lastDestination = getLastDestination();
    const lastDestinationInfo = APP_DESTINATIONS[lastDestination?.destination] || null;
    container.innerHTML = `
        <div id="lobby-wrapper" style="width: 100%; animation: cardEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;">
            <div class="dashboard-container" style="padding-bottom: calc(120px + env(safe-area-inset-bottom));">
                <header class="lobby-header" style="margin-bottom: 24px;">
                    <h1 class="main-title">LA <span class="text-amethyst">TAVERNA</span></h1>
                </header>

                ${lastDestinationInfo ? `
                    <button type="button" id="resume-last-destination" class="game-card portal-card is-clickable" style="width: 100%; color: white; text-align: center; outline: none; -webkit-tap-highlight-color: transparent;">
                        <div class="card-content">
                            <p class="subtitle" style="margin: 0 0 8px; opacity: 0.56; font-size: 0.68rem; letter-spacing: 2px;">RIPRENDI</p>
                            <h2 class="card-title" style="margin-bottom: 6px;">${escapeHTML(lastDestinationInfo.name)}</h2>
                        </div>
                    </button>
                ` : ''}

                <section class="lobby-section" style="margin-top: 28px;">
                    <div class="grid-layout">
                        <button type="button" class="game-card is-clickable" id="hub-card-games" style="color: white; text-align: center; outline: none;">
                            <span style="font-size: 2rem;" aria-hidden="true">🃏</span>
                            <div class="card-content">
                                <h2 class="card-title-sm">CARTE</h2>
                            </div>
                        </button>

                        <button type="button" class="game-card is-clickable" id="hub-party-games" style="color: white; text-align: center; outline: none;">
                            <span style="font-size: 2rem;" aria-hidden="true">🎉</span>
                            <div class="card-content">
                                <h2 class="card-title-sm">CON AMICI</h2>
                            </div>
                        </button>

                        <button type="button" class="game-card is-clickable" id="hub-strategy-games" style="color: white; text-align: center; outline: none;">
                            <span style="font-size: 2rem;" aria-hidden="true">♟️</span>
                            <div class="card-content">
                                <h2 class="card-title-sm">STRATEGIA</h2>
                            </div>
                        </button>

                        <button type="button" class="game-card is-clickable" id="hub-all-games" style="color: white; text-align: center; outline: none;">
                            <span style="font-size: 2rem;" aria-hidden="true">🎮</span>
                            <div class="card-content">
                                <h2 class="card-title-sm">SALA GIOCHI</h2>
                            </div>
                        </button>
                    </div>
                </section>

                <section class="lobby-section" style="margin-top: 30px;">
                    <h2 class="subtitle" style="opacity: 0.62; font-size: 0.82rem; letter-spacing: 2px; margin-bottom: 12px;">GDR</h2>
                    <button type="button" class="game-card is-clickable" id="btn-dnd5e" style="width: 100%; color: white; text-align: center; outline: none; -webkit-tap-highlight-color: transparent;">
                        <div class="card-content">
                            <h2 class="card-title-sm">🐉 DUNGEONS & DRAGONS 5E</h2>
                        </div>
                    </button>
                    <button type="button" class="game-card is-clickable" id="btn-pathfinder2e" style="width: 100%; color: white; text-align: center; outline: none; margin-top: 14px; -webkit-tap-highlight-color: transparent;">
                        <div class="card-content">
                            <h2 class="card-title-sm">🧭 PATHFINDER 2E</h2>
                        </div>
                    </button>
                </section>
            </div>
        </div>
    `;

    const openDestination = (destination, options = {}) => {
        const isProtectedGdr = destination === 'dnd5e' || destination === 'pathfinder2e';
        if (isProtectedGdr && guest.isGuest && !guest.isLocalDndGuest) {
            alert('Accedi per aprire i tavoli GDR.');
            return;
        }
        navigateTo(destination, container, options);
    };

    container.querySelector('#resume-last-destination')?.addEventListener('click', () => {
        openDestination(lastDestination.destination, lastDestination.options || {});
    });
    container.querySelector('#hub-card-games').onclick = () => openDestination('minigames', { filter: 'cards' });
    container.querySelector('#hub-party-games').onclick = () => openDestination('minigames', { filter: 'party' });
    container.querySelector('#hub-strategy-games').onclick = () => openDestination('minigames', { filter: 'strategy' });
    container.querySelector('#hub-all-games').onclick = () => openDestination('minigames', { filter: 'all' });
    container.querySelector('#btn-dnd5e').onclick = () => openDestination('dnd5e');
    container.querySelector('#btn-pathfinder2e').onclick = () => openDestination('pathfinder2e');
}
