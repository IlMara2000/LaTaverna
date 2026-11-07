import { createOracleVoice } from '../../services/oracleVoice.js';
import { postOracle } from '../../services/oracleClient.js';
import { AudioManager } from '../ui/AudioManager.js';
import '../../styles/oracle-companion.css';

let activeVoice = null;
export const isOracleVoiceActive = () => activeVoice && activeVoice.getState() !== 'off';
export const stopOracleVoice = () => activeVoice?.stop();
export function toggleOracleVoice() {
    if (isOracleVoiceActive()) activeVoice.stop();
    else void activeVoice?.start();
}
const labels = { off: 'Spento', preparing: 'Mi risveglio…', listening: 'Ti ascolto', waiting: 'In attesa del richiamo', thinking: 'Sto pensando…', speaking: 'Ti rispondo' };

export function mountOracleCompanion(trigger) {
    activeVoice?.stop();
    const events = new AbortController();
    const puppet = document.createElement('span');
    puppet.className = 'oracle-puppet';
    puppet.setAttribute('aria-hidden', 'true');
    puppet.innerHTML = '<span class="oracle-halo"></span><span class="oracle-body"><span class="oracle-ear oracle-ear-left"></span><span class="oracle-ear oracle-ear-right"></span><span class="oracle-face"><i></i><i></i><b></b></span></span><span class="oracle-hand oracle-hand-left"></span><span class="oracle-hand oracle-hand-right"></span><span class="oracle-gem"></span>';
    trigger.append(puppet);
    const caption = document.createElement('div');
    caption.className = 'oracle-caption'; caption.hidden = true;
    caption.innerHTML = '<span class="oracle-caption-state"></span><p role="status" aria-live="polite"></p><button type="button" aria-label="Spegni Oracolo e microfono">Spegni microfono</button><button type="button" data-replay aria-label="Riascolta l’ultima risposta" hidden>Riascolta</button>';
    document.body.append(caption);
    const replay = caption.querySelector('[data-replay]');
    let captionTimer, awaitingSpeech = false, lastSpoken = '';
    // Il fumetto resta finché l'Oracolo parla e si chiude appena la voce finisce. La
    // lunghezza del testo è solo il tetto massimo, per non lasciarlo appeso se la voce
    // si blocca: 3 s / 5 s bastano ai messaggi brevi che non vengono letti ad alta voce.
    const captionLifetime = words => {
        if (words <= 12) return 3000;
        if (words <= 32) return 5000;
        return Math.min(20000, 5000 + (words - 32) * 250);
    };
    const speechCap = words => Math.min(120000, Math.max(15000, words * 1000));
    const hideCaption = () => {
        caption.classList.add('is-leaving');
        captionTimer = setTimeout(() => { caption.hidden = true; caption.classList.remove('is-leaving'); }, 320);
    };
    function showCaption(text, spoken = false) {
        clearTimeout(captionTimer);
        const value = text.trim();
        const line = caption.querySelector('p');
        caption.classList.remove('is-leaving');
        if (!value) { caption.hidden = true; line.textContent = ''; awaitingSpeech = false; return; }
        line.textContent = value;
        caption.hidden = false;
        // Solo le righe davvero pronunciate si possono riascoltare.
        if (spoken) lastSpoken = value;
        replay.hidden = !lastSpoken;
        const words = value.split(/\s+/).filter(Boolean).length;
        awaitingSpeech = spoken;
        captionTimer = setTimeout(hideCaption, spoken ? speechCap(words) : captionLifetime(words));
    }
    // Il pupazzo si tocca direttamente: un tocco apre il menu, due lo nascondono,
    // tre spengono anche il microfono. La finestra è breve, così i tocchi si contano.
    const setPuppetHidden = hidden => { trigger.dataset.puppetHidden = hidden ? '1' : '0'; };
    let previousState = 'off';

    const voice = createOracleVoice({
        Recognition: window.SpeechRecognition || window.webkitSpeechRecognition,
        visible: () => !document.hidden,
        ask: (prompt, history, signal) => postOracle('/api/oracle/chat', { prompt, history }, { signal }),
        speak: text => AudioManager.speakOracle(text),
        cancelSpeech: () => AudioManager.cancelOracleSpeech(),
        onCaption: showCaption,
        // La voce ha finito: il fumetto si ritira subito, con una breve pausa per leggere.
        onSpeechEnd: () => {
            if (!awaitingSpeech) return;
            clearTimeout(captionTimer);
            awaitingSpeech = false;
            captionTimer = setTimeout(hideCaption, 700);
        },
        onState: state => {
            trigger.dataset.oracleState = state;
            if (previousState === 'off' && state !== 'off') setPuppetHidden(false);
            previousState = state;
            trigger.setAttribute('aria-description', state === 'off' ? 'Trascina per spostare il menu' : `Oracolo: ${labels[state]}. Apri il menu per spegnere il microfono.`);
            trigger.classList.toggle('has-oracle', state !== 'off');
            trigger.title = state === 'off' ? 'Apri menu · trascina per spostare' : `Oracolo: ${labels[state]} · apri menu o trascina`;
            caption.querySelector('.oracle-caption-state').textContent = `Oracolo · ${labels[state]}`;
            caption.querySelector('button').hidden = state === 'off';
            const button = document.getElementById('sideOracleBtn');
            if (button) {
                button.setAttribute('aria-pressed', String(state !== 'off'));
                button.textContent = state === 'off' ? 'ATTIVA ORACOLO VOCALE' : `SPEGNI ORACOLO · ${labels[state]}`;
            }
        }
    });
    activeVoice = voice;
    caption.querySelector('button').onclick = () => voice.stop();
    // Riascolta l'ultima risposta: la voce sospende il microfono, parla e poi
    // riprende l'ascolto, così l'Oracolo non trascrive sé stesso.
    replay.onclick = () => { if (lastSpoken) void voice.repeat(lastSpoken); };

    let taps = 0, tapTimer = 0, tapOrigin = null;
    puppet.addEventListener('pointerdown', event => { tapOrigin = [event.clientX, event.clientY]; });
    puppet.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        // Un trascinamento del menu non deve contare come tocco.
        if (tapOrigin && Math.hypot(event.clientX - tapOrigin[0], event.clientY - tapOrigin[1]) > 8) return;
        taps += 1;
        clearTimeout(tapTimer);
        if (taps >= 3) {
            taps = 0;
            voice.stop();
            setPuppetHidden(false);
            showCaption('Microfono spento. Per richiamarmi di’ «Oracolo mi serve il tuo aiuto» oppure usa il menu.');
            return;
        }
        tapTimer = setTimeout(() => {
            if (taps === 1) {
                window.dispatchEvent(new CustomEvent('toggleSidebar'));
            } else {
                setPuppetHidden(true);
                showCaption('Pupazzo nascosto. L’Oracolo resta in ascolto: tre tocchi spengono anche il microfono.');
            }
            taps = 0;
        }, 320);
    });
    // A hidden tab must not silently keep listening; reactivation is always explicit.
    document.addEventListener('visibilitychange', () => { if (document.hidden) voice.stop(); }, { signal: events.signal });
    window.addEventListener('pagehide', () => voice.stop(), { signal: events.signal });
    return () => {
        voice.stop(); events.abort(); clearTimeout(captionTimer);
        caption.remove(); puppet.remove(); if (activeVoice === voice) activeVoice = null;
    };
}
