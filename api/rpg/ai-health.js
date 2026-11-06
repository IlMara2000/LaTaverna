import { getLLMConfig } from '../_lib/llm.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';

export default function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);

    const config = getLLMConfig();
    const configured = Boolean(config.apiKey);
    // L'URL del gateway non esce più da qui: è pubblico solo per chi ha la
    // chiave, e stamparlo su un endpoint aperto lo regalava a chiunque.
    return sendJson(response, configured ? 200 : 503, configured
        ? { ok: true, provider: 'freellmapi', model: config.model }
        : { ok: false, error: 'Servizio AI non configurato.' });
}
