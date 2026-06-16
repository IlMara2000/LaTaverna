import { supabase } from '../../../services/supabase.js';
import { applyProfileAppearance } from '../../../services/profileAppearance.js';
import {
    loadAndApplyAppPreferences,
    resetAppPreferences,
    updateAppPreferences
} from '../../../services/appPreferences.js';

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
    if (!user?.id) return { error: { message: 'Utente Supabase non disponibile.' } };

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

const switchControl = (id, checked, label) => `
    <label class="settings-switch" for="${id}" aria-label="${escapeHTML(label)}">
        <input id="${id}" type="checkbox" ${checked ? 'checked' : ''}>
        <span aria-hidden="true"></span>
    </label>
`;

const optionRow = ({ title, description, control, className = '' }) => `
    <div class="settings-option ${className}">
        <div class="settings-option-copy">
            <strong>${title}</strong>
            <small>${description}</small>
        </div>
        <div class="settings-option-control">${control}</div>
    </div>
`;

export async function showSettings(container, user = null) {
    const [supabaseUser, preferences] = await Promise.all([
        getSupabaseUser(user),
        loadAndApplyAppPreferences()
    ]);
    const profile = await loadProfileSettings(supabaseUser);
    applyProfileAppearance(profile);

    const accountLabel = supabaseUser?.email || (supabaseUser?.is_anonymous ? 'Sessione ospite sincronizzata' : 'Profilo locale');
    const volumePercent = Math.round(Number(preferences['music.volume']) * 100);

    container.innerHTML = `
        <div class="fade-in settings-page">
            <header class="settings-page-header">
                <button id="settingsBack" class="btn-back-glass settings-back" type="button">TORNA ALLA TAVERNA</button>
                <div>
                    <h1 class="main-title settings-title">IMPOSTAZIONI</h1>
                    <p>Configura profilo, interfaccia e tavolo di gioco.</p>
                </div>
                <span class="settings-sync-state">SALVATAGGIO AUTO</span>
            </header>

            <div class="settings-layout">
                <nav class="settings-nav" aria-label="Sezioni impostazioni">
                    <button class="active" type="button" data-settings-tab="profile">PROFILO</button>
                    <button type="button" data-settings-tab="experience">ESPERIENZA</button>
                    <button type="button" data-settings-tab="tabletop">TAVOLO GDR</button>
                    <button type="button" data-settings-tab="device">DISPOSITIVO</button>
                </nav>

                <main class="settings-panels">
                    <section class="settings-panel active" data-settings-panel="profile">
                        <div class="settings-section-heading">
                            <h2>PROFILO</h2>
                            <p>${escapeHTML(accountLabel)}</p>
                        </div>

                        <div class="settings-profile-preview">
                            <div class="settings-avatar-preview" id="settingsAvatarPreview">
                                ${profile.avatarUrl
                                    ? `<img src="${escapeHTML(profile.avatarUrl)}" alt="">`
                                    : `<span>${escapeHTML(profile.displayName.charAt(0).toUpperCase() || 'V')}</span>`}
                            </div>
                            <div>
                                <h3 id="previewName">${escapeHTML(profile.displayName)}</h3>
                                <p id="previewTitle">${escapeHTML(profile.title)}</p>
                            </div>
                        </div>

                        <form id="profileSettingsForm" class="settings-form">
                            <div class="settings-field-grid">
                                <label>
                                    <span>Nome visualizzato</span>
                                    <input type="text" id="displayName" maxlength="28" value="${escapeHTML(profile.displayName)}">
                                </label>
                                <label>
                                    <span>Titolo profilo</span>
                                    <input type="text" id="profileTitle" maxlength="40" value="${escapeHTML(profile.title)}">
                                </label>
                            </div>
                            <label>
                                <span>Avatar URL</span>
                                <input type="url" id="avatarUrl" placeholder="https://..." value="${escapeHTML(profile.avatarUrl)}">
                            </label>
                            <div class="settings-field-grid">
                                <label>
                                    <span>Colore accento</span>
                                    <select id="accentTheme">
                                        <option value="amethyst" ${profile.accent === 'amethyst' ? 'selected' : ''}>Ametista</option>
                                        <option value="ember" ${profile.accent === 'ember' ? 'selected' : ''}>Brace</option>
                                        <option value="emerald" ${profile.accent === 'emerald' ? 'selected' : ''}>Smeraldo</option>
                                    </select>
                                </label>
                                <label>
                                    <span>Forma delle card</span>
                                    <select id="cardDensity">
                                        <option value="comfortable" ${!profile.compactCards ? 'selected' : ''}>Morbida</option>
                                        <option value="compact" ${profile.compactCards ? 'selected' : ''}>Compatta</option>
                                    </select>
                                </label>
                            </div>
                            ${optionRow({
                                title: 'Effetti luminosi',
                                description: 'Mantiene glow e riflessi del tema scelto.',
                                control: switchControl('glowEffects', profile.glow, 'Effetti luminosi')
                            })}
                            <button type="submit" class="btn-primary settings-save">SALVA PROFILO</button>
                        </form>
                    </section>

                    <section class="settings-panel" data-settings-panel="experience" hidden>
                        <div class="settings-section-heading">
                            <h2>ESPERIENZA</h2>
                            <p>Audio e leggibilita dell'interfaccia.</p>
                        </div>
                        <div class="settings-group">
                            ${optionRow({
                                title: 'Musica',
                                description: 'Attiva la colonna sonora in tutta la Taverna.',
                                control: switchControl('musicEnabled', preferences['music.enabled'], 'Musica')
                            })}
                            ${optionRow({
                                title: 'Volume musica',
                                description: 'Regola il volume senza modificare quello del dispositivo.',
                                className: 'settings-option-range',
                                control: `<div class="settings-range-control"><input id="musicVolume" type="range" min="0" max="100" step="5" value="${volumePercent}"><output id="musicVolumeValue">${volumePercent}%</output></div>`
                            })}
                            <button id="openMusicLibrary" class="settings-action" type="button">APRI LIBRERIA MUSICALE</button>
                        </div>
                        <div class="settings-group">
                            ${optionRow({
                                title: 'Riduci animazioni',
                                description: 'Disattiva movimenti non essenziali e transizioni lunghe.',
                                control: switchControl('reducedMotion', preferences['ui.reduced_motion'], 'Riduci animazioni')
                            })}
                            ${optionRow({
                                title: 'Contrasto elevato',
                                description: 'Rende bordi, testi e controlli piu distinguibili.',
                                control: switchControl('highContrast', preferences['ui.high_contrast'], 'Contrasto elevato')
                            })}
                            ${optionRow({
                                title: 'Dimensione testi',
                                description: 'Aumenta testi e controlli mantenendo il layout responsive.',
                                control: `<select id="textScale"><option value="standard" ${preferences['ui.text_scale'] === 'standard' ? 'selected' : ''}>Standard</option><option value="large" ${preferences['ui.text_scale'] === 'large' ? 'selected' : ''}>Grande</option></select>`
                            })}
                        </div>
                    </section>

                    <section class="settings-panel" data-settings-panel="tabletop" hidden>
                        <div class="settings-section-heading">
                            <h2>TAVOLO GDR</h2>
                            <p>Preferenze condivise da D&D e Pathfinder.</p>
                        </div>
                        <div class="settings-group">
                            ${optionRow({
                                title: 'Dadi animati',
                                description: 'Mostra il lancio tridimensionale prima del risultato.',
                                control: switchControl('diceAnimation', preferences['tabletop.dice_animation'], 'Dadi animati')
                            })}
                            ${optionRow({
                                title: 'Meteo animato',
                                description: 'Visualizza pioggia, neve, temporali e foschia sulla mappa.',
                                control: switchControl('weatherEffects', preferences['tabletop.weather_effects'], 'Meteo animato')
                            })}
                            ${optionRow({
                                title: 'Aggancio alla griglia',
                                description: 'Allinea automaticamente i token alle caselle quando li sposti.',
                                control: switchControl('snapToGrid', preferences['tabletop.snap_to_grid'], 'Aggancio alla griglia')
                            })}
                        </div>
                        <div class="settings-note">
                            Le modifiche al tavolo vengono applicate alla prossima apertura di una sessione.
                        </div>
                    </section>

                    <section class="settings-panel" data-settings-panel="device" hidden>
                        <div class="settings-section-heading">
                            <h2>DISPOSITIVO E DATI</h2>
                            <p>Controlli locali per questo browser.</p>
                        </div>
                        <div class="settings-group settings-actions-list">
                            ${optionRow({
                                title: 'Schermo intero',
                                description: 'Usa tutto lo spazio disponibile durante gioco e sessioni.',
                                control: '<button id="fullscreenToggle" class="settings-inline-button" type="button">ATTIVA</button>'
                            })}
                            ${optionRow({
                                title: 'Ultima destinazione',
                                description: "Rimuove il collegamento rapido all'ultima sezione visitata.",
                                control: '<button id="forgetDestination" class="settings-inline-button" type="button">DIMENTICA</button>'
                            })}
                            ${optionRow({
                                title: 'Ripristina preferenze',
                                description: 'Riporta audio, accessibilita e tavolo ai valori iniziali.',
                                control: '<button id="resetPreferences" class="settings-inline-button danger" type="button">RIPRISTINA</button>'
                            })}
                        </div>
                        <div class="settings-device-info">
                            <span>VERSIONE APP</span>
                            <strong>1.1.0</strong>
                            <small>Preferenze sincronizzate con Supabase e disponibili anche nella cache locale.</small>
                        </div>
                    </section>
                </main>
            </div>

            <div id="settingsSaved" class="settings-toast" role="status" aria-live="polite"></div>
        </div>
    `;

    const saved = container.querySelector('#settingsSaved');
    let statusTimer = null;
    let updateFullscreenButton = null;
    const cleanupSettings = () => {
        if (updateFullscreenButton) document.removeEventListener('fullscreenchange', updateFullscreenButton);
        window.clearTimeout(statusTimer);
        if (window.__settingsCleanup === cleanupSettings) window.__settingsCleanup = null;
    };
    window.__settingsCleanup?.();
    window.__settingsCleanup = cleanupSettings;
    const showStatus = (message, isError = false) => {
        window.clearTimeout(statusTimer);
        saved.textContent = message;
        saved.classList.toggle('error', isError);
        saved.classList.add('visible');
        statusTimer = window.setTimeout(() => saved.classList.remove('visible'), 2400);
    };

    const setPreference = async (patch, successMessage = 'Preferenza aggiornata.') => {
        const { error } = await updateAppPreferences(patch);
        showStatus(error ? `Salvata sul dispositivo. Sync non riuscita: ${error.message}` : successMessage, Boolean(error));
    };

    container.querySelectorAll('[data-settings-tab]').forEach(button => {
        button.onclick = () => {
            const activePanel = button.dataset.settingsTab;
            container.querySelectorAll('[data-settings-tab]').forEach(item => item.classList.toggle('active', item === button));
            container.querySelectorAll('[data-settings-panel]').forEach(panel => {
                const active = panel.dataset.settingsPanel === activePanel;
                panel.hidden = !active;
                panel.classList.toggle('active', active);
            });
        };
    });

    const form = container.querySelector('#profileSettingsForm');
    const displayName = container.querySelector('#displayName');
    const profileTitle = container.querySelector('#profileTitle');
    const avatarUrl = container.querySelector('#avatarUrl');
    const previewName = container.querySelector('#previewName');
    const previewTitle = container.querySelector('#previewTitle');
    const avatarPreview = container.querySelector('#settingsAvatarPreview');

    const updatePreview = () => {
        const nextName = displayName.value.trim() || 'Viandante';
        const nextAvatar = avatarUrl.value.trim();
        previewName.textContent = nextName;
        previewTitle.textContent = profileTitle.value.trim() || 'Viandante della Taverna';
        avatarPreview.innerHTML = nextAvatar
            ? `<img src="${escapeHTML(nextAvatar)}" alt="">`
            : `<span>${escapeHTML(nextName.charAt(0).toUpperCase() || 'V')}</span>`;
    };

    displayName.oninput = updatePreview;
    profileTitle.oninput = updatePreview;
    avatarUrl.onchange = updatePreview;

    form.onsubmit = async (event) => {
        event.preventDefault();
        const nextProfile = {
            displayName: displayName.value.trim() || 'Viandante',
            title: profileTitle.value.trim() || 'Viandante della Taverna',
            avatarUrl: avatarUrl.value.trim(),
            accent: container.querySelector('#accentTheme').value,
            glow: container.querySelector('#glowEffects').checked,
            compactCards: container.querySelector('#cardDensity').value === 'compact'
        };
        const { error } = await saveProfileSettings(supabaseUser, nextProfile);
        if (!error) applyProfileAppearance(nextProfile);
        showStatus(error ? `Profilo non salvato: ${error.message}` : 'Profilo aggiornato.', Boolean(error));
    };

    const controls = {
        musicEnabled: ['music.enabled', 'Musica aggiornata.'],
        reducedMotion: ['ui.reduced_motion', 'Animazioni aggiornate.'],
        highContrast: ['ui.high_contrast', 'Contrasto aggiornato.'],
        diceAnimation: ['tabletop.dice_animation', 'Animazione dadi aggiornata.'],
        weatherEffects: ['tabletop.weather_effects', 'Effetti meteo aggiornati.'],
        snapToGrid: ['tabletop.snap_to_grid', 'Aggancio alla griglia aggiornato.']
    };

    Object.entries(controls).forEach(([id, [key, message]]) => {
        container.querySelector(`#${id}`).onchange = (event) => setPreference({ [key]: event.target.checked }, message);
    });

    container.querySelector('#textScale').onchange = (event) => setPreference({
        'ui.text_scale': event.target.value
    }, 'Dimensione testi aggiornata.');

    const volume = container.querySelector('#musicVolume');
    const volumeValue = container.querySelector('#musicVolumeValue');
    volume.oninput = () => { volumeValue.textContent = `${volume.value}%`; };
    volume.onchange = () => setPreference({ 'music.volume': Number(volume.value) / 100 }, 'Volume aggiornato.');

    container.querySelector('#openMusicLibrary').onclick = async () => {
        cleanupSettings();
        const { AudioManager } = await import('../../ui/AudioManager.js');
        AudioManager.showMusicCenter(container);
    };

    const fullscreenButton = container.querySelector('#fullscreenToggle');
    updateFullscreenButton = () => {
        fullscreenButton.textContent = document.fullscreenElement ? 'ESCI' : 'ATTIVA';
    };
    updateFullscreenButton();
    document.addEventListener('fullscreenchange', updateFullscreenButton);
    fullscreenButton.onclick = async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
            updateFullscreenButton();
        } catch (err) {
            showStatus('Schermo intero non disponibile su questo browser.', true);
        }
    };

    container.querySelector('#forgetDestination').onclick = () => {
        localStorage.removeItem('taverna_last_destination');
        showStatus('Ultima destinazione rimossa.');
    };

    container.querySelector('#resetPreferences').onclick = async () => {
        if (!window.confirm("Ripristinare tutte le preferenze dell'app?")) return;
        const { values, error } = await resetAppPreferences();
        container.querySelector('#musicEnabled').checked = values['music.enabled'];
        container.querySelector('#musicVolume').value = Math.round(values['music.volume'] * 100);
        volumeValue.textContent = `${Math.round(values['music.volume'] * 100)}%`;
        container.querySelector('#reducedMotion').checked = values['ui.reduced_motion'];
        container.querySelector('#highContrast').checked = values['ui.high_contrast'];
        container.querySelector('#textScale').value = values['ui.text_scale'];
        container.querySelector('#diceAnimation').checked = values['tabletop.dice_animation'];
        container.querySelector('#weatherEffects').checked = values['tabletop.weather_effects'];
        container.querySelector('#snapToGrid').checked = values['tabletop.snap_to_grid'];
        showStatus(error ? `Ripristino locale completato. Sync non riuscita: ${error.message}` : 'Preferenze ripristinate.', Boolean(error));
    };

    container.querySelector('#settingsBack').onclick = async () => {
        cleanupSettings();
        const { showLobby } = await import('../../../lobby.js');
        showLobby(container);
    };
}
