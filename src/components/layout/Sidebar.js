// Sidebar.js - Versione Master Integrata (Fiducia Totale)
let currentSidebarUser = null;
let currentLogoutFn = null;
let isMusicOn = localStorage.getItem('taverna_music') !== 'off';
let currentActiveContext = "lobby";

export function initSidebar(container, user, onLogout, context = "home") {
    const guestData = localStorage.getItem('taverna_guest_user');
    currentSidebarUser = user || (guestData ? JSON.parse(guestData) : null);
    currentLogoutFn = onLogout;
    currentActiveContext = context;
    renderSidebarContent(container, context);
}

function renderSidebarContent(container, context) {
    const isGuest = currentSidebarUser?.isGuest === true;
    const userName = isGuest ? "OSPITE" : (currentSidebarUser?.user_metadata?.full_name || "Viandante");

    // Testo dinamico per il tasto in fondo
    let actionBtnText = context === "home" ? (isGuest ? 'ACCEDI' : 'ESCI DALLA TAVERNA') : "⬅ TORNA ALLA HOME";

    container.innerHTML = `
        <div class="floating-trigger" id="sidebar-trigger">
            <div class="nav-bar"></div>
            <div class="nav-bar"></div>
            <div class="nav-bar"></div>
        </div>

        <nav id="sidebar-menu" class="sidebar-glass">
            <div class="sidebar-header" style="margin-bottom: 30px;">
                <h2 class="text-amethyst" style="font-size: 1.6rem; letter-spacing: -1px; margin-bottom: 5px;">${userName.toUpperCase()}</h2>
                <span class="subtitle" style="opacity: 0.6; font-size: 0.7rem; letter-spacing: 2px;">MODALITÀ ${context.toUpperCase()}</span>
            </div>
            
            <div class="sidebar-nav-links" style="display: flex; flex-direction: column; gap: 18px; margin-bottom: 30px;">
                <a href="#" data-context="lobby" id="nav-lobby" style="color: white; text-decoration: none; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 12px; transition: 0.3s;">
                    <span>🏠</span> Sala Principale
                </a>
                <a href="#" data-context="profile" id="nav-profile" style="color: white; text-decoration: none; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 12px; transition: 0.3s;">
                    <span>📜</span> Pergamena
                </a>
                <a href="#" data-context="zaino" id="nav-zaino" style="color: white; text-decoration: none; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 12px; transition: 0.3s;">
                    <span>🎒</span> Zaino
                </a>
                <a href="#" data-context="minigames" id="nav-minigames" style="color: white; text-decoration: none; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 12px; transition: 0.3s;">
                    <span>🎲</span> Minigiochi
                </a>
                <a href="#" data-context="settings" id="nav-settings" style="color: white; text-decoration: none; font-size: 1rem; font-weight: 600; display: flex; align-items: center; gap: 12px; transition: 0.3s;">
                    <span>⚙️</span> Impostazioni
                </a>
            </div>

            <div class="sidebar-actions" style="display: flex; flex-direction: column; gap: 12px;">
                <div class="sidebar-divider" style="height: 1px; background: rgba(255,255,255,0.1); margin-bottom: 10px;"></div>
                
                <button class="btn-glass" id="sideMusicBtn" style="font-size: 0.8rem; padding: 12px;">
                    ${isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF'}
                </button>
                
                <button class="btn-glass" id="sideMusicCenterBtn" style="font-size: 0.8rem; padding: 12px;">
                    🎵 LIBRERIA MUSICALE
                </button>
                
                <button id="btn-fix-games" class="btn-primary" style="margin-top: 10px; background: rgba(255, 65, 108, 0.1); border-color: #ff416c; color: #ff416c; font-size: 0.8rem; padding: 12px;">
                    🛠️ SBLOCCA SCHERMO
                </button>

                <div class="sidebar-divider" style="margin: 15px 0; height: 1px; background: rgba(255,255,255,0.1);"></div>
                
                <button class="btn-back-glass" id="sideActionBtn" style="${context === 'home' && !isGuest ? 'border-color: rgba(255,68,68,0.3); color: #ff6b6b;' : ''} font-size: 0.85rem;">
                    ${actionBtnText}
                </button>
            </div>
            
            <input type="file" id="sideFileInput" accept="audio/*" style="display: none;">
            <div id="currentTrackName" style="font-size: 9px; color: #9d4ede; opacity: 0.8; text-align: center; margin-top: 10px; display: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
        </nav>
    `;

    setupEventListeners(container, context);
    highlightActiveContext();
}

function resetGlobalScroll() {
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    document.body.style.backgroundColor = '';
}

function highlightActiveContext() {
    const items = document.querySelectorAll('#sidebar-menu a');
    items.forEach(item => {
        if (item.dataset.context === currentActiveContext) {
            item.style.color = "var(--amethyst-bright)";
            item.style.textShadow = "0 0 10px var(--amethyst-glow)";
        }
    });
}

function setupEventListeners(container, context) {
    const sidebar = container.querySelector('#sidebar-menu');
    const trigger = container.querySelector('#sidebar-trigger');
    const mainContent = document.getElementById('app'); 
    
    const toggle = () => {
        const isOpen = sidebar.classList.toggle('active');
        trigger.classList.toggle('is-active');
        if (!isOpen) {
            sidebar.style.right = '-110%';
        } else {
            sidebar.style.right = '0';
        }
        window.dispatchEvent(new CustomEvent('sidebarState', { detail: { isOpen } }));
    };

    trigger.onclick = toggle;

    // --- NAVIGAZIONE LINKS ---
    const attachNav = (id, modulePath, funcName, contextName) => {
        const el = document.getElementById(id);
        if(el) {
            el.onclick = async (e) => {
                e.preventDefault();
                toggle();
                resetGlobalScroll();
                currentActiveContext = contextName;
                try {
                    const module = await import(modulePath);
                    if (mainContent) {
                         mainContent.innerHTML = '';
                         module[funcName](mainContent);
                    }
                } catch (err) { console.error(`Errore nav: ${modulePath}`, err); }
            };
        }
    };

    attachNav('nav-lobby', '../../lobby.js', 'showLobby', 'lobby');
    attachNav('nav-profile', '../features/user/Profile.js', 'showProfile', 'profile');
    attachNav('nav-zaino', '../features/zaino/Assets.js', 'showZaino', 'zaino');
    attachNav('nav-minigames', '../../minigamelist.js', 'showMinigamesList', 'minigames');
    attachNav('nav-settings', '../features/user/Settings.js', 'showSettings', 'settings');

    // --- TASTO AZIONE (ESCI O TORNA) ---
    const actionBtn = container.querySelector('#sideActionBtn');
    actionBtn.onclick = async () => {
        toggle(); 
        resetGlobalScroll();

        if (context === "home") {
            if (currentLogoutFn) currentLogoutFn();
        } else {
            const { showLobby } = await import('../../lobby.js');
            showLobby(mainContent);
        }
    };

    // --- PANIC BUTTON (SBLOCCO) ---
    const btnFix = container.querySelector('#btn-fix-games');
    btnFix.onclick = () => {
        resetGlobalScroll();
        window.location.href = '/'; 
    };

    // --- MUSICA ---
    container.querySelector('#sideMusicBtn').onclick = function() {
        isMusicOn = !isMusicOn;
        localStorage.setItem('taverna_music', isMusicOn ? 'on' : 'off');
        this.innerHTML = isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF';
        window.dispatchEvent(new CustomEvent('musicToggled', { detail: isMusicOn }));
    };

    const musicCenterBtn = container.querySelector('#sideMusicCenterBtn');
    musicCenterBtn.onclick = async () => {
        toggle();
        resetGlobalScroll();
        try {
            const { AudioManager } = await import('../ui/AudioManager.js');
            AudioManager.showMusicCenter(mainContent);
        } catch (err) { console.error("Errore Music Center", err); }
    };

    const fInput = container.querySelector('#sideFileInput');
    const trackDisplay = container.querySelector('#currentTrackName');
    fInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            trackDisplay.innerText = `📄 ${file.name.substring(0, 20)}...`;
            trackDisplay.style.display = 'block';
            window.dispatchEvent(new CustomEvent('musicUploaded', { detail: { url, name: file.name } }));
        }
    };
}

export function updateSidebarContext(newContext) {
    currentActiveContext = newContext;
    const container = document.getElementById('sidebar-container');
    if (container) renderSidebarContent(container, newContext);
}