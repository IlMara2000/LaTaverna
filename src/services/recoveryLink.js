const typeOf = value => {
    try {
        return new URLSearchParams(String(value || '').replace(/^[#?]/, '')).get('type');
    } catch {
        return null;
    }
};

/**
 * Supabase rimanda al sito con i token nel frammento (#access_token=…&type=recovery)
 * oppure con ?code=…&type=recovery. Riconoscere quel link serve sia a mostrare il
 * modulo della nuova password sia a non scambiarlo per un ritorno da Discord.
 */
export function isPasswordRecoveryLink(url = window.location.href) {
    try {
        const link = new URL(url, window.location.origin);
        return typeOf(link.hash) === 'recovery' || typeOf(link.search) === 'recovery';
    } catch {
        return false;
    }
}
