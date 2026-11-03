#!/usr/bin/env node
/**
 * APP LAB — gateway Android.
 *
 * Un emulatore per volta: scarica l'APK firmato, lo installa, apre l'activity
 * di lancio e trasmette lo schermo in WebRTC tramite mediamtx (WHIP → WHEP).
 * I comandi arrivano sul WebSocket di signaling e vengono tradotti in
 * `adb shell input`: mediamtx non negozia canali dati, quindi il gateway
 * dichiara `input: "ws"` e il player usa quel canale.
 *
 * Contratto HTTP (vedi docs/app-lab.md):
 *   POST   /sessions              -> {sessionId, signalingUrl, input, expiresAt}
 *   POST   /sessions/{id}/resume  -> {signalingUrl, input, expiresAt}
 *   DELETE /sessions/{id}         -> 204
 *   GET    /health                -> stato di emulatore e sessioni
 *   WS     /signal/{id}?token=…   -> {type:"offer"} / {type:"answer"} + input
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';

const env = (key, fallback = '') => process.env[key] || fallback;
const PORT = Number(env('GATEWAY_PORT', '8790'));
const TOKEN = env('APP_LAB_RUNTIME_TOKEN');
const PUBLIC_URL = env('GATEWAY_PUBLIC_URL', `http://127.0.0.1:${PORT}`).replace(/\/+$/, '');
const ADB = env('ADB_BIN', 'adb');
const EMULATOR = env('EMULATOR_BIN', 'emulator');
const AVD = env('ANDROID_AVD', 'applab');
const FFMPEG = env('FFMPEG_BIN', 'ffmpeg');
const WHIP = env('MEDIAMTX_WHIP', 'http://127.0.0.1:8889/applab/whip');
const WHEP = env('MEDIAMTX_WHEP', 'http://127.0.0.1:8889/applab/whep');
const SESSION_MINUTES = Number(env('SESSION_MINUTES', '20'));
const CAPTURE_FPS = Number(env('CAPTURE_FPS', '10'));

if (!TOKEN) {
    console.error('APP_LAB_RUNTIME_TOKEN non impostato: il gateway non parte senza token.');
    process.exit(1);
}

const children = new Set();
const sessions = new Map();
let emulator = null;
let publishing = null;
let screen = { width: 720, height: 1280 };

const log = (...args) => console.log(new Date().toISOString(), ...args);

const run = (command, args, { timeout = 30000 } = {}) => new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    children.add(proc);
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error(`${command} non ha risposto entro ${timeout} ms`));
    }, timeout);
    proc.stdout.on('data', chunk => { out += chunk; });
    proc.stderr.on('data', chunk => { err += chunk; });
    proc.on('error', error => { clearTimeout(timer); children.delete(proc); reject(error); });
    proc.on('close', code => {
        clearTimeout(timer);
        children.delete(proc);
        if (code === 0) resolve(out.trim());
        else reject(new Error(`${command} ${args.join(' ')} → codice ${code}: ${err.trim().slice(0, 300)}`));
    });
});

const adb = (args, options = {}) => run(ADB, emulator?.serial ? ['-s', emulator.serial, ...args] : args, options);

async function deviceSerial() {
    const output = await run(ADB, ['devices'], { timeout: 10000 }).catch(() => '');
    const line = output.split('\n').map(row => row.trim()).find(row => /^emulator-\d+\s+device$/.test(row));
    return line ? line.split(/\s+/)[0] : null;
}

async function waitBoot(serial, timeoutMs = 240000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        try {
            const value = await run(ADB, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], { timeout: 6000 });
            if (value.trim() === '1') return;
        } catch { /* ancora in avvio */ }
        await new Promise(done => setTimeout(done, 2000));
    }
    throw new Error('L’emulatore non ha completato l’avvio entro il tempo previsto.');
}

async function ensureEmulator() {
    const existing = await deviceSerial();
    if (existing) {
        emulator = emulator?.serial === existing ? emulator : { proc: emulator?.proc || null, serial: existing };
        return emulator;
    }
    if (!emulator?.proc) {
        log(`avvio emulatore ${AVD}`);
        const proc = spawn(EMULATOR, [
            '-avd', AVD, '-no-window', '-no-audio', '-no-boot-anim',
            '-gpu', 'swiftshader_indirect', '-memory', '2048', '-no-snapshot-save'
        ], { stdio: ['ignore', 'ignore', 'pipe'] });
        children.add(proc);
        proc.stderr.on('data', chunk => {
            const text = String(chunk).trim();
            if (/error|fail/i.test(text)) console.error('[emulator]', text.slice(0, 200));
        });
        proc.on('exit', () => { children.delete(proc); if (emulator?.proc === proc) emulator = null; });
        emulator = { proc, serial: null };
    }
    const started = Date.now();
    while (Date.now() - started < 240000) {
        const serial = await deviceSerial();
        if (serial) {
            emulator.serial = serial;
            await waitBoot(serial);
            await adb(['shell', 'settings', 'put', 'global', 'window_animation_scale', '0']).catch(() => {});
            await adb(['shell', 'settings', 'put', 'global', 'transition_animation_scale', '0']).catch(() => {});
            log(`emulatore pronto su ${serial}`);
            return emulator;
        }
        await new Promise(done => setTimeout(done, 2000));
    }
    throw new Error('adb non ha rilevato nessun emulatore.');
}

async function readScreenSize() {
    const output = await adb(['shell', 'wm', 'size']).catch(() => '');
    const match = output.match(/(\d+)x(\d+)/);
    if (match) screen = { width: Number(match[1]), height: Number(match[2]) };
    return screen;
}

/**
 * Un frame PNG per volta.
 *
 * `screenrecord` in pipe consegna solo un paio di frame e chiude (verificato:
 * 17 KB in 6 s contro 216 KB in 5 s su file), mentre `screencap` costa ~80 ms:
 * a 10 fps il flusso resta continuo e senza il limite dei 180 s.
 */
function captureFrame(serial) {
    return new Promise(resolve => {
        const proc = spawn(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], { stdio: ['ignore', 'pipe', 'pipe'] });
        const chunks = [];
        proc.stdout.on('data', chunk => chunks.push(chunk));
        proc.on('error', () => resolve(null));
        proc.on('close', code => resolve(code === 0 ? Buffer.concat(chunks) : null));
    });
}

function startPublisher() {
    if (publishing) return publishing;
    const state = { stopped: false, proc: null };
    publishing = state;
    const serial = emulator?.serial;
    if (!serial) return state;

    const publish = spawn(FFMPEG, [
        '-hide_banner', '-loglevel', 'error',
        '-f', 'image2pipe', '-framerate', String(CAPTURE_FPS), '-i', 'pipe:0',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
        '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-g', '20',
        '-f', 'whip', WHIP
    ], { stdio: ['pipe', 'ignore', 'pipe'] });
    children.add(publish);
    state.proc = publish;
    publish.stderr.on('data', chunk => console.error('[ffmpeg]', String(chunk).trim().slice(0, 160)));
    publish.on('exit', () => {
        children.delete(publish);
        state.proc = null;
        if (!state.stopped && publishing === state) {
            publishing = null;
            setTimeout(() => { if (!state.stopped) startPublisher(); }, 1500);
        }
    });

    const frameMs = Math.max(40, Math.round(1000 / CAPTURE_FPS));
    const pump = async () => {
        while (!state.stopped && publishing === state) {
            const started = Date.now();
            const frame = await captureFrame(serial);
            if (state.stopped || publishing !== state) return;
            if (frame && publish.stdin.writable) {
                if (!publish.stdin.write(frame)) await new Promise(done => publish.stdin.once('drain', done));
            }
            const elapsed = Date.now() - started;
            if (elapsed < frameMs) await new Promise(done => setTimeout(done, frameMs - elapsed));
        }
    };
    pump();
    return state;
}

function stopPublisher() {
    if (!publishing) return;
    publishing.stopped = true;
    const proc = publishing.proc;
    publishing = null;
    try { proc?.kill('SIGKILL'); } catch { /* già chiuso */ }
}

const KEYS = {
    Escape: 'KEYCODE_BACK', Back: 'KEYCODE_BACK', Home: 'KEYCODE_HOME', AppSwitch: 'KEYCODE_APP_SWITCH',
    Enter: 'KEYCODE_ENTER', Backspace: 'KEYCODE_DEL', Tab: 'KEYCODE_TAB',
    ArrowUp: 'KEYCODE_DPAD_UP', ArrowDown: 'KEYCODE_DPAD_DOWN',
    ArrowLeft: 'KEYCODE_DPAD_LEFT', ArrowRight: 'KEYCODE_DPAD_RIGHT'
};

const escapeText = value => String(value)
    .replace(/ /g, '%s')
    .replace(/([\\()&|;<>*?"'`$!#~])/g, '\\$1');

const toPixels = point => ({
    x: Math.round(Math.min(1, Math.max(0, point.x)) * (screen.width - 1)),
    y: Math.round(Math.min(1, Math.max(0, point.y)) * (screen.height - 1))
});

async function handlePointer(session, message) {
    const point = message.points?.[0];
    if (!point) return;
    const { x, y } = toPixels(point);
    if (message.action === 'down') {
        session.pointer = { x, y, at: Date.now() };
        return;
    }
    if (message.action === 'move') {
        if (session.pointer) session.pointer = { ...session.pointer, x, y };
        return;
    }
    if (message.action === 'cancel') {
        session.pointer = null;
        return;
    }
    if (message.action !== 'up') return;
    const start = session.pointer;
    session.pointer = null;
    if (!start) return;
    const distance = Math.hypot(x - start.x, y - start.y);
    const duration = Math.min(1500, Math.max(90, Date.now() - start.at));
    if (distance < 14 && duration < 700) {
        await adb(['shell', 'input', 'tap', String(x), String(y)]);
        return;
    }
    await adb(['shell', 'input', 'swipe', String(start.x), String(start.y), String(x), String(y), String(duration)]);
}

async function handleInput(session, message) {
    switch (message.type) {
        case 'touch':
            return handlePointer(session, message);
        case 'scroll': {
            const { x, y } = toPixels(message);
            const delta = Math.max(-600, Math.min(600, Number(message.deltaY) || 0));
            const end = Math.round(y - delta);
            return adb(['shell', 'input', 'swipe', String(x), String(y), String(x), String(end), '220']);
        }
        case 'key': {
            const code = KEYS[message.key] || KEYS[message.code];
            if (!code || message.action === 'up') return;
            return adb(['shell', 'input', 'keyevent', code]);
        }
        case 'text':
            if (!message.value) return;
            return adb(['shell', 'input', 'text', escapeText(message.value)]);
        case 'ping':
            return;
        default:
            return;
    }
}

async function whepAnswer(offerSdp) {
    const response = await fetch(WHEP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: offerSdp,
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`mediamtx ha rifiutato l'offerta (${response.status}): ${detail.slice(0, 160)}`);
    }
    return response.text();
}

function signalingUrl(sessionId) {
    const base = PUBLIC_URL.replace(/^http/, 'ws');
    return `${base}/signal/${sessionId}?token=${encodeURIComponent(TOKEN)}`;
}

function publicSession(session) {
    return {
        sessionId: session.id,
        signalingUrl: signalingUrl(session.id),
        input: 'ws',
        iceServers: [],
        expiresAt: session.expiresAt,
        packageName: session.packageName
    };
}

function destroySession(id) {
    const session = sessions.get(id);
    if (!session) return;
    clearTimeout(session.timer);
    sessions.delete(id);
    if (!sessions.size) stopPublisher();
    log(`sessione ${id} chiusa`);
}

async function createSession(body) {
    const apkUrl = body?.apk?.url;
    if (!apkUrl) throw Object.assign(new Error('Manca l’URL firmato dell’APK.'), { statusCode: 400 });
    await ensureEmulator();
    await readScreenSize();

    const dir = await mkdtemp(join(tmpdir(), 'applab-'));
    const file = join(dir, body.apk.filename || 'app.apk');
    try {
        const response = await fetch(apkUrl, { signal: AbortSignal.timeout(180000) });
        if (!response.ok) throw new Error(`APK non scaricabile (${response.status}).`);
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
        log(`installo ${body.app?.packageName || file}`);
        await adb(['install', '-r', '-d', file], { timeout: 240000 });
    } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
    }

    const packageName = body.app?.packageName;
    if (packageName) {
        await adb(['shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1'], { timeout: 30000 })
            .catch(error => log('avvio activity non riuscito:', error.message));
    }
    startPublisher();
    await new Promise(done => setTimeout(done, 2500));

    const id = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60000).toISOString();
    const session = { id, packageName, expiresAt, pointer: null };
    session.timer = setTimeout(() => destroySession(id), SESSION_MINUTES * 60000);
    sessions.set(id, session);
    log(`sessione ${id} pronta per ${packageName || 'app'}`);
    return publicSession(session);
}

const json = (res, statusCode, payload) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
};

const authorized = req => req.headers.authorization === `Bearer ${TOKEN}`;

const server = createServer(async (req, res) => {
    const url = new URL(req.url, PUBLIC_URL);
    try {
        if (req.method === 'GET' && url.pathname === '/health') {
            return json(res, 200, {
                ok: true,
                emulator: emulator?.serial || null,
                sessions: sessions.size,
                whep: WHEP
            });
        }
        if (!authorized(req)) return json(res, 401, { error: 'Token del runtime non valido.' });

        if (req.method === 'POST' && url.pathname === '/sessions') {
            const body = await readJson(req);
            const session = await createSession(body);
            return json(res, 201, session);
        }
        const resume = url.pathname.match(/^\/sessions\/([\w-]+)\/resume$/);
        if (req.method === 'POST' && resume) {
            const session = sessions.get(resume[1]);
            if (!session) return json(res, 404, { error: 'Sessione non più attiva.' });
            return json(res, 200, publicSession(session));
        }
        const remove = url.pathname.match(/^\/sessions\/([\w-]+)$/);
        if (req.method === 'DELETE' && remove) {
            destroySession(remove[1]);
            res.writeHead(204).end();
            return;
        }
        return json(res, 404, { error: 'Rotta non trovata.' });
    } catch (error) {
        log('errore:', error.message);
        const status = error.statusCode || 502;
        if (!res.headersSent) return json(res, status, { error: error.message });
    }
});

const readJson = req => new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
        size += chunk.length;
        if (size > 1024 * 1024) {
            reject(Object.assign(new Error('Richiesta troppo grande.'), { statusCode: 413 }));
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });
    req.on('end', () => {
        try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
        } catch {
            reject(Object.assign(new Error('JSON non valido.'), { statusCode: 400 }));
        }
    });
    req.on('error', reject);
});

const sockets = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, PUBLIC_URL);
    const match = url.pathname.match(/^\/signal\/([\w-]+)$/);
    const token = url.searchParams.get('token');
    if (!match || token !== TOKEN) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }
    const session = sessions.get(match[1]);
    if (!session) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
    }
    sockets.handleUpgrade(req, socket, head, ws => sockets.emit('connection', ws, req, session));
});

sockets.on('connection', (ws, req, session) => {
    log(`signaling aperto per ${session.id}`);
    let answered = false;
    ws.on('message', async raw => {
        let message;
        try { message = JSON.parse(String(raw)); } catch { return; }
        if (message.type === 'offer') {
            if (answered) return;
            answered = true;
            try {
                const offer = message.sdp?.sdp || message.sdp;
                const answer = await whepAnswer(offer);
                ws.send(JSON.stringify({ type: 'answer', sdp: { type: 'answer', sdp: answer } }));
            } catch (error) {
                log('WHEP:', error.message);
                ws.send(JSON.stringify({ type: 'error', message: error.message }));
                ws.close();
            }
            return;
        }
        if (!answered) return;
        try {
            await handleInput(session, message);
        } catch (error) {
            log('input:', error.message);
        }
    });
    ws.on('close', () => log(`signaling chiuso per ${session.id}`));
});

server.listen(PORT, '127.0.0.1', () => {
    log(`gateway in ascolto su ${PUBLIC_URL} (WHEP ${WHEP})`);
});

const shutdown = () => {
    for (const id of [...sessions.keys()]) destroySession(id);
    stopPublisher();
    for (const proc of children) {
        try { proc.kill('SIGKILL'); } catch { /* già chiuso */ }
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
