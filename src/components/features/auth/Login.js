import { supabase } from '../../../services/supabase.js';

export function initLogin(container) {
    if (!container) return;

    container.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 20px;">
            <div class="glass-box" style="width: 100%; max-width: 350px; padding: 40px; text-align: center; border-radius: 24px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(10px);">
                <h1 style="font-size: 1.5rem; font-weight: 900; margin-bottom: 10px; color: var(--amethyst-bright);">BENVENUTO</h1>
                <p style="font-size: 13px; opacity: 0.6; margin-bottom: 30px;">Identificati per accedere alla Taverna.</p>
                
                <button id="btn-google" class="btn-primary" style="width: 100%; padding: 15px; border-radius: 12px; font-weight: 800; cursor: pointer; background: var(--amethyst-bright); border: none; color: white;">
                    ENTRA CON GOOGLE
                </button>

                <p style="margin-top: 25px; font-size: 10px; opacity: 0.4; line-height: 1.5;">
                    Accedendo accetti le regole della gilda e il trattamento dei tuoi dati magici.
                </p>
            </div>
        </div>
    `;

    const googleBtn = document.getElementById('btn-google');
    if (googleBtn) {
        googleBtn.onclick = async () => {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin }
            });
            if (error) alert("Errore magico: " + error.message);
        };
    }
}