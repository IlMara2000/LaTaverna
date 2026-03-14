import { account } from '@services/appwrite.js'
import { setupDiscordRedirect } from '@services/redirectDiscord.js'

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
  attachEvents(container)
  setupDiscordRedirect(container)
}

function renderDashboard(container, user) {
  const username = user.name || user.email
  container.innerHTML = `
    <div class="dashboard">
      <div class="card account">
        <h2>Benvenuto, ${username}</h2>
        <div class="account-info">
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>ID:</strong> ${user.$id}</p>
        </div>
      </div>
      <div class="card actions">
        <h2>Azioni</h2>
        <button id="btnConnectDiscord" class="btn">Collega Discord</button>
        <button id="btnLogout" class="btn logout" style="background:#ff4444; margin-top:10px;">Logout</button>
        <p id="message" class="message"></p>
      </div>
    </div>
  `
}

function attachEvents(container) {
  const messageEl = container.querySelector('#message')

  container.querySelector('#btnLogout').onclick = async () => {
    try {
      await account.deleteSession('current')
      window.location.reload()
    } catch (err) {
      messageEl.textContent = `Errore: ${err.message}`
    }
  }

  container.querySelector('#btnConnectDiscord').onclick = () => {
    // Vite usa import.meta.env per le variabili d'ambiente
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    const redirectUri = encodeURIComponent(window.location.origin)
    const scope = encodeURIComponent('identify email')
    
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`
  }
}
