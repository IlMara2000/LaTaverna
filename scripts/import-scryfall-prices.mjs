#!/usr/bin/env node
/**
 * Importa i prezzi di stampa da un file bulk di Scryfall in public.magic_card_prices.
 *
 * Uso:
 *   npm run prices:import -- /percorso/default_cards.json
 *   npm run prices:import -- /percorso/default_cards.json --dry-run --limit 50
 *
 * Il file può essere l'array JSON ufficiale di Scryfall (una carta per riga) oppure JSONL:
 * il lettore ricostruisce un oggetto alla volta, quindi non carica mai il file in memoria.
 * La chiave è l'`id` di stampa di Scryfall, lo stesso valore che mazzi e collezione usano
 * come card_id.
 *
 * Variabili d'ambiente (lette da .env.local come gli altri script, oppure dalla shell):
 *   SUPABASE_URL oppure VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (obbligatoria: la tabella è scrivibile solo dal ruolo di servizio)
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';

const TABLE = 'magic_card_prices';
const BATCH_SIZE = 500;
const PROGRESS_EVERY = 20000;
const MAX_CONSECUTIVE_FAILURES = 3;
const BULK_DATA_URL = 'https://scryfall.com/docs/api/bulk-data';

function fail(message) {
    console.error(`Errore: ${message}`);
    process.exit(1);
}

// --- argomenti -------------------------------------------------------------

const argv = process.argv.slice(2).filter(item => item !== '--');
const dryRun = argv.includes('--dry-run');
const limitIndex = argv.indexOf('--limit');
const limit = limitIndex >= 0 ? Number.parseInt(argv[limitIndex + 1], 10) : 0;

if (limitIndex >= 0 && (!Number.isFinite(limit) || limit <= 0)) fail('--limit richiede un numero positivo.');
if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Uso: npm run prices:import -- <file bulk Scryfall> [--dry-run] [--limit N]');
    process.exit(0);
}

const file = argv.find((item, index) => !item.startsWith('-') && !(limitIndex >= 0 && index === limitIndex + 1));
if (!file) fail(`indica il file bulk di Scryfall, ad esempio:\n  npm run prices:import -- ~/Downloads/default_cards.json\nElenco dei file: ${BULK_DATA_URL}`);

// --- configurazione --------------------------------------------------------

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

/** Ruolo dichiarato nel payload di un JWT Supabase, senza verificarne la firma. */
function tokenRole(token) {
    const parts = String(token ?? '').split('.');
    if (parts.length !== 3) return null;
    try {
        return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role ?? null;
    } catch {
        return null;
    }
}

if (!dryRun) {
    if (!url) fail('manca SUPABASE_URL (oppure VITE_SUPABASE_URL).');
    if (!key) fail(`manca SUPABASE_SERVICE_ROLE_KEY: ${TABLE} è scrivibile solo dal ruolo di servizio.`);
    const role = tokenRole(key);
    if (String(key).startsWith('sb_publishable_') || role === 'anon') {
        fail('la chiave fornita è pubblica (anon): serve la service role key, altrimenti i prezzi non si possono scrivere.');
    }
    if (role && role !== 'service_role') {
        fail(`la chiave ha ruolo "${role}": serve la service role key.`);
    }
}

const info = await stat(file).catch(() => null);
if (!info || !info.isFile()) fail(`file non trovato: ${file}\nScarica "default_cards" da ${BULK_DATA_URL}`);

// --- lettura del file ------------------------------------------------------

/** Profondità delle graffe e stato "dentro stringa", per capire quando un oggetto è completo. */
function bracketState(text) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') inString = true;
        else if (char === '{') depth += 1;
        else if (char === '}') depth -= 1;
    }

    return { depth, inString };
}

/**
 * Interpreta un oggetto completo. Nell'array JSON ufficiale ogni oggetto è seguito dalla
 * virgola di separazione, che JSON.parse non accetta: va rimossa prima di provare.
 */
function parseCard(text) {
    const cleaned = text.trim().replace(/,\s*$/, '');
    try {
        const value = JSON.parse(cleaned);
        return value && typeof value === 'object' ? value : null;
    } catch {
        return null;
    }
}

/**
 * Genera una carta alla volta, qualunque sia il formato: array JSON ufficiale o JSONL.
 * Ogni riga che inizia un oggetto viene accumulata finché le graffe non tornano a zero.
 */
async function* readCards(path) {
    const lines = createInterface({
        input: createReadStream(path, { encoding: 'utf8' }),
        crlfDelay: Infinity,
    });

    let pending = '';

    for await (const line of lines) {
        if (!pending && !line.trimStart().startsWith('{')) continue; // '[' , ']' o righe vuote

        pending = pending ? `${pending}\n${line}` : line;
        const state = bracketState(pending);
        if (state.depth !== 0 || state.inString) continue;

        const card = parseCard(pending);
        pending = '';
        if (card) yield card;
        else stats.malformed += 1;
    }

    if (pending.trim()) {
        // file troncato o oggetto rimasto aperto
        if (!parseCard(pending)) stats.malformed += 1;
    }
}

// --- valori ----------------------------------------------------------------

function toPrice(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return null;
    return Math.round(number * 100) / 100;
}

// --- esecuzione ------------------------------------------------------------

const supabase = dryRun
    ? null
    : createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const fetchedAt = new Date().toISOString();
const startedAt = Date.now();
const stats = { parsed: 0, priced: 0, skipped: 0, written: 0, failed: 0, malformed: 0 };
const sample = [];

let batch = [];
let consecutiveFailures = 0;
let interrupted = false;

process.on('SIGINT', () => {
    interrupted = true;
    console.error('\nInterruzione richiesta: chiudo il batch in corso…');
});

async function flush() {
    if (batch.length === 0) return;

    const rows = batch;
    batch = [];
    if (dryRun) return;

    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'card_id' });

    if (error) {
        consecutiveFailures += 1;
        stats.failed += rows.length;
        console.error(`Batch di ${rows.length} righe rifiutato: ${error.message}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            fail('troppi batch consecutivi falliti: interrompo per non ripetere lo stesso errore.');
        }
        return;
    }

    consecutiveFailures = 0;
    stats.written += rows.length;
}

for await (const card of readCards(file)) {
    if (interrupted) break;

    stats.parsed += 1;

    if (typeof card.id !== 'string' || card.id.length === 0) {
        stats.skipped += 1;
        continue;
    }

    const eur = toPrice(card.prices?.eur);
    const usd = toPrice(card.prices?.usd);

    if (eur === null && usd === null) {
        stats.skipped += 1;
        continue;
    }

    const row = {
        card_id: card.id,
        card_name: typeof card.name === 'string' ? card.name : '',
        set_code: typeof card.set === 'string' ? card.set : '',
        eur,
        usd,
        source: 'scryfall',
        fetched_at: fetchedAt,
    };

    if (sample.length < 5) sample.push(row);
    batch.push(row);
    stats.priced += 1;

    if (batch.length >= BATCH_SIZE) await flush();
    if (stats.priced % PROGRESS_EVERY === 0) {
        console.error(`  ${stats.priced} stampe con prezzo, ${stats.written} righe scritte`);
    }
    if (limit > 0 && stats.priced >= limit) break;
}

await flush();

// --- riepilogo -------------------------------------------------------------

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

console.log(dryRun ? 'Prova completata (nessuna scrittura):' : 'Import completato:');
console.log(`  carte lette:       ${stats.parsed}`);
console.log(`  stampe con prezzo: ${stats.priced}`);
console.log(`  scartate:          ${stats.skipped}`);
console.log(`  righe scritte:     ${stats.written}`);
if (stats.malformed > 0) console.log(`  oggetti malformati:${' '}${stats.malformed}`);
if (stats.failed > 0) console.log(`  righe fallite:     ${stats.failed}`);
console.log(`  durata:            ${seconds}s`);

if (dryRun && sample.length > 0) {
    console.log('\nPrime righe che verrebbero scritte:');
    console.log(JSON.stringify(sample, null, 2));
}

if (!dryRun && !interrupted) {
    const { count, error } = await supabase.from(TABLE).select('*', { count: 'exact', head: true });
    if (error) console.error(`Conteggio finale non disponibile: ${error.message}`);
    else console.log(`  righe in ${TABLE}: ${count}`);
}

if (interrupted) process.exitCode = 130;
else if (stats.failed > 0 || stats.malformed > 0) process.exitCode = 1;
