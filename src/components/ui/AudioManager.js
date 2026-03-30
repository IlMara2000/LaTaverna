import { Howl, Howler } from 'howler';

// Configurazione Playlist Tematiche Unificata
const PLAYLISTS = {
    dnd: [
        { name: "Esplorazione Taverna", url: "https://archives.tabletopaudio.com/124_Adventure_Await.mp3", tags: "ambient" },
        { name: "Combattimento Epico", url: "https://archives.tabletopaudio.com/111_Combat_Music.mp3", tags: "combat" },
        { name: "Dungeon Oscuro", url: "https://archives.tabletopaudio.com/132_The_Dungeon_Awaits.mp3", tags: "exploration" }
    ],
    minigames: [
        { id: "scopa", name: "Scopa / Carte", url: "https://www.bensound.com/bensound-music/bensound-funnysong.mp3", tags: "relax" },
        { id: "scacchi", name: "Scacchi (Jazz)", url: "https://www.bensound.com/bensound-music/bensound-thejazzpiano.mp3", tags: "focus" },
        { id: "default", name: "Sfida Intensa", url: "https://www.bensound.com/bensound-music/bensound-epic.mp3", tags: "action" }
    ]
};

let currentSound = null;
let currentTrackIndex = 0;
let isDnDPlaylistActive = false;

export const AudioManager = {
    // Riproduzione universale
    play: (url, isPlaylist = false) => {
        if (currentSound) currentSound.stop();
        
        isDnDPlaylistActive = isPlaylist;

        currentSound = new Howl({
            src: [url],
            html5: true,
            volume: 0.5,
            loop: !isPlaylist,
            onplay: () => window.dispatchEvent(new CustomEvent('musicStarted')),
            onstop: () => window.dispatchEvent(new CustomEvent('musicStopped')),
            onend: () => {
                if (isDnDPlaylistActive) AudioManager.playNextDnD();
            }
        });

        // Controlla se l'utente non ha mutato l'audio globalmente
        if (localStorage.getItem('taverna_music') !== 'off') {
            currentSound.play();
        }
    },

    stop: () => {
        isDnDPlaylistActive = false;
        if (currentSound) currentSound.stop();
        else Howler.stop();
    },

    playNextDnD: () => {
        currentTrackIndex = (currentTrackIndex + 1) % PLAYLISTS.dnd.length;
        AudioManager.play(PLAYLISTS.dnd[currentTrackIndex].url, true);
    },

    // UI del Music Center
    showMusicCenter: (container) => {
        container.innerHTML = `
            <div class="music-center fade-in" style="padding: 20px; color: white; max-width: 600px; margin: 0 auto; background: rgba(10, 5, 20, 0.9); border-radius: 20px; border: 1px solid rgba(157, 78, 222, 0.3);">
                <h1 style="text-align: center; color: #9d4ede; letter-spacing: 2px;">MUSIC CENTER</h1>
                
                <section style="margin-bottom: 30px;">
                    <h3 style="border-bottom: 1px solid #9d4ede; padding-bottom: 5px; font-size: 0.9rem; opacity: 0.8;">⚔️ D&D & AMBIENT (PLAYLIST)</h3>
                    <div style="display: grid; gap: 10px; margin-top: 15px;">
                        ${PLAYLISTS.dnd.map((track, index) => `
                            <button class="btn-track dnd-track" data-url="${track.url}" data-index="${index}" style="background: rgba(157, 78, 222, 0.1); border: 1px solid #9d4ede; color: white; padding: 12px; border-radius: 8px; cursor: pointer; text-align: left; transition: 0.3s;">
                                🎵 ${track.name} <small style="opacity:0.5; float:right;">${track.tags}</small>
                            </button>
                        `).join('')}
                    </div>
                </section>

                <section>
                    <h3 style="border-bottom: 1px solid #ffcc00; padding-bottom: 5px; color: #ffcc00; font-size: 0.9rem; opacity: 0.8;">🎲 MINIGIOCHI</h3>
                    <div style="display: grid; gap: 10px; margin-top: 15px;">
                        ${PLAYLISTS.minigames.map(track => `
                            <button class="btn-track mini-track" data-url="${track.url}" style="background: rgba(255, 204, 0, 0.1); border: 1px solid #ffcc00; color: white; padding: 12px; border-radius: 8px; cursor: pointer; text-align: left; transition: 0.3s;">
                                🃏 ${track.name}
                            </button>
                        `).join('')}
                    </div>
                </section>

                <button id="stopMusic" style="margin-top: 30px; width: 100%; padding: 15px; background: #ff4444; border: none; color: white; border-radius: 10px; font-weight: bold; cursor: pointer; transition: 0.3s;">
                    STOP TUTTA LA MUSICA
                </button>
            </div>
        `;

        // Listeners per tracce D&D (attivano playlist ciclica)
        container.querySelectorAll('.dnd-track').forEach(btn => {
            btn.onclick = () => {
                currentTrackIndex = parseInt(btn.dataset.index);
                AudioManager.play(btn.dataset.url, true);
            };
        });

        // Listeners per Minigiochi (loop singolo)
        container.querySelectorAll('.mini-track').forEach(btn => {
            btn.onclick = () => AudioManager.play(btn.dataset.url, false);
        });

        container.querySelector('#stopMusic').onclick = () => AudioManager.stop();
    }
};

// --- LISTENERS GLOBALI ---

// Toggle ON/OFF dalla Sidebar
window.addEventListener('musicToggled', (e) => {
    const shouldPlay = e.detail;
    if (shouldPlay) {
        if (currentSound) currentSound.play();
    } else {
        if (currentSound) currentSound.pause();
        else Howler.stop();
    }
});

// Caricamento manuale file MP3
window.addEventListener('musicUploaded', (e) => {
    const { url } = e.detail;
    AudioManager.play(url, false);
});

// Cambio Contesto Automatico (es. entri in un gioco)
window.addEventListener('contextChanged', (e) => {
    const context = e.detail;

    if (context === "dnd5e") {
        AudioManager.play(PLAYLISTS.dnd[0].url, true);
    } else {
        const track = PLAYLISTS.minigames.find(t => t.id === context) || PLAYLISTS.minigames.find(t => t.id === "default");
        if (track) AudioManager.play(track.url, false);
    }
});