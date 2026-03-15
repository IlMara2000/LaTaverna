import { account } from '../services/appwrite.js';

export function showRegister(container) {
  document.title = "LaTaverna - Registrati";
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
                <input type="password" id="reg-password" placeholder="Password" required minlength="8" />
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
  `;

  const msg = container.querySelector('#reg-msg');
  const form = container.querySelector('#register-form');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const username = container.querySelector('#reg-username').value.trim();
    const email = container.querySelector('#reg-email').value.trim();
    const password = container.querySelector('#reg-password').value;

    try {
      msg.style.color = "#a953ec";
      msg.textContent = "Creazione account...";
      
      // Correzione: Passo username come quarto parametro (name)
      await account.create('unique()', email, password, username);
      
      // Login automatico immediato
      await account.createEmailPasswordSession(email, password);
      
      msg.style.color = "#00ff88";
      msg.textContent = "Registrazione completata!";
      
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      msg.style.color = "#ff4444";
      msg.textContent = "Errore: " + err.message;
    }
  };

  container.querySelector('#toLogin').onclick = async (e) => {
    e.preventDefault();
    const { showLogin } = await import('./login.js');
    showLogin(container);
  };
}
