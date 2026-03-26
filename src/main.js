import './styles/global.css'; 
import { supabase } from './services/supabase.js';
import { initLogin } from './components/features/auth/Login.js';
import { initNavbar } from './components/layout/Navbar.js';
import { showDashboard } from './dashboard.js'; 

const uiContainer = document.getElementById('ui');

async function initApp() {
    if (!uiContainer) return;

    // Recupera sessione
    const { data: { user } } = await supabase.auth.getUser();

    // Schermata Iniziale (La Coppa)
    uiContainer.innerHTML = `
        <div class="entry-container" id="entry-screen">
            <img src="/assets/logo.png" alt="La Taverna" id="main-logo" onerror="this.src='https://placehold.co/100x100?text=Taverna'">
            <p class="tap-instruction">Tocca la Coppa per Entrare</p>
        </div>
        <div id="content-area" style="display:none; width:100%; height:100%;"></div>
    `;

    const entryScreen = document.getElementById('entry-screen');
    const contentArea = document.getElementById('content-area');

    entryScreen.onclick = () => {
        entryScreen.style.opacity = '0';
        
        setTimeout(() => {
            entryScreen.style.display = 'none';
            contentArea.style.display = 'block';

            if (user) {
                // UTENTE LOGGATO: Crea struttura con Navbar e Main
                contentArea.innerHTML = `
                    <div id="nav-container"></div>
                    <div id="main-content"></div>
                `;
                const navDiv = document.getElementById('nav-container');
                const mainDiv = document.getElementById('main-content');

                initNavbar(navDiv, user, () => {
                    supabase.auth.signOut().then(() => window.location.reload());
                });
                showDashboard(mainDiv, user);
            } else {
                // ANONIMO: Carica il Login
                initLogin(contentArea);
            }
        }, 400);
    };
}

document.addEventListener('DOMContentLoaded', initApp);