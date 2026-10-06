import { callGroqVision } from '../_lib/groq.js';
import { methodNotAllowed, readJsonBody, sanitizeText, sendJson } from '../_lib/http.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') return methodNotAllowed(response);
    try {
        const body = await readJsonBody(request, 4 * 1024 * 1024);
        const images = Array.isArray(body.images) ? body.images : [];
        const text = sanitizeText(body.text, 24000);
        if (!images.length && !text) return sendJson(response, 400, { ok: false, error: 'Aggiungi un’immagine o una lista di carte.' });
        if (images.length > 3) return sendJson(response, 400, { ok: false, error: 'Massimo 3 immagini per scansione.' });
        const result = await callGroqVision({ images, text });
        return sendJson(response, 200, { ok: true, cards: result.cards, provider: 'groq', model: result.model, usage: result.usage });
    } catch (error) {
        return sendJson(response, error.statusCode || 500, { ok: false, code: error.code || 'magic_scan_failed', error: error.message || 'Scansione non riuscita.' });
    }
}
