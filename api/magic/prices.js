// Aggiorna i prezzi di stampa delle carte in wantlist leggendoli da Scryfall.
// La scrittura richiede la service role key: la tabella magic_card_prices è
// leggibile dagli utenti ma scrivibile solo dal server.
import { crossOriginForbidden, isSameOriginRequest, methodNotAllowed, publicErrorMessage, readJsonBody, sendJson } from '../_lib/http.js';
import { clientIp, ipHash } from '../_lib/ipBudget.js';

const SCRYFALL_COLLECTION = 'https://api.scryfall.com/cards/collection';
const CHUNK_SIZE = 75;          // limite dell'endpoint collection di Scryfall
const MAX_IDS = 300;            // una wantlist realistica resta dentro questo tetto
const SCRYFALL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Scryfall rifiuta l'intero lotto (400) se riceve l'UUID nullo: va scartato prima.

// Limiti dell'aggiornamento prezzi, configurabili per ambiente con
// PRICE_REFRESH_*: pausa tra due aggiornamenti (0 la disattiva), tetto orario
// per account e tetto orario per rete. Il database riporta comunque i valori
// nella stessa scala, così una variabile sbagliata non azzera la protezione.
const PRICE_LIMITS = { pauseSeconds: 30, userHourly: 10, ipHourly: 30 };
const PRICE_LIMITS_RANGE = { pauseSeconds: [0, 3600], userHourly: [1, 1000], ipHourly: [1, 10000] };

const integerSetting = (raw, fallback) => {
    if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
    const value = Number(String(raw).trim());
    return Number.isInteger(value) ? value : fallback;
};

const withinRange = (value, [min, max]) => Math.min(Math.max(value, min), max);

/** Legge i limiti da PRICE_REFRESH_* e li riporta nella scala ammessa. */
export const readPriceLimits = (env = process.env) => ({
    pauseSeconds: withinRange(integerSetting(env.PRICE_REFRESH_PAUSE_SECONDS, PRICE_LIMITS.pauseSeconds), PRICE_LIMITS_RANGE.pauseSeconds),
    userHourly: withinRange(integerSetting(env.PRICE_REFRESH_USER_HOURLY_LIMIT, PRICE_LIMITS.userHourly), PRICE_LIMITS_RANGE.userHourly),
    ipHourly: withinRange(integerSetting(env.PRICE_REFRESH_IP_HOURLY_LIMIT, PRICE_LIMITS.ipHourly), PRICE_LIMITS_RANGE.ipHourly)
});

const toPrice = value => {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return null;
    return Math.round(number * 100) / 100;
};

/**
 * Trasforma le carte restituite da Scryfall in righe per magic_card_prices.
 * Scarta gli id che non sono stampe valide e le carte senza alcun prezzo,
 * così una risposta parziale del catalogo non crea righe vuote.
 */
const isScryfallId = value => {
    const id = String(value || '');
    return SCRYFALL_ID.test(id) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id);
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Chiede un lotto al catalogo. Restituisce null se Scryfall rifiuta il lotto
 * (400): così chi chiama può riprovare per singola carta invece di perdere tutto.
 */
export const requestCollection = async identifiers => {
    const response = await fetch(SCRYFALL_COLLECTION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'LaTaverna/1.1' },
        body: JSON.stringify({ identifiers }),
        signal: AbortSignal.timeout(15000)
    });
    if (response.status === 400) return null;
    if (!response.ok) throw Object.assign(new Error('Catalogo carte non raggiungibile.'), { statusCode: 502 });
    return response.json();
};

export const collectPrices = (cards = [], fetchedAt = new Date().toISOString()) => (Array.isArray(cards) ? cards : [])
    .filter(card => card && isScryfallId(card.id))
    .map(card => ({
        card_id: String(card.id),
        card_name: String(card.name || '').slice(0, 120),
        set_code: String(card.set || '').slice(0, 12),
        eur: toPrice(card.prices?.eur),
        usd: toPrice(card.prices?.usd),
        source: 'scryfall',
        fetched_at: fetchedAt
    }))
    .filter(row => row.eur !== null || row.usd !== null);

export default async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!isSameOriginRequest(request)) return crossOriginForbidden(response);

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        return sendJson(response, 503, {
            ok: false,
            code: 'prices_not_configured',
            error: 'Aggiornamento prezzi non configurato su questo server.'
        });
    }

    try {
        const body = await readJsonBody(request, 24 * 1024);
        const ids = [...new Set((Array.isArray(body.card_ids) ? body.card_ids : [])
            .map(id => String(id || ''))
            .filter(isScryfallId))].slice(0, MAX_IDS);

        if (!ids.length) return sendJson(response, 400, { ok: false, error: 'Nessuna stampa valida da aggiornare.' });

        // Senza sessione la function sarebbe un proxy aperto verso Scryfall.
        const authorization = String(request.headers?.authorization || '');
        if (!/^Bearer [A-Za-z0-9._-]+$/.test(authorization)) {
            return sendJson(response, 401, { ok: false, code: 'unauthorized', error: 'Accedi per aggiornare i prezzi.' });
        }
        const session = await fetch(`${url}/auth/v1/user`, {
            headers: { apikey: serviceKey, Authorization: authorization },
            signal: AbortSignal.timeout(8000)
        });
        if (!session.ok) {
            return sendJson(response, 401, { ok: false, code: 'unauthorized', error: 'Sessione scaduta. Accedi nuovamente.' });
        }
        const account = await session.json().catch(() => null);
        if (!account?.id) {
            return sendJson(response, 401, { ok: false, code: 'unauthorized', error: 'Sessione non valida.' });
        }

        // Limite di frequenza prima di contattare Scryfall: attesa minima tra un
        // aggiornamento e l'altro, tetto orario per utente e per rete. I valori
        // vengono da PRICE_REFRESH_*; l'IP è pseudonimizzato con HMAC, come per
        // il budget AI.
        const limits = readPriceLimits();
        const network = clientIp(request) || `user:${account.id}`;
        const budget = await fetch(`${url}/rest/v1/rpc/take_price_refresh_quota`, {
            method: 'POST',
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                p_user: account.id,
                p_ip_hash: ipHash(network, serviceKey),
                p_pause_seconds: limits.pauseSeconds,
                p_user_limit: limits.userHourly,
                p_ip_limit: limits.ipHourly
            }),
            signal: AbortSignal.timeout(8000)
        });
        if (budget.status === 400) {
            const detail = await budget.json().catch(() => null);
            response.setHeader('Retry-After', String(Math.max(1, limits.pauseSeconds)));
            return sendJson(response, 429, {
                ok: false,
                code: 'price_rate_limited',
                error: detail?.message || 'Hai appena aggiornato i prezzi: riprova tra poco.'
            });
        }
        if (!budget.ok) {
            console.error('[magic/prices] limite di frequenza non disponibile:', budget.status);
            return sendJson(response, 503, {
                ok: false,
                code: 'price_budget_unavailable',
                error: 'Verifica dei limiti di aggiornamento non disponibile. Riprova più tardi.'
            });
        }

        const fetchedAt = new Date().toISOString();
        const rows = [];
        let notFound = 0;

        for (let index = 0; index < ids.length; index += CHUNK_SIZE) {
            const chunk = ids.slice(index, index + CHUNK_SIZE);
            const batch = await requestCollection(chunk.map(id => ({ id })));

            if (batch) {
                notFound += Array.isArray(batch.not_found) ? batch.not_found.length : 0;
                rows.push(...collectPrices(batch.data, fetchedAt));
            } else {
                // Un identificativo rifiutato non deve far perdere le altre carte:
                // si riprova una per una tenendo solo le stampe valide.
                for (const id of chunk) {
                    const single = await requestCollection([{ id }]);
                    if (!single) { notFound += 1; continue; }
                    notFound += Array.isArray(single.not_found) ? single.not_found.length : 0;
                    rows.push(...collectPrices(single.data, fetchedAt));
                    await wait(120);
                }
            }

            if (index + CHUNK_SIZE < ids.length) await wait(120);
        }

        if (!rows.length) {
            return sendJson(response, 200, { ok: true, requested: ids.length, updated: 0, found: 0, notFound, fetchedAt });
        }

        const write = await fetch(`${url}/rest/v1/magic_card_prices?on_conflict=card_id`, {
            method: 'POST',
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates,return=minimal'
            },
            body: JSON.stringify(rows),
            signal: AbortSignal.timeout(15000)
        });
        if (!write.ok) {
            const detail = await write.text().catch(() => '');
            console.error('[magic/prices] scrittura rifiutata:', write.status, detail.slice(0, 300));
            throw Object.assign(new Error('Prezzi scaricati ma non salvati.'), { statusCode: 503 });
        }

        return sendJson(response, 200, { ok: true, requested: ids.length, updated: rows.length, found: rows.length, notFound, fetchedAt });
    } catch (error) {
        return sendJson(response, error.statusCode || 500, {
            ok: false,
            code: error.code || 'prices_refresh_failed',
            error: publicErrorMessage(error, 'Aggiornamento prezzi non riuscito.')
        });
    }
}
