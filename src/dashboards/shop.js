import { renderHomeBackButton } from '../components/ui/BackButton.js';
import { animate, hover, inView, press, stagger } from 'motion';
import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { navigateTo } from '../services/appNavigation.js';
import { prefersReducedMotion } from '../services/motionSystem.js';
import './shop.css';

const CART_KEY = 'taverna_bottega_request_v1';
const AGE_KEY = 'taverna_bottega_adult_confirmed';

const PRODUCTS = [
    {
        id: 'bruno-antico',
        name: 'Bruno Antico',
        category: 'scuri',
        collection: 'FINITURA SCURA',
        availability: 'CONCEPT — SU RICHIESTA',
        image: '/assets/shop/product-bruno-antico.jpg',
        cutout: '/assets/shop/product-bruno-antico-cutout.webp',
        viewerAngle: '-55deg',
        imageAlt: 'Render 3D completo del bocchino Bruno Antico, scuro e scolpito',
        description: 'Una lettura 3D del carattere più rustico: venatura profonda, profilo irregolare e impugnatura scandita.',
        facts: ['Render indicativo', 'Misura da confermare', 'Finitura da definire']
    },
    {
        id: 'spirale-chiara',
        name: 'Spirale Chiara',
        category: 'chiari',
        collection: 'FINITURA CHIARA',
        availability: 'CONCEPT — SU RICHIESTA',
        image: '/assets/shop/product-spirale-chiara.jpg',
        cutout: '/assets/shop/product-spirale-chiara-cutout.webp',
        viewerAngle: '70deg',
        imageAlt: 'Render 3D completo del bocchino Spirale Chiara in legno chiaro',
        description: 'Il concept più luminoso, con un ritmo morbido di anelli scolpiti e una silhouette interamente visibile.',
        facts: ['Render indicativo', 'Profilo a spirale', 'Tonalità da confermare']
    },
    {
        id: 'ametista-regale',
        name: 'Ametista Regale',
        category: 'ametista',
        collection: 'EDIZIONE AMETISTA',
        availability: 'CONCEPT — SU RICHIESTA',
        image: '/assets/shop/product-ametista-regale.jpg',
        cutout: '/assets/shop/product-ametista-regale-cutout.webp',
        viewerAngle: '48deg',
        imageAlt: 'Render 3D completo del bocchino Ametista Regale viola con dettagli color ottone',
        description: 'Una variante scenografica ametista con riflessi profondi e sottili dettagli color ottone.',
        facts: ['Render indicativo', 'Accenti da concordare', 'Finitura speciale da verificare']
    },
    {
        id: 'ossidiana-corvo',
        name: 'Ossidiana del Corvo',
        category: 'ossidiana',
        collection: 'EDIZIONE OSSIDIANA',
        availability: 'CONCEPT — SU RICHIESTA',
        image: '/assets/shop/product-ossidiana.jpg',
        cutout: '/assets/shop/product-ossidiana-cutout.webp',
        viewerAngle: '50deg',
        imageAlt: 'Render 3D completo del bocchino Ossidiana del Corvo nero con collare color bronzo',
        description: 'Nero materico, profilo affusolato e un unico accento color bronzo per la versione più austera.',
        facts: ['Render indicativo', 'Profilo da confermare', 'Accento metallico opzionale']
    }
];

const HERO_PRODUCT = PRODUCTS.find(product => product.id === 'ametista-regale');
const STORY_PRODUCT = PRODUCTS.find(product => product.id === 'spirale-chiara');

const FILTERS = [
    { id: 'all', label: 'Tutti' },
    { id: 'scuri', label: 'Scuri' },
    { id: 'chiari', label: 'Chiari' },
    { id: 'ametista', label: 'Ametista' },
    { id: 'ossidiana', label: 'Ossidiana' }
];

const BAG_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 8h12l1 12H5L6 8Z"></path>
        <path d="M9 9V6a3 3 0 0 1 6 0v3"></path>
    </svg>
`;

const ARROW_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12h14"></path><path d="m14 7 5 5-5 5"></path>
    </svg>
`;

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const loadCart = () => {
    try {
        const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
        return Array.isArray(value)
            ? value.filter(item => PRODUCTS.some(product => product.id === item.id) && Number(item.quantity) > 0)
                .map(item => ({ id: item.id, quantity: Math.min(9, Math.floor(Number(item.quantity))) }))
            : [];
    } catch {
        return [];
    }
};

const saveCart = cart => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* storage facoltativo */ }
};

export function initShop(container) {
    if (!container) return;
    window.__shopCleanup?.();
    try { updateSidebarContext('shop'); } catch { /* sidebar opzionale */ }
    const sidebarMenu = document.querySelector('#sidebar-menu');
    if (sidebarMenu) sidebarMenu.inert = true;

    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    document.body.style.backgroundColor = '#070409';
    window.scrollTo(0, 0);

    const state = {
        cart: loadCart(),
        filter: 'all',
        activeProduct: null,
        viewerPaused: false,
        motionCleanup: [],
        eventCleanup: [],
        animationStarted: false
    };

    container.innerHTML = renderShop();
    const root = container.querySelector('#artisan-shop');
    renderProducts(root, state);
    renderCart(root, state);
    bindShop(root, state, container);

    let confirmed = false;
    try { confirmed = localStorage.getItem(AGE_KEY) === 'true'; } catch { /* storage facoltativo */ }
    const ageGate = root.querySelector('#shop-age-gate');
    ageGate.hidden = confirmed;
    root.classList.toggle('has-overlay', !confirmed);
    syncOverlayState(root);
    if (confirmed) startMotion(root, state);
    else window.requestAnimationFrame(() => root.querySelector('#shop-age-confirm')?.focus());

    window.__shopCleanup = () => {
        state.motionCleanup.forEach(cleanup => {
            try {
                if (typeof cleanup === 'function') cleanup();
                else cleanup?.stop?.();
            } catch { /* cleanup non bloccante */ }
        });
        state.eventCleanup.forEach(cleanup => cleanup());
        state.motionCleanup = [];
        state.eventCleanup = [];
        document.body.style.backgroundColor = '';
        if (sidebarMenu) sidebarMenu.inert = false;
        window.__shopCleanup = null;
    };
}

function renderShop() {
    return `
        <div id="artisan-shop" class="artisan-shop">
            <div class="shop-scroll-progress" aria-hidden="true"><i id="shop-scroll-progress"></i></div>
            <div class="shop-ambient shop-ambient-one" aria-hidden="true"></div>
            <div class="shop-ambient shop-ambient-two" aria-hidden="true"></div>
            <div class="shop-grain" aria-hidden="true"></div>

            <header class="shop-topbar">
                ${renderHomeBackButton({ id: 'shop-back' })}
                <a href="#shop-top" class="shop-wordmark" aria-label="Torna in cima alla Bottega del Viandante">
                    <span class="shop-wordmark-seal" aria-hidden="true">B</span>
                    <span><small>LA TAVERNA</small><strong>BOTTEGA DEL VIANDANTE</strong></span>
                </a>
                <button id="shop-cart-trigger" class="shop-cart-trigger" type="button" aria-label="Apri lista richieste">
                    ${BAG_ICON}
                    <span>RICHIESTA</span>
                    <b id="shop-cart-count">0</b>
                </button>
            </header>

            <main id="shop-top" class="shop-main">
                <section id="shop-hero" class="shop-hero" aria-labelledby="shop-title">
                    <div class="shop-hero-copy">
                        <span class="shop-kicker">BOCCHINI ARTIGIANALI · PEZZI UNICI</span>
                        <h1 id="shop-title"><span>RITUALE</span><em>ARTIGIANO</em></h1>
                        <p>Forme scolpite, finiture materiche e dettagli da concordare. Una vetrina per accessori personali realizzati in piccole quantità.</p>
                        <div class="shop-hero-actions">
                            <button class="shop-primary-action" type="button" data-scroll-catalog>
                                SCOPRI I PEZZI ${ARROW_ICON}
                            </button>
                            <button class="shop-secondary-action" type="button" data-scroll-story>COME NASCONO</button>
                        </div>
                        <div class="shop-hero-notes" aria-label="Informazioni sulla vetrina">
                            <span><b>01</b> NESSUN TABACCO</span>
                            <span><b>02</b> DETTAGLI SU RICHIESTA</span>
                            <span><b>03</b> SOLO ADULTI</span>
                        </div>
                    </div>

                    <div class="shop-hero-visual" aria-label="Concept 3D completo di ${HERO_PRODUCT.name}">
                        <div class="shop-orbit orbit-large" aria-hidden="true"></div>
                        <div class="shop-orbit orbit-small" aria-hidden="true"></div>
                        <figure class="shop-hero-photo">
                            <img src="${HERO_PRODUCT.image}" alt="${HERO_PRODUCT.imageAlt}" fetchpriority="high">
                            <span class="shop-photo-light" aria-hidden="true"></span>
                            <figcaption><small>CONCEPT 3D</small><strong>${HERO_PRODUCT.name}</strong></figcaption>
                        </figure>
                        <span class="shop-floating-label label-one">EDIZIONE<br>AMETISTA</span>
                        <span class="shop-floating-label label-two">FORMA<br>INTERA</span>
                    </div>

                    <div class="shop-scroll-cue" aria-hidden="true"><span></span>SCORRI</div>
                </section>

                <div class="shop-marquee" aria-hidden="true">
                    <div>
                        <span>FINITURE MATERICHE</span><i>✦</i><span>PICCOLE QUANTITÀ</span><i>✦</i><span>DETTAGLI PERSONALI</span><i>✦</i>
                        <span>FINITURE MATERICHE</span><i>✦</i><span>PICCOLE QUANTITÀ</span><i>✦</i><span>DETTAGLI PERSONALI</span><i>✦</i>
                    </div>
                </div>

                <section id="shop-catalog" class="shop-catalog shop-reveal-section" aria-labelledby="shop-catalog-title">
                    <header class="shop-section-heading">
                        <div>
                            <span class="shop-kicker">COLLEZIONE ATTUALE</span>
                            <h2 id="shop-catalog-title">SCEGLI IL TUO <em>CARATTERE</em></h2>
                        </div>
                        <p>Scorri tra i concept e tocca una foto per aprire il pezzo isolato nella nuova rotazione 3D verticale.</p>
                    </header>
                    <nav class="shop-filters" aria-label="Filtra la collezione">
                        ${FILTERS.map((filter, index) => `
                            <button type="button" data-shop-filter="${filter.id}" class="${index === 0 ? 'active' : ''}" aria-pressed="${index === 0 ? 'true' : 'false'}">${filter.label}</button>
                        `).join('')}
                    </nav>
                    <div class="shop-product-rail-head">
                        <span id="shop-rail-status" class="shop-rail-status" aria-live="polite">01 / 04</span>
                        <span class="shop-rail-progress" aria-hidden="true"><i id="shop-rail-progress"></i></span>
                        <span class="shop-rail-controls">
                            <button id="shop-rail-prev" type="button" aria-label="Mostra la variante precedente">←</button>
                            <button id="shop-rail-next" type="button" aria-label="Mostra la variante successiva">→</button>
                        </span>
                    </div>
                    <div id="shop-product-grid" class="shop-product-grid" role="list" tabindex="0" aria-label="Concept 3D dei bocchini, scorri orizzontalmente"></div>
                    <p class="shop-rail-hint"><span aria-hidden="true">↔</span> TRASCINA, SCORRI O USA LE FRECCE</p>
                </section>

                <section id="shop-story" class="shop-story shop-reveal-section" aria-labelledby="shop-story-title">
                    <div class="shop-story-image">
                        <img src="${STORY_PRODUCT.image}" alt="${STORY_PRODUCT.imageAlt}" loading="lazy">
                        <span>CONCEPT COMPLETO<br>${STORY_PRODUCT.name.toUpperCase()}</span>
                    </div>
                    <div class="shop-story-copy">
                        <span class="shop-kicker">DALLA FORMA AL DETTAGLIO</span>
                        <h2 id="shop-story-title">NON UNA SERIE.<br><em>UNA PRESENZA.</em></h2>
                        <p>La superficie non viene nascosta: venature, variazioni e piccole irregolarità diventano parte dell’identità. Prima della lavorazione si concordano forma, tonalità e finitura.</p>
                        <ol>
                            <li><b>01</b><span><strong>SCEGLI LA DIREZIONE</strong><small>Chiaro, scuro, essenziale o scolpito.</small></span></li>
                            <li><b>02</b><span><strong>CONFERMA I DETTAGLI</strong><small>Misure, materiale e disponibilità vengono verificati.</small></span></li>
                            <li><b>03</b><span><strong>NASCE IL PEZZO</strong><small>Tempi e condizioni sono comunicati prima di iniziare.</small></span></li>
                        </ol>
                    </div>
                </section>

                <section class="shop-responsible shop-reveal-section" aria-label="Informazioni importanti">
                    <span aria-hidden="true">18+</span>
                    <div>
                        <strong>ACCESSORI PER FUMATORI ADULTI</strong>
                        <p>Nessun articolo contiene tabacco o nicotina. Il fumo nuoce gravemente alla salute. Questa pagina raccoglie richieste informative e non esegue pagamenti.</p>
                    </div>
                </section>
            </main>

            <div id="shop-backdrop" class="shop-backdrop" aria-hidden="true"></div>

            <aside id="shop-cart" class="shop-cart" aria-hidden="true" aria-labelledby="shop-cart-title">
                <header>
                    <div><span class="shop-kicker">LA TUA SELEZIONE</span><h2 id="shop-cart-title">LISTA RICHIESTA</h2></div>
                    <button id="shop-cart-close" type="button" aria-label="Chiudi lista">×</button>
                </header>
                <div id="shop-cart-items" class="shop-cart-items"></div>
                <div class="shop-request-fields">
                    <label>NOME O RIFERIMENTO<input id="shop-request-name" type="text" maxlength="80" placeholder="Come possiamo riconoscerti?"></label>
                    <label>NOTA<textarea id="shop-request-note" maxlength="500" rows="3" placeholder="Finitura, misura o domanda..."></textarea></label>
                </div>
                <footer>
                    <p>La lista non è un ordine e non comporta alcun pagamento.</p>
                    <button id="shop-share-request" class="shop-primary-action" type="button">CONDIVIDI RICHIESTA ${ARROW_ICON}</button>
                    <button id="shop-copy-request" class="shop-secondary-action" type="button">COPIA RIEPILOGO</button>
                </footer>
            </aside>

            <section id="shop-product-modal" class="shop-product-modal" hidden role="dialog" aria-modal="true" aria-labelledby="shop-modal-name">
                <div class="shop-modal-panel">
                    <button id="shop-modal-close" type="button" aria-label="Chiudi dettaglio">×</button>
                    <div id="shop-modal-media" class="shop-modal-media">
                        <span class="shop-viewer-axis" aria-hidden="true"></span>
                        <div id="shop-viewer-spin" class="shop-viewer-spin" role="img" aria-label="Vista 3D verticale di ${PRODUCTS[0].name}">
                            <img class="shop-viewer-layer shop-viewer-layer-back" data-viewer-layer src="${PRODUCTS[0].cutout}" alt="" aria-hidden="true">
                            <img class="shop-viewer-layer shop-viewer-layer-middle" data-viewer-layer src="${PRODUCTS[0].cutout}" alt="" aria-hidden="true">
                            <img id="shop-viewer-object" class="shop-viewer-layer shop-viewer-layer-front" data-viewer-layer src="${PRODUCTS[0].cutout}" alt="" aria-hidden="true">
                        </div>
                        <div class="shop-viewer-toolbar">
                            <span><b>VISTA 3D</b><small>ROTAZIONE VERTICALE · CONCEPT</small></span>
                            <button id="shop-viewer-toggle" type="button" aria-pressed="false">PAUSA</button>
                        </div>
                    </div>
                    <div class="shop-modal-copy">
                        <span id="shop-modal-collection" class="shop-kicker"></span>
                        <h2 id="shop-modal-name"></h2>
                        <p id="shop-modal-description"></p>
                        <ul id="shop-modal-facts"></ul>
                        <div class="shop-modal-actions">
                            <span id="shop-modal-availability"></span>
                            <button id="shop-modal-add" class="shop-primary-action" type="button">AGGIUNGI ALLA RICHIESTA ${ARROW_ICON}</button>
                        </div>
                    </div>
                </div>
            </section>

            <section id="shop-age-gate" class="shop-age-gate" role="dialog" aria-modal="true" aria-labelledby="shop-age-title" aria-describedby="shop-age-description">
                <div>
                    <span class="shop-age-seal" aria-hidden="true">18+</span>
                    <span class="shop-kicker">PRIMA DI ENTRARE</span>
                    <h2 id="shop-age-title">BOTTEGA PER ADULTI</h2>
                    <p id="shop-age-description">Questa vetrina presenta esclusivamente accessori destinati a fumatori adulti. Non contiene né vende tabacco o nicotina.</p>
                    <button id="shop-age-confirm" class="shop-primary-action" type="button">HO ALMENO 18 ANNI ${ARROW_ICON}</button>
                    <button id="shop-age-leave" class="shop-secondary-action" type="button">TORNA ALLA TAVERNA</button>
                </div>
            </section>

            <div id="shop-toast" class="shop-toast" role="status" aria-live="polite"></div>
        </div>
    `;
}

function productCard(product, index) {
    return `
        <article class="shop-product-card" data-product-card="${product.id}" style="--card-index:${index}" role="listitem">
            <button class="shop-product-media" type="button" data-product-detail="${product.id}" aria-label="Apri la vista 3D di ${escapeHTML(product.name)}">
                <img src="${product.image}" alt="${escapeHTML(product.imageAlt)}" loading="lazy">
                <span class="shop-product-index">0${index + 1}</span>
                <span class="shop-render-badge">CONCEPT 3D</span>
                <span class="shop-product-view">VEDI IN 3D ${ARROW_ICON}</span>
            </button>
            <div class="shop-product-copy">
                <span>${escapeHTML(product.collection)}</span>
                <h3>${escapeHTML(product.name)}</h3>
                <p>${escapeHTML(product.description)}</p>
                <footer>
                    <small>${escapeHTML(product.availability)}</small>
                    <button type="button" data-product-add="${product.id}" aria-label="Aggiungi ${escapeHTML(product.name)} alla richiesta">+</button>
                </footer>
            </div>
        </article>
    `;
}

function renderProducts(root, state) {
    const products = state.filter === 'all'
        ? PRODUCTS
        : PRODUCTS.filter(product => product.category === state.filter);
    const grid = root.querySelector('#shop-product-grid');
    grid.innerHTML = products.map(productCard).join('');

    grid.querySelectorAll('[data-product-detail]').forEach(button => {
        button.onclick = () => openProduct(root, state, button.dataset.productDetail);
    });
    grid.querySelectorAll('[data-product-add]').forEach(button => {
        button.onclick = () => addToCart(root, state, button.dataset.productAdd, button);
    });
    bindProductTilt(root, state);
    bindProductCarousel(root, state);

    if (!prefersReducedMotion()) {
        const cards = [...grid.querySelectorAll('.shop-product-card')];
        cards.forEach((card, index) => {
            const animation = card.animate([
                { translate: '72px 0', clipPath: 'inset(0 18% 0 0)' },
                { translate: '0 0', clipPath: 'inset(0 0 0 0)' }
            ], {
                duration: 680,
                delay: index * 75,
                easing: 'cubic-bezier(.16,1,.3,1)',
                fill: 'both'
            });
            state.motionCleanup.push(() => animation.cancel());
        });
    }
}

function bindProductCarousel(root, state) {
    const rail = root.querySelector('#shop-product-grid');
    const cards = [...rail.querySelectorAll('.shop-product-card')];
    const previous = root.querySelector('#shop-rail-prev');
    const next = root.querySelector('#shop-rail-next');
    const status = root.querySelector('#shop-rail-status');
    const progress = root.querySelector('#shop-rail-progress');
    let frame = 0;
    let activeIndex = 0;

    const getSnapPositions = () => {
        const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
        return cards.map(card => Math.max(0, Math.min(
            max,
            card.offsetLeft - ((rail.clientWidth - card.offsetWidth) / 2)
        )));
    };

    const update = () => {
        frame = 0;
        const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
        const snapPositions = getSnapPositions();
        activeIndex = snapPositions.reduce((closestIndex, position, index) => (
            Math.abs(position - rail.scrollLeft) < Math.abs(snapPositions[closestIndex] - rail.scrollLeft)
                ? index
                : closestIndex
        ), 0);
        cards.forEach((card, index) => card.classList.toggle('is-active', index === activeIndex));
        status.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
        progress.style.transform = `scaleX(${max ? Math.min(1, rail.scrollLeft / max) : 1})`;
        previous.disabled = activeIndex === 0;
        next.disabled = activeIndex === cards.length - 1;
    };

    const requestUpdate = () => {
        if (frame) return;
        frame = window.requestAnimationFrame(update);
    };
    const move = direction => {
        const snapPositions = getSnapPositions();
        if (cards.length < 2 || snapPositions.every(position => position === 0)) return;
        const targetIndex = Math.max(0, Math.min(cards.length - 1, activeIndex + direction));
        rail.scrollTo({
            left: snapPositions[targetIndex],
            behavior: prefersReducedMotion() ? 'auto' : 'smooth'
        });
    };
    const keyHandler = event => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            move(-1);
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            move(1);
        }
    };

    previous.onclick = () => move(-1);
    next.onclick = () => move(1);
    rail.addEventListener('scroll', requestUpdate, { passive: true });
    rail.addEventListener('keydown', keyHandler);
    state.eventCleanup.push(() => {
        rail.removeEventListener('scroll', requestUpdate);
        rail.removeEventListener('keydown', keyHandler);
        if (frame) window.cancelAnimationFrame(frame);
    });
    rail.scrollLeft = 0;
    update();
}

function bindShop(root, state, container) {
    const goHome = () => navigateTo('home', document.getElementById('app') || container);
    root.querySelector('#shop-back').onclick = goHome;
    root.querySelector('#shop-age-leave').onclick = goHome;
    root.querySelector('#shop-age-confirm').onclick = event => {
        try { localStorage.setItem(AGE_KEY, 'true'); } catch { /* storage facoltativo */ }
        const gate = root.querySelector('#shop-age-gate');
        if (prefersReducedMotion()) {
            gate.hidden = true;
            root.classList.remove('has-overlay');
            syncOverlayState(root);
            startMotion(root, state);
            return;
        }
        const exit = animate(gate.firstElementChild, { opacity: [1, 0], scale: [1, 0.94], y: [0, -18] }, { duration: 0.3, ease: [0.16, 1, 0.3, 1] });
        event.currentTarget.disabled = true;
        exit.finished.finally(() => {
            gate.hidden = true;
            root.classList.remove('has-overlay');
            syncOverlayState(root);
            startMotion(root, state);
        });
    };

    root.querySelectorAll('[data-scroll-catalog]').forEach(button => {
        button.onclick = () => root.querySelector('#shop-catalog').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
    root.querySelectorAll('[data-scroll-story]').forEach(button => {
        button.onclick = () => root.querySelector('#shop-story').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });

    root.querySelectorAll('[data-shop-filter]').forEach(button => {
        button.onclick = () => {
            state.filter = button.dataset.shopFilter;
            root.querySelectorAll('[data-shop-filter]').forEach(filter => {
                const active = filter === button;
                filter.classList.toggle('active', active);
                filter.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            renderProducts(root, state);
        };
    });

    root.querySelector('#shop-cart-trigger').onclick = () => openCart(root);
    root.querySelector('#shop-cart-close').onclick = () => closeCart(root);
    root.querySelector('#shop-backdrop').onclick = () => closeCart(root);
    root.querySelector('#shop-modal-close').onclick = () => closeProduct(root, state);
    root.querySelector('#shop-product-modal').onclick = event => {
        if (event.target === event.currentTarget) closeProduct(root, state);
    };
    root.querySelector('#shop-viewer-toggle').onclick = () => {
        setViewerPaused(root, state, !state.viewerPaused);
    };
    root.querySelector('#shop-modal-add').onclick = event => {
        if (!state.activeProduct) return;
        addToCart(root, state, state.activeProduct, event.currentTarget);
    };
    root.querySelector('#shop-copy-request').onclick = () => copyRequest(root, state);
    root.querySelector('#shop-share-request').onclick = () => shareRequest(root, state);

    const keyHandler = event => {
        if (event.key !== 'Escape') return;
        if (!root.querySelector('#shop-product-modal').hidden) closeProduct(root, state);
        else if (root.classList.contains('shop-cart-open')) closeCart(root);
    };
    window.addEventListener('keydown', keyHandler);
    state.eventCleanup.push(() => window.removeEventListener('keydown', keyHandler));
}

function getProduct(id) {
    return PRODUCTS.find(product => product.id === id) || null;
}

function addToCart(root, state, id, source) {
    const product = getProduct(id);
    if (!product) return;
    const current = state.cart.find(item => item.id === id);
    if (current) current.quantity = Math.min(9, current.quantity + 1);
    else state.cart.push({ id, quantity: 1 });
    saveCart(state.cart);
    renderCart(root, state);
    showToast(root, `${product.name.toUpperCase()} AGGIUNTO ALLA RICHIESTA`);

    if (!prefersReducedMotion() && source) {
        animate(source, { scale: [1, 0.88, 1.08, 1], rotate: [0, -4, 3, 0] }, { duration: 0.46, ease: [0.16, 1, 0.3, 1] });
        animate(root.querySelector('#shop-cart-count'), { scale: [1, 1.55, 1] }, { duration: 0.4 });
    }
}

function updateQuantity(root, state, id, delta) {
    const item = state.cart.find(entry => entry.id === id);
    if (!item) return;
    item.quantity = Math.max(0, Math.min(9, item.quantity + delta));
    if (!item.quantity) state.cart = state.cart.filter(entry => entry.id !== id);
    saveCart(state.cart);
    renderCart(root, state);
}

function renderCart(root, state) {
    const count = state.cart.reduce((total, item) => total + item.quantity, 0);
    root.querySelector('#shop-cart-count').textContent = count;
    root.querySelector('#shop-cart-trigger').classList.toggle('has-items', count > 0);
    const items = root.querySelector('#shop-cart-items');

    if (!state.cart.length) {
        items.innerHTML = `
            <div class="shop-cart-empty">
                <span aria-hidden="true">◇</span>
                <strong>LA LISTA È VUOTA</strong>
                <p>Aggiungi uno o più pezzi per preparare una richiesta informativa.</p>
                <button type="button" data-cart-to-catalog>ESPLORA LA COLLEZIONE</button>
            </div>
        `;
        items.querySelector('[data-cart-to-catalog]').onclick = () => {
            closeCart(root);
            root.querySelector('#shop-catalog').scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        };
    } else {
        items.innerHTML = state.cart.map(item => {
            const product = getProduct(item.id);
            return `
                <article class="shop-cart-item">
                    <div class="shop-cart-thumb"><img src="${product.image}" alt=""></div>
                    <div><small>${escapeHTML(product.collection)}</small><strong>${escapeHTML(product.name)}</strong><span>${escapeHTML(product.availability)}</span></div>
                    <div class="shop-cart-quantity" aria-label="Quantità ${escapeHTML(product.name)}">
                        <button type="button" data-cart-minus="${product.id}" aria-label="Diminuisci quantità">−</button>
                        <b>${item.quantity}</b>
                        <button type="button" data-cart-plus="${product.id}" aria-label="Aumenta quantità">+</button>
                    </div>
                </article>
            `;
        }).join('');
        items.querySelectorAll('[data-cart-minus]').forEach(button => {
            button.onclick = () => updateQuantity(root, state, button.dataset.cartMinus, -1);
        });
        items.querySelectorAll('[data-cart-plus]').forEach(button => {
            button.onclick = () => updateQuantity(root, state, button.dataset.cartPlus, 1);
        });
    }

    root.querySelector('#shop-copy-request').disabled = !state.cart.length;
    root.querySelector('#shop-share-request').disabled = !state.cart.length;
}

function openCart(root) {
    root.classList.add('shop-cart-open', 'has-overlay');
    root.querySelector('#shop-cart').setAttribute('aria-hidden', 'false');
    syncOverlayState(root);
    window.setTimeout(() => root.querySelector('#shop-cart-close').focus(), 260);
}

function closeCart(root) {
    root.classList.remove('shop-cart-open');
    root.querySelector('#shop-cart').setAttribute('aria-hidden', 'true');
    syncOverlayState(root);
}

function openProduct(root, state, id) {
    const product = getProduct(id);
    if (!product) return;
    state.activeProduct = id;
    root.querySelector('#shop-modal-collection').textContent = product.collection;
    root.querySelector('#shop-modal-name').textContent = product.name;
    root.querySelector('#shop-modal-description').textContent = product.description;
    root.querySelector('#shop-modal-availability').textContent = product.availability;
    root.querySelector('#shop-modal-facts').innerHTML = product.facts.map(fact => `<li>${escapeHTML(fact)}</li>`).join('');
    const media = root.querySelector('#shop-modal-media');
    media.style.setProperty('--viewer-angle', product.viewerAngle);
    root.querySelector('#shop-viewer-spin').setAttribute('aria-label', `Vista 3D verticale di ${product.name}`);
    media.querySelectorAll('[data-viewer-layer]').forEach(layer => {
        layer.src = product.cutout;
    });
    const modal = root.querySelector('#shop-product-modal');
    modal.hidden = false;
    root.classList.add('has-overlay', 'shop-product-open');
    setViewerPaused(root, state, prefersReducedMotion());
    syncOverlayState(root);

    if (!prefersReducedMotion()) {
        animate(modal.querySelector('.shop-modal-panel'), {
            opacity: [0, 1],
            y: [34, 0],
            scale: [0.96, 1]
        }, { duration: 0.48, ease: [0.16, 1, 0.3, 1] });
    }
    window.setTimeout(() => root.querySelector('#shop-modal-close').focus(), 120);
}

function closeProduct(root, state) {
    const modal = root.querySelector('#shop-product-modal');
    modal.hidden = true;
    state.activeProduct = null;
    root.classList.remove('shop-product-open');
    syncOverlayState(root);
}

function setViewerPaused(root, state, paused) {
    const reducedMotion = prefersReducedMotion();
    paused = reducedMotion ? true : paused;
    state.viewerPaused = paused;
    const media = root.querySelector('#shop-modal-media');
    const toggle = root.querySelector('#shop-viewer-toggle');
    media.classList.toggle('is-paused', paused);
    toggle.setAttribute('aria-pressed', paused ? 'true' : 'false');
    toggle.disabled = reducedMotion;
    toggle.textContent = reducedMotion ? 'MOVIMENTO RIDOTTO' : paused ? 'RUOTA' : 'PAUSA';
    toggle.setAttribute('aria-label', reducedMotion
        ? 'Rotazione disattivata dalle preferenze di movimento ridotto'
        : paused ? 'Avvia la rotazione verticale' : 'Metti in pausa la rotazione verticale');
}

function syncOverlayState(root) {
    const ageOpen = !root.querySelector('#shop-age-gate').hidden;
    const modalOpen = !root.querySelector('#shop-product-modal').hidden;
    const cartOpen = root.classList.contains('shop-cart-open');
    const overlayOpen = ageOpen || modalOpen || cartOpen;
    root.classList.toggle('has-overlay', overlayOpen);
    root.querySelector('.shop-topbar').inert = overlayOpen;
    root.querySelector('.shop-main').inert = overlayOpen;
    root.querySelector('#shop-age-gate').inert = !ageOpen;
    root.querySelector('#shop-product-modal').inert = !modalOpen;
    root.querySelector('#shop-cart').inert = !cartOpen;
}

function requestText(root, state) {
    const name = root.querySelector('#shop-request-name').value.trim();
    const note = root.querySelector('#shop-request-note').value.trim();
    const lines = state.cart.map(item => {
        const product = getProduct(item.id);
        return `• ${product.name} × ${item.quantity} — ${product.availability}`;
    });
    const header = [
        'RICHIESTA INFORMAZIONI — BOTTEGA DEL VIANDANTE',
        name ? `Riferimento: ${name}` : null
    ].filter(Boolean);
    const footer = [
        note ? `Nota: ${note}` : null,
        'Richiesta non vincolante. Nessun tabacco o nicotina incluso.'
    ].filter(Boolean);
    return [...header, '', ...lines, '', ...footer].join('\n');
}

async function copyRequest(root, state) {
    if (!state.cart.length) return;
    const text = requestText(root, state);
    try {
        await navigator.clipboard.writeText(text);
        showToast(root, 'RIEPILOGO COPIATO');
    } catch {
        const field = document.createElement('textarea');
        field.value = text;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
        showToast(root, 'RIEPILOGO COPIATO');
    }
}

async function shareRequest(root, state) {
    if (!state.cart.length) return;
    const text = requestText(root, state);
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Richiesta — Bottega del Viandante', text });
            showToast(root, 'RICHIESTA CONDIVISA');
            return;
        } catch (error) {
            if (error?.name === 'AbortError') return;
        }
    }
    await copyRequest(root, state);
}

function showToast(root, message) {
    const toast = root.querySelector('#shop-toast');
    toast.textContent = message;
    toast.classList.remove('visible');
    void toast.offsetWidth;
    toast.classList.add('visible');
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(() => toast.classList.remove('visible'), 2100);
}

function bindProductTilt(root, state) {
    root.querySelectorAll('.shop-product-card').forEach(card => {
        const move = event => {
            if (prefersReducedMotion() || event.pointerType === 'touch') return;
            const bounds = card.getBoundingClientRect();
            const x = (event.clientX - bounds.left) / bounds.width - 0.5;
            const y = (event.clientY - bounds.top) / bounds.height - 0.5;
            card.style.setProperty('--tilt-x', `${x * 8}deg`);
            card.style.setProperty('--tilt-y', `${y * -7}deg`);
            card.style.setProperty('--shine-x', `${(x + 0.5) * 100}%`);
            card.style.setProperty('--shine-y', `${(y + 0.5) * 100}%`);
        };
        const leave = () => {
            card.style.setProperty('--tilt-x', '0deg');
            card.style.setProperty('--tilt-y', '0deg');
        };
        card.addEventListener('pointermove', move);
        card.addEventListener('pointerleave', leave);
        state.eventCleanup.push(() => {
            card.removeEventListener('pointermove', move);
            card.removeEventListener('pointerleave', leave);
        });
    });
}

function startMotion(root, state) {
    if (state.animationStarted) return;
    state.animationStarted = true;

    const scrollContainer = root.parentElement?.id === 'app' ? root.parentElement : window;
    const scrollHandler = () => {
        const top = scrollContainer === window ? window.scrollY : scrollContainer.scrollTop;
        const height = scrollContainer === window ? document.documentElement.scrollHeight : scrollContainer.scrollHeight;
        const viewport = scrollContainer === window ? window.innerHeight : scrollContainer.clientHeight;
        const max = Math.max(1, height - viewport);
        root.querySelector('#shop-scroll-progress').style.transform = `scaleX(${Math.min(1, top / max)})`;
    };
    scrollContainer.addEventListener('scroll', scrollHandler, { passive: true });
    state.eventCleanup.push(() => scrollContainer.removeEventListener('scroll', scrollHandler));
    scrollHandler();

    const hero = root.querySelector('#shop-hero');
    const heroVisual = root.querySelector('.shop-hero-visual');
    const parallaxMove = event => {
        if (prefersReducedMotion() || event.pointerType === 'touch') return;
        const bounds = hero.getBoundingClientRect();
        hero.style.setProperty('--hero-x', `${((event.clientX - bounds.left) / bounds.width - 0.5) * 22}px`);
        hero.style.setProperty('--hero-y', `${((event.clientY - bounds.top) / bounds.height - 0.5) * 18}px`);
    };
    const parallaxReset = () => {
        hero.style.setProperty('--hero-x', '0px');
        hero.style.setProperty('--hero-y', '0px');
    };
    hero.addEventListener('pointermove', parallaxMove);
    hero.addEventListener('pointerleave', parallaxReset);
    state.eventCleanup.push(() => {
        hero.removeEventListener('pointermove', parallaxMove);
        hero.removeEventListener('pointerleave', parallaxReset);
    });

    if (prefersReducedMotion()) return;
    const ease = [0.16, 1, 0.3, 1];
    state.motionCleanup.push(animate(root.querySelector('.shop-topbar'), { opacity: [0, 1], y: [-20, 0] }, { duration: 0.7, ease }));
    state.motionCleanup.push(animate(root.querySelectorAll('.shop-hero-copy > *'), {
        opacity: [0, 1],
        y: [30, 0],
        filter: ['blur(9px)', 'blur(0px)']
    }, { delay: stagger(0.075, { startDelay: 0.12 }), duration: 0.72, ease }));
    state.motionCleanup.push(animate(heroVisual, {
        opacity: [0, 1],
        x: [54, 0],
        scale: [0.92, 1],
        rotateY: [-7, 0],
        filter: ['blur(14px)', 'blur(0px)']
    }, { duration: 1, delay: 0.16, ease }));
    state.motionCleanup.push(animate(root.querySelector('.orbit-large'), { rotate: [0, 360] }, { duration: 30, repeat: Infinity, ease: 'linear' }));
    state.motionCleanup.push(animate(root.querySelector('.orbit-small'), { rotate: [360, 0] }, { duration: 22, repeat: Infinity, ease: 'linear' }));
    state.motionCleanup.push(animate(root.querySelector('.shop-marquee > div'), { x: ['0%', '-50%'] }, { duration: 24, repeat: Infinity, ease: 'linear' }));
    state.motionCleanup.push(animate(root.querySelector('.shop-scroll-cue span'), { scaleY: [0.2, 1, 0.2], y: [-4, 4, -4] }, { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }));

    root.querySelectorAll('.shop-reveal-section').forEach(section => {
        state.motionCleanup.push(inView(section, () => {
            const animation = animate(section, {
                opacity: [0, 1],
                y: [46, 0],
                filter: ['blur(10px)', 'blur(0px)']
            }, { duration: 0.82, ease });
            return () => animation.stop();
        }, { amount: 0.13 }));
    });

    root.querySelectorAll('.shop-primary-action, .shop-secondary-action, .shop-cart-trigger').forEach(button => {
        state.motionCleanup.push(hover(button, element => {
            const animation = animate(element, { y: -3, scale: 1.015 }, { type: 'spring', stiffness: 430, damping: 30 });
            return () => {
                animation.stop();
                animate(element, { y: 0, scale: 1 }, { type: 'spring', stiffness: 430, damping: 30 });
            };
        }));
        state.motionCleanup.push(press(button, element => {
            animate(element, { scale: 0.97 }, { duration: 0.1 });
            return () => animate(element, { scale: 1 }, { duration: 0.2, ease });
        }));
    });
}
