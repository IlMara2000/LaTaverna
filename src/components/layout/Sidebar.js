export function initSidebar(container, user, onLogout) {
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Viandante";
    const mainContent = document.getElementById('main-content');

    container.innerHTML = `
        <nav id="sidebar-menu" style="position: fixed; left: -280px; top: 0; width: 280px; height: 100%; background: #0a0512; z-index: 2000; transition: 0.4s cubic-bezier(0.4, 0, 0.2, 1); padding: 40px 20px; display: flex; flex-direction: column; border-right: 1px solid var(--glass-border);">
            <div style="text-align: center; margin-bottom: 40px;">
                <img src="/assets/logo.png" style="width: 60px; filter: drop-shadow(0 0 10px var(--amethyst-glow));" onerror="this.style.display='none'">
                <p style="font-size: 10px; margin-top: 15px; opacity: 0.5; letter-spacing: 1px;">MENU DI NAVIGAZIONE</p>
            </div>
            
            <div class="nav-links" style="display: flex; flex-direction: column; gap: 10px;">
                <button class="sidebar-btn" id="sideNavCronache">✨ CRONACHE</button>
                <button class="sidebar-btn" id="sideNavCharacters">🎭 PERSONAGGI</button>
                <button class="sidebar-btn" id="sideNavAssets">🎒 LO ZAINO</button>
            </div>

            <div style="flex-grow: 1;"></div>
            
            <button class="sidebar-btn" id="sideNavLogout" style="color: #ff4444; border-color: rgba(255,68,68,0.2);">🚪 ESCI</button>
        </nav>
        <div id="sidebar-overlay-shadow" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: none; z-index: 1500; backdrop-filter: blur(4px);"></div>
    `;

    const sidebar = document.getElementById('sidebar-menu');
    const overlay = document.getElementById('sidebar-overlay-shadow');

    const toggleMenu = () => {
        const isOpen = sidebar.style.left === '0px';
        sidebar.style.left = isOpen ? '-280px' : '0px';
        overlay.style.display = isOpen ? 'none' : 'block';
    };

    // ASCOLTA L'EVENTO DALLA NAVBAR
    window.addEventListener('toggleSidebar', toggleMenu);
    
    // Chiude se clicchi l'overlay
    overlay.onclick = toggleMenu;

    // --- AZIONI ---
    document.getElementById('sideNavCronache').onclick = () => { toggleMenu(); window.location.reload(); };
    
    document.getElementById('sideNavCharacters').onclick = async () => {
        toggleMenu();
        const { showCharacters } = await import('../features/characters/CharList.js');
        if (mainContent) showCharacters(mainContent);
    };

    document.getElementById('sideNavAssets').onclick = async () => {
        toggleMenu();
        const { showAssets } = await import('../features/zaino/Assets.js');
        if (mainContent) showAssets(mainContent);
    };

    document.getElementById('sideNavLogout').onclick = () => {
        if (confirm("Vuoi davvero lasciare la Taverna?")) onLogout();
    };
}