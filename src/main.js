// src/main.js
import { showLogin } from '@ui/login.js';
import { showDashboard } from '@ui/dashboard.js';
import { setupDiscordRedirect } from '@services/redirectDiscord.js';
import { account } from '@services/appwrite.js';

const uiContainer = document.getElementById('ui');
if (!uiContainer) console.error("Impossibile trovare il container #ui in index.html");

async function initApp() {
  let user = null;
  try {
    user = await account.get(); // sessione attiva
  } catch {}

  if (user && user.$id) {
    showDashboard(uiContainer, user);
  } else {
    showLogin(uiContainer);
  }

  setupDiscordRedirect(uiContainer);
}

initApp();
console.log("Frontend avviato correttamente.");
