import { supabase } from './supabase.js';
import { isLocalDndUser } from './dndLocalStore.js';

const PROFILE_TABLE = 'user_profiles';

const ACCENT_THEMES = {
    amethyst: {
        bright: '#ac78ed',
        light: '#dbc2fc',
        glow: 'rgba(172, 120, 237, 0.24)',
        gradient: 'linear-gradient(135deg, #a276d2, #7242b2)'
    },
    // Keep persisted accent IDs compatible; every variation belongs to amethyst.
    ember: {
        bright: '#bd88d9',
        light: '#efd0fc',
        glow: 'rgba(189, 136, 217, 0.24)',
        gradient: 'linear-gradient(135deg, #b381ce, #8750a4)'
    },
    emerald: {
        bright: '#9e86ee',
        light: '#d3c6ff',
        glow: 'rgba(158, 134, 238, 0.24)',
        gradient: 'linear-gradient(135deg, #9d84db, #6751ac)'
    }
};

const defaultAppearance = {
    accent: 'amethyst',
    glow: true,
    compactCards: false
};

const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

export function applyProfileAppearance(settings = defaultAppearance) {
    const theme = ACCENT_THEMES[settings.accent] || ACCENT_THEMES.amethyst;
    const glow = settings.glow === false ? 'rgba(255, 255, 255, 0.08)' : theme.glow;

    document.documentElement.style.setProperty('--amethyst-bright', theme.bright);
    document.documentElement.style.setProperty('--amethyst-light', theme.light);
    document.documentElement.style.setProperty('--amethyst-glow', glow);
    document.documentElement.style.setProperty('--accent-gradient', theme.gradient);
    document.body.classList.toggle('taverna-no-glow', settings.glow === false);
    document.body.classList.toggle('taverna-compact-cards', settings.compactCards === true);
}

export async function loadAndApplyProfileAppearance(user = null) {
    if (!user?.id || !isUuid(user.id) || isLocalDndUser(user)) {
        applyProfileAppearance(defaultAppearance);
        return defaultAppearance;
    }

    const { data, error } = await supabase
        .from(PROFILE_TABLE)
        .select('accent,glow,compact_cards')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.warn('Aspetto profilo non caricato:', error);
        applyProfileAppearance(defaultAppearance);
        return defaultAppearance;
    }

    const settings = {
        accent: data?.accent || defaultAppearance.accent,
        glow: data?.glow !== false,
        compactCards: data?.compact_cards === true
    };
    applyProfileAppearance(settings);
    return settings;
}
