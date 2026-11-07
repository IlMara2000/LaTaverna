import test from 'node:test';
import assert from 'node:assert/strict';
import {assertAiIpBudget} from '../../api/_lib/ipBudget.js';

const request = {headers: {'x-real-ip': '203.0.113.7'}};
const unavailable = error => error.statusCode === 503 && error.code === 'ip_budget_unavailable';

test('deployed AI requests require a configured, successful network quota check', async t => {
    const names = ['VERCEL', 'NODE_ENV', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
    t.after(() => {
        for (const name of names) {
            if (saved[name] === undefined) delete process.env[name];
            else process.env[name] = saved[name];
        }
    });
    process.env.VERCEL = '1';
    process.env.SUPABASE_URL = 'https://db.test';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await assert.rejects(assertAiIpBudget(request), unavailable);
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test';
    await assert.rejects(assertAiIpBudget({headers: {}}), unavailable);

    let reply = async () => { throw new Error('network timeout'); };
    t.mock.method(globalThis, 'fetch', (...args) => reply(...args));
    await assert.rejects(assertAiIpBudget(request), unavailable);
    for (const [status, data] of [[503, {}], [404, {}], [200, null], [200, '59'], [200, -1]]) {
        reply = async () => ({ok: status === 200, status, json: async () => data});
        await assert.rejects(assertAiIpBudget(request), unavailable);
    }
    reply = async () => ({ok: false, status: 400, json: async () => ({message: 'Troppe richieste AI da questa rete.'})});
    await assert.rejects(assertAiIpBudget(request), error => error.statusCode === 429);
    reply = async (url, options) => {
        assert.equal(url, 'https://db.test/rest/v1/rpc/take_ai_ip_quota');
        assert.match(JSON.parse(options.body).p_ip_hash, /^[0-9a-f]{64}$/);
        assert.equal(options.body.includes('203.0.113.7'), false);
        return {ok: true, status: 200, json: async () => 59};
    };
    assert.deepEqual(await assertAiIpBudget(request), {remaining: 59});
});
