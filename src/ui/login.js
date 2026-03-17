import { account } from '../services/appwrite.js';

export function showLogin(container) {
    container.innerHTML = `
    <div class="auth-wrapper">
        <div class="auth-card">
            <h2 class="auth-title">ACCEDI</h2>
            <div id="login-msg" class="auth-status-msg"></div>

            <form id="login-form" class="auth-form">
                <input type="email" id="email" placeholder="Tua Email" required>
                <input type="password" id="password" placeholder="Password Segreta" required>
                
                <label class="gdpr-label">
                    <input type="checkbox" id="gdpr-check" required>
                    <span>Accetto il trattamento dati (GDPR)</span>
                </label>

                <button type="submit" class="btn-primary">ENTRA NELLA TAVERNA</button>
            </form>

            <div class="auth-divider">OPPURE</div>

            <button type="button" id="discord-login" class="discord-btn">
                <span>👾</span> LOGIN CON DISCORD
            </button>

            <p class="auth-switch-text">
                Nuovo viandante? <span id="toRegister" class="auth-link">Registrati qui</span>
            </p>
        </div>
    </div>`;

    // ... (manteniamo la logica onsubmit precedente)
    const form = container.querySelector('#login-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const msg = container.querySelector('#login-msg');
        try {
            const email = container.querySelector('#email').value;
            const password = container.querySelector('#password').value;
            await account.createEmailPasswordSession(email, password);
            window.location.reload();
        } catch (err) {
            msg.textContent = "Credenziali errate o portale chiuso.";
            msg.style.color = "#ff4444";
        }
    };

    container.querySelector('#toRegister').onclick = async () => {
        const { showRegister } = await import('./register.js');
        showRegister(container);
    };
}
