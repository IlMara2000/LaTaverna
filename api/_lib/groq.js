import { compactObject, sanitizeText } from './http.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export const getGroqConfig = () => ({
    apiKey: process.env.GROQ_LLM_API_KEY
        || process.env.GROQ_API_KEY
        || process.env.VITE_GROQ_LLM_API_KEY
        || '',
    model: process.env.GROQ_LLM_MODEL
        || process.env.VITE_GROQ_LLM_MODEL
        || DEFAULT_MODEL,
    temperature: Number(process.env.GROQ_LLM_TEMPERATURE || process.env.VITE_GROQ_LLM_TEMPERATURE || 0.75),
    maxTokens: Number(process.env.GROQ_LLM_MAX_TOKENS || process.env.VITE_GROQ_LLM_MAX_TOKENS || 420)
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

export const buildRpgMessages = ({ prompt, mode, systemId, context, history }) => {
    const normalizedSystem = systemId === 'pathfinder2e' ? 'Pathfinder 2e' : 'D&D 5e';
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
