import { account } from './appwrite.js'

/**
 * Gestisce il ritorno dal redirect OAuth Discord
 */
export async function setupDiscordRedirect(container) {
    const urlParams = new URLSearchParams(window.location.search)
    const secret = urlParams.get('secret')
    const userId = urlParams.get('userId')

    // Se non ci sono i parametri di Appwrite, usciamo subito
    if (!secret || !userId) return

    let statusOverlay

    try {
        // Creazione Overlay di attesa (Stile Taverna)
        statusOverlay = document.createElement('div')
        statusOverlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10000;
            background: rgba(15, 6, 23, 0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--accent);
            text-align: center;
            padding: 20px;
        `

        statusOverlay.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 20px;">👾</div>
            <div style="font-weight: 900; letter-spacing: 3px; font-size: 16px; text-transform: uppercase;">
                Sincro Discord in corso...
            </div>
            <div style="margin-top: 15px; font-size: 12px; opacity: 0.6;">Stiamo aprendo il portale magico</div>
        `

        document.body.appendChild(statusOverlay)

        /**
         * Verifichiamo la sessione. Appwrite riconosce secret/userId 
         * nell'URL e valida la sessione automaticamente al primo get()
         */
        const user = await account.get()

        if (user) {
            console.log("⚔️ Accesso Discord completato per:", user.name)

            /**
             * Pulizia URL: rimuove i parametri sensibili dalla barra degli indirizzi
             */
            window.history.replaceState(
                {},
                document.title,
                window.location.origin
            )

            // Feedback di successo e rimozione overlay
            setTimeout(() => {
                if (statusOverlay) {
                    statusOverlay.style.transition = "opacity 0.5s ease"
                    statusOverlay.style.opacity = "0"
                    setTimeout(() => statusOverlay.remove(), 500)
                }
            }, 800)
        }

    } catch (err) {
        console.error("Errore durante il redirect Discord:", err)

        // Pulizia URL anche in caso di errore
        window.history.replaceState(
            {},
            document.title,
            window.location.origin
        )

        if (statusOverlay) {
            statusOverlay.innerHTML = `
                <div style="font-size: 40px; margin-bottom: 20px;">❌</div>
                <div style="color: #ff4444; font-weight: bold;">Rito di Accesso Fallito</div>
                <button onclick="window.location.reload()" class="btn-primary" style="margin-top:20px; padding: 10px 20px;">RIPROVA</button>
            `
            // Non rimuoviamo l'overlay subito così l'utente legge l'errore
            setTimeout(() => { if (statusOverlay) statusOverlay.remove() }, 3000)
        }
    }
}