import { account, ID } from '../services/appwrite.js';

export function showRegister(container) {
    container.innerHTML = `
        <div class="glass-box">
            <h2 style="text-align:center; margin-bottom:25px; font-weight:900;">REGISTRATI</h2>
            <div id="reg-msg" style="margin-bottom:15px; text-align:center; font-weight:600; min-height:20px;"></div>
            
            <form id="register-form">
                <input type="text" id="reg-username" placeholder="Username" required style="width:100%; padding:14px; margin-bottom:15px; border-radius:12px; border:1px solid var(--accent); background:rgba(0,0,0,0.3); color:white;" />
                <input type="email" id="reg-email" placeholder="Email" required style="width:100%; padding:14px; margin-bottom:15px; border-radius:12px; border:1px solid var(--accent); background:rgba(0,0,0,0.3); color:white;" />
                <input type="password" id="reg-password" placeholder="Password (min. 8)" required minlength="8" style="width:100%; padding:14px; margin-bottom:20px; border-radius:12px; border:1px solid var(--accent); background:rgba(0,0,0,0.3); color:white;" />
                <button type="submit" class="btn-primary" id="reg-submit" style="width:100%;">CREA PROFILO</button>
            </form>
            
            <div style="text-align:center; margin-top:30px; font-size:14px;">
                Hai già un account? <span id="toLogin" style="color:#a953ec; cursor:pointer; font-weight:bold;">Torna al Login</span>
            </div>
        </div>
    `;

    const form = container.querySelector('#register-form');
    const msg = container.querySelector('#reg-msg');

    form.onsubmit = async (e) => {
        e.preventDefault();
        const username = container.querySelector('#reg-username').value.trim();
        const email = container.querySelector('#reg-email').value.trim();
        const password = container.querySelector('#reg-password').value;

        msg.style.color = "var(--accent)";
        msg.textContent = "Creazione in corso...";

        try {
            // Usa ID.unique() correttamente importato
            await account.create(ID.unique(), email, password, username);
            await account.createEmailPasswordSession(email, password);
            window.location.reload(); 
        } catch (err) {
            console.error("Reg fail:", err);
            msg.style.color = "#ff4444";
            msg.textContent = err.message;
        }
    };

    container.querySelector('#toLogin').onclick = async () => {
        const { showLogin } = await import('./login.js');
        showLogin(container);
    };
}
