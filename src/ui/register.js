import { showLogin } from './login.js'
import { account } from '@services/appwrite.js'

export function showRegister(container) {
  document.title = "LaTaverna - Registrati"

  container.innerHTML = `
    <div class="login-header"><h2>Registrati</h2></div>
    <div id="reg-msg" style="color:#ff4444;margin-bottom:10px;font-size:14px;min-height:20px;"></div>
    <form id="register-form">
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="reg-username" placeholder="Il tuo nome" required />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="reg-email" placeholder="Email" required />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="reg-password" placeholder="Password" required />
      </div>
      <div class="checkbox-group">
        <input type="checkbox" id="gdpr" />
        <label for="gdpr" style="color:#ccc;font-size:14px;">Accetto i termini GDPR</label>
      </div>
      <button type="submit" class="btn" id="btn-register-action">Registrati</button>
      <div class="footer">Hai già un account? <a id="toLogin">Login</a></div>
    </form>
  `

  const msg = container.querySelector('#reg-msg')
  const form = container.querySelector('#register-form')

  form.onsubmit = async (e) => {
    e.preventDefault()
    const username = container.querySelector('#reg-username').value.trim()
    const email = container.querySelector('#reg-email').value.trim()
    const password = container.querySelector('#reg-password').value
    const gdpr = container.querySelector('#gdpr').checked

    if (!gdpr) {
      msg.textContent = "Devi accettare il GDPR."
      return
    }

    try {
      msg.style.color = "#ccc"
      msg.textContent = "Creazione account..."
      await account.create('unique()', email, password, username)
      msg.style.color = "#00ff88"
      msg.textContent = "Creato! Vai al login..."
      setTimeout(() => showLogin(container), 1500)
    } catch (err) {
      msg.style.color = "#ff4444"
      msg.textContent = "Errore: " + err.message
    }
  }

  container.querySelector('#toLogin').onclick = () => showLogin(container)
}
