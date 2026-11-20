// `npm run lint` era un echo: qui almeno il codice server viene parsato
// davvero, così un errore di sintassi in api/, worker/ o scripts/ non arriva in
// produzione. Non è un linter di stile: controlla che i file si carichino.
import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const TARGETS = ['api', 'worker', 'scripts'];

const walk = async directory => {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await walk(full));
        else if (/\.(m?js)$/.test(entry.name)) files.push(full);
    }
    return files;
};

const files = [];
for (const target of TARGETS) {
    try {
        files.push(...await walk(path.join(ROOT, target)));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

let failed = 0;
for (const file of files) {
    try {
        await run(process.execPath, ['--check', file]);
    } catch (error) {
        failed += 1;
        console.error(`\n✘ ${path.relative(ROOT, file)}\n${error.stderr || error.message}`);
    }
}

if (failed) {
    console.error(`\nSintassi non valida in ${failed} file su ${files.length}.`);
    process.exit(1);
}

console.log(`Sintassi verificata su ${files.length} file (api/, worker/, scripts/).`);
