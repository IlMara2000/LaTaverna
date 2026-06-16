import { supabase } from './supabase.js';

const PREFERENCES_TABLE = 'user_preferences';
const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

export async function getPreferenceUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id && isUuid(user.id)) return user;

    try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error && data?.user?.id) {
            localStorage.removeItem('taverna_guest_user');
            return data.user;
        }
    } catch (err) {
        console.warn('Preferenze Supabase non disponibili:', err);
    }

    return null;
}

export async function getPreference(key, fallbackValue = null) {
    const user = await getPreferenceUser();
    if (!user?.id) return fallbackValue;

    const { data, error } = await supabase
        .from(PREFERENCES_TABLE)
        .select('value')
        .eq('user_id', user.id)
        .eq('key', key)
        .maybeSingle();

    if (error) {
        console.warn(`Preferenza ${key} non caricata:`, error);
        return fallbackValue;
    }

    return data?.value ?? fallbackValue;
}

export async function getPreferences(defaultValues = {}) {
    const keys = Object.keys(defaultValues);
    if (!keys.length) return {};

    const user = await getPreferenceUser();
    if (!user?.id) return { ...defaultValues };

    const { data, error } = await supabase
        .from(PREFERENCES_TABLE)
        .select('key,value')
        .eq('user_id', user.id)
        .in('key', keys);

    if (error) {
        console.warn('Preferenze utente non caricate:', error);
        return { ...defaultValues };
    }

    const storedValues = Object.fromEntries((data || []).map(row => [row.key, row.value]));
    return { ...defaultValues, ...storedValues };
}

export async function setPreference(key, value) {
    const user = await getPreferenceUser();
    if (!user?.id) return { error: { message: 'Utente Supabase non disponibile.' } };

    return supabase
        .from(PREFERENCES_TABLE)
        .upsert({
            user_id: user.id,
            key,
            value,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,key' });
}

export async function setPreferences(values = {}) {
    const entries = Object.entries(values);
    if (!entries.length) return { error: null };

    const user = await getPreferenceUser();
    if (!user?.id) return { error: { message: 'Utente Supabase non disponibile.' } };

    const updatedAt = new Date().toISOString();
    return supabase
        .from(PREFERENCES_TABLE)
        .upsert(entries.map(([key, value]) => ({
            user_id: user.id,
            key,
            value,
            updated_at: updatedAt
        })), { onConflict: 'user_id,key' });
}
