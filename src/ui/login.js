import { account } from '../services/appwrite.js'; // Percorso relativo standard
import { showDashboard } from './dashboard.js';

export function showLogin(container) {
  document.title = "LaTaverna - Login";
  container.innerHTML = `
    <div class="glass-box">
        <h2 style="text-align:center; margin-bottom:25px; letter-spacing:2px;">ACCEDI</h2>
        <div id="login-msg" style="margin-bottom:15px; font-size:14px; min-height:20px; text-align:center;"></div>
        <form id="login-form">
            <div class="form-group">
                <input type="email" id="email" placeholder="Email" required autocomplete="email" />
            </div>
            <div class="form-group">
                <input type="password" id="password" placeholder="Password" required autocomplete="current-password" />
            </div>
            <button type="submit" class="btn-primary" id="login-btn">ENTRA</button>
            <div style="text-align:center; margin: 20px 0; color: rgba(255,255,255,0.2); font-size: 11px;">OPPURE</div>
            <button type="button" id="discord-login" style="width:100%; padding:12px; background:#5865F2; border:none; border-radius:12px; color:white; font-weight:bold; cursor:pointer;">Login con Discord</button>
            <div style="text-align:center; margin-top:25px; font-size:14px; color:#ccc;">
                Nuovo qui? <a id="toRegister" style="color:#a953ec; cursor:pointer; font-weight:bold;">Registrati</a>
            </div>
        </form>
    </div>
  `;

  const msg = container.querySelector('#login-msg');
  const form = container.querySelector('#login-form');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const email = container.querySelector('#email').value.trim();
    const password = container.querySelector('#password').value;
    
    msg.style.color = "#a953ec";
    msg.textContent = "Verifica credenziali...";

    try {
      // Importante: distruggere eventuali sessioni vecchie prima di crearne una nuova
      try { await account.deleteSession('current'); } catch (e) {}
      
      await account.createEmailPasswordSession(email, password);
      const user = await account.get();
      showDashboard(container, user);
    } catch (err) {
      msg.style.color = "#ff4444";
      msg.textContent = "Errore: Credenziali errate";
      console.error(err);
    }
  };

  container.querySelector('#discord-login').onclick = () => {
    account.createOAuth2Session('discord', window.location.origin, window.location.origin);
  };

  // Import dinamico per evitare il loop circolare tra login e register
  container.querySelector('#toRegister').onclick = async (e) => {
    e.preventDefault();
    const { showRegister } = await import('./register.js');
    showRegister(container);
  };
}
