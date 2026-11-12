#!/usr/bin/env node
/**
 * TEST SAFE-AREA DEL SEGNAPUNTI
 *
 * Apre /mtcg/segnapunti in un browser reale (agent-browser), imposta gli inset
 * di sicurezza delle principali dimensioni telefono e verifica che la barra in
 * basso con il pulsante menu resti sempre sopra l'indicatore home e che nessuna
 * card finisca sotto il notch o sotto il menu.
 *
 *   npm run test:safe-area
 *   BASE=http://localhost:3000 node scripts/test-card-counter-safe-area.mjs
 *
 * Gli inset sono scritti nelle variabili `--safe-*` del contenitore, perché
 * Chrome desktop riporta `env(safe-area-inset-*)` a zero: è la stessa catena
 * che usa iOS, dove le variabili arrivano da `env()`.
 *
 * Esce con codice 1 se una misura esce dalle soglie.
 */
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = process.env.AGENT_BROWSER || 'agent-browser';
const sessione = `card-counter-safe-area-${process.pid}`;

// Le principali dimensioni telefono, con gli inset misurati su iPhone veri.
const VIEWPORT = [
    { nome: 'iPhone SE verticale', w: 320, h: 568, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
    { nome: 'iPhone 13 mini verticale', w: 375, h: 812, insets: { top: 50, right: 0, bottom: 34, left: 0 } },
    { nome: 'iPhone 14 verticale', w: 390, h: 844, insets: { top: 47, right: 0, bottom: 34, left: 0 } },
    { nome: 'iPhone 15 Pro Max verticale', w: 430, h: 932, insets: { top: 59, right: 0, bottom: 34, left: 0 } },
    { nome: 'iPhone 15 orizzontale', w: 844, h: 390, insets: { top: 0, right: 47, bottom: 21, left: 47 } },
    { nome: 'iPhone SE orizzontale', w: 667, h: 375, insets: { top: 0, right: 0, bottom: 0, left: 0 } }
];

const esegui = (...argomenti) => execFileSync(browser, ['--session', sessione, ...argomenti], {
    cwd: radice,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
});

const raggiungibile = async url => {
    try {
        return (await fetch(url, { signal: AbortSignal.timeout(4000) })).ok;
    } catch {
        return false;
    }
};

let server = null;

// Se la BASE indicata non risponde, si accende un Vite temporaneo e lo si
// spegne alla fine: il test deve poter girare senza un dev server già aperto.
const avviaVite = async () => {
    const numero = 4310 + (process.pid % 40);
    const processo = spawn(join(radice, 'node_modules', '.bin', 'vite'), ['--port', String(numero), '--strictPort'], {
        cwd: radice,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CI: '1' }
    });
    processo.stdin.on('error', () => { /* stdin chiuso: pazienza */ });
    let registro = '';
    processo.stdout.on('data', pezzo => { registro += pezzo; });
    processo.stderr.on('data', pezzo => { registro += pezzo; });
    const url = `http://localhost:${numero}`;
    for (let tentativo = 0; tentativo < 60; tentativo++) {
        if (await raggiungibile(url)) return { processo, url };
        if (processo.exitCode !== null) break;
        await new Promise(risolvi => setTimeout(risolvi, 500));
    }
    try { processo.kill('SIGTERM'); } catch { /* già morto */ }
    throw new Error(`Vite temporaneo non pronto su ${url}\n${registro.slice(-500)}`);
};

const fermaServer = () => {
    if (!server) return;
    try { server.processo.kill('SIGTERM'); } catch { /* già terminato */ }
    server = null;
};

// Script eseguito nella pagina: avvia partite da 2 a 6 giocatori con gli inset
// richiesti e restituisce le misure che il test controlla.
const scriptMisure = insets => `
const attesa = async (selector, ms) => {
    const inizio = Date.now();
    while (Date.now() - inizio < ms) {
        const nodo = document.querySelector(selector);
        if (nodo) return nodo;
        await new Promise(risolvi => setTimeout(risolvi, 100));
    }
    return null;
};
const root = await attesa('.card-counter', 8000);
if (!root) return { error: 'segnapunti non montato' };
const form = root.querySelector('form');
if (!form) return { error: 'modulo di avvio assente' };
const insets = ${JSON.stringify(insets)};
root.style.setProperty('--safe-top', insets.top + 'px');
root.style.setProperty('--safe-right', insets.right + 'px');
root.style.setProperty('--safe-bottom', insets.bottom + 'px');
root.style.setProperty('--safe-left', insets.left + 'px');
const rect = nodo => {
    const r = nodo.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
};
const intersezione = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
const avvia = conteggio => {
    form.elements.preset.value = 'commander';
    form.elements.players.value = String(conteggio);
    form.elements.initial.value = '40';
    form.requestSubmit();
};
const misura = conteggio => {
    const menuNodo = root.querySelector('[data-menu]');
    const menu = menuNodo.getBoundingClientRect();
    const card = [...root.querySelectorAll('.counter-player')].map(nodo => nodo.getBoundingClientRect());
    const tasti = [...root.querySelectorAll('[data-delta]')].map(nodo => nodo.getBoundingClientRect());
    const stile = getComputedStyle(root);
    return {
        giocatori: conteggio,
        padding: [parseFloat(stile.paddingTop), parseFloat(stile.paddingRight), parseFloat(stile.paddingBottom), parseFloat(stile.paddingLeft)],
        menu: { ...rect(menuNodo), height: menu.height },
        cardCount: card.length,
        cardLeft: Math.min(...card.map(r => r.left)),
        cardRight: Math.max(...card.map(r => r.right)),
        cardWidths: card.map(r => Math.round(r.width * 10) / 10),
        tastiCount: tasti.length,
        tastoMin: Math.min(...tasti.map(r => r.width)),
        cardTop: Math.min(...card.map(r => r.top)),
        cardBottom: Math.max(...card.map(r => r.bottom)),
        sovrapposizioneCard: Math.max(0, ...card.map(r => intersezione(menu, r))),
        sovrapposizioneTasti: Math.max(0, ...tasti.map(r => intersezione(menu, r))),
        cardOverflow: [...root.querySelectorAll('.counter-player')].some(nodo => nodo.scrollHeight > nodo.clientHeight + 1 || nodo.scrollWidth > nodo.clientWidth + 1),
        docX: document.documentElement.scrollWidth - innerWidth,
        docY: document.documentElement.scrollHeight - innerHeight,
        viewport: [innerWidth, innerHeight]
    };
};
const partite = {};
for (const conteggio of [2, 3, 4, 5, 6]) {
    avvia(conteggio);
    partite[conteggio] = misura(conteggio);
}
return { partite };
`;

const arrotonda = valore => Math.round(valore * 10) / 10;
const problemi = [];
const verifica = (condizione, messaggio) => { if (!condizione) problemi.push(messaggio); };

// Contratto statico: se un domani qualcuno toglie il viewport-fit o riporta il
// menu al centro con position:absolute, il test lo dice subito.
const html = readFileSync(join(radice, 'index.html'), 'utf8');
const globalCss = readFileSync(join(radice, 'src/styles/global.css'), 'utf8');
const segnapuntiCss = readFileSync(join(radice, 'src/dashboards/cardCounter-lotus.css'), 'utf8');
verifica(/viewport-fit\s*=\s*cover/.test(html), 'index.html non dichiara viewport-fit=cover');
for (const lato of ['top', 'right', 'bottom', 'left']) {
    verifica(new RegExp(`--safe-${lato}:\\s*env\\(safe-area-inset-${lato}`).test(globalCss), `global.css non mappa --safe-${lato} su env(safe-area-inset-${lato})`);
}
verifica(/\.counter-board\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s*48px/s.test(segnapuntiCss), 'la board non riserva una barra da 48px');
verifica(/\.counter-menu-trigger\s*\{[^}]*position:\s*static/s.test(segnapuntiCss), 'il menu non è più statico nella barra');

let base = (process.env.BASE || 'http://localhost:3000').replace(/\/+$/, '');
if (!await raggiungibile(base)) {
    console.log(`${base} non risponde: avvio un Vite temporaneo.`);
    server = await avviaVite();
    base = server.url;
    process.once('exit', fermaServer);
}

const misure = [];
try {
    esegui('open', `${base}/mtcg/segnapunti`);
    for (const vista of VIEWPORT) {
        esegui('set', 'viewport', String(vista.w), String(vista.h));
        let risultato = null;
        for (let tentativo = 0; tentativo < 3 && !risultato; tentativo++) {
            try {
                const uscita = esegui('eval', `(async () => {\n${scriptMisure(vista.insets)}\n})()`);
                const inizio = uscita.indexOf('{');
                const fine = uscita.lastIndexOf('}');
                if (inizio >= 0 && fine > inizio) risultato = JSON.parse(uscita.slice(inizio, fine + 1));
            } catch {
                /* la pagina può essere in navigazione: si riprova */
            }
            if (!risultato) await new Promise(risolvi => setTimeout(risolvi, 600));
        }
        if (!risultato) {
            problemi.push(`${vista.nome}: nessuna misura disponibile`);
            continue;
        }
        if (risultato.error) {
            problemi.push(`${vista.nome}: ${risultato.error}`);
            continue;
        }
        misure.push({ ...vista, ...risultato });
    }
} finally {
    try { esegui('close'); } catch { /* il browser può essere già chiuso */ }
    fermaServer();
}

for (const vista of misure) {
    for (const misura of Object.values(vista.partite || {})) {
        if (!misura) {
            problemi.push(`${vista.nome}: misura assente`);
            continue;
        }
        const dove = `${vista.nome} ${vista.w}x${vista.h}, ${misura.giocatori} giocatori`;
        const { insets } = vista;
        const [top, right, bottom, left] = misura.padding;

        verifica(Math.abs(top - insets.top) <= 0.5, `${dove}: padding-top ${arrotonda(top)}px invece di ${insets.top}px`);
        verifica(Math.abs(right - insets.right) <= 0.5, `${dove}: padding-right ${arrotonda(right)}px invece di ${insets.right}px`);
        verifica(Math.abs(bottom - insets.bottom) <= 0.5, `${dove}: padding-bottom ${arrotonda(bottom)}px invece di ${insets.bottom}px`);
        verifica(Math.abs(left - insets.left) <= 0.5, `${dove}: padding-left ${arrotonda(left)}px invece di ${insets.left}px`);

        const lineaSicura = vista.h - insets.bottom;
        verifica(misura.menu.bottom <= lineaSicura - 3, `${dove}: il menu finisce a ${arrotonda(misura.menu.bottom)}px, oltre la linea sicura ${lineaSicura}px`);
        verifica(misura.menu.bottom > lineaSicura - 52, `${dove}: il menu non è nella barra in basso (${arrotonda(misura.menu.bottom)}px)`);
        verifica(Math.abs(misura.menu.height - 40) <= 1, `${dove}: il menu è alto ${arrotonda(misura.menu.height)}px invece di 40px`);

        verifica(misura.sovrapposizioneCard === 0, `${dove}: il menu copre una card (${arrotonda(misura.sovrapposizioneCard)}px²)`);
        verifica(misura.sovrapposizioneTasti === 0, `${dove}: il menu copre un tasto (${arrotonda(misura.sovrapposizioneTasti)}px²)`);
        verifica(misura.cardBottom <= misura.menu.top - 1, `${dove}: la card finisce a ${arrotonda(misura.cardBottom)}px, il menu parte a ${arrotonda(misura.menu.top)}px`);
        verifica(misura.cardTop >= insets.top - 0.5, `${dove}: la card parte a ${arrotonda(misura.cardTop)}px, dentro il notch (${insets.top}px)`);
        verifica(misura.cardLeft >= insets.left - 0.5, `${dove}: card oltre il bordo sinistro sicuro (${arrotonda(misura.cardLeft)}px contro ${insets.left}px)`);
        verifica(misura.cardRight <= vista.w - insets.right + 0.5, `${dove}: card oltre il bordo destro sicuro (${arrotonda(misura.cardRight)}px contro ${vista.w - insets.right}px)`);
        verifica(misura.cardCount === misura.giocatori, `${dove}: ${misura.cardCount} card invece di ${misura.giocatori}`);

        // Ogni card ha due tasti, e nessun tasto scende sotto i 44px di larghezza:
        // sotto quella soglia il pollice sbaglia tasto su uno schermo stretto.
        verifica(misura.tastiCount === misura.giocatori * 2, `${dove}: ${misura.tastiCount} tasti invece di ${misura.giocatori * 2}`);
        verifica(misura.tastoMin >= 43.5, `${dove}: tasto largo solo ${arrotonda(misura.tastoMin)}px (minimo 44px)`);

        // Le griglie speciali: in verticale la terza e la quinta card occupano la
        // riga intera; in orizzontale le ultime due della partita a cinque sono più
        // larghe delle prime tre (griglia a sei colonne).
        const larghezze = misura.cardWidths || [];
        const prima = larghezze[0];
        const ultima = larghezze[larghezze.length - 1];
        if (vista.h > vista.w && (misura.giocatori === 3 || misura.giocatori === 5)) {
            verifica(ultima >= prima * 1.5, `${dove}: l'ultima card non occupa la riga (${arrotonda(ultima)}px contro ${arrotonda(prima)}px)`);
        }
        if (vista.w > vista.h && misura.giocatori === 5) {
            verifica(larghezze[3] > prima * 1.1, `${dove}: la quinta card non è più larga della prima (${arrotonda(larghezze[3])}px contro ${arrotonda(prima)}px)`);
        }

        verifica(misura.docX <= 1 && misura.docY <= 1, `${dove}: overflow della pagina ${misura.docX}/${misura.docY}px`);
        verifica(!misura.cardOverflow, `${dove}: contenuto della card in overflow`);
    }
}

console.log(`\nSAFE-AREA SEGNAPUNTI — ${misure.length}/${VIEWPORT.length} viewport su ${base}\n`);
console.log('VIEWPORT'.padEnd(30) + 'INSET (t/r/b/l)'.padEnd(20) + 'MENU 2g / LINEA'.padEnd(22) + 'SOVRAPP. MAX'.padEnd(14) + 'TASTI MIN'.padEnd(12) + 'CARD 6g');
for (const vista of misure) {
    const { insets } = vista;
    const partite = Object.values(vista.partite || {});
    const due = vista.partite?.[2];
    const sei = vista.partite?.[6];
    const menu = due ? `${arrotonda(due.menu.bottom)} / ${vista.h - insets.bottom}` : '—';
    const massima = partite.length ? Math.max(...partite.map(m => m.sovrapposizioneTasti)) : null;
    const sovrapposizione = massima === null ? '—' : `${arrotonda(massima)}px²`;
    const tastoMinimo = partite.length ? Math.min(...partite.map(m => m.tastoMin)) : null;
    const tasti = tastoMinimo === null ? '—' : `${arrotonda(tastoMinimo)}px`;
    const card = sei ? `${arrotonda(sei.cardTop)}→${arrotonda(sei.cardBottom)}` : '—';
    console.log(
        `${vista.nome}`.padEnd(30)
        + `${insets.top}/${insets.right}/${insets.bottom}/${insets.left}`.padEnd(20)
        + `${menu}`.padEnd(22)
        + `${sovrapposizione}`.padEnd(14)
        + `${tasti}`.padEnd(12)
        + `${card}`
    );
}

if (problemi.length) {
    console.error('\nMisure fuori soglia:');
    for (const problema of problemi) console.error(`  ✗ ${problema}`);
    console.error(`\n${problemi.length} problemi.`);
    process.exit(1);
}

console.log('\nBarra e menu sempre dentro la safe-area.');
