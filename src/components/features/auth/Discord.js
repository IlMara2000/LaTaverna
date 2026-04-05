import { supabase } from '../../../services/supabase.js';

/**
 * Gestisce l'invio dell'utente al portale Discord OAuth
 */
export function initDiscord() {
    const btn = document.getElementById('login-discord'); // ID aggiornato per coerenza con Login.js
    if (!btn) return;

    btn.onclick = async () => {
        // Feedback immediato sul tasto
        btn.innerHTML = `<span style="opacity:0.6">COLLEGAMENTO...</span>`;
        
        console.log("👾 Reindirizzamento al portale Discord...");
        
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { 
                redirectTo: window.location.origin 
            }
        });

        if (error) {
            console.error("Errore Discord OAuth:", error.message);
            alert("Errore di connessione a Discord. Riprova.");
            window.location.reload();
        }
    };
}

/**
 * Gestisce l'overlay di "Sincronizzazione" al ritorno da Discord
 * Centratura perfetta PC/Mobile garantita
 */
export async function setupDiscordRedirect(container) {
    const isAuthRedirect = window.location.hash.includes('access_token=') || 
                          window.location.search.includes('code=');

    if (!isAuthRedirect) return;

    let statusOverlay;

    try {
        // Creazione overlay blindato e centrato
        statusOverlay = document.createElement('div');
        statusOverlay.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: #05010a; /* Sfondo solido per evitare flash */
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 20px;
            box-sizing: border-box;
            font-family: 'Poppins', sans-serif;
            transition: opacity 0.6s ease;
        `;

        statusOverlay.innerHTML = `
            <div style="width: 100%; max-width: 300px; display: flex; flex-direction: column; align-items: center;">
                <div style="font-size: 60px; margin-bottom: 20px; filter: drop-shadow(0 0 15px #9d4ede); animation: pulse 1.5s infinite ease-in-out;">👾</div>
                
                <h2 style="color: white; font-family: 'Montserrat', sans-serif; font-weight: 900; letter-spacing: 2px; margin: 0; font-size: 1.2rem; text-transform: uppercase;">
                    SINCRO <span style="color: #9d4ede;">DISCORD</span>
                </h2>
                
                <p style="color: rgba(255,255,255,0.4); font-size: 10px; letter-spacing: 3px; margin-top: 15px; text-transform: uppercase; font-weight: 700;">
                    Recuperando i tuoi dati...
                </p>

                <div style="width: 120px; height: 3px; background: rgba(255,255,255,0.1); border-radius: 10px; margin-top: 25px; overflow: hidden;">
                    <div id="loader-bar" style="width: 30%; height: 100%; background: #9d4ede; border-radius: 10px; transition: width 2s ease-in-out;"></div>
                </div>
            </div>
        `;

        document.body.appendChild(statusOverlay);

        // Avvia l'animazione della barra
        setTimeout(() => {
            const bar = document.getElementById('loader-bar');
            if(bar) bar.style.width = '100%';
        }, 100);

        // Recupero utente da Supabase
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (user) {
            // Pulisce l'URL dai token fastidiosi
            window.history.replaceState({}, document.title, window.location.origin);
            
            setTimeout(() => {
                statusOverlay.style.opacity = "0";
                setTimeout(() => {
                    statusOverlay.remove();
                    window.location.reload(); // Carica l'app con l'utente loggato
                }, 600);
            }, 1200);
        }

    } catch (err) {
        console.error("Errore rito Discord:", err);
        if (statusOverlay) {
            statusOverlay.innerHTML = `
                <div style="color: #ff4444; font-weight: 900; font-family: 'Montserrat';">
                    <div style="font-size: 40px; margin-bottom: 20px;">💀</div>
                    RITO FALLITO
                    <p style="color: white; font-size: 12px; margin-top: 10px; opacity: 0.6; font-family: 'Poppins';">
                        ${err.message}
                    </p>
                    <button onclick="window.location.href='/'" style="background: white; border: none; padding: 10px 20px; border-radius: 50px; margin-top: 20px; font-weight: 800; cursor: pointer;">RIPROVA</button>
                </div>
            `;
        }
    }
}