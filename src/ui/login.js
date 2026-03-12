export function showLogin(container) {
  document.title = "LaTaverna - Login";
  
  container.innerHTML = `
    <div class="login-header"><h2>Accedi</h2></div>
    <form id="login-form">
        <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" placeholder="nome@esempio.com" required />
        </div>
        <div class="form-group">
            <label>Password</label>
            <input type="password" id="password" placeholder="••••••••" required />
        </div>
        <button type="submit" class="btn">Entra</button>
        <div class="divider"><span>OPPURE</span></div>
        <button type="button" class="social-btn" id="discord-login">Login con Discord</button>
        <div class="footer">
            Non hai un account? <a href="#" id="toRegister">Registrati</a>
        </div>
    </form>
  `;

  // Logica Discord originale
  const clientId = "1478809987357868083";
  const redirectUri = encodeURIComponent("https://nyc.cloud.appwrite.io/v1/account/sessions/oauth2/callback/discord/69a85edc001553a4b931");
  const scope = "identify%20email";

  const loginWithDiscord = () => {
    const authUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;
    window.location.href = authUrl;
  };

  container.querySelector('#discord-login').onclick = loginWithDiscord;

  // Link Registrati SPA
  const toRegisterLink = container.querySelector('#toRegister');
  if (toRegisterLink) {
    toRegisterLink.onclick = (e) => {
      e.preventDefault();
      import('./register.js').then(module => {
        module.showRegister(container);
      });
    };
  }

  // Gestione Form Login
  container.querySelector('#login-form').onsubmit = (e) => {
    e.preventDefault();
    console.log("Login inviato");
  };
}
