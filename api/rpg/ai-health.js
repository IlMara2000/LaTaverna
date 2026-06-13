import { getGroqConfig } from '../_lib/groq.js';
import { methodNotAllowed, sendJson } from '../_lib/http.js';

export default function handler(request, response) {
    if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);

    const config = getGroqConfig();
    return sendJson(response, 200, {
        ok: true,
        provider: 'groq',
        configured: Boolean(config.apiKey),
        model: config.model,
        runtime: 'vercel-node'
    });
}
