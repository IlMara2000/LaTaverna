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

    let actionBtnText = context === "home" ? (isGuest ? 'TORNA AL LOGIN' : 'ESCI') : "⬅ LIBRERIA";

    container.innerHTML = `
        <nav id="sidebar-menu" class="sidebar-glass">
            <div class="sidebar-header">
                <h2 class="text-amethyst">${userName.toUpperCase()}</h2>
                <span class="subtitle">${context.toUpperCase()}</span>
            </div>
            <div class="sidebar-actions">
                <button class="btn-back-glass" id="sideMusicBtn">${isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF'}</button>
                <button class="btn-back-glass" id="sideUploadBtn">🎵 CARICA</button>
                <input type="file" id="sideFileInput" accept="audio/*" style="display: none;">
                <hr class="sidebar-divider">
                <button class="btn-back-glass" id="sideActionBtn">${actionBtnText}</button>
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
        // Notifica alla Navbar di cambiare il pulsante in X
        window.dispatchEvent(new CustomEvent('sidebarState', { detail: { isOpen } }));
    };

    window.removeEventListener('toggleSidebar', window._currentToggleFn);
    window._currentToggleFn = toggle;
    window.addEventListener('toggleSidebar', toggle);

    container.querySelector('#sideActionBtn').onclick = async () => {
        toggle();
        if (context === "home") {
            currentLogoutFn();
        } else {
            showLobby(mainContent);
        }
    };

    // Logica musica rimasta invariata...
    container.querySelector('#sideMusicBtn').onclick = () => {
        isMusicOn = !isMusicOn;
        localStorage.setItem('taverna_music', isMusicOn ? 'on' : 'off');
        container.querySelector('#sideMusicBtn').innerText = isMusicOn ? '🔊 MUSICA: ON' : '🔈 MUSICA: OFF';
        window.dispatchEvent(new CustomEvent('musicToggled', { detail: isMusicOn }));
    };
}

export function updateSidebarContext(newContext) {
    const container = document.getElementById('sidebar-container');
    if (container) renderSidebarContent(container, newContext);
}
