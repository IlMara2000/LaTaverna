let currentSidebarUser = null;
let currentLogoutFn = null;

export function initSidebar(container, user, onLogout, context = "home") {
    // Se 'user' è null, prova a caricare il Guest dal localStorage
    const guestData = localStorage.getItem('taverna_guest_user');
    currentSidebarUser = user || (guestData ? JSON.parse(guestData) : null);
    
    currentLogoutFn = onLogout;
    renderSidebarContent(container, context);
}

function renderSidebarContent(container, context) {
    const isGuest = currentSidebarUser?.isGuest === true;
    const userName = isGuest ? "OSPITE" : (currentSidebarUser?.user_metadata?.full_name || "Viandante");

    // Configurazione Menu dinamica
    let buttonsHtml = "";

    if (isGuest) {
        // Menu per OSPITE
        if (context === "home") {
            buttonsHtml = `
                <div style="padding: 15px; background: rgba(157, 78, 221, 0.1); border: 1px solid rgba(157, 78, 221, 0.3); border-radius: 12px; font-size: 11px; color: #d8b4fe; text-align: center; line-height: 1.4;">
                    Ti trovi in modalità Offline.<br>Accedi con Discord per salvare i progressi e giocare online.
                </div>
            `;
        } else if (context === "minigames") {
            buttonsHtml = `<p style="font-size: 12px; opacity: 0.5; text-align: center;">Modalità Offline Attiva</p>`;
        }
    } else {
        // Menu per UTENTE REGISTRATO
        const menuConfigs = {
            home: `
                <button class="btn-primary" id="sideProfile">IL MIO PROFILO</button>
                <button class="btn-primary" id="sideSettings">IMPOSTAZIONI</button>
            `,
            dnd5e: `
                <button class="btn-primary" id="sideCharacters">I MIEI EROI (D&D)</button>
                <button class="btn-primary" id="sideSpells">INCANTESIMI</button>
                <button class="btn-primary" id="sideMaps">MAPPE & GRID</button>
            `,
            minigames: `
                <button class="btn-primary" id="sideMultiplayer" style="background: linear-gradient(135deg, #4444ff, #0000aa);">
                    🌐 MODALITÀ MULTIPLAYER
                </button>
                <button class="btn-primary" id="sideStats">STATISTICHE PERSONALI</button>
            `
        };
        buttonsHtml = menuConfigs[context] || menuConfigs.home;
    }

    const isMainHub = context === "home";

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
                    ${isGuest ? 'ACCESSO OSPITE' : 'SISTEMA: ' + context.toUpperCase()}
                </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 15px; width: 85%; max-width: 300px;">
                ${buttonsHtml}
                
                <hr style="width: 100%; opacity: 0.1; margin: 10px 0;">

                ${isMainHub ? `
                    <button class="btn-primary" id="sideLogout" style="background: none; border: 1px solid #ff4444; color: #ff4444; box-shadow: none;">
                        ${isGuest ? 'TORNA AL LOGIN' : 'ESCI DALLA TAVERNA'}
                    </button>
                ` : `
                    <button class="btn-primary" id="sideBackToLobby" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">
                        ⬅ TORNA ALLA LIBRERIA
                    </button>
                `}
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

    // --- LOGICA BOTTONI ---
    const btnLogout = document.getElementById('sideLogout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            if (isGuest) {
                localStorage.removeItem('taverna_guest_user');
                window.location.reload();
            } else {
                currentLogoutFn();
            }
        };
    }

    const btnBack = document.getElementById('sideBackToLobby');
    if (btnBack) {
        btnBack.onclick = async () => {
            toggle();
            const { showLobby } = await import('../../lobby.js');
            showLobby(mainContent);
        };
    }

    const btnProfile = document.getElementById('sideProfile');
    if (btnProfile) {
        btnProfile.onclick = async () => {
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