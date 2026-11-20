// Verifica il Worker che serve il sito su Cloudflare: le regole erano in
// vercel.json e non avevano test. Gira senza rete e senza wrangler, con un
// binding ASSETS finto: è la parte che in CI può rompersi in silenzio.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import worker from '../../worker/index.js';
import { PUBLIC_ROUTES } from '../../src/services/publicRoutes.js';
import { isSameOriginRequest, readJsonBody, methodNotAllowed } from '../../api/_lib/http.js';

const SPA_HTML = '<!doctype html><html lang="it"><body>app</body></html>';
const ASSET_PATHS = new Set(['/index.html', '/assets/js/app-abc123.js', '/audio/old-tower-inn.mp3']);

// Registra i percorsi richiesti al binding per verificare gli alias audio.
const requested = [];
const env = {
    ASSETS: {
        async fetch(request) {
            const { pathname } = new URL(request.url);
            requested.push(pathname);
            if (pathname === '/audio/old-tower-inn.mp3') {
                return new Response('audio-bytes', { status: 200, headers: { 'Content-Type': 'audio/mpeg' } });
            }
            if (ASSET_PATHS.has(pathname)) {
                return new Response(SPA_HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }
            return new Response('Not found', { status: 404 });
        }
    }
};

const call = (path, init) => worker.fetch(new Request(`https://lataverna.xyz${path}`, init), env);

test('la radice serve la SPA con gli header di sicurezza', async () => {
    const response = await call('/');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(await response.text(), /<html/);
});

test('ogni rotta pubblica dell’app serve index.html, non un 404', async () => {
    // /carte, /giochi-di-ruolo, /shop, /library e /magic sono link reali della
    // sidebar e mancavano dalle rewrite di vercel.json: erano 404 in produzione.
    for (const path of Object.values(PUBLIC_ROUTES)) {
        const response = await call(path);
        assert.equal(response.status, 200, `${path} dovrebbe servire la SPA`);
        assert.match(response.headers.get('content-type'), /text\/html/, `${path} non è HTML`);
    }
});

test('i sottopercorsi di una sezione nota e l’alias /bottega servono la SPA', async () => {
    for (const path of ['/dnd/tavolo', '/oracolo/chat', '/scippo/qualsiasi', '/magic/partita/xyz', '/bottega', '/gestione']) {
        const response = await call(path);
        assert.equal(response.status, 200, `${path} dovrebbe servire la SPA`);
    }
});

test('una rotta sconosciuta resta 404 e non espone la SPA', async () => {
    assert.equal((await call('/rotta-inesistente')).status, 404);
    assert.equal((await call('/manca.png')).status, 404);
});

test('i redirect storici usano lo status giusto', async () => {
    const scippo = await call('/carte/scippo');
    assert.equal(scippo.status, 307);
    assert.equal(scippo.headers.get('location'), 'https://lataverna.xyz/scippo');

    for (const path of ['/manuals/x', '/manual-index/abc']) {
        const response = await call(path);
        assert.equal(response.status, 307, `${path} dovrebbe reindirizzare`);
        assert.equal(response.headers.get('location'), 'https://lataverna.xyz/');
    }
});

test('www reindirizza in modo permanente sul dominio canonico', async () => {
    const response = await worker.fetch(new Request('https://www.lataverna.xyz/privacy?x=1'), env);
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://lataverna.xyz/privacy?x=1');
});

test('gli alias audio servono il file reale', async () => {
    requested.length = 0;
    const response = await call('/audio/tavern.mp3');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.deepEqual(requested, ['/audio/old-tower-inn.mp3']);
});

test('i metodi non previsti sulle rotte statiche rispondono 405', async () => {
    const response = await call('/scippo', { method: 'POST', body: 'x' });
    assert.equal(response.status, 405);
});

test('le API mantengono metodo, origine e formato di risposta', async () => {
    const wrongMethod = await call('/api/oracle/chat');
    assert.equal(wrongMethod.status, 405);
    assert.equal(wrongMethod.headers.get('content-type'), 'application/json; charset=utf-8');

    const crossOrigin = await call('/api/oracle/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
        body: JSON.stringify({ prompt: 'ciao' })
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal((await crossOrigin.json()).code, 'cross_origin_forbidden');
});

test('/bw serve la pagina del laboratorio senza esporre il resto', async () => {
    const response = await call('/bw');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
});

// --- guardie condivise degli handler (non avevano alcun test) ---

test('la guardia sull’origine accetta solo lo stesso host', () => {
    assert.equal(isSameOriginRequest({ headers: {} }), true, 'una chiamata server-to-server non ha Origin');
    assert.equal(isSameOriginRequest({ headers: { origin: 'https://lataverna.xyz', host: 'lataverna.xyz' } }), true);
    assert.equal(isSameOriginRequest({ headers: { origin: 'https://evil.example', host: 'lataverna.xyz' } }), false);
    assert.equal(isSameOriginRequest({ headers: { origin: 'https://lataverna.xyz', host: 'altro.xyz' } }), false);
    assert.equal(isSameOriginRequest({ headers: { origin: 'non-un-url', host: 'lataverna.xyz' } }), false);
    assert.equal(isSameOriginRequest({ headers: { origin: 'https://lataverna.xyz' } }), false, 'senza Host non si può verificare');
});

test('il corpo JSON viene limitato e validato', async () => {
    const ok = await readJsonBody({ body: { prompt: 'ciao' } });
    assert.deepEqual(ok, { prompt: 'ciao' });

    await assert.rejects(
        () => readJsonBody({ body: '{"prompt":"' + 'x'.repeat(200) + '"}' }, 64),
        error => error.statusCode === 413
    );

    await assert.rejects(
        () => readJsonBody({ body: '[1,2,3]' }),
        error => error.statusCode === 400
    );
});

test('methodNotAllowed dichiara i metodi ammessi', () => {
    let status;
    let allow;
    const response = {
        status(code) { status = code; return response; },
        setHeader(name, value) { if (name === 'Allow') allow = value; },
        json(payload) { response.payload = payload; }
    };
    methodNotAllowed(response, ['POST']);
    assert.equal(status, 405);
    assert.equal(allow, 'POST');
    assert.equal(response.payload.ok, false);
});
