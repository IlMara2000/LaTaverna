/**
 * Inizializza la Navbar orizzontale con Hamburger Menu
 */
export function initNavbar(container, user, onLogout) {
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Viandante";
    const mainContent = document.getElementById('main-content');

    const navbarHtml = `
        <header class="main-navbar">
            <div class="nav-left">
                <button class="hamburger-vercel" id="hamburger" aria-label="Menu">
                    <span class="bar"></span>
                    <span class="bar"></span>
                    <span class="bar"></span>
                </button>
                <span class="nav-title">LA TAVERNA</span>
            </div>
            <div class="nav-right">
                <span class="nav-user-status">${userName}</span>
            </div>
        </header>

        <nav class="sidebar" id="sidebar">
            <div class="sidebar-header">
                <img src="/assets/logo.png" class="sidebar-logo" onerror="this.style.display='none'">
                <p class="sidebar-user-name">${userName}</p>
            </div>
            
            <div class="nav-links">
                <button class="sidebar-btn" id="navNewSession">✨ CRONACHE</button>
                <button class="sidebar-btn" id="navCharacters">🎭 PERSONAGGI</button>
                <button class="sidebar-btn" id="navAssets">🎒 LO ZAINO</button>
            </div>

            <div style="flex-grow:1;"></div>
            
            <button class="sidebar-btn logout-btn" id="navLogout">
                🚪 ESCI
            </button>
        </nav>

        <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;

    container.innerHTML = navbarHtml;

    // --- LOGICA UI ---
    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('sidebar-overlay');

    const toggleMenu = () => {
        sidebar?.classList.toggle('active');
        overlay?.classList.toggle('active');
        hamburger?.classList.toggle('open');
    };

    if (hamburger) hamburger.onclick = toggleMenu;
    if (overlay) overlay.onclick = toggleMenu;

    // --- NAVIGAZIONE ---
    document.getElementById('navNewSession').onclick = () => {
        toggleMenu();
        window.location.reload(); 
    };

    document.getElementById('navCharacters').onclick = async () => {
        toggleMenu();
        try {
            const { showCharacters } = await import('../features/characters/CharList.js');
            if (mainContent) showCharacters(mainContent);
        } catch (err) { console.error("Errore Personaggi:", err); }
    };

    document.getElementById('navAssets').onclick = async () => {
        toggleMenu();
        try {
            const { showAssets } = await import('../features/zaino/Assets.js');
            if (mainContent) showAssets(mainContent);
        } catch (err) { console.error("Errore Zaino:", err); }
    };

    document.getElementById('navLogout').onclick = () => {
        if (confirm("Vuoi davvero lasciare la Taverna?")) onLogout();
    };
}