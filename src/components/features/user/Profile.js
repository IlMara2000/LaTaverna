import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';

const PROFILE_TABLE = 'user_profiles';

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const defaultProfile = (user = null) => ({
    display_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Viandante',
    title: 'Viandante della Taverna',
    avatar_url: user?.user_metadata?.avatar_url || ''
});

const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

async function resolveUser(seedUser = null) {
    if (seedUser?.id) return seedUser;
    const { data: { user } } = await supabase.auth.getUser();
    return user || null;
}

async function loadStoredProfile(user) {
    const fallback = defaultProfile(user);
    if (!user?.id || !isUuid(user.id)) return fallback;

    const { data, error } = await supabase
        .from(PROFILE_TABLE)
        .select('display_name,title,avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.warn('Profilo non caricato:', error);
        return fallback;
    }

    return {
        display_name: data?.display_name || fallback.display_name,
        title: data?.title || fallback.title,
        avatar_url: data?.avatar_url || fallback.avatar_url
    };
}

async function countRows(tableName, userId, extraFilters = []) {
    if (!userId || !isUuid(userId)) return 0;

    let query = supabase
        .from(tableName)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

    extraFilters.forEach(([column, value]) => {
        query = query.eq(column, value);
    });

    const { count, error } = await query;
    if (error) {
        console.warn(`Conteggio ${tableName} non disponibile:`, error);
        return 0;
    }
    return count || 0;
}

export async function showProfile(container, user) {
    const resolvedUser = await resolveUser(user);
    const [profile, characterCount, sessionCount] = await Promise.all([
        loadStoredProfile(resolvedUser),
        countRows(SUPABASE_CONFIG.tables.characters, resolvedUser?.id, [['system_id', 'dnd5e']]),
        countRows(SUPABASE_CONFIG.tables.sessions, resolvedUser?.id)
    ]);

    const avatar = profile.avatar_url || 'https://placehold.co/100x100?text=V';
    const name = escapeHTML(profile.display_name);
    const title = escapeHTML(profile.title);
    const email = escapeHTML(resolvedUser?.email || 'Email non disponibile');

    container.innerHTML = `
        <div class="fade-in" style="padding: 20px; max-width: 600px; margin: 0 auto;">
            <button id="profileBack" class="btn-back-glass" style="width:auto; margin-bottom:20px;">TORNA ALLA LIBRERIA</button>
            
            <h1 style="font-weight: 900; letter-spacing: -1px; margin-bottom: 30px;">IL MIO <span style="color:var(--amethyst-bright);">PROFILO</span></h1>
            
            <div style="background: rgba(157, 78, 221, 0.05); border: 1px solid var(--amethyst-glow); border-radius: 24px; padding: 40px; text-align: center; backdrop-filter: blur(10px);">
                <img src="${escapeHTML(avatar)}" alt="" style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%; border: 3px solid var(--amethyst-bright); margin-bottom: 20px; box-shadow: 0 0 20px var(--amethyst-glow);">
                <h2 style="margin: 0; text-transform: uppercase; letter-spacing: 1px;">${name}</h2>
                <p style="opacity: 0.8; font-size: 13px; margin: 6px 0 0 0;">${title}</p>
                <p style="opacity: 0.5; font-size: 14px; margin-top: 5px;">${email}</p>
                
                <div style="margin-top: 30px; padding-top: 30px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-around; gap: 20px;">
                    <div>
                        <span style="display:block; font-size: 20px; font-weight: 900; color: var(--amethyst-bright);">${characterCount}</span>
                        <span style="font-size: 10px; opacity: 0.5; text-transform: uppercase;">Eroi Creati</span>
                    </div>
                    <div>
                        <span style="display:block; font-size: 20px; font-weight: 900; color: var(--amethyst-bright);">${sessionCount}</span>
                        <span style="font-size: 10px; opacity: 0.5; text-transform: uppercase;">Cronache</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.querySelector('#profileBack').onclick = async () => {
        const { showLobby } = await import('../../../lobby.js');
        showLobby(container);
    };
}
