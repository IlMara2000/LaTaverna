import { showLogin } from './login.js'
import { account } from '@services/appwrite.js'

export function showRegister(container) {
  document.title = "LaTaverna - Registrati"
  container.innerHTML = `
    <div class="glass-box">
        <h2 style="text-align:center; margin-bottom:25px; letter-spacing:2px;">REGISTRATI</h2>
        <div id="reg-msg" style="margin-bottom:15px; font-size:14px; min-height:20px; text-align:center;"></div>
        <form id="register-form">
            <div class="form-group">
                <input type="text" id="reg-username" placeholder="Username" required />
            </div>
            <div class="form-group">
                <input type="email" id="reg-email" placeholder="Email" required />
            </div>
            <div class="form-group">
                <input type="password" id="reg-password" placeholder="Password" required />
            </div>
            <div style="margin-bottom:20px; display:flex; align-items:center; gap:10px;">
                <input type="checkbox" id="gdpr" required />
                <label for="gdpr" style="font-size:12px; color:#aaa; cursor:pointer;">Accetto i termini GDPR</label>
            </div>
            <button type="submit" class="btn-primary">CREA ACCOUNT</button>
            <div style="text-align:center; margin-top:25px; font-size:14px; color:#ccc;">
                Hai già un account? <a id="toLogin" style="color:#a953ec; cursor:pointer; font-weight:bold; text-decoration:none;">Login</a>
            </div>
        </form>
    </div>
  `

  const msg = container.querySelector('#reg-msg')
  const form = container.querySelector('#register-form')

  // LOGICA REGISTRAZIONE
  form.onsubmit = async (e) => {
    e.preventDefault()
    const username = container.querySelector('#reg-username').value.trim()
    const email = container.querySelector('#reg-email').value.trim()
    const password = container.querySelector('#reg-password').value

    try {
      msg.style.color = "#a953ec"
      msg.textContent = "Creazione account in corso..."
      
      // Creazione su Appwrite
      await account.create('unique()', email, password, username)
      
      msg.style.color = "#00ff88"
      msg.textContent = "Account creato! Reindirizzamento..."
      
      // Dopo 1.5 secondi torna al login per permettere l'accesso
      setTimeout(() => showLogin(container), 1500)
    } catch (err) {
      msg.style.color = "#ff4444"
      msg.textContent = "Errore: " + err.message
    }
  }

  // TASTO PER TORNARE AL LOGIN (Sistemato)
  container.querySelector('#toLogin').onclick = (e) => {
    e.preventDefault()
    showLogin(container)
  }
}
