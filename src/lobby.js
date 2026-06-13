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
        <div id="lobby-wrapper" class="taverna-home">
            <header class="taverna-home-header">
                <img src="/assets/logo2.png" alt="" aria-hidden="true">
                <h1>LA TAVERNA</h1>
            </header>

            <main class="taverna-home-main">
                <section class="taverna-scene-stage" aria-label="Scegli come giocare">
                    <button type="button" class="taverna-scene scene-cards" id="hub-card-games">
                        <img src="/assets/home/portal-cards.jpg" alt="Carte italiane su un tavolo da gioco" fetchpriority="high">
                        <span class="taverna-scene-scrim" aria-hidden="true"></span>
                        <span class="taverna-scene-title">CARTE</span>
                    </button>

                    <button type="button" class="taverna-scene scene-party" id="hub-party-games">
                        <img src="/assets/home/portal-party.jpg" alt="Gioco da tavolo con pedine colorate" loading="lazy">
                        <span class="taverna-scene-scrim" aria-hidden="true"></span>
                        <span class="taverna-scene-title">CON AMICI</span>
                    </button>

                    <button type="button" class="taverna-scene scene-gdr" id="hub-gdr-games">
                        <img src="/assets/home/portal-gdr.jpg" alt="Mappa fantasy, dadi e miniatura da gioco di ruolo" loading="lazy">
                        <span class="taverna-scene-scrim" aria-hidden="true"></span>
                        <span class="taverna-scene-title">GDR</span>
                    </button>
                </section>

                <nav class="taverna-home-dock" aria-label="Destinazioni rapide">
                    ${lastDestinationInfo ? `
                        <button type="button" id="resume-last-destination" class="is-resume">
                            <small>RIPRENDI</small>
                            <strong>${escapeHTML(lastDestinationInfo.name)}</strong>
                        </button>
                    ` : ''}
                    <button type="button" id="hub-all-games">SALA GIOCHI</button>
                    <button type="button" id="hub-strategy-games">STRATEGIA</button>
                    <button type="button" id="btn-dnd5e">D&amp;D 5E</button>
                    <button type="button" id="btn-pathfinder2e">PATHFINDER 2E</button>
                </nav>
            </main>
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

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const openWithTransition = (button, destination, options = {}) => {
        if (!button || reducedMotion) {
            openDestination(destination, options);
            return;
        }
        button.classList.add('is-opening');
        window.setTimeout(() => openDestination(destination, options), 340);
    };

    const scenes = [...container.querySelectorAll('.taverna-scene')];
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => entry.target.classList.toggle('is-in-view', entry.isIntersecting));
    }, { threshold: 0.46 });
    scenes.forEach(scene => observer.observe(scene));

    const stage = container.querySelector('.taverna-scene-stage');
    const handlePointerMove = event => {
        const bounds = stage.getBoundingClientRect();
        stage.style.setProperty('--pointer-x', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 16}px`);
        stage.style.setProperty('--pointer-y', `${((event.clientY - bounds.top) / bounds.height - 0.5) * 12}px`);
    };
    const resetPointer = () => {
        stage.style.setProperty('--pointer-x', '0px');
        stage.style.setProperty('--pointer-y', '0px');
    };
    stage?.addEventListener('pointermove', handlePointerMove);
    stage?.addEventListener('pointerleave', resetPointer);
    window.__homeCleanup = () => {
        observer.disconnect();
        stage?.removeEventListener('pointermove', handlePointerMove);
        stage?.removeEventListener('pointerleave', resetPointer);
    };

    const cardScene = container.querySelector('#hub-card-games');
    const partyScene = container.querySelector('#hub-party-games');
    const gdrScene = container.querySelector('#hub-gdr-games');
    container.querySelector('#resume-last-destination')?.addEventListener('click', event => {
        openWithTransition(event.currentTarget, lastDestination.destination, lastDestination.options || {});
    });
    cardScene.onclick = () => openWithTransition(cardScene, 'minigames', { filter: 'cards' });
    partyScene.onclick = () => openWithTransition(partyScene, 'minigames', { filter: 'party' });
    gdrScene.onclick = () => openWithTransition(gdrScene, 'dnd5e');
    container.querySelector('#hub-strategy-games').onclick = event => openWithTransition(event.currentTarget, 'minigames', { filter: 'strategy' });
    container.querySelector('#hub-all-games').onclick = event => openWithTransition(event.currentTarget, 'minigames', { filter: 'all' });
    container.querySelector('#btn-dnd5e').onclick = event => openWithTransition(event.currentTarget, 'dnd5e');
    container.querySelector('#btn-pathfinder2e').onclick = event => openWithTransition(event.currentTarget, 'pathfinder2e');
}
