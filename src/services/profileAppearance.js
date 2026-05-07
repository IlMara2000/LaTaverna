import { supabase } from './supabase.js';
import { isLocalDndUser } from './dndLocalStore.js';

const PROFILE_TABLE = 'user_profiles';

const ACCENT_THEMES = {
    amethyst: {
        bright: '#9d4ede',
        light: '#c77dff',
        glow: 'rgba(157, 78, 221, 0.5)',
        gradient: 'linear-gradient(135deg, #9d4ede 0%, #5a189a 100%)'
    },
    ember: {
        bright: '#ff7a3d',
        light: '#ffb36b',
        glow: 'rgba(255, 122, 61, 0.42)',
        gradient: 'linear-gradient(135deg, #ff7a3d 0%, #a83232 100%)'
    },
    emerald: {
        bright: '#00c48c',
        light: '#57f0bc',
        glow: 'rgba(0, 196, 140, 0.36)',
        gradient: 'linear-gradient(135deg, #00c48c 0%, #087f5b 100%)'
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
