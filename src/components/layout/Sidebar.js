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

    let actionBtnText = context === "home" ? (isGuest ? 'ACCEDI' : 'ESCI') : "⬅ LIBRERIA";

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
                <button class="btn-back-glass" id="sideUploadBtn">🎵 CARICA MUSICA</button>
                <input type="file" id="sideFileInput" accept="audio/*" style="display: none;">
                
                <hr class="sidebar-divider">
                
                <button class="btn-back-glass ${context === 'home' ? 'btn-danger' : ''}" id="sideActionBtn">
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
    
    // Funzione interna per gestire l'apertura/chiusura
    const toggle = () => {
        const isOpen = sidebar.classList.toggle('active');
        // Notifichiamo alla Navbar di cambiare il bottone (Hamburger -> X)
        window.dispatchEvent(new CustomEvent('sidebarState', { detail: { isOpen } }));
    };

    // Pulizia e assegnazione evento toggle
    window.removeEventListener('toggleSidebar', window._currentToggleFn);
    window._currentToggleFn = toggle;
    window.addEventListener('toggleSidebar', toggle);

    // Gestione Bottone Azione (Esci o Torna alla Lobby)
    const actionBtn = container.querySelector('#sideActionBtn');
    actionBtn.onclick = async () => {
        toggle(); // Chiude la sidebar
        if (context === "home") {
            if (currentLogoutFn) currentLogoutFn();
        } else {
            // Torna alla lobby se sei in un minigioco
            showLobby(mainContent);
        }
    };

    // Logica Musica
    container.querySelector('#sideMusicBtn').onclick = () => {
        isMusicOn = !isMusicOn;
        localStorage.setItem('taverna_music', isMusicOn ? 'on' : 'off');
        container.querySelector('#sideMusicBtn').innerText = isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF';
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
