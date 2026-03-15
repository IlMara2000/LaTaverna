import { account } from '../services/appwrite.js';
// IMPORTANTE: Importiamo ID da appwrite per generare un ID univoco reale
import { ID } from 'appwrite';

export function showRegister(container) {
    document.title = "LaTaverna - Nuovo Viandante";
    
    container.innerHTML = `
        <div class="glass-box">
            <h2 style="text-align:center; margin-bottom:25px; letter-spacing:3px; font-weight:900;">REGISTRATI</h2>
            
            <div id="reg-msg" style="margin-bottom:15px; font-size:14px; min-height:22px; text-align:center; font-weight:600;"></div>
            
            <form id="register-form">
                <div class="form-group" style="margin-bottom:15px;">
                    <input type="text" id="reg-username" placeholder="Username" required autocomplete="username" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--accent); background:rgba(0,0,0,0.2); color:white;" />
                </div>
                <div class="form-group" style="margin-bottom:15px;">
                    <input type="email" id="reg-email" placeholder="Email" required autocomplete="email" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--accent); background:rgba(0,0,0,0.2); color:white;" />
                </div>
                <div class="form-group" style="margin-bottom:15px;">
                    <input type="password" id="reg-password" placeholder="Password (min. 8 caratteri)" required minlength="8" autocomplete="new-password" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--accent); background:rgba(0,0,0,0.2); color:white;" />
                </div>
                
                <div style="margin: 20px 0; display:flex; align-items:center; gap:12px; padding: 0 5px;">
                    <input type="checkbox" id="gdpr" required style="width:20px; height:20px; accent-color:var(--accent);" />
                    <label for="gdpr" style="font-size:12px; color:#aaa; cursor:pointer; line-height:1.2;">
                        Accetto i termini della Taverna e il trattamento dati GDPR
                    </label>
                </div>
                
                <button type="submit" class="btn-primary" id="reg-submit" style="width:100%;">CREA ACCOUNT</button>
            </form>
            
            <div style="text-align:center; margin-top:30px; font-size:14px; color:#ccc;">
                Hai già un account? <span id="toLogin" style="color:#a953ec; cursor:pointer; font-weight:bold; margin-left:5px;">Torna al Login</span>
            </div>
        </div>
    `;

    const msg = container.querySelector('#reg-msg');
    const form = container.querySelector('#register-form');
    const btn = container.querySelector('#reg-submit');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const username = container.querySelector('#reg-username').value.trim();
        const email = container.querySelector('#reg-email').value.trim();
        const password = container.querySelector('#reg-password').value;

        msg.style.color = "#a953ec";
        msg.textContent = "Forgiando il tuo profilo...";
        btn.disabled = true;
        btn.style.opacity = "0.5";

        try {
            // FIX CRITICO: ID.unique() crea un ID vero, non la parola 'unique()'
            await account.create(ID.unique(), email, password, username);
            
            msg.style.color = "#00ff88";
            msg.textContent = "Account creato! Entriamo...";

            // Esegue il login automatico dopo la registrazione
            await account.createEmailPasswordSession(email, password);
            setTimeout(() => window.location.reload(), 1000);

        } catch (err) {
            btn.disabled = false;
            btn.style.opacity = "1";
            msg.style.color = "#ff4444";
            
            if (err.message.includes('already exists')) {
                msg.textContent = "Questa email è già registrata.";
            } else {
                msg.textContent = "Errore: " + err.message;
            }
        }
    };

    container.querySelector('#toLogin').onclick = async () => {
        const { showLogin } = await import('./login.js');
        showLogin(container);
    };
}
