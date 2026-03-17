import { account } from '../services/appwrite.js'
import { showDashboard } from './dashboard.js'

export function showLogin(container) {
    // Usiamo direttamente il container blindato dal CSS
    container.innerHTML = `
    <div class="auth-card">
        <h2 class="auth-title">ACCEDI ALLA TAVERNA</h2>

        <div id="login-msg" class="auth-message"></div>

        <form id="login-form" class="auth-form">
            <input 
                type="email" 
                id="email" 
                placeholder="Email" 
                required 
                autocomplete="email" 
            >
            <input 
                type="password" 
                id="password" 
                placeholder="Password" 
                required 
                autocomplete="current-password" 
            >
            <button type="submit" class="btn-primary auth-submit">
                ENTRA NELLA TAVERNA
            </button>
        </form>

        <div style="font-size: 10px; font-weight: 800; opacity: 0.4; letter-spacing: 2px;">OPPURE</div>

        <button type="button" id="discord-login" class="discord-btn">
            <span>👾</span> LOGIN CON DISCORD
        </button>

        <div class="auth-footer">
            Nuovo viandante? 
            <span id="toRegister" class="auth-link">Registrati qui</span>
        </div>
    </div>
    `

    const form = container.querySelector('#login-form')
    const msg = container.querySelector('#login-msg')
    const submitBtn = container.querySelector('.auth-submit')

    form.onsubmit = async (e) => {
        e.preventDefault()
        const email = container.querySelector('#email').value.trim()
        const password = container.querySelector('#password').value

        // Feedback visivo immediato con glow
        msg.style.color = "var(--neon-glow)";
        msg.textContent = "⚡ Verificando il portale...";
        submitBtn.disabled = true
        submitBtn.style.opacity = "0.7";

        try {
            await account.createEmailPasswordSession(email, password)
            const user = await account.get()
            
            // Transizione fluida verso la dashboard
            container.style.opacity = "0";
            setTimeout(() => {
                showDashboard(container, user);
                container.style.opacity = "1";
            }, 300);

        } catch (err) {
            msg.textContent = "Accesso negato. Riprova, viandante.";
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
            
            // Piccola vibrazione visiva per l'errore
            form.style.animation = "none";
            setTimeout(() => form.style.animation = "shake 0.4s", 10);
        }
    }

    container.querySelector('#discord-login').onclick = () => {
        const origin = window.location.origin
        account.createOAuth2Session('discord', origin, origin)
    }

    container.querySelector('#toRegister').onclick = async () => {
        container.style.opacity = "0";
        const { showRegister } = await import('./register.js')
        setTimeout(() => {
            showRegister(container);
            container.style.opacity = "1";
        }, 300);
    }
}
