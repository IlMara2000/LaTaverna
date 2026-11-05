/**
 * Effetti sonori di SCIPPO!, sintetizzati con la Web Audio API.
 *
 * Nessun file audio esterno e nessun suono prima di un gesto dell'utente:
 * il contesto viene creato solo alla prima chiamata, che avviene sempre dentro
 * un click o dopo che il giocatore ha iniziato la partita.
 */

const NOTES = {
    select: [[520, 0.05]],
    play: [[330, 0.07], [220, 0.08]],
    reveal: [[392, 0.06], [523, 0.08]],
    win: [[523, 0.07], [659, 0.08], [784, 0.12]],
    lose: [[330, 0.09], [262, 0.1], [196, 0.16]],
    draw: [[349, 0.08], [349, 0.12]],
    score: [[880, 0.05], [1175, 0.08]],
    tick: [[700, 0.03]],
    victory: [[523, 0.08], [659, 0.08], [784, 0.1], [1047, 0.22]],
    defeat: [[392, 0.1], [311, 0.1], [233, 0.22]],
    scippo: [[196, 0.08], [392, 0.06], [784, 0.08], [1568, 0.14]],
    scippoHit: [[98, 0.16], [196, 0.12], [392, 0.2], [784, 0.28]]
};

export function createScippoAudio({ enabled = () => true } = {}) {
    let context = null;
    let muted = false;

    const ensure = () => {
        if (muted || !enabled()) return null;
        try {
            const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!AudioContextClass) return null;
            if (!context) context = new AudioContextClass();
            if (context.state === 'suspended') void context.resume();
            return context;
        } catch {
            return null;
        }
    };

    const tone = (frequency, duration, { type = 'square', gain = 0.045, delay = 0 } = {}) => {
        const audio = ensure();
        if (!audio) return;
        const start = audio.currentTime + delay;
        const oscillator = audio.createOscillator();
        const volume = audio.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);
        volume.gain.setValueAtTime(0.0001, start);
        volume.gain.exponentialRampToValueAtTime(gain, start + 0.012);
        volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(volume).connect(audio.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    };

    const play = (name, options = {}) => {
        const sequence = NOTES[name];
        if (!sequence) return;
        sequence.forEach(([frequency, duration], index) => {
            tone(frequency, duration, {
                type: name === 'reveal' || name === 'score'
                    ? 'triangle'
                    : name === 'scippo' || name === 'scippoHit'
                        ? 'sawtooth'
                        : 'square',
                delay: index * 0.075,
                gain: name === 'tick' ? 0.02 : 0.04,
                ...options
            });
        });
    };

    return {
        play,
        setMuted(value) { muted = Boolean(value); },
        isMuted: () => muted,
        dispose() {
            if (context) {
                try { void context.close(); } catch { /* già chiuso */ }
                context = null;
            }
        }
    };
}
