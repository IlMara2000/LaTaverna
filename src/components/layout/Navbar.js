import { initSidebar } from './Sidebar.js'; 

/**
 * NAVBAR & TRIGGER SIDEBAR
 * Unifica il logo superiore e il pulsante flottante magico
 */
export function initNavbar(user, onLogout) {
    const navbarContainer = document.getElementById('navbar-container');
    const sidebarContainer = document.getElementById('sidebar-container');

    if (!navbarContainer || !sidebarContainer) return;

    // 1. Rendering della struttura Navbar (Logo + Pulsante Flottante)
    navbarContainer.innerHTML = `
        <div class="navbar-top-minimal" style="position: fixed; top: 20px; left: 20px; z-index: 9998;">
            <img src="/assets/logo.png" alt="Taverna" id="nav-home-btn" 
                 style="width: 45px; cursor: pointer; filter: drop-shadow(0 0 10px rgba(157, 78, 222, 0.3)); transition: 0.3s;">
        </div>

        <button id="navbar-trigger" class="floating-trigger">
            <span id="bar1" class="nav-bar"></span>
            <span id="bar2" class="nav-bar"></span>
            <span id="bar3" class="nav-bar"></span>
        </button>
    `;

    // 2. Inizializzazione Sidebar (stessa cartella)
    initSidebar(sidebarContainer, user, onLogout);

    // 3. Riferimenti agli elementi
    const btn = document.getElementById('navbar-trigger');
    const b1 = document.getElementById('bar1');
    const b2 = document.getElementById('bar2');
    const b3 = document.getElementById('bar3');
    const homeBtn = document.getElementById('nav-home-btn');

    // 4. Gestione Click: Toggle Sidebar
    btn.onclick = (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggleSidebar'));
    };

    // Home button: Reload
    if (homeBtn) {
        homeBtn.onclick = () => window.location.reload();
    }

    // 5. Logica Trasformazione (da Hamburger a X)
    // Questo ascolta l'evento che la tua Sidebar dovrebbe lanciare quando si apre/chiude
    window.addEventListener('sidebarState', (e) => {
        const isOpen = e.detail.isOpen;
        
        if (isOpen) {
            btn.style.background = '#ff4444'; // Rosso alert
            btn.style.boxShadow = '0 4px 20px rgba(255, 68, 68, 0.4)';
            b1.style.transform = 'translateY(8px) rotate(45deg)';
            b2.style.opacity = '0';
            b3.style.transform = 'translateY(-8px) rotate(-45deg)';
        } else {
            btn.style.background = 'var(--amethyst-bright, #9d4ede)'; // Torna viola
            btn.style.boxShadow = '0 4px 25px var(--amethyst-glow, rgba(157, 78, 222, 0.5))';
            b1.style.transform = 'translateY(0) rotate(0)';
            b2.style.opacity = '1';
            b3.style.transform = 'translateY(0) rotate(0)';
        }
    });
}
