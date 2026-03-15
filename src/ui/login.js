import { account } from '../services/appwrite.js';
import { showDashboard } from './dashboard.js';

export function showLogin(container) {
    container.innerHTML = `
        <div class="glass-box">
            <h2 style="text-align:center; margin-bottom:25px; font-weight:900;">ACCEDI</h2>
            <div id="login-msg" style="margin-bottom:15px; text-align:center; font-weight:600; min-height:20px;"></div>
            
            <form id="login-form">
                <input type="email" id="email" placeholder="Email" required style="width:100%; padding:14px; margin-bottom:15px; border-radius:12px; border:1px solid var(--accent); background:rgba(0,0,0,0.3); color:white;" />
                <input type="password" id="password" placeholder="Password" required style="width:100%; padding:14px; margin-bottom:20px; border-radius:12px; border:1px solid var(--accent); background:rgba(0,0,0,0.3); color:white;" />
                <button type="submit" class="btn-primary" id="login-submit" style="width:100%;">ENTRA NELLA TAVERNA</button>
            </form>

            <div style="text-align:center; margin: 20px 0; opacity:0.3; font-size:10px; letter-spacing:2px;">OPPURE</div>
            
            <button type="button" id="discord-login" style="width:100%; padding:16px; background:#5865F2; border:none; border-radius:14px; color:white; font-weight:800; cursor:pointer;">👾 LOGIN CON DISCORD</button>
            
            <div style="text-align:center; margin-top:30px; font-size:14px; color:#aaa;">
                Nuovo viandante? <span id="toRegister" style="color:#a953ec; cursor:pointer; font-weight:bold; text-decoration:underline;">Registrati qui</span>
            </div>
        </div>
    `;

    const form = container.querySelector('#login-form');
    const msg = container.querySelector('#login-msg');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = container.querySelector('#email').value.trim();
        const password = container.querySelector('#password').value;
        
        msg.style.color = "var(--accent)";
        msg.textContent = "Verifica account...";

        try {
            await account.createEmailPasswordSession(email, password);
            const user = await account.get();
            showDashboard(container, user);
        } catch (err) {
            console.error("Login fail:", err);
            msg.style.color = "#ff4444";
            msg.textContent = err.message.includes('network') ? "Errore di connessione" : "Credenziali errate";
        }
    };

    container.querySelector('#discord-login').onclick = () => {
        // Forza l'URL assoluto per evitare il 404 del video
        const origin = window.location.origin;
        account.createOAuth2Session('discord', origin, origin);
    };

    container.querySelector('#toRegister').onclick = async () => {
        const { showRegister } = await import('./register.js');
        showRegister(container);
    };
}
