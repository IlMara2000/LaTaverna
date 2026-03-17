import { account, ID } from '../services/appwrite.js'
import { showDashboard } from './dashboard.js'

export function showRegister(container) {
    container.innerHTML = `
    <div class="auth-wrapper flex items-center justify-center min-h-screen bg-[#0a0e17]">
        <div class="auth-card bg-[#1a1f2e] p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/5 w-full max-w-md">
            <h2 class="auth-title text-2xl font-black text-center text-white mb-8 tracking-tighter uppercase">Crea il tuo profilo</h2>

            <div id="reg-msg" class="auth-message text-center text-xs mb-4 min-h-[20px]"></div>

            <form id="register-form" class="auth-form flex flex-col gap-4">
                <input 
                    type="text" 
                    id="reg-username" 
                    placeholder="Nome Viandante" 
                    class="bg-[#121620] border border-white/5 p-4 rounded-xl text-white outline-none focus:border-magenta/50 transition-all shadow-inner"
                    required 
                    autocomplete="username"
                >
                <input 
                    type="email" 
                    id="reg-email" 
                    placeholder="Email" 
                    class="bg-[#121620] border border-white/5 p-4 rounded-xl text-white outline-none focus:border-magenta/50 transition-all shadow-inner"
                    required 
                    autocomplete="email"
                >
                <input 
                    type="password" 
                    id="reg-password" 
                    placeholder="Password (min. 8 caratteri)" 
                    class="bg-[#121620] border border-white/5 p-4 rounded-xl text-white outline-none focus:border-magenta/50 transition-all shadow-inner"
                    required 
                    minlength="8" 
                    autocomplete="new-password"
                >
                <button type="submit" class="auth-submit py-4 rounded-xl font-black tracking-widest text-white transition-all active:scale-95 shadow-[0_0_25px_rgba(217,70,239,0.3)] hover:shadow-[0_0_35px_rgba(217,70,239,0.5)]"
                        style="background: linear-gradient(135deg, #d946ef 0%, #a855f7 100%)">
                    CREA PROFILO
                </button>
            </form>

            <div class="auth-footer text-center mt-8 text-sm text-gray-400">
                Hai già un account? 
                <span id="toLogin" class="text-white font-bold cursor-pointer hover:underline decoration-magenta underline-offset-4 font-bold">Torna al login</span>
            </div>
        </div>
    </div>
    `

    const form = container.querySelector('#register-form')
    const msg = container.querySelector('#reg-msg')
    const submitBtn = container.querySelector('.auth-submit')

    form.onsubmit = async (e) => {
        e.preventDefault()
        const username = container.querySelector('#reg-username').value.trim()
        const email = container.querySelector('#reg-email').value.trim()
        const password = container.querySelector('#reg-password').value

        msg.style.color = "#d946ef"
        msg.textContent = "🔮 Intrecciando il tuo destino..."
        submitBtn.disabled = true

        try {
            await account.create(ID.unique(), email, password, username)
            await account.createEmailPasswordSession(email, password)
            const user = await account.get()
            showDashboard(container, user)
        } catch (err) {
            msg.style.color = "#ef4444"
            msg.textContent = err.type === 'user_already_exists' ? "Email già registrata." : "Errore durante il rito.";
            submitBtn.disabled = false
        }
    }

    container.querySelector('#toLogin').onclick = async () => {
        const { showLogin } = await import('./login.js')
        showLogin(container)
    }
}