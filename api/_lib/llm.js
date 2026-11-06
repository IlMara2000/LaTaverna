import { compactObject, sanitizeText } from './http.js';

// Gateway locale FreeLLMAPI: espone un'API OpenAI-compatibile e instrada la
// richiesta verso i provider gratuiti con failover. La chiave unificata resta
// solo lato server: non è mai una variabile VITE_*.
const DEFAULT_BASE_URL = 'http://127.0.0.1:31415';
const DEFAULT_MODEL = 'nemotron-3-ultra-550b';

const normalizeBaseUrl = value => {
    let base = String(value || '').trim().replace(/\/+$/, '');
    if (!base) base = DEFAULT_BASE_URL;
    if (!/^https?:\/\//i.test(base)) base = `http://${base}`;
    return /\/v1$/i.test(base) ? base : `${base}/v1`;
};

const numberOr = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getLLMConfig = () => {
    const baseUrl = normalizeBaseUrl(process.env.FREELLMAPI_BASE_URL);
    return {
        baseUrl,
        chatUrl: `${baseUrl}/chat/completions`,
        apiKey: process.env.FREELLMAPI_API_KEY || '',
        model: process.env.FREELLMAPI_MODEL || DEFAULT_MODEL,
        visionModel: process.env.FREELLMAPI_VISION_MODEL
            || process.env.FREELLMAPI_MODEL
            || DEFAULT_MODEL,
        temperature: Number(process.env.FREELLMAPI_TEMPERATURE ?? 0.6),
        maxTokens: numberOr(process.env.FREELLMAPI_MAX_TOKENS, 420),
        timeoutMs: numberOr(process.env.FREELLMAPI_TIMEOUT_MS, 55000)
    };
};

const parseRetryAfterMs = (response, message = '') => {
    const header = Number(response?.headers?.get?.('retry-after'));
    if (Number.isFinite(header) && header > 0) return Math.min(86400000, header * 1000);
    const match = message.match(/try again in\s+(\d+(?:\.\d+)?)\s*(ms|s|m)/i);
    if (!match) return null;
    return Math.min(86400000, Number(match[1]) * ({ ms: 1, s: 1000, m: 60000 })[match[2].toLowerCase()]);
};

const upstreamError = (response, providerMessage) => {
    const status = Number(response?.status || 0);
    const rateLimited = status === 429;
    return Object.assign(new Error(rateLimited
        ? 'L’Oracolo è molto richiesto. Riprova tra poco.'
        : status === 401 || status === 403
            ? 'Credenziale Oracolo non valida. Contatta il gestore.'
            : 'L’Oracolo non riesce a rispondere in questo momento.'), {
        statusCode: rateLimited ? 429 : 502,
        code: 'freellmapi_error',
        retryAfterMs: rateLimited ? (parseRetryAfterMs(response, providerMessage) || 5000) : null,
        providerMessage
    });
};

/**
 * Singola chiamata al gateway. Il failover tra provider gratuiti è già gestito
 * da FreeLLMAPI: qui non serve un secondo livello di retry.
 */
export const completeChat = async ({ messages, model, temperature, maxTokens, responseFormat, timeoutMs } = {}) => {
    const config = getLLMConfig();
    if (!config.apiKey) {
        throw Object.assign(new Error('L’Oracolo non è ancora configurato.'), {
            statusCode: 503,
            code: 'missing_freellmapi_key'
        });
    }
    const payload = {
        model: model || config.model,
        messages,
        temperature: Number.isFinite(temperature) ? temperature : config.temperature,
        max_tokens: numberOr(maxTokens, config.maxTokens),
        stream: false
    };
    if (responseFormat) payload.response_format = responseFormat;

    let response;
    try {
        response = await fetch(config.chatUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(numberOr(timeoutMs, config.timeoutMs))
        });
    } catch (error) {
        if (error?.name === 'TimeoutError') {
            throw Object.assign(new Error('L’Oracolo sta impiegando troppo tempo. Riprova.'), {
                statusCode: 504,
                code: 'freellmapi_timeout',
                cause: error
            });
        }
        throw Object.assign(new Error('L’Oracolo non riesce a raggiungere il gateway. Riprova più tardi.'), {
            statusCode: 503,
            code: 'freellmapi_unreachable',
            cause: error
        });
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        // I dettagli del provider restano nei log server: al client va un testo
        // stabile senza chiavi, quote o parametri interni.
        throw upstreamError(response, data?.error?.message || `FreeLLMAPI ${response.status}`);
    }

    const reply = sanitizeText(data?.choices?.[0]?.message?.content || '', 14000);
    return {
        reply,
        model: data?.model || payload.model,
        upstream: data?.provider || null,
        usage: data?.usage || null
    };
};

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
    const systemLabels = { dnd5e: 'D&D 5e', pathfinder2e: 'Pathfinder 2e', callofcthulhu: 'Call of Cthulhu', savageworlds: 'Savage Worlds', forbiddenlands: 'Forbidden Lands' };
    const normalizedSystem = systemLabels[systemId] || String(systemId || 'dnd5e');
    const recentHistory = Array.isArray(history) ? history.slice(-12) : [];

    return [
        {
            role: 'system',
            content: [
                'Sei L’Oracolo, l’assistente di gioco di ruolo de La Taverna.',
                'Se il contesto contiene un’avventura e un compagno, narra la campagna seguendone la traccia senza svelare in anticipo i segreti; interpreta anche il compagno senza decidere per il giocatore.',
                'Non dichiarare di aver aggiornato schede, inventario o token: non hai accesso ad azioni sulla board. Chiedi al giocatore di registrare i cambiamenti.',
                `Sistema: ${normalizedSystem}.`,
                modeInstruction(mode),
                'Rispondi sempre in italiano.',
                'Tieni le risposte brevi ma utili: massimo 120 parole salvo richiesta diversa.',
                'Non inventare dati tecnici, riferimenti a pagine o citazioni di manuali che non sono nel contesto. Se manca un dato, chiedi un tiro o una conferma.',
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

export const callLLMChat = async ({ prompt, mode = 'master', systemId = 'dnd5e', context = {}, history = [] }) => {
    const config = getLLMConfig();
    const result = await completeChat({
        messages: buildRpgMessages({ prompt, mode, systemId, context, history }),
        temperature: Number.isFinite(config.temperature) ? config.temperature : 0.75,
        maxTokens: Number.isFinite(config.maxTokens) ? config.maxTokens : 420
    });
    if (!result.reply) {
        throw Object.assign(new Error('L’Oracolo ha restituito una risposta vuota.'), {
            statusCode: 502,
            code: 'empty_ai_reply'
        });
    }
    return result;
};

export const callLLMVision = async ({ images = [], text = '' }) => {
    const config = getLLMConfig();
    const content = [{ type: 'text', text: `Riconosci le carte Magic visibili o elencate. Restituisci solo JSON: {"cards":[{"name":"nome carta","quantity":1}]}. Scrivi solo nome e quantità; niente descrizioni, regole, traduzioni o spiegazioni. Riporta solo carte leggibili, senza indovinare. Se la quantità manca usa 1. Testo:\n${sanitizeText(text, 24000)}` }];
    for (const image of images.slice(0, 3)) {
        if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) continue;
        content.push({ type: 'image_url', image_url: { url: image } });
    }
    if (images.length && content.length === 1) throw Object.assign(new Error('Immagini non valide.'), { statusCode: 400 });

    const result = await completeChat({
        model: config.visionModel,
        messages: [{ role: 'user', content }],
        temperature: 0,
        maxTokens: 800,
        responseFormat: { type: 'json_object' }
    });
    let parsed;
    try { parsed = JSON.parse(result.reply || '{}'); }
    catch { throw Object.assign(new Error('Risposta di scansione non valida.'), { statusCode: 502, code: 'invalid_scan_reply' }); }
    const cards = (Array.isArray(parsed.cards) ? parsed.cards : []).slice(0, 300).map(card => ({
        name: sanitizeText(card.name, 120),
        quantity: Math.min(99, Math.max(1, Number.parseInt(card.quantity, 10) || 1))
    })).filter(card => card.name);
    return { cards, model: result.model, usage: result.usage };
};

export const translateMagicOracle = async ({ name, typeLine, text }) => {
    const result = await completeChat({
        temperature: 0,
        maxTokens: 1000,
        messages: [
            { role: 'system', content: 'Traduci in italiano il testo Oracle della carta Magic. Conserva nome della carta, nomi propri, simboli e notazione di mana, numeri, parole chiave e struttura delle righe. Usa terminologia ufficiale italiana di Magic quando nota. Non aggiungere spiegazioni, regole o testo assente. Restituisci esclusivamente la traduzione.' },
            { role: 'user', content: `Carta: ${sanitizeText(name, 120)}\nTipo: ${sanitizeText(typeLine, 200)}\nTesto Oracle:\n${sanitizeText(text, 2500)}` }
        ]
    });
    const translation = sanitizeText(result.reply, 3000);
    if (!translation) throw Object.assign(new Error('Traduzione non disponibile.'), { statusCode: 502, code: 'empty_translation' });
    return { translation, model: result.model, usage: result.usage };
};
