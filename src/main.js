// 1. STILI E SERVIZI
import './styles/global.css'; 
import { supabase } from './services/supabase.js';
import { generateRoomDescription } from './services/ai.js';

// 2. COMPONENTI
import { initLogin } from './components/features/auth/Login.js';
import { setupDiscordRedirect, initDiscord } from './components/features/auth/Discord.js';
import { initMap } from './components/features/tabletop/Map.js';
import { initNavbar } from './components/layout/Navbar.js';
import { showDashboard } from './dashboard.js'; 

// 3. DEBUG ERROR HANDLER
window.onerror = function(message, source, lineno, colno, error) {
    console.error("🚨 ERRORE TAVERNA:", message, "in", source, "riga:", lineno);
};

const uiContainer = document.getElementById('ui');

// 4. LOGICA PORTALE E INIZIALIZZAZIONE
async function initApp() {
    if (!uiContainer) {
        console.error("⚠️ Container #ui non trovato nel DOM");
        return;
    }

    // --- A. GESTIONE REDIRECT DISCORD ---
    // Questo intercetta il ritorno da Discord PRIMA di mostrare il portale
    await setupDiscordRedirect(uiContainer);

    console.log("🏰 La Taverna sta preparando i boccale...");

    // Controllo sessione Supabase
    const { data: { user } } = await supabase.auth.getUser();

    // --- B. RENDER SCHERMATA INGRESSO ---
    uiContainer.innerHTML = `
        <div class="entry-container" id="entry-screen">
            <div class="main-logo-wrapper" id="enter-portal">
                <img src="/assets/logo.png" alt="La Taverna" id="main-logo" 
                     onerror="this.style.border='2px solid var(--amethyst-bright)'; this.style.borderRadius='50%';">
            </div>
            <p class="tap-instruction">Tocca la Coppa per Entrare</p>
        </div>
        <div id="content-overlay" style="display:none; opacity:0; width:100%;"></div>
    `;

    const entryScreen = document.getElementById('entry-screen');
    const enterBtn = document.getElementById('enter-portal');
    const contentOverlay = document.getElementById('content-overlay');

    if (enterBtn) {
        enterBtn.onclick = () => {
            enterBtn.style.pointerEvents = 'none';

            // Animazione Portale
            entryScreen.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s ease';
            entryScreen.style.opacity = '0';
            entryScreen.style.transform = 'scale(0.95)';

            setTimeout(async () => {
                entryScreen.style.display = 'none';
                contentOverlay.style.display = 'block';
                contentOverlay.style.opacity = '1';

                // Inizializza Navbar
                initNavbar();

                // DECISIONE: Dashboard o Login
                if (user) {
                    console.log("👤 Utente loggato:", user.email);
                    if (typeof showDashboard === 'function') {
                        showDashboard(contentOverlay, user);
                    }
                } else {
                    console.log("🔒 Accesso Anonimo: Caricamento Login...");
                    contentOverlay.innerHTML = '<div id="auth-container"></div>';
                    initLogin(); 
                    // initDiscord viene ora chiamato internamente da initLogin
                }

                // Se esiste una mappa, inizializzala
                if (document.getElementById('map-canvas')) {
                    initMap();
                }

            }, 600);
        };
    }
}

// 5. AVVIO RITO
document.addEventListener('DOMContentLoaded', () => {
    initApp().catch(err => {
        console.error("🔥 Errore fatale nel rito d'apertura:", err);
        if (uiContainer) {
            uiContainer.innerHTML = `
                <div style="color:white; text-align:center; padding:50px;">
                    <h2 style="color:var(--amethyst-bright);">Il portale è sigillato 🛡️</h2>
                    <p style="opacity:0.6; margin-top:10px;">${err.message}</p>
                    <button onclick="window.location.reload()" class="btn-primary" style="margin-top:20px; width:auto; padding:10px 30px;">RIPROVA IL RITO</button>
                </div>
            `;
        }
    });
});