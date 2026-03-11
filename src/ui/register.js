// src/ui/register.js
export function showRegister(container, t, onBack) {
  document.title = "LaTaverna - Registrati";

  container.innerHTML = `
    <div class="login-card">
      <h2 style="text-align:center; margin-bottom:30px; font-weight:900; letter-spacing:1px;">REGISTRAZIONE</h2>
      
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="reg-username" placeholder="Il tuo nome da viandante" required />
      </div>
      
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="reg-email" placeholder="latua@email.com" required />
      </div>
      
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="reg-password" placeholder="••••••••" required />
      </div>

      <div id="gdpr-container" style="margin-bottom: 25px; display: flex; align-items: flex-start; gap: 12px; background: rgba(255,255,255,0.03); padding: 18px; border-radius: 16px; border: 1px solid var(--border-color); transition: 0.3s;">
        <input type="checkbox" id="gdpr-check" style="width: 22px; height: 22px; cursor: pointer; accent-color: var(--accent-purple);">
        <label for="gdpr-check" style="font-size: 13px; color: var(--text-muted); line-height: 1.5; cursor: pointer;">
          Accetto i <b style="color:var(--text-main)">Termini di Servizio</b> e acconsento al trattamento dei dati secondo il GDPR. <span style="color: #ff4d4d;">*</span>
        </label>
      </div>

      <button class="btn-primary" id="register-submit-btn">CREA ACCOUNT</button>
      
      <div style="margin-top:20px; text-align:center;">
        <a href="#" id="toLogin" style="color:var(--text-muted); font-size: 14px; text-decoration: none;">
          Hai già un account? <span style="color:var(--accent-purple); font-weight:700;">Accedi</span>
        </a>
      </div>
      
      <p id="reg-message" style="margin-top:15px; text-align:center; font-size:14px; font-weight:600; min-height:20px;"></p>
    </div>
  `;

  const btn = container.querySelector('#register-submit-btn');
  const msg = container.querySelector('#reg-message');
  const gdprContainer = container.querySelector('#gdpr-container');

  // Torna al login usando la funzione passata da index.html
  container.querySelector('#toLogin').onclick = (e) => {
    e.preventDefault();
    onBack(); 
  };

  // Logica tasto registrazione ATTIVA
  btn.onclick = async () => {
    const username = container.querySelector('#reg-username').value.trim();
    const email = container.querySelector('#reg-email').value.trim();
    const password = container.querySelector('#reg-password').value;
    const gdprAccepted = container.querySelector('#gdpr-check').checked;

    // Reset stile errore GDPR
    gdprContainer.style.borderColor = "var(--border-color)";
    gdprContainer.style.background = "rgba(255,255,255,0.03)";

    // Validazione campi
    if (!username || !email || !password) {
      msg.style.color = "#ff4d4d";
      msg.textContent = "Compila tutti i campi obbligatori.";
      return;
    }

    // Controllo GDPR Obbligatorio
    if (!gdprAccepted) {
      msg.style.color = "#ff4d4d";
      msg.textContent = "Devi accettare il GDPR per registrarti.";
      gdprContainer.style.borderColor = "#ff4d4d";
      gdprContainer.style.background = "rgba(255, 77, 77, 0.05)";
      return;
    }

    // LOGICA DI SALVATAGGIO (Active)
    try {
      const userData = {
        username,
        email,
        password, // In produzione andrebbe criptata
        gdpr: true,
        signupDate: new Date().toISOString()
      };

      // Salviamo nel LocalStorage con una chiave unica per email
      localStorage.setItem(`taverna_user_${email}`, JSON.stringify(userData));
      
      msg.style.color = "#4ade80";
      msg.textContent = "Account creato! Entra nella locanda...";
      btn.disabled = true;
      btn.style.opacity = "0.5";

      // Reindirizzamento automatico al login dopo 1.5 secondi
      setTimeout(() => onBack(), 1500);

    } catch (err) {
      msg.style.color = "#ff4d4d";
      msg.textContent = "Errore durante il salvataggio.";
    }
  };
}
