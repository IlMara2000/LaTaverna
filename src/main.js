import './style.css'
import { showLogin } from './ui/login.js'
import { showDashboard } from './ui/dashboard.js'
import { setupDiscordRedirect } from './services/redirectDiscord.js'
import { account } from './services/appwrite.js'

const uiContainer = document.getElementById('ui')

async function initApp() {
    if (!uiContainer) return;

    try { await setupDiscordRedirect(uiContainer) } catch (e) {}

    let user = null;
    try { user = await account.get() } catch (err) {}

    uiContainer.innerHTML = `
        <div class="landing-container" id="entry-screen">
            <div id="enter-portal" style="cursor: pointer; text-align:center;">
                <img src="/assets/logo.png" class="landing-logo">
                <p class="landing-title">Tocca la Coppa per Entrare!</p>
            </div>
        </div>
        <div id="content-overlay" style="display:none; opacity:0; width:100%; height:100%;"></div>
    `;

    const portal = document.getElementById('enter-portal');
    const overlay = document.getElementById('content-overlay');

    portal.onclick = () => {
        document.getElementById('entry-screen').style.display = 'none';
        overlay.style.display = 'flex';
        overlay.style.opacity = '1';
        if (user) showDashboard(overlay, user);
        else showLogin(overlay);
    };
}
initApp();
