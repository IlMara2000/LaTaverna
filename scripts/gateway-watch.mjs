#!/usr/bin/env node
// Sorveglia la catena dell'Oracolo: gateway FreeLLMAPI sul Mac, tunnel pubblico
// verso Vercel e health dell'app. Avvisa solo quando lo stato cambia, così un
// tunnel caduto non genera una notifica ogni due minuti.
//
//   npm run watch:gateway                 # un controllo, exit 1 se qualcosa è giù
//   npm run watch:gateway -- --loop 120   # controlla ogni 120 s
//   npm run watch:gateway -- --quiet      # log senza notifiche di sistema
//
// Variabili: FREELLMAPI_LOCAL_URL, FREELLMAPI_BASE_URL, TAVERNA_HEALTH_URL,
// TAVERNA_ALERT_WEBHOOK_URL (POST JSON {text}), GATEWAY_WATCH_STATE.

import {execFile} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const LOOPBACK = new Set(['127.0.0.1','localhost','::1','0.0.0.0']);
const TIMEOUT_MS = Number(process.env.GATEWAY_WATCH_TIMEOUT_MS) || 8000;
const STATE_PATH = resolve(process.env.GATEWAY_WATCH_STATE || 'output/gateway-watch-state.json');
const HEALTH_URL = process.env.TAVERNA_HEALTH_URL || 'https://www.lataverna.xyz/api/rpg/ai-health';

// Accetta radice o /v1: l'adapter dell'app fa lo stesso.
const normalize = value => String(value || '').trim().replace(/\/+$/,'').replace(/\/v1$/i,'');

const isLoopback = value => {
    try {
        return LOOPBACK.has(new URL(value).hostname);
    } catch {
        return false;
    }
};

// Un 401 senza chiave significa «gateway vivo»: è la stessa diagnostica
// documentata in docs/oracolo-freellmapi.md.
export const targets = () => {
    const local = normalize(process.env.FREELLMAPI_LOCAL_URL || 'http://127.0.0.1:31415');
    const tunnel = normalize(process.env.FREELLMAPI_BASE_URL || '');
    const list = [
        {name: 'gateway locale',url: `${local}/v1/models`,expect: [200,401]},
        {name: 'app (health)',url: HEALTH_URL,expect: [200]}
    ];
    if (tunnel && !isLoopback(tunnel)) {
        list.splice(1,0,{name: 'tunnel pubblico',url: `${tunnel}/v1/models`,expect: [200,401]});
    }
    return list;
};

export const probe = async (target, {fetchImpl = fetch,timeoutMs = TIMEOUT_MS} = {}) => {
    const started = Date.now();
    const expect = target.expect || [200];
    try {
        const response = await fetchImpl(target.url,{
            redirect: 'follow',
            headers: {'User-Agent': 'LaTaverna-gateway-watch'},
            signal: AbortSignal.timeout(timeoutMs)
        });
        const ok = expect.includes(response.status);
        return {name: target.name,url: target.url,ok,status: response.status,ms: Date.now() - started,detail: ok ? '' : `HTTP ${response.status}`};
    } catch (error) {
        // undici nasconde il codice vero dentro `cause` (a volte in un AggregateError):
        // senza questo, un guasto di rete reale si presenta come un generico "fetch failed".
        const cause = error?.cause;
        const networkDetail = cause?.code
            || cause?.errors?.[0]?.code
            || error?.code
            || cause?.message
            || error?.message
            || 'errore di rete';
        const detail = error?.name === 'TimeoutError' ? `timeout ${timeoutMs} ms` : networkDetail;
        return {name: target.name,url: target.url,ok: false,status: 0,ms: Date.now() - started,detail};
    }
};

// Nessun avviso al primo controllo se tutto è su: solo i guasti meritano rumore.
export const describeTransition = (previous,current) => {
    if (current.ok) return previous === 'down' ? `✅ ${current.name} di nuovo raggiungibile` : null;
    if (previous === 'down') return null;
    return `⚠️ ${current.name} non raggiungibile — ${current.detail}`;
};

const readState = async () => {
    try {
        const raw = JSON.parse(await readFile(STATE_PATH,'utf8'));
        return raw && typeof raw === 'object' ? raw : {};
    } catch {
        return {};
    }
};

const writeState = async state => {
    try {
        await mkdir(dirname(STATE_PATH),{recursive: true});
        await writeFile(STATE_PATH,`${JSON.stringify({...state,checkedAt: new Date().toISOString()},null,2)}\n`);
    } catch (error) {
        console.log(`(stato non salvato: ${error?.message || error})`);
    }
};

const notify = (message,{quiet = false} = {}) => {
    console.log(message);
    if (quiet) return;
    const webhook = process.env.TAVERNA_ALERT_WEBHOOK_URL;
    if (webhook) {
        fetch(webhook,{
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({text: message}),
            signal: AbortSignal.timeout(8000)
        }).catch(() => {});
    }
    if (process.platform !== 'darwin') return;
    execFile('osascript',['-e',`display notification ${JSON.stringify(message)} with title "La Taverna · Oracolo"`],() => {});
};

const runOnce = async ({quiet = false} = {}) => {
    const previous = await readState();
    const results = await Promise.all(targets().map(target => probe(target)));
    const next = {...previous};
    results.forEach(result => {
        const message = describeTransition(previous[result.name],result);
        if (message) notify(message,{quiet});
        next[result.name] = result.ok ? 'up' : 'down';
        const label = result.ok ? 'ok  ' : 'FAIL';
        console.log(`${label} ${result.name.padEnd(16)} ${String(result.status).padStart(3)} ${String(result.ms).padStart(5)} ms${result.detail ? `  ${result.detail}` : ''}`);
    });
    await writeState(next);
    return {ok: results.every(result => result.ok),results};
};

const main = async () => {
    const args = process.argv.slice(2);
    const quiet = args.includes('--quiet');
    const loopIndex = args.indexOf('--loop');
    if (loopIndex < 0) {
        const {ok} = await runOnce({quiet});
        process.exitCode = ok ? 0 : 1;
        return;
    }
    const intervalMs = Math.max(30,Number(args[loopIndex + 1]) || 120) * 1000;
    for (;;) {
        const {ok} = await runOnce({quiet});
        process.exitCode = ok ? 0 : 1;
        console.log(`… prossimo controllo tra ${Math.round(intervalMs / 1000)} s (Ctrl+C per uscire)`);
        await new Promise(done => setTimeout(done,intervalMs));
    }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch(error => {
        console.error('watchdog interrotto:',error?.message || error);
        process.exitCode = 2;
    });
}
