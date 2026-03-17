import { account, ID } from '../services/appwrite.js';

export function showRegister(container) {
    container.innerHTML = `
    <div class="auth-wrapper">
        <div class="auth-card">
            <h2 class="auth-title">REGISTRATI</h2>
            
            <div id="reg-msg" style="height: 20px; font-size: 13px; font-weight: 600; margin-bottom: 10px; text-align: center;"></div>
            
            <form id="register-form" style="display: flex; flex-direction: column; gap: 15px;">
                <input type="text" id="reg-username" placeholder="Nome Viandante" required autocomplete="username">
                <input type="email" id="reg-email" placeholder="Email" required autocomplete="email">
                <input type="password" id="reg-password" placeholder="Password (min. 8 caratteri)" required minlength="8" autocomplete="new-password">
                
                <label style="display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-pink); cursor: pointer; text-align: left; line-height: 1.2;">
                    <input type="checkbox" id="reg-gdpr-check" required style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--neon-glow);">
                    <span>Acconsento al trattamento dei dati personali.</span>
                </label>

                <button type="submit" class="btn-primary">CREA IL TUO PROFILO</button>
            </form>
            
            <div style="text-align: center; margin-top: 20px; font-size: 14px; color: rgba(255,255,255,0.7);">
                Hai già un account? <span id="toLogin" style="color: var(--neon-glow); cursor: pointer; font-weight: bold;">Torna al Login</span>
            </div>
        </div>
    </div>
    `;

    const form = container.querySelector('#register-form');
    const msg = container.querySelector('#reg-msg');
    const card = container.querySelector('.auth-card');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const username = container.querySelector('#reg-username').value.trim();
        const email = container.querySelector('#reg-email').value.trim();
        const password = container.querySelector('#reg-password').value;

        msg.style.color = "var(--neon-glow)";
        msg.textContent = "🔮 Intrecciando il tuo destino...";

        try {
            // 1. Creazione Account
            await account.create(ID.unique(), email, password, username);
            
            // 2. Login automatico
            await account.createEmailPasswordSession(email, password);
            
            window.location.reload(); 
        } catch (err) {
            console.error("Errore Registrazione:", err);
            msg.style.color = "#ff4444";
            
            if (err.type === 'user_already_exists') {
                msg.textContent = "L'email è già legata a un viandante.";
            } else {
                msg.textContent = "Errore durante il rito. Riprova.";
            }

            card.classList.add('shake-error');
            setTimeout(() => card.classList.remove('shake-error'), 400);
        }
    };

    // Vai a Login
    container.querySelector('#toLogin').onclick = async () => {
        const { showLogin } = await import('./login.js');
        showLogin(container);
    };
}
