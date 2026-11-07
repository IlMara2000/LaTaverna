#!/usr/bin/env node
/**
 * TEST IMPAGINAZIONE SCHEDA CARTA (dashboard Magic)
 *
 * Monta la dashboard Magic con una collezione di prova dentro il browser
 * pilotato da agent-browser e misura sei larghezze: griglia della collezione,
 * pannello mazzi e tendina dei dettagli a riposo e aperta.
 *
 *   npm run test:layout
 *   BASE=http://localhost:3000 node scripts/test-magic-layout.mjs
 *
 * Esce con codice 1 se una misura esce dalle soglie: serve a impedire che una
 * modifica al CSS o al JS della scheda carta riporti le carte troppo strette,
 * la tendina staccata dal bordo o l'arte fuori dal palco.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const sorgente = readFileSync(join(radice, 'scripts/mobile-audit.js'), 'utf8');
const base = (process.env.BASE || 'http://localhost:3000').replace(/\/+$/, '');
const browser = process.env.AGENT_BROWSER || 'agent-browser';
const sessione = `magic-layout-${process.pid}`;

const VIEWPORT = [
    { nome: 'telefono', w: 390, h: 844 },
    { nome: 'tablet stretto', w: 651, h: 900 },
    { nome: 'tablet', w: 768, h: 1024 },
    { nome: 'tablet grande', w: 834, h: 1112 },
    { nome: 'tablet orizzontale', w: 1024, h: 768 },
    { nome: 'desktop', w: 1180, h: 900 }
];

const esegui = (...argomenti) => execFileSync(browser, ['--session', sessione, ...argomenti], {
    cwd: radice,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
});

const raggiungibile = async () => {
    try {
        const risposta = await fetch(base, { signal: AbortSignal.timeout(4000) });
        return risposta.ok;
    } catch {
        return false;
    }
};

if (!(await raggiungibile())) {
    console.error(`Nessuna Taverna su ${base}. Avvia il dev server con: npm run dev`);
    process.exit(1);
}

const misure = [];
try {
    esegui('open', `${base}/`);
    for (const vista of VIEWPORT) {
        // Ogni larghezza riparte da una pagina fresca: la tendina decide la sua
        // geometria al montaggio, quindi un semplice resize non basta.
        esegui('set', 'viewport', String(vista.w), String(vista.h));
        esegui('reload');
        esegui('wait', '1600');
        const uscita = esegui('eval', `(async () => {\n${sorgente}\nreturn await window.__magicLayout();\n})()`);
        const inizio = uscita.indexOf('{'), fine = uscita.lastIndexOf('}');
        if (inizio < 0 || fine < 0) throw new Error(`${vista.w}x${vista.h}: la pagina non ha restituito misure\n${uscita.slice(0, 600)}`);
        misure.push({ ...vista, ...JSON.parse(uscita.slice(inizio, fine + 1)) });
    }
} finally {
    try {
        esegui('close');
    } catch { /* il browser può essere già chiuso */ }
}

const larghezza = (testo, colonne) => String(testo).padEnd(colonne);
console.log(`\nSCHEDA CARTA — ${misure.length} larghezze su ${base}\n`);
console.log(`${larghezza('VIEWPORT', 14)}${larghezza('GRIGLIA', 13)}${larghezza('MAZZI', 28)}${larghezza('TENDE', 12)}GESTI (drag→rilasci/tocco)`);
for (const m of misure) {
    const griglia = `${m.collection.cols}×${m.collection.cardW}px`;
    const mazzi = `${m.deck.layoutCols} col · ${m.deck.listDisplay} · ${m.deck.gridCols}×${m.deck.cards}`;
    const tende = m.sheet.enabled ? `${m.sheet.min.copy?.h}→${m.sheet.max.copy?.h}px` : 'assente';
    const g = m.sheet.gestures;
    const gesti = g ? `${g.passi.trascinamento.h} ${g.passi.rilascioSottoMeta}/${g.passi.rilascioSopraMeta}/${g.passi.tocco}` : '—';
    console.log(`${larghezza(`${m.w}x${m.h}`, 14)}${larghezza(griglia, 13)}${larghezza(mazzi, 28)}${larghezza(tende, 12)}${gesti}`);
}

const problemi = [];
const verifica = (condizione, messaggio) => {
    if (!condizione) problemi.push(messaggio);
};

for (const m of misure) {
    const dove = `${m.w}x${m.h}`;
    const c = m.collection, d = m.deck, s = m.sheet;

    // La pagina non deve mai chiedere scroll orizzontale.
    verifica(m.overflowX <= 1, `${dove}: pagina più larga della viewport di ${m.overflowX}px`);
    verifica(c.cols >= 2, `${dove}: la collezione ha una sola colonna`);
    verifica(c.cardW >= 140, `${dove}: carte larghe solo ${c.cardW}px`);
    verifica(c.gridW <= m.w + 2, `${dove}: griglia larga ${c.gridW}px su ${m.w}px`);
    verifica(c.cards >= 6, `${dove}: la griglia mostra ${c.cards} carte invece di 6`);

    // Colonne attese: telefono 2, tablet 3, orizzontale 4, desktop 6.
    if (m.w <= 650) verifica(c.cols === 2, `${dove}: attese 2 colonne, trovate ${c.cols}`);
    else if (m.w <= 900) verifica(c.cols === 3, `${dove}: attese 3 colonne, trovate ${c.cols}`);
    else if (m.w === 1024) verifica(c.cols === 4, `${dove}: attese 4 colonne, trovate ${c.cols}`);
    else verifica(c.cols >= 4, `${dove}: attese almeno 4 colonne, trovate ${c.cols}`);

    // Sotto i 900px il mazzo non deve restare accanto a una sidebar da 240px.
    verifica(d.decks >= 2, `${dove}: il pannello mazzi non elenca i mazzi`);
    if (m.w <= 900) {
        verifica(d.layoutCols === 1, `${dove}: mazzi ancora affiancati (${d.layoutCols} colonne)`);
        verifica(d.listDisplay === 'flex', `${dove}: lista mazzi ${d.listDisplay} invece di flex`);
        verifica(d.listOverflowX === 'auto', `${dove}: lista mazzi non scorrevole (${d.listOverflowX})`);
        verifica(d.gridCols === c.cols, `${dove}: mazzo a ${d.gridCols} colonne contro ${c.cols} della collezione`);
    } else {
        verifica(d.layoutCols === 2, `${dove}: mazzi su ${d.layoutCols} colonne invece di 2`);
        verifica(d.listDisplay === 'grid', `${dove}: lista mazzi ${d.listDisplay} invece di grid`);
    }

    if (m.w <= 1024) {
        // Tendina trascinabile: a riposo l'arte deve restare centrata nel palco.
        verifica(s.enabled, `${dove}: tendina disattivata a ${m.w}px`);
        verifica(s.min.art && s.min.copy, `${dove}: arte o tendina non misurate`);
        if (s.min.art && s.min.copy) {
            verifica(Math.abs(s.min.gapAbove - s.min.gapBelow) <= 2, `${dove}: arte non centrata (${s.min.gapAbove}px sopra, ${s.min.gapBelow}px sotto)`);
            verifica(s.min.gapAbove >= 40, `${dove}: arte incollata in alto (${s.min.gapAbove}px di margine)`);
            verifica(Math.abs(parseFloat(s.min.varMin) - s.min.copy.h) <= 2, `${dove}: --mv-sheet-min ${s.min.varMin} contro tendina ${s.min.copy.h}px`);
            verifica(s.min.close && s.min.close.y >= 0 && s.min.close.y <= 20, `${dove}: comando chiudi a ${s.min.close?.y}px`);
            verifica(s.min.close.y + s.min.close.h <= s.min.copy.y + 2, `${dove}: il chiudi finisce sotto la tendina`);
        }
        // Aperta: la tendina arriva a 56px dal bordo e il corpo scorre.
        if (s.max.copy && s.max.close) {
            verifica(Math.abs(s.max.copy.h - (m.h - 56)) <= 2, `${dove}: tendina aperta ${s.max.copy.h}px invece di ${m.h - 56}px`);
            verifica(Math.abs(s.max.copy.y - 56) <= 2, `${dove}: tendina aperta lascia ${s.max.copy.y}px sopra invece di 56px`);
            verifica(s.max.close.y >= 0 && s.max.close.y + s.max.close.h <= s.max.copy.y + 2, `${dove}: chiudi coperto con la tendina aperta`);
            verifica(s.max.art && s.max.art.y === s.min.art?.y, `${dove}: l'arte si muove aprendo la tendina`);
            verifica(s.max.body && s.max.body.scrollH >= s.max.body.clientH, `${dove}: corpo della tendina non misurabile`);
        } else {
            problemi.push(`${dove}: tendina aperta non misurata`);
        }

        // Gesti simulati: inseguimento, aggancio sopra e sotto metà, tocco.
        const g = s.gestures;
        if (!g) {
            problemi.push(`${dove}: gesti della tendina non misurati`);
        } else {
            const tappa = 2;
            const t = g.passi.trascinamento;
            verifica(Math.abs(g.riposo - s.min.copy.h) <= tappa, `${dove}: tendina a riposo ${g.riposo}px invece di ${s.min.copy.h}px`);
            verifica(Math.abs(t.h - t.atteso) <= tappa, `${dove}: il trascinamento non segue il dito (${t.h}px invece di ${t.atteso}px)`);
            verifica(t.dragging, `${dove}: classe is-sheet-dragging assente durante il trascinamento`);
            verifica(t.transizione === '0s', `${dove}: transizione ${t.transizione} durante il trascinamento`);
            verifica(t.arteY === g.arteRiposo, `${dove}: l'arte si muove durante il trascinamento`);
            verifica(Math.abs(g.passi.rilascioSottoMeta - g.riposo) <= tappa, `${dove}: rilasciata sotto metà resta a ${g.passi.rilascioSottoMeta}px invece di tornare a ${g.riposo}px`);
            verifica(Math.abs(g.passi.rilascioSopraMeta - s.max.copy.h) <= tappa, `${dove}: rilasciata sopra metà si ferma a ${g.passi.rilascioSopraMeta}px invece di ${s.max.copy.h}px`);
            verifica(Math.abs(g.passi.tocco - g.riposo) <= tappa, `${dove}: il tocco singolo non richiude (${g.passi.tocco}px)`);
            verifica(Math.abs(g.passi.microTrascinamento - s.max.copy.h) <= tappa, `${dove}: uno spostamento di 4px non vale come tocco: ${g.passi.microTrascinamento}px invece di ${s.max.copy.h}px`);
            verifica(Math.abs(g.passi.trascinaGiu - g.riposo) <= tappa, `${dove}: trascinata giù sotto metà non si richiude (${g.passi.trascinaGiu}px)`);
        }
    } else {
        verifica(!s.enabled, `${dove}: tendina attiva anche su desktop`);
        verifica(s.min.inlineHeight === '', `${dove}: altezza inline ${s.min.inlineHeight} sulla tendina desktop`);
    }
}

if (problemi.length) {
    console.error('\nMisure fuori soglia:');
    for (const problema of problemi) console.error(`  ✗ ${problema}`);
    console.error(`\n${problemi.length} problemi.`);
    process.exit(1);
}

console.log('\nTutte le misure dentro le soglie.');
