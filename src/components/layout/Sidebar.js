export function initSidebar(container, user, onLogout) {
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Viandante";
    const mainContent = document.getElementById('main-content');

    container.innerHTML = `
        <nav id="sidebar-menu" style="
            position: fixed; 
            right: -100%; 
            top: 0; 
            width: 100%; 
            height: 100%; 
            background: radial-gradient(circle at center, var(--deep-purple) 0%, var(--void-black) 100%);
            backdrop-filter: blur(20px); 
            -webkit-backdrop-filter: blur(20px);
            z-index: 9000; 
            transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1); 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center;
            padding: 40px;
        ">
            <div style="text-align: center; margin-bottom: 60px;">
                <img src="/assets/logo.png" style="width: 100px; filter: drop-shadow(0 0 20px var(--amethyst-glow)); margin-bottom: 20px;" onerror="this.style.display='none'">
                <h2 style="font-size: 2rem; font-weight: 900; letter-spacing: -1px; text-transform: uppercase;">
                    ${userName}
                </h2>
                <div style="width: 40px; height: 4px; background: var(--amethyst); margin: 15px auto; border-radius: 2px;"></div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 15px; width: 100%; max-width: 320px;">
                <button class="btn-primary" id="sideNavCronache" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    ✨ CRONACHE
                </button>
                <button class="btn-primary" id="sideNavCharacters" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    🎭 PERSONAGGI
                </button>
                <button class="btn-primary" id="sideNavAssets" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;">
                    🎒 LO ZAINO
                </button>
            </div>

            <button id="close-sidebar" style="
                margin-top: 60px; 
                background: var(--glass-bg); 
                border: 1px solid var(--glass-border); 
                color: white; 
                width: 60px; 
                height: 60px; 
                border-radius: 50%; 
                font-size: 24px; 
                cursor: pointer;
                transition: 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(10px);
            ">✕</button>
            
            <button id="sideNavLogout" style="
                position: absolute; 
                bottom: 40px; 
                background: none; 
                border: none; 
                color: #ff4444; 
                font-size: 12px; 
                font-weight: 800; 
                letter-spacing: 2px; 
                text-transform: uppercase; 
                cursor: pointer;
                opacity: 0.6;
            ">ESCI</button>
        </nav>
    `;

    const sidebar = document.getElementById('sidebar-menu');
    const closeBtn = document.getElementById('close-sidebar');

    const toggleMenu = () => {
        const isOpen = sidebar.style.right === '0px';
        sidebar.style.right = isOpen ? '-100%' : '0px';
    };

    window.addEventListener('toggleSidebar', toggleMenu);
    closeBtn.onclick = toggleMenu;

    // --- LOGICA NAVIGAZIONE ---
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