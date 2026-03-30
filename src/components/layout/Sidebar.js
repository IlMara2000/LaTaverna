import { showLobby } from '../../lobby.js';
// Importiamo la funzione per mostrare la lista dei minigiochi
import { showMinigamesList } from '../../minigameslist.js';

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

    // Testo dinamico per il bottone principale
    let actionBtnText = context === "home" ? (isGuest ? 'ACCEDI' : 'ESCI') : "⬅ TORNA AI GIOCHI";

    container.innerHTML = `
        <nav id="sidebar-menu" class="sidebar-glass">
            <div class="sidebar-header" style="margin-bottom: 40px;">
                <h2 class="text-amethyst" style="font-size: 1.8rem; letter-spacing: -1px;">${userName.toUpperCase()}</h2>
                <span class="subtitle" style="opacity: 0.6;">MODALITÀ ${context.toUpperCase()}</span>
            </div>
            
            <div class="sidebar-actions" style="display: flex; flex-direction: column; gap: 15px;">
                <button class="btn-back-glass" id="sideMusicBtn">
                    ${isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF'}
                </button>
                
                <button class="btn-back-glass" id="sideUploadBtn">
                    🎵 CARICA MUSICA
                </button>
                
                <input type="file" id="sideFileInput" accept="audio/*" style="display: none;">
                
                <div class="sidebar-divider" style="margin: 20px 0;"></div>
                
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
    const mainContent = document.getElementById('app'); 
    
    const toggle = () => {
        const isOpen = sidebar.classList.toggle('active');
        window.dispatchEvent(new CustomEvent('sidebarState', { detail: { isOpen } }));
    };

    window.removeEventListener('toggleSidebar', window._currentToggleFn);
    window._currentToggleFn = toggle;
    window.addEventListener('toggleSidebar', toggle);

    const actionBtn = container.querySelector('#sideActionBtn');
    actionBtn.onclick = async () => {
        toggle(); 
        if (context === "home") {
            if (currentLogoutFn) currentLogoutFn();
        } else if (context === "minigames") {
            // Se siamo in un gioco, torniamo alla lista giochi
            showMinigamesList(mainContent);
        } else {
            // Fallback per altri contesti (es. profilo o impostazioni)
            showLobby(mainContent);
        }
    };

    container.querySelector('#sideMusicBtn').onclick = function() {
        isMusicOn = !isMusicOn;
        localStorage.setItem('taverna_music', isMusicOn ? 'on' : 'off');
        this.innerHTML = isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF';
        window.dispatchEvent(new CustomEvent('musicToggled', { detail: isMusicOn }));
    };

    const upBtn = container.querySelector('#sideUploadBtn');
    const fInput = container.querySelector('#sideFileInput');
    if (upBtn && fInput) {
        upBtn.onclick = () => fInput.click();
        fInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                window.dispatchEvent(new CustomEvent('musicUploaded', { detail: { url, name: file.name } }));
            }
        };
    }
}

export function updateSidebarContext(newContext) {
    const container = document.getElementById('sidebar-container');
    if (container) renderSidebarContent(container, newContext);
}
