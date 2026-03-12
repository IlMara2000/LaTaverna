import { showRegister } from './register.js'
import { account } from '@services/appwrite.js'

export function showLogin(container) {

  document.title = "LaTaverna - Login"

  container.innerHTML = `
    <div class="login-header"><h2>Accedi</h2></div>

    <div id="login-msg" style="color:#ff4444;margin-bottom:10px;font-size:14px;min-height:20px;"></div>

    <form id="login-form">

        <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" placeholder="nome@esempio.com" required />
        </div>

        <div class="form-group">
            <label>Password</label>
            <input type="password" id="password" placeholder="••••••••" required />
        </div>

        <button type="submit" class="btn" id="btn-login">
            Entra
        </button>

        <div class="divider">
            <span>OPPURE</span>
        </div>

        <button type="button" class="social-btn" id="discord-login">
            Login con Discord
        </button>

        <div class="footer">
            Non hai un account? 
            <a id="toRegister">Registrati</a>
        </div>

    </form>
  `

  const msg = container.querySelector('#login-msg')

  const form = container.querySelector('#login-form')

  form.onsubmit = async (e) => {

    e.preventDefault()

    const email = container.querySelector('#email').value
    const password = container.querySelector('#password').value

    msg.textContent = "Accesso in corso..."

    try {

      await account.createEmailPasswordSession(email, password)

      const dashboard = await import('./dashboard.js')

      dashboard.showDashboard(container)

    } catch (err) {

      msg.textContent = "Errore: " + err.message

    }

  }

  container.querySelector('#discord-login').onclick = () => {

    const redirect = window.location.origin

    account.createOAuth2Session(
      'discord',
      redirect,
      redirect
    )

  }

  container.querySelector('#toRegister').onclick = () => {
    showRegister(container)
  }

}