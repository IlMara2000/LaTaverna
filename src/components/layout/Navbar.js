import { showCharacters } from '../../features/characters/CharList.js';
import { showAssets } from '../../features/zaino/Assets.js';

/**
 * Inizializza la navigazione laterale della Taverna
 */
export function initSidebar(container, user, onLogout) {
    const userName = user.user_metadata?.full_name || user.email.split('@')[0];
    const mainContent = document.getElementById('main-content');

    const sidebarHtml = `
        <button class="hamburger-vercel" id="hamburger" aria-label="Menu">
            <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </button>

        <nav class="sidebar" id="sidebar">
            <div style="text-align:center; margin-bottom: 30px;">
                <img src="/assets/logo.png" style="width: 80px; filter: drop-shadow(0 0 10px var(--amethyst-glow));" onerror="this.style.display='none'">
                <p style="font-size: 10px; margin-top: 15px; opacity: 0.6; text-transform: uppercase; letter-spacing: 2px;">
                    VIANDANTE: <br><span style="color:var(--amethyst-bright)">${userName}</span>
                </p>
            </div>
            
            <div class="nav-links" style="display: flex; flex-direction: column; gap: 10px;">
                <button class="sidebar-btn" id="navNewSession">✨ CRONACHE</button>
                <button class="sidebar-btn" id="navCharacters">🎭 PERSONAGGI</button>
                <button class="sidebar-btn" id="navAssets">🎒 LO ZAINO</button>
            </div>

            <div style="flex-grow:1;"></div>
            
            <button class="sidebar-btn" id="navLogout" style="color:var(--error-red); border-color: rgba(255,68,68,0.2); margin-top: 20px;">
                🚪 ESCI DALLA TAVERNA
            </button>
        </nav>
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;

    // Usiamo innerHTML per evitare duplicazioni se la funzione viene richiamata
    container.innerHTML = sidebarHtml;

    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('sidebar-overlay');

    const toggleMenu = () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        // Se hai aggiunto la classe 'open' nel CSS per trasformare l'hamburger in X
        if (hamburger) hamburger.classList.toggle('open');
    };

    if (hamburger) hamburger.onclick = toggleMenu;
    if (overlay) overlay.onclick = toggleMenu;

    // --- LOGICA DI NAVIGAZIONE ---

    // Torna alla Dashboard (Lista Sessioni)
    document.getElementById('navNewSession').onclick = () => {
        toggleMenu();
        window.location.reload(); 
    };

    // Vai ai Personaggi
    document.getElementById('navCharacters').onclick = () => {
        toggleMenu();
        if (mainContent) showCharacters(mainContent);
    };

    // Vai allo Zaino
    document.getElementById('navAssets').onclick = () => {
        toggleMenu();
        if (mainContent) showAssets(mainContent);
    };

    // Logout
    document.getElementById('navLogout').onclick = () => {
        if (confirm("Vuoi davvero lasciare la Taverna?")) {
            onLogout();
        }
    };
}