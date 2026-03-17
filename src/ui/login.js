import { account } from '../services/appwrite.js'
import { showDashboard } from './dashboard.js'

export function showLogin(container) {
    container.innerHTML = `
    <div class="auth-card">
        <h2 class="auth-title">ACCEDI ALLA TAVERNA</h2>
        <div id="login-msg" class="auth-message"></div>

        <form id="login-form" class="auth-form">
            <input type="email" id="email" placeholder="Email" required autocomplete="email">
            <input type="password" id="password" placeholder="Password" required autocomplete="current-password">
            <button type="submit" class="btn-primary auth-submit">ENTRA NELLA TAVERNA</button>
        </form>

        <div style="font-size: 10px; font-weight: 800; opacity: 0.4; letter-spacing: 2px;">OPPURE</div>

        <button type="button" id="discord-login" class="discord-btn">
            <span>👾</span> LOGIN CON DISCORD
        </button>

        <div class="auth-footer" style="color: rgba(255,255,255,0.6); font-size: 14px;">
            Nuovo viandante? <span id="toRegister" class="auth-link">Registrati qui</span>
        </div>
    </div>
    `

    const form = container.querySelector('#login-form')
    const msg = container.querySelector('#login-msg')
    const card = container.querySelector('.auth-card')

    form.onsubmit = async (e) => {
        e.preventDefault()
        const email = container.querySelector('#email').value.trim()
        const password = container.querySelector('#password').value

        msg.style.color = "var(--neon-glow)";
        msg.textContent = "⚡ Verificando il portale...";

        try {
            await account.createEmailPasswordSession(email, password)
            const user = await account.get()
            showDashboard(container, user)
        } catch (err) {
            msg.textContent = "Accesso negato. Riprova, viandante.";
            card.classList.add('shake-error');
            setTimeout(() => card.classList.remove('shake-error'), 400);
        }
    }

    container.querySelector('#discord-login').onclick = () => {
        const origin = window.location.origin
        account.createOAuth2Session('discord', origin, origin)
    }

    container.querySelector('#toRegister').onclick = async () => {
        const { showRegister } = await import('./register.js')
        showRegister(container)
    }
}
