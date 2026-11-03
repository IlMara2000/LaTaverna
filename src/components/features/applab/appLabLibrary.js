/**
 * APP LAB — accesso a Supabase (Postgres con RLS + Storage privato).
 *
 * Ogni utente vede solo le proprie applicazioni. Il client viene iniettato
 * così lo stesso flusso può essere esercitato dai test.
 */

export const APP_LAB_BUCKET = 'app_lab_apks';
export const APP_LAB_SOURCE_BUCKET = 'app_lab_sources';
export const APP_LAB_PAGE_SIZE = 48;
export const MAX_SOURCE_BYTES = 500 * 1024 * 1024;

const env = import.meta.env || {};

export function appLabErrorMessage(error) {
    const code = error?.code || error?.statusCode;
    const message = String(error?.message || '');
    if (['42P01', 'PGRST205'].includes(code) || /relation .*app_lab_.* does not exist|bucket not found/i.test(message)) {
        return 'APP LAB non è ancora attivo su questo ambiente: applica la migrazione Supabase app_lab.';
    }
    if (code === '23505') return 'Questa applicazione (stesso package name) è già nella tua libreria: usa “Sostituisci APK” per aggiornarla.';
    if (code === '23514') return 'I dati dell’applicazione non rispettano i limiti previsti (nome, dimensione o stato).';
    if (/jwt|not authenticated|session/i.test(message)) return 'La sessione è scaduta. Accedi di nuovo alla Taverna.';
    if (/exceeded the maximum allowed size|payload too large|413/i.test(message)) return 'Il file supera il limite consentito dallo storage.';
    if (/Failed to fetch|NetworkError/i.test(message)) return 'Connessione interrotta durante l’operazione. Riprova.';
    return message || 'Operazione non riuscita. Riprova.';
}

const uploadWithProgress = ({ url, anonKey, accessToken, bucket, path, file, contentType, onProgress }) => new Promise((resolve, reject) => {
    if (typeof XMLHttpRequest === 'undefined') {
        reject(new Error('Upload non disponibile in questo ambiente.'));
        return;
    }
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${url}/storage/v1/object/${bucket}/${encodedPath}`);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('cache-control', '3600');
    xhr.setRequestHeader('content-type', contentType);
    xhr.upload.onprogress = event => {
        if (event.lengthComputable && typeof onProgress === 'function') {
            onProgress(Math.round((event.loaded / event.total) * 100));
        }
    };
    xhr.onerror = () => reject(new Error('Connessione interrotta durante il caricamento.'));
    xhr.onabort = () => reject(new Error('Caricamento annullato.'));
    xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
            return;
        }
        let detail = '';
        try { detail = JSON.parse(xhr.responseText)?.message || ''; } catch { /* testo non JSON */ }
        const error = new Error(detail || `Caricamento non riuscito (HTTP ${xhr.status}).`);
        error.status = xhr.status;
        reject(error);
    };
    xhr.send(file);
});

const cleanName = value => {
    const text = String(value || '').replace(/\u0000/g, '').trim().slice(0, 120);
    if (!text) throw new Error('Il nome dell’applicazione non può essere vuoto.');
    return text;
};

export function createAppLabLibrary(client, config = {}) {
    const url = config.url || env.VITE_SUPABASE_URL || '';
    const anonKey = config.anonKey || env.VITE_SUPABASE_ANON_KEY || '';

    const account = async expectedId => {
        const { data, error } = await client.auth.getUser();
        if (error || !data?.user) throw new Error('Accedi al tuo account per usare APP LAB.');
        if (expectedId && data.user.id !== expectedId) throw new Error('La sessione è cambiata. Riapri APP LAB.');
        return data.user;
    };

    const accessToken = async () => {
        const { data } = await client.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) throw new Error('Sessione scaduta. Accedi di nuovo.');
        return token;
    };

    const checked = async query => {
        const { data, error, count } = await query;
        if (error) throw error;
        return { data, count };
    };

    const uploadFile = async ({ bucket, path, file, contentType, onProgress }) => {
        if (!url || !anonKey) throw new Error('Storage non configurato: mancano le variabili Supabase.');
        await uploadWithProgress({
            url, anonKey, accessToken: await accessToken(),
            bucket, path, file, contentType, onProgress
        });
    };

    const removeFile = async (bucket, path) => {
        try {
            await client.storage.from(bucket).remove([path]);
        } catch (error) {
            console.warn('APP LAB: rimozione file non riuscita', error);
            throw new Error('Non sono riuscito a rimuovere il file dallo storage. Riprova.');
        }
    };

    const appRow = (analysis, file, user, { id, path }) => ({
        id,
        owner_id: user.id,
        name: cleanName(analysis.name),
        package_name: analysis.packageName,
        version_name: analysis.versionName || '',
        version_code: analysis.versionCode ?? null,
        platform: 'android',
        original_name: String(file.name || 'app.apk').slice(0, 255),
        size_bytes: file.size,
        min_sdk: analysis.minSdk ?? null,
        target_sdk: analysis.targetSdk ?? null,
        architectures: analysis.architectures || [],
        icon_data_url: analysis.iconDataUrl || null,
        compatibility: analysis.compatibility || 'pending',
        status: 'ready',
        analysis: analysis.analysis || {},
        storage_path: path,
        rights_confirmed_at: new Date().toISOString()
    });

    return {
        async getUser() {
            const { data } = await client.auth.getUser();
            return data?.user || null;
        },

        async listApps(userId) {
            if (!userId) return [];
            const rows = [];
            for (let from = 0; ; from += APP_LAB_PAGE_SIZE) {
                const { data } = await checked(client.from('app_lab_apps').select('*')
                    .eq('owner_id', userId)
                    .order('updated_at', { ascending: false })
                    .order('id')
                    .range(from, from + APP_LAB_PAGE_SIZE - 1));
                rows.push(...(data || []));
                if (!data || data.length < APP_LAB_PAGE_SIZE) return rows;
            }
        },

        async createApp({ file, analysis, userId, onProgress }) {
            const user = await account(userId);
            const id = crypto.randomUUID();
            const path = `${user.id}/${id}.apk`;
            onProgress?.({ percent: 0, label: 'Carico l’APK nello storage privato…' });
            await uploadFile({
                bucket: APP_LAB_BUCKET, path, file,
                contentType: 'application/vnd.android.package-archive',
                onProgress: percent => onProgress?.({ percent, label: 'Carico l’APK nello storage privato…' })
            });
            try {
                const { data } = await checked(client.from('app_lab_apps')
                    .insert(appRow(analysis, file, user, { id, path })).select().single());
                return data;
            } catch (error) {
                // Storage e Postgres non condividono una transazione: niente orfani.
                try { await client.storage.from(APP_LAB_BUCKET).remove([path]); } catch { /* resta privato */ }
                throw error;
            }
        },

        async replaceApk({ app, file, analysis, userId, onProgress }) {
            const user = await account(userId);
            if (!app?.id) throw new Error('Applicazione non trovata.');
            const path = `${user.id}/${app.id}-${Date.now()}.apk`;
            onProgress?.({ percent: 0, label: 'Carico la nuova versione…' });
            await uploadFile({
                bucket: APP_LAB_BUCKET, path, file,
                contentType: 'application/vnd.android.package-archive',
                onProgress: percent => onProgress?.({ percent, label: 'Carico la nuova versione…' })
            });
            try {
                const row = appRow(analysis, file, user, { id: app.id, path });
                delete row.id;
                delete row.owner_id;
                row.updated_at = new Date().toISOString();
                const { data } = await checked(client.from('app_lab_apps')
                    .update(row).eq('id', app.id).eq('owner_id', user.id).select().single());
                if (app.storage_path && app.storage_path !== path) {
                    await client.storage.from(APP_LAB_BUCKET).remove([app.storage_path]).catch(() => {});
                }
                return data;
            } catch (error) {
                try { await client.storage.from(APP_LAB_BUCKET).remove([path]); } catch { /* resta privato */ }
                throw error;
            }
        },

        async renameApp({ id, name, userId }) {
            const user = await account(userId);
            const { data } = await checked(client.from('app_lab_apps')
                .update({ name: cleanName(name), updated_at: new Date().toISOString() })
                .eq('id', id).eq('owner_id', user.id).select().single());
            return data;
        },

        async rememberLaunch({ id, userId }) {
            if (!userId) return;
            await client.from('app_lab_apps')
                .update({ last_launched_at: new Date().toISOString() })
                .eq('id', id).eq('owner_id', userId);
        },

        async deleteApp({ id, userId }) {
            const user = await account(userId);
            const { data: app } = await checked(client.from('app_lab_apps')
                .select('id,owner_id,storage_path').eq('id', id).eq('owner_id', user.id).maybeSingle());
            if (!app) throw new Error('Applicazione non trovata nella tua libreria.');
            await removeFile(APP_LAB_BUCKET, app.storage_path);
            await checked(client.from('app_lab_apps').delete().eq('id', id).eq('owner_id', user.id));
        },

        async listSessions(userId) {
            if (!userId) return [];
            const { data } = await checked(client.from('app_lab_sessions')
                .select('id,app_id,status,started_at,expires_at,provider_session_id,error_code')
                .eq('owner_id', userId)
                .in('status', ['requested', 'running'])
                .order('created_at', { ascending: false }).limit(10));
            return data || [];
        },

        async listPortingProjects(userId) {
            if (!userId) return [];
            const { data } = await checked(client.from('app_lab_porting_projects').select('*')
                .eq('owner_id', userId).order('created_at', { ascending: false }).limit(60));
            return data || [];
        },

        async createIpaLink(path) {
            if (!path) throw new Error('Nessun file IPA disponibile per questo progetto.');
            const { data, error } = await client.storage.from('app_lab_builds').createSignedUrl(path, 600);
            if (error) throw error;
            return data?.signedUrl || null;
        },

        async savePortingProject({ appId, userId, mode, report, source = null }) {
            const user = await account(userId);
            const { data } = await checked(client.from('app_lab_porting_projects').insert({
                app_id: appId,
                owner_id: user.id,
                mode,
                framework: report.framework || 'unknown',
                feasibility: report.feasibility || 'unknown',
                status: mode === 'source' ? 'source_uploaded' : 'analysis',
                report,
                source_path: source?.path || null
            }).select().single());
            return data;
        },

        async updatePortingProject({ id, userId, patch }) {
            const user = await account(userId);
            const { data } = await checked(client.from('app_lab_porting_projects')
                .update({ ...patch, updated_at: new Date().toISOString() })
                .eq('id', id).eq('owner_id', user.id).select().single());
            return data;
        },

        async uploadSourceArchive({ file, projectId, userId, onProgress }) {
            const user = await account(userId);
            if (file.size > MAX_SOURCE_BYTES) throw new Error('L’archivio supera il limite di 500 MB.');
            const path = `${user.id}/sources/${projectId}.zip`;
            onProgress?.({ percent: 0, label: 'Carico il progetto sorgente…' });
            await uploadFile({
                bucket: APP_LAB_SOURCE_BUCKET, path, file, contentType: 'application/zip',
                onProgress: percent => onProgress?.({ percent, label: 'Carico il progetto sorgente…' })
            });
            return path;
        },

        async deletePortingProject({ id, userId }) {
            const user = await account(userId);
            const { data: project } = await checked(client.from('app_lab_porting_projects')
                .select('id,source_path').eq('id', id).eq('owner_id', user.id).maybeSingle());
            if (!project) return;
            if (project.source_path) {
                await client.storage.from(APP_LAB_SOURCE_BUCKET).remove([project.source_path]).catch(() => {});
            }
            await checked(client.from('app_lab_porting_projects').delete().eq('id', id).eq('owner_id', user.id));
        }
    };
}
