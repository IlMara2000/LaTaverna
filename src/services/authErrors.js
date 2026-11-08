// Supabase risponde in inglese: qui traduciamo gli errori che possono finire
// davanti a chi prova ad accedere o a registrarsi, con un fallback italiano.
const MESSAGES = {
    invalid_credentials: 'Email o password non corretti.',
    email_not_confirmed: 'Devi prima confermare la tua email: apri il link che ti abbiamo inviato.',
    email_exists: 'Esiste già un account con questa email. Prova ad accedere.',
    user_already_exists: 'Esiste già un account con questa email. Prova ad accedere.',
    weak_password: 'La password è troppo debole: usa almeno 10 caratteri con una lettera e un numero.',
    same_password: 'La nuova password deve essere diversa da quella attuale.',
    email_address_invalid: 'Questo indirizzo email non sembra valido.',
    validation_failed: 'Controlla i dati inseriti: email o password non validi.',
    over_request_rate_limit: 'Troppi tentativi ravvicinati. Aspetta qualche minuto e riprova.',
    over_email_send_rate_limit: 'Abbiamo inviato troppe email a questo indirizzo. Riprova tra qualche minuto.',
    signup_disabled: 'Le registrazioni sono chiuse in questo momento.',
    email_provider_disabled: 'L’accesso con email e password non è disponibile in questo momento.',
    anonymous_provider_disabled: 'L’accesso come ospite non è disponibile in questo momento.',
    provider_disabled: 'Questo metodo di accesso non è disponibile in questo momento.',
    session_expired: 'La sessione è scaduta: accedi di nuovo.',
    session_not_found: 'La sessione è scaduta: accedi di nuovo.',
    otp_expired: 'Il link è scaduto: richiedine uno nuovo.',
    flow_state_expired: 'Il link è scaduto: riprova dall’inizio.',
    flow_state_not_found: 'Il link di recupero non è più valido: richiedine uno nuovo.',
    refresh_token_not_found: 'La sessione è scaduta: accedi di nuovo.',
    refresh_token_already_used: 'Il link è già stato usato: richiedine uno nuovo.',
    bad_code_verifier: 'Errore di verifica: riprova dall’inizio.',
    reauth_needed: 'Per sicurezza devi accedere di nuovo prima di cambiare la password.',
    user_not_found: 'Account non trovato.'
};

const OFFLINE = 'Connessione assente o instabile: controlla la rete e riprova.';

// Rete di sicurezza quando il servizio non manda un codice riconoscibile.
const BY_MESSAGE = [
    [/invalid login credentials/i, 'invalid_credentials'],
    [/email not confirmed/i, 'email_not_confirmed'],
    [/already registered/i, 'email_exists'],
    [/password should be at least|weak password/i, 'weak_password'],
    [/should be different from the old password/i, 'same_password'],
    [/unable to validate email|invalid email|invalid format/i, 'email_address_invalid'],
    [/rate limit|too many requests/i, 'over_request_rate_limit'],
    [/auth session missing/i, 'session_not_found'],
    [/flow state not found/i, 'flow_state_not_found'],
    [/refresh token not found/i, 'refresh_token_not_found'],
    [/refresh token already used/i, 'refresh_token_already_used'],
    [/bad code verifier/i, 'bad_code_verifier'],
    [/reauthentication needed|reauth needed/i, 'reauth_needed'],
    [/user not found/i, 'user_not_found']
];

export function authErrorMessage(error, fallback = 'Non è stato possibile completare l’operazione. Riprova.') {
    if (!error) return fallback;
    const code = String(error.code || error.error_code || '').toLowerCase();
    if (MESSAGES[code]) return MESSAGES[code];
    const text = String(error.message || error.error_description || '').trim();
    if (!text) return fallback;
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(text)) return OFFLINE;
    for (const [pattern, key] of BY_MESSAGE) {
        if (pattern.test(text)) return MESSAGES[key];
    }
    return fallback;
}
