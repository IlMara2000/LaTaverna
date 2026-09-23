import './styles/global.css'; 
import './styles/amethyst-glass.css';
import './styles/navigation.css';
import { supabase } from './services/supabase.js';
import { initLogin } from './components/features/auth/Login.js';
import { initNavbar } from './components/layout/Navbar.js';
import { showLobby } from './lobby.js';
import { shouldShowPortalButton, updateLastAccess } from './components/ui/AuthInput.js';
import { loadAndApplyProfileAppearance } from './services/profileAppearance.js';
import { applyCachedAppPreferences, loadAndApplyAppPreferences } from './services/appPreferences.js';
import { getSessionInviteFromUrl, joinSessionInvite } from './services/sessionInvites.js';
import { enhancePortalMotion, initMotionPreferences, playLoaderExit, playPortalOpen } from './services/motionSystem.js';

// Importiamo la funzione per gestire il ritorno da Discord! (Fondamentale)
import { setupDiscordRedirect } from './components/features/auth/Discord.js';

applyCachedAppPreferences();
const cleanupMotionPreferences = initMotionPreferences();
if (import.meta.hot) import.meta.hot.dispose(cleanupMotionPreferences);

const uiContainer = document.getElementById('ui');
const SERVER_INVITE = "https://discord.gg/9BqNgdqC";
const isAnonymousUser = (user) => Boolean(user?.is_anonymous || user?.app_metadata?.provider === 'anonymous');

async function initApp() {
    if (!uiContainer) return;

    const loader = document.getElementById('app-loader');
    const appContainer = document.getElementById('app');
    appContainer?.classList.add('app-preparing');
    
    // Funzione blindata per distruggere il loader fisicamente
    const destroyLoader = () => playLoaderExit(loader, appContainer);

    try {
        // 1. Gestisci PRIMA DI TUTTO l'eventuale ritorno da Discord
        // Se c'è un redirect in corso, mostrerà l'overlay "Sincro Discord" creato prima
        if (typeof setupDiscordRedirect === 'function') {
            await setupDiscordRedirect(uiContainer);
        }

        // 2. Recupera sessione Discord e sessione Guest
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) console.warn("Avviso Supabase:", error.message); // Non blocca l'app se fallisce

        const sessionInvite = getSessionInviteFromUrl();
        if (sessionInvite) {
            await renderSharedSessionInvite(sessionInvite);
            return;
        }

        const guestUser = JSON.parse(localStorage.getItem('taverna_guest_user'));
        
        // 3. LOGICA DI REDIRECT
        const isVerifiedDiscord = user && localStorage.getItem('taverna_member_verified') === 'true';
        
        if ((isVerifiedDiscord && !shouldShowPortalButton()) || isAnonymousUser(user) || guestUser) {
            renderDashboard(user || guestUser);
        } else {
            // Altrimenti mostra il Portale d'ingresso
            renderPortal(user);
        }

    } catch (err) {
        console.error("Errore critico di avvio:", err);
        // Fallback di sicurezza: se esplode tutto, mostra almeno il portale
        renderPortal(null);
    } finally {
        // GRAZIE AL FINALLY, IL LOADER VERRÀ RIMOSSO SEMPRE E COMUNQUE.
        void destroyLoader();
    }
}

function renderPortal(user) {
    const appContainer = document.getElementById('app');
    
    appContainer.innerHTML = `
        <div class="entry-container" id="entry-screen" role="button" tabindex="0" aria-label="Entra nella Taverna">
            <span class="entry-eyebrow">UN POSTO PER LE TUE AVVENTURE</span>
            <div class="entry-crystal" aria-hidden="true"><i></i><i></i><i></i></div>
            <img src="/assets/logo.png" alt="La Taverna" id="main-logo" style="width: 140px; filter: drop-shadow(0 0 20px var(--amethyst-glow)); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <h1>La Taverna</h1>
            <p class="entry-description">Ogni grande storia comincia insieme.</p>
            <span class="subtitle entry-cta">Entra nella Taverna <span aria-hidden="true">↗</span></span>
        </div>
    `;

    const entryScreen = document.getElementById('entry-screen');
    const cleanupPortalMotion = enhancePortalMotion(appContainer);

    let opening = false;
    entryScreen.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            entryScreen.click();
        }
    };
    entryScreen.onclick = async () => {
        if (opening) return;
        opening = true;
        // Effetto "Click" sul logo
        await playPortalOpen(entryScreen);
        cleanupPortalMotion?.();
        
        if (user) {
            checkAccess(user, appContainer);
        } else {
            initLogin(appContainer);
        }
    };
}

function checkAccess(user, container) {
    const isVerified = localStorage.getItem('taverna_member_verified') === 'true';
    if (isVerified || isAnonymousUser(user)) {
        updateLastAccess();
        renderDashboard(user);
    } else {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100dvh; text-align: center; padding: 30px; animation: fadeInUp 0.5s ease-out;">
                <h2 class="main-title" style="font-size: 2.2rem; margin-bottom: 5px;">QUASI CI SEI! ⚔️</h2>
                <p style="opacity: 0.6; font-size: 13px; margin-bottom: 40px; letter-spacing: 1px; line-height: 1.6;">
                    Unisciti al Server Discord per sbloccare l'accesso completo alla Taverna.
                </p>
                
                <a href="${SERVER_INVITE}" target="_blank" class="game-card" style="background: #5865F2; border: none; padding: 20px 40px; text-decoration: none; width: 100%; max-width: 300px; margin-bottom: 20px; box-shadow: 0 10px 25px rgba(88, 101, 242, 0.3);">
                    <span style="color: white; font-weight: 900; font-size: 1.1rem; font-family: 'Montserrat', sans-serif;">UNISCITI ORA</span>
                </a>
                
                <button id="verify-btn" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 15px 30px; border-radius: 16px; cursor:pointer; font-size: 11px; font-weight: 800; letter-spacing: 2px; transition: 0.3s;">
                    SONO GIÀ DENTRO
                </button>
            </div>
        `;
        
        document.getElementById('verify-btn').onclick = (e) => {
            e.target.style.background = 'var(--amethyst-bright)';
            e.target.style.borderColor = 'var(--amethyst-bright)';
            setTimeout(() => {
                localStorage.setItem('taverna_member_verified', 'true');
                window.location.reload();
            }, 300);
        };
    }
}

function renderDashboard(user) {
    const appContainer = document.getElementById('app');
    loadAndApplyProfileAppearance(user).catch(err => console.warn('Tema profilo non applicato:', err));
    loadAndApplyAppPreferences().catch(err => console.warn('Preferenze app non sincronizzate:', err));
    
    // 1. Inizializza la Navbar (Gestirà anche la Sidebar)
    initNavbar(user, async () => {
        const isGuest = user?.isGuest || isAnonymousUser(user) || localStorage.getItem('taverna_guest_user');
        if (isGuest) {
            localStorage.removeItem('taverna_guest_user');
            await supabase.auth.signOut();
        } else {
            await supabase.auth.signOut();
            localStorage.removeItem('taverna_member_verified');
        }
        window.location.reload();
    });

    // 2. Mostra la Lobby principale
    showLobby(appContainer);

    const recoveryContext = sessionStorage.getItem('taverna_soft_recovery_context');
    if (recoveryContext) {
        sessionStorage.removeItem('taverna_soft_recovery_context');
        restoreRecoveredContext(appContainer, recoveryContext, user);
    }
}

async function renderSharedSessionInvite(invite) {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    appContainer.innerHTML = `
        <div class="dnd-empty glass-box dnd-session-invite-loading">
            <strong>Connessione alla sessione...</strong>
            <span>Sto validando il link e agganciando il tavolo realtime.</span>
        </div>
    `;

    try {
        const { system_id: joinedSystemId } = await joinSessionInvite({
            sessionId: invite.sessionId,
            code: invite.code,
            displayName: localStorage.getItem('taverna_display_name') || 'Giocatore'
        });
        const { showSession } = await import('./components/features/tabletop/Session.js');
        await showSession(appContainer, invite.sessionId, {
            systemId: joinedSystemId || invite.systemId,
            sharedInvite: true,
            readOnly: true
        });
    } catch (err) {
        appContainer.innerHTML = `
            <div class="dnd-empty glass-box dnd-schema-error dnd-session-invite-loading">
                <strong>Link sessione non valido.</strong>
                <span>${String(err?.message || 'Invito scaduto, disattivato o non disponibile.')}</span>
                <button id="returnFromInvite" class="btn-primary" type="button">TORNA ALLA TAVERNA</button>
            </div>
        `;
        appContainer.querySelector('#returnFromInvite')?.addEventListener('click', () => {
            window.location.href = window.location.origin;
        });
    }
}

async function restoreRecoveredContext(container, context, user) {
    try {
        if (context === 'reading') {
            const { showReading } = await import('./components/features/reading/Reading.js');
            await showReading(container);
            return;
        }

        if (context === 'settings') {
            const { showSettings } = await import('./components/features/user/Settings.js');
            showSettings(container, user);
            return;
        }

        if (context === 'minigames') {
            const { showMinigamesList } = await import('./minigamelist.js');
            showMinigamesList(container);
            return;
        }

        if (context === 'dnd5e') {
            const { initDndDashboard } = await import('./dashboards/dnd5e.js');
            initDndDashboard(container);
            return;
        }

        if (context === 'pathfinder2e') {
            const { initPathfinderDashboard } = await import('./dashboards/pathfinder2e.js');
            initPathfinderDashboard(container);
            return;
        }

        if (context === 'shop') {
            const { initShop } = await import('./dashboards/shop.js');
            initShop(container);
        }
    } catch (err) {
        console.warn('Recovery soft non completata:', err);
    }
}

// Lancia l'app in modo sicuro appena il DOM è pronto
document.addEventListener('DOMContentLoaded', initApp);
