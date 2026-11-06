import { callLLMChat } from '../_lib/llm.js';
import { authorizeOracle } from '../_lib/oracleAccess.js';
import { crossOriginForbidden, isSameOriginRequest, methodNotAllowed, publicErrorMessage, readJsonBody, sanitizeText, sendJson } from '../_lib/http.js';

const eventPrompt = (eventType = '', context = {}) => {
    const sessionName = context?.session?.name || 'la sessione';
    if (eventType === 'session_started') {
        return `La sessione "${sessionName}" e' appena iniziata. Dai un breve messaggio di apertura al party.`;
    }
    if (eventType === 'user_joined') {
        const userName = context?.user?.name || 'un giocatore';
        return `${userName} e' entrato nella sessione "${sessionName}". Salutalo brevemente restando in tono da tavolo.`;
    }
    if (eventType === 'turn_changed') {
        return `Il turno e' cambiato nella sessione "${sessionName}". Commenta in una frase e suggerisci cosa guardare.`;
    }
    return `Evento sessione: ${sanitizeText(eventType, 80)}. Rispondi solo se serve al tavolo.`;
};

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);
    if (!isSameOriginRequest(request)) return crossOriginForbidden(response);

    try {
        const body = await readJsonBody(request);
        const eventType = sanitizeText(body.eventType, 80);
        if (!eventType) {
            return sendJson(response, 400, {
                ok: false,
                error: 'Tipo evento mancante.'
            });
        }

        await authorizeOracle(request);
        const result = await callLLMChat({
            prompt: eventPrompt(eventType, body.context || {}),
            mode: ['master','player','rules'].includes(body.mode) ? body.mode : 'master',
            systemId: body.systemId || 'dnd5e',
            context: body.context || {},
            history: body.history || []
        });

        return sendJson(response, 200, {
            ok: true,
            eventType,
            reply: result.reply,
            provider: 'freellmapi',
            upstream: result.upstream,
            model: result.model
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return sendJson(response, status, {
            ok: false,
            code: error.code || 'session_event_failed',
            error: publicErrorMessage(error, 'Evento AI non gestito.')
        });
    }
}
