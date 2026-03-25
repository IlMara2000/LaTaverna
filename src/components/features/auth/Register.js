import { supabase } from '../../services/supabase.js';
import { showDashboard } from './Dashboard.js';

export function showRegister(container) {
    container.innerHTML = `
    <div class="auth-wrapper" style="display: flex; align-items: center; justify-content: center; min-height: 80vh; padding: 20px;">
        <div class="glass-box" style="width: 100%; max-width: 380px; padding: 40px 30px;">
            <h2 style="text-align: center; margin-bottom: 30px; letter-spacing: 2px; font-weight: 900;">CREA PROFILO</h2>
            
            <div id="reg-msg" style="margin-bottom:20px; font-size:11px; text-align:center; min-height:15px; text-transform: uppercase; letter-spacing: 1px;"></div>

            <form id="register-form" style="display: flex; flex-direction: column; gap: 15px;">
                <input type="text" id="reg-username" placeholder="Nome Viandante" required class="auth-input">
                <input type="email" id="reg-email" placeholder="Email" required class="auth-input">
                <input type="password" id="reg-password" placeholder="Password (min. 6)" required minlength="6" class="auth-input">
                
                <div style="display:flex; align-items:center; gap:12px; margin: 10px 0; font-size:12px; opacity:0.8; cursor:pointer;">
                    <input type="checkbox" id="gdpr-check" style="width:18px; height:18px; cursor:pointer; accent-color: var(--amethyst-bright);">
                    <label for="gdpr-check" style="cursor:pointer;">Accetto i Termini della Taverna</label>
                </div>

                <button type="submit" class="btn-primary" id="reg-submit" disabled style="opacity:0.5; margin-top: 10px;">
                    EVOCA IL TUO NOME
                </button>
            </form>

            <div style="text-align:center; margin-top:30px; font-size:13px; opacity:0.6;">
                Hai già un account? <span id="toLogin" style="color:var(--amethyst-bright); cursor:pointer; font-weight:bold; text-decoration: underline;">Torna al login</span>
            </div>
        </div>
    </div>`;

    const form = container.querySelector('#register-form');
    const msg = container.querySelector('#reg-msg');
    const checkbox = container.querySelector('#gdpr-check');
    const submitBtn = container.querySelector('#reg-submit');

    // Abilita/Disabilita il bottone in base al checkbox
    checkbox.onchange = () => {
        submitBtn.disabled = !checkbox.checked;
        submitBtn.style.opacity = checkbox.checked ? "1" : "0.5";
        submitBtn.style.transform = checkbox.checked ? "scale(1)" : "scale(0.98)";
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const username = container.querySelector('#reg-username').value.trim();
        const email = container.querySelector('#reg-email').value.trim();
        const password = container.querySelector('#reg-password').value;

        msg.textContent = "🔮 Intrecciando il destino...";
        msg.style.color = "var(--amethyst-bright)";
        submitBtn.disabled = true;
        submitBtn.style.opacity = "0.5";

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { 
                    data: { full_name: username },
                    emailRedirectTo: window.location.origin 
                }
            });

            if (error) throw error;

            // Se l'utente è loggato immediatamente (email confirmation off)
            if (data?.session) {
                container.style.opacity = "0";
                setTimeout(() => {
                    container.innerHTML = ""; 
                    container.style.opacity = "1";
                    showDashboard(container, data.user);
                }, 300);
            } else {
                // Messaggio di conferma inviata
                msg.textContent = "📜 Pergamena inviata! Conferma l'email.";
                msg.style.color = "#00ff00";
                form.style.display = "none";
            }
        } catch (err) {
            console.error("Errore Registrazione:", err.message);
            msg.textContent = err.message;
            msg.style.color = "var(--error-red)";
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
        }
    };

    // Torna al Login con import dinamico
    container.querySelector('#toLogin').onclick = async () => {
        const { showLogin } = await import('./Login.js');
        showLogin(container);
    };
}