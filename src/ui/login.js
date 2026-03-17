import { account } from '../services/appwrite.js'
import { showDashboard } from './dashboard.js'

export function showLogin(container) {
    container.innerHTML = `
    <div class="auth-wrapper flex items-center justify-center min-h-screen bg-[#0a0e17]">
        <div class="auth-card bg-[#1a1f2e] p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 w-full max-w-md">
            <h2 class="auth-title text-2xl font-black text-center text-white mb-8 tracking-tighter">ACCEDI ALLA TAVERNA</h2>

            <div id="login-msg" class="auth-message text-center text-xs mb-4 min-h-[20px]"></div>

            <form id="login-form" class="auth-form flex flex-col gap-4">
                <input 
                    type="email" 
                    id="email" 
                    placeholder="Email" 
                    class="bg-[#121620] border border-white/5 p-4 rounded-xl text-white outline-none focus:border-magenta/50 transition-all shadow-inner"
                    required 
                    autocomplete="email" 
                >
                <input 
                    type="password" 
                    id="password" 
                    placeholder="Password" 
                    class="bg-[#121620] border border-white/5 p-4 rounded-xl text-white outline-none focus:border-magenta/50 transition-all shadow-inner"
                    required 
                    autocomplete="current-password" 
                >
                <button type="submit" class="auth-submit py-4 rounded-xl font-black tracking-widest text-white transition-all active:scale-95 shadow-[0_0_25px_rgba(217,70,239,0.3)] hover:shadow-[0_0_35px_rgba(217,70,239,0.5)]"
                        style="background: linear-gradient(135deg, #d946ef 0%, #a855f7 100%)">
                    ENTRA NELLA TAVERNA
                </button>
            </form>

            <div class="auth-divider text-center text-[10px] text-white/30 my-6 font-bold tracking-[0.3em]">OPPURE</div>

            <button type="button" id="discord-login" class="w-full py-4 rounded-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                    style="background: #5865F2">
                <span>👾</span> LOGIN CON DISCORD
            </button>

            <div class="auth-footer text-center mt-8 text-sm text-gray-400">
                Nuovo viandante? 
                <span id="toRegister" class="text-white font-bold cursor-pointer hover:underline decoration-magenta underline-offset-4">Registrati qui</span>
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

        msg.style.color = "#d946ef"
        msg.textContent = "⚡ Verificando il portale..."
        submitBtn.disabled = true

        try {
            await account.createEmailPasswordSession(email, password)
            const user = await account.get()
            showDashboard(container, user)
        } catch (err) {
            msg.style.color = "#ef4444"
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