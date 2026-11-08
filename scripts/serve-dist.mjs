#!/usr/bin/env node
// Server statico della build di produzione (dist/): serve i file, fa fallback SPA su
// index.html e monta gli stessi handler /api/* del plugin Vite di sviluppo.
// Nessuna dipendenza: niente watcher, niente trasformazioni a runtime.
// Uso: node scripts/serve-dist.mjs [--port 3000]  (oppure PORT=3000)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { applyApiEnv, createApiMiddleware } from './local-api-bridge.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const indexPath = path.join(dist, 'index.html');

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const port = Number(portArg >= 0 ? args[portArg + 1] : process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

// Stesse variabili del bridge di sviluppo, lette dai file env senza dipendenze.
for (const file of ['.env', '.env.local']) {
    const filePath = path.join(root, file);
    if (fs.existsSync(filePath)) applyApiEnv(parseEnv(fs.readFileSync(filePath, 'utf8')));
}

if (!fs.existsSync(indexPath)) {
    console.error('[static] build mancante: dist/index.html non esiste, lancia prima `npm run build`');
    process.exit(1);
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
    '.icc': 'application/vnd.iccprofile',
    '.wasm': 'application/wasm',
    '.traineddata': 'application/octet-stream',
    '.gz': 'application/gzip'
};

function cacheControl(pathname) {
    if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
    if (pathname.endsWith('.html')) return 'no-store';
    return 'public, max-age=3600';
}

// Solo testo: immagini, audio, font e wasm hanno già un formato proprio.
const COMPRESSIBILI = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.md']);
const SOGLIA_GZIP = 1024;

// I compressi restano in memoria: la chiave include mtime e dimensione, quindi una
// rebuild li invalida da sola. Tetto complessivo per non crescere senza limite.
const CACHE_MAX_FILE = 8 * 1024 * 1024;
const CACHE_MAX_BYTES = 32 * 1024 * 1024;
const cacheCompressi = new Map();
const compressioniInCorso = new Map();
let cacheBytes = 0;

function memorizza(chiave, buf) {
    if (buf.length > CACHE_MAX_BYTES / 4) return;
    const vecchio = cacheCompressi.get(chiave);
    if (vecchio) cacheBytes -= vecchio.length;
    cacheCompressi.delete(chiave);
    cacheCompressi.set(chiave, buf);
    cacheBytes += buf.length;
    while (cacheBytes > CACHE_MAX_BYTES && cacheCompressi.size > 1) {
        const [chiaveVecchia, bufVecchio] = cacheCompressi.entries().next().value;
        cacheCompressi.delete(chiaveVecchia);
        cacheBytes -= bufVecchio.length;
    }
}

async function compresso(filePath, chiave) {
    const inCache = cacheCompressi.get(chiave);
    if (inCache) {
        cacheCompressi.delete(chiave);
        cacheCompressi.set(chiave, inCache); // rinfresca l'ordine di espulsione
        return inCache;
    }
    let lavoro = compressioniInCorso.get(chiave);
    if (!lavoro) {
        lavoro = fs.promises.readFile(filePath)
            .then((dati) => new Promise((ok, ko) => {
                zlib.gzip(dati, { level: 6 }, (err, buf) => (err ? ko(err) : ok(buf)));
            }))
            .then((buf) => { compressioniInCorso.delete(chiave); memorizza(chiave, buf); return buf; })
            .catch((err) => { compressioniInCorso.delete(chiave); throw err; });
        compressioniInCorso.set(chiave, lavoro);
    }
    return lavoro;
}

async function sendFile(req, res, filePath, { status = 200 } = {}) {
    const ext = path.extname(filePath).toLowerCase();
    let stat;
    let size;
    try { stat = fs.statSync(filePath); size = stat.size; } catch { res.writeHead(404); res.end('Not found'); return; }

    const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': cacheControl(filePath.startsWith(dist + path.sep) ? filePath.slice(dist.length) : ''),
        'X-Content-Type-Options': 'nosniff',
        'Accept-Ranges': 'bytes'
    };

    // Range singolo: serve ad audio e PDF per essere seekabili.
    const range = req.headers.range;
    let start = 0;
    let end = size - 1;
    let partial = false;
    if (range && /^bytes=\d*-\d*$/.test(range)) {
        const [from, to] = range.slice(6).split('-');
        if (from === '' && to === '') { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
        if (from === '') { start = Math.max(0, size - Number(to)); }
        else { start = Number(from); if (to !== '') end = Math.min(Number(to), size - 1); }
        if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
        partial = true;
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }

    headers['Content-Length'] = end - start + 1;

    // Compressione al volo: solo senza Range (206 non si comprime) e solo se il client accetta gzip.
    const comprimibile = COMPRESSIBILI.has(ext);
    const gzip = !partial && comprimibile && size >= SOGLIA_GZIP && /\bgzip\b/i.test(req.headers['accept-encoding'] || '');
    if (comprimibile) headers.Vary = 'Accept-Encoding';
    if (gzip) {
        headers['Content-Encoding'] = 'gzip';
        delete headers['Content-Length'];
        // Con il compresso già in memoria si conosce la lunghezza esatta: niente chunked.
        if (size <= CACHE_MAX_FILE) {
            let buf = null;
            try { buf = await compresso(filePath, `${filePath}:${stat.mtimeMs}:${size}`); } catch { buf = null; }
            if (buf) {
                headers['Content-Length'] = buf.length;
                res.writeHead(status, headers);
                if (req.method === 'HEAD') res.end(); else res.end(buf);
                return;
            }
        }
    }
    res.writeHead(partial ? 206 : status, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('error', () => { if (!res.writableEnded) res.destroy(); });
    if (gzip) stream.pipe(zlib.createGzip({ level: 6 })).pipe(res);
    else stream.pipe(res);
}

// sendFile è asincrona: un rifiuto non gestito farebbe terminare il processo.
function invia(req, res, filePath, opzioni) {
    sendFile(req, res, filePath, opzioni).catch(() => {
        if (!res.headersSent) { try { res.writeHead(500, { 'Content-Type': 'text/plain' }); } catch {} }
        if (!res.writableEnded) res.end();
    });
}

function serveStatic(req, res) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end('Richiesta non valida'); return; }

    const filePath = path.join(dist, path.normalize(pathname));
    if (filePath !== dist && !filePath.startsWith(dist + path.sep)) { res.writeHead(403); res.end('Vietato'); return; }

    let isDir = false;
    try { isDir = fs.statSync(filePath).isDirectory(); } catch {}

    if (!isDir && fs.existsSync(filePath)) { invia(req, res, filePath); return; }

    // Una rotta dell'app senza estensione ricade sull'index (SPA), un asset assente no.
    if (!path.extname(pathname)) { invia(req, res, indexPath); return; }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Non trovato');
}

const handleApiRequest = createApiMiddleware();

const server = http.createServer(async (req, res) => {
    try {
        if (req.url?.startsWith('/api/')) {
            if (await handleApiRequest(req, res)) return;
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: false, error: 'Rotta API sconosciuta.' }));
            return;
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405, { Allow: 'GET, HEAD' });
            res.end();
            return;
        }
        serveStatic(req, res);
    }
    catch (err) {
        console.error(`[static] ${req.method} ${req.url} fallita:`, err?.message || err);
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Errore interno');
    }
});

server.on('error', (err) => {
    console.error(`[static] impossibile ascoltare su ${host}:${port}:`, err.message);
    process.exit(1);
});

server.listen(port, host, () => {
    console.log(`[static] dist servita su http://localhost:${port}/ (ascolto ${host}:${port})`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => server.close(() => process.exit(0)));
}
