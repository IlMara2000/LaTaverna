import { account } from '@services/appwrite.js'
import { setupDiscordRedirect } from '@services/redirectDiscord.js'
import { showTabletop } from './tabletop.js' // Importiamo la funzione della mappa

export async function showDashboard(container, user = null) {
  document.title = "LaTaverna - Dashboard"
  
  if (!user) {
    container.innerHTML = `<div class="loading"><p>Caricamento utente...</p></div>`
    try {
      user = await account.get()
    } catch (err) {
      import('./login.js').then(m => m.showLogin(container))
      return
    }
  }

  renderDashboard(container, user)
  attachEvents(container, user) // Passiamo user per personalizzare l'esperienza
  setupDiscordRedirect(container)
}

function renderDashboard(container, user) {
  const username = user.name || user.email
  container.innerHTML = `
    <div class="dashboard">
      <div class="card account">
        <h2 style="color: #a953ec; margin-bottom: 15px;">Benvenuto, ${username}</h2>
        <div class="account-info" style="background: rgba(255,255,255,0.03); padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>ID:</strong> <span style="font-size: 10px; color: #888;">${user.$id}</span></p>
        </div>
      </div>

      <div class="card actions" style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px;">
        <h2 style="font-size: 18px; margin-bottom: 10px;">Sala Giochi</h2>
        
        <button id="btnStartGame" class="btn" style="background: linear-gradient(135deg, #a953ec, #6b21a8); border: none; box-shadow: 0 4px 15px rgba(169, 83, 236, 0.4);">
          🏰 Entra nel Tavolo
        </button>

        <button id="btnConnectDiscord" class="btn" style="background: #5865F2; opacity: 0.8;">
          Collega Discord
        </button>

        <button id="btnLogout" class="btn logout" style="background: transparent; border: 1px solid #ff4444; color: #ff4444; margin-top: 10px;">
          Logout
        </button>

        <p id="message" class="message" style="margin-top: 10px; font-size: 13px;"></p>
      </div>
    </div>
  `
}

function attachEvents(container, user) {
  const messageEl = container.querySelector('#message')

  // Logica per entrare nel Tabletop
  container.querySelector('#btnStartGame').onclick = () => {
    // Nascondiamo la dashboard e carichiamo il tavolo
    showTabletop(container);
  }

  container.querySelector('#btnLogout').onclick = async () => {
    try {
      await account.deleteSession('current')
      window.location.reload()
    } catch (err) {
      messageEl.textContent = `Errore: ${err.message}`
    }
  }

  container.querySelector('#btnConnectDiscord').onclick = () => {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    const redirectUri = encodeURIComponent(window.location.origin)
    const scope = encodeURIComponent('identify email')
    
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`
  }
}
