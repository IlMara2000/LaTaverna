// src/main.js
import './style.css';
import { showLogin } from '@ui/login.js';
import { showDashboard } from '@ui/dashboard.js';
import { setupDiscordRedirect } from '@services/redirectDiscord.js';
import { account } from '@services/appwrite.js';

// Inizializziamo il DOM
document.body.innerHTML = `
  <div id="hero-screen">
    <button class="hero-btn">LA TAVERNA</button>
  </div>
  <div id="app-content" style="visibility: hidden; opacity: 0; transition: opacity 0.5s ease; display: flex; align-items: center; justify-content: center;">
    <div id="ui" style="width: 100%; display: flex; justify-content: center;"></div>
  </div>
`;

const hero = document.getElementById('hero-screen');
const appContent = document.getElementById('app-content');
const ui = document.getElementById('ui');

async function initApp() {
    // Gestione della transizione dopo il click
    document.querySelector('.hero-btn').onclick = async () => {
        
        // Controlliamo la sessione REALE nel momento del click
        // Questo risolve i problemi di redirect da Discord
        let user = null;
        try {
            user = await account.get();
            console.log("Sessione verificata per:", user.name);
        } catch (err) {
            console.log("Nessun utente rilevato al click.");
        }

        // Animazione uscita Hero
        hero.style.opacity = '0';
        hero.style.pointerEvents = 'none';

        setTimeout(() => {
            hero.style.display = 'none';
            
            // Mostra Content
            appContent.style.visibility = 'visible';
            appContent.style.opacity = '1';
            
            if (user && user.$id) {
                // Se Discord ha funzionato, user non è null e andiamo dritti in Dashboard
                showDashboard(ui, user);
            } else {
                // Altrimenti mostriamo il Login
                showLogin(ui);
            }
            
            // Gestione specifica per pulire eventuali parametri Discord nell'URL
            setupDiscordRedirect(ui);
        }, 500);
    };
}

// Avvio
initApp().catch(err => {
    console.error("Errore critico all'avvio:", err);
});
