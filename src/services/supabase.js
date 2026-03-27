import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ ERRORE SUPABASE: Chiavi mancanti nel file .env!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
