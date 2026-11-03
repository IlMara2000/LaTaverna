/**
 * APP LAB — client del runtime Android remoto.
 *
 * Il runtime NON gira su Vercel: gira su un host dedicato (container Android /
 * emulatore + gateway WebRTC) raggiungibile via HTTPS. Questo modulo parla con
 * il proxy same-origin `/api/applab/session`, che verifica l'utente, i permessi
 * sull'app e inoltra la richiesta al gateway con un token server-side.
 *
 * Contratto del gateway (vedi docs/app-lab.md):
 *   POST   {RUNTIME}/sessions        -> {sessionId, signalingUrl, iceServers, expiresAt}
 *   GET    {RUNTIME}/sessions/{id}   -> {status}
 *   DELETE {RUNTIME}/sessions/{id}
 *   WS     signalingUrl              -> offer/answer/ICE + canale dati "control"
 */

const SESSION_ENDPOINT = import.meta.env?.VITE_APP_LAB_RUNTIME_ENDPOINT || '/api/applab/session';

export class RuntimeError extends Error {
    constructor(message, { code = 'runtime_error', missing = [], status = 0 } = {}) {
        super(message);
        this.name = 'RuntimeError';
        this.code = code;
        this.missing = missing;
        this.status = status;
    }
}

const readError = async response => {
    const payload = await response.json().catch(() => null);
    return {
        message: payload?.error || `Runtime non disponibile (HTTP ${response.status}).`,
        code: payload?.code || 'runtime_error',
        missing: Array.isArray(payload?.missing) ? payload.missing : [],
        status: response.status
    };
};

const request = async (body, { method = 'POST' } = {}) => {
    const response = await fetch(SESSION_ENDPOINT, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: method === 'POST' ? JSON.stringify(body) : undefined
    }).catch(() => {
        throw new RuntimeError('Impossibile raggiungere il servizio APP LAB. Controlla la connessione.', { code: 'network' });
    });
    if (!response.ok) {
        const detail = await readError(response);
        throw new RuntimeError(detail.message, detail);
    }
    return response.json();
};

/** Stato del gateway: serve a mostrare all'utente cosa manca, senza fingere. */
export async function runtimeStatus() {
    try {
        const response = await fetch(`${SESSION_ENDPOINT}?action=status`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin'
        });
        if (!response.ok) {
            return { configured: false, reachable: false, missing: [], reason: `HTTP ${response.status}` };
        }
        return await response.json();
    } catch {
        return { configured: false, reachable: false, missing: [], reason: 'endpoint_non_disponibile' };
    }
}

export async function startSession({ appId }) {
    const data = await request({ action: 'start', appId });
    if (!data?.session?.signalingUrl) {
        throw new RuntimeError('Il runtime ha risposto senza un canale di streaming.', { code: 'invalid_response' });
    }
    return data.session;
}

export async function resumeSession({ sessionId, appId }) {
    const data = await request({ action: 'resume', sessionId, appId });
    if (!data?.session?.signalingUrl) {
        throw new RuntimeError('La sessione non è più disponibile.', { code: 'session_expired' });
    }
    return data.session;
}

export async function stopSession({ sessionId, appId }) {
    if (!sessionId) return;
    try {
        await request({ action: 'stop', sessionId, appId });
    } catch (error) {
        console.warn('APP LAB: chiusura sessione non confermata', error);
    }
}

/**
 * Connessione WebRTC al gateway: video/audio remoti + canale dati per input.
 * Restituisce un controller con invio eventi, riconnessione e chiusura.
 */
export async function connectStream({ signalingUrl, iceServers = [], onStream, onState = () => {}, onClose = () => {} }) {
    if (typeof RTCPeerConnection === 'undefined') {
        throw new RuntimeError('Questo browser non supporta WebRTC: impossibile ricevere lo schermo Android.', { code: 'webrtc_unsupported' });
    }
    const socket = new WebSocket(signalingUrl);
    const pc = new RTCPeerConnection({ iceServers });
    const remote = new MediaStream();
    let control = null;
    let closed = false;
    const pending = [];

    const send = payload => {
        const text = JSON.stringify(payload);
        if (control?.readyState === 'open') control.send(text);
        else pending.push(text);
    };

    pc.addTransceiver?.('video', { direction: 'recvonly' });
    pc.addTransceiver?.('audio', { direction: 'recvonly' });
    pc.ontrack = event => {
        const tracks = event.streams?.[0]?.getTracks?.() || [event.track];
        tracks.forEach(track => { if (track) remote.addTrack(track); });
        onStream?.(remote);
    };
    pc.onicecandidate = event => {
        if (event.candidate) send({ type: 'ice', candidate: event.candidate.toJSON?.() || event.candidate });
    };
    pc.ondatachannel = event => {
        if (event.channel.label !== 'control') return;
        control = event.channel;
        pending.splice(0).forEach(text => control.send(text));
    };
    control = pc.createDataChannel('control', { ordered: true });
    control.onopen = () => {
        pending.splice(0).forEach(text => control.send(text));
    };

    const closeSocket = () => {
        try { socket.close(); } catch { /* già chiuso */ }
    };

    // Il browser è il peer che offre: invia l'offer appena il canale è aperto,
    // poi attende answer e candidati ICE dal gateway.
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new RuntimeError('Il gateway non ha risposto in tempo.', { code: 'signaling_timeout' })), 20000);
        const settle = (done, value) => { clearTimeout(timer); done(value); };
        socket.onopen = async () => {
            onState({ signaling: 'open' });
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.send(JSON.stringify({ type: 'offer', sdp: offer }));
            } catch (error) {
                settle(reject, error);
            }
        };
        socket.onerror = () => settle(reject, new RuntimeError('Connessione al gateway interrotta.', { code: 'signaling_error' }));
        socket.onclose = () => {
            onState({ signaling: 'closed' });
            if (!closed) onClose({ reason: 'signaling_closed' });
        };
        socket.onmessage = async raw => {
            let message;
            try { message = JSON.parse(raw.data); } catch { return; }
            if (message.type === 'answer') {
                try {
                    await pc.setRemoteDescription(message.sdp);
                    settle(resolve, true);
                } catch (error) { settle(reject, error); }
            } else if (message.type === 'ice' && message.candidate) {
                try { await pc.addIceCandidate(message.candidate); } catch { /* candidato tardivo */ }
            } else if (message.type === 'error') {
                settle(reject, new RuntimeError(message.message || 'Il runtime ha rifiutato la sessione.', { code: 'runtime_rejected' }));
            }
        };
    }).catch(error => {
        closeSocket();
        throw error;
    });
    onState({ connection: 'connecting' });

    let heartbeat;
    const startHeartbeat = () => {
        clearInterval(heartbeat);
        heartbeat = setInterval(() => {
            if (control?.readyState === 'open') control.send(JSON.stringify({ type: 'ping', at: Date.now() }));
        }, 20000);
    };
    pc.onconnectionstatechange = () => {
        onState({ connection: pc.connectionState });
        if (pc.connectionState === 'connected') startHeartbeat();
        if (['failed', 'disconnected'].includes(pc.connectionState) && !closed) onClose({ reason: pc.connectionState });
    };

    return {
        stream: remote,
        send,
        pointer({ action, points, button = 0 }) {
            send({
                type: 'touch', action, button,
                points: (points || []).map(point => ({
                    id: point.id ?? 0,
                    x: Math.min(1, Math.max(0, point.x)),
                    y: Math.min(1, Math.max(0, point.y))
                }))
            });
        },
        scroll({ x, y, deltaX = 0, deltaY = 0 }) {
            send({ type: 'scroll', x, y, deltaX, deltaY });
        },
        key({ key, code, action = 'down' }) {
            send({ type: 'key', key, code, action });
        },
        text(value) {
            if (value) send({ type: 'text', value: String(value).slice(0, 256) });
        },
        async close() {
            if (closed) return;
            closed = true;
            clearInterval(heartbeat);
            closeSocket();
            try { pc.close(); } catch { /* già chiuso */ }
        }
    };
}
