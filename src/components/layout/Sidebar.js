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

    let actionBtnText = "⬅ TORNA ALLA LIBRERIA";
    let isMainHub = context === "home";

    if (isMainHub) {
        actionBtnText = isGuest ? 'TORNA AL LOGIN' : 'ESCI DALLA TAVERNA';
    } else if (context === "minigames") {
        actionBtnText = "⬅ TORNA AI MINIGIOCHI";
    }

    // Abbiamo unificato i pulsanti musicali per quasi tutti i contesti
    const musicButtonsHtml = `
        <button class="btn-primary" id="sideMusicBtn">
            ${isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF'}
        </button>
        <button class="btn-primary" id="sideUploadBtn">
            🎵 CARICA MUSICA
        </button>
        <input type="file" id="sideFileInput" accept="audio/*" style="display: none;">
        <div id="sideCurrentTrack" style="font-size: 9px; opacity: 0.5; margin-top: -10px; text-align: center; display: none; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
    `;

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
                ${musicButtonsHtml}
                <button class="btn-primary" id="sideProfile">IL MIO PROFILO</button>
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

    window.removeEventListener('toggleSidebar', window._currentToggleFn);
    window._currentToggleFn = toggle;
    window.addEventListener('toggleSidebar', toggle);

    // --- GESTIONE NAVIGAZIONE ---
    document.getElementById('sideActionBtn').onclick = async () => {
        toggle();
        if (isMainHub) {
            currentLogoutFn();
            return;
        }
        try {
            if (context === "minigames") {
                const { showMinigamesLobby } = await import('../../minigamelist.js');
                showMinigamesLobby(mainContent);
            } else {
                const { showLobby } = await import('../../lobby.js');
                showLobby(mainContent);
            }
        } catch (err) {
            const { showLobby } = await import('../../lobby.js');
            showLobby(mainContent);
        }
    };

    // --- GESTIONE MUSICA (Tasto Toggle) ---
    const musicBtn = document.getElementById('sideMusicBtn');
    if (musicBtn) {
        musicBtn.onclick = () => {
            isMusicOn = !isMusicOn;
            localStorage.setItem('taverna_music', isMusicOn ? 'on' : 'off');
            musicBtn.innerText = isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF';
            window.dispatchEvent(new CustomEvent('musicToggled', { detail: isMusicOn }));
        };
    }

    // --- GESTIONE CARICAMENTO (Tasto Upload) ---
    const uploadBtn = document.getElementById('sideUploadBtn');
    const fileInput = document.getElementById('sideFileInput');
    const trackLabel = document.getElementById('sideCurrentTrack');

    if (uploadBtn && fileInput) {
        uploadBtn.onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                
                // Aggiorna interfaccia locale
                trackLabel.style.display = 'block';
                trackLabel.innerText = `In riproduzione: ${file.name}`;
                
                // Invia l'evento al tuo AudioManager.js
                window.dispatchEvent(new CustomEvent('musicUploaded', { 
                    detail: { url, name: file.name } 
                }));
            }
        };
    }

    // --- GESTIONE PROFILO ---
    const profileBtn = document.getElementById('sideProfile');
    if (profileBtn) {
        profileBtn.onclick = async () => {
            toggle();
            try {
                const { showProfile } = await import('../features/user/Profile.js');
                showProfile(mainContent, currentSidebarUser);
            } catch (err) { console.error("Errore profilo:", err); }
        };
    }
}

export function updateSidebarContext(newContext) {
    const container = document.getElementById('sidebar-container');
    if (container) renderSidebarContent(container, newContext);
}