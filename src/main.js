// src/main.js
import './style.css'
import { showLogin } from './ui/login.js'
import { showDashboard } from './ui/dashboard.js'
import { setupDiscordRedirect } from './services/redirectDiscord.js'
import { account } from './services/appwrite.js'

window.onerror = function(message, source, lineno) {
    console.error(`Taverna Bug: ${message} @ ${source}:${lineno}`);
};

const uiContainer = document.getElementById('ui')

async function initApp() {
    if (!uiContainer) return;

    // 1. GESTIONE DISCORD
    try {
        await setupDiscordRedirect(uiContainer)
    } catch (e) {
        console.warn("Discord redirect non necessario.");
    }

    // 2. CONTROLLO SESSIONE
    let user = null
    try {
        user = await account.get()
    } catch (err) {
        console.log("Nessun viandante loggato.");
    }

    // 3. SCHERMATA PORTALE (Sintassi Fixata)
    uiContainer.innerHTML = `
        <div class="landing-container" id="entry-screen">
            <div class="main-logo-wrapper" id="enter-portal" style="cursor: pointer;">
                <img src="/assets/logo.png" 
                     alt="La Taverna" 
                     class="landing-logo" 
                     id="main-logo"
                     onerror="this.src='https://via.placeholder.com/150?text=Taverna';">
            </div>
            <p class="landing-title" id="tap-text">Tocca la Coppa per Entrare!</p>
        </div>
        <div id="content-overlay" style="display:none; opacity:0; width:100%; height:100%;"></div>
    `;

    const entryScreen = document.getElementById('entry-screen')
    const portal = document.getElementById('enter-portal')
    const tapText = document.getElementById('tap-text')
    const contentOverlay = document.getElementById('content-overlay')

    if (portal) {
        const startTransition = async () => {
            portal.style.pointerEvents = 'none'
            if(tapText) tapText.style.pointerEvents = 'none'

            entryScreen.style.transition = 'opacity 0.6s ease, transform 0.6s ease'
            entryScreen.style.opacity = '0'
            entryScreen.style.transform = 'scale(0.92)'

            setTimeout(() => {
                entryScreen.style.display = 'none'
                contentOverlay.style.display = 'flex'
                contentOverlay.style.alignItems = 'center'
                contentOverlay.style.justifyContent = 'center'

                if (user && user.$id) {
                    showDashboard(contentOverlay, user)
                } else {
                    showLogin(contentOverlay)
                }

                setTimeout(() => {
                    contentOverlay.style.transition = 'opacity 0.6s ease'
                    contentOverlay.style.opacity = '1'
                }, 50)
            }, 600)
        }

        portal.onclick = startTransition
        if(tapText) tapText.onclick = startTransition
    }
}

initApp().catch(err => {
    console.error("Errore fatale:", err)
    if(uiContainer) uiContainer.innerHTML = `<div class="auth-card"><p style="color:#d946ef;">Il portale della Taverna è chiuso.</p></div>`;
})
