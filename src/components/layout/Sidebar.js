/**
 * SIDEBAR (Il Menu a comparsa laterale)
 */
export function initSidebar(container, user, onLogout) {
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Viandante";
    const mainContent = document.getElementById('main-content');

    container.innerHTML = `
        <nav id="sidebar-menu" class="sidebar" style="
            position: fixed;
            right: -100%; /* Parte da destra fuori schermo */
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 2, 10, 0.95);
            backdrop-filter: blur(20px);
            z-index: 2500;
            transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
        ">
            <div style="text-align: center; margin-bottom: 50px;">
                <img src="/assets/logo.png" style="width: 100px; filter: drop-shadow(0 0 15px var(--amethyst-glow));" onerror="this.style.display='none'">
                <h2 style="margin-top: 20px; letter-spacing: 2px; font-weight: 900;">${userName}</h2>
            </div>
            
            <div class="nav-links" style="display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 300px;">
                <button class="sidebar-btn" id="sideNavCronache" style="width: 100%; padding: 20px; font-size: 16px;">✨ CRONACHE</button>
                <button class="sidebar-btn" id="sideNavCharacters" style="width: 100%; padding: 20px; font-size: 16px;">🎭 PERSONAGGI</button>
                <button class="sidebar-btn" id="sideNavAssets" style="width: 100%; padding: 20px; font-size: 16px;">🎒 LO ZAINO</button>
            </div>

            <button id="close-sidebar" style="margin-top: 50px; background: none; border: 1px solid var(--glass-border); color: white; width: 50px; height: 50px; border-radius: 50%; font-size: 20px; cursor: pointer;">✕</button>
            
            <button class="sidebar-btn" id="sideNavLogout" style="position: absolute; bottom: 40px; color: #ff4444; border: none; background: none; opacity: 0.6;">ESCI</button>
        </nav>
    `;

    const sidebar = document.getElementById('sidebar-menu');
    const closeBtn = document.getElementById('close-sidebar');

    const toggleMenu = () => {
        const isOpen = sidebar.style.right === '0px';
        sidebar.style.right = isOpen ? '-100%' : '0px';
    };

    // Ascolta il pulsante fluttuante (la Navbar)
    window.addEventListener('toggleSidebar', toggleMenu);
    closeBtn.onclick = toggleMenu;

    // Navigazione
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