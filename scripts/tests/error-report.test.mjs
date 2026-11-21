// Sentry senza SDK: si verifica il formato dell'evento, cosa non va spedito
// (5xx attesi, query string) e che senza DSN non parta nulla, così
// l'integrazione si può attivare senza toccare il codice.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reportError, isReportingEnabled, isReportableStatus } from '../../api/_lib/errorReport.js';

const DSN = 'https://abc123def456@o12345.ingest.sentry.io/67890';

const withDsn = async (value, fn) => {
    const previous = process.env.SENTRY_DSN;
    if (value === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = value;
    try {
        return await fn();
    } finally {
        if (previous === undefined) delete process.env.SENTRY_DSN;
        else process.env.SENTRY_DSN = previous;
    }
};

const captureFetch = () => {
    const calls = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response('', { status: 200 });
    };
    return { calls, restore: () => { globalThis.fetch = original; } };
};

test('senza DSN non invia nulla', async () => {
    await withDsn(undefined, async () => {
        const { calls, restore } = captureFetch();
        try {
            assert.equal(isReportingEnabled(), false);
            assert.equal(reportError(new Error('boom')), false);
            assert.equal(calls.length, 0);
        } finally {
            restore();
        }
    });
});

test('con DSN invalido resta disattivato', async () => {
    for (const bad of ['', 'non-un-url', 'https://senza-progetto@sentry.io', 'https://@sentry.io/123']) {
        await withDsn(bad, async () => {
            const { calls, restore } = captureFetch();
            try {
                assert.equal(isReportingEnabled(), false, `DSN "${bad}" non dovrebbe essere accettato`);
                assert.equal(reportError(new Error('boom')), false);
                assert.equal(calls.length, 0);
            } finally {
                restore();
            }
        });
    }
});

test('con DSN valido invia l’evento senza query string', async () => {
    await withDsn(DSN, async () => {
        const { calls, restore } = captureFetch();
        try {
            let pending;
            const ctx = { waitUntil: promise => { pending = promise; } };
            const request = new Request('https://lataverna.xyz/api/oracle/chat?token=segreto', { method: 'POST' });

            assert.equal(isReportingEnabled(), true);
            assert.equal(reportError(new Error('Oracolo rotto'), { request, ctx, response: new Response(null, { status: 503 }) }), true);
            await pending;

            assert.equal(calls.length, 1);
            assert.equal(calls[0].url, 'https://o12345.ingest.sentry.io/api/67890/store/');
            assert.match(calls[0].init.headers['X-Sentry-Auth'], /sentry_key=abc123def456/);

            const body = JSON.parse(calls[0].init.body);
            assert.equal(body.message.formatted, 'Oracolo rotto');
            assert.equal(body.level, 'error');
            assert.equal(body.tags.runtime, 'cloudflare-workers');
            assert.equal(body.request.url, 'https://lataverna.xyz/api/oracle/chat');
            assert.equal(body.extra.status, 503);
            assert.ok(body.extra.stack.includes('Oracolo rotto'), 'lo stack deve arrivare come testo in extra');
            assert.equal(body.exception.values[0].stacktrace, undefined, 'nessuno stacktrace costruito a mano');
            assert.ok(!JSON.stringify(body).includes('segreto'), 'la query string non deve finire su Sentry');
            assert.match(body.event_id, /^[0-9a-f]{32}$/);
        } finally {
            restore();
        }
    });
});

test('i 5xx attesi non vengono segnalati', () => {
    // 503: gateway spento, prezzi non configurati, quota non disponibile.
    assert.equal(isReportableStatus(503), false);

    // I guasti veri restano segnalati.
    assert.equal(isReportableStatus(500), true);
    assert.equal(isReportableStatus(502), true);
    assert.equal(isReportableStatus(504), true);

    // Le risposte normali, ovviamente, no.
    assert.equal(isReportableStatus(200), false);
    assert.equal(isReportableStatus(404), false);
    assert.equal(isReportableStatus(429), false);
});
