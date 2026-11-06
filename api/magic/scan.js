import {authorizeOracle} from '../_lib/oracleAccess.js';
import { callLLMVision } from '../_lib/llm.js';
import { crossOriginForbidden, isSameOriginRequest, methodNotAllowed, publicErrorMessage, readJsonBody, sanitizeText, sendJson } from '../_lib/http.js';

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!isSameOriginRequest(request)) return crossOriginForbidden(response);
    try {
        const body = await readJsonBody(request, 4 * 1024 * 1024);
        const images = Array.isArray(body.images) ? body.images : [];
        const text = sanitizeText(body.text, 24000);
        if (!images.length && !text) return sendJson(response, 400, { ok: false, error: 'Aggiungi un’immagine o una lista di carte.' });
        if (images.length > 3) return sendJson(response, 400, { ok: false, error: 'Massimo 3 immagini per scansione.' });
        await authorizeOracle(request);
        const result = await callLLMVision({ images, text });
        return sendJson(response, 200, { ok: true, cards: result.cards, provider: 'freellmapi', model: result.model, usage: result.usage });
    } catch (error) {
        if (error.statusCode === 429) response.setHeader('Retry-After', String(Math.ceil((error.retryAfterMs || 5000) / 1000)));
        return sendJson(response, error.statusCode || 500, { ok: false, code: error.code || 'magic_scan_failed', error: publicErrorMessage(error, 'Scansione non riuscita.'), retryAfterMs: error.retryAfterMs || undefined });
    }
}
