#!/usr/bin/env node
/**
 * COPERTURA EFFETTI MAGIC
 *
 * Prende le carte dei mazzi demo (o un elenco di nomi da riga di comando),
 * chiede i testi Oracle a Scryfall e misura quanti sono applicati dal motore
 * di src/dashboards/magicEffects.js:
 *
 *   npm run magic:coverage                 # i quattro mazzi demo
 *   npm run magic:coverage -- "Swords to Plowshares" "Wrath of God"
 *
 * La copertura non sarà mai il 100%: Magic ha decine di migliaia di testi e il
 * motore è un interprete a modelli. Lo scopo dello script è rendere la crescita
 * misurabile invece di aneddotica: si guardano le frasi non gestite più
 * frequenti, si aggiunge il modello, il numero sale.
 *
 * Senza rete stampa un errore e termina con codice 1, senza risultati inventati.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { automatedEffectCount, parseCardAbilities } from '../src/dashboards/magicEffects.js';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const mazzi = join(radice, 'src/data/magic-demo-decks');

const nomiDaMazzi = () => {
    const nomi = new Set();
    for (const file of readdirSync(mazzi)) {
        for (const line of readFileSync(join(mazzi, file), 'utf8').split('\n')) {
            const match = line.match(/^\s*\d+\s+(.+?)\s*$/);
            if (match) nomi.add(match[1]);
        }
    }
    return [...nomi];
};

const nomi = process.argv.slice(2).length ? process.argv.slice(2) : nomiDaMazzi();
if (!nomi.length) {
    console.error('Nessuna carta da analizzare.');
    process.exit(1);
}

const carte = [];
for (let offset = 0; offset < nomi.length; offset += 70) {
    const identifiers = nomi.slice(offset, offset + 70).map(name => ({ name }));
    const risposta = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'TavernaCoverage/1.0' },
        body: JSON.stringify({ identifiers })
    }).catch(error => error);
    if (!risposta || !risposta.ok) {
        console.error(`Scryfall non raggiungibile: ${risposta?.status || risposta?.message || 'errore di rete'}`);
        process.exit(1);
    }
    const payload = await risposta.json();
    carte.push(...(payload.data || []));
    await new Promise(resolve => setTimeout(resolve, 120));
}
if (!carte.length) {
    console.error('Scryfall non ha restituito nessuna carta.');
    process.exit(1);
}

const conta = { terre: 0, senzaTesto: 0, soloParoleChiave: 0, automatiche: 0, parziali: 0, manuali: 0 };
const frasi = new Map();
for (const carta of carte) {
    if (/\bland\b/i.test(carta.type_line || '')) { conta.terre += 1; continue; }
    const testo = (carta.oracle_text || '').trim();
    if (!testo) { conta.senzaTesto += 1; continue; }
    const parsed = parseCardAbilities({
        name: carta.name, typeLine: carta.type_line, oracleText: testo, keywords: carta.keywords || []
    });
    // Stessa conta di textSupport: inneschi, abilità, magie (un modo supportato
    // vale uno) e testi statici come gli anthem.
    const automatici = automatedEffectCount(parsed);
    if (automatici > 0 && parsed.manual.length === 0) conta.automatiche += 1;
    else if (automatici > 0) conta.parziali += 1;
    else if (parsed.manual.length === 0) conta.soloParoleChiave += 1;
    else {
        conta.manuali += 1;
        for (const frase of parsed.manual) {
            const chiave = frase.replace(/\d+/g, 'N').slice(0, 90);
            frasi.set(chiave, (frasi.get(chiave) || 0) + 1);
        }
    }
}

const nonTerra = carte.length - conta.terre;
const coperte = conta.automatiche + conta.parziali;
console.log(`\nCOPERTURA EFFETTI — ${carte.length} carte (${nomi.length} nomi richiesti)\n`);
console.log(`  terre (già gestite)        ${conta.terre}`);
console.log(`  senza testo (vanilla)      ${conta.senzaTesto}`);
console.log(`  solo parole chiave         ${conta.soloParoleChiave}`);
console.log(`  totalmente automatiche     ${conta.automatiche}`);
console.log(`  parzialmente automatiche   ${conta.parziali}`);
console.log(`  solo manuali               ${conta.manuali}`);
console.log(`\n  coperte almeno in parte    ${coperte}/${nonTerra} = ${Math.round((coperte / nonTerra) * 100)}% delle carte non terra`);

const frequenti = [...frasi.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
if (frequenti.length) {
    console.log('\nFrasi non gestite più frequenti (la coda da attaccare):');
    for (const [frase, occorrenze] of frequenti) console.log(`  ${String(occorrenze).padStart(3)}× ${frase}`);
}
console.log('');
