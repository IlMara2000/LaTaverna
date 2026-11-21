// Entry point Cloudflare Workers: sostituisce vercel.json (redirect, rewrite,
// header) e rimonta gli stessi handler di api/, che restano l'unica copia della
// logica. In locale gli handler sono serviti da scripts/local-api-bridge.js.
import { API_ROUTES } from '../scripts/local-api-bridge.js';
// Fonte unica delle rotte client: vercel.json ne elencava solo una parte, e
// /carte, /giochi-di-ruolo, /shop, /library e /magic erano 404 anche prima.
import { PUBLIC_ROUTES } from '../src/services/publicRoutes.js';
import { isReportableStatus, reportError } from '../api/_lib/errorReport.js';

// Le server function di Vercel erano una per file sotto api/: qui la tabella
// delle rotte è esplicita, così un endpoint non pubblicato non diventa pubblico.
const ROUTES = {
    ...API_ROUTES,
    '/api/bw/page': () => import('../api/bw/page.js'),
    '/api/bw/login': () => import('../api/bw/login.js'),
    '/api/bw/logout': () => import('../api/bw/logout.js'),
    '/api/bw/session': () => import('../api/bw/session.js'),
    '/api/bw/stencil': () => import('../api/bw/stencil.js')
};

// Rotte che devono servire l'HTML della SPA invece di un 404: quelle pubbliche
// dell'app, la radice (il binding degli asset non risolve più / su index.html:
// vedi html_handling in wrangler.jsonc) e l'alias storico /bottega.
const SPA_ROUTES = new Set([...Object.values(PUBLIC_ROUTES), '/']);
// I sottopercorsi di una sezione nota (/dnd/<sessione>, /scippo/<condivisione>)
// servono anch'essi la SPA, come faceva `/x/:path*` su Vercel.
const SPA_SECTIONS = new Set([...SPA_ROUTES, '/bottega'].map(route => `/${route.split('/')[1] || ''}`));

// Alias storici dei brani: gli URL in pagina non cambiano.
const AUDIO_ALIASES = {
    '/audio/tavern.mp3': '/audio/old-tower-inn.mp3',
    '/audio/common-room.mp3': '/audio/bards-tale.mp3',
    '/audio/dungeon.mp3': '/audio/cave-theme.mp3',
    '/audio/battle.mp3': '/audio/battle-theme.mp3',
    '/audio/arcane.mp3': '/audio/ancient-power-of-serpents.mp3',
    '/audio/cards.mp3': '/audio/warm-fireplace.mp3',
    '/audio/chess.mp3': '/audio/vaporware.mp3',
    '/audio/challenge.mp3': '/audio/determined-pursuit.mp3'
};

const CANONICAL_HOST = 'lataverna.xyz';
const MAX_BODY_BYTES = 3 * 1024 * 1024;

// Gli asset statici passano dal file `_headers` di public/ (Cloudflare li serve
// senza invocare il Worker: restano gratuiti e illimitati). Questi stessi header
// vanno aggiunti a mano alle risposte che il Worker genera — HTML della SPA e API
// — perché il file _headers non le copre. Se cambi uno dei due elenchi, allinea
// l'altro: public/_headers.
const SECURITY_HEADERS = [
    ['Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.scryfall.com; media-src 'self' blob: https://*.lataverna.xyz; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests"],
    ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
    ['X-Frame-Options', 'DENY'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'no-referrer'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin']
];

const isSpaRoute = pathname => SPA_ROUTES.has(pathname)
    || SPA_SECTIONS.has(`/${pathname.split('/')[1] || ''}`);

const withSecurityHeaders = response => {
    const headers = new Headers(response.headers);
    for (const [name, value] of SECURITY_HEADERS) {
        if (!headers.has(name)) headers.set(name, value);
    }
    const body = response.status === 204 || response.status === 304 ? null : response.body;
    return new Response(body, { status: response.status, statusText: response.statusText, headers });
};

const jsonError = (status, code, error) => withSecurityHeaders(new Response(JSON.stringify({ ok: false, code, error }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
}));

/**
 * Le function leggono req.headers, req.method, req.url e req.body come su Vercel
 * (body già interpretato quando è JSON). Qui la richiesta Fetch diventa la stessa
 * forma, senza toccare gli handler.
 */
const toHandlerRequest = async (request, url) => {
    const headers = {};
    for (const [name, value] of request.headers) headers[name.toLowerCase()] = value;
    // Vercel espone l'IP dell'edge in x-real-ip: Cloudflare lo mette in
    // cf-connecting-ip. Senza questa mappatura i limiti per rete perderebbero
    // l'indirizzo e `magic/prices` non potrebbe più contare le richieste.
    if (!headers['x-real-ip'] && headers['cf-connecting-ip']) headers['x-real-ip'] = headers['cf-connecting-ip'];

    let body;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        const raw = await request.text();
        if (raw) {
            const contentType = headers['content-type'] || '';
            if (/json/i.test(contentType)) {
                try { body = JSON.parse(raw); } catch { body = raw; }
            } else {
                body = raw;
            }
        }
    }

    return { method: request.method, url: `${url.pathname}${url.search}`, headers, body };
};

/** Shim minimo di res (status/json/send/end/setHeader) sulle API dei Response. */
const createHandlerResponse = () => {
    const headers = new Headers();
    const chunks = [];
    let ended = false;
    let length = 0;

    const push = data => {
        if (data === undefined || data === null) return;
        let bytes;
        if (data instanceof Uint8Array) bytes = data;
        else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
        else bytes = new TextEncoder().encode(typeof data === 'string' ? data : String(data));
        chunks.push(bytes);
        length += bytes.byteLength;
    };

    const response = {
        statusCode: 200,
        status(code) { response.statusCode = code; return response; },
        setHeader(name, value) {
            if (Array.isArray(value)) {
                headers.delete(name);
                for (const item of value) headers.append(name, String(item));
            } else {
                headers.set(name, String(value));
            }
            return response;
        },
        getHeader(name) { return headers.get(name) ?? undefined; },
        removeHeader(name) { headers.delete(name); },
        json(payload) {
            headers.set('Content-Type', 'application/json; charset=utf-8');
            push(JSON.stringify(payload));
            ended = true;
            return response;
        },
        send(payload) { push(payload); ended = true; return response; },
        end(payload) { push(payload); ended = true; return response; },
        toResponse() {
            const body = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
            headers.set('Content-Length', String(length));
            return new Response(length ? body : null, { status: response.statusCode, headers });
        }
    };

    Object.defineProperty(response, 'writableEnded', { get: () => ended });
    return response;
};

const handleApi = async (request, url, load) => {
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_BODY_BYTES) return jsonError(413, 'payload_too_large', 'File troppo grande.');

    const handlerRequest = await toHandlerRequest(request, url);
    const handlerResponse = createHandlerResponse();
    try {
        const { default: handler } = await load();
        await handler(handlerRequest, handlerResponse);
    } catch (error) {
        console.error(`[api] ${url.pathname} fallita:`, error?.message || error);
        if (!handlerResponse.writableEnded) return jsonError(500, 'api_error', 'Servizio non disponibile.');
    }
    if (!handlerResponse.writableEnded) return jsonError(500, 'api_error', 'Servizio non disponibile.');
    return withSecurityHeaders(handlerResponse.toResponse());
};

const legacyRedirects = (url) => {
    const { pathname } = url;
    if (pathname === '/carte/scippo') return '/scippo';
    if (pathname === '/manuals' || pathname.startsWith('/manuals/')) return '/';
    if (pathname === '/manual-index' || pathname.startsWith('/manual-index/')) return '/';
    return null;
};

const route = async (request, env) => {
        const url = new URL(request.url);

        if (url.hostname === `www.${CANONICAL_HOST}`) {
            return Response.redirect(`https://${CANONICAL_HOST}${url.pathname}${url.search}`, 301);
        }

        const destination = legacyRedirects(url);
        if (destination) {
            return Response.redirect(`https://${url.hostname}${destination}${url.search}`, 307);
        }

        if (url.pathname === '/bw' || url.pathname === '/bw/login') {
            return handleApi(request, { ...url, pathname: '/api/bw/page' }, ROUTES['/api/bw/page']);
        }

        const load = ROUTES[url.pathname];
        if (load) return handleApi(request, url, load);

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return jsonError(405, 'method_not_allowed', 'Metodo non consentito.');
        }

        const assetUrl = new URL(request.url);
        if (AUDIO_ALIASES[assetUrl.pathname]) assetUrl.pathname = AUDIO_ALIASES[assetUrl.pathname];
        let response = await env.ASSETS.fetch(assetUrl.href === request.url
            ? request
            : new Request(assetUrl, request));

        if (response.status === 404) {
            if (!isSpaRoute(url.pathname)) {
                return withSecurityHeaders(new Response('Non trovato.', {
                    status: 404,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                }));
            }
            response = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
        }

        return withSecurityHeaders(response);
};

export default {
    async fetch(request, env, ctx) {
        try {
            const response = await route(request, env);
            // Un 5xx è una risposta riuscita per il runtime: senza questo
            // controllo gli errori delle function non arriverebbero a Sentry.
            // I 503 attesi (gateway spento, prezzi non configurati) sono esclusi
            // dentro isReportableStatus, così il canale resta segnale e non rumore.
            if (isReportableStatus(response.status)) {
                reportError(new Error(`HTTP ${response.status}`), { request, response, ctx });
            }
            return response;
        } catch (error) {
            reportError(error, { request, ctx });
            return jsonError(500, 'unhandled_error', 'Servizio non disponibile.');
        }
    }
};
