import './styles/global.css'; 
import { supabase } from './services/supabase.js';
import { initLogin } from './components/features/auth/Login.js';
import { initNavbar } from './components/layout/Navbar.js';
import { initSidebar } from './components/layout/Sidebar.js';
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

    // LOGICA DI REDIRECT AGGIORNATA
    // Entra se: Utente Discord Verificato OPPURE se è un Ospite
    const isVerifiedDiscord = user && localStorage.getItem('taverna_member_verified') === 'true';
    
    if ((isVerifiedDiscord && !shouldShowPortalButton()) || guestUser) {
        renderDashboard(user || guestUser);
        hideLoader();
        return;
    }

    // Altrimenti mostra la Coppa (Portal)
    renderPortal(user);
    hideLoader();
}

function renderPortal(user) {
    uiContainer.innerHTML = `
        <div class="entry-container" id="entry-screen" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; cursor: pointer;">
            <img src="/assets/logo.png" alt="La Taverna" id="main-logo" style="width: 120px; filter: drop-shadow(0 0 15px #9d4ede);">
            <p class="tap-instruction" style="margin-top: 20px; opacity: 0.5; letter-spacing: 2px; font-size: 12px; text-transform: uppercase;">Tocca la Coppa per Entrare</p>
        </div>
        <div id="content-area" style="display:none; width:100%; height:100%;"></div>
    `;

    const entryScreen = document.getElementById('entry-screen');
    const contentArea = document.getElementById('content-area');

    entryScreen.onclick = () => {
        entryScreen.style.opacity = '0';
        setTimeout(async () => {
            entryScreen.style.display = 'none';
            contentArea.style.display = 'block';
            
            // Se c'è un utente Discord loggato ma non verificato, checkAccess. 
            // Altrimenti (ospite o nullo) manda al Login.
            if (user) {
                checkAccess(user, contentArea);
            } else {
                initLogin(contentArea);
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
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px;">
                <h2 style="color: #5865F2; font-weight: 900;">QUASI CI SEI! ⚔️</h2>
                <p style="opacity: 0.7; font-size: 14px; margin: 20px 0;">Unisciti al Server Discord per sbloccare il portale.</p>
                <a href="${SERVER_INVITE}" target="_blank" style="background: #5865F2; color: white; padding: 18px 40px; border-radius: 14px; text-decoration: none; font-weight: 800;">UNISCITI AL SERVER</a>
                <button id="verify-btn" style="margin-top: 30px; background: transparent; border: 1px solid gray; color: white; padding: 10px; border-radius: 8px; cursor:pointer;">SONO GIÀ DENTRO</button>
            </div>
        `;
        document.getElementById('verify-btn').onclick = () => {
            localStorage.setItem('taverna_member_verified', 'true');
            window.location.reload();
        };
    }
}

function renderDashboard(user) {
    uiContainer.innerHTML = `
        <div id="nav-container"></div>
        <div id="sidebar-container"></div>
        <main id="main-content" style="width:100%; height:100%;"></main>
    `;

    initNavbar(document.getElementById('nav-container'), user);
    initSidebar(document.getElementById('sidebar-container'), user, async () => {
        const isGuest = user?.isGuest || localStorage.getItem('taverna_guest_user');
        if (isGuest) {
            localStorage.removeItem('taverna_guest_user');
        } else {
            await supabase.auth.signOut();
            localStorage.removeItem('taverna_member_verified');
        }
        window.location.reload();
    }, "home");

    showLobby(document.getElementById('main-content'));
}

document.addEventListener('DOMContentLoaded', initApp);
