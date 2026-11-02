// Only on-device recognition is allowed: ambient speech must never leave the device.
export function voiceCommand(text) {
    const value = text.toLocaleLowerCase('it').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    if (/\b(non ascoltarmi|smetti di ascoltare)\b/.test(value)) return 'sleep';
    if (/\b(oracolo spegniti|disattiva oracolo)\b/.test(value)) return 'off';
    if (/\boracolo mi serve il tuo aiuto\b/.test(value)) return 'wake';
    return 'question';
}

export function createOracleVoice({ Recognition, ask, speak, cancelSpeech, onState, onCaption, visible = () => true }) {
    let state = 'off', generation = 0, recognition, request, restart, history = [], failures = 0;
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
        stopRecognition(); publish('speaking'); onCaption(text);
        await new Promise(resolve => setTimeout(resolve, 450));
        if (token !== generation) return;
        try { await speak(text); }
        catch { if (token === generation) onCaption('Voce non disponibile. Puoi leggere la risposta nei sottotitoli.'); }
        if (token === generation) listen(token);
    }
    async function receive(text, token) {
        if (token !== generation) return;
        const command = voiceCommand(text);
        if (command === 'off') { stop(); return; }
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
        current.processLocally = true;
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
                : 'Ascolto locale interrotto o italiano non disponibile. Riattiva l’Oracolo dal menu oppure usa la pagina di testo.');
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
            if (!Recognition || !('processLocally' in Recognition.prototype) || !Recognition.available) {
                fail('Questo browser non supporta l’ascolto sul dispositivo. Usa un browser con riconoscimento locale italiano oppure la pagina Oracolo per testo e file.'); return;
            }
            const options = { langs: ['it-IT'], processLocally: true };
            let availability = await Recognition.available(options);
            if (token !== generation) return;
            if (availability === 'downloadable' || availability === 'downloading') {
                onCaption('Preparazione della voce italiana sul dispositivo…');
                if (!Recognition.install || !await Recognition.install(options)) throw new Error('Pacchetto italiano non disponibile.');
                availability = await Recognition.available(options);
            }
            if (token !== generation) return;
            if (availability !== 'available') throw new Error('Ascolto locale italiano non disponibile in questo browser. Usa la pagina Oracolo per testo e file.');
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
    return { start, stop, getState: () => state };
}
