import { sendJson, methodNotAllowed, readJsonBody, publicErrorMessage } from '../_lib/http.js';

/**
 * Orchestrazione dei job di build iOS su un servizio macOS esterno con Xcode.
 *
 * Un .ipa può esistere solo dopo una compilazione firmata riuscita. Questo
 * endpoint non compila nulla: accoda il job, fornisce al builder un URL firmato
 * per scaricare i sorgenti e uno per caricare l'IPA, poi sincronizza lo stato.
 * Senza APP_LAB_BUILD_SERVICE_URL risponde 503 con le variabili mancanti.
 */

const env = name => process.env[name] || '';
const supabaseUrl = () => (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/+$/, '');
const supabaseKey = () => env('SUPABASE_ANON_KEY') || env('VITE_SUPABASE_ANON_KEY');
const buildUrl = () => env('APP_LAB_BUILD_SERVICE_URL').replace(/\/+$/, '');
const buildToken = () => env('APP_LAB_BUILD_SERVICE_TOKEN');

const buildMissing = () => [
    !buildUrl() && 'APP_LAB_BUILD_SERVICE_URL',
    !buildToken() && 'APP_LAB_BUILD_SERVICE_TOKEN'
].filter(Boolean);

const fail = (statusCode, message, extra = {}) => Object.assign(new Error(message), { statusCode, ...extra });

async function authorize(request) {
    const url = supabaseUrl();
    const key = supabaseKey();
    if (!url || !key) throw fail(503, 'Configurazione Supabase non disponibile sul server.');
    const authorization = request.headers?.authorization;
    if (!/^Bearer [A-Za-z0-9._-]+$/.test(authorization || '')) throw fail(401, 'Accedi alla Taverna.');
    const response = await fetch(`${url}/auth/v1/user`, {
        headers: { apikey: key, Authorization: authorization },
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw fail(401, 'Sessione scaduta. Accedi nuovamente.');
    const user = await response.json().catch(() => null);
    if (!user?.id) throw fail(401, 'Sessione non valida.');
    return { user, token: authorization.slice(7) };
}

const headers = token => ({
    apikey: supabaseKey(),
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
});

async function restGet(token, path) {
    const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
        headers: headers(token), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw fail(502, 'Progetti di porting non disponibili. Applica la migrazione app_lab.');
    return response.json();
}

async function restPatch(token, path, patch) {
    const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
        method: 'PATCH',
        headers: { ...headers(token), Prefer: 'return=representation' },
        body: JSON.stringify(patch),
        signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw fail(502, 'Aggiornamento del progetto non riuscito.');
    const data = await response.json().catch(() => null);
    return Array.isArray(data) ? data[0] : data;
}

async function signedUrl(token, bucket, path, expiresIn = 3600) {
    const encoded = String(path || '').split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${supabaseUrl()}/storage/v1/object/sign/${bucket}/${encoded}`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({ expiresIn }),
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return data?.signedURL ? `${supabaseUrl()}/storage/v1${data.signedURL}` : null;
}

async function signedUpload(token, bucket, path) {
    const encoded = String(path).split('/').map(encodeURIComponent).join('/');
    const response = await fetch(`${supabaseUrl()}/storage/v1/object/upload/sign/${bucket}/${encoded}`, {
        method: 'POST',
        headers: headers(token),
        body: '{}',
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    if (!data?.url) return null;
    return `${supabaseUrl()}/storage/v1${data.url}`;
}

async function builder(path, { method = 'POST', body } = {}) {
    const response = await fetch(`${buildUrl()}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${buildToken()}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        console.warn('APP LAB: build service error', response.status, payload?.error);
        throw fail(502, 'Il servizio di build iOS ha rifiutato la richiesta.');
    }
    return payload || {};
}

async function loadProject(token, ownerId, projectId) {
    const projects = await restGet(token,
        `app_lab_porting_projects?id=eq.${encodeURIComponent(projectId)}&owner_id=eq.${encodeURIComponent(ownerId)}&select=*`);
    const project = projects?.[0];
    if (!project) throw fail(404, 'Progetto di porting non trovato.');
    const apps = await restGet(token,
        `app_lab_apps?id=eq.${encodeURIComponent(project.app_id)}&owner_id=eq.${encodeURIComponent(ownerId)}`
        + '&select=id,name,package_name,version_name,storage_path');
    return { project, app: apps?.[0] || null };
}

async function startBuild({ token, user, projectId }) {
    const { project, app } = await loadProject(token, user.id, projectId);
    if (!app) throw fail(409, 'L’app collegata al progetto non esiste più.');
    if (project.mode !== 'source' || !project.source_path) {
        throw fail(409, 'Serve il progetto sorgente caricato: un APK da solo non può essere compilato in iOS.');
    }
    const sourceUrl = await signedUrl(token, 'app_lab_sources', project.source_path, 3600);
    if (!sourceUrl) throw fail(500, 'Non riesco a firmare il link ai sorgenti.');

    const ipaPath = `${user.id}/builds/${project.id}.ipa`;
    const ipaUploadUrl = await signedUpload(token, 'app_lab_builds', ipaPath);
    if (!ipaUploadUrl) throw fail(500, 'Preparazione del caricamento IPA non riuscita.');

    const job = await builder('/jobs', {
        body: {
            projectId: project.id,
            appId: app.id,
            packageName: app.package_name,
            appName: app.name,
            versionName: app.version_name,
            framework: project.framework,
            sourceUrl,
            ipaUploadUrl,
            ipaPath,
            requirements: ['macOS', 'Xcode', 'Apple Developer Program', 'certificato e provisioning profile']
        }
    });
    if (!job.jobId) throw fail(502, 'Il servizio di build non ha restituito un identificativo di job.');

    const updated = await restPatch(token,
        `app_lab_porting_projects?id=eq.${encodeURIComponent(project.id)}&owner_id=eq.${encodeURIComponent(user.id)}`,
        {
            status: 'queued',
            build_job_id: String(job.jobId).slice(0, 200),
            error_code: null,
            updated_at: new Date().toISOString()
        });
    return { project: updated || { ...project, status: 'queued' }, message: 'Build iOS accodata sul servizio Xcode.' };
}

async function checkBuild({ token, user, projectId }) {
    const { project } = await loadProject(token, user.id, projectId);
    if (!project.build_job_id) return { project };
    const job = await builder(`/jobs/${encodeURIComponent(project.build_job_id)}`, { method: 'GET' });
    const map = {
        queued: 'queued',
        building: 'building',
        running: 'building',
        succeeded: job.ipaUploaded ? 'ipa_ready' : 'build_failed',
        failed: 'build_failed',
        cancelled: 'build_failed'
    };
    const status = map[job.status] || project.status;
    const patch = { status, updated_at: new Date().toISOString() };
    if (status === 'ipa_ready') {
        patch.ipa_path = project.ipa_path || null;
        if (job.ipaPath) patch.ipa_path = job.ipaPath;
        if (Number(job.ipaSizeBytes)) patch.ipa_size_bytes = Number(job.ipaSizeBytes);
    }
    if (status === 'build_failed') patch.error_code = String(job.errorCode || 'build_failed').slice(0, 80);
    const updated = await restPatch(token,
        `app_lab_porting_projects?id=eq.${encodeURIComponent(project.id)}&owner_id=eq.${encodeURIComponent(user.id)}`,
        patch);
    return { project: updated || { ...project, ...patch } };
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        methodNotAllowed(response, ['POST']);
        return;
    }
    try {
        if (!supabaseUrl() || !supabaseKey()) {
            sendJson(response, 503, { ok: false, code: 'supabase_not_configured', error: 'Supabase non configurato sul server.' });
            return;
        }
        const body = await readJsonBody(request, 8192);
        const { user, token } = await authorize(request);
        if (!/^[0-9a-f-]{36}$/i.test(String(body.projectId || ''))) {
            sendJson(response, 400, { ok: false, error: 'Progetto non valido.' });
            return;
        }
        if (buildMissing().length) {
            sendJson(response, 503, {
                ok: false,
                code: 'build_service_not_configured',
                error: 'Servizio di build iOS non collegato: nessun .ipa può essere prodotto da qui.',
                missing: buildMissing()
            });
            return;
        }
        if (body.action === 'status') {
            const result = await checkBuild({ token, user, projectId: body.projectId });
            sendJson(response, 200, { ok: true, ...result });
            return;
        }
        if (body.action === 'build') {
            const result = await startBuild({ token, user, projectId: body.projectId });
            sendJson(response, 200, { ok: true, ...result });
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
