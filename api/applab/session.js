import { sendJson, methodNotAllowed, readJsonBody, publicErrorMessage } from '../_lib/http.js';

/**
 * Proxy autenticato verso il runtime Android remoto.
 *
 * Vercel non può eseguire emulatori: qui verifichiamo l'utente, il possesso
 * dell'APK e i limiti, firmiamo un URL temporaneo per il file e inoltriamo la
 * richiesta al gateway esterno. Se il gateway non è configurato rispondiamo
 * 503 con l'elenco preciso delle variabili mancanti: nessuna sessione finta.
 */

const env = name => process.env[name] || '';
const runtimeUrl = () => env('APP_LAB_RUNTIME_URL').replace(/\/+$/, '');
const runtimeToken = () => env('APP_LAB_RUNTIME_TOKEN');
const supabaseUrl = () => (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/+$/, '');
const supabaseKey = () => env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY');

const runtimeMissing = () => [
    !runtimeUrl() && 'APP_LAB_RUNTIME_URL',
    !runtimeToken() && 'APP_LAB_RUNTIME_TOKEN'
].filter(Boolean);

const limits = () => ({
    minutes: Math.max(5, Math.min(120, Number(env('APP_LAB_SESSION_MINUTES')) || 20)),
    maxConcurrent: Math.max(1, Math.min(5, Number(env('APP_LAB_MAX_SESSIONS')) || 1)),
    cpu: env('APP_LAB_SESSION_CPU') || '2',
    memoryMb: Math.max(512, Math.min(8192, Number(env('APP_LAB_SESSION_MEMORY_MB')) || 2048))
});

const fail = (statusCode, message, extra = {}) => Object.assign(new Error(message), { statusCode, ...extra });

async function authorize(request) {
    const url = supabaseUrl();
    const key = supabaseKey();
    if (!url || !key) throw fail(503, 'Configurazione Supabase non disponibile sul server.');
    const authorization = request.headers?.authorization;
    if (!/^Bearer [A-Za-z0-9._-]+$/.test(authorization || '')) throw fail(401, 'Accedi alla Taverna per avviare una sessione.');
    const response = await fetch(`${url}/auth/v1/user`, {
        headers: { apikey: key, Authorization: authorization },
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw fail(401, 'Sessione scaduta. Accedi nuovamente.');
    const user = await response.json().catch(() => null);
    if (!user?.id) throw fail(401, 'Sessione non valida. Accedi nuovamente.');
    return { user, token: authorization.slice(7) };
}

const restHeaders = token => ({
    apikey: supabaseKey(),
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
});

async function restGet(token, path) {
    const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
        headers: restHeaders(token),
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
        throw fail(response.status === 404 ? 503 : 502, 'Libreria APP LAB non disponibile. Applica la migrazione app_lab.');
    }
    return response.json();
}

async function restInsert(token, table, row) {
    const response = await fetch(`${supabaseUrl()}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...restHeaders(token), Prefer: 'return=representation' },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw fail(502, 'Non riesco a registrare la sessione.');
    const data = await response.json().catch(() => null);
    return Array.isArray(data) ? data[0] : data;
}

async function restPatch(token, path, patch) {
    const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
        method: 'PATCH',
        headers: { ...restHeaders(token), Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) console.warn('APP LAB: aggiornamento sessione non riuscito', response.status);
}

async function signedApkUrl(token, storagePath) {
    const path = String(storagePath || '').split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${supabaseUrl()}/storage/v1/object/sign/app_lab_apks/${path}`, {
        method: 'POST',
        headers: restHeaders(token),
        body: JSON.stringify({ expiresIn: 900 }),
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw fail(500, 'Non riesco a preparare il file per il runtime.');
    const data = await response.json().catch(() => null);
    if (!data?.signedURL) throw fail(500, 'Link temporaneo non disponibile.');
    return `${supabaseUrl()}/storage/v1${data.signedURL}`;
}

async function gateway(path, { method = 'POST', body, token } = {}) {
    const response = await fetch(`${runtimeUrl()}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token || runtimeToken()}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        console.warn('APP LAB: gateway error', response.status, payload?.error || payload?.message);
        throw fail(502, 'Il runtime Android ha rifiutato la richiesta. Riprova più tardi.');
    }
    return payload || {};
}

async function startSession({ token, user, appId }) {
    if (runtimeMissing().length) {
        const error = fail(503, 'Runtime Android non collegato.', {
            code: 'runtime_not_configured', missing: runtimeMissing()
        });
        throw error;
    }
    const apps = await restGet(token,
        `app_lab_apps?id=eq.${encodeURIComponent(appId)}&owner_id=eq.${encodeURIComponent(user.id)}`
        + '&select=id,name,package_name,status,compatibility,storage_path');
    const app = apps?.[0];
    if (!app) throw fail(404, 'Applicazione non trovata nella tua libreria.');
    if (app.status !== 'ready') throw fail(409, 'L’applicazione non è ancora pronta per l’esecuzione.');
    if (app.compatibility === 'blocked') throw fail(409, 'Questa applicazione non può essere eseguita nel runtime remoto.');

    const settings = limits();
    const running = await restGet(token,
        `app_lab_sessions?owner_id=eq.${encodeURIComponent(user.id)}&status=in.(requested,running)&select=id`);
    if ((running?.length || 0) >= settings.maxConcurrent) {
        throw fail(429, 'Hai già una sessione attiva. Chiudila prima di aprirne un’altra.');
    }

    const apkUrl = await signedApkUrl(token, app.storage_path);
    const payload = await gateway('/sessions', {
        body: {
            app: { id: app.id, name: app.name, packageName: app.package_name },
            apk: { url: apkUrl, filename: `${app.package_name || 'app'}.apk` },
            limits: { minutes: settings.minutes, cpu: settings.cpu, memoryMb: settings.memoryMb },
            owner: { id: user.id }
        }
    });

    const providerId = payload.sessionId || payload.id;
    const signalingUrl = payload.signalingUrl || payload.wsUrl;
    if (!providerId || !signalingUrl) {
        await gateway(`/sessions/${encodeURIComponent(providerId || '')}`, { method: 'DELETE' }).catch(() => {});
        throw fail(502, 'Il runtime ha risposto senza un canale di streaming.');
    }
    const expiresAt = payload.expiresAt || new Date(Date.now() + settings.minutes * 60000).toISOString();

    const row = await restInsert(token, 'app_lab_sessions', {
        app_id: app.id,
        owner_id: user.id,
        provider: 'applab-gateway',
        provider_session_id: String(providerId).slice(0, 200),
        status: 'running',
        started_at: new Date().toISOString(),
        expires_at: expiresAt,
        resource_limits: { minutes: settings.minutes, cpu: settings.cpu, memoryMb: settings.memoryMb }
    }).catch(async error => {
        await gateway(`/sessions/${encodeURIComponent(providerId)}`, { method: 'DELETE' }).catch(() => {});
        throw error;
    });

    return {
        sessionId: row?.id,
        providerSessionId: String(providerId),
        signalingUrl,
        iceServers: Array.isArray(payload.iceServers) ? payload.iceServers : [],
        expiresAt
    };
}

async function findSession(token, user, sessionId) {
    const rows = await restGet(token,
        `app_lab_sessions?id=eq.${encodeURIComponent(sessionId)}&owner_id=eq.${encodeURIComponent(user.id)}`
        + '&select=id,app_id,provider_session_id,status');
    const row = rows?.[0];
    if (!row) throw fail(404, 'Sessione non trovata.');
    return row;
}

async function resumeSession({ token, user, sessionId, appId }) {
    if (runtimeMissing().length) throw fail(503, 'Runtime Android non collegato.', {
        code: 'runtime_not_configured', missing: runtimeMissing()
    });
    const row = await findSession(token, user, sessionId);
    if (appId && row.app_id !== appId) throw fail(403, 'La sessione appartiene a un’altra applicazione.');
    if (row.status !== 'running' || !row.provider_session_id) {
        throw fail(409, 'La sessione è già terminata. Avviane una nuova.');
    }
    const payload = await gateway(`/sessions/${encodeURIComponent(row.provider_session_id)}/resume`, { body: {} });
    const signalingUrl = payload.signalingUrl || payload.wsUrl;
    if (!signalingUrl) throw fail(502, 'Il runtime non ha fornito un nuovo canale di streaming.');
    return {
        sessionId: row.id,
        providerSessionId: row.provider_session_id,
        signalingUrl,
        iceServers: Array.isArray(payload.iceServers) ? payload.iceServers : [],
        expiresAt: payload.expiresAt || null
    };
}

async function stopSession({ token, user, sessionId }) {
    const row = await findSession(token, user, sessionId);
    if (row.provider_session_id) {
        await gateway(`/sessions/${encodeURIComponent(row.provider_session_id)}`, { method: 'DELETE' }).catch(() => {});
    }
    await restPatch(token, `app_lab_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
        status: 'stopped', ended_at: new Date().toISOString()
    });
    return { stopped: true };
}

export default async function handler(request, response) {
    if (request.method === 'GET') {
        sendJson(response, 200, {
            ok: true,
            configured: runtimeMissing().length === 0,
            missing: runtimeMissing(),
            runtime: runtimeUrl() ? new URL(runtimeUrl()).host : null,
            maxMinutes: limits().minutes,
            maxConcurrent: limits().maxConcurrent
        });
        return;
    }
    if (request.method !== 'POST') {
        methodNotAllowed(response, ['GET', 'POST']);
        return;
    }
    try {
        if (!supabaseUrl() || !supabaseKey()) {
            sendJson(response, 503, { ok: false, code: 'supabase_not_configured', error: 'Supabase non configurato sul server.' });
            return;
        }
        const body = await readJsonBody(request, 8192);
        const action = String(body.action || 'start');
        const { user, token } = await authorize(request);

        if (action === 'start') {
            if (runtimeMissing().length) {
                sendJson(response, 503, {
                    ok: false,
                    code: 'runtime_not_configured',
                    error: 'Runtime Android non collegato.',
                    missing: runtimeMissing()
                });
                return;
            }
            if (!/^[0-9a-f-]{36}$/i.test(String(body.appId || ''))) {
                sendJson(response, 400, { ok: false, error: 'Applicazione non valida.' });
                return;
            }
            const session = await startSession({ token, user, appId: body.appId });
            sendJson(response, 200, { ok: true, session });
            return;
        }

        if (action === 'resume' || action === 'stop') {
            if (!/^[0-9a-f-]{36}$/i.test(String(body.sessionId || ''))) {
                sendJson(response, 400, { ok: false, error: 'Sessione non valida.' });
                return;
            }
            if (action === 'resume') {
                const session = await resumeSession({ token, user, sessionId: body.sessionId, appId: body.appId });
                sendJson(response, 200, { ok: true, session });
            } else {
                const result = await stopSession({ token, user, sessionId: body.sessionId });
                sendJson(response, 200, { ok: true, ...result });
            }
            return;
        }

        sendJson(response, 400, { ok: false, error: 'Azione non supportata.' });
    } catch (error) {
        sendJson(response, Number(error?.statusCode) || 500, {
            ok: false,
            code: error?.code,
            error: publicErrorMessage(error),
            missing: error?.missing
        });
    }
}
