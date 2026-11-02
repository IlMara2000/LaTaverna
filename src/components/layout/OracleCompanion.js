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
    puppet.innerHTML = '<span class="oracle-halo"></span><span class="oracle-body"><span class="oracle-face"><i></i><i></i><b></b></span></span><span class="oracle-hand oracle-hand-left"></span><span class="oracle-hand oracle-hand-right"></span><span class="oracle-gem"></span>';
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
    const voice = createOracleVoice({
        Recognition: window.SpeechRecognition || window.webkitSpeechRecognition,
        visible: () => !document.hidden,
        ask: (prompt, history, signal) => postOracle('/api/oracle/chat', { prompt, history }, { signal }),
        speak: text => AudioManager.speakOracle(text),
        cancelSpeech: () => AudioManager.cancelOracleSpeech(),
        onCaption: showCaption,
        onState: state => {
            trigger.dataset.oracleState = state;
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
    // A hidden tab must not silently keep listening; reactivation is always explicit.
    document.addEventListener('visibilitychange', () => { if (document.hidden) voice.stop(); }, { signal: events.signal });
    window.addEventListener('pagehide', () => voice.stop(), { signal: events.signal });
    return () => {
        voice.stop(); events.abort(); clearTimeout(captionTimer);
        caption.remove(); puppet.remove(); if (activeVoice === voice) activeVoice = null;
    };
}
