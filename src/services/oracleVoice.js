// On-device recognition is preferred: ambient speech then never leaves the machine.
// Where the browser lacks it, the browser's own speech service is used instead, as the
// privacy page describes; the microphone still starts only from an explicit click.
// Friendly answers to "ehi oracolo": short, sociable, a little robotic.
const HELLO_REPLIES = [
    'Ehi! Sono qui, che si combina?',
    'Eccomi! Il robottino è sveglio e ti ascolta.',
    'Ciao! Dimmi pure, sono tutto orecchie. O quasi: sono un robottino.',
    'Sono qui! Pronto a darti una mano, o una pinza.'
];
const helloReply = () => HELLO_REPLIES[Math.floor(Math.random() * HELLO_REPLIES.length)];

export function voiceCommand(text) {
    const value = text.toLocaleLowerCase('it').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (/\b(non ascoltarmi|smetti di ascoltare)\b/.test(value)) return 'sleep';
    if (/\b(oracolo spegniti|disattiva oracolo)\b/.test(value)) return 'off';
    if (/\boracolo mi serve il tuo aiuto\b/.test(value)) return 'wake';
    // "Ehi oracolo", "ehi, oracolo", "ciao oracolo": a social hello, not a question.
    if (/\b(ehi|ei|hey|ehy|ciao|salve)\s+oracolo\b/.test(value)) return 'hello';
    return 'question';
}

export function createOracleVoice({ Recognition, ask, speak, cancelSpeech, onState, onCaption, onSpeechEnd = () => {}, visible = () => true }) {
    let state = 'off', generation = 0, recognition, request, restart, history = [], failures = 0, useLocal = false;
    let sleeping = false, greeted = false;
    const publish = next => { state = next; onState(next); };
    const stopRecognition = () => {
        clearTimeout(restart);
        const old = recognition;
        recognition = null;
        if (old) { old.onend = old.onresult = old.onerror = old.onstart = null; old.abort(); }
    };
    const stop = () => {
        generation++;
        stopRecognition(); request?.abort(); cancelSpeech(); history = []; sleeping = false;
        publish('off'); onCaption('');
    };
    const fail = message => { stop(); onCaption(message); };
    async function say(text, token) {
        stopRecognition(); publish('speaking'); onCaption(text, true);
        await new Promise(resolve => setTimeout(resolve, 450));
        if (token !== generation) return;
        try { await speak(text); }
        catch { if (token === generation) onCaption('Voce non disponibile. Puoi leggere la risposta nei sottotitoli.'); }
        if (token !== generation) return;
        // La voce è finita (o ha fallito): chi è in ascolto può chiudere il fumetto.
        onSpeechEnd();
        listen(token);
    }
    async function receive(text, token) {
        if (token !== generation) return;
        const command = voiceCommand(text);
        if (command === 'off') { stop(); return; }
        if (command === 'hello') {
            // Works even after the puppet is hidden: it keeps listening and answers.
            sleeping = false;
            stopRecognition();
            await say(helloReply(), token);
            return;
        }
        if (command === 'sleep') {
            sleeping = true;
            request?.abort();
            await say('Va bene, resto in attesa. Richiamami dicendo: Oracolo mi serve il tuo aiuto.', token);
            return;
        }
        if (sleeping && command !== 'wake') return;
        if (command === 'wake') {
            sleeping = false;
            await say('Eccomi, dimmi pure.', token);
            return;
        }
        stopRecognition(); publish('thinking'); onCaption('Ti ho sentito: ' + text);
        request = new AbortController();
        try {
            const result = await ask(text.slice(0, 3000), history.slice(-8), request.signal);
            if (token !== generation) return;
            history.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
            history = history.slice(-8);
            await say(result.reply, token);
        } catch (error) {
            if (token !== generation) return;
            onCaption(error.message || 'L’Oracolo non riesce a rispondere.');
            listen(token);
        }
    }
    function listen(token) {
        if (token !== generation || !visible()) return;
        stopRecognition();
        const current = new Recognition();
        const startedAt = Date.now();
        recognition = current;
        current.processLocally = useLocal;
        current.lang = 'it-IT'; current.continuous = true; current.interimResults = false;
        current.onstart = () => {
            if (recognition !== current) return;
            publish(sleeping ? 'waiting' : 'listening');
        };
        current.onresult = event => {
            if (recognition !== current) return;
            const text = Array.from(event.results).slice(event.resultIndex).filter(result => result.isFinal).map(result => result[0].transcript).join(' ').trim();
            if (text) { failures = 0; void receive(text, token); }
        };
        current.onerror = event => {
            if (recognition !== current) return;
            if (event.error === 'no-speech') return;
            fail(event.error === 'not-allowed' || event.error === 'service-not-allowed'
                ? 'Microfono non autorizzato. Abilitalo nelle impostazioni del browser, poi riattiva l’Oracolo.'
                : 'Ascolto interrotto o italiano non disponibile. Riattiva l’Oracolo dal menu oppure usa la pagina di testo.');
        };
        current.onend = () => {
            if (recognition !== current || token !== generation) return;
            recognition = null;
            // Back off and stop if a browser repeatedly ends recognition immediately.
            failures = Date.now() - startedAt > 5000 ? 0 : failures + 1;
            if (failures > 12) { fail('Ascolto interrotto dal browser. Riattiva l’Oracolo dal menu.'); return; }
            restart = setTimeout(() => listen(token), Math.min(400 * failures, 3000));
        };
        try { current.start(); } catch { fail('Impossibile avviare il microfono. Riattiva l’Oracolo dal menu.'); }
    }
    async function start() {
        if (state !== 'off') return;
        const token = ++generation;
        publish('preparing');
        try {
            if (!Recognition) {
                fail('Questo browser non supporta il riconoscimento vocale. Usa la pagina Oracolo per testo e foto.'); return;
            }
            useLocal = 'processLocally' in Recognition.prototype && typeof Recognition.available === 'function';
            if (useLocal) {
                try {
                    const options = { langs: ['it-IT'], processLocally: true };
                    let availability = await Recognition.available(options);
                    if (token !== generation) return;
                    if (availability === 'downloadable' || availability === 'downloading') {
                        onCaption('Preparazione della voce italiana sul dispositivo…');
                        if (Recognition.install && await Recognition.install(options)) availability = await Recognition.available(options);
                    }
                    if (token !== generation) return;
                    if (availability !== 'available') useLocal = false;
                } catch { useLocal = false; }
            }
            if (!useLocal && token === generation) {
                onCaption('Ascolto con il servizio vocale del browser. Per la trascrizione sul dispositivo serve Chrome aggiornato; la pagina Oracolo resta per testo e foto.');
            }
            // Recognition requests microphone permission; never cache or fake a grant.
            failures = 0;
            listen(token);
            const current = recognition;
            if (!current) return;
            current.onstart = () => {
                if (recognition !== current || token !== generation) return;
                current.onstart = null;
                const greeting = greeted ? 'Bentornato, sono qui. Dimmi pure.' : 'Ciao, sono l’Oracolo, la piccola Anima della Taverna. Puoi parlarmi e farmi domande. Di’ non ascoltarmi per mettermi in attesa. Per richiamarmi, di’ Oracolo mi serve il tuo aiuto. Per spegnere il microfono, di’ Oracolo spegniti oppure disattivami dal menu. Ricordo il contesto finché resto attivo.';
                greeted = true;
                void say(greeting, token);
            };
        } catch (error) { if (token === generation) fail(error.message); }
    }
    // Riascolta una risposta già pronunciata: mette in pausa l'ascolto, così il
    // microfono non trascrive la voce dell'Oracolo, e riprende solo se era attivo.
    async function repeat(text) {
        const value = (text || '').trim();
        if (!value) return;
        if (state !== 'off') { await say(value, generation); return; }
        onCaption(value, true);
        try { await speak(value); }
        catch { onCaption('Voce non disponibile. Puoi leggere la risposta nei sottotitoli.'); }
        onSpeechEnd();
    }
    return { start, stop, repeat, getState: () => state };
}
