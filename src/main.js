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
  <div id="app-content" style="visibility: hidden; opacity: 0; transition: opacity 0.5s ease;">
    <div id="ui"></div>
  </div>
`;

const hero = document.getElementById('hero-screen');
const appContent = document.getElementById('app-content');
const ui = document.getElementById('ui');

async function initApp() {
    let user = null;
    try {
        user = await account.get(); 
    } catch (err) {}

    document.querySelector('.hero-btn').onclick = () => {
        // Nascondi Hero
        hero.style.opacity = '0';
        hero.style.pointerEvents = 'none';

        setTimeout(() => {
            hero.style.display = 'none';
            
            // Mostra Content con centratura
            appContent.style.visibility = 'visible';
            appContent.style.opacity = '1';
            
            if (user && user.$id) {
                showDashboard(ui, user);
            } else {
                showLogin(ui);
            }
            
            setupDiscordRedirect(ui);
        }, 500);
    };
}

initApp().catch(console.error);
