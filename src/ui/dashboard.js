import { account } from '@services/appwrite.js'
import { CONFIG } from '@config/env.js'
import { setupDiscordRedirect } from '@services/redirectDiscord.js'

export async function showDashboard(container) {

  container.innerHTML = `
    <div class="loading">
      <p>Caricamento dashboard...</p>
    </div>
  `

  try {

    const user = await account.get()

    renderDashboard(container, user)

    attachEvents(container)

    setupDiscordRedirect(container)

  } catch (err) {

    console.error("Sessione non valida:", err)

    container.innerHTML = `
      <div class="session-expired">
        <p>Sessione scaduta. Reindirizzamento al login...</p>
      </div>
    `

    setTimeout(() => {
      import('./login.js').then(m => m.showLogin(container))
    }, 1000)

  }

}

function renderDashboard(container, user) {

  const username = user.name || user.email
  const discordId = user.discord_id || "Non collegato"

  container.innerHTML = `
    <div class="dashboard">

      <div class="card account">

        <h2>Account</h2>

        <div class="account-info">
          <p><strong>Utente:</strong> ${username}</p>
          <p><strong>Email:</strong> ${user.email}</p>
          <p><strong>ID:</strong> ${user.$id}</p>
          <p><strong>Discord:</strong> ${discordId}</p>
        </div>

      </div>

      <div class="card actions">

        <h2>Azioni</h2>

        <button id="btnConnectDiscord" class="btn">
          Collega Discord
        </button>

        <button id="btnLogout" class="btn logout">
          Logout
        </button>

        <p id="message" class="message"></p>

      </div>

    </div>
  `

}

function attachEvents(container) {

  const messageEl = container.querySelector('#message')

  const logoutBtn = container.querySelector('#btnLogout')
  const discordBtn = container.querySelector('#btnConnectDiscord')

  logoutBtn.onclick = async () => {

    try {

      await account.deleteSession('current')

      window.location.reload()

    } catch (err) {

      console.error(err)

      messageEl.textContent = `Errore logout: ${err.message}`

    }

  }

  discordBtn.onclick = () => {

    const clientId = CONFIG.DISCORD_CLIENT_ID

    const redirectUri = encodeURIComponent(CONFIG.DISCORD_REDIRECT_URI)

    const scope = encodeURIComponent('identify email')

    const url =
      `https://discord.com/oauth2/authorize` +
      `?client_id=${clientId}` +
      `&redirect_uri=${redirectUri}` +
      `&response_type=code` +
      `&scope=${scope}`

    window.location.href = url

  }

}