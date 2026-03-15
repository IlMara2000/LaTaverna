import { account } from '../services/appwrite.js';
import { showDashboard } from './dashboard.js';

export function showLogin(container) {
    document.title = "LaTaverna - Accesso";
    
    container.innerHTML = `
        <div class="glass-box">
            <h2 style="text-align:center; margin-bottom:25px; letter-spacing:3px; font-weight:900;">ACCEDI</h2>
            
            <div id="login-msg" style="margin-bottom:15px; font-size:14px; min-height:22px; text-align:center; font-weight:600;"></div>
            
            <form id="login-form">
                <div class="form-group" style="margin-bottom:15px;">
                    <input type="email" id="email" placeholder="Email" required autocomplete="email" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--accent); background:rgba(0,0,0,0.2); color:white;" />
                </div>
                <div class="form-group" style="margin-bottom:20px;">
                    <input type="password" id="password" placeholder="Password" required autocomplete="current-password" style="width:100%; padding:12px; border-radius:8px; border:1px solid var(--accent); background:rgba(0,0,0,0.2); color:white;" />
                </div>
                
                <button type="submit" class="btn-primary" id="login-submit" style="width:100%;">ENTRA NELLA TAVERNA</button>
            </form>
            
            <div style="text-align:center; margin: 20px 0; color: rgba(255,255,255,0.4); font-size: 11px; letter-spacing:2px;">OPPURE</div>
            
            <button id="discord-login" style="width:100%; padding:16px; background:#5865F2; border:none; border-radius:12px; color:white; font-weight:800; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:10px;">
                <span style="font-size:1.2rem;">👾</span> LOGIN CON DISCORD
            </button>
            
            <div style="text-align:center; margin-top:30px; font-size:14px; color:#ccc;">
                Nuovo viandante? <span id="toRegister" style="color:#a953ec; cursor:pointer; font-weight:bold; margin-left:5px;">Registrati qui</span>
            </div>
        </div>
    `;

    const msg = container.querySelector('#login-msg');
    const form = container.querySelector('#login-form');
    const btn = container.querySelector('#login-submit');

    // LOGICA EMAIL/PASSWORD
    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = container.querySelector('#email').value.trim();
        const password = container.querySelector('#password').value;

        msg.style.color = "#a953ec";
        msg.textContent = "Evocazione in corso...";
        btn.disabled = true;
        btn.style.opacity = "0.5";

        try {
            await account.createEmailPasswordSession(email, password);
            const user = await account.get();
            
            msg.style.color = "#00ff88";
            msg.textContent = "Accesso autorizzato!";
            
            setTimeout(() => showDashboard(container, user), 800);
        } catch (err) {
            btn.disabled = false;
            btn.style.opacity = "1";
            msg.style.color = "#ff4444";
            
            if (err.message.includes('credentials')) {
                msg.textContent = "Email o password errate.";
            } else {
                msg.textContent = "Errore: " + err.message;
            }
        }
    };

    // LOGICA DISCORD
    container.querySelector('#discord-login').onclick = () => {
        // Usa location.href per evitare problemi con i percorsi
        const redirect = window.location.href; 
        account.createOAuth2Session('discord', redirect, redirect);
    };

    // VAI ALLA REGISTRAZIONE
    container.querySelector('#toRegister').onclick = async () => {
        const { showRegister } = await import('./register.js');
        showRegister(container);
    };
}
