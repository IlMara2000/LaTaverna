import { callGroqChat } from '../_lib/groq.js';
import { methodNotAllowed, readJsonBody, sanitizeText, sendJson } from '../_lib/http.js';

export default async function handler(request, response) {
    if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

    try {
        const body = await readJsonBody(request);
        const prompt = sanitizeText(body.prompt || body.message, 3000);
        if (!prompt) {
            return sendJson(response, 400, {
                ok: false,
                error: 'Prompt AI mancante.'
            });
        }

        const result = await callGroqChat({
            prompt,
            mode: body.mode || 'master',
            systemId: body.systemId || 'dnd5e',
            context: body.context || {},
            history: body.history || []
        });

        return sendJson(response, 200, {
            ok: true,
            reply: result.reply,
            provider: 'groq',
            model: result.model,
            usage: result.usage
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return sendJson(response, status, {
            ok: false,
            code: error.code || 'ai_chat_failed',
            error: error.message || 'Errore AI.'
        });
    }
}
