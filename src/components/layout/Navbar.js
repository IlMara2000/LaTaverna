import { mountOracleCompanion, stopOracleVoice } from './OracleCompanion.js';
import { initFloatingHandle } from './floatingHandle.js';
import { initSidebar } from './Sidebar.js'; 
import { navigateTo } from '../../services/appNavigation.js';

let disposeHandle;
let disposeOracle;
let sidebarStateListener;

export function initNavbar(user, onLogout) {
    const navbarContainer = document.getElementById('navbar-container');
    const sidebarContainer = document.getElementById('sidebar-container');

    if (!navbarContainer) {
        console.error("ERRORE: Manca #navbar-container nell'HTML");
        return;
    }

    disposeHandle?.();
    disposeOracle?.();
    if (sidebarStateListener) window.removeEventListener('sidebarState', sidebarStateListener);

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
    initSidebar(sidebarContainer, user, () => { stopOracleVoice(); return onLogout?.(); });

    const btn = document.getElementById('navbar-trigger');

    const handle = initFloatingHandle(btn);
    disposeHandle = handle.destroy;
    disposeOracle = mountOracleCompanion(btn);

    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation(); // FIX: Evita che il tocco "trapassi" il bottone attivando cose sotto
        if (handle.suppressClick(e)) return;
        window.dispatchEvent(new CustomEvent('toggleSidebar'));
    };

    // Ascolta lo stato della sidebar per animare il pulsante Hamburger -> X
    sidebarStateListener = (e) => {
        const isOpen = e.detail.isOpen;
        btn.setAttribute('aria-expanded', String(isOpen));
        btn.setAttribute('aria-label', isOpen ? 'Chiudi menu' : 'Apri menu');
        if (isOpen) {
            btn.classList.add('is-active'); // Si illumina di rosso e forma una X (global.css)
        } else {
            btn.classList.remove('is-active'); // Torna ametista a righe (global.css)
        }
    };
    window.addEventListener('sidebarState', sidebarStateListener);

    // Il logo riporta alla Taverna senza ricaricare tutta l'app.
    const logoBtn = document.getElementById('nav-home-btn');
    logoBtn.onclick = (e) => {
        e.preventDefault();
        void navigateTo('home', document.getElementById('app'));
    };
}
