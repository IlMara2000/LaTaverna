import { supabase } from '../../../services/supabase.js';

export function initLogin(container) {
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 20px; background: #05020a;">
            <div class="glass-box" style="width: 100%; max-width: 400px; padding: 40px; text-align: center; border-radius: 28px; background: rgba(88, 101, 242, 0.05); border: 1px solid rgba(88, 101, 242, 0.2); backdrop-filter: blur(20px); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                
                <img src="/assets/logo.png" style="width: 80px; margin-bottom: 20px; filter: drop-shadow(0 0 10px #5865F2);">
                
                <h1 style="font-size: 1.8rem; font-weight: 900; color: white; margin-bottom: 10px; letter-spacing: -1px;">L'ACCESSO È RISERVATO</h1>
                <p style="font-size: 14px; opacity: 0.7; color: #8e9297; margin-bottom: 30px; line-height: 1.5;">
                    Per entrare nella Taverna devi far parte della nostra Gilda su Discord.
                </p>
                
                <button id="login-discord" style="width: 100%; padding: 18px; border-radius: 14px; font-weight: 800; cursor: pointer; background: #5865F2; border: none; color: white; display: flex; align-items: center; justify-content: center; gap: 12px; transition: 0.3s; font-size: 16px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.048-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.054-.108.001-.23-.106-.271a12.978 12.978 0 0 1-1.883-.898.079.079 0 0 1-.008-.131c.126-.094.252-.192.372-.29a.078.078 0 0 1 .082-.011c3.882 1.776 8.086 1.776 11.92 0a.078.078 0 0 1 .083.011c.12.098.246.196.373.29a.079.079 0 0 1-.007.131 12.83 12.83 0 0 1-1.883.898.077.077 0 0 1-.106.27c.353.7.764 1.364 1.226 1.995a.078.078 0 0 0 .084.028 19.83 19.83 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.947 2.419-2.157 2.419zm7.974 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/></svg>
                    ENTRA CON DISCORD
                </button>

                <p style="margin-top: 25px; font-size: 11px; opacity: 0.5; color: #fff;">
                    Loggandoti verrai reindirizzato a Discord per l'autorizzazione.
                </p>
            </div>
        </div>
    `;

    document.getElementById('login-discord').onclick = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: window.location.origin,
                scopes: 'identify email guilds' // Chiediamo l'accesso ai server (guilds)
            }
        });
        if (error) alert("Errore Discord: " + error.message);
    };
}