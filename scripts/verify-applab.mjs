// Verifica in sola lettura dello stato di APP LAB su Supabase.
// Non applica la migrazione: interroga PostgREST per capire se lo schema esiste.
// Uso: node scripts/verify-applab.mjs
import { existsSync, readFileSync } from 'node:fs';

const TABLES = ['app_lab_apps', 'app_lab_sessions', 'app_lab_porting_projects'];

const readEnvFiles = () => {
    const values = {};
    for (const file of ['.env.local', '.env']) {
        if (!existsSync(file)) continue;
        for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
            const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
            if (!match) continue;
            const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
            if (values[match[1]] === undefined) values[match[1]] = value;
        }
    }
    return values;
};

const env = { ...readEnvFiles(), ...process.env };
const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';

const classify = (status, code) => {
    if (status === 200 || status === 206) return { ready: true, label: 'presente (RLS attiva: nessuna riga per anonimo)' };
    if (status === 401 || status === 403) return { ready: true, label: 'presente (accesso anonimo negato, come previsto)' };
    if (code === 'PGRST205' || status === 404) {
        return { ready: false, label: 'MANCANTE: applica supabase/migrations/20261103120000_app_lab.sql' };
    }
    return { ready: false, label: `risposta inattesa (${status}${code ? ` ${code}` : ''})` };
};

if (!url || !key) {
    console.error('Servono VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY in .env.local (oppure SUPABASE_URL e SUPABASE_ANON_KEY).');
    process.exit(2);
}

console.log(`Progetto: ${url}`);
let missing = 0;

for (const table of TABLES) {
    let response;
    try {
        response = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` }
        });
    } catch (error) {
        console.log(`✖ ${table}: rete non raggiungibile (${error.message})`);
        missing += 1;
        continue;
    }
    const body = await response.text();
    let code = '';
    try {
        code = JSON.parse(body).code || '';
    } catch {
        code = '';
    }
    const verdict = classify(response.status, code);
    if (!verdict.ready) missing += 1;
    console.log(`${verdict.ready ? '✔' : '✖'} ${table}: ${verdict.label}`);
}

if (missing > 0) {
    console.log(`\n${missing} di ${TABLES.length} tabelle non sono pronte: la migrazione APP LAB non è applicata a questo progetto.`);
    process.exit(1);
}

console.log('\nAPP LAB: schema e permessi rispondono. Bucket privati e policy vanno verificati dal dashboard Storage.');
