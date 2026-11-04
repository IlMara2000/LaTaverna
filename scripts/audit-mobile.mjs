#!/usr/bin/env node
/**
 * AUDIT IMPAGINAZIONE MOBILE DEI MINIGIOCHI
 *
 * Apre la Taverna in un browser pilotato da agent-browser, avvia ogni gioco
 * a 390x844 (telefono verticale), misura il tavolo e stampa una tabella.
 *
 *   node scripts/audit-mobile.mjs                 # tutti i giochi
 *   node scripts/audit-mobile.mjs scacchi dama    # solo alcuni
 *   BASE=http://localhost:3000 SIZE=390x844 node scripts/audit-mobile.mjs
 *
 * Salva il report completo in scripts/audit-mobile.json.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const sorgenteAudit = readFileSync(join(radice, 'scripts/mobile-audit.js'), 'utf8');

const TUTTI = [
    'scala40', 'scopa', 'briscola', 'solitario', 'solo', 'burraco',
    'tictactoe', 'scacchi', 'dama', 'blocchi', 'impostore', 'numeri'
];
const giochi = process.argv.slice(2).length ? process.argv.slice(2) : TUTTI;
const base = process.env.BASE || 'http://localhost:3000';
const [larghezza, altezza] = (process.env.SIZE || '390x844').split('x').map(Number);
const GRUPPO = Number(process.env.BATCH || 3);

const esegui = (comando, argomenti) => execFileSync(comando, argomenti, {
    cwd: radice,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
});

const estraiJson = testo => {
    const inizio = testo.indexOf('[');
    const fine = testo.lastIndexOf(']');
    if (inizio < 0 || fine < 0) throw new Error(`Risposta senza JSON:\n${testo.slice(0, 400)}`);
    return JSON.parse(testo.slice(inizio, fine + 1));
};

console.log(`Audit ${giochi.length} giochi a ${larghezza}x${altezza} su ${base}`);
esegui('agent-browser', ['set', 'viewport', String(larghezza), String(altezza)]);
esegui('agent-browser', ['open', `${base}/minigames`]);
esegui('agent-browser', ['wait', '2500']);

const report = [];
for (let i = 0; i < giochi.length; i += GRUPPO) {
    const gruppo = giochi.slice(i, i + GRUPPO);
    const codice = `(async () => {\n${sorgenteAudit}\nreturn await window.__mobileAudit(${JSON.stringify(gruppo)});\n})()`;
    const uscita = esegui('agent-browser', ['eval', codice]);
    report.push(...estraiJson(uscita));
}

const si = '✓';
const no = '✗';
const segna = (v, limite = 0) => (v > limite ? no : si);
const righe = report.map(r => {
    if (r.esito) return `${r.gioco.padEnd(11)} ${no} ${r.esito}`;
    const problemi = [
        r.riempieSchermo ? '' : 'non riempie',
        r.fuoriDalTavolo ? `${r.fuoriDalTavolo} fuori` : '',
        r.comandiSotto32px ? `${r.comandiSotto32px} comandi<32` : '',
        r.testiSotto9px ? `${r.testiSotto9px} testi<9px` : '',
        r.overflowOrizzontale > 0 ? `overflow ${r.overflowOrizzontale}` : '',
        r.guscio?.scrolla ? `scroll ${r.guscio.serve}>${r.guscio.vede}` : ''
    ].filter(Boolean);
    const stato = problemi.length ? `${no} ${problemi.join(' · ')}` : `${si} ok`;
    return `${r.gioco.padEnd(11)} ${r.tavolo.padEnd(18)} ${r.classi || '-'
        }\n            ${stato}`;
});

console.log('\nGIOCO       TAVOLO             CLASSI\n');
console.log(righe.join('\n'));
const rotti = report.filter(r => r.esito || !r.riempieSchermo || r.fuoriDalTavolo || r.overflowOrizzontale > 0 || r.guscio?.scrolla);
writeFileSync(join(radice, 'scripts/audit-mobile.json'), JSON.stringify(report, null, 2));
console.log(`\n${report.length - rotti.length}/${report.length} giochi senza problemi di tavolo.`);
console.log('Dettaglio completo in scripts/audit-mobile.json');
