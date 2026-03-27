import { supabase } from '../services/supabase.js';

export const useAuth = () => {
    
    // Recupera l'utente e la sessione
    const getCurrentUser = async () => {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) return null;
        return user;
    };

    // LOGIN SOCIALE CON DISCORD
    const loginWithDiscord = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                // 'guilds' serve per vedere se è nel tuo server
                scopes: 'identify email guilds',
                redirectTo: window.location.origin 
            }
        });
        if (error) throw error;
    };

    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data.user;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('taverna_member_verified');
        window.location.href = '/';
    };

    const onAuthStateChange = (callback) => {
        return supabase.auth.onAuthStateChange((event, session) => {
            callback(event, session?.user || null);
        });
    };

    return {
        getCurrentUser,
        loginWithDiscord,
        login,
        logout,
        onAuthStateChange
    };
};