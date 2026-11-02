export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;

// Supabase accetta password libere: la policy minima la applichiamo qui e la
// documentiamo all'utente. Non tagliamo spazi interni, ma rifiutiamo valori
// troppo corti, troppo lunghi o composti da un solo tipo di carattere.
export function validatePassword(password) {
    const value = String(password || '');
    if (value.length < PASSWORD_MIN_LENGTH) {
        return `La password deve contenere almeno ${PASSWORD_MIN_LENGTH} caratteri.`;
    }
    if (value.length > PASSWORD_MAX_LENGTH) {
        return `La password non può superare ${PASSWORD_MAX_LENGTH} caratteri.`;
    }
    if (!/\p{L}/u.test(value) || !/\d/.test(value)) {
        return 'La password deve contenere almeno una lettera e un numero.';
    }
    return '';
}
