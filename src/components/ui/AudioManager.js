import { renderHomeBackButton } from './BackButton.js';
import { navigateTo } from '../../services/appNavigation.js';
import { createMusicPlayer } from '../../services/musicPlayer.js';

import { getPreferences, setPreference } from '../../services/userPreferences.js';
import { getCachedAppPreference, updateAppPreferences } from '../../services/appPreferences.js';

import PLAYLISTS from '../../data/musicCatalog.json';

let playback = { state: 'idle', message: 'Scegli una traccia e premi Play.' };
let preferenceRevision = 0;
const player = createMusicPlayer({ onState: state => {
    playback = state;
    const label = document.getElementById('musicPlaybackStatus');
    if (label) { label.textContent = state.message; label.dataset.state = state.state; }
    const track = document.getElementById('selectedTrackName');
    if (track) track.textContent = currentTrackName;
    window.dispatchEvent(new CustomEvent(state.state === 'playing' ? 'musicStarted' : 'musicStateChanged', {
        detail: { ...state, playlistKey: currentPlaylistKey, trackName: currentTrackName }
    }));
} });
let currentTrackIndex = 0;
let currentPlaylistKey = 'tavern';
let currentTrackName = 'Nessuna traccia';
let isMusicEnabled = getCachedAppPreference('music.enabled', true);
let currentVolume = Number(getCachedAppPreference('music.volume', 0.5));
let isPlaylistActive = false;
let preferencesHydration = null;

const getPlaylist = (key = currentPlaylistKey) => PLAYLISTS[key] || PLAYLISTS.tavern;

function hydrateAudioPreferences() {
    if (preferenceRevision) return Promise.resolve();
    if (!preferencesHydration) {
        const revision = preferenceRevision;
        preferencesHydration = getPreferences({
            'music.playlist': currentPlaylistKey,
            'music.track': currentTrackName,
            'music.enabled': isMusicEnabled,
            'music.volume': currentVolume
        }).then(values => {
            if (revision !== preferenceRevision) return;
            currentPlaylistKey = PLAYLISTS[values['music.playlist']] ? values['music.playlist'] : 'tavern';
            currentTrackName = values['music.track'];
            isMusicEnabled = values['music.enabled'];
            currentVolume = Number(values['music.volume']);
            player.setVolume(currentVolume);
        }).catch(error => {
            preferencesHydration = null;
            throw error;
        });
    }
    return preferencesHydration;
}

function persistAudioPreferences() {
    void setPreference('music.playlist', currentPlaylistKey).catch(console.warn);
    void setPreference('music.track', currentTrackName).catch(console.warn);
}

export const AudioManager = {
    // Riproduzione universale
    play: (url, isPlaylist = false, meta = {}) => {
        preferenceRevision++;
        isPlaylistActive = isPlaylist;
        currentPlaylistKey = PLAYLISTS[meta.playlistKey] ? meta.playlistKey : currentPlaylistKey;
        currentTrackName = meta.trackName || currentTrackName;
        // Explicit Play also works after the user previously switched music off.
        isMusicEnabled = true;
        void updateAppPreferences({ 'music.enabled': true }).catch(console.warn);
        persistAudioPreferences();
        player.setVolume(currentVolume);
        player.select(url, { loop: !isPlaylist, onEnd: () => {
            if (isPlaylistActive) AudioManager.playNext();
        } });
    },

    stop: () => {
        isPlaylistActive = false;
        player.stop();
    },
    resume: () => {
        if (player.hasSource()) player.resume();
        else {
            const track = getPlaylist().tracks[currentTrackIndex] || getPlaylist().tracks[0];
            AudioManager.play(track.url, true, { trackName: track.name, playlistKey: currentPlaylistKey });
        }
    },

    playNext: () => {
        const playlist = getPlaylist();
        currentTrackIndex = (currentTrackIndex + 1) % playlist.tracks.length;
        const track = playlist.tracks[currentTrackIndex];
        AudioManager.play(track.url, true, {
            playlistKey: currentPlaylistKey,
            trackName: track.name
        });
    },

    // UI del Music Center
    setMusicEnabled: (enabled) => {
        preferenceRevision++;
        isMusicEnabled = Boolean(enabled);
        if (isMusicEnabled) AudioManager.resume();
        else player.pause();
        void updateAppPreferences({ 'music.enabled': isMusicEnabled }).catch(console.warn);
    },

    setVolume: (volume) => {
        preferenceRevision++;
        currentVolume = Math.min(Math.max(Number(volume) || 0, 0), 1);
        player.setVolume(currentVolume);
        void updateAppPreferences({ 'music.volume': currentVolume }).catch(console.warn);
    },

    showMusicCenter: async (container, navigation = null) => {
        if (navigation && !navigation.beforeRender()) return;
        const selectedPlaylist = getPlaylist();
        container.innerHTML = `
            <div class="music-center fade-in">
                ${renderHomeBackButton({ id: 'musicBack' })}

                <header class="music-header">
                    <p class="settings-kicker">Audio ambiente</p>
                    <h1 class="main-title music-title">LIBRERIA MUSICALE</h1>
                </header>

                <section class="music-now glass-box">
                    <span class="music-now-label">Playlist selezionata</span>
                    <strong id="selectedPlaylistName">${selectedPlaylist.label}</strong>
                    <p id="selectedTrackName"></p>
                    <p id="musicPlaybackStatus" class="music-status" role="status" aria-live="polite"></p>
                </section>

                <section class="music-playlists">
                    ${Object.entries(PLAYLISTS).map(([playlistKey, playlist]) => `
                        <article class="music-playlist glass-box ${playlistKey === currentPlaylistKey ? 'is-selected' : ''}" data-playlist="${playlistKey}">
                            <div class="music-playlist-head">
                                <div>
                                    <h2>${playlist.label}</h2>
                                    <p>${playlist.description}</p>
                                </div>
                                <button class="music-playlist-select" data-playlist="${playlistKey}" type="button">SELEZIONA</button>
                            </div>

                            <div class="music-track-list">
                                ${playlist.tracks.map((track, index) => `
                                    <button class="music-track" data-playlist="${playlistKey}" data-index="${index}" data-url="${track.url}" type="button">
                                        <span class="music-track-copy"><strong>${track.name}</strong><small>${track.title} · ${track.artist}</small></span>
                                        <small class="music-track-mood">${track.tags}</small>
                                    </button>
                                `).join('')}
                            </div>
                        </article>
                    `).join('')}
                </section>

                <details class="music-credits glass-box">
                    <summary>Brani, autori e download gratuiti</summary>
                    <p>Registrazioni complete di autori diversi, disponibili con licenze libere. Volume uniformato e conversione MP3; melodie e tempi originali.</p>
                    <ul>${Object.values(PLAYLISTS).flatMap(playlist => playlist.tracks).map(track => `
                        <li><strong>${track.title}</strong> — ${track.artist}<br>
                            <a href="${track.source}" target="_blank" rel="noopener noreferrer">Fonte e autore</a> ·
                            <a href="${track.licenseUrl}" target="_blank" rel="noopener noreferrer">${track.license}</a> ·
                            <a href="${track.url}" download>Scarica MP3</a>
                        </li>`).join('')}</ul>
                    <p>Vaporware: The Cynic Project · <a href="https://cynicmusic.com" target="_blank" rel="noopener noreferrer">cynicmusic.com</a> · <a href="https://pixelsphere.org" target="_blank" rel="noopener noreferrer">pixelsphere.org</a>.</p>
                </details>

                <div class="music-actions">
                    <button id="playSelectedPlaylist" class="btn-primary" type="button">AVVIA PLAYLIST</button>
                    <button id="uploadLocalTrack" class="btn-back-glass" type="button">CARICA FILE</button>
                    <button id="resumeMusic" class="btn-back-glass" type="button">RIPRENDI</button>
                    <button id="stopMusic" class="btn-back-glass" type="button">STOP MUSICA</button>
                    <input id="localTrackInput" type="file" accept="audio/*" style="display:none;">
                </div>
            </div>
        `;

        const statusLabel = container.querySelector('#musicPlaybackStatus');
        statusLabel.textContent = playback.message;
        statusLabel.dataset.state = playback.state;
        container.querySelector('#selectedTrackName').textContent = currentTrackName;
        const refreshSelectionUI = () => {
            const playlist = getPlaylist();
            container.querySelector('#selectedPlaylistName').textContent = playlist.label;
            container.querySelector('#selectedTrackName').textContent = currentTrackName;
            container.querySelectorAll('.music-playlist').forEach(card => {
                card.classList.toggle('is-selected', card.dataset.playlist === currentPlaylistKey);
            });
        };

        void hydrateAudioPreferences().then(() => {
            if (container.querySelector('#selectedPlaylistName')) refreshSelectionUI();
        }).catch(() => {});

        container.querySelectorAll('.music-playlist-select').forEach(btn => {
            btn.onclick = () => {
                isPlaylistActive = false;
                currentPlaylistKey = btn.dataset.playlist;
                currentTrackIndex = 0;
                currentTrackName = getPlaylist().tracks[0]?.name || 'Nessuna traccia';
                persistAudioPreferences();
                refreshSelectionUI();
            };
        });

        container.querySelectorAll('.music-track').forEach(btn => {
            btn.onclick = () => {
                currentPlaylistKey = btn.dataset.playlist;
                currentTrackIndex = parseInt(btn.dataset.index, 10);
                const playlist = getPlaylist();
                const track = playlist.tracks[currentTrackIndex];
                AudioManager.play(track.url, false, {
                    playlistKey: currentPlaylistKey,
                    trackName: track.name
                });
                refreshSelectionUI();
            };
        });

        container.querySelector('#playSelectedPlaylist').onclick = () => {
            const playlist = getPlaylist();
            const track = playlist.tracks[currentTrackIndex] || playlist.tracks[0];
            if (!track) return;
            AudioManager.play(track.url, true, {
                playlistKey: currentPlaylistKey,
                trackName: track.name
            });
            refreshSelectionUI();
        };

        container.querySelector('#resumeMusic').onclick = () => AudioManager.setMusicEnabled(true);
        container.querySelector('#stopMusic').onclick = () => AudioManager.stop();
        container.querySelector('#uploadLocalTrack').onclick = () => {
            container.querySelector('#localTrackInput').click();
        };
        container.querySelector('#localTrackInput').onchange = (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            currentPlaylistKey = 'tavern';
            currentTrackName = file.name;
            AudioManager.play(url, false, {
                playlistKey: currentPlaylistKey,
                trackName: currentTrackName
            });
            refreshSelectionUI();
        };
        container.querySelector('#musicBack').onclick = () => navigateTo('home', container);
    }
};

// Loaded at application startup so sidebar actions never disappear before opening the library.
window.addEventListener('musicToggled', e => AudioManager.setMusicEnabled(e.detail));
window.addEventListener('musicVolumeChanged', e => AudioManager.setVolume(e.detail));
window.addEventListener('appPreferencesChanged', e => {
    const patch = e.detail?.patch || {};
    preferenceRevision++;
    if ('music.enabled' in patch && Boolean(patch['music.enabled']) !== isMusicEnabled) {
        isMusicEnabled = Boolean(patch['music.enabled']);
        if (isMusicEnabled) AudioManager.resume();
        else player.pause();
    }
    if ('music.volume' in patch) {
        currentVolume = Math.min(1, Math.max(0, Number(patch['music.volume']) || 0));
        player.setVolume(currentVolume);
    }
});
window.addEventListener('appPreferencesLoaded', e => {
    if (preferenceRevision) return;
    isMusicEnabled = e.detail['music.enabled'];
    currentVolume = e.detail['music.volume'];
    player.setVolume(currentVolume);
});
window.addEventListener('musicUploaded', e => {
    AudioManager.play(e.detail.url, false, { playlistKey: 'tavern', trackName: e.detail.name || 'Traccia caricata' });
});
if (import.meta.hot) import.meta.hot.dispose(() => player.dispose());
