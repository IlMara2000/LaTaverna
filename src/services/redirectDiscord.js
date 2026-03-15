// src/services/redirectDiscord.js
import { account } from './appwrite.js';

/**
 * Gestisce il ritorno dal redirect di Discord OAuth2.
 * Pulisce l'URL dai parametri tecnici per mantenere l'interfaccia pulita.
 */
export async function setupDiscordRedirect(container) {
    const urlParams = new URLSearchParams(window.location.search);
    const secret = urlParams.get('secret');
    const userId = urlParams.get('userId');

    // Se mancano i parametri di Appwrite/Discord, non fare nulla
    if (!secret || !userId) return;

    try {
        // Mostriamo un feedback visivo nel container mentre il sistema valida l'accesso
        const statusOverlay = document.createElement('div');
        statusOverlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(15, 6, 23, 0.9);
            backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
            display: flex; align-items: center; justify-content: center;
            color: #a953ec; font-weight: 800; letter-spacing: 2px;
        `;
        statusOverlay.innerHTML = "SINCRO DISCORD IN CORSO...";
        document.body.appendChild(statusOverlay);

        // Appwrite gestisce automaticamente il completamento della sessione 
        // se i parametri secret e userId sono presenti nell'URL.
        // Verifichiamo semplicemente se l'utente è ora loggato.
        const user = await account.get();
        
        if (user) {
            console.log("⚔️ Accesso Discord completato per:", user.name);
            
            // Pulizia URL: Rimuove i parametri sensibili dalla barra degli indirizzi
            window.history.replaceState({}, document.title, window.location.origin);
            
            // Ricarichiamo la pagina per far sì che main.js porti l'utente in Dashboard
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
    } catch (err) {
        console.error("Errore durante il redirect Discord:", err);
        // In caso di errore, puliamo comunque l'URL per evitare loop
        window.history.replaceState({}, document.title, window.location.origin);
    }
}
