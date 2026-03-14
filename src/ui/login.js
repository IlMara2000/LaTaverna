import { showRegister } from './register.js'
import { account } from '@services/appwrite.js'
import { showDashboard } from './dashboard.js'

export function showLogin(container) {
  document.title = "LaTaverna - Login"

  container.innerHTML = `
    <div class="glass-box">
        <div class="login-header">
            <h2 style="text-align:center; margin-bottom:20px; letter-spacing:2px;">ACCEDI</h2>
        </div>

        <div id="login-msg" style="margin-bottom:15px; font-size:14px; min-height:20px; text-align:center;"></div>

        <form id="login-form">
            <div class="form-group">
                <label style="display:block; margin-bottom:5px; font-size:12px; color:#aaa;">Email</label>
                <input type="email" id="email" placeholder="nome@esempio.com" required />
            </div>

            <div class="form-group">
                <label style="display:block; margin-bottom:5px; font-size:12px; color:#aaa;">Password</label>
                <input type="password" id="password" placeholder="••••••••" required />
            </div>

            <button type="submit" class="btn-primary" id="btn-login" style="margin-top:10px;">
                ENTRA
            </button>

            <div style="text-align:center; margin: 20px 0; color: rgba(255,255,255,0.3); font-size: 12px;">
                <span>OPPURE</span>
            </div>

            <button type="button" id="discord-login" style="width:100%; padding:12px; background:#5865F2; border:none; border-radius:10px; color:white; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px;">
                Login con Discord
            </button>

            <div style="text-align:center; margin-top:25px; font-size:14px; color:#ccc;">
                Non hai un account? 
                <a id="toRegister" style="color:#a953ec; cursor:pointer; font-weight:bold; text-decoration:none; margin-left:5px;">Registrati</a>
            </div>
        </form>
    </div>
  `

  const msg = container.querySelector('#login-msg')
  const form = container.querySelector('#login-form')

  form.onsubmit = async (e) => {
    e.preventDefault()
    const email = container.querySelector('#email').value
    const password = container.querySelector('#password').value

    msg.style.color = "#a953ec"
    msg.textContent = "Verifica credenziali..."

    try {
      await account.createEmailPasswordSession(email, password)
      const user = await account.get()
      showDashboard(container, user)
    } catch (err) {
      msg.style.color = "#ff4444"
      msg.textContent = "Errore: Credenziali errate"
    }
  }

  container.querySelector('#discord-login').onclick = () => {
    const redirect = window.location.origin
    account.createOAuth2Session('discord', redirect, redirect)
  }

  container.querySelector('#toRegister').onclick = () => showRegister(container)
}
