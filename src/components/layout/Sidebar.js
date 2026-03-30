let currentSidebarUser = null;
let currentLogoutFn = null;
let isMusicOn = localStorage.getItem('taverna_music') !== 'off'; // Default ON

export function initSidebar(container, user, onLogout, context = "home") {
    const guestData = localStorage.getItem('taverna_guest_user');
    currentSidebarUser = user || (guestData ? JSON.parse(guestData) : null);
    
    currentLogoutFn = onLogout;
    renderSidebarContent(container, context);
}

function renderSidebarContent(container, context) {
    const isGuest = currentSidebarUser?.isGuest === true;
    const userName = isGuest ? "OSPITE" : (currentSidebarUser?.user_metadata?.full_name || "Viandante");

    // Configurazione dinamica dei bottoni centrali
    let buttonsHtml = "";
    
    // Testo e azione dinamica del tasto di uscita/ritorno
    let actionBtnText = "⬅ TORNA ALLA LIBRERIA";
    let isMainHub = context === "home";

    if (context === "minigames") {
        actionBtnText = "⬅ TORNA AI MINIGIOCHI";
        buttonsHtml = `
            <button class="btn-primary" id="sideMusicBtn">${isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF'}</button>
            <button class="btn-primary" id="sideProfile">IL MIO PROFILO</button>
        `;
    } else if (context === "dnd5e") {
        buttonsHtml = `
            <button class="btn-primary" id="sideMusicBtn">${isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF'}</button>
            <button class="btn-primary" id="sideCharacters">I MIEI EROI</button>
        `;
    } else {
        // Home / Default
        buttonsHtml = `
            <button class="btn-primary" id="sideProfile">IL MIO PROFILO</button>
            <button class="btn-primary" id="sideSettings">IMPOSTAZIONI</button>
        `;
    }

    if (isMainHub) {
        actionBtnText = isGuest ? 'TORNA AL LOGIN' : 'ESCI DALLA TAVERNA';
    }

    container.innerHTML = `
        <nav id="sidebar-menu" style="
            position: fixed; right: -100%; top: 0; 
            width: 100%; height: 100%; 
            background: rgba(5, 2, 10, 0.98); backdrop-filter: blur(20px); 
            z-index: 9000; transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1); 
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        ">
            <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="color: #9d4ede; margin:0;">${userName.toUpperCase()}</h2>
                <span style="font-size: 10px; opacity: 0.5; letter-spacing: 2px;">${context.toUpperCase()}</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 15px; width: 85%; max-width: 300px;">
                ${buttonsHtml}
                <hr style="width: 100%; opacity: 0.1; margin: 10px 0;">
                <button class="btn-primary" id="sideActionBtn" style="${isMainHub ? 'border: 1px solid #ff4444; color: #ff4444; background:none;' : ''}">
                    ${actionBtnText}
                </button>
            </div>
        </nav>
    `;

    setupEventListeners(container, context, isMainHub);
}

function setupEventListeners(container, context, isMainHub) {
    const sidebar = document.getElementById('sidebar-menu');
    const mainContent = document.getElementById('main-content');
    
    const toggle = () => {
        const isOpen = sidebar.style.right === '0px';
        sidebar.style.right = isOpen ? '-100%' : '0px';
    };

    // Listener per il toggle (richiamato dal tasto menu esterno)
    window.removeEventListener('toggleSidebar', window._currentToggleFn);
    window._currentToggleFn = toggle;
    window.addEventListener('toggleSidebar', toggle);

    // Gestione tasto Azione (Esci o Torna)
    document.getElementById('sideActionBtn').onclick = async () => {
        toggle();
        if (isMainHub) {
            currentLogoutFn();
        } else if (context === "minigames") {
            // Se siamo dentro un minigioco, torniamo alla lista minigiochi
            const { showMinigames } = await import('../../features/minigames/MinigamesList.js'); 
            showMinigames(mainContent);
        } else {
            // Ritorno standard alla lobby
            const { showLobby } = await import('../../lobby.js');
            showLobby(mainContent);
        }
    };

    // Gestione tasto Musica (ON/OFF)
    const musicBtn = document.getElementById('sideMusicBtn');
    if (musicBtn) {
        musicBtn.onclick = () => {
            isMusicOn = !isMusicOn;
            localStorage.setItem('taverna_music', isMusicOn ? 'on' : 'off');
            musicBtn.innerText = isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF';
            
            // Dispatch di un evento globale così se hai un player musicale 
            // in un altro file può sentire il cambiamento
            window.dispatchEvent(new CustomEvent('musicToggled', { detail: isMusicOn }));
        };
    }

    // Altri tasti...
    if (document.getElementById('sideProfile')) {
        document.getElementById('sideProfile').onclick = async () => {
            toggle();
            const { showProfile } = await import('../features/user/Profile.js');
            showProfile(mainContent, currentSidebarUser);
        };
    }
}

export function updateSidebarContext(newContext) {
    const container = document.getElementById('sidebar-container');
    if (container) renderSidebarContent(container, newContext);
}