const PREFIX = 'taverna_dnd5e_local_';
const USER_KEY = `${PREFIX}user_id`;

const STORAGE_KEYS = {
    characters: `${PREFIX}characters`,
    sessions: `${PREFIX}sessions`,
    tokens: `${PREFIX}tokens`,
    chat: `${PREFIX}chat`
};

const createUuid = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
        (Number(c) ^ globalThis.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
    );
};

export const getLocalDndUser = () => {
    let id = localStorage.getItem(USER_KEY);
    if (!id) {
        id = createUuid();
        localStorage.setItem(USER_KEY, id);
    }
    return {
        id,
        email: 'ospite-locale@lataverna.local',
        is_anonymous: true,
        is_local_dnd: true,
        user_metadata: {
            full_name: 'Ospite Locale'
        }
    };
};

export const isLocalDndUser = (user) => Boolean(user?.is_local_dnd) || isLocalDndUserId(user?.id);

export const isLocalDndUserId = (userId) => Boolean(userId && localStorage.getItem(USER_KEY) === String(userId));

const readList = (key) => {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeList = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
};

const result = (data = null) => ({ data, error: null });

const now = () => new Date().toISOString();

const upsertRow = (key, row, existingId = null) => {
    const rows = readList(key);
    const timestamp = now();
    if (existingId) {
        const nextRows = rows.map(item => String(item.id) === String(existingId)
            ? { ...item, ...row, id: item.id, updated_at: timestamp }
            : item);
        const saved = nextRows.find(item => String(item.id) === String(existingId));
        writeList(key, nextRows);
        return saved || null;
    }

    const saved = {
        id: createUuid(),
        created_at: timestamp,
        updated_at: timestamp,
        ...row
    };
    writeList(key, [saved, ...rows]);
    return saved;
};

const deleteRow = (key, id) => {
    const rows = readList(key);
    const nextRows = rows.filter(item => String(item.id) !== String(id));
    writeList(key, nextRows);
    return result(null);
};

export const dndLocalStore = {
    characters: {
        list: (userId) => result(
            readList(STORAGE_KEYS.characters)
                .filter(item => String(item.user_id) === String(userId))
                .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        ),
        save: (char, payload) => result(upsertRow(STORAGE_KEYS.characters, payload, char?.id)),
        delete: (id) => deleteRow(STORAGE_KEYS.characters, id)
    },
    sessions: {
        list: (userId) => result(
            readList(STORAGE_KEYS.sessions)
                .filter(item => String(item.user_id) === String(userId))
                .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        ),
        get: (id) => result(readList(STORAGE_KEYS.sessions).find(item => String(item.id) === String(id)) || null),
        save: (session, payload) => result(upsertRow(STORAGE_KEYS.sessions, payload, session?.id)),
        updateData: (id, data) => {
            const rows = readList(STORAGE_KEYS.sessions);
            const timestamp = now();
            let saved = null;
            const nextRows = rows.map(item => {
                if (String(item.id) !== String(id)) return item;
                saved = { ...item, data, updated_at: timestamp };
                return saved;
            });
            writeList(STORAGE_KEYS.sessions, nextRows);
            return result(saved);
        },
        delete: (id) => {
            const sessionId = String(id);
            deleteRow(STORAGE_KEYS.sessions, id);
            writeList(STORAGE_KEYS.tokens, readList(STORAGE_KEYS.tokens).filter(item => String(item.session_id) !== sessionId));
            writeList(STORAGE_KEYS.chat, readList(STORAGE_KEYS.chat).filter(item => String(item.session_id) !== sessionId));
            return result(null);
        }
    },
    tokens: {
        list: (sessionId) => result(readList(STORAGE_KEYS.tokens).filter(item => String(item.session_id) === String(sessionId))),
        insert: (payload) => result(upsertRow(STORAGE_KEYS.tokens, payload)),
        update: (id, patch) => result(upsertRow(STORAGE_KEYS.tokens, patch, id)),
        delete: (id) => deleteRow(STORAGE_KEYS.tokens, id)
    },
    chat: {
        list: (sessionId) => result(
            readList(STORAGE_KEYS.chat)
                .filter(item => String(item.session_id) === String(sessionId))
                .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
        ),
        insert: (payload) => result(upsertRow(STORAGE_KEYS.chat, payload))
    }
};
