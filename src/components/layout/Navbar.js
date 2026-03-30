import { initSidebar } from './Sidebar.js'; 

export function initNavbar(user, onLogout) {
    const navbarContainer = document.getElementById('navbar-container');
    const sidebarContainer = document.getElementById('sidebar-container');

    if (!navbarContainer || !sidebarContainer) return;

    // HTML: Logo in alto + Bottone Hamburger Flottante in basso
    navbarContainer.innerHTML = `
        <div class="navbar-top-minimal" style="position: fixed; top: 20px; left: 20px; z-index: 9998;">
            <img src="/assets/logo.png" alt="Taverna" id="nav-home-btn" 
                 style="width: 45px; cursor: pointer; filter: drop-shadow(0 0 10px rgba(157, 78, 222, 0.3));">
        </div>

        <button id="navbar-trigger" class="floating-trigger">
            <span id="bar1" class="nav-bar"></span>
            <span id="bar2" class="nav-bar"></span>
            <span id="bar3" class="nav-bar"></span>
        </button>
    `;

    // Inizializza la Sidebar (passando il contenitore dove iniettarla)
    initSidebar(sidebarContainer, user, onLogout);

    const btn = document.getElementById('navbar-trigger');
    const b1 = document.getElementById('bar1');
    const b2 = document.getElementById('bar2');
    const b3 = document.getElementById('bar3');

    // Al click sul bottone hamburger, spariamo l'evento per la Sidebar
    btn.onclick = (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggleSidebar'));
    };

    // Al click sul logo, ricarichiamo la home
    document.getElementById('nav-home-btn').onclick = () => window.location.reload();

    // Ascoltiamo lo stato della Sidebar per trasformare il bottone
    window.addEventListener('sidebarState', (e) => {
        const isOpen = e.detail.isOpen;
        if (isOpen) {
            btn.style.background = '#ff4444'; // Diventa Rosso
            btn.style.boxShadow = '0 4px 20px rgba(255, 68, 68, 0.5)';
            b1.style.transform = 'translateY(8px) rotate(45deg)';
            b2.style.opacity = '0';
            b3.style.transform = 'translateY(-8px) rotate(-45deg)';
        } else {
            btn.style.background = 'var(--amethyst-bright)'; // Torna Ametista
            btn.style.boxShadow = '0 4px 25px var(--amethyst-glow)';
            b1.style.transform = 'translateY(0) rotate(0)';
            b2.style.opacity = '1';
            b3.style.transform = 'translateY(0) rotate(0)';
        }
    });
}
