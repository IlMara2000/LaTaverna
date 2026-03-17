import { account, ID } from '../services/appwrite.js';

export function showRegister(container) {
    container.innerHTML = `
        <div class="glass-box" style="width:90%; max-width:400px; margin: 40px auto; padding: 35px 25px;">
            <h2 style="text-align:center; margin-bottom:30px; font-weight:900; font-size: 2rem; letter-spacing: -1px;">REGISTRATI</h2>
            
            <div id="reg-msg" style="margin-bottom:20px; text-align:center; font-size:14px; font-weight:600; min-height:20px;"></div>
            
            <form id="register-form">
                <div style="margin-bottom:15px;">
                    <input type="text" id="reg-username" placeholder="Nome Viandante" required>
                </div>
                <div style="margin-bottom:15px;">
                    <input type="email" id="reg-email" placeholder="Email" required>
                </div>
                <div style="margin-bottom:25px;">
                    <input type="password" id="reg-password" placeholder="Password (min. 8)" required minlength="8">
                </div>
                <button type="submit" class="btn-primary">CREA PROFILO</button>
            </form>
            
            <div style="text-align:center; margin-top:35px; font-size:14px; color:rgba(255,255,255,0.6);">
                Hai già un account? <span id="toLogin" style="color:var(--accent); cursor:pointer; font-weight:800;">Torna al Login</span>
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
        msg.textContent = "🔮 Intrecciando il tuo destino...";

        try {
            await account.create(ID.unique(), email, password, username);
            await account.createEmailPasswordSession(email, password);
            window.location.reload(); 
        } catch (err) {
            console.error("Reg fail:", err);
            msg.style.color = "#ff4444";
            msg.textContent = "Errore durante il rito di registrazione.";
        }
    };

    container.querySelector('#toLogin').onclick = async () => {
        const { showLogin } = await import('./login.js');
        showLogin(container);
    };
}
