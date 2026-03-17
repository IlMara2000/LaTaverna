import { account } from './appwrite.js'

export async function setupDiscordRedirect(container) {
    const urlParams = new URLSearchParams(window.location.search)
    const secret = urlParams.get('secret')
    const userId = urlParams.get('userId')

    if (!secret || !userId) return

    let statusOverlay = document.createElement('div')
    statusOverlay.style.cssText = `
        position: fixed; inset: 0; z-index: 10000;
        background: #0a0e17; /* --bg-deep */
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        color: #f062ff; /* --neon-glow */
        text-align: center; font-family: 'Inter', sans-serif;
    `

    statusOverlay.innerHTML = `
        <div style="font-size: 50px; margin-bottom: 20px; filter: drop-shadow(0 0 15px #f062ff);">👾</div>
        <div style="font-weight: 900; letter-spacing: 3px; font-size: 14px; text-transform: uppercase;">
            Sincronia Magica...
        </div>
        <div style="margin-top: 10px; font-size: 11px; opacity: 0.6; letter-spacing: 1px;">
            L'OSTE TI STA FACENDO SPAZIO SUL BANCONE
        </div>
    `
    document.body.appendChild(statusOverlay)

    try {
        // Appwrite convalida automaticamente userId e secret al primo get()
        const user = await account.get()

        if (user) {
            // Puliamo l'URL per estetica e sicurezza
            window.history.replaceState({}, document.title, window.location.origin)
            
            // Piccola pausa per far godere l'animazione e poi via
            setTimeout(() => {
                statusOverlay.style.transition = "opacity 0.6s ease"
                statusOverlay.style.opacity = "0"
                setTimeout(() => statusOverlay.remove(), 600)
            }, 1000)
        }
    } catch (err) {
        console.error("Errore Discord Redirect:", err)
        statusOverlay.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 20px;">❌</div>
            <div style="color: #ff4444; font-weight: bold;">PORTALE INSTABILE</div>
            <button onclick="window.location.href='/'" class="btn-primary" style="margin-top:20px;">RIPROVA</button>
        `
    }
}
