import { createClient } from '@supabase/supabase-js'

// 1. Recupero chiavi con fallback per evitare crash fatali durante il build
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Controllo di sicurezza: se mancano le chiavi, avvisa chiaramente lo sviluppatore
if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ ERRORE SUPABASE: Chiavi mancanti nel file .env! Controlla VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
}

// 2. Inizializzazione del client unico
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * CONFIGURAZIONE TABELLE E BUCKET
 * Centralizziamo qui i nomi per evitare errori di battitura nei file
 */
export const SUPABASE_CONFIG = {
    tables: {
        maps: 'session',          
        tokens: 'tokens',       
        characters: 'characters', 
        chat: 'chat_messages',  
        manuals: 'assets',      
    },
    buckets: {
        zaino: 'vtt_assets'     
    }
};

// 3. Helper per ricaricare la sessione (utile per la logica Discord che stiamo facendo)
export const getSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    return data.session;
};

console.log("🛡️ Taverna Supabase: Sistema Centralizzato Pronto.");