import { Howl, Howler } from 'howler';

// Configurazione Playlist Tematiche
const TAVERNA_PLAYLISTS = {
    dnd5e: [
        "https://archives.tabletopaudio.com/124_Adventure_Await.mp3",
        "https://archives.tabletopaudio.com/132_The_Dungeon_Awaits.mp3",
        "https://archives.tabletopaudio.com/111_Combat_Music.mp3"
    ],
    minigames: {
        scopa: "https://www.bensound.com/bensound-music/bensound-funnysong.mp3",
        scacchi: "https://www.bensound.com/bensound-music/bensound-thejazzpiano.mp3",
        default: "https://www.bensound.com/bensound-music/bensound-epic.mp3"
    }
};

let currentSound = null;
let currentTrackIndex = 0;

export const AudioManager = {
    // Funzione per riprodurre una traccia o una playlist
    play: (src, isPlaylist = false) => {
        if (currentSound) currentSound.stop();

        currentSound = new Howl({
            src: [src],
            html5: true, // Necessario per file grandi/streaming
            loop: !isPlaylist,
            volume: 0.5,
            onend: () => {
                if (isPlaylist) AudioManager.playNextDnD();
            }
        });

        if (localStorage.getItem('taverna_music') !== 'off') {
            currentSound.play();
        }
    },

    playNextDnD: () => {
        currentTrackIndex = (currentTrackIndex + 1) % TAVERNA_PLAYLISTS.dnd5e.length;
        AudioManager.play(TAVERNA_PLAYLISTS.dnd5e[currentTrackIndex], true);
    }
};

// --- LISTENERS ---

// Gestione Toggle ON/OFF
window.addEventListener('musicToggled', (e) => {
    const shouldPlay = e.detail;
    if (shouldPlay) {
        if (currentSound) currentSound.play();
    } else {
        Howler.unload(); // Ferma tutto
    }
});

// Gestione Caricamento Manuale dalla Sidebar
window.addEventListener('musicUploaded', (e) => {
    const { url } = e.detail;
    AudioManager.play(url);
});

// Gestione Automatica per Contesto (D&D o Minigiochi)
window.addEventListener('contextChanged', (e) => {
    const context = e.detail; // "dnd5e", "scopa", ecc.

    if (context === "dnd5e") {
        AudioManager.play(TAVERNA_PLAYLISTS.dnd5e[0], true);
    } else if (TAVERNA_PLAYLISTS.minigames[context]) {
        AudioManager.play(TAVERNA_PLAYLISTS.minigames[context]);
    }
});