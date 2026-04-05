import { initSidebar } from './Sidebar.js'; 

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
        <div class="nav-logo-right" id="nav-home-btn" style="cursor: pointer; -webkit-tap-highlight-color: transparent;">
            <img src="/assets/logo2.png" alt="La Taverna" style="width: 100%; height: 100%; object-fit: contain; pointer-events: none;">
        </div>

        <button id="navbar-trigger" class="floating-trigger" style="-webkit-tap-highlight-color: transparent; outline: none;">
            <span class="nav-bar"></span>
            <span class="nav-bar"></span>
            <span class="nav-bar"></span>
        </button>
    `;

    // Inizializza la Sidebar passando l'utente e la funzione di logout
    initSidebar(sidebarContainer, user, onLogout);

    const btn = document.getElementById('navbar-trigger');

    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation(); // FIX: Evita che il tocco "trapassi" il bottone attivando cose sotto
        window.dispatchEvent(new CustomEvent('toggleSidebar'));
    };

    // Ascolta lo stato della sidebar per animare il pulsante Hamburger -> X
    window.addEventListener('sidebarState', (e) => {
        const isOpen = e.detail.isOpen;
        if (isOpen) {
            btn.classList.add('is-active'); // Si illumina di rosso e forma una X (global.css)
        } else {
            btn.classList.remove('is-active'); // Torna ametista a righe (global.css)
        }
    });

    // Ricarica l'app cliccando il logo, con un micro-feedback di pressione
    const logoBtn = document.getElementById('nav-home-btn');
    logoBtn.onclick = (e) => {
        e.preventDefault();
        logoBtn.style.transform = 'scale(0.8)';
        logoBtn.style.filter = 'brightness(1.5)';
        
        setTimeout(() => {
            window.location.reload();
        }, 150); // Piccolo ritardo per far vedere l'animazione di tocco
    };
}
