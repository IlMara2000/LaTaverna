import './styles/global.css'; 
import { supabase } from './services/supabase.js';
import { initLogin } from './components/features/auth/Login.js';
import { initNavbar } from './components/layout/Navbar.js';
import { showLobby } from './lobby.js';
import { shouldShowPortalButton, updateLastAccess } from './components/ui/AuthInput.js';

const uiContainer = document.getElementById('ui');
const SERVER_INVITE = "https://discord.gg/9BqNgdqC";

async function initApp() {
    if (!uiContainer) return;

    // 1. Recupera sessione Discord e sessione Guest
    const { data: { user } } = await supabase.auth.getUser();
    const guestUser = JSON.parse(localStorage.getItem('taverna_guest_user'));
    
    const loader = document.getElementById('app-loader');
    const hideLoader = () => { if(loader) loader.classList.add('fade-out'); };

    // LOGICA DI REDIRECT
    const isVerifiedDiscord = user && localStorage.getItem('taverna_member_verified') === 'true';
    
    if ((isVerifiedDiscord && !shouldShowPortalButton()) || guestUser) {
        renderDashboard(user || guestUser);
        hideLoader();
        return;
    }

    // Altrimenti mostra il Portale d'ingresso
    renderPortal(user);
    hideLoader();
}

function renderPortal(user) {
    // Puliamo il contenuto per il portale (Navbar e Sidebar restano invisibili perché vuote)
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = `
        <div class="entry-container fade-in" id="entry-screen" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; cursor: pointer;">
            <img src="/assets/logo.png" alt="La Taverna" id="main-logo" style="width: 140px; filter: drop-shadow(0 0 20px var(--amethyst-glow)); transition: 0.5s;">
            <p class="subtitle" style="margin-top: 30px; opacity: 0.6;">Tocca per entrare nel Portale</p>
        </div>
    `;

    const entryScreen = document.getElementById('entry-screen');

    entryScreen.onclick = () => {
        entryScreen.style.opacity = '0';
        setTimeout(async () => {
            // Se c'è un utente loggato ma non verificato, checkAccess. 
            if (user) {
                checkAccess(user, appContainer);
            } else {
                // Altrimenti avvia il Login nel contenitore principale
                initLogin(appContainer);
            }
        }, 400);
    };
}

function checkAccess(user, container) {
    const isVerified = localStorage.getItem('taverna_member_verified') === 'true';
    if (isVerified) {
        updateLastAccess();
        renderDashboard(user);
    } else {
        container.innerHTML = `
            <div class="fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 30px;">
                <h2 class="main-title" style="font-size: 2rem;">QUASI CI SEI! ⚔️</h2>
                <p class="subtitle" style="margin: 20px 0; letter-spacing: 1px;">Unisciti al Server Discord per sbloccare il portale.</p>
                <a href="${SERVER_INVITE}" target="_blank" class="btn-back-glass" style="background: #5865F2; border: none; padding: 20px 40px; text-decoration: none;">UNISCITI AL SERVER</a>
                <button id="verify-btn" style="margin-top: 30px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 12px 25px; border-radius: 12px; cursor:pointer; font-size: 10px; letter-spacing: 2px;">SONO GIÀ DENTRO</button>
            </div>
        `;
        document.getElementById('verify-btn').onclick = () => {
            localStorage.setItem('taverna_member_verified', 'true');
            window.location.reload();
        };
    }
}

function renderDashboard(user) {
    const appContainer = document.getElementById('app');
    
    // 1. Inizializza la Navbar (che creerà internamente anche la Sidebar)
    // Passiamo la funzione di Logout come secondo parametro
    initNavbar(user, async () => {
        const isGuest = user?.isGuest || localStorage.getItem('taverna_guest_user');
        if (isGuest) {
            localStorage.removeItem('taverna_guest_user');
        } else {
            await supabase.auth.signOut();
            localStorage.removeItem('taverna_member_verified');
        }
        window.location.reload();
    });

    // 2. Mostra la Lobby principale nel contenitore app
    showLobby(appContainer);
}

// Avvio App
document.addEventListener('DOMContentLoaded', initApp);
