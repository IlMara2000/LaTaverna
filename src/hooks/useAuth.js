import { supabase } from '../services/supabase.js';

/**
 * Modulo di gestione Autenticazione (Logica di Business)
 */
export const useAuth = () => {
    
    /**
     * Recupera l'utente corrente e la sua sessione
     */
    const getCurrentUser = async () => {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) return null;
        return user;
    };

    /**
     * Effettua il Login con Email e Password
     */
    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data.user;
    };

    /**
     * Effettua il Logout e pulisce la sessione
     */
    const logout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        // Reset totale per sicurezza
        window.location.href = '/';
    };

    /**
     * Registra un nuovo Viandante
     */
    const register = async (email, password, username) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: username,
                },
            },
        });
        if (error) throw error;
        return data;
    };

    /**
     * Inizializza un listener per i cambiamenti di stato (Login/Logout)
     * Utile per reagire in tempo reale se la sessione scade
     */
    const onAuthStateChange = (callback) => {
        return supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session?.user || null);
        });
    };

    return {
        getCurrentUser,
        login,
        logout,
        register,
        onAuthStateChange
    };
};