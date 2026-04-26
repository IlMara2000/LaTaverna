import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const createLocalFallbackClient = () => ({
    auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        signOut: async () => ({ error: null }),
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
    from: () => ({
        select: () => ({
            eq: () => ({
                order: async () => ({ data: [], error: null })
            })
        }),
        insert: async () => ({ data: null, error: { message: "Database non disponibile senza configurazione Supabase." } })
    })
});

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase non configurato: avvio in modalità locale limitata.");
}

export const supabase = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createLocalFallbackClient();

export const SUPABASE_CONFIG = {
    tables: {
        sessions: 'session',      // Le campagne attive
        tokens: 'tokens',         // Token sulle mappe
        characters: 'characters', // Personaggi (filtrati per system_id)
        chat: 'chat_messages',    // Messaggi live
        assets: 'assets',         // Immagini e PDF
        systems: 'game_systems'   // Tabella definizioni sistemi (D&D, Pathfinder, etc.)
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
