import { supabase, SUPABASE_CONFIG } from './supabase.js';

const SESSION_TABLE = SUPABASE_CONFIG?.tables?.sessions || 'dnd_sessions';
const INVITE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

const generateInviteCode = () => {
    const bytes = new Uint8Array(32);
    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(bytes, byte => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join('');
};

export const getSessionInviteFromUrl = (url = globalThis.location?.href || '') => {
    try {
        const parsed = new URL(url);
        const sessionId = parsed.searchParams.get('session') || parsed.searchParams.get('sessione');
        const code = parsed.searchParams.get('invite') || parsed.searchParams.get('codice');
        const systemId = parsed.searchParams.get('system') || parsed.searchParams.get('sistema') || 'dnd5e';
        if (!isUuid(sessionId) || !code || systemId !== 'dnd5e') return null;
        return {
            sessionId,
            code,
            systemId: 'dnd5e'
        };
    } catch {
        return null;
    }
};

export const buildSessionInviteUrl = ({ sessionId, code, systemId = 'dnd5e' } = {}) => {
    if (systemId !== 'dnd5e') throw new Error('Sistema di gioco non disponibile.');
    const origin = globalThis.location?.origin || 'https://www.lataverna.xyz';
    const url = new URL(origin);
    url.searchParams.set('session', sessionId);
    url.searchParams.set('invite', code);
    url.searchParams.set('system', 'dnd5e');
    return url.toString();
};

export const ensureSessionInvite = async (session = {}, systemId = 'dnd5e') => {
    if (!session?.id) throw new Error('Sessione non valida.');
    const existingCode = session.share_code || session.data?.share_code || '';
    if (session.share_enabled && existingCode) {
        return {
            code: existingCode,
            url: buildSessionInviteUrl({ sessionId: session.id, code: existingCode, systemId })
        };
    }

    const code = existingCode || generateInviteCode();
    const { data, error } = await supabase
        .from(SESSION_TABLE)
        .update({ share_enabled: true, share_code: code })
        .eq('id', session.id)
        .select('id, share_code, share_enabled')
        .single();

    if (error) throw error;
    const resolvedCode = data?.share_code || code;
    return {
        code: resolvedCode,
        url: buildSessionInviteUrl({ sessionId: session.id, code: resolvedCode, systemId })
    };
};

export const joinSessionInvite = async ({ sessionId, code, displayName = '' } = {}) => {
    if (!isUuid(sessionId) || !code) throw new Error('Link sessione non valido.');

    try {
        const current = await supabase.auth.getUser();
        if (!current?.data?.user?.id) {
            await supabase.auth.signInAnonymously();
        }
    } catch {
        // La RPC restituirà l'errore corretto se non c'è un utente Supabase.
    }

    const { data, error } = await supabase.rpc('join_dnd_session', {
        p_session_id: sessionId,
        p_share_code: code,
        p_display_name: displayName || 'Giocatore'
    });

    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
};
