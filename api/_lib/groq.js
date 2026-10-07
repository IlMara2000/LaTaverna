import { compactObject, sanitizeText } from './http.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';

export const getGroqConfig = () => ({
    apiKey: process.env.GROQ_LLM_API_KEY
        || process.env.GROQ_API_KEY
        || '',
    model: process.env.GROQ_LLM_MODEL
        || DEFAULT_MODEL,
    temperature: Number(process.env.GROQ_LLM_TEMPERATURE || 0.75),
    maxTokens: Number(process.env.GROQ_LLM_MAX_TOKENS || 420)
});

const modeInstruction = (mode = 'master') => {
    if (mode === 'player') {
        return 'Agisci come giocatore extra: interpreta un compagno del party, proponi azioni in prima persona e non decidere per gli altri giocatori.';
    }
    if (mode === 'rules') {
        return 'Agisci come assistente regole: rispondi in modo pratico, separa regola e consiglio, non narrare la scena se non richiesto.';
    }
    return 'Agisci come master: narra, interpreta PNG, proponi conseguenze e chiedi tiri quando serve, senza togliere agency ai giocatori.';
};

export const callGroqVision = async ({ images = [], text = '' }) => {
    const config = getGroqConfig();
    if (!config.apiKey) {
        const error = new Error('GROQ_LLM_API_KEY non configurata nelle variabili server.');
        error.statusCode = 503;
        error.code = 'missing_groq_key';
        throw error;
    }
    const visionModel = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';
    const content = [{ type: 'text', text: `Riconosci le carte Magic visibili o elencate. Restituisci solo JSON: {"cards":[{"name":"nome carta","quantity":1}]}. Scrivi solo nome e quantità; niente descrizioni, regole, traduzioni o spiegazioni. Riporta solo carte leggibili, senza indovinare. Se la quantità manca usa 1. Testo:\n${sanitizeText(text, 24000)}` }];
    for (const image of images.slice(0, 3)) {
        if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) continue;
        content.push({ type: 'image_url', image_url: { url: image } });
    }
    if (images.length && content.length === 1) throw Object.assign(new Error('Immagini non valide.'), { statusCode: 400 });
    const response = await fetch(GROQ_API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: visionModel, messages: [{ role: 'user', content }], temperature: 0, max_tokens: 800, response_format: { type: 'json_object' } })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error?.message || `Groq non disponibile (${response.status}).`;
        const headerDelay = Number(response.headers.get('retry-after'));
        const messageDelay = message.match(/try again in\s+(\d+(?:\.\d+)?)\s*(ms|s|m)/i);
        const retryAfterMs = Number.isFinite(headerDelay) && headerDelay > 0
            ? Math.min(86400000, headerDelay * 1000)
            : messageDelay
                ? Math.min(86400000, Number(messageDelay[1]) * ({ ms: 1, s: 1000, m: 60000 })[messageDelay[2].toLowerCase()])
                : null;
        throw Object.assign(new Error(message), { statusCode: response.status, code: data?.error?.code || 'groq_error', retryAfterMs });
    }
    let parsed;
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}'); }
    catch { throw Object.assign(new Error('Risposta di scansione non valida.'), { statusCode: 502, code: 'invalid_scan_reply' }); }
    const cards = (Array.isArray(parsed.cards) ? parsed.cards : []).slice(0, 300).map(card => ({ name: sanitizeText(card.name, 120), quantity: Math.min(99, Math.max(1, Number.parseInt(card.quantity, 10) || 1)) })).filter(card => card.name);
    return { cards, model: visionModel, usage: data?.usage || null };
};

export const buildRpgMessages = ({ prompt, mode, systemId, context, history }) => {
    const systemLabels = { dnd5e: 'D&D 5e', pathfinder2e: 'Pathfinder 2e', callofcthulhu: 'Call of Cthulhu', savageworlds: 'Savage Worlds', forbiddenlands: 'Forbidden Lands' };
    const normalizedSystem = systemLabels[systemId] || String(systemId || 'dnd5e');
    const recentHistory = Array.isArray(history) ? history.slice(-12) : [];

    return [
        {
            role: 'system',
            content: [
                'Sei l AI di gioco di ruolo de La Taverna.',
                `Sistema: ${normalizedSystem}.`,
                modeInstruction(mode),
                'Rispondi sempre in italiano.',
                'Tieni le risposte brevi ma utili: massimo 120 parole salvo richiesta diversa.',
                'Non inventare dati tecnici che non sono nel contesto. Se manca un dato, chiedi un tiro o una conferma.',
                'Non rivelare note private del master se il contesto non le include esplicitamente.',
                'Non eseguire azioni di gioco irreversibili: proponile o chiedi conferma al master.'
            ].join('\n')
        },
        {
            role: 'system',
            content: `Contesto sessione JSON:\n${compactObject(context, 14000)}`
        },
        ...recentHistory.map(item => ({
            role: item.sender === 'ai' ? 'assistant' : 'user',
            content: sanitizeText(`${item.name || 'Giocatore'}: ${item.message || ''}`, 1200)
        })),
        {
            role: 'user',
            content: sanitizeText(prompt, 3000)
        }
    ];
};

export const callGroqChat = async ({ prompt, mode = 'master', systemId = 'dnd5e', context = {}, history = [] }) => {
    const config = getGroqConfig();
    if (!config.apiKey) {
        const error = new Error('GROQ_LLM_API_KEY non configurata nelle variabili server.');
        error.statusCode = 503;
        error.code = 'missing_groq_key';
        throw error;
    }

    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
            model: config.model,
            messages: buildRpgMessages({ prompt, mode, systemId, context, history }),
            temperature: Number.isFinite(config.temperature) ? config.temperature : 0.75,
            max_tokens: Number.isFinite(config.maxTokens) ? config.maxTokens : 420,
            stream: false
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data?.error?.message || `Groq non disponibile (${response.status}).`);
        error.statusCode = response.status;
        error.code = data?.error?.code || 'groq_error';
        throw error;
    }

    const reply = sanitizeText(data?.choices?.[0]?.message?.content || '', 3000);
    if (!reply) {
        const error = new Error('Groq ha restituito una risposta vuota.');
        error.statusCode = 502;
        error.code = 'empty_ai_reply';
        throw error;
    }

    return {
        reply,
        model: config.model,
        usage: data?.usage || null
    };
};
