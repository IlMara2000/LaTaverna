import { supabase } from './supabase.js';

/**
 * Gestisce il ritorno dal redirect OAuth Discord per Supabase
 */
export async function setupDiscordRedirect(container) {
    // Supabase gestisce i token nell'URL (frammenti # o query) automaticamente.
    // Verifichiamo se siamo appena tornati da un login Discord.
    const isAuthRedirect = window.location.hash.includes('access_token=') || 
                          window.location.search.includes('code=');

    if (!isAuthRedirect) return;

    let statusOverlay;

    try {
        // --- 1. OVERLAY DI ATTESA (Stile Taverna Preservato) ---
        statusOverlay = document.createElement('div');
        statusOverlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10000;
            background: rgba(5, 2, 10, 0.98); /* Nuovo Void Black */
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--amethyst-bright);
            text-align: center;
            padding: 20px;
            font-family: 'Inter', sans-serif;
        `;

        statusOverlay.innerHTML = `
            <div style="font-size: 60px; margin-bottom: 25px; filter: drop-shadow(0 0 15px var(--amethyst-glow));">👾</div>
            <div style="font-weight: 900; letter-spacing: 4px; font-size: 14px; text-transform: uppercase; color: white;">
                Sincro Discord in corso...
            </div>
            <div style="margin-top: 15px; font-size: 11px; opacity: 0.5; letter-spacing: 1px;">STIAMO APRENDO IL PORTALE MAGICO</div>
        `;

        document.body.appendChild(statusOverlay);

        // --- 2. VERIFICA SESSIONE SUPABASE ---
        // getUser() recupera l'utente corrente processando i token nell'URL
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error) throw error;

        if (user) {
            console.log("⚔️ Accesso Discord completato per:", user.email);

            // --- 3. PULIZIA URL ---
            // Rimuove i token di accesso dalla barra degli indirizzi per sicurezza
            window.history.replaceState(
                {},
                document.title,
                window.location.origin
            );

            // Feedback di successo e transizione
            setTimeout(() => {
                if (statusOverlay) {
                    statusOverlay.style.transition = "opacity 0.8s ease, transform 0.8s ease";
                    statusOverlay.style.opacity = "0";
                    statusOverlay.style.transform = "scale(1.1)";
                    setTimeout(() => {
                        statusOverlay.remove();
                        // Ricarichiamo la pagina per attivare la Dashboard nel main.js
                        window.location.reload();
                    }, 800);
                }
            }, 1000);
        }

    } catch (err) {
        console.error("Errore durante il rito Discord:", err);

        if (statusOverlay) {
            statusOverlay.innerHTML = `
                <div style="font-size: 40px; margin-bottom: 20px;">❌</div>
                <div style="color: var(--error-red); font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Rito di Accesso Fallito</div>
                <p style="font-size: 10px; opacity: 0.6; margin-top: 10px;">${err.message}</p>
                <button onclick="window.location.href='/'" class="btn-primary" style="margin-top:30px; padding: 15px 30px; font-size: 12px;">TORNA ALL'INGRESSO</button>
            `;
        }
    }
}