// src/main.js
import './style.css';
import { showLogin } from './ui/login.js'; // Uso percorsi relativi standard
import { showDashboard } from './ui/dashboard.js';
import { setupDiscordRedirect } from './services/redirectDiscord.js';
import { account } from './services/appwrite.js';

// Selezioniamo gli elementi già presenti nel tuo index.html
const mainTitle = document.getElementById('main-title');
const uiContainer = document.getElementById('ui');

async function initApp() {
    /**
     * 1. GESTIONE DISCORD (Priorità Alta)
     * Se l'URL contiene parametri di Discord, dobbiamo gestirli subito.
     */
    await setupDiscordRedirect(uiContainer);

    /**
     * 2. CONTROLLO SESSIONE SILENZIOSO
     * Verifichiamo se l'utente è già loggato appena si apre la pagina.
     */
    let user = null;
    try {
        user = await account.get();
        console.log("Viandante riconosciuto:", user.name);
    } catch (err) {
        console.log("Nessun utente rilevato all'avvio.");
    }

    /**
     * 3. LOGICA DEL TASTO "LA TAVERNA"
     * Gestisce l'ingresso nell'app con effetto transizione.
     */
    if (mainTitle) {
        mainTitle.onclick = async () => {
            // Blocca tocchi multipli durante l'animazione
            mainTitle.style.pointerEvents = 'none';
            
            // Effetto dissolvenza tasto (usando la classe del tuo CSS)
            mainTitle.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            mainTitle.style.opacity = '0';
            mainTitle.style.transform = 'scale(1.1)';

            setTimeout(() => {
                mainTitle.style.display = 'none';
                
                // Entrata fluida dell'interfaccia UI
                uiContainer.style.opacity = '0';
                uiContainer.style.display = 'block';
                
                if (user && user.$id) {
                    // Se loggato (anche via Discord), vai in Dashboard
                    showDashboard(uiContainer, user);
                } else {
                    // Altrimenti mostra il modulo di accesso
                    showLogin(uiContainer);
                }

                // Animazione di comparsa del box UI
                setTimeout(() => {
                    uiContainer.style.transition = 'opacity 0.5s ease';
                    uiContainer.style.opacity = '1';
                }, 50);
                
            }, 500);
        };
    }
}

// Avvio con gestione errori globale
initApp().catch(err => {
    console.error("Errore fatale nella Taverna:", err);
});
