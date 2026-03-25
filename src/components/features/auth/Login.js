import { supabase } from '../../services/supabase.js';
import { showDashboard } from './Dashboard.js';

export function showLogin(container) {
    container.innerHTML = `
    <div class="auth-wrapper" style="display: flex; align-items: center; justify-content: center; min-height: 80vh; padding: 20px;">
        <div class="glass-box" style="width: 100%; max-width: 380px; padding: 40px 30px;">
            <h2 style="text-align: center; margin-bottom: 30px; letter-spacing: 2px; font-weight: 900;">ACCEDI ALLA TAVERNA</h2>
            
            <div id="login-msg" style="margin-bottom:20px; font-size:11px; text-align:center; min-height:15px; text-transform: uppercase; letter-spacing: 1px;"></div>

            <form id="login-form" style="display: flex; flex-direction: column; gap: 15px;">
                <input type="email" id="login-email" placeholder="Email" required autocomplete="email" class="auth-input">
                <input type="password" id="login-password" placeholder="Password" required autocomplete="current-password" class="auth-input">
                <button type="submit" id="btn-login-submit" class="btn-primary" style="margin-top: 10px;">ENTRA</button>
            </form>

            <div style="margin: 25px 0; display: flex; align-items: center; gap: 10px; opacity: 0.3;">
                <hr style="flex-grow:1; border: 0.5px solid var(--amethyst-bright);">
                <span style="font-size: 10px;">OPPURE</span>
                <hr style="flex-grow:1; border: 0.5px solid var(--amethyst-bright);">
            </div>

            <button id="discord-login" class="btn-primary" style="background:#5865F2; border:none; width:100%; display:flex; align-items:center; justify-content:center; gap:12px; box-shadow: 0 4px 15px rgba(88, 101, 242, 0.4);">
                <span style="font-size: 20px;">👾</span> ACCEDI CON DISCORD
            </button>

            <div style="text-align:center; margin-top:30px; font-size:13px; opacity:0.6;">
                Nuovo viandante? <span id="toRegister" style="color:var(--amethyst-bright); cursor:pointer; font-weight:bold; text-decoration: underline;">Registrati qui</span>
            </div>
        </div>
    </div>`;

    const form = container.querySelector('#login-form');
    const msg = container.querySelector('#login-msg');
    const submitBtn = container.querySelector('#btn-login-submit');

    // --- LOGIN EMAIL/PASSWORD ---
    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = container.querySelector('#login-email').value.trim();
        const password = container.querySelector('#login-password').value;

        msg.textContent = "⚡ Verificando il portale...";
        msg.style.color = "var(--amethyst-bright)";
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.5";

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;

            // Transizione fluida alla Dashboard
            container.style.opacity = "0";
            setTimeout(() => {
                container.innerHTML = ""; 
                container.style.opacity = "1";
                showDashboard(container, data.user);
            }, 300);

        } catch (err) {
            console.error("Errore Login:", err.message);
            msg.textContent = "Credenziali errate o portale sigillato.";
            msg.style.color = "var(--error-red)";
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
        }
    };

    // --- DISCORD LOGIN ---
    container.querySelector('#discord-login').onclick = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { 
                redirectTo: window.location.origin 
            }
        });
        if (error) alert("Errore Discord: " + error.message);
    };

    // --- NAVIGAZIONE A REGISTER ---
    container.querySelector('#toRegister').onclick = async () => {
        const { showRegister } = await import('./Register.js');
        showRegister(container);
    };
}