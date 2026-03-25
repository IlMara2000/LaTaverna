import { showCharacters } from '../../features/characters/CharList.js';
import { showAssets } from '../../features/zaino/Assets.js';

export function initSidebar(container, user, onLogout) {
    // Supabase salva il nome in user_metadata. Se non c'è, usiamo l'email.
    const userName = user.user_metadata?.full_name || user.email.split('@')[0];

    const sidebarHtml = `
        <button class="hamburger-vercel" id="hamburger" aria-label="Menu">
            <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </button>

        <nav class="sidebar" id="sidebar">
            <div style="text-align:center; margin-bottom: 30px;">
                <img src="/assets/logo.png" style="width: 80px; filter: drop-shadow(0 0 10px var(--amethyst-glow));" onerror="this.style.display='none'">
                <p style="font-size: 10px; margin-top: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px;">
                    VIANDANTE: ${userName}
                </p>
            </div>
            <div class="nav-links">
                <button class="sidebar-btn" id="navNewSession">✨ CRONACHE</button>
                <button class="sidebar-btn" id="navCharacters">🎭 PERSONAGGI</button>
                <button class="sidebar-btn" id="navAssets">🎒 LO ZAINO</button>
            </div>
            <div style="flex-grow:1;"></div>
            <button class="sidebar-btn" id="navLogout" style="color:#ff4444; border-color: rgba(255,68,68,0.3);">ESCI</button>
        </nav>
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;

    // Inseriamo la sidebar nel container dedicato
    container.innerHTML = sidebarHtml;

    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('sidebar-overlay');
    const mainContent = document.getElementById('main-content');

    const toggleMenu = () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
        if (hamburger) hamburger.classList.toggle('open');
    };

    if (hamburger) hamburger.onclick = toggleMenu;
    if (overlay) overlay.onclick = toggleMenu;

    // --- LOGICA DI NAVIGAZIONE ---

    // 1. Torna alla lista Sessioni (Ricarica la dashboard)
    document.getElementById('navNewSession').onclick = () => {
        toggleMenu();
        window.location.reload(); 
    };

    // 2. Mostra Personaggi
    document.getElementById('navCharacters').onclick = () => {
        toggleMenu();
        if (mainContent) showCharacters(mainContent);
    };

    // 3. Mostra lo Zaino (Assets)
    document.getElementById('navAssets').onclick = () => {
        toggleMenu();
        if (mainContent) showAssets(mainContent);
    };

    // 4. Logout
    document.getElementById('navLogout').onclick = () => {
        if (confirm("Vuoi davvero lasciare la Taverna?")) {
            onLogout();
        }
    };
}