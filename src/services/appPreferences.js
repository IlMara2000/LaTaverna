import { getPreferences, setPreferences } from './userPreferences.js';

const CACHE_KEY = 'taverna_app_preferences';

export const APP_PREFERENCE_DEFAULTS = Object.freeze({
    'music.enabled': true,
    'music.volume': 0.5,
    'ui.reduced_motion': false,
    'ui.high_contrast': false,
    'ui.text_scale': 'standard',
    'tabletop.dice_animation': true,
    'tabletop.weather_effects': true,
    'tabletop.snap_to_grid': true
});

const clamp = (value, min, max) => Math.min(Math.max(Number(value), min), max);

const normalizePreferences = (values = {}) => ({
    ...APP_PREFERENCE_DEFAULTS,
    ...values,
    'music.enabled': values['music.enabled'] !== false,
    'music.volume': clamp(values['music.volume'] ?? APP_PREFERENCE_DEFAULTS['music.volume'], 0, 1),
    'ui.reduced_motion': values['ui.reduced_motion'] === true,
    'ui.high_contrast': values['ui.high_contrast'] === true,
    'ui.text_scale': values['ui.text_scale'] === 'large' ? 'large' : 'standard',
    'tabletop.dice_animation': values['tabletop.dice_animation'] !== false,
    'tabletop.weather_effects': values['tabletop.weather_effects'] !== false,
    'tabletop.snap_to_grid': values['tabletop.snap_to_grid'] !== false
});

const readCache = () => {
    try {
        return normalizePreferences(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'));
    } catch {
        return normalizePreferences();
    }
};

const writeCache = (values) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(values));
    } catch {
        // Le preferenze restano applicate anche quando lo storage non e disponibile.
    }
};

export function getCachedAppPreferences() {
    return readCache();
}

export function getCachedAppPreference(key, fallbackValue = APP_PREFERENCE_DEFAULTS[key]) {
    return readCache()[key] ?? fallbackValue;
}

export function applyAppPreferences(values = readCache()) {
    const preferences = normalizePreferences(values);
    const root = document.documentElement;
    root.classList.toggle('app-reduced-motion', preferences['ui.reduced_motion']);
    root.classList.toggle('app-high-contrast', preferences['ui.high_contrast']);
    root.classList.toggle('app-large-text', preferences['ui.text_scale'] === 'large');
    root.dataset.weatherEffects = preferences['tabletop.weather_effects'] ? 'on' : 'off';
    root.dataset.diceAnimation = preferences['tabletop.dice_animation'] ? 'on' : 'off';
    return preferences;
}

export function applyCachedAppPreferences() {
    return applyAppPreferences(readCache());
}

export async function loadAndApplyAppPreferences() {
    const cached = applyCachedAppPreferences();
    const remote = normalizePreferences(await getPreferences(cached));
    writeCache(remote);
    applyAppPreferences(remote);
    window.dispatchEvent(new CustomEvent('appPreferencesLoaded', { detail: remote }));
    return remote;
}

export async function updateAppPreferences(patch = {}) {
    const next = normalizePreferences({ ...readCache(), ...patch });
    writeCache(next);
    applyAppPreferences(next);
    window.dispatchEvent(new CustomEvent('appPreferencesChanged', { detail: { values: next, patch } }));
    const { error } = await setPreferences(patch);
    return { values: next, error };
}

export async function resetAppPreferences() {
    const defaults = normalizePreferences();
    writeCache(defaults);
    applyAppPreferences(defaults);
    window.dispatchEvent(new CustomEvent('appPreferencesChanged', {
        detail: { values: defaults, patch: defaults }
    }));
    const { error } = await setPreferences(defaults);
    return { values: defaults, error };
}
