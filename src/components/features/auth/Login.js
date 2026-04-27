import { supabase } from '../../../services/supabase.js';

/**
 * SISTEMA DI AUTENTICAZIONE - LA TAVERNA
 * Versione Stabile 2.0 - Amethyst Solid UI
 */

export function initLogin(container) {
    if (!container) return;
    
    // Pulizia scroll per la schermata di login
    document.body.style.overflow = 'hidden';
    
    // Stato iniziale: Mostra la schermata di benvenuto
    renderStartScreen(container);
}

export const showLogin = initLogin;

// --- 1. SCHERMATA DI BENVENUTO (START) ---
function renderStartScreen(container) {
    container.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100dvh; padding: 20px; text-align: center;">
            
            <img src="/assets/logo.png" class="pulse-logo" style="width: 120px; margin-bottom: 30px;" alt="Logo">
            
            <h1 class="main-title" style="font-size: 3rem; margin-bottom: 10px;">LA TAVERNA</h1>
            <p style="opacity: 0.6; letter-spacing: 2px; font-size: 12px; margin-bottom: 40px; text-transform: uppercase;">Dove le leggende si incontrano</p>

            <button id="btn-enter-tavern" class="game-card" style="width: 100%; max-width: 280px; padding: 20px; cursor: pointer; border: 1.5px solid var(--amethyst-bright); background: rgba(157, 78, 221, 0.1);">
                <span style="font-size: 1rem; font-weight: 900; letter-spacing: 2px; color: white;">ENTRA NELLA SALA</span>
            </button>
            
            <p style="margin-top: 30px; font-size: 10px; opacity: 0.4; letter-spacing: 1px;">VERSIONE ALPHA 5.2 - AMETHYST UI</p>
        </div>
    `;

    document.getElementById('btn-enter-tavern').onclick = () => renderLoginMethods(container);
}

// --- 2. METODI DI ACCESSO ---
function renderLoginMethods(container) {
    // Usiamo fadeInUp per un ingresso serio e senza scatti laterali
    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100dvh; padding: 20px; animation: fadeInUp 0.6s ease-out forwards;">
            
            <div class="action-card" style="width: 100%; max-width: 350px; padding: 40px 25px; background: rgba(10, 5, 20, 0.8); border: 1px solid var(--glass-border);">
                <img src="/assets/logo.png" style="width: 60px; margin-bottom: 20px; filter: drop-shadow(0 0 10px var(--amethyst-glow));" alt="Logo">
                
                <h2 class="main-title" style="font-size: 1.8rem; margin-bottom: 10px;">IDENTIFICATI</h2>
                <p style="font-size: 13px; opacity: 0.7; margin-bottom: 35px; line-height: 1.6;">
                    Accedi per salvare i tuoi progressi o entra come semplice viandante.
                </p>

                <button id="login-discord" class="btn-back-glass" style="width: 100%; background: #5865F2; border: none; margin-bottom: 15px; font-size: 0.9rem; font-weight: 800; box-shadow: 0 8px 20px rgba(88, 101, 242, 0.2);">
                    <img src="https://cdn-icons-png.flaticon.com/512/2111/2111370.png" style="width: 20px; margin-right: 10px; filter: brightness(0) invert(1);" alt="">
                    DISCORD LOGIN
                </button>

                <button id="login-guest" class="btn-back-glass" style="width: 100%; font-size: 0.85rem; opacity: 0.9; border-color: rgba(255,255,255,0.1);">
                    ENTRA COME OSPITE
                </button>
                
                <button id="back-to-start" style="background: none; border: none; color: var(--text-secondary); margin-top: 30px; padding: 10px; font-size: 11px; cursor: pointer; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6;">
                    ⬅ Torna alla porta
                </button>
            </div>
        </div>
    `;

    // Azione Discord (Redirect intelligente)
    document.getElementById('login-discord').onclick = async () => {
        // Mostra un piccolo feedback di caricamento
        document.getElementById('login-discord').innerText = "COLLEGAMENTO...";
        
        const siteUrl = window.location.hostname === 'localhost' 
            ? window.location.origin 
            : 'https://lataverna.xyz';

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { redirectTo: siteUrl }
        });

        if (error) alert("Errore durante l'accesso: " + error.message);
    };

    // Azione Ospite collegata a Supabase Anonymous Auth
    document.getElementById('login-guest').onclick = async () => {
        const btn = document.getElementById('login-guest');
        btn.innerText = 'CREAZIONE OSPITE...';
        const { data, error } = await supabase.auth.signInAnonymously();

        if (error || !data?.user) {
            btn.innerText = 'ENTRA COME OSPITE';
            alert(`Accesso ospite Supabase non disponibile: ${error?.message || 'abilita Anonymous Sign-Ins in Supabase Auth.'}`);
            return;
        }

        localStorage.removeItem('taverna_guest_user');
        window.location.reload();
    };

    // Navigazione interna
    document.getElementById('back-to-start').onclick = () => renderStartScreen(container);
}
