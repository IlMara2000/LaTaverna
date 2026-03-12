import { showRegister } from './register.js';

export function showLogin(container) {
  document.title = "LaTaverna - Login";
  
  container.innerHTML = `
    <div class="login-header"><h2>Accedi</h2></div>
    <div id="login-msg" style="color:#ff4444; margin-bottom:10px; font-size:14px; min-height:20px;"></div>
    <form id="login-form">
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" placeholder="nome@esempio.com" required />
        </div>
        <div class="form-group">
            <label>Password</label>
            <input type="password" id="password" placeholder="••••••••" required />
        </div>
        <button type="submit" class="btn" id="btn-login">Entra</button>
        <div class="divider"><span>OPPURE</span></div>
        <button type="button" class="social-btn" id="discord-login">Login con Discord</button>
        <div class="footer">
            Non hai un account? <a id="toRegister">Registrati</a>
        </div>
    </form>
  `;

  const msg = container.querySelector('#login-msg');

  // BOTTONE LOGIN (Email/Password)
  container.querySelector('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = container.querySelector('#email').value;
    const password = container.querySelector('#password').value;

    try {
      await window.sdk.account.createEmailPasswordSession(email, password);
      container.innerHTML = "<h2>Benvenuto in Taverna!</h2><p>Accesso effettuato.</p>";
      // Qui caricherai la dashboard
    } catch (err) {
      msg.textContent = "Errore: " + err.message;
    }
  };

  // BOTTONE DISCORD
  container.querySelector('#discord-login').onclick = () => {
    window.sdk.account.createOAuth2Session(
        'discord',
        window.location.href, // Ritorna qui dopo il login
        window.location.href
    );
  };

  // Link Registrati
  container.querySelector('#toRegister').onclick = () => showRegister(container);
}
