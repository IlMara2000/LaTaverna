// src/ui/register.js
export function showRegister(container, t, onBack) {
  document.title = "LaTaverna - Registrati";

  // Usiamo il container che passiamo da index.html
  container.innerHTML = `
    <div class="login-card">
      <h2 style="text-align:center; margin-bottom:30px;">Registrati</h2>
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="username" placeholder="Il tuo nome" required />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="email" placeholder="latua@email.com" required />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="password" required />
      </div>
      <button class="btn-primary" id="register-btn">Registrati</button>
      <div style="margin-top:20px; text-align:center;">
        Hai già un account? <a href="#" id="toLogin" style="color:var(--accent-purple);">Login</a>
      </div>
      <p id="message" style="color:red; margin-top:10px; text-align:center;"></p>
    </div>
  `;

  // Torna al login usando la funzione passata
  container.querySelector('#toLogin').onclick = (e) => {
    e.preventDefault();
    onBack(); 
  };

  // Logica tasto registrazione
  container.querySelector('#register-btn').onclick = async () => {
    // Qui andrà la tua logica di salvataggio (DB o LocalStorage)
    alert("Registrazione in fase di attivazione!");
  };
}
