import { initSidebar } from './Sidebar.js'; 
import { navigateTo } from '../../services/appNavigation.js';

export function initNavbar(user, onLogout) {
    const navbarContainer = document.getElementById('navbar-container');
    const sidebarContainer = document.getElementById('sidebar-container');

    if (!navbarContainer) {
        console.error("ERRORE: Manca #navbar-container nell'HTML");
        return;
    }

    // Struttura HTML pulita. 
    // pointer-events: none sull'img impedisce il menu "Salva immagine" sui telefoni.
    navbarContainer.innerHTML = `
        <button type="button" class="nav-logo-right" id="nav-home-btn" aria-label="Torna alla Taverna">
            <img src="/assets/logo2.png" alt="La Taverna" style="width: 100%; height: 100%; object-fit: contain; pointer-events: none;">
        </button>

        <button id="navbar-trigger" class="floating-trigger" type="button" aria-label="Apri menu" aria-controls="sidebar-menu" aria-expanded="false">
            <span class="nav-bar"></span>
            <span class="nav-bar"></span>
            <span class="nav-bar"></span>
        </button>
    `;

    // Inizializza la Sidebar passando l'utente e la funzione di logout
    initSidebar(sidebarContainer, user, onLogout);

    const btn = document.getElementById('navbar-trigger');

    // On phones the menu control behaves like a small PiP handle: it can be
    // parked anywhere, including partly beyond an edge, and remembers its spot.
    const mobileMenu = window.matchMedia('(max-width: 760px), (pointer: coarse)');
    const positionKey = 'taverna.navbar-trigger.position.v1';
    let dragStart = null;
    let dragMoved = false;
    let suppressClick = false;
    const viewport = () => {
        const vv = window.visualViewport;
        return { left: vv?.offsetLeft || 0, top: vv?.offsetTop || 0, width: vv?.width || window.innerWidth, height: vv?.height || window.innerHeight };
    };
    const placeHandle = (left, top, persist = false) => {
        const view = viewport();
        const rect = btn.getBoundingClientRect();
        const grip = Math.min(28, rect.width * 0.52, rect.height * 0.52);
        const x = Math.max(view.left - rect.width + grip, Math.min(left, view.left + view.width - grip));
        const y = Math.max(view.top - rect.height + grip, Math.min(top, view.top + view.height - grip));
        btn.style.setProperty('left', `${x}px`, 'important');
        btn.style.setProperty('top', `${y}px`, 'important');
        btn.style.setProperty('right', 'auto', 'important');
        btn.style.setProperty('bottom', 'auto', 'important');
        btn.classList.add('is-mobile-draggable');
        if (persist) {
            try { localStorage.setItem(positionKey, JSON.stringify({ left: x, top: y })); } catch { /* storage may be unavailable */ }
        }
    };
    const restoreHandle = () => {
        if (!mobileMenu.matches) {
            btn.classList.remove('is-mobile-draggable');
            ['left', 'top', 'right', 'bottom'].forEach((property) => btn.style.removeProperty(property));
            return;
        }
        try {
            const saved = JSON.parse(localStorage.getItem(positionKey) || 'null');
            if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) placeHandle(saved.left, saved.top);
        } catch { /* use the stylesheet's bottom-right default */ }
    };
    restoreHandle();
    mobileMenu.addEventListener?.('change', restoreHandle);
    window.addEventListener('resize', () => {
        if (!mobileMenu.matches || !btn.classList.contains('is-mobile-draggable')) return;
        const rect = btn.getBoundingClientRect();
        placeHandle(rect.left, rect.top, true);
    });
    btn.addEventListener('pointerdown', (event) => {
        if (!mobileMenu.matches || btn.getAttribute('aria-expanded') === 'true' || (event.pointerType === 'mouse' && !window.matchMedia('(pointer: coarse)').matches)) return;
        const rect = btn.getBoundingClientRect();
        dragStart = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, pointerId: event.pointerId };
        dragMoved = false;
        btn.setPointerCapture?.(event.pointerId);
    });
    btn.addEventListener('pointermove', (event) => {
        if (!dragStart || dragStart.pointerId !== event.pointerId) return;
        const dx = event.clientX - dragStart.x;
        const dy = event.clientY - dragStart.y;
        if (!dragMoved && Math.hypot(dx, dy) < 7) return;
        dragMoved = true;
        event.preventDefault();
        placeHandle(dragStart.left + dx, dragStart.top + dy);
    });
    const finishDrag = (event) => {
        if (!dragStart || dragStart.pointerId !== event.pointerId) return;
        const rect = btn.getBoundingClientRect();
        if (dragMoved) {
            const view = viewport();
            const grip = Math.min(28, rect.width * 0.52, rect.height * 0.52);
            const snapLeft = Math.abs(rect.left - (view.left - rect.width + grip)) < Math.abs(rect.left - (view.left + view.width - grip));
            placeHandle(snapLeft ? view.left - rect.width + grip : view.left + view.width - grip, rect.top, true);
            suppressClick = true;
            window.setTimeout(() => { suppressClick = false; }, 350);
        }
        dragStart = null;
    };
    btn.addEventListener('pointerup', finishDrag);
    btn.addEventListener('pointercancel', finishDrag);
    btn.addEventListener('lostpointercapture', finishDrag);

    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation(); // FIX: Evita che il tocco "trapassi" il bottone attivando cose sotto
        if (suppressClick) return;
        window.dispatchEvent(new CustomEvent('toggleSidebar'));
    };

    // Ascolta lo stato della sidebar per animare il pulsante Hamburger -> X
    window.addEventListener('sidebarState', (e) => {
        const isOpen = e.detail.isOpen;
        btn.setAttribute('aria-expanded', String(isOpen));
        btn.setAttribute('aria-label', isOpen ? 'Chiudi menu' : 'Apri menu');
        if (isOpen) {
            btn.classList.add('is-active'); // Si illumina di rosso e forma una X (global.css)
        } else {
            btn.classList.remove('is-active'); // Torna ametista a righe (global.css)
        }
    });

    // Il logo riporta alla Taverna senza ricaricare tutta l'app.
    const logoBtn = document.getElementById('nav-home-btn');
    logoBtn.onclick = (e) => {
        e.preventDefault();
        void navigateTo('home', document.getElementById('app'));
    };
}
