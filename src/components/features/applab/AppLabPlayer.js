/**
 * APP LAB — sessione immersiva.
 *
 * Su desktop e Android Chrome usa la Fullscreen API reale; su iPhone/iPad,
 * dove Safari non consente il fullscreen di un elemento, usa una modalità
 * immersiva CSS (viewport dinamico + safe area), senza promettere di nascondere
 * la barra di stato di iOS.
 */

import {
    runtimeStatus, startSession, resumeSession, stopSession, connectStream
} from './appLabRunner.js';
import { appLabErrorMessage } from './appLabLibrary.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

const formatClock = seconds => {
    const safe = Math.max(0, Math.round(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function openAppSession({ app, onLaunched = () => {}, onClose = () => {} }) {
    const element = document.createElement('section');
    element.className = 'applab-player';
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.setAttribute('aria-label', `Sessione ${app?.name || 'applicazione'}`);
    element.innerHTML = `
        <header class="applab-player-bar" data-bar>
            <button type="button" class="applab-exit" data-exit aria-label="Torna alla libreria">← LIBRERIA</button>
            <div class="applab-player-title">
                ${app.icon_data_url
                    ? `<img src="${escapeHTML(app.icon_data_url)}" alt="" aria-hidden="true">`
                    : `<span class="applab-player-monogram" aria-hidden="true">${escapeHTML((app.name || 'A').slice(0, 1).toUpperCase())}</span>`}
                <div>
                    <strong>${escapeHTML(app.name || 'Applicazione')}</strong>
                    <small data-status>Preparo la sessione…</small>
                </div>
            </div>
            <div class="applab-player-tools">
                <span class="applab-session-clock" data-clock hidden></span>
                <button type="button" data-keyboard aria-label="Tastiera" aria-pressed="false">⌨</button>
                <button type="button" data-rotate aria-label="Ruota lo schermo">⟳</button>
                <button type="button" data-fullscreen aria-label="Schermo intero">⛶</button>
            </div>
        </header>

        <div class="applab-stage" data-stage>
            <video data-video autoplay playsinline muted></video>
            <div class="applab-stage-layer" data-layer>
                <div class="applab-stage-card" data-card>
                    <span class="applab-spinner" data-spinner aria-hidden="true"></span>
                    <h2 data-card-title>Connessione al runtime Android…</h2>
                    <p data-card-text>Verifico il gateway di esecuzione remota.</p>
                    <div class="applab-stage-actions" data-card-actions></div>
                </div>
            </div>
            <div class="applab-touch-controls" data-touch hidden>
                <button type="button" data-nav="back" aria-label="Indietro">◁</button>
                <button type="button" data-nav="home" aria-label="Home">⌂</button>
                <button type="button" data-nav="recents" aria-label="App recenti">▢</button>
            </div>
            <form class="applab-keyboard-bar" data-keyboard-bar hidden>
                <input data-keyboard-input type="text" autocomplete="off" autocapitalize="sentences"
                    spellcheck="false" inputmode="text" placeholder="Scrivi nell’app…" aria-label="Testo da inviare all’app">
                <button type="submit">INVIA</button>
                <button type="button" data-keyboard-close aria-label="Chiudi tastiera">×</button>
            </form>
        </div>
    `;
    document.body.append(element);
    document.body.classList.add('applab-immersive');

    const find = selector => element.querySelector(selector);
    const video = find('[data-video]');
    const layer = find('[data-layer]');
    const card = find('[data-card]');
    const statusLabel = find('[data-status]');
    const clock = find('[data-clock]');
    const touchControls = find('[data-touch]');
    const keyboardBar = find('[data-keyboard-bar]');
    const keyboardInput = find('[data-keyboard-input]');

    let connection = null;
    let session = null;
    let expiresAt = null;
    let clockTimer = null;
    let chromeTimer = null;
    let wakeLock = null;
    const activePointers = new Map();
    let closed = false;
    let starting = false;

    const setStatus = text => { if (statusLabel) statusLabel.textContent = text; };

    const showCard = ({ title, text = '', actions = [], busy = false, error = false }) => {
        if (closed) return;
        card.dataset.state = error ? 'error' : busy ? 'busy' : 'info';
        find('[data-spinner]').hidden = !busy;
        find('[data-card-title]').textContent = title;
        find('[data-card-text]').textContent = text;
        const box = find('[data-card-actions]');
        box.replaceChildren();
        actions.forEach(action => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = action.primary ? 'applab-stage-primary' : 'applab-stage-secondary';
            button.textContent = action.label;
            button.onclick = action.onClick;
            box.append(button);
        });
        layer.hidden = false;
    };

    const hideCard = () => { layer.hidden = true; };

    const startClock = () => {
        clearInterval(clockTimer);
        if (!expiresAt) return;
        clock.hidden = false;
        const tick = () => {
            const remaining = (new Date(expiresAt).getTime() - Date.now()) / 1000;
            clock.textContent = formatClock(remaining);
            if (remaining <= 0 && !closed) {
                setStatus('Sessione scaduta');
                showCard({
                    title: 'Sessione terminata',
                    text: 'Il tempo massimo di esecuzione è scaduto e l’ambiente Android è stato chiuso. Riapri l’app per una nuova sessione.',
                    actions: [{ label: 'RIAVVIA', primary: true, onClick: () => void begin(true) }]
                });
                void teardownSession();
            }
        };
        tick();
        clockTimer = setInterval(tick, 1000);
    };

    const releaseWakeLock = async () => {
        try { await wakeLock?.release?.(); } catch { /* già rilasciato */ }
        wakeLock = null;
    };

    const requestWakeLock = async () => {
        try {
            wakeLock = await navigator.wakeLock?.request?.('screen');
        } catch { /* Safari iOS non lo consente: la sessione resta apribile */ }
    };

    const hideChrome = () => {
        element.classList.add('is-quiet');
        find('[data-bar]').classList.add('is-hidden');
    };
    const showChrome = () => {
        element.classList.remove('is-quiet');
        find('[data-bar]').classList.remove('is-hidden');
        clearTimeout(chromeTimer);
        chromeTimer = setTimeout(() => {
            if (!keyboardBar.hidden) return;
            hideChrome();
        }, 4500);
    };
    element.addEventListener('pointerdown', showChrome);

    const enterFullscreen = async () => {
        const root = element;
        try {
            if (root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' });
            else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
        } catch { /* iOS e alcuni browser: si resta in immersivo CSS */ }
        try {
            await screen.orientation?.lock?.('landscape');
        } catch { /* orientamento non bloccabile su iOS */ }
    };

    const exitFullscreen = async () => {
        try {
            if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        } catch { /* nessun fullscreen attivo */ }
        try { screen.orientation?.unlock?.(); } catch { /* niente da sbloccare */ }
    };

    const teardownSession = async () => {
        clearInterval(clockTimer);
        if (session?.sessionId) await stopSession({ sessionId: session.sessionId, appId: app.id });
        session = null;
    };

    const contentRect = () => {
        const box = video.getBoundingClientRect();
        const ratio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 0;
        if (!ratio) return box;
        const boxRatio = box.width / box.height;
        if (boxRatio > ratio) {
            const width = box.height * ratio;
            return { left: box.left + (box.width - width) / 2, top: box.top, width, height: box.height };
        }
        const height = box.width / ratio;
        return { left: box.left, top: box.top + (box.height - height) / 2, width: box.width, height };
    };

    const normalize = (event, id = event.pointerId ?? 0) => {
        const rect = contentRect();
        return {
            x: rect.width ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0,
            y: rect.height ? Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) : 0,
            id
        };
    };

    // Ogni pointer attivo diventa un dito: il runtime riceve l'insieme completo
    // dei punti, così pinch e swipe a più dita arrivano nello stesso evento.
    const touch = (action, event) => {
        if (!connection) return;
        const point = normalize(event);
        if (action === 'down') {
            activePointers.set(event.pointerId, point);
            connection.pointer({ action: 'down', points: [...activePointers.values()] });
        } else if (action === 'move' && activePointers.has(event.pointerId)) {
            activePointers.set(event.pointerId, point);
            connection.pointer({ action: 'move', points: [...activePointers.values()] });
        } else if (action === 'up' || action === 'cancel') {
            activePointers.delete(event.pointerId);
            connection.pointer({ action, points: [point] });
        }
    };

    video.addEventListener('pointerdown', event => {
        if (!connection) return;
        event.preventDefault();
        try { video.setPointerCapture?.(event.pointerId); } catch { /* Safari può rifiutare */ }
        touch('down', event);
        showChrome();
    });
    video.addEventListener('pointermove', event => {
        if (!connection || !activePointers.has(event.pointerId)) return;
        event.preventDefault();
        touch('move', event);
    });
    video.addEventListener('pointerup', event => {
        if (!connection || !activePointers.has(event.pointerId)) return;
        event.preventDefault();
        touch('up', event);
    });
    video.addEventListener('pointercancel', event => {
        if (!connection || !activePointers.has(event.pointerId)) return;
        touch('cancel', event);
    });
    video.addEventListener('wheel', event => {
        if (!connection) return;
        const rect = contentRect();
        connection.scroll({
            x: rect.width ? (event.clientX - rect.left) / rect.width : 0,
            y: rect.height ? (event.clientY - rect.top) / rect.height : 0,
            deltaX: event.deltaX,
            deltaY: event.deltaY
        });
    }, { passive: true });

    const attachStream = stream => {
        video.srcObject = stream;
        video.play().catch(() => { /* l'autoplay può richiedere un tocco: il video resta pronto */ });
    };

    const connect = async target => {
        connection?.close?.();
        connection = await connectStream({
            signalingUrl: target.signalingUrl,
            iceServers: target.iceServers || [],
            onStream: stream => {
                attachStream(stream);
                hideCard();
                touchControls.hidden = false;
                setStatus('Connesso · touch e tastiera attivi');
                onLaunched();
            },
            onState: state => {
                if (state.connection) {
                    setStatus(state.connection === 'connected' ? 'Connesso' : `Connessione: ${state.connection}`);
                }
            },
            onClose: ({ reason }) => {
                if (closed) return;
                if (['disconnected', 'failed', 'signaling_closed'].includes(reason) && session) {
                    showCard({
                        title: 'Sessione interrotta',
                        text: 'Il collegamento allo schermo Android si è chiuso. Puoi riprendere la sessione se è ancora attiva.',
                        actions: [
                            { label: 'RICONNETTI', primary: true, onClick: () => void reconnect() },
                            { label: 'CHIUDI', onClick: () => close() }
                        ],
                        error: true
                    });
                }
            }
        });
        setStatus('Connesso');
    };

    const begin = async restart => {
        if (starting) return;
        starting = true;
        showCard({ title: 'Preparo l’ambiente Android…', text: 'Verifico il runtime remoto e avvio la sessione isolata.', busy: true });
        setStatus('Verifico il runtime…');
        try {
            const status = await runtimeStatus();
            if (!status.configured) {
                const missing = status.missing?.length ? status.missing.join(', ') : 'APP_LAB_RUNTIME_URL / APP_LAB_RUNTIME_TOKEN';
                showCard({
                    title: 'Runtime Android non collegato',
                    text: `La libreria e l’analisi APK funzionano già. Per AVVIA serve un host Android remoto: configura ${missing} nelle variabili del server e riavvia il servizio. Nessuna esecuzione avviene sul server di La Taverna.`,
                    actions: [
                        { label: 'HO CAPITO', primary: true, onClick: () => close() },
                        { label: 'DETTAGLI', onClick: () => showRuntimeDetails(status) }
                    ]
                });
                setStatus('Runtime non configurato');
                starting = false;
                return;
            }
            if (restart) await teardownSession();
            session = await startSession({ appId: app.id });
            expiresAt = session.expiresAt || null;
            startClock();
            setStatus('Ambiente pronto, collego lo schermo…');
            await connect(session);
            await requestWakeLock();
            void enterFullscreen();
        } catch (error) {
            const message = error?.code === 'runtime_not_configured'
                ? error.message
                : appLabErrorMessage(error);
            showCard({
                title: 'Avvio non riuscito',
                text: message || 'Il runtime Android non ha accettato la sessione.',
                actions: [
                    { label: 'RIPROVA', primary: true, onClick: () => void begin(true) },
                    { label: 'CHIUDI', onClick: () => close() }
                ],
                error: true
            });
            setStatus('Errore di avvio');
        } finally {
            starting = false;
        }
    };

    const reconnect = async () => {
        if (!session?.sessionId) {
            await begin(true);
            return;
        }
        showCard({ title: 'Riconnetto la sessione…', text: 'Recupero lo schermo Android senza reinstallare l’app.', busy: true });
        try {
            const resumed = await resumeSession({ sessionId: session.sessionId, appId: app.id });
            session = { ...session, ...resumed };
            expiresAt = session.expiresAt || expiresAt;
            await connect(session);
        } catch (error) {
            showCard({
                title: 'Sessione non più disponibile',
                text: appLabErrorMessage(error),
                actions: [
                    { label: 'NUOVA SESSIONE', primary: true, onClick: () => void begin(true) },
                    { label: 'CHIUDI', onClick: () => close() }
                ],
                error: true
            });
        }
    };

    const showRuntimeDetails = status => {
        const lines = [
            status.reason ? `Motivo: ${status.reason}` : '',
            status.runtime ? `Gateway: ${status.runtime}` : '',
            status.missing?.length ? `Variabili mancanti: ${status.missing.join(', ')}` : '',
            'Il runtime deve essere un host Android (emulatore/container) con gateway WebRTC: non può girare nelle funzioni serverless di Vercel.',
            'I dettagli di installazione sono in docs/app-lab.md.'
        ].filter(Boolean);
        showCard({
            title: 'Cosa manca',
            text: lines.join(' '),
            actions: [{ label: 'CHIUDI', onClick: () => close() }],
            error: true
        });
    };

    const close = async () => {
        if (closed) return;
        closed = true;
        clearTimeout(chromeTimer);
        clearInterval(clockTimer);
        connection?.close?.();
        await teardownSession();
        await releaseWakeLock();
        await exitFullscreen();
        document.body.classList.remove('applab-immersive');
        element.remove();
        onClose();
    };

    find('[data-exit]').addEventListener('click', () => void close());
    element.addEventListener('keydown', event => {
        if (event.key === 'Escape' && keyboardBar.hidden) {
            event.preventDefault();
            void close();
        }
    });
    find('[data-fullscreen]').addEventListener('click', () => {
        if (document.fullscreenElement) void exitFullscreen();
        else void enterFullscreen();
    });
    find('[data-rotate]').addEventListener('click', async () => {
        try {
            const current = screen.orientation?.type || '';
            await screen.orientation?.lock?.(current.startsWith('landscape') ? 'portrait' : 'landscape');
        } catch {
            setStatus(isIos() ? 'Ruota il dispositivo: iOS non consente il blocco automatico' : 'Rotazione non disponibile');
        }
    });
    find('[data-keyboard]').addEventListener('click', () => {
        keyboardBar.hidden = !keyboardBar.hidden;
        find('[data-keyboard]').setAttribute('aria-pressed', String(!keyboardBar.hidden));
        if (!keyboardBar.hidden) keyboardInput.focus({ preventScroll: true });
    });
    find('[data-keyboard-close]').addEventListener('click', () => {
        keyboardBar.hidden = true;
        find('[data-keyboard]').setAttribute('aria-pressed', 'false');
    });
    keyboardBar.addEventListener('submit', event => {
        event.preventDefault();
        connection?.text(keyboardInput.value);
        keyboardInput.value = '';
    });
    keyboardInput.addEventListener('keydown', event => {
        if (!connection) return;
        if (event.key === 'Enter') {
            connection.key({ key: 'Enter', code: 'Enter', action: 'down' });
            connection.key({ key: 'Enter', code: 'Enter', action: 'up' });
        } else if (['Backspace', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            connection.key({ key: event.key, code: event.key, action: 'down' });
            connection.key({ key: event.key, code: event.key, action: 'up' });
        }
    });
    element.querySelectorAll('[data-nav]').forEach(button => {
        button.addEventListener('click', () => {
            const map = { back: ['Escape', 'Escape'], home: ['Home', 'Home'], recents: ['AppSwitch', 'AppSwitch'] };
            const [key, code] = map[button.dataset.nav];
            connection?.key({ key, code, action: 'down' });
            connection?.key({ key, code, action: 'up' });
        });
    });

    void begin(false);
    showChrome();

    return { close, element };
}
