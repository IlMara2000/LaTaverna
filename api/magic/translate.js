import {authorizeOracle} from '../_lib/oracleAccess.js';
import { translateMagicOracle } from '../_lib/llm.js';
import { crossOriginForbidden, isSameOriginRequest, methodNotAllowed, publicErrorMessage, readJsonBody, sanitizeText, sendJson } from '../_lib/http.js';

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!isSameOriginRequest(request)) return crossOriginForbidden(response);
    try {
        const body = await readJsonBody(request, 8 * 1024);
        const name = sanitizeText(body.name, 120), typeLine = sanitizeText(body.typeLine, 200), text = sanitizeText(body.text, 2500);
        if (!name || !text) return sendJson(response, 400, { ok: false, error: 'Nome e testo Oracle della carta sono obbligatori.' });
        await authorizeOracle(request);
        const result = await translateMagicOracle({ name, typeLine, text });
        return sendJson(response, 200, { ok: true, translation: result.translation, provider: 'freellmapi', model: result.model });
    } catch (error) {
        return sendJson(response, error.statusCode || 500, { ok: false, code: error.code || 'magic_translation_failed', error: publicErrorMessage(error, 'Traduzione non riuscita.') });
    }
}
