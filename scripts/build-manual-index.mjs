import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requestedSystem = process.argv[2] || 'all';
const manuals = [
    { system: 'dnd5e', slug: 'Giocatore', id: 'player' },
    { system: 'dnd5e', slug: 'DM', id: 'master' },
    { system: 'dnd5e', slug: 'Mostri', id: 'monsters' },
    { system: 'pathfinder2e', slug: 'PathfinderBase', id: 'base' },
    { system: 'pathfinder2e', slug: 'PathfinderGM', id: 'gm' },
    { system: 'pathfinder2e', slug: 'PathfinderBestiario', id: 'bestiary' }
].filter(manual => requestedSystem === 'all' || manual.system === requestedSystem);

if (!manuals.length) {
    console.error(`Sistema sconosciuto: ${requestedSystem}`);
    process.exit(1);
}

const runIndexer = (manual) => new Promise((resolve, reject) => {
    const output = path.join('public', 'manual-index', manual.system, `${manual.id}.json`);
    const child = spawn('swift', [
        'scripts/build-manual-index.swift',
        '--manual',
        manual.slug,
        '--output',
        output
    ], {
        cwd: workspace,
        stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', code => {
        if (code === 0) resolve();
        else reject(new Error(`Indicizzazione fallita per ${manual.slug} (codice ${code}).`));
    });
});

try {
    await Promise.all(manuals.map(runIndexer));
    console.log(`Indicizzazione completata: ${manuals.length} manuali.`);
} catch (error) {
    console.error(error.message);
    process.exit(1);
}
