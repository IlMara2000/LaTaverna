import './styles/global.css'; 
import { supabase } from './services/supabase.js';
import { initLogin } from './components/features/auth/Login.js';
import { initNavbar } from './components/layout/Navbar.js';
import { showDashboard } from './dashboard.js'; 
import { shouldShowPortalButton, updateLastAccess } from './components/ui/AuthInput.js';

const uiContainer = document.getElementById('ui');
const SERVER_INVITE = "https://discord.gg/9BqNgdqC";

async function initApp() {
    if (!uiContainer) return;

    // 1. Recupera la sessione
    const { data: { user } } = await supabase.auth.getUser();
    const loader = document.getElementById('app-loader');

    // Funzione per mostrare il contenuto e nascondere il loader
    const hideLoader = () => {
        if(loader) loader.classList.add('fade-out');
    };

    // LOGICA DI REDIRECT AUTOMATICO (ENTRATA VELOCE)
    // Se loggato E verificato E non sono passati 10 minuti: Dashboard diretta
    if (user && localStorage.getItem('taverna_member_verified') === 'true' && !shouldShowPortalButton()) {
        renderDashboard(user);
        hideLoader();
        return;
    }

    // Altrimenti: Mostra la Schermata della Coppa
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
        entryScreen.style.transition = 'opacity 0.4s ease';
        entryScreen.style.opacity = '0';
        
        setTimeout(async () => {
            entryScreen.style.display = 'none';
            contentArea.style.display = 'block';

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
        updateLastAccess(); // Aggiorna il timer dei 10 minuti
        renderDashboard(user);
    } else {
        // Schermata Obbligo Discord
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
            updateLastAccess();
            renderDashboard(user);
        };
    }
}

function renderDashboard(user) {
    uiContainer.innerHTML = `
        <div id="nav-container"></div>
        <main id="main-content" style="width:100%; height:100%;"></main>
    `;
    initNavbar(document.getElementById('nav-container'), user, async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('taverna_member_verified');
        window.location.reload();
    });
    showDashboard(document.getElementById('main-content'), user);
}

document.addEventListener('DOMContentLoaded', initApp);