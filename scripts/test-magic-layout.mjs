#!/usr/bin/env node
/**
 * TEST IMPAGINAZIONE SCHEDA CARTA (dashboard Magic)
 *
 * Monta la dashboard Magic con una collezione di prova dentro il browser
 * pilotato da agent-browser e misura otto larghezze: griglia della collezione,
 * pannello mazzi e tendina dei dettagli a riposo e aperta.
 *
 *   npm run test:layout
 *   BASE=http://localhost:3000 node scripts/test-magic-layout.mjs
 *
 * Se la porta indicata non serve i sorgenti — tipico quando `npm run serve`
 * espone la build statica — il test avvia un Vite temporaneo su una porta
 * libera e lo spegne all'uscita.
 *
 * Esce con codice 1 se una misura esce dalle soglie: serve a impedire che una
 * modifica al CSS o al JS della scheda carta riporti le carte troppo strette,
 * la tendina staccata dal bordo o l'arte fuori dal palco.
 */
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { connect as netConnect, createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const sorgente = readFileSync(join(radice, 'scripts/mobile-audit.js'), 'utf8');
let base = (process.env.BASE || 'http://localhost:3000').replace(/\/+$/, '');
const browser = process.env.AGENT_BROWSER || 'agent-browser';
const sessione = `magic-layout-${process.pid}`;

const VIEWPORT = [
    { nome: 'telefono piccolo', w: 320, h: 568 },
    { nome: 'telefono', w: 390, h: 844 },
    // Altezza scarsa: il palco è più basso dell'arte, quindi la carta resta in alto
    // e la tendina si accontenta di meno spazio.
    { nome: 'telefono orizzontale', w: 844, h: 390, spazioStretto: true },
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

// Il test legge i moduli così come stanno in `src/`: se la porta espone la build
// statica (`scripts/serve-dist.mjs`), `/src/...` non esiste e la misura non
// partirebbe. In quel caso il test si accende un Vite suo, su una porta libera,
// e lo spegne all'uscita.
const serveSorgenti = async url => {
    try {
        const risposta = await fetch(`${url}/src/dashboards/magic.js`, { signal: AbortSignal.timeout(4000) });
        if (!risposta.ok) return false;
        return /javascript/.test(risposta.headers.get('content-type') || '') && (await risposta.text()).includes('export');
    } catch {
        return false;
    }
};

// Una porta è libera solo se nessuno l'ascolta su nessuna delle due famiglie:
// Vite si lega a `localhost`, che qui è `::1`, quindi una sonda legata a
// `127.0.0.1` dichiara libera una porta occupata e `--strictPort` fa poi fallire
// l'avvio con `Port 4300 is already in use`.
const inAscolto = (numero, host) => new Promise(risolvi => {
    let connessione;
    let scadenza = null;
    const chiudi = esito => {
        if (scadenza) clearTimeout(scadenza);
        try { connessione?.destroy(); } catch { /* già chiusa */ }
        risolvi(esito);
    };
    try {
        connessione = netConnect(numero, host);
    } catch {
        risolvi(false);
        return;
    }
    // Un listener che accetta ma non risponde è comunque occupato.
    scadenza = setTimeout(() => chiudi(true), 600);
    connessione.once('connect', () => chiudi(true));
    connessione.once('error', () => chiudi(false));
});

const portaOccupata = async numero => (await inAscolto(numero, '127.0.0.1')) || (await inAscolto(numero, '::1'));

const portaLibera = async inizio => {
    for (let numero = inizio; numero < inizio + 40; numero++) {
        if (await portaOccupata(numero)) continue;
        const libera = await new Promise(risolvi => {
            const prova = createServer();
            prova.once('error', () => risolvi(false));
            prova.once('listening', () => prova.close(() => risolvi(true)));
            prova.listen(numero);
        });
        if (libera) return numero;
    }
    return null;
};

const avviaViteSu = async numero => {
    // Lo stdin resta aperto: il CLI di Vite esce quando lo stdin finisce, e con
    // `ignore` (cioè /dev/null) si spegnerebbe a metà corsa. `CI=1` disattiva
    // anche le scorciatoie da tastiera, che non servono qui.
    const processo = spawn(join(radice, 'node_modules', '.bin', 'vite'), ['--port', String(numero), '--strictPort'], {
        cwd: radice,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, CI: '1' }
    });
    processo.stdin.on('error', () => { /* stdin chiuso: pazienza */ });
    processo.once('exit', codice => {
        if (typeof codice === 'number' && codice !== 0) {
            console.error(`Vite temporaneo uscito con codice ${codice}\n${registro.slice(-600)}`);
        }
    });
    let registro = '';
    processo.stdout.on('data', pezzo => { registro += pezzo; });
    processo.stderr.on('data', pezzo => { registro += pezzo; });
    const url = `http://localhost:${numero}`;
    for (let tentativo = 0; tentativo < 60; tentativo++) {
        if (await serveSorgenti(url)) return { processo, url };
        if (processo.exitCode !== null) break;
        await new Promise(risolvi => setTimeout(risolvi, 500));
    }
    processo.kill();
    throw new Error(`Vite temporaneo non pronto su ${url}\n${registro.slice(-600)}`);
};

// Se la porta scelta viene presa nella corsa tra sonda e avvio, o Vite muore appena
// partito, il tentativo successivo riparte da una porta diversa invece di ripetere
// lo stesso numero.
const avviaVite = async () => {
    let ultimo = null;
    for (let tentativo = 0; tentativo < 3; tentativo++) {
        const numero = await portaLibera(4300 + tentativo * 10);
        if (!numero) throw new Error('nessuna porta libera per un Vite temporaneo');
        try {
            return await avviaViteSu(numero);
        } catch (errore) {
            ultimo = errore;
            console.error(`Vite temporaneo non avviato sulla porta ${numero}: ${String(errore.message).split('\n')[0]}`);
        }
    }
    throw ultimo;
};

let vite = null;

// SIGTERM e poi SIGKILL: Vite a volte ignora il primo, e i suoi pipe terrebbero
// vivo questo processo anche dopo la stampa della tabella. Il riavvio aspetta la
// morte effettiva, così la porta è davvero libera prima di riaccenderlo.
const fermaVite = async () => {
    const processo = vite?.processo;
    vite = null;
    if (!processo || processo.exitCode !== null) return;
    for (const flusso of [processo.stdin, processo.stdout, processo.stderr]) {
        try { flusso?.destroy?.(); } catch { /* già chiuso */ }
    }
    processo.unref?.();
    await new Promise(risolvi => {
        let forzatura = null;
        let limite = null;
        const fatto = () => {
            clearTimeout(forzatura);
            clearTimeout(limite);
            risolvi();
        };
        processo.once('exit', fatto);
        // SIGTERM può restare in sospeso su un processo congelato: SIGKILL lo chiude.
        forzatura = setTimeout(() => {
            try { processo.kill('SIGKILL'); } catch { /* già terminato */ }
        }, 1500);
        // Rete di sicurezza: non aspettare per sempre se nemmeno SIGKILL fa uscire.
        limite = setTimeout(fatto, 5000);
        try {
            if (!processo.kill('SIGTERM')) fatto();
        } catch {
            fatto();
        }
    });
    // I timer qui sopra non sono `unref`: mentre aspettiamo sono loro a tenere vivo
    // il processo, altrimenti Node uscirebbe con 13 a metà attesa.
    await new Promise(risolvi => setTimeout(risolvi, 200));
};

const spegniVite = () => {
    void fermaVite();
};

if (!(await serveSorgenti(base))) {
    console.log(await raggiungibile()
        ? `${base} serve la build statica, non i sorgenti: avvio un Vite temporaneo.`
        : `Nessuna risposta da ${base}: avvio un Vite temporaneo.`);
    try {
        vite = await avviaVite();
    } catch (errore) {
        console.error(`Impossibile avviare un Vite temporaneo: ${errore.message}`);
        process.exit(1);
    }
    base = vite.url;
    process.once('exit', spegniVite);
    for (const segnale of ['SIGINT', 'SIGTERM']) process.once(segnale, () => { spegniVite(); process.exit(130); });
}

const viteVivo = () => Boolean(vite?.processo) && vite.processo.exitCode === null && vite.processo.signalCode === null;

// Tre tentativi intervallati: un timeout isolato non deve far ripartire il server.
const viteRisponde = async (tentativi = 3, pausa = 600) => {
    for (let tentativo = 0; tentativo < tentativi; tentativo++) {
        if (await serveSorgenti(base)) return true;
        if (tentativo < tentativi - 1) await new Promise(risolvi => setTimeout(risolvi, pausa));
    }
    return false;
};

// Il Vite temporaneo può uscire o incantarsi a metà corsa: se non risponde più lo
// riaccendo, invece di misurare una pagina d'errore (dove localStorage è vietato).
const assicuraSorgenti = async () => {
    if (!vite || await viteRisponde()) return;
    if (viteVivo()) {
        // Sotto carico un dev server può impiegare più dei 4s di timeout: prima di
        // spegnerlo gli do un'altra occasione.
        console.log('Il Vite temporaneo non risponde: aspetto che si riprenda.');
        await new Promise(risolvi => setTimeout(risolvi, 4000));
        if (await viteRisponde()) return;
    }
    console.log(viteVivo()
        ? 'Il Vite temporaneo è bloccato: lo spengo e lo riaccendo.'
        : 'Il Vite temporaneo è uscito: lo riaccendo.');
    await fermaVite();
    vite = await avviaVite();
    base = vite.url;
    esegui('open', `${base}/`);
};

const misure = [];
try {
    esegui('open', `${base}/`);
    for (const vista of VIEWPORT) {
        await assicuraSorgenti();
        // La misura rimonta la scheda da zero a ogni larghezza, quindi la tendina
        // ricalcola la sua geometria al montaggio: non serve ricaricare la pagina,
        // che costava un `reload` e due secondi fissi per ogni viewport. Il reload
        // resta come recupero, quando una lettura si è invalidata.
        esegui('set', 'viewport', String(vista.w), String(vista.h));
        let uscita = null;
        for (let tentativo = 0; tentativo < 3 && uscita === null; tentativo++) {
            if (tentativo) {
                // Se il server è morto durante la misura, la pagina da ricaricare non
                // esiste: prima di riprovare lo rimetto in piedi.
                await assicuraSorgenti();
                esegui('reload');
                esegui('wait', '--load', 'load');
            }
            try {
                uscita = esegui('eval', `(async () => {\n${sorgente}\nreturn await window.__magicLayout();\n})()`);
            } catch (error) {
                // La pagina può navigare da sola durante la misura (boot, sessione, HMR)
                // o ricaricarsi per l'ottimizzazione delle dipendenze di Vite: la lettura
                // diventa invalida, quindi si riprova una volta sola.
                const testo = String(error.stderr || error.message || error);
                if (tentativo) {
                    throw new Error(`${vista.w}x${vista.h}: misura interrotta\n${testo.slice(-800)}`);
                }
            }
        }
        const inizio = uscita.indexOf('{'), fine = uscita.lastIndexOf('}');
        if (inizio < 0 || fine < 0) throw new Error(`${vista.w}x${vista.h}: la pagina non ha restituito misure\n${uscita.slice(0, 600)}`);
        misure.push({ ...vista, ...JSON.parse(uscita.slice(inizio, fine + 1)) });
    }
} finally {
    try {
        esegui('close');
    } catch { /* il browser può essere già chiuso */ }
    // Atteso, non `void`: uscendo per errore un kill non atteso lascerebbe il Vite
    // vivo (e la porta occupata) dopo la fine del test.
    await fermaVite();
}

const larghezza = (testo, colonne) => String(testo).padEnd(colonne);
console.log(`\nSCHEDA CARTA — ${misure.length} larghezze su ${base}\n`);
console.log(`${larghezza('VIEWPORT', 14)}${larghezza('GRIGLIA', 13)}${larghezza('MAZZI', 26)}${larghezza('TENDE', 12)}${larghezza('GESTI (drag)', 22)}SWIPE (coll | mazzo)`);
for (const m of misure) {
    const griglia = `${m.collection.cols}×${m.collection.cardW}px`;
    const mazzi = `${m.deck.layoutCols} col · ${m.deck.listDisplay} · ${m.deck.gridCols}×${m.deck.cards}`;
    const tende = m.sheet.enabled ? `${m.sheet.min.copy?.h}→${m.sheet.max.copy?.h}px` : 'assente';
    const g = m.sheet.gestures;
    const gesti = g ? `${g.passi.trascinamento.h} ${g.passi.rilascioSottoMeta}/${g.passi.rilascioSopraMeta}/${g.passi.tocco}` : '—';
    const sw = m.sheet.swipes;
    const iniziale = nome => (nome || '?').trim().charAt(0);
    const swipes = sw && sw.mazzoPartenza
        ? `${iniziale(sw.collezionePartenza)}${iniziale(sw.collezioneVerticale)}${iniziale(sw.collezioneOrizzontale)} | ${iniziale(sw.mazzoPartenza)}${iniziale(sw.mazzoDopo)}${iniziale(sw.mazzoDopo2)}`
        : '—';
    console.log(`${larghezza(`${m.w}x${m.h}`, 14)}${larghezza(griglia, 13)}${larghezza(mazzi, 26)}${larghezza(tende, 12)}${larghezza(gesti, 22)}${swipes}`);
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
    // A 320px le due colonne forzate lasciano 111px di carta: soglia a 100px, sotto la
    // quale la griglia sarebbe di fatto illeggibile su un telefono così stretto.
    const minimoCarta = m.w <= 360 ? 100 : 140;
    verifica(c.cardW >= minimoCarta, `${dove}: carte larghe solo ${c.cardW}px (minimo ${minimoCarta}px)`);
    verifica(c.gridW <= m.w + 2, `${dove}: griglia larga ${c.gridW}px su ${m.w}px`);
    verifica(c.cards >= 6, `${dove}: la griglia mostra ${c.cards} carte invece di 6`);

    // Colonne attese: telefono 2, tablet 3, orizzontale 4, desktop 6.
    if (m.w <= 650) verifica(c.cols === 2, `${dove}: attese 2 colonne, trovate ${c.cols}`);
    else if (m.w <= 900) {
        // In verticale il tablet deve stare su 3 colonne; in orizzontale la larghezza
        // in più può ospitarne 4, come accade a 844x390 con carte da 165px.
        if (m.h > m.w) verifica(c.cols === 3, `${dove}: attese 3 colonne in verticale, trovate ${c.cols}`);
        else verifica(c.cols >= 3 && c.cols <= 4, `${dove}: attese 3 o 4 colonne in orizzontale, trovate ${c.cols}`);
    }
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

    // Tessere e pulsanti devono essere cliccabili dopo essere stati portati in vista.
    const hit = m.hitComandi;
    if (!hit) {
        problemi.push(`${dove}: hit-test di tessere e mazzi mancante`);
    } else {
        for (const [nome, gruppo] of [
            ['tessere della collezione', hit.collezione],
            ['pulsanti dei mazzi', hit.mazzi],
            ['tessere del mazzo', hit.mazzoTessere]
        ]) {
            verifica(gruppo?.totale > 0, `${dove}: nessun elemento per le ${nome}`);
            for (const voce of gruppo?.campioni || []) {
                verifica(voce.ok, `${dove}: ${nome} #${voce.indice} coperta da ${voce.tag}`);
            }
        }
    }

    // Testo lungo: il corpo scorre, palco e tendina restano fermi.
    const lungo = m.testoLungo;
    if (!lungo) {
        problemi.push(`${dove}: testo lungo non misurato`);
    } else {
        verifica(lungo.chars >= 1000, `${dove}: testo di prova troppo corto (${lungo.chars} caratteri)`);
        if (m.sheet?.enabled) {
            verifica(lungo.bodyScrollH > lungo.bodyClientH + 40, `${dove}: con testo lungo il corpo non scorre (${lungo.bodyScrollH} contro ${lungo.bodyClientH})`);
            verifica(lungo.scrollTop > 0, `${dove}: lo scroll del corpo non si è mosso`);
            verifica(Math.abs(lungo.arteDelta) <= 1, `${dove}: l'arte si sposta di ${lungo.arteDelta}px scorrendo il testo`);
            verifica(Math.abs(lungo.copiaDelta) <= 1, `${dove}: la tendina si sposta di ${lungo.copiaDelta}px scorrendo il testo`);
            verifica(lungo.closeHit, `${dove}: chiudi non raggiungibile con testo lungo`);
            verifica(lungo.maxBodyScrollH >= lungo.maxBodyClientH, `${dove}: corpo aperto non misurabile`);
            verifica(lungo.maxArteY === lungo.primaArteY, `${dove}: l'arte si sposta aprendo la tendina con testo lungo`);
            // Sui tablet alti il testo di prova ci sta tutto: lì il corpo non deve
            // scorrere affatto. Dove invece avanza, deve arrivare in fondo senza
            // trascinare arte, tendina o pagina.
            if (lungo.maxBodyScrollH > lungo.maxBodyClientH + 40) {
                verifica(lungo.maxScrollTop > 50, `${dove}: con la tendina aperta il corpo non scorre fino in fondo (${lungo.maxScrollTop}px su ${lungo.maxBodyScrollH - lungo.maxBodyClientH} disponibili)`);
                verifica(Math.abs(lungo.maxArteDopoScroll - lungo.primaArteY) <= 1, `${dove}: scorrendo il corpo aperto l'arte si sposta di ${lungo.maxArteDopoScroll - lungo.primaArteY}px`);
                verifica(Math.abs(lungo.maxCopiaDopoScroll - lungo.maxCopiaY) <= 1, `${dove}: scorrendo il corpo aperto la tendina si sposta di ${lungo.maxCopiaDopoScroll - lungo.maxCopiaY}px`);
            } else {
                verifica(lungo.maxScrollTop === 0, `${dove}: un corpo che ci sta tutto non dovrebbe scorrere (${lungo.maxScrollTop}px)`);
            }
            verifica(Math.abs(lungo.paginaDelta) <= 1, `${dove}: lo scroll del corpo trascina la pagina di ${lungo.paginaDelta}px`);
            verifica(/contain/.test(lungo.overscroll || ''), `${dove}: overscroll «${lungo.overscroll}» sul corpo della tendina`);
            verifica(Math.abs(lungo.maxCopiaH - lungo.sogliaTendina) <= 2, `${dove}: aperta misura ${lungo.maxCopiaH}px invece di ${lungo.sogliaTendina}px con testo lungo`);
        } else {
            // Sopra i 1024px la tendina non esiste: il testo deve restare raggiungibile.
            const r = lungo.reachabile || {};
            verifica(r.modScroll || r.pagScroll, `${dove}: con testo lungo il testo non è raggiungibile (pannello ${r.modScrollH}/${r.modClientH}, pagina ${r.pagScrollH}/${r.pagClientH})`);
        }
    }

    if (m.w <= 1024) {
        // Tendina trascinabile: a riposo l'arte deve restare centrata nel palco.
        verifica(s.enabled, `${dove}: tendina disattivata a ${m.w}px`);
        verifica(s.min.art && s.min.copy, `${dove}: arte o tendina non misurate`);            if (s.min.art && s.min.copy) {
                if (m.spazioStretto) {
                    verifica(Math.abs(s.min.gapAbove - 8) <= 2, `${dove}: con altezza scarsa l'arte deve restare in alto a 8px, non a ${s.min.gapAbove}px`);
                } else {
                    verifica(Math.abs(s.min.gapAbove - s.min.gapBelow) <= 2, `${dove}: arte non centrata (${s.min.gapAbove}px sopra, ${s.min.gapBelow}px sotto)`);
                    verifica(s.min.gapAbove >= 40, `${dove}: arte incollata in alto (${s.min.gapAbove}px di margine)`);
                }
            verifica(Math.abs(parseFloat(s.min.varMin) - s.min.copy.h) <= 2, `${dove}: --mv-sheet-min ${s.min.varMin} contro tendina ${s.min.copy.h}px`);
            verifica(s.min.close && s.min.close.y >= 0 && s.min.close.y <= 20, `${dove}: comando chiudi a ${s.min.close?.y}px`);                verifica(s.min.close.y + s.min.close.h <= s.min.copy.y + 2, `${dove}: il chiudi finisce sotto la tendina`);
                verifica(s.min.hit?.ok, `${dove}: con la tendina a riposo il chiudi è coperto da ${s.min.hit?.tag || 'altro elemento'}`);
                verifica(s.min.grabHit?.ok, `${dove}: con la tendina a riposo la maniglia è coperta da ${s.min.grabHit?.tag || 'altro elemento'}`);
                verifica(s.min.browseHit?.ok, `${dove}: con la tendina a riposo la freccia di sfoglio è coperta da ${s.min.browseHit?.tag || 'altro elemento'}`);
        }
        // Aperta: la tendina arriva a 56px dal bordo e il corpo scorre.
        if (s.max.copy && s.max.close) {
            verifica(Math.abs(s.max.copy.h - (m.h - 56)) <= 2, `${dove}: tendina aperta ${s.max.copy.h}px invece di ${m.h - 56}px`);
            verifica(Math.abs(s.max.copy.y - 56) <= 2, `${dove}: tendina aperta lascia ${s.max.copy.y}px sopra invece di 56px`);
            verifica(s.max.close.y >= 0 && s.max.close.y + s.max.close.h <= s.max.copy.y + 2, `${dove}: chiudi coperto con la tendina aperta`);
            verifica(s.max.hit?.ok, `${dove}: con la tendina aperta il chiudi è coperto da ${s.max.hit?.tag || 'altro elemento'}`);
            verifica(s.max.comandi?.close?.min >= 32, `${dove}: chiudi largo solo ${s.max.comandi?.close?.min}px (minimo 32)`);
            verifica(s.max.grabHit?.ok, `${dove}: con la tendina aperta la maniglia è coperta da ${s.max.grabHit?.tag || 'altro elemento'}`);
            // La maniglia è un'area di trascinamento, non un pulsante: misura 26px di
            // altezza. Non le chiedo i 32px dei comandi, ma nemmeno la lascio libera:
            // 24px è il minimo di WCAG 2.5.8, sotto il quale diventa difficile da
            // afferrare col dito.
            verifica((s.max.comandi?.grab?.min ?? 0) >= 24, `${dove}: maniglia alta solo ${s.max.comandi?.grab?.min}px (minimo 24)`);
            verifica(s.max.browseHit?.ok, `${dove}: con la tendina aperta la freccia di sfoglio è coperta da ${s.max.browseHit?.tag || 'altro elemento'}`);
            verifica(s.max.comandi?.browse?.min >= 32, `${dove}: freccia di sfoglio larga solo ${s.max.comandi?.browse?.min}px (minimo 32)`);
            verifica(s.max.art && s.max.art.y === s.min.art?.y, `${dove}: l'arte si muove aprendo la tendina`);
            verifica(s.max.body && s.max.body.scrollH >= s.max.body.clientH, `${dove}: corpo della tendina non misurabile`);
        } else {
            problemi.push(`${dove}: tendina aperta non misurata`);
        }

        // I comandi devono essere toccabili, non solo visibili: un pulsante di
        // chiusura largo 18px passerebbe tutte le verifiche di hit esistenti.
        const comandiSotto32 = [];
        for (const [nome, gruppo] of Object.entries(m.hitComandi || {})) {
            for (const campione of (gruppo?.campioni || [])) {
                if (campione.ok && campione.min < 32) comandiSotto32.push(`${nome}[${campione.indice}] ${campione.min}px`);
            }
        }
        verifica(comandiSotto32.length === 0, `${dove}: comandi sotto i 32px: ${comandiSotto32.join(', ')}`);

        // Gesti simulati: inseguimento, aggancio sopra e sotto metà, tocco.
        const g = s.gestures;
        if (!g) {
            problemi.push(`${dove}: gesti della tendina non misurati`);
        } else {
            const tappa = 2;
            const t = g.passi.trascinamento;
            verifica(Math.abs(g.riposo - s.min.copy.h) <= tappa, `${dove}: tendina a riposo ${g.riposo}px invece di ${s.min.copy.h}px`);
            const attesoRiposo = Math.round(Math.min(320, Math.max(196, m.h * 0.36)));
            verifica(Math.abs(g.riposo - attesoRiposo) <= tappa, `${dove}: tendina a riposo ${g.riposo}px invece di ${attesoRiposo}px (36% dell'altezza, fra 196 e 320)`);
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

        // Swipe sull'arte: ordine del contesto (collezione o mazzo) e stop ai capi.
        const sw = s.swipes;
        if (!sw || !sw.mazzoPartenza) {
            problemi.push(`${dove}: swipe sull'arte non misurato (${sw?.collezionePartenza ?? 'nessuna carta'})`);
        } else {
            const atteso = (chiave, valore, etichetta) => verifica(sw[chiave] === valore, `${dove}: ${etichetta} porta a ${sw[chiave]} invece di ${valore}`);
            atteso('collezionePartenza', 'Alfa', 'la prima carta della collezione');
            atteso('collezioneVerticale', 'Bravo', 'lo swipe verticale in collezione');
            atteso('collezioneOrizzontale', 'Charlie', 'lo swipe orizzontale in collezione');
            atteso('collezioneIndietro', 'Bravo', 'lo swipe indietro in collezione');
            atteso('collezioneInizio', 'Alfa', 'il secondo swipe indietro in collezione');
            atteso('collezioneFermoInizio', 'Alfa', 'lo swipe indietro oltre la prima carta');
            atteso('mazzoPartenza', 'Delta', 'la carta aperta nel mazzo');
            atteso('mazzoDopo', 'Bravo', 'lo swipe nel mazzo (deve seguire il mazzo, non la collezione)');
            atteso('mazzoDopo2', 'Foxtrot', 'il secondo swipe nel mazzo');
            atteso('mazzoFermoFine', 'Foxtrot', 'lo swipe oltre la fine del mazzo');
            atteso('mazzoFermoFineOrizzontale', 'Foxtrot', 'lo swipe orizzontale oltre la fine del mazzo');
        }
    } else {
        // Sopra i 1024px la tendina non c'è: la scheda vive tutta nel modale, e
        // la promessa è che la carta si veda per intero senza scorrere nulla. Se
        // un giorno l'arte sfonda il bordo o il testo finisce sotto la piega, il
        // desktop torna a essere una scheda mutilata come sul telefono di prima.
        verifica(!s.enabled, `${dove}: tendina attiva anche su desktop`);
        verifica(s.min.inlineHeight === '', `${dove}: altezza inline ${s.min.inlineHeight} sulla tendina desktop`);
        const arte = s.min.art, testo = s.min.copy;
        if (!arte || !testo) {
            problemi.push(`${dove}: arte o testo della scheda non misurati`);
        } else {
            verifica(testo.h > 0, `${dove}: il testo della scheda è alto ${testo.h}px`);
            verifica(arte.y >= 0 && arte.y + arte.h <= m.h, `${dove}: la carta esce dalla viewport (${arte.y}→${arte.y + arte.h} su ${m.h}px)`);
            // Il margine di 8px è quello che il palco si tiene dal bordo: sotto
            // quella soglia la carta sembra incollata al vetro.
            verifica(arte.y >= 8, `${dove}: la carta parte a ${arte.y}px dal bordo`);
            verifica(testo.y >= 0 && testo.y + testo.h <= m.h, `${dove}: il testo esce dalla viewport (${testo.y}→${testo.y + testo.h} su ${m.h}px)`);
            verifica(s.min.hit?.ok, `${dove}: su desktop il chiudi è coperto da ${s.min.hit?.tag || 'altro elemento'}`);
        }
    }
}

if (problemi.length) {
    console.error('\nMisure fuori soglia:');
    for (const problema of problemi) console.error(`  ✗ ${problema}`);
    console.error(`\n${problemi.length} problemi.`);
    process.exit(1);
}

console.log('\nTutte le misure dentro le soglie.');
