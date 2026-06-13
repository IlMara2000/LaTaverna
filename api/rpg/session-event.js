import { callGroqChat } from '../_lib/groq.js';
import { methodNotAllowed, readJsonBody, sanitizeText, sendJson } from '../_lib/http.js';

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
    if (request.method !== 'POST') return methodNotAllowed(response, ['POST']);

    try {
        const body = await readJsonBody(request);
        const eventType = sanitizeText(body.eventType, 80);
        if (!eventType) {
            return sendJson(response, 400, {
                ok: false,
                error: 'Tipo evento mancante.'
            });
        }

        const result = await callGroqChat({
            prompt: eventPrompt(eventType, body.context || {}),
            mode: body.mode || 'master',
            systemId: body.systemId || 'dnd5e',
            context: body.context || {},
            history: body.history || []
        });

        return sendJson(response, 200, {
            ok: true,
            eventType,
            reply: result.reply,
            provider: 'groq',
            model: result.model
        });
    } catch (error) {
        const status = error.statusCode || 500;
        return sendJson(response, status, {
            ok: false,
            code: error.code || 'session_event_failed',
            error: error.message || 'Evento AI non gestito.'
        });
    }
}
