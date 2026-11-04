import { navigateTo } from './services/appNavigation.js';
import { destinationFromPath } from './services/publicRoutes.js';
import './components/ui/AudioManager.js';
import './styles/global.css'; 
import './styles/amethyst-glass.css';
import './styles/navigation.css';
import './styles/motion-polish.css';
import './styles/auth.css';
import './styles/experience-worlds.css';
import './styles/tavern-entrance.css';
import './styles/magic-amethyst-surface.css';
import './styles/standalone.css';
import './styles/entry-pages.css';
import './styles/platform-layout.css';
import { supabase } from './services/supabase.js';
import { renderTavernEntrance } from './components/features/auth/TavernEntrance.js';
import { initLogin } from './components/features/auth/Login.js';
import { initNavbar } from './components/layout/Navbar.js';
import { showLobby } from './lobby.js';
import { updateLastAccess } from './components/ui/AuthInput.js';
import { loadAndApplyProfileAppearance } from './services/profileAppearance.js';
import { applyCachedAppPreferences, loadAndApplyAppPreferences } from './services/appPreferences.js';
import { getSessionInviteFromUrl, joinSessionInvite } from './services/sessionInvites.js';
import { initMotionPreferences, playLoaderExit } from './services/motionSystem.js';
import './services/standalone.js';
import './services/tableOrientation.js';

// Importiamo la funzione per gestire il ritorno da Discord! (Fondamentale)
import { setupDiscordRedirect } from './components/features/auth/Discord.js';

applyCachedAppPreferences();
const cleanupMotionPreferences = initMotionPreferences();
if (import.meta.hot) import.meta.hot.dispose(cleanupMotionPreferences);

const uiContainer = document.getElementById('ui');
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

        const publicDestination = destinationFromPath(location.pathname);
        if (publicDestination) {
            initializeNavigation(user || guestUser || { isGuest: true });
            await navigateTo(publicDestination, appContainer, { fromHistory: true });
            return;
        }
        
        // 3. LOGICA DI REDIRECT
        if (user || guestUser) {
            renderDashboard(user || guestUser);
        } else {
            // Altrimenti mostra il Portale d'ingresso
            renderPortal(null);
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
    
    renderTavernEntrance(appContainer, () => {
        if (user) renderDashboard(user);
        else initLogin(appContainer);
    });
}

function initializeNavigation(user) {
    // 1. Inizializza la Navbar (Gestirà anche la Sidebar)
    initNavbar(user, async () => {
        const isGuest = user?.isGuest || isAnonymousUser(user) || localStorage.getItem('taverna_guest_user');
        if (isGuest) {
            localStorage.removeItem('taverna_guest_user');
            await supabase.auth.signOut();
        } else {
            await supabase.auth.signOut();
        }
        window.location.reload();
    });

}

function renderDashboard(user) {
    updateLastAccess();
    const appContainer = document.getElementById('app');
    loadAndApplyProfileAppearance(user).catch(err => console.warn('Tema profilo non applicato:', err));
    loadAndApplyAppPreferences().catch(err => console.warn('Preferenze app non sincronizzate:', err));

    initializeNavigation(user);

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

        if (context === 'shop') {
            const { initBottega } = await import('./dashboards/bottega.js');
            initBottega(container);
        }
    } catch (err) {
        console.warn('Recovery soft non completata:', err);
    }
}

// Lancia l'app in modo sicuro appena il DOM è pronto
document.addEventListener('DOMContentLoaded', initApp);

// Public shop URLs support refresh and browser Back/Forward without touching auth callbacks.
const onPublicHistory = event => {
    const destination = destinationFromPath(location.pathname) || event.state?.tavernaDestination;
    if (destination) void navigateTo(destination, document.getElementById('app'), { fromHistory: true });
    else location.reload();
};
window.addEventListener('popstate', onPublicHistory);
if (import.meta.hot) import.meta.hot.dispose(() => window.removeEventListener('popstate', onPublicHistory));
