import { supabase } from '../../../services/supabase.js';

/**
 * Gestisce l'invio dell'utente a Discord
 */
export function initDiscord() {
    const btn = document.getElementById('discord-login');
    if (!btn) return;

    btn.onclick = async () => {
        console.log("👾 Reindirizzamento al portale Discord...");
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { 
                redirectTo: window.location.origin 
            }
        });
        if (error) console.error("Errore Discord OAuth:", error.message);
    };
}

/**
 * Gestisce il ritorno dal redirect OAuth Discord
 */
export async function setupDiscordRedirect(container) {
    const isAuthRedirect = window.location.hash.includes('access_token=') || 
                          window.location.search.includes('code=');

    if (!isAuthRedirect) return;

    let statusOverlay;

    try {
        statusOverlay = document.createElement('div');
        statusOverlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10000;
            background: rgba(5, 2, 10, 0.98);
            backdrop-filter: blur(20px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: var(--amethyst-bright);
            text-align: center;
            padding: 20px;
        `;

        statusOverlay.innerHTML = `
            <div style="font-size: 60px; margin-bottom: 25px; filter: drop-shadow(0 0 15px var(--amethyst-glow));">👾</div>
            <div style="font-weight: 900; letter-spacing: 4px; font-size: 14px; text-transform: uppercase; color: white;">
                Sincro Discord in corso...
            </div>
        `;

        document.body.appendChild(statusOverlay);

        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (user) {
            window.history.replaceState({}, document.title, window.location.origin);
            setTimeout(() => {
                statusOverlay.style.opacity = "0";
                setTimeout(() => {
                    statusOverlay.remove();
                    window.location.reload(); 
                }, 800);
            }, 1000);
        }

    } catch (err) {
        if (statusOverlay) {
            statusOverlay.innerHTML = `<div style="color:var(--error-red);">Rito Fallito: ${err.message}</div>`;
        }
    }
}