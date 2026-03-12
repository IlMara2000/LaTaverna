// src/ui/dashboard.js
import { account } from '@services/appwrite.js';
import { CONFIG } from '@config/env.js';
import { setupDiscordRedirect } from '@services/redirectDiscord.js';

export async function showDashboard(container) {
  container.innerHTML = `<p>Caricamento dashboard...</p>`;

  try {
    const user = await account.get();

    container.innerHTML = `
      <div>
        <h2>Benvenuto, ${user.name || user.email}</h2>
        <p>Email: ${user.email}</p>
        <p>ID utente: ${user.$id}</p>
        <p>Discord ID: ${user.discord_id || "Non collegato"}</p>
        <button id="btnConnectDiscord">Collega Discord</button>
        <button id="btnLogout">Esci</button>
        <p id="message" class="message"></p>
      </div>
    `;

    const messageEl = container.querySelector('#message');

    container.querySelector('#btnLogout').onclick = async () => {
      try {
        await account.deleteSession('current');
        window.location.reload();
      } catch (err) {
        messageEl.textContent = `Errore logout: ${err.message}`;
      }
    };

    container.querySelector('#btnConnectDiscord').onclick = () => {
      const clientId = CONFIG.DISCORD_CLIENT_ID;
      const redirectUri = encodeURIComponent(CONFIG.DISCORD_REDIRECT_URI);
      const scope = encodeURIComponent('identify email');
      window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    };

    setupDiscordRedirect(container);

  } catch (err) {
    container.innerHTML = `<p>Sessione scaduta. Torno al login...</p>`;
    setTimeout(() => import('./login.js').then(m => m.showLogin(container)), 1000);
  }
}
