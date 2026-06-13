const AI_CHAT_ENDPOINT = '/api/rpg/ai-chat';
const AI_EVENT_ENDPOINT = '/api/rpg/session-event';

const safeJson = async (response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const postAI = async (url, payload) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await safeJson(response);
    if (!response.ok || data.ok === false) {
        throw new Error(data.error || `AI non disponibile (${response.status}).`);
    }
    return data;
};

export async function getAIResponse(prompt, options = {}) {
    if (!String(prompt || '').trim()) {
        return "L'Oste resta in silenzio, in attesa di una domanda chiara.";
    }

    try {
        const data = await postAI(AI_CHAT_ENDPOINT, {
            prompt,
            mode: options.mode || 'master',
            systemId: options.systemId || 'dnd5e',
            context: options.context || {},
            history: options.history || []
        });
        return data.reply || "L'Oste annuisce, ma non aggiunge altro.";
    } catch (error) {
        console.error('[Taverna AI]', error);
        return `AI non disponibile: ${error.message}`;
    }
}

export async function getAISessionEventResponse(eventType, options = {}) {
    try {
        const data = await postAI(AI_EVENT_ENDPOINT, {
            eventType,
            mode: options.mode || 'master',
            systemId: options.systemId || 'dnd5e',
            context: options.context || {},
            history: options.history || []
        });
        return data.reply || '';
    } catch (error) {
        console.warn('[Taverna AI evento]', error);
        return '';
    }
}
