// Invio degli errori a Sentry senza SDK: un evento JSON all'endpoint "store" del
// DSN basta per i 5xx del Worker e tiene il bundle senza dipendenze aggiuntive.
// Senza SENTRY_DSN non fa nulla, quindi il deploy resta valido anche prima che
// il progetto Sentry esista.
//
// Nei dati inviati non finiscono query string, header, cookie o IP: possono
// contenere token di sessione e non servono per capire l'errore. Lo stack viaggia
// in `extra` come testo: fabbricare i frame che Sentry si aspetta darebbe una
// traccia falsa, e una traccia sbagliata è peggio di nessuna traccia.
const TIMEOUT_MS = 3000;

// Un 503 in questa app significa sempre una dipendenza o una configurazione
// mancante (Oracolo senza gateway, prezzi non configurati, quota non
// disponibile): è uno stato atteso, non un guasto. I bug veri arrivano come 500
// o come eccezione non gestita, quindi restano segnalati.
const EXPECTED_STATUS = new Set([503]);

export const isReportableStatus = status => status >= 500 && !EXPECTED_STATUS.has(status);

const parseDsn = value => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    try {
        const url = new URL(raw);
        const projectId = url.pathname.replace(/^\/+/, '');
        if (!url.username || !url.host || !projectId) return null;
        return {
            endpoint: `${url.protocol}//${url.host}/api/${projectId}/store/`,
            key: url.username
        };
    } catch {
        return null;
    }
};

export const isReportingEnabled = () => Boolean(parseDsn(process.env.SENTRY_DSN));

/**
 * Manda un evento a Sentry. Restituisce true se l'invio è stato messo in coda:
 * senza DSN o con DSN non valido è un no-op silenzioso.
 */
export const reportError = (error, { request, response, ctx } = {}) => {
    const dsn = parseDsn(process.env.SENTRY_DSN);
    if (!dsn) return false;

    let target = null;
    if (request?.url) {
        try {
            const url = new URL(request.url);
            target = { url: `${url.origin}${url.pathname}`, method: request.method };
        } catch {
            target = null;
        }
    }

    const message = error?.message || (response ? `HTTP ${response.status}` : 'Errore sconosciuto');
    const event = {
        event_id: crypto.randomUUID().replace(/-/g, ''),
        timestamp: new Date().toISOString(),
        platform: 'javascript',
        level: 'error',
        logger: 'taverna-worker',
        message: { formatted: message },
        exception: {
            values: [{ type: error?.name || 'Error', value: message }]
        },
        tags: { runtime: 'cloudflare-workers' },
        extra: {
            ...(response ? { status: response.status } : {}),
            ...(error?.stack ? { stack: error.stack } : {})
        },
        ...(target ? { request: target } : {})
    };

    const pending = fetch(dsn.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=taverna-worker/1.0, sentry_key=${dsn.key}`
        },
        body: JSON.stringify(event),
        signal: AbortSignal.timeout(TIMEOUT_MS)
    }).catch(() => {
        // Un report perso non deve rompere la risposta all'utente.
    });

    if (ctx?.waitUntil) ctx.waitUntil(pending);
    return true;
};
