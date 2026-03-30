import { initSidebar } from './Sidebar.js'; 

export function initNavbar(user, onLogout) {
    const navbarContainer = document.getElementById('navbar-container');
    const sidebarContainer = document.getElementById('sidebar-container');

    if (!navbarContainer) {
        console.error("ERRORE: Manca #navbar-container nell'HTML");
        return;
    }

    // Logo spostato in alto a DESTRA con sorgente logo2.png
    // Il pulsante trigger ora usa le classi CSS per le animazioni
    navbarContainer.innerHTML = `
        <div class="nav-logo-right" id="nav-home-btn">
            <img src="/assets/logo2.png" alt="Taverna">
        </div>

        <button id="navbar-trigger" class="floating-trigger">
            <span id="bar1" class="nav-bar"></span>
            <span id="bar2" class="nav-bar"></span>
            <span id="bar3" class="nav-bar"></span>
        </button>
    `;

    initSidebar(sidebarContainer, user, onLogout);

    const btn = document.getElementById('navbar-trigger');

    btn.onclick = (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggleSidebar'));
    };

    // Gestione trasformazione estetica tramite classi CSS (Ver 3.7)
    window.addEventListener('sidebarState', (e) => {
        const isOpen = e.detail.isOpen;
        if (isOpen) {
            btn.classList.add('is-active'); // Diventa Rosso + X tramite global.css
        } else {
            btn.classList.remove('is-active'); // Torna Ametista + Hamburger tramite global.css
        }
    });

    document.getElementById('nav-home-btn').onclick = () => window.location.reload();
}
