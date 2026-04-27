import { supabase } from '../../../services/supabase.js';

const PROFILE_TABLE = 'user_profiles';

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

async function getSupabaseUser(seedUser = null) {
    if (seedUser?.id && isUuid(seedUser.id)) return seedUser;

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id && isUuid(user.id)) return user;

    try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error && data?.user?.id) {
            localStorage.removeItem('taverna_guest_user');
            return data.user;
        }
    } catch (err) {
        console.warn('Login anonimo Supabase non disponibile:', err);
    }

    return null;
}

function defaultSettings(user = null) {
    const defaultName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Viandante';
    return {
        displayName: defaultName,
        title: 'Viandante della Taverna',
        avatarUrl: user?.user_metadata?.avatar_url || '',
        accent: 'amethyst',
        glow: true,
        compactCards: false
    };
}

async function loadProfileSettings(user) {
    const defaults = defaultSettings(user);
    if (!user?.id) return defaults;

    const { data, error } = await supabase
        .from(PROFILE_TABLE)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) {
        console.warn('Profilo Supabase non caricato:', error);
        return defaults;
    }

    return {
        displayName: data?.display_name || defaults.displayName,
        title: data?.title || defaults.title,
        avatarUrl: data?.avatar_url || defaults.avatarUrl,
        accent: data?.accent || defaults.accent,
        glow: data?.glow !== false,
        compactCards: data?.compact_cards === true
    };
}

async function saveProfileSettings(user, settings) {
    if (!user?.id) {
        return { error: { message: 'Utente Supabase non disponibile.' } };
    }

    return supabase
        .from(PROFILE_TABLE)
        .upsert({
            user_id: user.id,
            display_name: settings.displayName,
            title: settings.title,
            avatar_url: settings.avatarUrl,
            accent: settings.accent,
            glow: settings.glow,
            compact_cards: settings.compactCards,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
}

export async function showSettings(container, user = null) {
    const supabaseUser = await getSupabaseUser(user);
    const settings = await loadProfileSettings(supabaseUser);

    container.innerHTML = `
        <div class="fade-in settings-profile-page">
            <button id="settingsBack" class="btn-back-glass settings-back">TORNA ALLA LIBRERIA</button>

            <header class="settings-profile-header">
                <p class="settings-kicker">Profilo utente</p>
                <h1 class="main-title settings-title">PERSONALIZZA</h1>
            </header>

            <section class="settings-profile-preview glass-box">
                <div class="settings-avatar-preview">
                    ${settings.avatarUrl
                        ? `<img src="${escapeHTML(settings.avatarUrl)}" alt="">`
                        : `<span>${escapeHTML(settings.displayName.charAt(0).toUpperCase() || 'V')}</span>`}
                </div>
                <div>
                    <h2 id="previewName">${escapeHTML(settings.displayName)}</h2>
                    <p id="previewTitle">${escapeHTML(settings.title)}</p>
                </div>
            </section>

            <form id="profileSettingsForm" class="settings-form glass-box">
                <label>
                    <span>Nome visualizzato</span>
                    <input type="text" id="displayName" maxlength="28" value="${escapeHTML(settings.displayName)}">
                </label>

                <label>
                    <span>Titolo profilo</span>
                    <input type="text" id="profileTitle" maxlength="40" value="${escapeHTML(settings.title)}">
                </label>

                <label>
                    <span>Avatar URL</span>
                    <input type="text" id="avatarUrl" placeholder="https://..." value="${escapeHTML(settings.avatarUrl)}">
                </label>

                <div class="settings-row">
                    <span>Tema accento</span>
                    <select id="accentTheme">
                        <option value="amethyst" ${settings.accent === 'amethyst' ? 'selected' : ''}>Ametista</option>
                        <option value="ember" ${settings.accent === 'ember' ? 'selected' : ''}>Brace</option>
                        <option value="emerald" ${settings.accent === 'emerald' ? 'selected' : ''}>Smeraldo</option>
                    </select>
                </div>

                <label class="settings-check">
                    <span>Effetti glow</span>
                    <input type="checkbox" id="glowEffects" ${settings.glow ? 'checked' : ''}>
                </label>

                <label class="settings-check">
                    <span>Card compatte</span>
                    <input type="checkbox" id="compactCards" ${settings.compactCards ? 'checked' : ''}>
                </label>

                <button type="submit" class="btn-primary settings-save">SALVA PROFILO</button>
                <p id="settingsSaved" class="settings-saved" aria-live="polite"></p>
            </form>
        </div>
    `;

    const form = container.querySelector('#profileSettingsForm');
    const displayName = container.querySelector('#displayName');
    const profileTitle = container.querySelector('#profileTitle');
    const avatarUrl = container.querySelector('#avatarUrl');
    const previewName = container.querySelector('#previewName');
    const previewTitle = container.querySelector('#previewTitle');
    const saved = container.querySelector('#settingsSaved');

    const updatePreview = () => {
        previewName.textContent = displayName.value.trim() || 'Viandante';
        previewTitle.textContent = profileTitle.value.trim() || 'Viandante della Taverna';
    };

    displayName.oninput = updatePreview;
    profileTitle.oninput = updatePreview;
    container.querySelector('#settingsBack').onclick = async () => {
        const { showLobby } = await import('../../../lobby.js');
        showLobby(container);
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const nextSettings = {
            displayName: displayName.value.trim() || 'Viandante',
            title: profileTitle.value.trim() || 'Viandante della Taverna',
            avatarUrl: avatarUrl.value.trim(),
            accent: container.querySelector('#accentTheme').value,
            glow: container.querySelector('#glowEffects').checked,
            compactCards: container.querySelector('#compactCards').checked
        };

        const { error } = await saveProfileSettings(supabaseUser, nextSettings);
        saved.textContent = error ? `Errore Supabase: ${error.message}` : 'Profilo aggiornato su Supabase.';
        setTimeout(() => { saved.textContent = ''; }, 2200);
    };
}
