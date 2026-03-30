import { showLobby } from '../../lobby.js';

let currentSidebarUser = null;
let currentLogoutFn = null;
let isMusicOn = localStorage.getItem('taverna_music') !== 'off';

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

    // Struttura HTML pulita che usa le classi di global.css
    container.innerHTML = `
        <nav id="sidebar-menu" class="sidebar-glass">
            <div class="sidebar-header">
                <h2 class="text-amethyst">${userName.toUpperCase()}</h2>
                <span class="subtitle">${context.toUpperCase()}</span>
            </div>

            <div class="sidebar-actions">
                <button class="btn-back-glass" id="sideMusicBtn">
                    ${isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF'}
                </button>
                
                <button class="btn-back-glass" id="sideUploadBtn">
                    🎵 CARICA MUSICA
                </button>
                <input type="file" id="sideFileInput" accept="audio/*" style="display: none;">
                <div id="sideCurrentTrack" class="track-label"></div>

                <button class="btn-back-glass" id="sideProfile">IL MIO PROFILO</button>
                
                <hr class="sidebar-divider">
                
                <button class="btn-back-glass ${isMainHub ? 'btn-danger' : ''}" id="sideActionBtn">
                    ${actionBtnText}
                </button>
            </div>
        </nav>
    `;

    setupEventListeners(container, context, isMainHub);
}

function setupEventListeners(container, context, isMainHub) {
    const sidebar = container.querySelector('#sidebar-menu');
    const mainContent = document.getElementById('app'); // Assicurati che l'id sia 'app' o 'main-content'
    
    // Funzione Toggle fluida
    const toggle = () => {
        sidebar.classList.toggle('active');
    };

    // Rimuove vecchi listener per evitare duplicati al cambio contesto
    window.removeEventListener('toggleSidebar', window._currentToggleFn);
    window._currentToggleFn = toggle;
    window.addEventListener('toggleSidebar', toggle);

    // --- NAVIGAZIONE ---
    const actionBtn = container.querySelector('#sideActionBtn');
    actionBtn.onclick = async () => {
        toggle();
        if (isMainHub) {
            if(currentLogoutFn) currentLogoutFn();
            return;
        }
        
        try {
            if (context === "minigames") {
                const { showMinigamesLobby } = await import('../../minigamelist.js');
                showMinigamesLobby(mainContent);
            } else {
                showLobby(mainContent);
            }
        } catch (err) {
            showLobby(mainContent);
        }
    };

    // --- MUSICA ---
    const musicBtn = container.querySelector('#sideMusicBtn');
    if (musicBtn) {
        musicBtn.onclick = () => {
            isMusicOn = !isMusicOn;
            localStorage.setItem('taverna_music', isMusicOn ? 'on' : 'off');
            musicBtn.innerText = isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF';
            window.dispatchEvent(new CustomEvent('musicToggled', { detail: isMusicOn }));
        };
    }

    // --- UPLOAD ---
    const uploadBtn = container.querySelector('#sideUploadBtn');
    const fileInput = container.querySelector('#sideFileInput');
    if (uploadBtn && fileInput) {
        uploadBtn.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                const label = container.querySelector('#sideCurrentTrack');
                label.innerText = `🎵 ${file.name}`;
                label.style.display = 'block';
                window.dispatchEvent(new CustomEvent('musicUploaded', { detail: { url, name: file.name } }));
            }
        };
    }

    // --- PROFILO ---
    const profileBtn = container.querySelector('#sideProfile');
    if (profileBtn) {
        profileBtn.onclick = async () => {
            toggle();
            try {
                // Percorso corretto per il profilo
                const { showProfile } = await import('../../dashboards/profile.js'); 
                showProfile(mainContent, currentSidebarUser);
            } catch (err) { console.error("Errore profilo:", err); }
        };
    }
}

export function updateSidebarContext(newContext) {
    const container = document.getElementById('sidebar-container');
    if (container) renderSidebarContent(container, newContext);
}
