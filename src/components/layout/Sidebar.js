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
    const wasOpen = container.querySelector('#sidebar-menu')?.classList.contains('active');
    const focusedId = container.contains(document.activeElement) ? document.activeElement.id : null;
    const isGuest = currentSidebarUser?.isGuest === true;
    const userName = escapeHTML(isGuest ? "OSPITE" : (currentSidebarUser?.user_metadata?.full_name || "Viandante"));

    let actionBtnText = context === "home" ? (isGuest ? 'ACCEDI' : 'ESCI DALLA TAVERNA') : "⬅ TORNA ALLA HOME";

    container.innerHTML = `
        <button class="sidebar-backdrop" type="button" aria-label="Chiudi menu" tabindex="-1" hidden></button>
        <nav id="sidebar-menu" class="sidebar-glass" aria-label="Menu principale" inert>
            <div class="sidebar-header" style="margin-bottom: 24px;">
                <h2 class="text-amethyst" style="font-size: 1.6rem; letter-spacing: -1px; margin-bottom: 5px;">${userName.toUpperCase()}</h2>
            </div>

            <div class="sidebar-actions" style="display: flex; flex-direction: column; gap: 12px;">
                <button class="btn-glass sidebar-nav-item" id="nav-home" data-context="home" style="font-size: 0.8rem; padding: 12px;">
                    TAVERNA
                </button>

                <button class="btn-glass sidebar-nav-item" id="nav-minigames" data-context="minigames" style="font-size: 0.8rem; padding: 12px;">
                    SALA GIOCHI
                </button>

                <button class="btn-glass sidebar-nav-item" id="nav-reading" data-context="reading" style="font-size: 0.8rem; padding: 12px;">
                    LETTURA
                </button>

                <button class="btn-glass sidebar-nav-item" id="nav-shop" data-context="shop" style="font-size: 0.8rem; padding: 12px;">
                    BOTTEGA
                </button>

                <button class="btn-glass sidebar-nav-item" id="nav-dnd5e" data-context="dnd5e" style="font-size: 0.8rem; padding: 12px;">
                    D&D 5E
                </button>

                <button class="btn-glass sidebar-nav-item" id="nav-pathfinder2e" data-context="pathfinder2e" style="font-size: 0.8rem; padding: 12px;">
                    PATHFINDER 2E
                </button>

                <div class="sidebar-divider" style="height: 1px; background: rgba(255,255,255,0.1); margin-bottom: 10px;"></div>

                <button class="btn-glass sidebar-nav-item" id="nav-profile" data-context="profile" style="font-size: 0.8rem; padding: 12px;">
                    PROFILO
                </button>

                <button class="btn-glass sidebar-nav-item" id="nav-settings" data-context="settings" style="font-size: 0.8rem; padding: 12px;">
                    IMPOSTAZIONI
                </button>

                <button class="btn-glass" id="sideMusicCenterBtn" style="font-size: 0.8rem; padding: 12px;">
                    LIBRERIA MUSICALE
                </button>
                
                <button id="btn-fix-games" class="btn-glass" type="button" title="Aggiorna la vista corrente senza perdere i dati" style="font-size: 0.8rem; padding: 12px;">
                    AGGIORNA PAGINA
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
    if (wasOpen) {
        window.__tavernaSidebarToggle?.();
        if (focusedId) document.getElementById(focusedId)?.focus({ preventScroll: true });
    }
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
        item.removeAttribute('aria-current');
        if (item.dataset.context === currentActiveContext) {
            item.setAttribute('aria-current', 'page');
        }
    });
}

function setupEventListeners(container, context) {
    const sidebar = container.querySelector('#sidebar-menu');
    const trigger = document.getElementById('navbar-trigger');
    const mainContent = document.getElementById('app'); 
    const backdrop = container.querySelector('.sidebar-backdrop');
    mainContent.inert = false;
    trigger?.setAttribute('aria-expanded', 'false');
    trigger?.setAttribute('aria-label', 'Apri menu');
    trigger?.classList.remove('is-active');
    
    const toggle = () => {
        const isOpen = sidebar.classList.toggle('active');
        trigger?.classList.toggle('is-active', isOpen);
        sidebar.inert = !isOpen;
        mainContent.inert = isOpen;
        backdrop.hidden = !isOpen;
        trigger?.setAttribute('aria-expanded', String(isOpen));
        trigger?.setAttribute('aria-label', isOpen ? 'Chiudi menu' : 'Apri menu');
        if (!isOpen) {
            sidebar.style.right = '-110%';
        } else {
            sidebar.style.right = '0';
        }
        window.dispatchEvent(new CustomEvent('sidebarState', { detail: { isOpen } }));
        if (isOpen) sidebar.querySelector('button')?.focus({ preventScroll: true });
        else trigger?.focus({ preventScroll: true });
    };
    backdrop.onclick = toggle;
    if (window.__tavernaSidebarKeys) {
        window.removeEventListener('keydown', window.__tavernaSidebarKeys);
    }
    window.__tavernaSidebarKeys = event => {
        if (!sidebar.classList.contains('active')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            toggle();
        }
        if (event.key === 'Tab') {
            const controls = [...sidebar.querySelectorAll('button:not(:disabled)')];
            if (trigger) controls.push(trigger);
            const index = controls.indexOf(document.activeElement);
            event.preventDefault();
            controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
        }
    };
    window.addEventListener('keydown', window.__tavernaSidebarKeys);

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
    attachNav('nav-reading', 'reading');
    attachNav('nav-shop', 'shop');
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

    // Aggiorna solo la vista corrente, senza distruggere lo stato della pagina.
    const btnFix = container.querySelector('#btn-fix-games');
    btnFix.onclick = () => {
        const appScrollTop = mainContent?.scrollTop || 0;
        const isSessionView = document.body.classList.contains('dnd-session-active');
        toggle();

        btnFix.disabled = true;
        btnFix.textContent = 'AGGIORNAMENTO...';

        window.requestAnimationFrame(() => {
            if (!isSessionView) {
                document.documentElement.style.overflow = '';
                document.documentElement.style.overscrollBehavior = '';
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.width = '';
                document.body.style.touchAction = '';
            }

            if (mainContent) {
                mainContent.style.removeProperty('pointer-events');
                mainContent.style.removeProperty('transform');
                mainContent.style.removeProperty('opacity');
                void mainContent.offsetHeight;
                mainContent.scrollTop = appScrollTop;
            }

            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new CustomEvent('tavernaViewRefresh', {
                detail: { context: currentActiveContext }
            }));

            window.setTimeout(() => {
                btnFix.disabled = false;
                btnFix.textContent = 'AGGIORNA PAGINA';
            }, 350);
        });
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
