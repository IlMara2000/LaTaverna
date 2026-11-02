import { getGroqConfig } from '../_lib/groq.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';

export default function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);

    const configured = Boolean(getGroqConfig().apiKey);
    return sendJson(response, configured ? 200 : 503, configured
        ? { ok: true, provider: 'groq' }
        : { ok: false, error: 'Servizio AI non configurato.' });
}
