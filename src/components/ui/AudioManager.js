import { Howl, Howler } from 'howler';
import { getPreference, setPreference } from '../../services/userPreferences.js';

// Configurazione Playlist Tematiche Unificata
const PLAYLISTS = {
    tavern: {
        label: "Taverna",
        description: "Atmosfera calda per lobby e preparazione della sessione.",
        tracks: [
            { name: "Esplorazione Taverna", url: "https://archives.tabletopaudio.com/124_Adventure_Await.mp3", tags: "ambient" },
            { name: "Sala Comune", url: "https://archives.tabletopaudio.com/190_Tavern_Music.mp3", tags: "social" }
        ]
    },
    dnd: {
        label: "D&D",
        description: "Esplorazione, tensione e combattimento per campagne GDR.",
        tracks: [
            { name: "Dungeon Oscuro", url: "https://archives.tabletopaudio.com/132_The_Dungeon_Awaits.mp3", tags: "exploration" },
            { name: "Combattimento Epico", url: "https://archives.tabletopaudio.com/111_Combat_Music.mp3", tags: "combat" },
            { name: "Mistero Arcano", url: "https://archives.tabletopaudio.com/157_Mystic_Realm.mp3", tags: "mystery" }
        ]
    },
    minigames: {
        label: "Minigiochi",
        description: "Tracce più leggere per carte, strategia e partite rapide.",
        tracks: [
            { id: "cards", name: "Carte al Tavolo", url: "https://www.bensound.com/bensound-music/bensound-funnysong.mp3", tags: "relax" },
            { id: "scacchi", name: "Scacchi Focus", url: "https://www.bensound.com/bensound-music/bensound-thejazzpiano.mp3", tags: "focus" },
            { id: "default", name: "Sfida Intensa", url: "https://www.bensound.com/bensound-music/bensound-epic.mp3", tags: "action" }
        ]
    }
};

let currentSound = null;
let currentTrackIndex = 0;
let currentPlaylistKey = 'tavern';
let currentTrackName = 'Nessuna traccia';
let isMusicEnabled = true;
let isPlaylistActive = false;
let preferencesHydrated = false;

const getPlaylist = (key = currentPlaylistKey) => PLAYLISTS[key] || PLAYLISTS.tavern;

async function hydrateAudioPreferences() {
    if (preferencesHydrated) return;
    preferencesHydrated = true;
    currentPlaylistKey = await getPreference('music.playlist', currentPlaylistKey);
    currentTrackName = await getPreference('music.track', currentTrackName);
    isMusicEnabled = await getPreference('music.enabled', true);
}

function persistAudioPreferences() {
    setPreference('music.playlist', currentPlaylistKey);
    setPreference('music.track', currentTrackName);
    setPreference('music.enabled', isMusicEnabled);
}

export const AudioManager = {
    // Riproduzione universale
    play: (url, isPlaylist = false, meta = {}) => {
        if (currentSound) currentSound.stop();
        
        isPlaylistActive = isPlaylist;
        currentPlaylistKey = meta.playlistKey || currentPlaylistKey;
        currentTrackName = meta.trackName || currentTrackName;
        persistAudioPreferences();

        currentSound = new Howl({
            src: [url],
            html5: true,
            volume: 0.5,
            loop: !isPlaylist,
            onplay: () => window.dispatchEvent(new CustomEvent('musicStarted', {
                detail: { playlistKey: currentPlaylistKey, trackName: currentTrackName }
            })),
            onstop: () => window.dispatchEvent(new CustomEvent('musicStopped')),
            onend: () => {
                if (isPlaylistActive) AudioManager.playNext();
            }
        });

        // Controlla se l'utente non ha mutato l'audio globalmente
        if (isMusicEnabled) {
            currentSound.play();
        }
    },

    stop: () => {
        isPlaylistActive = false;
        if (currentSound) currentSound.stop();
        else Howler.stop();
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
        isMusicEnabled = Boolean(enabled);
        setPreference('music.enabled', isMusicEnabled);
    },

    showMusicCenter: async (container) => {
        await hydrateAudioPreferences();
        const selectedPlaylist = getPlaylist();
        container.innerHTML = `
            <div class="music-center fade-in">
                <button id="musicBack" class="btn-back-glass music-back">TORNA ALLA LIBRERIA</button>

                <header class="music-header">
                    <p class="settings-kicker">Audio ambiente</p>
                    <h1 class="main-title music-title">LIBRERIA MUSICALE</h1>
                </header>

                <section class="music-now glass-box">
                    <span class="music-now-label">Playlist selezionata</span>
                    <strong id="selectedPlaylistName">${selectedPlaylist.label}</strong>
                    <p id="selectedTrackName">${currentTrackName}</p>
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
                                        <span>${track.name}</span>
                                        <small>${track.tags}</small>
                                    </button>
                                `).join('')}
                            </div>
                        </article>
                    `).join('')}
                </section>

                <div class="music-actions">
                    <button id="playSelectedPlaylist" class="btn-primary" type="button">AVVIA PLAYLIST</button>
                    <button id="stopMusic" class="btn-back-glass" type="button">STOP MUSICA</button>
                </div>

                <section class="music-note glass-box">
                    <p>Le tracce definitive possono essere sostituite aggiungendo URL o file locali nella configurazione playlist. La struttura e la selezione sono gia pronte.</p>
                </section>
            </div>
        `;

        const refreshSelectionUI = () => {
            const playlist = getPlaylist();
            container.querySelector('#selectedPlaylistName').textContent = playlist.label;
            container.querySelector('#selectedTrackName').textContent = currentTrackName;
            container.querySelectorAll('.music-playlist').forEach(card => {
                card.classList.toggle('is-selected', card.dataset.playlist === currentPlaylistKey);
            });
        };

        container.querySelectorAll('.music-playlist-select').forEach(btn => {
            btn.onclick = () => {
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

        container.querySelector('#stopMusic').onclick = () => AudioManager.stop();
        container.querySelector('#musicBack').onclick = async () => {
            const { showLobby } = await import('../../lobby.js');
            showLobby(container);
        };
    }
};

// --- LISTENERS GLOBALI ---

// Toggle ON/OFF dalla Sidebar
window.addEventListener('musicToggled', (e) => {
    const shouldPlay = e.detail;
    AudioManager.setMusicEnabled(shouldPlay);
    if (shouldPlay) {
        if (currentSound) currentSound.play();
    } else {
        if (currentSound) currentSound.pause();
        else Howler.stop();
    }
});

// Caricamento manuale file MP3
window.addEventListener('musicUploaded', (e) => {
    const { url, name } = e.detail;
    AudioManager.play(url, false, {
        playlistKey: 'tavern',
        trackName: name || 'Traccia caricata'
    });
});

// Cambio Contesto Automatico (es. entri in un gioco)
window.addEventListener('contextChanged', (e) => {
    const context = e.detail;

    if (context === "dnd5e") {
        currentPlaylistKey = 'dnd';
        currentTrackIndex = 0;
        const track = PLAYLISTS.dnd.tracks[0];
        AudioManager.play(track.url, true, {
            playlistKey: 'dnd',
            trackName: track.name
        });
    } else {
        currentPlaylistKey = 'minigames';
        const tracks = PLAYLISTS.minigames.tracks;
        const track = tracks.find(t => t.id === context) || tracks.find(t => t.id === "default");
        if (track) AudioManager.play(track.url, false, {
            playlistKey: 'minigames',
            trackName: track.name
        });
    }
});
