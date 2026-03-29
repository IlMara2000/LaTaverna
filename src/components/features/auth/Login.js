import { supabase } from '../../../services/supabase.js';

export function initLogin(container) {
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 20px; background: #05020a;">
            <div class="glass-box" style="width: 100%; max-width: 400px; padding: 40px; text-align: center; border-radius: 28px; background: rgba(88, 101, 242, 0.05); border: 1px solid rgba(88, 101, 242, 0.2); backdrop-filter: blur(20px);">
                <img src="/assets/logo.png" style="width: 80px; margin-bottom: 20px; filter: drop-shadow(0 0 10px #5865F2);">
                <h1 style="font-size: 1.8rem; font-weight: 900; color: white; margin-bottom: 10px;">L'ACCESSO È RISERVATO</h1>
                <p style="font-size: 14px; opacity: 0.7; color: #8e9297; margin-bottom: 30px;">
                    Accedi con Discord per il Multiplayer, o entra come Ospite per i giochi Offline.
                </p>
                <button id="login-discord" style="width: 100%; padding: 18px; border-radius: 14px; font-weight: 800; cursor: pointer; background: #5865F2; border: none; color: white; margin-bottom: 12px; font-size: 16px;">
                    ENTRA CON DISCORD
                </button>
                <button id="login-guest" style="width: 100%; padding: 15px; border-radius: 14px; font-weight: 700; cursor: pointer; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: white; font-size: 14px;">
                    ENTRA COME OSPITE (Offline)
                </button>
            </div>
        </div>
    `;

    document.getElementById('login-discord').onclick = async () => {
        const siteUrl = window.location.hostname === 'localhost' ? window.location.origin : 'https://lataverna.xyz';
        await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { redirectTo: siteUrl }
        });
    };

    document.getElementById('login-guest').onclick = () => {
        const guestData = {
            id: 'guest-' + Date.now(),
            user_metadata: { full_name: "Viandante Ospite" },
            isGuest: true
        };
        localStorage.setItem('taverna_guest_user', JSON.stringify(guestData));
        // IMPORTANTE: ricarica per far scattare la logica in main.js
        window.location.reload();
    };
}
