// stc/ui/register.js
export function showRegister(container, t, onBack) {
  container.innerHTML = `
    <div class="login-card">
      <h2 style="text-align:center; margin-bottom:30px; font-weight:900; font-size:26px;">NUOVO ACCOUNT</h2>
      
      <div class="form-group">
        <label>Nome Utente</label>
        <input type="text" id="reg-username" placeholder="Esempio: Arathorn" required />
      </div>
      
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="reg-email" placeholder="latua@email.com" required />
      </div>
      
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="reg-password" placeholder="••••••••" required />
      </div>

      <div class="gdpr-container" id="gdpr-box">
        <input type="checkbox" id="gdpr-check">
        <div class="gdpr-text">
          Accetto i <b>Termini di Servizio</b> e la Privacy Policy (GDPR). Il trattamento dei dati è necessario per la creazione dell'account. <span style="color: #ff4d4d;">*</span>
        </div>
      </div>

      <button class="btn-primary" id="register-submit-btn">CREA ACCOUNT</button>
      
      <div style="margin-top:20px; text-align:center;">
        <a href="#" id="back-to-login" style="color:var(--text-muted); font-size: 14px; text-decoration: none;">
          Hai già un account? <span style="color:var(--accent-purple); font-weight:700;">Accedi</span>
        </a>
      </div>
      
      <p id="reg-message" style="margin-top:15px; text-align:center; font-size:13px; font-weight:600;"></p>
    </div>
  `;

  const btn = container.querySelector('#register-submit-btn');
  const msg = container.querySelector('#reg-message');
  const gdprBox = container.querySelector('#gdpr-box');

  container.querySelector('#back-to-login').onclick = (e) => {
    e.preventDefault();
    onBack();
  };

  btn.onclick = async () => {
    const user = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-password').value;
    const isGdpr = document.getElementById('gdpr-check').checked;

    if (!user || !email || !pass) {
      msg.style.color = "#ff4d4d";
      msg.textContent = "Compila tutti i campi!";
      return;
    }

    if (!isGdpr) {
      msg.style.color = "#ff4d4d";
      msg.textContent = "Accetta il GDPR per continuare.";
      gdprBox.style.borderColor = "#ff4d4d";
      gdprBox.style.background = "rgba(255, 77, 77, 0.05)";
      return;
    }

    // Salvataggio simulato
    localStorage.setItem(`user_${email}`, JSON.stringify({ username: user, email, gdpr: true }));
    
    msg.style.color = "#4ade80";
    msg.textContent = "Account creato! Entra nella locanda...";
    
    setTimeout(() => { onBack(); }, 1500);
  };
}
