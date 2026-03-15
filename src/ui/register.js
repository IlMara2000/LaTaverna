import { account } from '../services/appwrite.js';

/**
 * Visualizza la schermata di Registrazione
 * @param {HTMLElement} container - Il contenitore UI principale
 */
export function showRegister(container) {
    document.title = "LaTaverna - Nuovo Viandante";
    
    container.innerHTML = `
        <div class="glass-box">
            <h2 style="text-align:center; margin-bottom:25px; letter-spacing:3px; font-weight:900;">REGISTRATI</h2>
            
            <div id="reg-msg" style="margin-bottom:15px; font-size:14px; min-height:22px; text-align:center; font-weight:600;"></div>
            
            <form id="register-form">
                <div class="form-group">
                    <input type="text" id="reg-username" placeholder="Username" required autocomplete="username" />
                </div>
                <div class="form-group">
                    <input type="email" id="reg-email" placeholder="Email" required autocomplete="email" />
                </div>
                <div class="form-group">
                    <input type="password" id="reg-password" placeholder="Password (min. 8 caratteri)" required minlength="8" autocomplete="new-password" />
                </div>
                
                <div style="margin: 20px 0; display:flex; align-items:center; gap:12px; padding: 0 5px;">
                    <input type="checkbox" id="gdpr" required style="width:20px; height:20px; accent-color:var(--accent);" />
                    <label for="gdpr" style="font-size:12px; color:#aaa; cursor:pointer; line-height:1.2;">
                        Accetto i termini della Taverna e il trattamento dati GDPR
                    </label>
                </div>
                
                <button type="submit" class="btn-primary" id="reg-submit">CREA ACCOUNT</button>
                
                <div style="text-align:center; margin-top:30px; font-size:14px; color:#ccc;">
                    Hai già un account? <a id="toLogin" style="color:#a953ec; cursor:pointer; font-weight:bold; text-decoration:none; margin-left:5px;">Torna al Login</a>
                </div>
            </form>
        </div>
    `;

    const msg = container.querySelector('#reg-msg');
    const form = container.querySelector('#register-form');

    // --- LOGICA REGISTRAZIONE ---
    form.onsubmit = async (e) => {
        e.preventDefault();
        const username = container.querySelector('#reg-username').value.trim();
        const email = container.querySelector('#reg-email').value.trim();
        const password = container.querySelector('#reg-password').value;
        const btn = container.querySelector('#reg-submit');

        msg.style.color = "#a953ec";
        msg.textContent = "Forgiando il tuo profilo...";
        btn.disabled = true;
        btn.style.opacity = "0.7";

        try {
            // 1. Creazione Account su Appwrite
            // Il quarto parametro 'username' risolve l'errore "Missing required attribute name"
            await account.create('unique()', email, password, username);
            
            msg.style.color = "#00ff88";
            msg.textContent = "Account creato! Entriamo...";

            // 2. Login Automatico (Best Practice per Mobile)
            await account.createEmailPasswordSession(email, password);
            
            // Ricarichiamo per attivare la dashboard nel main.js
            setTimeout(() => window.location.reload(), 1000);

        } catch (err) {
            btn.disabled = false;
            btn.style.opacity = "1";
            msg.style.color = "#ff4444";
            
            // Gestione errori specifica
            if (err.type === 'user_already_exists') {
                msg.textContent = "Questa email è già registrata.";
            } else {
                msg.textContent = "Errore: " + err.message;
            }
            console.error("Register Error:", err);
        }
    };

    // --- RITORNO AL LOGIN (Import Dinamico) ---
    container.querySelector('#toLogin').onclick = async (e) => {
        e.preventDefault();
        const { showLogin } = await import('./login.js');
        showLogin(container);
    };
}
