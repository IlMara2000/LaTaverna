import { getLLMConfig } from '../_lib/llm.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';

// La probe interroga il catalogo del gateway: verifica che sia raggiungibile e
// che la chiave unificata sia valida, senza consumare quota di inferenza.
// I risultati sono cachati per evitare che un monitor (o un abuso) trasformi
// l'health check in traffico verso il gateway.
const OK_TTL_MS = 60_000;
const FAIL_TTL_MS = 15_000;
const TIMEOUT_MS = 5_000;

let cache = { at: 0, ok: false, ttl: 0 };
let inFlight = null;

const probeGateway = async config => {
    try {
        const response = await fetch(`${config.baseUrl}/models`, {
            headers: { Authorization: `Bearer ${config.apiKey}` },
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!response.ok) return false;
        const data = await response.json().catch(() => null);
        const models = Array.isArray(data?.data) ? data.data : [];
        // Un gateway senza modelli utilizzabili non è pronto, anche se risponde 200.
        return models.length > 0 && models.some(model => model?.available !== false);
    } catch {
        return false;
    }
};

const cachedProbe = async config => {
    const now = Date.now();
    if (cache.at && now - cache.at < cache.ttl) return cache.ok;
    if (!inFlight) {
        inFlight = probeGateway(config)
            .then(ok => {
                cache = { at: Date.now(), ok, ttl: ok ? OK_TTL_MS : FAIL_TTL_MS };
                return ok;
            })
            .finally(() => { inFlight = null; });
    }
    return inFlight;
};

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);

    const config = getLLMConfig();
    const configured = Boolean(config.apiKey);
    // L'URL del gateway non esce più da qui: è pubblico solo per chi ha la
    // chiave, e stamparlo su un endpoint aperto lo regalava a chiunque.
    if (!configured) {
        return sendJson(response, 503, { ok: false, error: 'Servizio AI non configurato.' });
    }

    const ok = await cachedProbe(config);
    return sendJson(response, ok ? 200 : 503, ok
        ? { ok: true, provider: 'freellmapi', model: config.model }
        : { ok: false, error: 'Servizio AI non disponibile.' });
}
