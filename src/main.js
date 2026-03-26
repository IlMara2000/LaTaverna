// Import degli stili globali
import './globals.css';

// Import dei servizi e delle componenti UI
import { supabase } from './services/supabase.js';
import { showLogin } from './components/ui/Login.js';
import { showDashboard } from './components/ui/Dashboard.js';

// Handler errori globale per il debug in taverna
window.onerror = function(message, source, lineno, colno, error) {
    console.error("ERRORE RILEVATO:", message, "in", source, "riga:", lineno);
};

const uiContainer = document.getElementById('ui');

async function initApp() {
    if (!uiContainer) {
        console.error("Container #ui non trovato nel DOM");
        return;
    }

    // 1. CONTROLLO SESSIONE (Supabase)
    const { data: { user }, error } = await supabase.auth.getUser();

    // 2. RENDER SCHERMATA PORTALE (L'ingresso alla Taverna)
    uiContainer.innerHTML = `
        <div class="entry-container" id="entry-screen">
            <div class="main-logo-wrapper" id="enter-portal">
                <img src="/assets/logo.png" alt="La Taverna" id="main-logo" onerror="this.style.border='2px solid var(--amethyst-bright)'; this.style.borderRadius='50%';">
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

            // Animazione fluida di uscita del portale
            entryScreen.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s ease';
            entryScreen.style.opacity = '0';
            entryScreen.style.transform = 'scale(0.95)';

            setTimeout(() => {
                entryScreen.style.display = 'none';
                contentOverlay.style.display = 'block';

                // 3. DECISIONE: DASHBOARD O LOGIN
                if (user) {
                    showDashboard(contentOverlay, user);
                } else {
                    showLogin(contentOverlay);
                }

                // Animazione di entrata del contenuto
                setTimeout(() => {
                    contentOverlay.style.transition = 'opacity 0.5s ease';
                    contentOverlay.style.opacity = '1';
                }, 50);
            }, 600);
        };
    }
}

// Avvio dell'applicazione
initApp().catch(err => {
    console.error("Errore fatale all'apertura del portale:", err);
    if(uiContainer) {
        uiContainer.innerHTML = `
            <div style="color:white; text-align:center; padding:50px;">
                <h2 style="color:var(--amethyst-bright);">Il portale è sigillato 🛡️</h2>
                <p style="opacity:0.6; margin-top:10px;">Errore magico nel caricamento della Taverna.</p>
                <button onclick="window.location.reload()" class="btn-primary" style="margin-top:20px; width:auto; padding:10px 30px;">RIPROVA IL RITO</button>
            </div>
        `;
    }
});