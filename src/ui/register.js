// src/ui/register.js
import { showLogin } from './login.js';

export function showRegister(container) {
  document.title = "LaTaverna - Registrati";

  container.innerHTML = `
    <div class="login-header">
      <h2>Registrati</h2>
    </div>
    <div id="message" style="color:#ff4444; margin-bottom:10px; font-size:14px;"></div>

    <div class="form-group">
      <label for="username">Username</label>
      <input type="text" id="username" placeholder="Inserisci il tuo username" required />
    </div>

    <div class="form-group">
      <label for="email">Email</label>
      <input type="email" id="email" placeholder="Inserisci la tua email" required />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" placeholder="Inserisci la tua password" required />
    </div>

    <div class="checkbox-group">
      <input type="checkbox" id="gdpr" />
      <label for="gdpr" style="color:#ccc; font-size:14px;">Accetto i termini GDPR</label>
    </div>

    <button class="btn" id="register-btn">Registrati</button>

    <div class="footer">
      Hai già un account? <a href="#" id="toLogin">Login</a>
    </div>
  `;

  const messageEl = container.querySelector('#message');

  // Gestione click Registrati
  container.querySelector('#register-btn').onclick = async () => {
    const username = container.querySelector('#username').value.trim();
    const email = container.querySelector('#email').value.trim();
    const password = container.querySelector('#password').value;
    const gdprAccepted = container.querySelector('#gdpr').checked;

    if (!gdprAccepted) {
      messageEl.textContent = "Devi accettare i termini.";
      return;
    }

    try {
      console.log("Registrazione in corso per:", username);
      // Qui andrà la tua funzione register() di Appwrite
      messageEl.style.color = "#00ff00";
      messageEl.textContent = "Account creato! Reindirizzamento...";
      setTimeout(() => showLogin(container), 1500);
    } catch (err) {
      messageEl.style.color = "#ff4444";
      messageEl.textContent = `Errore registrazione: ${err.message}`;
    }
  };

  // Torna al login
  const toLoginLink = container.querySelector('#toLogin');
  if(toLoginLink) {
    toLoginLink.onclick = (e) => {
      e.preventDefault();
      showLogin(container);
    };
  }
}
