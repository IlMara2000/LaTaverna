import { account } from '../services/appwrite.js';

export function showLogin(container) {
    // Svuotiamo il contenitore e iniettiamo la card pulita
    container.innerHTML = `
    <div class="auth-card">
        <h2 class="auth-title">ACCEDI</h2>
        
        <div id="login-msg" style="height: 20px; font-size: 13px; font-weight: 600; margin-bottom: 10px; transition: 0.3s;"></div>

        <form id="login-form" style="display: flex; flex-direction: column; gap: 18px;">
            <input type="email" id="email" placeholder="Email" required autocomplete="email">
            <input type="password" id="password" placeholder="Password" required autocomplete="current-password">
            
            <label style="display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--text-pink); cursor: pointer; text-align: left; line-height: 1.2;">
                <input type="checkbox" id="gdpr-check" required style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--neon-glow);">
                <span>Accetto il trattamento dei dati personali secondo le normative GDPR.</span>
            </label>

            <button type="submit" class="btn-primary">ENTRA NELLA TAVERNA</button>
        </form>

        <div style="font-size: 10px; font-weight: 800; opacity: 0.5; letter-spacing: 2px; margin: 10px 0; text-align: center;">OPPURE</div>

        <button type="button" id="discord-login" class="discord-btn">
            <span style="font-size: 18px;">👾</span> LOGIN CON DISCORD
        </button>

        <p style="text-align: center; margin-top: 20px; font-size: 14px; color: rgba(255,255,255,0.7);">
            Nuovo viandante? <span id="toRegister" class="auth-link">Registrati qui</span>
        </p>
    </div>
    `;

    const form = container.querySelector('#login-form');
    const msg = container.querySelector('#login-msg');
    const card = container.querySelector('.auth-card');

    // Gestione del Submit
    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = container.querySelector('#email').value.trim();
        const password = container.querySelector('#password').value;

        msg.style.color = "var(--neon-glow)";
        msg.textContent = "⚡ Verificando il portale...";

        try {
            // Tentativo di Login con Appwrite
            await account.createEmailPasswordSession(email, password);
            
            // Se va a buon fine, ricarichiamo per attivare la Dashboard nel main.js
            window.location.reload(); 
        } catch (err) {
            console.error("Errore Login:", err);
            msg.style.color = "#ff4444";
            msg.textContent = "Accesso negato. Controlla le credenziali.";
            
            // Effetto vibrazione (definito nel tuo style.css)
            card.classList.add('shake-error');
            setTimeout(() => card.classList.remove('shake-error'), 400);
        }
    };

    // OAuth con Discord
    container.querySelector('#discord-login').onclick = () => {
        const origin = window.location.origin;
        account.createOAuth2Session('discord', origin, origin);
    };

    // Navigazione verso il Register
    container.querySelector('#toRegister').onclick = async () => {
        const { showRegister } = await import('./register.js');
        showRegister(container);
    };
}
