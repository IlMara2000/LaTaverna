// Esporta i dati di produzione di Supabase (file storage + dump del database)
// in una cartella locale. Il piano Free non offre backup scaricabili: senza
// questo, un errore di migrazione o una cancellazione non hanno ritorno.
//
// Uso:
//   node --env-file-if-exists=.env.local scripts/backup-supabase.mjs [--out cartella]
//
// Richiede SUPABASE_SERVICE_ROLE_KEY (o SERVICE_ROLE_KEY) per lo storage e,
// solo per il dump del database, DATABASE_URL (connection string Postgres) e
// `pg_dump` nel PATH. Senza DATABASE_URL esporta i file e lo dice.
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.resolve(outIndex >= 0 ? args[outIndex + 1] : `backups/${stamp}`);

const URL_BASE = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

const fail = message => {
    console.error(`✘ ${message}`);
    process.exit(1);
};

if (!URL_BASE) fail('Manca SUPABASE_URL (o VITE_SUPABASE_URL) nell’ambiente.');
if (!KEY) fail('Manca SUPABASE_SERVICE_ROLE_KEY: senza la chiave server lo storage privato non è leggibile.');

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const jsonOrThrow = async (response, what) => {
    if (!response.ok) throw new Error(`${what}: HTTP ${response.status} ${await response.text().catch(() => '')}`.trim());
    return response.json();
};

const listBuckets = async () => {
    const response = await fetch(`${URL_BASE}/storage/v1/bucket`, { headers, signal: AbortSignal.timeout(20000) });
    return jsonOrThrow(response, 'elenco bucket');
};

// L'API di storage elenca una cartella alla volta: le voci con id null sono
// sottocartelle e vanno attraversate.
const listFolder = async (bucket, prefix) => {
    const collected = [];
    for (let offset = 0; ; offset += 100) {
        const response = await fetch(`${URL_BASE}/storage/v1/object/list/${bucket}`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }),
            signal: AbortSignal.timeout(20000)
        });
        const rows = await jsonOrThrow(response, `elenco ${bucket}/${prefix}`);
        collected.push(...rows);
        if (rows.length < 100) return collected;
    }
};

const walkBucket = async (bucket, prefix = '') => {
    const files = [];
    for (const entry of await listFolder(bucket, prefix)) {
        const full = prefix ? `${prefix}${entry.name}` : entry.name;
        if (entry.id === null) files.push(...await walkBucket(bucket, `${full}/`));
        else files.push(full);
    }
    return files;
};

const download = async (bucket, objectPath, destination) => {
    const response = await fetch(`${URL_BASE}/storage/v1/object/${bucket}/${objectPath.split('/').map(encodeURIComponent).join('/')}`, {
        headers,
        signal: AbortSignal.timeout(120000)
    });
    if (!response.ok) throw new Error(`download ${bucket}/${objectPath}: HTTP ${response.status}`);
    await mkdir(path.dirname(destination), { recursive: true });
    await new Promise((resolve, reject) => {
        const stream = createWriteStream(destination);
        response.body.pipeTo(new WritableStream({
            write(chunk) { stream.write(chunk); },
            close() { stream.end(resolve); },
            abort(error) { stream.destroy(); reject(error); }
        })).catch(reject);
    });
};

const dumpDatabase = async () => {
    if (!DATABASE_URL) {
        console.warn('⚠ Nessun DATABASE_URL: il dump del database è saltato (i file sono salvati).');
        return null;
    }
    const target = path.join(OUT, 'database.dump');
    try {
        await run('pg_dump', ['--format=custom', '--no-owner', '--file', target, DATABASE_URL], { maxBuffer: 10 * 1024 * 1024 });
        return target;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn('⚠ pg_dump non è nel PATH: dump del database saltato. Installalo con `brew install postgresql`.');
            return null;
        }
        throw error;
    }
};

const main = async () => {
    await mkdir(OUT, { recursive: true });
    const buckets = await listBuckets();
    const manifest = { startedAt: new Date().toISOString(), source: URL_BASE, buckets: [] };
    let totalFiles = 0;

    for (const bucket of buckets) {
        const files = await walkBucket(bucket.name);
        for (const file of files) {
            await download(bucket.name, file, path.join(OUT, 'storage', bucket.name, file));
        }
        manifest.buckets.push({ name: bucket.name, public: bucket.public, files: files.length });
        totalFiles += files.length;
        console.log(`  ✓ ${bucket.name}: ${files.length} file`);
    }

    const dump = await dumpDatabase();
    manifest.databaseDump = dump ? path.basename(dump) : null;
    manifest.finishedAt = new Date().toISOString();
    await writeFile(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    console.log(`\nBackup in ${OUT}`);
    console.log(`  ${buckets.length} bucket, ${totalFiles} file, database: ${dump ? 'incluso' : 'assente'}`);
};

main().catch(error => fail(error.message));
