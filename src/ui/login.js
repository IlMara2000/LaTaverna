export function showLogin(container) {
    container.innerHTML = `
    <div class="auth-card">
        <h2 class="auth-title">ACCEDI</h2>
        <div id="login-msg" style="height:20px; font-size:12px; margin-bottom:10px;"></div>

        <form id="login-form" style="display:flex; flex-direction:column; gap:15px;">
            <input type="email" id="email" placeholder="Email" required>
            <input type="password" id="password" placeholder="Password" required>
            
            <label style="display:flex; align-items:center; gap:10px; font-size:11px; color:var(--text-pink); cursor:pointer; text-align:left;">
                <input type="checkbox" required style="width:16px; height:16px;">
                Accetto il trattamento dei dati (GDPR)
            </label>

            <button type="submit" class="btn-primary">ENTRA NELLA TAVERNA</button>
        </form>

        <button type="button" id="discord-login" class="discord-btn" style="margin-top:10px;">
            LOGIN CON DISCORD
        </button>

        <p style="font-size:13px; margin-top:15px;">
            Nuovo viandante? <span id="toRegister" class="auth-link">Registrati qui</span>
        </p>
    </div>
    `;
    // ... resto della logica (onsubmit, toRegister, etc.) uguale a prima ...
}
