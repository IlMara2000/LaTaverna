import './style.css'
import { showLogin } from './ui/login.js'
import { account } from './services/appwrite.js'

const ui = document.getElementById('ui');

async function init() {
    ui.innerHTML = `
        <div class="landing-no-box" id="portal" style="cursor:pointer;">
            <img src="/assets/logo.png" style="width:220px; filter: drop-shadow(0 0 15px var(--neon-glow));">
            <h2 class="auth-title" style="font-size:1rem; letter-spacing:2px; animation: pulse 2s infinite;">
                Tocca la Coppa per Entrare
            </h2>
        </div>
    `;

    document.getElementById('portal').onclick = () => showLogin(ui);
}
init();
