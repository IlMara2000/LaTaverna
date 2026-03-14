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
                <label for="gdpr" style="font-size:12px; color:#aaa;">Accetto i termini GDPR</label>
            </div>
            <button type="submit" class="btn-primary">CREA ACCOUNT</button>
            <div style="text-align:center; margin-top:25px; font-size:14px; color:#ccc;">
                Hai un account? <a id="toLogin" style="color:#a953ec; cursor:pointer; font-weight:bold;">Login</a>
            </div>
        </form>
    </div>
  `
  // ... (Tieni la tua logica onsubmit e onclick originale)
}
