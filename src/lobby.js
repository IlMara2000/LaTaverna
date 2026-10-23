import './styles/appHierarchy.css';
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
                <span class="taverna-home-badge"><span aria-hidden="true">✧</span> Oltre la soglia, la leggenda</span>
            </header>

            <div class="taverna-home-main">
                <section class="taverna-welcome" aria-labelledby="home-title">
                    <span class="crystal-eyebrow">UN RIFUGIO PER CHI CERCA ALTRE STORIE</span>
                    <h1 id="home-title">Ogni notte,<br><em>una nuova leggenda.</em></h1>
                    <p>Una mano di carte, una sfida tra amici, una nuova avventura.<br>Il tuo posto al tavolo ti aspetta.</p>
                </section>
                <div class="home-section-label"><span>Esplora la Taverna</span></div>
                <section class="taverna-scene-stage" aria-label="Le quattro aree della Taverna">
                    <button type="button" class="taverna-scene scene-cards" id="hub-card-games">
                        <img src="/assets/worlds/handwritten-triptych.webp" alt="Carte illustrate a inchiostro tra le dita di un guanto medievale" fetchpriority="high" decoding="async">
                        <span class="taverna-scene-scrim" aria-hidden="true"></span>
                        <span class="scene-number" aria-hidden="true">I · LA SORTE</span>
                        <span class="taverna-scene-caption"><span class="scene-symbol" aria-hidden="true">🃏</span><span class="taverna-scene-title">Carte</span><span class="scene-description">I grandi classici da giocare.</span><span class="scene-link">Esplora le carte <b aria-hidden="true">↗</b></span></span>
                    </button>

                    <button type="button" class="taverna-scene scene-party" id="hub-party-games">
                        <img src="/assets/worlds/handwritten-triptych.webp" alt="Cavallo degli scacchi e dadi disegnati a mano" loading="lazy" decoding="async">
                        <span class="taverna-scene-scrim" aria-hidden="true"></span>
                        <span class="scene-number" aria-hidden="true">II · LA SFIDA</span>
                        <span class="taverna-scene-caption"><span class="scene-symbol" aria-hidden="true">🎲</span><span class="taverna-scene-title">Minigiochi</span><span class="scene-description">Piccole sfide, grandi risate.</span><span class="scene-link">Scegli una sfida <b aria-hidden="true">↗</b></span></span>
                    </button>

                    <button type="button" class="taverna-scene scene-gdr" id="hub-gdr-games">
                        <img src="/assets/worlds/handwritten-triptych.webp" alt="Avventuriero incappucciato sotto una luna ametista" loading="lazy" decoding="async">
                        <span class="taverna-scene-scrim" aria-hidden="true"></span>
                        <span class="scene-number" aria-hidden="true">III · LA LEGGENDA</span>
                        <span class="taverna-scene-caption"><span class="scene-symbol" aria-hidden="true">🐉</span><span class="taverna-scene-title">Giochi di ruolo</span><span class="scene-description">Tira i dadi. Scrivi la tua leggenda.</span><span class="scene-link">Inizia un’avventura <b aria-hidden="true">↗</b></span></span>
                    </button>

                    <button type="button" class="taverna-scene scene-reading" id="hub-reading">
                        <img src="/assets/worlds/reading-nook.webp" alt="Un angolo della Taverna dedicato alla lettura" loading="lazy" decoding="async">
                        <span class="taverna-scene-scrim" aria-hidden="true"></span>
                        <span class="scene-number" aria-hidden="true">IV · LE STORIE</span>
                        <span class="taverna-scene-caption"><span class="taverna-scene-title">Lettura</span><span class="scene-description">La tua biblioteca, la bacheca e le raccolte.</span><span class="scene-link">Apri la biblioteca <b aria-hidden="true">↗</b></span></span>
                    </button>
                </section>

                <nav class="taverna-home-dock" aria-label="Riprendi e servizi della Taverna">
                    ${lastDestinationInfo ? `
                        <button type="button" id="resume-last-destination" class="is-resume">
                            <small>RIPRENDI</small>
                            <strong>${escapeHTML(lastDestinationInfo.name)}</strong>
                        </button>
                    ` : ''}
                    <button type="button" id="hub-multiplayer">MULTIPLAYER</button><button type="button" id="hub-mtcg">MTCG</button><button type="button" id="hub-shop">BOTTEGA</button>
                    <button type="button" id="hub-oracle">L’ORACOLO</button>
                </nav>
                <p class="taverna-home-footer"><span aria-hidden="true">✦</span> Le storie più belle si giocano insieme.</p>
            </div>
        </div>
    `;

    const openDestination = (destination, options = {}) => {
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
    cardScene.onclick = () => openDestination('cards');
    partyScene.onclick = () => openDestination('minigames');
    gdrScene.onclick = () => openDestination('rpg');
    container.querySelector('#hub-multiplayer').onclick=()=>openDestination('multiplayer');
    container.querySelector('#hub-mtcg').onclick=()=>openDestination('mtcg');
    container.querySelector('#hub-shop').onclick = () => openDestination('shop');
    container.querySelector('#hub-reading').onclick = () => openDestination('reading');
    container.querySelector('#hub-oracle').onclick = () => openDestination('oracle');
}
