import { showRegister } from './register.js'
import { account } from '@services/appwrite.js'
import { showDashboard } from './dashboard.js'

export function showLogin(container) {
  document.title = "LaTaverna - Login"
  container.innerHTML = `
    <div class="glass-box">
        <h2 style="text-align:center; margin-bottom:25px; letter-spacing:2px;">ACCEDI</h2>
        <div id="login-msg" style="margin-bottom:15px; font-size:14px; min-height:20px; text-align:center;"></div>
        <form id="login-form">
            <div class="form-group">
                <input type="email" id="email" placeholder="Email" required />
            </div>
            <div class="form-group">
                <input type="password" id="password" placeholder="Password" required />
            </div>
            <button type="submit" class="btn-primary">ENTRA</button>
            <div style="text-align:center; margin: 20px 0; color: rgba(255,255,255,0.2); font-size: 11px;">OPPURE</div>
            <button type="button" id="discord-login" style="width:100%; padding:12px; background:#5865F2; border:none; border-radius:12px; color:white; font-weight:bold; cursor:pointer;">Login con Discord</button>
            <div style="text-align:center; margin-top:25px; font-size:14px; color:#ccc;">
                Nuovo qui? <a id="toRegister" style="color:#a953ec; cursor:pointer; font-weight:bold;">Registrati</a>
            </div>
        </form>
    </div>
  `
  // ... (Tieni la tua logica onsubmit e onclick originale)
}
