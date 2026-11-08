import { INITIAL_URL_HASH, INITIAL_URL_SEARCH } from './supabase.js';

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
export function isPasswordRecoveryLink(url) {
    if (url) {
        try {
            const link = new URL(url, window.location.origin);
            return typeOf(link.hash) === 'recovery' || typeOf(link.search) === 'recovery';
        } catch {
            return false;
        }
    }

    // All'avvio il client Supabase ha già ripulito l'URL: valgono lo snapshot
    // e il segno lasciato in sessione dal primo caricamento.
    const parts = [window.location.hash, window.location.search, INITIAL_URL_HASH, INITIAL_URL_SEARCH];
    if (parts.some(part => typeOf(part) === 'recovery')) return true;

    try {
        return sessionStorage.getItem('taverna_password_recovery') === '1';
    } catch {
        return false;
    }
}
