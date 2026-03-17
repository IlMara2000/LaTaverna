import { account } from '../services/appwrite.js';

export function showLogin(container) {
    container.innerHTML = `
    <div class="auth-wrapper">
        <div class="auth-card">
            <h2 class="auth-title">ACCEDI</h2>
            
            <div id="login-msg" class="auth-status-msg"></div>

            <form id="login-form" class="auth-form">
                <div class="input-group">
                    <input type="email" id="email" placeholder="Email" required autocomplete="email">
                </div>
                <div class="input-group">
                    <input type="password" id="password" placeholder="Password" required autocomplete="current-password">
                </div>
                
                <button type="submit" class="btn-primary">ENTRA NELLA TAVERNA</button>
            </form>

            <div class="auth-divider">OPPURE</div>

            <button type="button" id="discord-login" class="discord-btn">
                <span class="icon">👾</span> LOGIN CON DISCORD
            </button>

            <p class="auth-switch-text">
                Nuovo viandante? <span id="toRegister" class="auth-link">Registrati qui</span>
            </p>
        </div>
    </div>
    `;

    const form = container.querySelector('#login-form');
    const msg = container.querySelector('#login-msg');
    const card = container.querySelector('.auth-card');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = container.querySelector('#email').value.trim();
        const password = container.querySelector('#password').value;

        msg.style.color = "var(--neon-glow)";
        msg.textContent = "⚡ Verificando il portale...";

        try {
            await account.createEmailPasswordSession(email, password);
            window.location.reload(); 
        } catch (err) {
            console.error("Errore Login:", err);
            msg.style.color = "#ff4444";
            msg.textContent = "Accesso negato. Controlla le credenziali.";
            card.classList.add('shake-error');
            setTimeout(() => card.classList.remove('shake-error'), 400);
        }
    };

    container.querySelector('#discord-login').onclick = () => {
        const origin = window.location.origin;
        account.createOAuth2Session('discord', origin, origin);
    };

    container.querySelector('#toRegister').onclick = async () => {
        const { showRegister } = await import('./register.js');
        showRegister(container);
    };
}
