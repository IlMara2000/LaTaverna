import { account } from '../services/appwrite.js'
import { showDashboard } from './dashboard.js'

export function showLogin(container) {
    container.innerHTML = `
    <div class="auth-wrapper">
        <div class="glass-box auth-card">
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

            <div class="auth-divider">OPPURE</div>

            <button type="button" id="discord-login" class="btn-primary discord-btn">
                <span>👾</span> LOGIN CON DISCORD
            </button>

            <div class="auth-footer">
                Nuovo viandante? 
                <span id="toRegister" class="auth-link">Registrati qui</span>
            </div>
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

        msg.className = "auth-message loading"
        msg.textContent = "⚡ Verificando il portale..."
        submitBtn.disabled = true

        try {
            await account.createEmailPasswordSession(email, password)
            const user = await account.get()
            showDashboard(container, user)
        } catch (err) {
            msg.className = "auth-message error"
            msg.textContent = "Accesso negato. Riprova, viandante."
            submitBtn.disabled = false
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
