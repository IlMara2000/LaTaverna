// Sidebar.js - Versione Unificata con Music Center
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

    let actionBtnText = context === "home" ? (isGuest ? 'ACCEDI' : 'ESCI DALLA TAVERNA') : "⬅ TORNA AI GIOCHI";

    container.innerHTML = `
        <nav id="sidebar-menu" class="sidebar-glass">
            <div class="sidebar-header" style="margin-bottom: 40px;">
                <h2 class="text-amethyst" style="font-size: 1.8rem; letter-spacing: -1px; margin-bottom: 5px;">${userName.toUpperCase()}</h2>
                <span class="subtitle" style="opacity: 0.6; font-size: 0.7rem; letter-spacing: 2px;">MODALITÀ ${context.toUpperCase()}</span>
            </div>
            
            <div class="sidebar-actions" style="display: flex; flex-direction: column; gap: 15px;">
                <button class="btn-back-glass" id="sideMusicBtn">
                    ${isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF'}
                </button>
                
                <button class="btn-back-glass" id="sideMusicCenterBtn">
                    🎵 LIBRERIA MUSICALE
                </button>
                
                <input type="file" id="sideFileInput" accept="audio/*" style="display: none;">
                
                <div id="currentTrackName" style="font-size: 10px; color: #9d4ede; opacity: 0.8; text-align: center; margin-top: -10px; display: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>

                <div class="sidebar-divider" style="margin: 20px 0; height: 1px; background: rgba(255,255,255,0.1);"></div>
                
                <button class="btn-back-glass" id="sideActionBtn" style="${context === 'home' && !isGuest ? 'border-color: rgba(255,68,68,0.3); color: #ff6b6b;' : ''}">
                    ${actionBtnText}
                </button>
            </div>
        </nav>
    `;

    setupEventListeners(container, context);
}

function setupEventListeners(container, context) {
    const sidebar = container.querySelector('#sidebar-menu');
    const mainContent = document.getElementById('app') || document.getElementById('main-content'); 
    
    const toggle = () => {
        const isOpen = sidebar.classList.toggle('active');
        if (!sidebar.classList.contains('active')) {
            sidebar.style.right = '-100%';
        } else {
            sidebar.style.right = '0';
        }
        window.dispatchEvent(new CustomEvent('sidebarState', { detail: { isOpen } }));
    };

    window.removeEventListener('toggleSidebar', window._currentToggleFn);
    window._currentToggleFn = toggle;
    window.addEventListener('toggleSidebar', toggle);

    // --- NAVIGAZIONE ---
    const actionBtn = container.querySelector('#sideActionBtn');
    actionBtn.onclick = async () => {
        toggle(); 
        if (context === "home") {
            if (currentLogoutFn) currentLogoutFn();
        } else if (context === "minigames" || context.includes('game-')) {
            const { showMinigamesList } = await import('../../minigamelist.js');
            showMinigamesList(mainContent);
        } else {
            const { showLobby } = await import('../../lobby.js');
            showLobby(mainContent);
        }
    };

    // --- TOGGLE AUDIO ON/OFF ---
    container.querySelector('#sideMusicBtn').onclick = function() {
        isMusicOn = !isMusicOn;
        localStorage.setItem('taverna_music', isMusicOn ? 'on' : 'off');
        this.innerHTML = isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF';
        window.dispatchEvent(new CustomEvent('musicToggled', { detail: isMusicOn }));
    };

    // --- APERTURA MUSIC CENTER (Invece del semplice file picker) ---
    const musicCenterBtn = container.querySelector('#sideMusicCenterBtn');
    musicCenterBtn.onclick = async () => {
        toggle(); // Chiude la sidebar
        try {
            // Importiamo l'AudioManager e mostriamo la UI nel mainContent
            const { AudioManager } = await import('../ui/AudioManager.js');
            AudioManager.showMusicCenter(mainContent);
        } catch (err) {
            console.error("Errore nel caricamento del Music Center:", err);
        }
    };

    // --- GESTIONE UPLOAD (Opzionale/Evento) ---
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

    // Ascolta se la musica cambia per aggiornare il nome brano in sidebar
    window.addEventListener('musicStarted', () => {
        // Se volessimo mostrare un "Now Playing" dinamico
    });
}

export function updateSidebarContext(newContext) {
    const container = document.getElementById('sidebar-container');
    if (container) renderSidebarContent(container, newContext);
}