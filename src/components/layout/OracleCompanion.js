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
    caption.innerHTML = '<span class="oracle-caption-state"></span><p role="status" aria-live="polite"></p><button type="button" aria-label="Spegni Oracolo e microfono">Spegni microfono</button>';
    document.body.append(caption);
    let captionTimer;
    function showCaption(text) {
        clearTimeout(captionTimer);
        const words = text.trim().split(/\s+/).filter(Boolean);
        const line = caption.querySelector('p');
        if (!words.length) { caption.hidden = true; line.textContent = ''; return; }
        caption.hidden = false;
        // Short, temporary lines: each word gets approximately one second to read.
        let index = 0;
        const next = () => {
            const chunk = words.slice(index, index + 9);
            line.textContent = chunk.join(' '); index += chunk.length;
            captionTimer = setTimeout(() => {
                if (index < words.length) next(); else caption.hidden = true;
            }, Math.max(2000, chunk.length * 1000));
        };
        next();
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
