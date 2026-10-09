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

const saveRoom = (room, activate = false) => {
    const storage = safeStorage();
    if (!storage || !room?.code) return;
    const key = room.data?.scope === 'magic' ? 'taverna_magic_room' : ROOM_KEY;
    // A late poll or disconnect write must not switch the user's active room.
    if (!activate) {
        try {
            const current = JSON.parse(storage.getItem(key) || 'null');
            if (!current || current.code !== room.code || current.updatedAt > room.updatedAt) return;
        } catch { return; }
    }
    storage.setItem(key, JSON.stringify(room));
};

export const getSavedMinigameRoom = () => {
    const storage = safeStorage();
    if (!storage) return null;
    try {
        const parsed = JSON.parse(storage.getItem(ROOM_KEY) || 'null');
        return parsed?.code && parsed.data?.scope !== 'magic' ? parsed : null;
    } catch {
        return null;
    }
};

export const getSavedMagicRoom = () => {
    try {
        const saved = JSON.parse(safeStorage()?.getItem('taverna_magic_room') || 'null');
        const legacy = JSON.parse(safeStorage()?.getItem(ROOM_KEY) || 'null');
        return saved || (legacy?.data?.scope === 'magic' ? legacy : null);
    } catch { return null; }
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

export const createMinigameRoom = async ({scope = 'minigames'} = {}) => {
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
                scope,
                ...(scope === 'magic' ? {magic:{participants:[],loadouts:{}}} : {}),
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
            saveRoom(room, true);
            return { room, error: null, unavailable: false };
        }

        lastError = error;
        if (isSchemaError(error)) return { room: null, error, unavailable: true };
        if (error?.code !== '23505') break;
    }

    return { room: null, error: lastError || new Error('Codice multiplayer non creato.'), unavailable: false };
};

export const getRoomParticipants = room => [...new Set([
    room?.hostClientId, room?.guestClientId, ...(room?.data?.participants || []),
    ...(room?.data?.scope === 'magic' ? room.data.magic?.participants || [] : [])
].filter(Boolean))];

export const joinMinigameRoom = async (rawCode = '', attempt = 0) => {
    const code = String(rawCode).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return { room: null, error: new Error('Inserisci un codice di 6 caratteri.') };
    const access = await ensureRoomAccess();
    if (!access.ready) return { room: null, error: access.error, unavailable: true };
    const lookup = await supabase.from(ROOM_TABLE).select('*').eq('code', code)
        .neq('status', 'closed').gt('expires_at', new Date().toISOString()).maybeSingle();
    if (lookup.error) return { room: null, error: lookup.error, unavailable: isSchemaError(lookup.error) };
    const row = lookup.data;
    if (!row) return { room: null, error: new Error('Codice non trovato o scaduto.') };
    if (row.data?.scope === 'magic') return { room: null, error: new Error('Entra in questa stanza dalla sezione Magic.') };
    const room = normalizeRoom(row), clientId = getMinigameClientId(), participants = getRoomParticipants(room);
    if (participants.includes(clientId)) { saveRoom(room, true); return { room, error: null }; }
    if (participants.length >= 8) return { room: null, error: new Error('Stanza piena: massimo 8 giocatori.') };
    if (row.data?.onlineMatch?.presence?.some(time => time && Date.now() - time < 35000)) {
        return { room: null, error: new Error('Una partita è già aperta. Fate tornare tutti alla sala giochi prima di aggiungere partecipanti.') };
    }
    const result = await supabase.from(ROOM_TABLE).update({
        guest_client_id: row.guest_client_id || clientId, status: 'connected',
        data: { ...row.data, participants: [...participants, clientId] }
    }).eq('code', code).eq('updated_at', row.updated_at).neq('status', 'closed')
        .gt('expires_at', new Date().toISOString()).select('*');
    if (result.error) return { room: null, error: result.error, unavailable: isSchemaError(result.error) };
    if (!result.data?.length) {
        if (attempt < 3) return joinMinigameRoom(code, attempt + 1);
        return { room: null, error: new Error('La stanza è cambiata. Riprova.') };
    }
    const joined = normalizeRoom(result.data[0]); saveRoom(joined, true);
    return { room: joined, error: null };
};

// MTG usa la stessa stanza realtime dei minigiochi, con tre posti ospite
// registrati nel JSON della partita oltre al posto guest compatibile esistente.
export const joinMagicRoom = async (rawCode = '', deck = null) => {
    const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return { room: null, error: new Error('Inserisci un codice di 6 caratteri.'), unavailable: false };
    const session = await ensureRoomAccess();
    if (!session.ready) return { room: null, error: session.error, unavailable: true };
    const clientId = getMinigameClientId();
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const lookup = await supabase.from(ROOM_TABLE).select('*').eq('code', code)
            .neq('status', 'closed').gt('expires_at', new Date().toISOString()).maybeSingle();
        if (lookup.error) return { room: null, error: lookup.error, unavailable: isSchemaError(lookup.error) };
        const row = lookup.data;
        if (!row) return { room: null, error: new Error('Codice non trovato o scaduto.'), unavailable: false };
        const data = row.data || {};
        if (data.scope !== 'magic') return { room: null, error: new Error('Questo codice non appartiene a una partita di Magic.'), unavailable: false };
        const magic = data.magic || {};
        const participants = [...new Set([row.host_client_id, row.guest_client_id, ...(magic.participants || [])].filter(Boolean))];
        if (participants.includes(clientId)) { const room = normalizeRoom(row); saveRoom(room, true); return { room, error: null, unavailable: false }; }
        if (participants.length >= 4) return { room: null, error: new Error('La stanza è al completo (massimo 4 giocatori).'), unavailable: false };
        if (magic.game) return { room: null, error: new Error('La partita è già iniziata.'), unavailable: false };
        const nextMagic = { ...magic, participants: [...(magic.participants || []), clientId], loadouts: { ...(magic.loadouts || {}), ...(deck ? { [clientId]: deck } : {}) } };
        const update = await supabase.from(ROOM_TABLE).update({
            guest_client_id: row.guest_client_id || clientId,
            status: 'connected',
            data: { ...data, magic: nextMagic }
        }).eq('code', code).eq('updated_at', row.updated_at).neq('status', 'closed').select('*');
        if (update.error) return { room: null, error: update.error, unavailable: isSchemaError(update.error) };
        if (update.data?.length) {
            const room = normalizeRoom(update.data[0]);
            saveRoom(room, true);
            return { room, error: null, unavailable: false };
        }
    }
    return { room: null, error: new Error('La stanza è cambiata. Riprova.'), unavailable: false };
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
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (error) {
        return { room: null, error, unavailable: isSchemaError(error) };
    }

    const room = normalizeRoom(data);
    if (room) saveRoom(room);
    return { room, error: null, unavailable: false };
};

export const updateMinigameRoomData = async (rawCode = '', updater = {}, attempt = 0) => {
    const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) {
        return { room: null, error: new Error('Codice non valido.'), unavailable: false };
    }

    const session = await ensureRoomAccess();
    if (!session.ready) return { room: null, error: session.error, unavailable: true };

    const lookup = await supabase
        .from(ROOM_TABLE)
        .select('*')
        .eq('code', code)
        .neq('status', 'closed')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

    if (lookup.error) {
        return { room: null, error: lookup.error, unavailable: isSchemaError(lookup.error) };
    }

    if (!lookup.data) {
        return { room: null, error: new Error('Codice non trovato o scaduto.'), unavailable: false };
    }

    const currentRoom = normalizeRoom(lookup.data);
    const currentData = lookup.data.data || {};
    let nextData;
    try {
        nextData = typeof updater === 'function' ? updater(currentData, currentRoom) : { ...currentData, ...updater };
    } catch (error) {
        return { room: currentRoom, error, unavailable: false };
    }

    const { data, error } = await supabase
        .from(ROOM_TABLE)
        .update({ data: nextData })
        .eq('code', code)
        .eq('updated_at', lookup.data.updated_at)
        .neq('status', 'closed')
        .gt('expires_at', new Date().toISOString())
        .select('*');

    if (error) {
        return { room: null, error, unavailable: isSchemaError(error) };
    }

    if (!data?.length) {
        if (attempt < 3) return updateMinigameRoomData(rawCode, updater, attempt + 1);
        return { room: null, error: new Error('La stanza è cambiata. Riprova.'), unavailable: false };
    }
    const room = normalizeRoom(data[0]);
    if (room) saveRoom(room);
    return { room, error: null, unavailable: false };
};

export const isMinigameRoomConnected = (room = null) => (
    room?.status === 'connected'
    && Boolean(room.hostClientId)
    && Boolean(room.guestClientId)
    && room.hostClientId !== room.guestClientId
    && (!room.expiresAt || Date.parse(room.expiresAt) > Date.now())
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
