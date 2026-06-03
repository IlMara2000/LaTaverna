import { isSupabaseConfigured, supabase, SUPABASE_CONFIG } from './supabase.js';

const ROOM_TABLE = SUPABASE_CONFIG?.tables?.minigameRooms || 'minigame_rooms';
const CLIENT_ID_KEY = 'taverna_minigame_client_id';
const ROOM_KEY = 'taverna_minigame_room';
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

let memoryClientId = '';

const isSchemaError = (error) => {
    const message = String(error?.message || '');
    return error?.code === '42P01'
        || error?.code === 'PGRST205'
        || message.includes('does not exist')
        || message.includes('schema cache')
        || message.includes('Database non disponibile');
};

const safeStorage = () => {
    try {
        const storage = globalThis.localStorage;
        storage?.getItem('__taverna_storage_probe__');
        return storage;
    } catch {
        return null;
    }
};

export const getMinigameClientId = () => {
    const storage = safeStorage();
    const stored = storage?.getItem(CLIENT_ID_KEY);
    if (stored) return stored;
    if (memoryClientId) return memoryClientId;

    const id = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    memoryClientId = id;
    storage?.setItem(CLIENT_ID_KEY, id);
    return id;
};

const generateRoomCode = () => {
    const bytes = new Uint8Array(6);
    if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(bytes, byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
};

const normalizeRoom = (room = null) => {
    if (!room) return null;
    return {
        id: room.id || '',
        code: String(room.code || '').toUpperCase(),
        hostClientId: room.host_client_id || '',
        guestClientId: room.guest_client_id || '',
        status: room.status || 'waiting',
        data: room.data || {},
        expiresAt: room.expires_at || '',
        updatedAt: room.updated_at || ''
    };
};

const saveRoom = (room) => {
    const storage = safeStorage();
    if (!storage || !room?.code) return;
    storage.setItem(ROOM_KEY, JSON.stringify(room));
};

export const getSavedMinigameRoom = () => {
    const storage = safeStorage();
    if (!storage) return null;
    try {
        const parsed = JSON.parse(storage.getItem(ROOM_KEY) || 'null');
        return parsed?.code ? parsed : null;
    } catch {
        return null;
    }
};

export const clearSavedMinigameRoom = () => {
    safeStorage()?.removeItem(ROOM_KEY);
};

const ensureRoomAccess = async () => {
    if (!isSupabaseConfigured || !supabase?.from) {
        return { ready: false, error: new Error('Supabase non configurato.') };
    }

    // Se Anonymous Sign-In e' abilitato lo usiamo, altrimenti la tabella resta
    // accessibile via ruolo anon con policy RLS limitate al codice stanza.
    try {
        const current = await supabase.auth?.getUser?.();
        if (!current?.data?.user?.id) {
            await supabase.auth?.signInAnonymously?.();
        }
    } catch {
        // Il pairing non deve bloccarsi se il progetto non usa login anonimo.
    }

    return { ready: true };
};

export const createMinigameRoom = async () => {
    const session = await ensureRoomAccess();
    if (!session.ready) return { room: null, error: session.error, unavailable: true };

    const clientId = getMinigameClientId();
    let lastError = null;

    for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = generateRoomCode();
        const payload = {
            code,
            host_client_id: clientId,
            guest_client_id: '',
            status: 'waiting',
            data: {
                scope: 'minigames',
                createdBy: clientId
            },
            expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
        };

        const { data, error } = await supabase
            .from(ROOM_TABLE)
            .insert([payload])
            .select('*')
            .single();

        if (!error && data) {
            const room = normalizeRoom(data);
            saveRoom(room);
            return { room, error: null, unavailable: false };
        }

        lastError = error;
        if (isSchemaError(error)) return { room: null, error, unavailable: true };
        if (error?.code !== '23505') break;
    }

    return { room: null, error: lastError || new Error('Codice multiplayer non creato.'), unavailable: false };
};

export const joinMinigameRoom = async (rawCode = '') => {
    const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) {
        return { room: null, error: new Error('Inserisci un codice di 6 caratteri.'), unavailable: false };
    }

    const session = await ensureRoomAccess();
    if (!session.ready) return { room: null, error: session.error, unavailable: true };

    const clientId = getMinigameClientId();
    const lookup = await supabase
        .from(ROOM_TABLE)
        .select('*')
        .eq('code', code)
        .neq('status', 'closed')
        .maybeSingle();

    if (lookup.error) {
        return { room: null, error: lookup.error, unavailable: isSchemaError(lookup.error) };
    }

    if (!lookup.data) {
        return { room: null, error: new Error('Codice non trovato o scaduto.'), unavailable: false };
    }

    if (lookup.data.host_client_id === clientId) {
        const room = normalizeRoom(lookup.data);
        saveRoom(room);
        return { room, error: null, unavailable: false };
    }

    const nextData = {
        ...(lookup.data.data || {}),
        joinedBy: clientId,
        joinedAt: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from(ROOM_TABLE)
        .update({
            guest_client_id: clientId,
            status: 'connected',
            data: nextData
        })
        .eq('code', code)
        .select('*')
        .single();

    if (error) {
        return { room: null, error, unavailable: isSchemaError(error) };
    }

    const room = normalizeRoom(data);
    saveRoom(room);
    return { room, error: null, unavailable: false };
};

export const getMinigameRoomByCode = async (rawCode = '') => {
    const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return { room: null, error: new Error('Codice non valido.'), unavailable: false };

    const session = await ensureRoomAccess();
    if (!session.ready) return { room: null, error: session.error, unavailable: true };

    const { data, error } = await supabase
        .from(ROOM_TABLE)
        .select('*')
        .eq('code', code)
        .neq('status', 'closed')
        .maybeSingle();

    if (error) {
        return { room: null, error, unavailable: isSchemaError(error) };
    }

    const room = normalizeRoom(data);
    if (room) saveRoom(room);
    return { room, error: null, unavailable: false };
};

export const isMinigameRoomConnected = (room = null) => (
    room?.status === 'connected'
    && Boolean(room.hostClientId)
    && Boolean(room.guestClientId)
);

export const closeMinigameRoom = async (code = '') => {
    const normalizedCode = String(code || '').trim().toUpperCase();
    clearSavedMinigameRoom();
    if (!normalizedCode || !supabase?.from) return;
    try {
        await supabase
            .from(ROOM_TABLE)
            .update({ status: 'closed' })
            .eq('code', normalizedCode);
    } catch (err) {
        console.warn('Chiusura multiplayer non completata:', err);
    }
};

export const watchMinigameRoom = (code = '', onChange = () => {}) => {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!normalizedCode || !supabase?.channel) return () => {};

    const channel = supabase.channel(`minigame-room-${normalizedCode}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: ROOM_TABLE,
            filter: `code=eq.${normalizedCode}`
        }, payload => {
            const room = normalizeRoom(payload.new || payload.old);
            if (room) {
                saveRoom(room);
                onChange(room, payload.eventType);
            }
        })
        .subscribe();

    return () => {
        if (supabase.removeChannel) supabase.removeChannel(channel);
    };
};
