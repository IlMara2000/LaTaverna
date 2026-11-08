import { supabase } from '../../../services/supabase.js';
import { authErrorMessage } from '../../../services/authErrors.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePassword } from '../../../services/passwordPolicy.js';

export function initResetPassword(container) {
    if (!container) return;
    document.body.style.overflow = '';

    container.innerHTML = `
        <section class="auth-page tavern-auth-page" aria-label="Imposta una nuova password">
            <div class="auth-panel" tabindex="-1">
                <img src="/assets/logo.png" class="auth-logo" width="512" height="512" alt="La Taverna" decoding="async">
                <p class="auth-intro">Scegli la nuova parola d’ordine del tuo posto al tavolo.</p>
                <form id="reset-form" class="auth-form">
                    <label for="reset-password">Nuova password</label>
                    <input type="password" id="reset-password" class="auth-input" placeholder="Almeno ${PASSWORD_MIN_LENGTH} caratteri" autocomplete="new-password" minlength="${PASSWORD_MIN_LENGTH}" maxlength="${PASSWORD_MAX_LENGTH}" required>
                    <label for="reset-confirm">Ripeti la password</label>
                    <input type="password" id="reset-confirm" class="auth-input" placeholder="Scrivila di nuovo" autocomplete="new-password" minlength="${PASSWORD_MIN_LENGTH}" maxlength="${PASSWORD_MAX_LENGTH}" required>
                    <button id="reset-submit" class="auth-submit" type="submit">Salva la nuova password <span aria-hidden="true">↗</span></button>
                    <p id="reset-message" role="status" aria-live="polite"></p>
                </form>
                <p class="auth-note">Il link di recupero vale una volta sola e scade dopo un po’. Se è vecchio, richiedine uno nuovo dalla schermata di accesso.</p>
                <button id="reset-to-login" class="auth-back" type="button">← Torna all’accesso</button>
            </div>
        </section>
    `;

    const form = document.getElementById('reset-form');
    const passwordField = document.getElementById('reset-password');
    const confirmField = document.getElementById('reset-confirm');
    const submit = document.getElementById('reset-submit');
    const message = document.getElementById('reset-message');

    const say = (text, tone = 'error') => {
        message.textContent = text;
        message.style.color = tone === 'ok' ? '#9ff0b4' : 'var(--error-red)';
    };

    const backToLogin = () => {
        sessionStorage.removeItem('taverna_password_recovery');
        window.history.replaceState({}, document.title, '/');
        window.location.reload();
    };

    document.getElementById('reset-to-login').onclick = backToLogin;

    form.onsubmit = async event => {
        event.preventDefault();
        const password = passwordField.value;
        const confirmation = confirmField.value;

        const policy = validatePassword(password);
        if (policy) { say(policy); passwordField.focus(); return; }
        if (password !== confirmation) { say('Le due password non coincidono.'); confirmField.focus(); return; }

        say('');
        submit.disabled = true;
        submit.innerText = 'SALVATAGGIO...';

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                say('Il link di recupero non è più valido: richiedine uno nuovo dalla schermata di accesso.');
                return;
            }
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            localStorage.removeItem('taverna_guest_user');
            sessionStorage.removeItem('taverna_password_recovery');
            say('Password aggiornata. Entriamo nella Taverna…', 'ok');
            window.history.replaceState({}, document.title, '/');
            setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
            say(authErrorMessage(err, 'Non è stato possibile salvare la password. Riprova.'));
        } finally {
            submit.disabled = false;
            submit.innerText = 'SALVA LA NUOVA PASSWORD';
        }
    };
}
