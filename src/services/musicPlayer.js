// One media element per selection; pause/release before changing sources.
// play() is invoked synchronously from the user's gesture for mobile browsers.
export function createMusicPlayer({ createAudio = () => new Audio(), onState = () => {}, revokeUrl = url => URL.revokeObjectURL(url) } = {}) {
    let audio = null;
    let attempt = 0;
    let source = '';
    let volume = .5;
    let status = 'idle';
    let finished = () => {};
    const publish = (state, message) => { status = state; onState({ state, message }); };
    function release() {
        attempt++;
        const old = audio;
        audio = null;
        if (old) { old.pause(); old.removeAttribute('src'); old.load(); }
        if (source.startsWith('blob:')) revokeUrl(source);
        source = '';
    }
    function resume() {
        if (!audio || !audio.paused) return;
        const selected = audio;
        const playbackAttempt = ++attempt;
        publish('loading', 'Caricamento della musica…');
        const rejected = error => {
            if (selected !== audio || playbackAttempt !== attempt) return;
            publish(error?.name === 'NotAllowedError' ? 'blocked' : 'error',
                error?.name === 'NotAllowedError' ? 'Tocca Riprendi per avviare la musica.' : 'Impossibile riprodurre questa traccia. Riprova o scegli un altro file.');
        };
        try { audio.play()?.catch(rejected); } catch (error) { rejected(error); }
    }
    return {
        select(url, { loop = false, onEnd = () => {}, autoplay = true } = {}) {
            release();
            source = url;
            finished = onEnd;
            const selected = createAudio();
            audio = selected;
            selected.preload = 'none';
            selected.loop = loop;
            selected.volume = volume;
            selected.setAttribute('playsinline', '');
            const listen = (event, callback) => selected.addEventListener(event, () => { if (audio === selected) callback(); });
            listen('playing', () => publish('playing', 'In riproduzione'));
            listen('waiting', () => publish('loading', 'Caricamento della musica…'));
            listen('pause', () => { if (status !== 'stopped') publish('paused', 'Musica in pausa'); });
            listen('error', () => publish('error', 'Traccia non disponibile o formato non supportato. Scegli un altro brano.'));
            listen('ended', () => { publish('stopped', 'Riproduzione terminata'); finished(); });
            selected.src = url;
            if (autoplay) resume();
            else publish('paused', 'Musica in pausa');
        },
        resume,
        pause() { attempt++; audio?.pause(); publish('paused', 'Musica in pausa'); },
        stop() { attempt++; if (audio) { audio.pause(); audio.currentTime = 0; } publish('stopped', 'Musica fermata'); },
        setVolume(value) { volume = Math.min(1, Math.max(0, Number(value) || 0)); if (audio) audio.volume = volume; },
        hasSource: () => Boolean(audio),
        getState: () => status,
        dispose: release
    };
}
