import { account, ID } from '../services/appwrite.js';

export function showRegister(container) {
    container.innerHTML = `
        <div class="auth-card">
            <h2 class="auth-title">REGISTRATI</h2>
            <div id="reg-msg" class="auth-message"></div>
            
            <form id="register-form" class="auth-form">
                <input type="text" id="reg-username" placeholder="Nome Viandante" required>
                <input type="email" id="reg-email" placeholder="Email" required>
                <input type="password" id="reg-password" placeholder="Password (min. 8)" required minlength="8">
                <button type="submit" class="btn-primary auth-submit">CREA PROFILO</button>
            </form>
            
            <div class="auth-footer" style="color: rgba(255,255,255,0.6); font-size: 14px;">
                Hai già un account? <span id="toLogin" class="auth-link">Torna al Login</span>
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
            msg.textContent = "Errore durante il rito.";
            card.classList.add('shake-error');
            setTimeout(() => card.classList.remove('shake-error'), 400);
        }
    };

    container.querySelector('#toLogin').onclick = async () => {
        const { showLogin } = await import('./login.js');
        showLogin(container);
    };
}
