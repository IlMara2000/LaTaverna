import { supabase } from '../../../services/supabase.js';

export function initLogin(container) {
    if (!container) return;

    // Stato iniziale: Mostra solo il tasto d'avvio
    renderStartScreen(container);
}

function renderStartScreen(container) {
    container.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 75vh; padding: 20px;">
            <div style="text-align: center; width: 100%; max-width: 320px;">
                <img src="/assets/logo.png" style="width: 120px; margin-bottom: 40px; filter: drop-shadow(0 0 20px var(--amethyst-bright)); animation: floatLogo 4s ease-in-out infinite;" alt="La Taverna Logo">
                
                <h1 class="main-title" style="font-size: 2.6rem; margin-bottom: 40px; letter-spacing: 2px;">LA TAVERNA</h1>

                <button id="start-btn" class="btn-back-glass" style="width: 100%; padding: 22px; font-size: 1.1rem; background: var(--amethyst-bright); border: none; box-shadow: 0 0 25px var(--amethyst-glow); outline: none; -webkit-tap-highlight-color: transparent;">
                    ENTRA NELLA TAVERNA
                </button>
            </div>
        </div>
    `;

    document.getElementById('start-btn').onclick = () => renderLoginMethods(container);
}

function renderLoginMethods(container) {
    container.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 75vh; padding: 20px;">
            <div class="game-card" style="width: 100%; max-width: 350px; padding: 40px 25px; background: rgba(10, 5, 20, 0.7); border: 1px solid var(--glass-border);">
                <img src="/assets/logo.png" style="width: 60px; margin-bottom: 20px; filter: drop-shadow(0 0 10px var(--amethyst-glow));" alt="Logo">
                
                <h2 class="main-title" style="font-size: 1.6rem; margin-bottom: 10px;">IDENTIFICATI</h2>
                <p style="font-size: 12px; opacity: 0.7; margin-bottom: 30px; font-family: 'Poppins', sans-serif; line-height: 1.5;">
                    Usa Discord per giocare con gli altri o entra come Ospite.
                </p>

                <button id="login-discord" class="btn-back-glass" style="width: 100%; background: #5865F2; border: none; margin-bottom: 15px; font-size: 0.9rem; outline: none; -webkit-tap-highlight-color: transparent; box-shadow: 0 8px 20px rgba(88, 101, 242, 0.3);">
                    ENTRA CON DISCORD
                </button>

                <button id="login-guest" class="btn-back-glass" style="width: 100%; font-size: 0.85rem; opacity: 0.8; outline: none; -webkit-tap-highlight-color: transparent;">
                    ENTRA COME OSPITE
                </button>
                
                <button id="back-to-start" style="background: none; border: none; color: var(--text-secondary); margin-top: 25px; padding: 10px; font-size: 11px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; outline: none; -webkit-tap-highlight-color: transparent;">
                    ⬅ Torna indietro
                </button>
            </div>
        </div>
    `;

    // Azione Discord
    document.getElementById('login-discord').onclick = async () => {
        const siteUrl = window.location.hostname === 'localhost' ? window.location.origin : 'https://lataverna.xyz';
        await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { redirectTo: siteUrl }
        });
    };

    // Azione Ospite
    document.getElementById('login-guest').onclick = () => {
        const guestData = {
            id: 'guest-' + Date.now(),
            user_metadata: { full_name: "Viandante" },
            isGuest: true
        };
        localStorage.setItem('taverna_guest_user', JSON.stringify(guestData));
        window.location.reload();
    };

    // Torna allo Start
    document.getElementById('back-to-start').onclick = () => renderStartScreen(container);
}
