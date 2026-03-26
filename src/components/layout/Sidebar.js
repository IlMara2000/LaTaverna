/**
 * Inizializza la navigazione laterale della Taverna
 */
export function initSidebar(container, user, onLogout) {
    // 1. Gestione sicura dell'utente (evita crash se l'oggetto è nullo)
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Viandante";

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

    container.innerHTML = sidebarHtml;

    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('sidebar-overlay');
    const mainContent = document.getElementById('main-content');

    const toggleMenu = () => {
        if (sidebar) sidebar.classList.toggle('active');
        if (overlay) overlay.classList.toggle('active');
        if (hamburger) hamburger.classList.toggle('open');
    };

    if (hamburger) hamburger.onclick = toggleMenu;
    if (overlay) overlay.onclick = toggleMenu;

    // --- LOGICA DI NAVIGAZIONE CON IMPORT DINAMICI ---

    // 1. Cronache (Reload)
    document.getElementById('navNewSession').onclick = () => {
        toggleMenu();
        window.location.reload(); 
    };

    // 2. Personaggi (Import Dinamico)
    document.getElementById('navCharacters').onclick = async () => {
        toggleMenu();
        try {
            // Usciamo da layout/ ed entriamo in features/
            const { showCharacters } = await import('../features/characters/CharList.js');
            if (mainContent) showCharacters(mainContent);
        } catch (err) {
            console.error("Errore nel caricamento dei Personaggi:", err);
        }
    };

    // 3. Zaino / Assets (Import Dinamico)
    document.getElementById('navAssets').onclick = async () => {
        toggleMenu();
        try {
            // Usciamo da layout/ ed entriamo in features/
            const { showAssets } = await import('../features/zaino/Assets.js');
            if (mainContent) showAssets(mainContent);
        } catch (err) {
            console.error("Errore nel caricamento dello Zaino:", err);
        }
    };

    // 4. Logout
    document.getElementById('navLogout').onclick = () => {
        if (confirm("Vuoi davvero lasciare la Taverna?")) {
            onLogout();
        }
    };
}