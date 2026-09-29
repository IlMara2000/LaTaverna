import { renderTavernEntrance } from './TavernEntrance.js';
import { supabase } from '../../../services/supabase.js';
import { getLocalDndUser } from '../../../services/dndLocalStore.js';

/**
 * SISTEMA DI AUTENTICAZIONE - LA TAVERNA
 * Versione Stabile 2.0 - Amethyst Solid UI
 */

export function initLogin(container) {
    if (!container) return;
    
    // Pulizia scroll per la schermata di login
    document.body.style.overflow = '';
    resetAuthScroll(container);
    
    // Il portale conduce direttamente ai metodi di accesso.
    renderLoginMethods(container);
}

export const showLogin = initLogin;

function resetAuthScroll(container) {
    container.scrollTop = 0;
    container.scrollLeft = 0;
    requestAnimationFrame(() => {
        container.scrollTop = 0;
        container.scrollLeft = 0;
    });
}

// --- 1. SCHERMATA DI BENVENUTO (START) ---
function renderStartScreen(container) {
    renderTavernEntrance(container, () => initLogin(container));
}

// --- 2. METODI DI ACCESSO ---
function renderLoginMethods(container) {
    container.innerHTML = `
        <section class="auth-page tavern-auth-page" aria-label="Accedi alla Taverna">
            <div class="auth-panel" tabindex="-1">
                <img src="/assets/logo.png" class="auth-logo" width="512" height="512" alt="La Taverna" fetchpriority="high" decoding="async">
                <p class="auth-intro">Il tuo posto al tavolo ti aspetta.</p>
                <form id="email-login-form" class="auth-form">
                    <label for="login-email">Email</label>
                    <input type="email" id="login-email" class="auth-input" placeholder="La tua email" autocomplete="email" required>
                    <label for="login-password">Password</label>
                    <input type="password" id="login-password" class="auth-input" placeholder="La tua password" autocomplete="current-password" required>
                    <button id="login-email-submit" class="auth-submit" type="submit">Accedi <span aria-hidden="true">↗</span></button>
                    <p id="login-message" role="status" aria-live="polite"></p>
                </form>
                <div class="auth-divider"><span>oppure</span></div>
                <button id="login-discord" class="auth-provider" type="button">Continua con Discord</button>
                <button id="login-guest" class="auth-guest" type="button">Esplora come ospite <span aria-hidden="true">→</span></button>
                <p class="auth-register">È la tua prima visita? <button id="show-register" type="button">Crea profilo</button></p>
                <button id="back-to-start" class="auth-back" type="button">← Torna alla porta</button>
            </div>
        </section>
    `;
    resetAuthScroll(container);

    const loginMessage = document.getElementById('login-message');
    const emailSubmit = document.getElementById('login-email-submit');

    document.getElementById('email-login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        loginMessage.textContent = '';
        emailSubmit.disabled = true;
        emailSubmit.innerText = 'ACCESSO...';

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (!data?.user) throw new Error('Sessione non creata.');
            localStorage.removeItem('taverna_guest_user');
            window.location.reload();
        } catch (err) {
            loginMessage.textContent = err.message || 'Accesso non riuscito.';
            emailSubmit.disabled = false;
            emailSubmit.innerText = 'ACCEDI';
        }
    };

    // Azione Discord (Redirect intelligente)
    document.getElementById('login-discord').onclick = async () => {
        // Mostra un piccolo feedback di caricamento
        document.getElementById('login-discord').innerText = "COLLEGAMENTO...";
        
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { redirectTo: window.location.origin }
        });

        if (error) alert("Errore durante l'accesso: " + error.message);
    };

    // Azione Ospite collegata a Supabase Anonymous Auth
    document.getElementById('login-guest').onclick = async () => {
        const btn = document.getElementById('login-guest');
        btn.innerText = 'CREAZIONE OSPITE...';
        const { data, error } = await supabase.auth.signInAnonymously();

        if (error || !data?.user) {
            const localUser = getLocalDndUser();
            localStorage.setItem('taverna_guest_user', JSON.stringify({
                id: localUser.id,
                name: localUser.user_metadata.full_name,
                isGuest: true,
                isLocalDnd: true
            }));
            window.location.reload();
            return;
        }

        localStorage.removeItem('taverna_guest_user');
        window.location.reload();
    };

    // Navigazione interna
    document.getElementById('back-to-start').onclick = () => renderStartScreen(container);
    document.getElementById('show-register').onclick = async () => {
        const { showRegister } = await import('./Register.js');
        showRegister(container);
    };
}
