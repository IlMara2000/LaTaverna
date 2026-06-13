// Sidebar.js - Versione Master Integrata (Fiducia Totale)
import { getPreference, setPreference } from '../../services/userPreferences.js';
import { navigateTo, resetAppSurface } from '../../services/appNavigation.js';

let currentSidebarUser = null;
let currentLogoutFn = null;
let isMusicOn = true;
let currentActiveContext = "lobby";

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export function initSidebar(container, user, onLogout, context = "home") {
    currentSidebarUser = user || null;
    currentLogoutFn = onLogout;
    currentActiveContext = context;
    renderSidebarContent(container, context);
    getPreference('music.enabled', true).then(enabled => {
        if (isMusicOn !== Boolean(enabled)) {
            isMusicOn = Boolean(enabled);
            renderSidebarContent(container, currentActiveContext);
        }
    });
}

function renderSidebarContent(container, context) {
    const isGuest = currentSidebarUser?.isGuest === true;
    const userName = escapeHTML(isGuest ? "OSPITE" : (currentSidebarUser?.user_metadata?.full_name || "Viandante"));

    let actionBtnText = context === "home" ? (isGuest ? 'ACCEDI' : 'ESCI DALLA TAVERNA') : "⬅ TORNA ALLA HOME";

    container.innerHTML = `
        <nav id="sidebar-menu" class="sidebar-glass">
            <div class="sidebar-header" style="margin-bottom: 24px;">
                <h2 class="text-amethyst" style="font-size: 1.6rem; letter-spacing: -1px; margin-bottom: 5px;">${userName.toUpperCase()}</h2>
                <span class="subtitle" style="opacity: 0.6; font-size: 0.7rem; letter-spacing: 2px;">SEZIONE ${context.toUpperCase()}</span>
            </div>

            <div class="sidebar-actions" style="display: flex; flex-direction: column; gap: 12px;">
                <span class="subtitle" style="opacity: 0.48; font-size: 0.62rem; letter-spacing: 2px;">GIOCA</span>

                <button class="btn-glass sidebar-nav-item" id="nav-home" data-context="home" style="font-size: 0.8rem; padding: 12px;">
                    TAVERNA
                </button>

                <button class="btn-glass sidebar-nav-item" id="nav-minigames" data-context="minigames" style="font-size: 0.8rem; padding: 12px;">
                    SALA GIOCHI
                </button>

                <button class="btn-glass sidebar-nav-item" id="nav-dnd5e" data-context="dnd5e" style="font-size: 0.8rem; padding: 12px;">
                    D&D 5E
                </button>

                <button class="btn-glass sidebar-nav-item" id="nav-pathfinder2e" data-context="pathfinder2e" style="font-size: 0.8rem; padding: 12px;">
                    PATHFINDER 2E
                </button>

                <div class="sidebar-divider" style="height: 1px; background: rgba(255,255,255,0.1); margin-bottom: 10px;"></div>

                <span class="subtitle" style="opacity: 0.48; font-size: 0.62rem; letter-spacing: 2px;">ACCOUNT E ATMOSFERA</span>

                <button class="btn-glass sidebar-nav-item" id="nav-profile" data-context="profile" style="font-size: 0.8rem; padding: 12px;">
                    PROFILO
                </button>

                <button class="btn-glass sidebar-nav-item" id="nav-settings" data-context="settings" style="font-size: 0.8rem; padding: 12px;">
                    IMPOSTAZIONI
                </button>

                <button class="btn-glass" id="sideMusicCenterBtn" style="font-size: 0.8rem; padding: 12px;">
                    LIBRERIA MUSICALE
                </button>
                
                <button id="btn-fix-games" class="btn-glass" style="font-size: 0.8rem; padding: 12px;">
                    SBLOCCA SCHERMO
                </button>

                <div class="sidebar-divider" style="height: 1px; background: rgba(255,255,255,0.1); margin: 5px 0 10px;"></div>
                
                <button class="side-music-toggle ${isMusicOn ? 'is-on' : 'is-off'}" id="sideMusicBtn" aria-pressed="${isMusicOn ? 'true' : 'false'}">
                    <span class="side-music-toggle-label">MUSICA</span>
                    <span class="side-music-toggle-knob" aria-hidden="true">${isMusicOn ? '🔊' : '🔈'}</span>
                    <span class="side-music-toggle-state">${isMusicOn ? 'ON' : 'OFF'}</span>
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
    resetAppSurface();
}

function highlightActiveContext() {
    const items = document.querySelectorAll('#sidebar-menu .sidebar-nav-item');
    items.forEach(item => {
        item.style.color = "";
        item.style.textShadow = "";
        item.style.borderColor = "";
        if (item.dataset.context === currentActiveContext) {
            item.style.color = "var(--amethyst-bright)";
            item.style.textShadow = "0 0 10px var(--amethyst-glow)";
            item.style.borderColor = "var(--amethyst-bright)";
        }
    });
}

function setupEventListeners(container, context) {
    const sidebar = container.querySelector('#sidebar-menu');
    const trigger = document.getElementById('navbar-trigger');
    const mainContent = document.getElementById('app'); 
    
    const toggle = () => {
        const isOpen = sidebar.classList.toggle('active');
        trigger?.classList.toggle('is-active', isOpen);
        if (!isOpen) {
            sidebar.style.right = '-110%';
        } else {
            sidebar.style.right = '0';
        }
        window.dispatchEvent(new CustomEvent('sidebarState', { detail: { isOpen } }));
    };

    if (trigger) trigger.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
    };
    if (window.__tavernaSidebarToggle) {
        window.removeEventListener('toggleSidebar', window.__tavernaSidebarToggle);
    }
    window.__tavernaSidebarToggle = toggle;
    window.addEventListener('toggleSidebar', window.__tavernaSidebarToggle);

    const attachNav = (id, destination) => {
        const el = document.getElementById(id);
        if(el) {
            el.onclick = async (e) => {
                e.preventDefault();
                toggle();
                const navigated = await navigateTo(destination, mainContent, { user: currentSidebarUser });
                if (navigated) {
                    currentActiveContext = destination;
                    renderSidebarContent(container, destination);
                }
            };
        }
    };

    attachNav('nav-home', 'home');
    attachNav('nav-minigames', 'minigames');
    attachNav('nav-dnd5e', 'dnd5e');
    attachNav('nav-pathfinder2e', 'pathfinder2e');
    attachNav('nav-profile', 'profile');
    attachNav('nav-settings', 'settings');

    // --- TASTO AZIONE (ESCI O TORNA) ---
    const actionBtn = container.querySelector('#sideActionBtn');
    actionBtn.onclick = async () => {
        toggle(); 
        resetGlobalScroll();

        if (context === "home") {
            if (currentLogoutFn) currentLogoutFn();
        } else {
            await navigateTo('home', mainContent);
        }
    };

    // --- PANIC BUTTON (SBLOCCO) ---
    const btnFix = container.querySelector('#btn-fix-games');
    btnFix.onclick = () => {
        resetGlobalScroll();
        sessionStorage.setItem('taverna_soft_recovery_context', currentActiveContext);
        window.location.reload(); 
    };

    // --- MUSICA ---
    const musicToggle = container.querySelector('#sideMusicBtn');
    const updateMusicToggle = () => {
        musicToggle.classList.toggle('is-on', isMusicOn);
        musicToggle.classList.toggle('is-off', !isMusicOn);
        musicToggle.setAttribute('aria-pressed', isMusicOn ? 'true' : 'false');
        musicToggle.querySelector('.side-music-toggle-knob').textContent = isMusicOn ? '🔊' : '🔈';
        musicToggle.querySelector('.side-music-toggle-state').textContent = isMusicOn ? 'ON' : 'OFF';
    };
    musicToggle.onclick = () => {
        isMusicOn = !isMusicOn;
        setPreference('music.enabled', isMusicOn);
        updateMusicToggle();
        window.dispatchEvent(new CustomEvent('musicToggled', { detail: isMusicOn }));
    };

    const musicCenterBtn = container.querySelector('#sideMusicCenterBtn');
    musicCenterBtn.onclick = async () => {
        toggle();
        try {
            currentActiveContext = 'music';
            await navigateTo('music', mainContent, { user: currentSidebarUser });
            renderSidebarContent(container, 'music');
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
