const PROFILE_SETTINGS_KEY = 'taverna_profile_settings';

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const getStoredSettings = () => {
    try {
        return JSON.parse(localStorage.getItem(PROFILE_SETTINGS_KEY)) || {};
    } catch {
        return {};
    }
};

export function showSettings(container, user = null) {
    const stored = getStoredSettings();
    const defaultName = user?.isGuest
        ? user?.user_metadata?.full_name || 'Ospite'
        : user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Viandante';

    const settings = {
        displayName: stored.displayName || defaultName,
        title: stored.title || 'Viandante della Taverna',
        avatarUrl: stored.avatarUrl || user?.user_metadata?.avatar_url || '',
        accent: stored.accent || 'amethyst',
        glow: stored.glow !== false,
        compactCards: stored.compactCards === true
    };

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

    form.onsubmit = (e) => {
        e.preventDefault();
        const nextSettings = {
            displayName: displayName.value.trim() || 'Viandante',
            title: profileTitle.value.trim() || 'Viandante della Taverna',
            avatarUrl: avatarUrl.value.trim(),
            accent: container.querySelector('#accentTheme').value,
            glow: container.querySelector('#glowEffects').checked,
            compactCards: container.querySelector('#compactCards').checked
        };
        localStorage.setItem(PROFILE_SETTINGS_KEY, JSON.stringify(nextSettings));
        saved.textContent = 'Profilo aggiornato.';
        setTimeout(() => { saved.textContent = ''; }, 1800);
    };
}
