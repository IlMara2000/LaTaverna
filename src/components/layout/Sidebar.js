import { showProfile } from '../../features/user/Profile.js';
import { showSettings } from '../../features/user/Settings.js';

let currentSidebarUser = null;
let currentLogoutFn = null;

export function initSidebar(container, user, onLogout, context = "home") {
    currentSidebarUser = user;
    currentLogoutFn = onLogout;
    renderSidebarContent(container, context);
}

function renderSidebarContent(container, context) {
    const userName = currentSidebarUser?.user_metadata?.full_name || "Viandante";

    const menuConfigs = {
        home: `
            <button class="btn-primary" id="sideProfile">IL MIO PROFILO</button>
            <button class="btn-primary" id="sideSettings">IMPOSTAZIONI</button>
        `,
        dnd5e: `
            <button class="btn-primary" id="sideCharacters">I MIEI EROI (D&D)</button>
            <button class="btn-primary" id="sideSpells">INCANTESIMI</button>
            <button class="btn-primary" id="sideMaps">MAPPE & GRID</button>
            <button class="btn-primary" id="sideBestiary">BESTIARIO</button>
        `
    };

    container.innerHTML = `
        <nav id="sidebar-menu" style="
            position: fixed; right: -100%; top: 0; 
            width: 100%; height: 100%; 
            background: rgba(5, 2, 10, 0.98); backdrop-filter: blur(20px); 
            z-index: 9000; transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1); 
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        ">
            <div style="text-align: center; margin-bottom: 40px;">
                <h2 style="color: var(--amethyst-bright); margin:0; letter-spacing:1px;">${userName.toUpperCase()}</h2>
                <span style="font-size: 10px; opacity: 0.5; letter-spacing: 2px;">
                    ${context === 'home' ? 'HUB PRINCIPALE' : 'SISTEMA: ' + context.toUpperCase()}
                </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 15px; width: 85%; max-width: 300px;">
                ${menuConfigs[context] || menuConfigs.home}
                <hr style="width: 100%; opacity: 0.1; margin: 10px 0;">
                <button class="btn-primary" id="sideLogout" style="background: none; border: 1px solid #ff4444; color: #ff4444; box-shadow: none;">ESCI DALLA TAVERNA</button>
            </div>
        </nav>
    `;

    const sidebar = document.getElementById('sidebar-menu');
    const mainContent = document.getElementById('main-content');
    
    const toggle = () => {
        const isOpen = sidebar.style.right === '0px';
        sidebar.style.right = isOpen ? '-100%' : '0px';
        window.dispatchEvent(new CustomEvent('sidebarState', { detail: { isOpen: !isOpen } }));
    };

    window.removeEventListener('toggleSidebar', window._currentToggleFn);
    window._currentToggleFn = toggle;
    window.addEventListener('toggleSidebar', toggle);

    // --- LOGICA CLICK BOTTONI ---
    
    document.getElementById('sideLogout').onclick = currentLogoutFn;

    // Profilo
    const btnProfile = document.getElementById('sideProfile');
    if (btnProfile) {
        btnProfile.onclick = () => {
            toggle();
            showProfile(mainContent, currentSidebarUser);
        };
    }

    // Impostazioni
    const btnSettings = document.getElementById('sideSettings');
    if (btnSettings) {
        btnSettings.onclick = () => {
            toggle();
            showSettings(mainContent);
        };
    }
}

export function updateSidebarContext(newContext) {
    const container = document.getElementById('sidebar-container');
    if (container) {
        renderSidebarContent(container, newContext);
    }
}
