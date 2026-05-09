const SYSTEMS = {
    dnd5e: {
        prefix: 'taverna_dnd5e_local_',
        email: 'ospite-locale@lataverna.local',
        flag: 'is_local_dnd'
    },
    pathfinder2e: {
        prefix: 'taverna_pathfinder2e_local_',
        email: 'ospite-pathfinder@lataverna.local',
        flag: 'is_local_pathfinder'
    }
};

const createUuid = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
        (Number(c) ^ globalThis.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(c) / 4).toString(16)
    );
};

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

const createLocalGameStore = (systemId) => {
    const config = SYSTEMS[systemId] || SYSTEMS.dnd5e;
    const userKey = `${config.prefix}user_id`;
    const storageKeys = {
        characters: `${config.prefix}characters`,
        sessions: `${config.prefix}sessions`,
        tokens: `${config.prefix}tokens`,
        chat: `${config.prefix}chat`
    };

    const getLocalUser = () => {
        let id = localStorage.getItem(userKey);
        if (!id) {
            id = createUuid();
            localStorage.setItem(userKey, id);
        }
        return {
            id,
            email: config.email,
            is_anonymous: true,
            is_local_rpg: true,
            [config.flag]: true,
            user_metadata: {
                full_name: 'Ospite Locale'
            }
        };
    };

    const isLocalUserId = (userId) => Boolean(userId && localStorage.getItem(userKey) === String(userId));
    const isLocalUser = (user) => Boolean(user?.[config.flag]) || isLocalUserId(user?.id);

    const store = {
        characters: {
            list: (userId) => result(
                readList(storageKeys.characters)
                    .filter(item => String(item.user_id) === String(userId))
                    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
            ),
            save: (char, payload) => result(upsertRow(storageKeys.characters, payload, char?.id)),
            delete: (id) => deleteRow(storageKeys.characters, id)
        },
        sessions: {
            list: (userId) => result(
                readList(storageKeys.sessions)
                    .filter(item => String(item.user_id) === String(userId))
                    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
            ),
            get: (id) => result(readList(storageKeys.sessions).find(item => String(item.id) === String(id)) || null),
            save: (session, payload) => result(upsertRow(storageKeys.sessions, payload, session?.id)),
            updateData: (id, data) => {
                const rows = readList(storageKeys.sessions);
                const timestamp = now();
                let saved = null;
                const nextRows = rows.map(item => {
                    if (String(item.id) !== String(id)) return item;
                    saved = { ...item, data, updated_at: timestamp };
                    return saved;
                });
                writeList(storageKeys.sessions, nextRows);
                return result(saved);
            },
            delete: (id) => {
                const sessionId = String(id);
                deleteRow(storageKeys.sessions, id);
                writeList(storageKeys.tokens, readList(storageKeys.tokens).filter(item => String(item.session_id) !== sessionId));
                writeList(storageKeys.chat, readList(storageKeys.chat).filter(item => String(item.session_id) !== sessionId));
                return result(null);
            }
        },
        tokens: {
            list: (sessionId) => result(readList(storageKeys.tokens).filter(item => String(item.session_id) === String(sessionId))),
            insert: (payload) => result(upsertRow(storageKeys.tokens, payload)),
            update: (id, patch) => result(upsertRow(storageKeys.tokens, patch, id)),
            delete: (id) => deleteRow(storageKeys.tokens, id)
        },
        chat: {
            list: (sessionId) => result(
                readList(storageKeys.chat)
                    .filter(item => String(item.session_id) === String(sessionId))
                    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
            ),
            insert: (payload) => result(upsertRow(storageKeys.chat, payload))
        }
    };

    return {
        getLocalUser,
        isLocalUser,
        isLocalUserId,
        store
    };
};

const dndLocal = createLocalGameStore('dnd5e');
const pathfinderLocal = createLocalGameStore('pathfinder2e');

export const getLocalDndUser = dndLocal.getLocalUser;
export const isLocalDndUser = dndLocal.isLocalUser;
export const isLocalDndUserId = dndLocal.isLocalUserId;
export const dndLocalStore = dndLocal.store;

export const getLocalPathfinderUser = pathfinderLocal.getLocalUser;
export const isLocalPathfinderUser = pathfinderLocal.isLocalUser;
export const isLocalPathfinderUserId = pathfinderLocal.isLocalUserId;
export const pathfinderLocalStore = pathfinderLocal.store;
