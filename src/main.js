// src/main.js
import './style.css'; // Carichiamo il nuovo stile
import { showLogin } from '@ui/login.js';
import { showDashboard } from '@ui/dashboard.js';
import { setupDiscordRedirect } from '@services/redirectDiscord.js';
import { account } from '@services/appwrite.js';

const uiContainer = document.getElementById('ui');

// Iniettiamo la struttura iniziale blindata
document.body.innerHTML = `
  <div id="hero-screen">
    <button class="hero-btn">LA TAVERNA</button>
  </div>
  <div id="app-content" style="display:none; min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;">
    <div id="ui"></div>
  </div>
`;

const hero = document.getElementById('hero-screen');
const appContent = document.getElementById('app-content');
const ui = document.getElementById('ui');

async function initApp() {
    console.log("Controllo sessione...");
    
    let user = null;
    try {
        user = await account.get(); 
    } catch (err) {
        console.log("Sessione non trovata.");
    }

    // Gestione della transizione dopo il click
    document.querySelector('.hero-btn').onclick = () => {
        hero.style.opacity = '0';
        hero.style.pointerEvents = 'none';

        setTimeout(() => {
            hero.style.display = 'none';
            appContent.style.display = 'flex'; // Mostra il contenitore principale
            
            if (user && user.$id) {
                showDashboard(ui, user);
            } else {
                showLogin(ui);
            }
            
            // Gestione redirect OAuth2
            setupDiscordRedirect(ui);
        }, 500);
    };
}

// Avvio
initApp().catch(err => {
    console.error("Errore critico:", err);
});
