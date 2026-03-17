import { account, ID } from '../services/appwrite.js';

export function showRegister(container) {
    // Rimosso ogni stile inline: ora comanda solo il file style.css blindato
    container.innerHTML = `
        <div class="auth-card">
            <h2 class="auth-title">REGISTRATI</h2>
            
            <div id="reg-msg" class="auth-message"></div>
            
            <form id="register-form" class="auth-form">
                <input type="text" id="reg-username" placeholder="Nome Viandante" required>
                <input type="email" id="reg-email" placeholder="Email" required>
                <input type="password" id="reg-password" placeholder="Password (min. 8)" required minlength="8">
                
                <button type="submit" class="btn-primary auth-submit">
                    CREA PROFILO
                </button>
            </form>
            
            <div class="auth-footer">
                Hai già un account? 
                <span id="toLogin" class="auth-link">Torna al Login</span>
            </div>
        </div>
    `;

    const form = container.querySelector('#register-form');
    const msg = container.querySelector('#reg-msg');
    const submitBtn = container.querySelector('.auth-submit');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const username = container.querySelector('#reg-username').value.trim();
        const email = container.querySelector('#reg-email').value.trim();
        const password = container.querySelector('#reg-password').value;

        // Feedback Ametista
        msg.style.color = "var(--neon-glow)";
        msg.textContent = "🔮 Intrecciando il tuo destino...";
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.7";

        try {
            // Rito di creazione account
            await account.create(ID.unique(), email, password, username);
            await account.createEmailPasswordSession(email, password);
            
            // Effetto dissolvenza prima del refresh
            container.style.transition = "opacity 0.5s ease";
            container.style.opacity = "0";
            setTimeout(() => window.location.reload(), 500);
            
        } catch (err) {
            console.error("Reg fail:", err);
            msg.style.color = "#ff4444"; // Rosso errore classico, ma puoi usare var(--neon-glow) se preferisci
            msg.textContent = "Errore durante il rito di registrazione.";
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
            
            // Vibrazione di errore
            form.style.animation = "none";
            setTimeout(() => form.style.animation = "shake 0.4s", 10);
        }
    };

    container.querySelector('#toLogin').onclick = async () => {
        // Transizione fluida verso il login
        container.style.opacity = "0";
        const { showLogin } = await import('./login.js');
        setTimeout(() => {
            showLogin(container);
            container.style.opacity = "1";
        }, 300);
    };
}
