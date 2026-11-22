#!/usr/bin/env node
/**
 * MISURA DEL MOCKUP DEL TAVOLO MAGIC
 *
 * Apre docs/mockups/magic-arena.html — alimentata da
 * scripts/fixtures/magic-view.json, cioè la stessa forma di engine/view.js — e
 * misura le soglie del tavolo prima di toccare l'interfaccia vera:
 *
 *  - barra comandi entro il 18% dell'altezza;
 *  - carte al minimo toccabile (44px telefono, 60px desktop);
 *  - nessun testo sotto i 10–11px e numeri critici almeno 16px;
 *  - striscia dei passi, indicatore di priorità e stack visibili e raggiungibili;
 *  - mano, zone e comando di turno raggiungibili con `elementFromPoint`;
 *  - modali di scelta (blocchi, bersagli) dentro lo schermo;
 *  - nessuno scorrimento orizzontale della pagina;
 *  - `prefers-reduced-motion: reduce` senza animazioni.
 *
 *   npm run test:mockup
 *   BASE=http://localhost:3000 npm run test:mockup
 *
 * Se la porta indicata non serve i sorgenti parte un Vite temporaneo (come gli
 * altri test di misura). Gli screenshot finiscono in output/mockup/.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serveSorgenti, serverTemporaneo } from './lib/dev-server.mjs';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = process.env.AGENT_BROWSER || 'agent-browser';
const sessione = `magic-mockup-${process.pid}`;
let base = (process.env.BASE || '').replace(/\/+$/, '');

const PAGINA = '/docs/mockups/magic-arena.html';
const USCITA = join(radice, 'output', 'mockup');

// Soglie del mockup (px CSS e frazioni). Il numero nasce dalle regole del
// tavolo già misurate: sotto questi valori la carta non si legge o il comando
// non si tocca.
const SOGLIE = {
    barra: 0.18,        // barra comandi / altezza del tavolo
    etichetta: 10,      // nomi sulle carte e etichette delle corsie
    pulsante: 11,       // testo dei comandi
    numero: 16,         // turno, vita e numeri critici
    scartoModale: 2     // tolleranza sui bordi della modale
};

const VISTE = [
    { nome: 'desktop', w: 1280, h: 800, carta: 60, touch: false, screenshot: true },
    { nome: 'telefono orizzontale', w: 844, h: 390, carta: 44, touch: true, screenshot: true },
    { nome: 'telefono verticale', w: 390, h: 844, carta: 44, touch: true, screenshot: true }
];

// Base serve a tutte le misure; gli altri stati verificano stack and modali.
const STATI = ['base', 'stack', 'blocchi', 'bersagli', 'mana'];

/* ── server di sviluppo ───────────────────────────────────────────────────── */

const server = serverTemporaneo({ radice, portaIniziale: 4340 });

/* ── browser e CDP ────────────────────────────────────────────────────────── */

const esegui = (...argomenti) => {
    try {
        return execFileSync(browser, ['--session', sessione, ...argomenti], {
            cwd: radice, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']
        });
    } catch (errore) {
        const dettaglio = String(errore.stderr || errore.message || '').trim().split('\n').slice(-2).join(' ');
        throw new Error(`${browser} ${argomenti[0]} non riuscito: ${dettaglio}`);
    }
};

const chiudiBrowser = () => {
    try { esegui('close'); } catch { /* nessuna sessione aperta */ }
};

const apriBrowser = url => {
    esegui('open', url);
    const cdp = esegui('get', 'cdp-url').trim();
    if (!cdp.startsWith('ws')) throw new Error(`indirizzo CDP inatteso: ${cdp}`);
    return cdp;
};

const collegaCdp = async url => {
    if (typeof WebSocket !== 'function') throw new Error('Node senza WebSocket globale: serve Node 22 o superiore');
    const ws = new WebSocket(url);
    const attesa = new Map();
    let sequenza = 0;
    ws.addEventListener('message', evento => {
        const messaggio = JSON.parse(evento.data);
        const pendente = messaggio.id && attesa.get(messaggio.id);
        if (!pendente) return;
        attesa.delete(messaggio.id);
        if (messaggio.error) pendente.no(new Error(JSON.stringify(messaggio.error)));
        else pendente.si(messaggio.result);
    });
    await new Promise((risolvi, rifiuta) => {
        ws.addEventListener('open', risolvi, { once: true });
        ws.addEventListener('error', () => rifiuta(new Error('connessione CDP rifiutata')), { once: true });
    });
    const invia = (metodo, parametri = {}, sessionId) => new Promise((si, no) => {
        const id = ++sequenza;
        attesa.set(id, { si, no });
        ws.send(JSON.stringify({ id, method: metodo, params: parametri, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetInfos } = await invia('Target.getTargets');
    const pagina = targetInfos.find(t => t.type === 'page' && t.url.startsWith('http'));
    if (!pagina) throw new Error('nessuna scheda aperta nel browser');
    const { sessionId } = await invia('Target.attachToTarget', { targetId: pagina.targetId, flatten: true });
    await invia('Page.enable', {}, sessionId);
    await invia('Runtime.enable', {}, sessionId);
    return {
        invia: (metodo, parametri) => invia(metodo, parametri, sessionId),
        valuta: async espressione => {
            const esito = await invia('Runtime.evaluate', {
                expression: espressione, awaitPromise: true, returnByValue: true
            }, sessionId);
            if (esito.exceptionDetails) {
                const dettaglio = esito.exceptionDetails.exception?.description
                    || esito.exceptionDetails.text || 'errore nella pagina';
                throw new Error(dettaglio.split('\n')[0]);
            }
            return esito.result.value;
        },
        chiudi: () => { try { ws.close(); } catch { /* già chiusa */ } }
    };
};

const emula = async (cdp, vista) => {
    await cdp.invia('Emulation.setDeviceMetricsOverride', {
        width: vista.w, height: vista.h, deviceScaleFactor: vista.touch ? 2 : 1, mobile: vista.touch,
        screenWidth: vista.w, screenHeight: vista.h,
        screenOrientation: { type: vista.w > vista.h ? 'landscapePrimary' : 'portraitPrimary', angle: vista.w > vista.h ? 90 : 0 }
    });
    await cdp.invia('Emulation.setTouchEmulationEnabled', { enabled: vista.touch, maxTouchPoints: vista.touch ? 5 : 1 });
    await cdp.invia('Emulation.setEmulatedMedia', {
        features: [
            { name: 'pointer', value: vista.touch ? 'coarse' : 'fine' },
            { name: 'hover', value: vista.touch ? 'none' : 'hover' },
            { name: 'prefers-reduced-motion', value: 'no-preference' }
        ]
    });
};

// Dopo `Page.navigate` la pagina vecchia può rispondere ancora per un istante:
// aspettare solo `__mockupReady` rischia di misurare il documento precedente.
const attendiStato = (cdp, stato) => attendi(cdp,
    `Boolean(window.__mockupReady) && document.querySelector('.arena')?.dataset.state === '${stato}'`);

const attendi = async (cdp, espressione, tentativi = 80) => {
    for (let tentativo = 0; tentativo < tentativi; tentativo++) {
        try { if (await cdp.valuta(espressione)) return true; } catch { /* pagina in caricamento */ }
        await new Promise(risolvi => setTimeout(risolvi, 100));
    }
    return false;
};

/* ── controlli ────────────────────────────────────────────────────────────── */

const controlla = (misura, vista) => {
    const problemi = [];
    const segnala = testo => problemi.push(`${vista.nome} · ${misura.state}: ${testo}`);

    if (misura.barRatio === null) segnala('barra comandi non trovata');
    else if (misura.barRatio > SOGLIE.barra) segnala(`barra comandi al ${Math.round(misura.barRatio * 100)}% dell'altezza (max ${SOGLIE.barra * 100}%)`);

    for (const [dove, valore] of Object.entries({
        campo: misura.cards.boardMin, mano: misura.cards.handMin
    })) {
        if (valore === null) { segnala(`carte in ${dove} non trovate`); continue; }
        if (valore + 0.5 < vista.carta) segnala(`carta più stretta in ${dove}: ${Math.round(valore)}px (minimo ${vista.carta}px)`);
    }

    if ((misura.fonts.name ?? 0) < SOGLIE.etichetta) segnala(`nome carta a ${misura.fonts.name}px (minimo ${SOGLIE.etichetta})`);
    if ((misura.fonts.label ?? 0) < SOGLIE.etichetta) segnala(`etichetta corsia a ${misura.fonts.label}px (minimo ${SOGLIE.etichetta})`);
    if ((misura.fonts.button ?? 0) < SOGLIE.pulsante) segnala(`testo dei comandi a ${misura.fonts.button}px (minimo ${SOGLIE.pulsante})`);
    if ((misura.fonts.meta ?? 0) < SOGLIE.numero) segnala(`numero critico a ${misura.fonts.meta}px (minimo ${SOGLIE.numero})`);

    if (!misura.phasesVisible) segnala('striscia dei passi fuori dallo schermo');
    if (!misura.stackVisible) segnala('stack non visibile');
    // Con una modale aperta il fondo è deliberatamente inerte: si controlla che
    // la modale stia sopra ai comandi, non che i comandi rispondano.
    if (misura.choice) {
        if (!misura.modalOnTop) segnala('la modale non copre i comandi: si potrebbe giocare sotto');
    } else {
        if (!misura.phaseActiveReachable) segnala('passo corrente non raggiungibile');
        if (!misura.commandReachable) segnala('comando di turno non raggiungibile');
        if (!misura.handReachable) segnala('carta in mano non raggiungibile');
        if (!misura.zonesReachable) segnala('chip delle zone non raggiungibile');
    }

    if (misura.state === 'stack' && misura.stackCount < 2) segnala(`stack con ${misura.stackCount} voci invece di 2`);
    if (['blocchi', 'bersagli'].includes(misura.state)) {
        if (!misura.choice) segnala('modale di scelta assente');
        else if (!misura.choice.visible) segnala('modale di scelta fuori dallo schermo');
        else if (!misura.choice.fits) segnala(`modale ${misura.choice.w}×${misura.choice.h} più grande dello schermo`);
    }
    if (misura.overflowX) segnala('scorrimento orizzontale della pagina');
    // Contratto: la UI non inventa comandi, ognuno è una mossa del motore.
    const legali = new Set(misura.legalIds || []);
    const orfani = [...new Set((misura.actions || []).filter(id => !legali.has(id)))];
    if (orfani.length) segnala(`comandi senza mossa legale: ${orfani.join(', ')}`);
    return problemi;
};

/* ── giro di misura ───────────────────────────────────────────────────────── */

const esito = async () => {
    if (!base) {
        if (await serveSorgenti('http://localhost:3000')) base = 'http://localhost:3000';
        else base = await server.avvia();
    } else if (!(await serveSorgenti(base))) {
        base = await server.avvia();
    }
    console.log(`MOCKUP TAVOLO — ${base}${PAGINA}`);

    const cdp = await collegaCdp(apriBrowser(`${base}${PAGINA}`));
    const righe = [];
    const problemi = [];
    try {
        for (const vista of VISTE) {
            await emula(cdp, vista);
            for (const stato of STATI) {
                const url = `${base}${PAGINA}?stato=${stato}`;
                await cdp.invia('Page.navigate', { url });
                const pronto = await attendiStato(cdp, stato);
                if (!pronto) { problemi.push(`${vista.nome} · ${stato}: la pagina non si è caricata`); continue; }
                // Un respiro per il layout dopo il fetch della fixture.
                await new Promise(risolvi => setTimeout(risolvi, 120));
                const misura = await cdp.valuta('window.__mockupMetrics()');
                righe.push({
                    vista: vista.nome, stato, w: vista.w, h: vista.h,
                    barra: misura.barRatio, campo: misura.cards.boardMin, mano: misura.cards.handMin,
                    stack: misura.stackCount, modale: misura.choice ? `${misura.choice.w}×${misura.choice.h}` : '—'
                });
                problemi.push(...controlla(misura, vista));

                // Due stati per la revisione visiva: il tavolo e una modale di
                // scelta, che è il punto in cui il layout rischia di più.
                if (vista.screenshot && ['base', 'blocchi'].includes(stato)) {
                    const cattura = await cdp.invia('Page.captureScreenshot', { format: 'png' });
                    mkdirSync(USCITA, { recursive: true });
                    const file = join(USCITA, `magic-arena-${vista.w}x${vista.h}-${stato}.png`);
                    writeFileSync(file, Buffer.from(cattura.data, 'base64'));
                    console.log(`  screenshot: ${file.replace(radice + '/', '')}`);
                }
            }

            // Movimento ridotto: la pagina non deve animare nulla.
            await cdp.invia('Emulation.setEmulatedMedia', {
                features: [
                    { name: 'pointer', value: vista.touch ? 'coarse' : 'fine' },
                    { name: 'prefers-reduced-motion', value: 'reduce' }
                ]
            });
            await cdp.invia('Page.navigate', { url: `${base}${PAGINA}?stato=base` });
            await attendiStato(cdp, 'base');
            const quieto = await cdp.valuta('window.__mockupMetrics()');
            if (!quieto.reducedMotion) problemi.push(`${vista.nome}: prefers-reduced-motion non applicato`);
            await emula(cdp, vista);
        }
    } finally {
        cdp.chiudi();
    }

    console.table(righe.map(riga => ({
        viewport: `${riga.w}×${riga.h}`, stato: riga.stato,
        'barra %': riga.barra === null ? '—' : Math.round(riga.barra * 100),
        'carta campo': riga.campo === null ? '—' : Math.round(riga.campo),
        'carta mano': riga.mano === null ? '—' : Math.round(riga.mano),
        stack: riga.stack, modale: riga.modale
    })));

    if (problemi.length) {
        console.error('\nMisure fuori soglia:');
        for (const problema of problemi) console.error(`  ✗ ${problema}`);
        process.exitCode = 1;
        return;
    }
    console.log('Tutte le misure del mockup sono dentro le soglie.');
};

try {
    await esito();
} catch (errore) {
    console.error(`Misura del mockup non riuscita: ${errore.message}`);
    process.exitCode = 1;
} finally {
    chiudiBrowser();
    await server.ferma();
}
