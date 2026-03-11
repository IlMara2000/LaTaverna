// src/ui/register.js
import { showLogin } from './login.js';

export function showRegister(container) {
  document.title = "LaTaverna - Registrati";

  const containerBox = container.querySelector('.login-container') || container;

  containerBox.innerHTML = `
    <div class="login-header">
      <h2>Registrati</h2>
    </div>

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
      <label for="gdpr">Accetto i termini GDPR</label>
    </div>

    <button class="btn" id="register-btn">Registrati</button>

    <div class="footer">
      Hai già un account? <a href="#" id="toLogin">Login</a>
    </div>
  `;

  // Torna al login
  const toLoginLink = containerBox.querySelector('#toLogin');
  if(toLoginLink) {
    toLoginLink.onclick = (e) => {
      e.preventDefault();
      document.title = "LaTaverna - Login";
      import('./login.js').then(module => module.showLogin(container));
    };
  }
}
  const messageEl = container.querySelector('#message');

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
      await register({ email, password, username, gdprAccepted });
      messageEl.textContent = "Account creato! Reindirizzamento al login...";
      setTimeout(() => showLogin(container), 1000);
    } catch (err) {
      messageEl.textContent = `Errore registrazione: ${err.message}`;
    }
  };

  container.querySelector('#toLogin').onclick = (e) => {
    e.preventDefault();
    showLogin(container);
  };
  
