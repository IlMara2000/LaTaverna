import { createClient } from '@supabase/supabase-js'

// Recuperiamo le chiavi dalle variabili d'ambiente di Vite/Vercel
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Inizializzazione del client unico per tutta l'app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * CONFIGURAZIONE TABELLE E BUCKET
 * Centralizziamo qui i nomi per evitare di cercarli in giro per i file
 */
export const SUPABASE_CONFIG = {
    tables: {
        maps: 'session',         // Le tue sessioni/tavoli
        tokens: 'tokens',       // Token sulla mappa
        characters: 'characters', // Personaggi/Eroi (aggiornato per coerenza SQL)
        chat: 'chat_messages',  // Messaggi live
        manuals: 'assets',      // PDF e manuali
    },
    buckets: {
        zaino: 'vtt_assets'     // Il nome del bucket nello Storage
    }
};

// Log di conferma (visibile solo in console per debug)
console.log("🛡️ Taverna Supabase: Sistema Centralizzato Pronto.");