import './style.css'
import { showLogin } from './ui/login.js'
import { account } from './services/appwrite.js'
import { showDashboard } from './ui/dashboard.js'
import { setupDiscordRedirect } from './services/redirectDiscord.js'

const ui = document.getElementById('ui');

async function init() {
    // Gestione redirect Discord
    await setupDiscordRedirect(ui);

    try {
        const user = await account.get();
        if (user) {
            showDashboard(ui, user);
        }
    } catch {
        ui.innerHTML = `
            <div class="landing-container" id="portal" style="cursor:pointer;">
                <img src="/assets/logo.png" class="landing-logo">
                <h2 class="landing-text" style="animation: pulse 2s infinite;">
                    Tocca la Coppa per Entrare
                </h2>
            </div>
        `;
        document.getElementById('portal').onclick = () => showLogin(ui);
    }
}
init();
