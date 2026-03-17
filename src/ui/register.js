import { account, ID } from '../services/appwrite.js';

export function showRegister(container) {
    container.innerHTML = `
    <div class="auth-wrapper">
        <div class="auth-card">
            <h2 class="auth-title">REGISTRATI</h2>
            <div id="reg-msg" class="auth-status-msg"></div>
            
            <form id="register-form" class="auth-form">
                <input type="text" id="reg-username" placeholder="Nome Nome Viandante" required>
                <input type="email" id="reg-email" placeholder="Email" required>
                <input type="password" id="reg-password" placeholder="Password (min. 8 caratteri)" required minlength="8">
                
                <label class="gdpr-label">
                    <input type="checkbox" id="reg-gdpr-check" required>
                    <span>Dichiaro di aver letto l'informativa GDPR</span>
                </label>

                <button type="submit" class="btn-primary">CREA IL TUO PROFILO</button>
            </form>
            
            <p class="auth-switch-text">
                Hai già un account? <span id="toLogin" class="auth-link">Torna al Login</span>
            </p>
        </div>
    </div>`;

    const form = container.querySelector('#register-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const msg = container.querySelector('#reg-msg');
        try {
            const user = container.querySelector('#reg-username').value;
            const email = container.querySelector('#reg-email').value;
            const pass = container.querySelector('#reg-password').value;
            
            await account.create(ID.unique(), email, pass, user);
            await account.createEmailPasswordSession(email, pass);
            window.location.reload();
        } catch (err) {
            msg.textContent = "Errore durante il rito. Riprova.";
            msg.style.color = "#ff4444";
        }
    };

    container.querySelector('#toLogin').onclick = async () => {
        const { showLogin } = await import('./login.js');
        showLogin(container);
    };
}
