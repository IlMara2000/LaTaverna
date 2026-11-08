import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

const unavailable = (message) => ({
    data: null,
    error: { message }
});

const createFallbackQuery = (result = { data: [], error: null }) => {
    const query = {
        select: () => query,
        eq: () => query,
        neq: () => query,
        order: () => query,
        limit: () => query,
        insert: () => createFallbackQuery(unavailable("Database non disponibile senza configurazione Supabase.")),
        update: () => createFallbackQuery(unavailable("Database non disponibile senza configurazione Supabase.")),
        upsert: () => createFallbackQuery(unavailable("Database non disponibile senza configurazione Supabase.")),
        delete: () => createFallbackQuery(unavailable("Database non disponibile senza configurazione Supabase.")),
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => result.error ? result : { data: null, error: null },
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
    };
    return query;
};

const createLocalFallbackClient = () => ({
    auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        signOut: async () => ({ error: null }),
        signInAnonymously: async () => ({
            data: null,
            error: { message: "Configura Supabase e abilita Anonymous Sign-Ins." }
        }),
        signInWithOAuth: async () => ({
            data: null,
            error: { message: "Configura VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nel file .env." }
        })
    },
    storage: {
        from: () => ({
            list: async () => ({ data: [], error: null }),
            upload: async () => ({ data: null, error: { message: "Storage non disponibile senza configurazione Supabase." } }),
            getPublicUrl: () => ({ data: { publicUrl: "" } })
        })
    },
    from: () => createFallbackQuery()
});

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase non configurato: avvio in modalità locale limitata.");
}

// Il link di recupero password porta i token nel frammento, e il client li
// consuma e li cancella appena viene creato: qui li leggiamo prima, così la
// guardia di avvio può ancora riconoscere il tipo "recovery".
export const INITIAL_URL_HASH = typeof window === 'undefined' ? '' : window.location.hash;
export const INITIAL_URL_SEARCH = typeof window === 'undefined' ? '' : window.location.search;

// L'intento va ricordato subito: il client ripulisce il frammento e un reload
// dell'app ripartirebbe da un URL che non dice più nulla del recupero.
if (/[#?&]type=recovery(&|$)/.test(`${INITIAL_URL_HASH}${INITIAL_URL_SEARCH}`)) {
    try {
        sessionStorage.setItem('taverna_password_recovery', '1');
        sessionStorage.setItem('taverna_password_recovery_stamp', String(Date.now()));
    } catch {
        // Storage negato: resta la lettura del frammento.
    }
}

export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createLocalFallbackClient();

export const SUPABASE_CONFIG = {
    tables: {
        sessions: 'dnd_sessions',
        tokens: 'dnd_tokens',
        characters: 'characters',
        chat: 'dnd_chat',
        assets: 'assets',
        systems: 'game_systems',
        minigameRooms: 'minigame_rooms'
    },
    buckets: {
        zaino: 'vtt_assets'
    }
};

export const getSession = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session;
};

console.log("🛡️ Taverna Supabase: Sistema Multi-Game Pronto.");
