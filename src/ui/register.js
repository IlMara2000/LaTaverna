import { account, ID } from '../services/appwrite.js';

export function showRegister(container) {
    container.innerHTML = `
    <div class="auth-wrapper">
        <div class="auth-card">
            <h2 class="auth-title">REGISTRATI</h2>
            
            <div id="reg-msg" class="auth-status-msg"></div>
            
            <form id="register-form" class="auth-form">
                <div class="input-group">
                    <input type="text" id="reg-username" placeholder="Nome Viandante" required autocomplete="username">
                </div>
                <div class="input-group">
                    <input type="email" id="reg-email" placeholder="Email" required autocomplete="email">
                </div>
                <div class="input-group">
                    <input type="password" id="reg-password" placeholder="Password (min. 8 caratteri)" required minlength="8" autocomplete="new-password">
                </div>
                
                <label class="gdpr-label"> <input type="checkbox" id="gdpr-check" required> <span>Accetto il trattamento dei dati (GDPR)</span> </label>

                <button type="submit" class="btn-primary">CREA IL TUO PROFILO</button>
            </form>
            
            <p class="auth-switch-text">
                Hai già un account? <span id="toLogin" class="auth-link">Torna al Login</span>
            </p>
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
            await account.create(ID.unique(), email, password, username);
            await account.createEmailPasswordSession(email, password);
            window.location.reload(); 
        } catch (err) {
            console.error("Errore Registrazione:", err);
            msg.style.color = "#ff4444";
            msg.textContent = err.type === 'user_already_exists' ? "Email già registrata." : "Errore nel rito. Riprova.";
            card.classList.add('shake-error');
            setTimeout(() => card.classList.remove('shake-error'), 400);
        }
    };

    container.querySelector('#toLogin').onclick = async () => {
        const { showLogin } = await import('./login.js');
        showLogin(container);
    };
}
