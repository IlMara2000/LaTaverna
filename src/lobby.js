import { updateSidebarContext } from './components/layout/Sidebar.js';
import { APP_DESTINATIONS } from './services/experienceCatalog.js';
import { getLastDestination, navigateTo } from './services/appNavigation.js';
import { enhanceHomeMotion } from './services/motionSystem.js';

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
    window.__homeCleanup?.();
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
            <div class="taverna-home-ambient ambient-one" aria-hidden="true"></div>
            <div class="taverna-home-ambient ambient-two" aria-hidden="true"></div>
            <header class="taverna-home-header">
                <div class="taverna-wordmark">
                <img src="/assets/logo2.png" alt="" aria-hidden="true">
                <span>LA TAVERNA<small>GIOCHI, STORIE, COMPAGNIA</small></span>
                </div>
                <span class="taverna-home-badge"><span aria-hidden="true">✧</span> Il tuo prossimo capitolo</span>
            </header>

            <div class="taverna-home-main">
                <section class="taverna-welcome" aria-labelledby="home-title">
                    <span class="crystal-eyebrow">BENVENUTO NELLA TAVERNA</span>
                    <h1 id="home-title">Prenditi un momento.<br><em>Entra in un altro mondo.</em></h1>
                    <p>Una mano di carte, una sfida tra amici, una nuova avventura.<br>Il tuo posto al tavolo ti aspetta.</p>
                </section>
                <section class="taverna-scene-stage" aria-label="Scegli come giocare">
                    <button type="button" class="taverna-scene scene-cards" id="hub-card-games">
                        <img src="/assets/home/portal-cards.jpg" alt="Carte italiane su un tavolo da gioco" fetchpriority="high" decoding="async">
                        <span class="taverna-scene-scrim" aria-hidden="true"></span>
                        <span class="scene-number" aria-hidden="true">01 / CARTE</span>
                        <span class="taverna-scene-caption"><span class="scene-symbol" aria-hidden="true">🃏</span><span class="taverna-scene-title">Giochi di Carte</span><span class="scene-description">I grandi classici, il tuo prossimo asso.</span><span class="scene-link">Scopri i giochi di carte <b aria-hidden="true">↗</b></span></span>
                    </button>

                    <button type="button" class="taverna-scene scene-party" id="hub-party-games">
                        <img src="/assets/home/portal-party.jpg" alt="Gioco da tavolo con pedine colorate" loading="lazy" decoding="async">
                        <span class="taverna-scene-scrim" aria-hidden="true"></span>
                        <span class="scene-number" aria-hidden="true">02 / CON AMICI</span>
                        <span class="taverna-scene-caption"><span class="scene-symbol" aria-hidden="true">🎲</span><span class="taverna-scene-title">Giochi da Tavolo</span><span class="scene-description">Piccole sfide, grandi risate.</span><span class="scene-link">Invita i tuoi amici <b aria-hidden="true">↗</b></span></span>
                    </button>

                    <button type="button" class="taverna-scene scene-gdr" id="hub-gdr-games">
                        <img src="/assets/home/portal-gdr.jpg" alt="Mappa fantasy, dadi e miniatura da gioco di ruolo" loading="lazy" decoding="async">
                        <span class="taverna-scene-scrim" aria-hidden="true"></span>
                        <span class="scene-number" aria-hidden="true">03 / GIOCHI DI RUOLO</span>
                        <span class="taverna-scene-caption"><span class="scene-symbol" aria-hidden="true">🐉</span><span class="taverna-scene-title">Giochi di Ruolo</span><span class="scene-description">Tira i dadi. Scrivi la tua leggenda.</span><span class="scene-link">Inizia un’avventura <b aria-hidden="true">↗</b></span></span>
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
                    <button type="button" id="hub-shop">BOTTEGA</button>
                    <button type="button" id="hub-reading">LETTURA</button>
                    <button type="button" id="btn-dnd5e">D&amp;D 5E</button>
                </nav>
                <p class="taverna-home-footer"><span aria-hidden="true">✦</span> Le storie più belle si giocano insieme.</p>
            </div>
        </div>
    `;

    const openDestination = (destination, options = {}) => {
        const isProtectedGdr = destination === 'dnd5e';
        if (isProtectedGdr && guest.isGuest && !guest.isLocalDndGuest) {
            alert('Accedi per aprire i tavoli GDR.');
            return;
        }
        return navigateTo(destination, container, options);
    };

    const motionCleanup = enhanceHomeMotion(container);
    window.__homeCleanup = () => {
        motionCleanup?.();
    };

    const cardScene = container.querySelector('#hub-card-games');
    const partyScene = container.querySelector('#hub-party-games');
    const gdrScene = container.querySelector('#hub-gdr-games');
    container.querySelector('#resume-last-destination')?.addEventListener('click', () => {
        openDestination(lastDestination.destination, lastDestination.options || {});
    });
    cardScene.onclick = () => openDestination('minigames', { filter: 'cards' });
    partyScene.onclick = () => openDestination('minigames', { filter: 'party' });
    gdrScene.onclick = () => openDestination('dnd5e');
    container.querySelector('#hub-strategy-games').onclick = () => openDestination('minigames', { filter: 'strategy' });
    container.querySelector('#hub-all-games').onclick = () => openDestination('minigames', { filter: 'all' });
    container.querySelector('#hub-shop').onclick = () => openDestination('shop');
    container.querySelector('#hub-reading').onclick = () => openDestination('reading');
    container.querySelector('#btn-dnd5e').onclick = () => openDestination('dnd5e');
}
