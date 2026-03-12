import { showLogin } from './login.js';

export function showRegister(container) {
  document.title = "LaTaverna - Registrati";

  container.innerHTML = `
    <div class="login-header"><h2>Registrati</h2></div>
    <div id="reg-msg" style="color:#ff4444; margin-bottom:10px; font-size:14px; min-height:20px;"></div>
    
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
      <label for="gdpr" style="color:#ccc; font-size:14px;">Accetto i termini GDPR</label>
    </div>
    <button class="btn" id="btn-register-action">Registrati</button>
    <div class="footer">Hai già un account? <a id="toLogin">Login</a></div>
  `;

  const msg = container.querySelector('#reg-msg');

  // BOTTONE REGISTRATI
  container.querySelector('#btn-register-action').onclick = async (e) => {
    e.preventDefault();
    const email = container.querySelector('#reg-email').value;
    const password = container.querySelector('#reg-password').value;
    const username = container.querySelector('#reg-username').value;
    const gdpr = container.querySelector('#gdpr').checked;

    if (!gdpr) {
      msg.textContent = "Devi accettare il GDPR per continuare.";
      return;
    }

    try {
      // Crea l'account su Appwrite
      await window.sdk.account.create('unique()', email, password, username);
      msg.style.color = "#00ff00";
      msg.textContent = "Account creato con successo! Ora puoi accedere.";
      setTimeout(() => showLogin(container), 2000);
    } catch (err) {
      msg.style.color = "#ff4444";
      msg.textContent = "Errore: " + err.message;
    }
  };

  // Torna al login
  container.querySelector('#toLogin').onclick = () => showLogin(container);
}
