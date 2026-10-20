import {authorizeOracle} from '../_lib/oracleAccess.js';
import { translateMagicOracle } from '../_lib/groq.js';
import { methodNotAllowed, readJsonBody, sanitizeText, sendJson } from '../_lib/http.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') return methodNotAllowed(response);
    try {
        const body = await readJsonBody(request, 8 * 1024);
        const name = sanitizeText(body.name, 120), typeLine = sanitizeText(body.typeLine, 200), text = sanitizeText(body.text, 2500);
        if (!name || !text) return sendJson(response, 400, { ok: false, error: 'Nome e testo Oracle della carta sono obbligatori.' });
        await authorizeOracle(request);
        const result = await translateMagicOracle({ name, typeLine, text });
        return sendJson(response, 200, { ok: true, translation: result.translation, provider: 'groq', model: result.model });
    } catch (error) {
        return sendJson(response, error.statusCode || 500, { ok: false, code: error.code || 'magic_translation_failed', error: error.message || 'Traduzione non riuscita.' });
    }
}
