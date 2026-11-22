#!/usr/bin/env node
/**
 * MISURA DEL TAVOLO MAGIC SU TELEFONO TOUCH
 *
 * Apre una partita contro il Bot e misura il tavolo a tre misure di telefono,
 * emulando un dispositivo touch (`pointer: coarse`, touch a 5 punti, viewport
 * mobile): con il puntatore fine il tavolo diventa un riquadro 16:9 e le regole
 * da telefono non entrano in gioco, quindi senza emulazione il test misurerebbe
 * un'altra cosa.
 *
 *   npm run test:table
 *   BASE=http://localhost:3000 npm run test:table
 *
 * Se la porta indicata non serve i sorgenti (tipico con `npm run serve`, che
 * espone la build statica) il test si accende un Vite suo su una porta libera e
 * lo spegne all'uscita.
 *
 * Esce con codice 1 se, a una delle misure:
 *  - il tavolo non occupa tutto lo schermo (regole desktop finite in produzione);
 *  - nel mulligan non si vedono tutte e sette le carte o i pulsanti «Tieni» e
 *    «Rimescola e pesca» finiscono fuori dallo schermo (a 667×375 la mano
 *    scorreva in due colonne e mostrava tre carte su sette);
 *  - una carta del campo scende sotto la soglia di leggibilità o viene tagliata
 *    dal bordo del suo campo;
 *  - una carta in mano o il suo pulsante scendono sotto soglia;
 *  - un elemento esce dal tavolo senza essere dentro un contenitore che scorre;
 *  - nel combattimento (attacco, blocco, richiesta di scarto) pulsanti, tendine
 *    o carte escono dallo schermo o scendono sotto le stesse soglie;
 *  - avviso, riga comandi o selettore del bersaglio non stanno nella barra.
 *
 * Il mazzo è finto ma valido per il Commander (100 carte, comandante bianco,
 * terre base ripetute) e viene scritto in localStorage: il test non dipende da
 * account, Supabase o Scryfall, così può girare offline.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serveSorgenti, serverTemporaneo } from './lib/dev-server.mjs';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = process.env.AGENT_BROWSER || 'agent-browser';
const sessione = `magic-table-${process.pid}`;
let base = (process.env.BASE || '').replace(/\/+$/, '');

// Soglie: sotto questi pixel le carte non si leggono più (numeri in px CSS).
const SOGLIE = {
    cartaCampo: 96,     // carta permanente nel campo: 80x112 a 844x390, 77x108 a 667x375
    cartaMano: 96,      // carta in mano
    pulsanteMano: 32,   // pulsante sotto la carta in mano (36 sul telefono in orizzontale)
    pulsanteMulligan: 32, // «Tieni» e «Rimescola e pesca» (40 e 48 sul telefono)
    pulsanteCombattimento: 32, // «Dichiara attaccanti», «Conferma blocchi», «Scarta»
    chipCarta: 24,      // «Attacca» e «Mana» stanno sopra l'arte di una carta da 108px
    tendina: 28,        // tendine del bersaglio e dei bloccanti
    scarto: 2           // tolleranza per arrotondamenti dei subpixel
};

const MISURE = [
    { nome: 'telefono orizzontale', w: 844, h: 390 },
    { nome: 'telefono piccolo orizzontale', w: 667, h: 375 },
    { nome: 'telefono verticale', w: 390, h: 844 }
];

// Combattimento: uno scenario per schermata, ognuno in una partita nuova.
const SCENARI = ['attacco', 'blocco', 'scarto'];

/* ── server di sviluppo ───────────────────────────────────────────────────── */

// Il Vite temporaneo (libreria condivisa) parte solo se BASE non serve i sorgenti.
const server = serverTemporaneo({ radice, portaIniziale: 4320 });

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

// Client CDP minimo: serve solo a emulare il telefono e a leggere il DOM.
const collegaCdp = async url => {
    if (typeof WebSocket !== 'function') {
        throw new Error('Node senza WebSocket globale: aggiorna a Node 22 o superiore');
    }
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
        valuta: async (espressione) => {
            const esito = await invia('Runtime.evaluate', {
                expression: espressione, awaitPromise: true, returnByValue: true
            }, sessionId);
            if (esito.exceptionDetails) throw new Error(esito.exceptionDetails.text || 'errore nella pagina');
            return esito.result.value;
        },
        chiudi: () => { try { ws.close(); } catch { /* già chiusa */ } }
    };
};

const emulaTelefono = (cdp, { w, h }) => cdp.invia('Emulation.setDeviceMetricsOverride', {
    width: w, height: h, deviceScaleFactor: 2, mobile: true, screenWidth: w, screenHeight: h,
    screenOrientation: { type: w > h ? 'landscapePrimary' : 'portraitPrimary', angle: w > h ? 90 : 0 }
});

// Le media feature non si possono forzare dal CSS: qui si dichiara che il
// puntatore è un dito, così valgono le regole `(pointer: coarse)`.
const emulaTocco = async cdp => {
    await cdp.invia('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.invia('Emulation.setEmulatedMedia', {
        features: [
            { name: 'pointer', value: 'coarse' },
            { name: 'any-pointer', value: 'coarse' },
            { name: 'hover', value: 'none' }
        ]
    });
};

/* ── mazzo di prova ───────────────────────────────────────────────────────── */

// Arte segnaposto: SVG inline con lo stesso rapporto delle carte vere, così le
// misure non dipendono dalla rete.
const ARTE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='488' height='680'%3E%3Crect width='488' height='680' fill='%23241a38'/%3E%3C/svg%3E";

const carta = (id, nome, typeLine, extra = {}) => ({
    id, name: nome, typeLine, image: ARTE, manaCost: extra.manaCost || '',
    oracleText: extra.oracleText || '', power: extra.power ?? '', toughness: extra.toughness ?? '',
    keywords: extra.keywords || [], colors: extra.colors || [], colorIdentity: extra.colorIdentity || [],
    cmc: extra.cmc || 0, producedMana: extra.producedMana || [], rarity: 'common', set: 'prova'
});

const MAZZO_PROVA = () => {
    const commander = carta('prova-comandante', 'Angelo della Prova', 'Creature — Angel', {
        manaCost: '{3}{W}{W}', power: '3', toughness: '4', keywords: ['Flying'],
        colors: ['W'], colorIdentity: ['W'], cmc: 5,
        oracleText: 'Flying\nQuando questa creatura entra, guadagni 2 punti vita.'
    });
    const terra = carta('prova-pianura', 'Pianura', 'Basic Land — Plains', {
        colorIdentity: ['W'], producedMana: ['W'], oracleText: '{T}: Add {W}.'
    });
    // 38 creature diverse (una copia ciascuna) + 61 terre base + comandante = 100.
    // Creature da un mana: con una terra si evoca subito e il combattimento
    // arriva al secondo turno invece che al quinto.
    const creature = Array.from({ length: 38 }, (_, indice) => carta(`prova-creatura-${indice}`, `Angelo ${indice + 1}`, 'Creature — Angel', {
        manaCost: '{W}', power: '1', toughness: '1',
        colors: ['W'], colorIdentity: ['W'], cmc: 1, oracleText: 'Flying'
    }));
    const collezione = [commander, terra, ...creature];
    const mazzo = {
        id: 'prova-mazzo', name: 'Mazzo di prova', isPublic: false,
        commanders: [commander.id],
        cards: [
            { cardId: terra.id, quantity: 61 },
            ...creature.map(c => ({ cardId: c.id, quantity: 1 }))
        ]
    };
    // La cache dei dettagli evita la richiesta a Scryfall: hydrateCards la usa
    // quando ha già immagine, forza e parole chiave.
    const cache = Object.fromEntries(collezione.map(c => [c.id, {
        power: c.power, toughness: c.toughness, keywords: c.keywords, colors: c.colors,
        colorIdentity: c.colorIdentity, producedMana: c.producedMana, cmc: c.cmc,
        typeLine: c.typeLine, manaCost: c.manaCost, oracleText: c.oracleText, name: c.name, image: c.image
    }]));
    return { collezione, mazzo, cache };
};

const scriviMazzo = async cdp => {
    const { collezione, mazzo, cache } = MAZZO_PROVA();
    const esito = await cdp.valuta(`(() => {
        localStorage.setItem('taverna_magic_collection_v1', ${JSON.stringify(JSON.stringify(collezione))});
        localStorage.setItem('taverna_magic_decks_v1', ${JSON.stringify(JSON.stringify([mazzo]))});
        localStorage.setItem('taverna_magic_card_details_v1', ${JSON.stringify(JSON.stringify(cache))});
        localStorage.setItem('taverna_magic_match_deck', ${JSON.stringify(mazzo.id)});
        return JSON.parse(localStorage.getItem('taverna_magic_decks_v1')).length;
    })()`);
    if (esito !== 1) throw new Error(`mazzo di prova non salvato (mazzi: ${esito})`);
};

/* ── misura dentro la pagina ──────────────────────────────────────────────── */

// Avvia la partita, misura il mulligan, tiene la mano e gioca una terra, così
// nel campo c'è almeno una carta da misurare. Restituisce una stringa JSON.
// Il mulligan si misura prima di tenerlo: è lì che si sceglie cosa mettere in
// fondo, e le sette carte devono stare tutte visibili insieme.
const MISURA = `(async () => {
    const attendi = ms => new Promise(r => setTimeout(r, ms));
    const q = s => document.querySelector(s);
    const arrotonda = n => Math.round(n);
    const riquadro = el => { if (!el) return null; const b = el.getBoundingClientRect();
        return { x: arrotonda(b.x), y: arrotonda(b.y), w: arrotonda(b.width), h: arrotonda(b.height), r: arrotonda(b.right), b: arrotonda(b.bottom) }; };

    // Durante il mulligan la mano è .mp-hand, sorella del pannello e non
    // figlia: sono proprio le regole CSS su .mp-hand a decidere quante carte
    // entrano nello schermo.
    for (let i = 0; i < 25 && !q('[data-start-bot]') && !q('.mp-mulligan') && !q('.mt-hand'); i++) await attendi(400);
    if (!q('.mp-mulligan') && !q('.mt-hand')) q('[data-start-bot]')?.click();
    for (let i = 0; i < 40 && !q('.mp-mulligan') && !q('.mt-hand'); i++) await attendi(400);
    for (let i = 0; i < 25 && !q('.mp-hand .mp-hand-card'); i++) await attendi(300);

    // Una carta è «visibile» quando sta dentro la finestra della mano: il
    // getBoundingClientRect non tiene conto del ritaglio, quindi si confronta
    // con il riquadro del contenitore, non con la sua dimensione dichiarata.
    let mulligan = null;
    const pannello = q('.mp-mulligan');
    if (pannello) {
        const finestraMano = q('.mp-hand')?.getBoundingClientRect() || null;
        const carteMulligan = [...document.querySelectorAll('.mp-hand .mp-hand-card')];
        const dentro = (r, c) => r.top >= c.top - 1 && r.bottom <= c.bottom + 1 && r.left >= c.left - 1 && r.right <= c.right + 1;
        const nelloSchermo = el => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1;
        };
        mulligan = {
            pannello: riquadro(pannello),
            carta: riquadro(carteMulligan[0]),
            carte: carteMulligan.length,
            visibili: finestraMano ? carteMulligan.filter(carta => dentro(carta.getBoundingClientRect(), finestraMano)).length : 0,
            tenere: riquadro(q('[data-mulligan="keep"]')),
            rimescola: riquadro(q('[data-mulligan="redraw"]')),
            tenereInSchermo: nelloSchermo(q('[data-mulligan="keep"]')),
            rimescolaInSchermo: nelloSchermo(q('[data-mulligan="redraw"]')),
            overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            altezzaDocumento: document.documentElement.scrollHeight
        };
    }

    q('[data-mulligan="keep"]')?.click();
    for (let i = 0; i < 40 && !q('.mt-hand .mt-card'); i++) await attendi(300);

    const terraInMano = () => [...document.querySelectorAll('.mt-hand [data-play]')]
        .find(b => /Gioca terra/i.test(b.textContent) && !b.disabled);
    let terra = terraInMano();
    for (let giro = 0; giro < 6 && !terra; giro++) {
        q('[data-phase="next"]')?.click();
        await attendi(4500);
        terra = terraInMano();
    }
    terra?.click();
    await attendi(1200);

    const tavolo = q('.mt-table');
    if (!tavolo) return JSON.stringify({ errore: 'tavolo non montato', avviso: q('.mp-notice')?.textContent || '' });

    const campo = q('.mt-field--own');
    const barra = q('.mt-commands');
    const mano = q('.mt-hand');
    const cartaCampo = campo?.querySelector('.mt-card') || null;
    const cartaMano = mano?.querySelector('.mt-card') || null;
    const pulsanteMano = cartaMano?.querySelector('.mt-card__actions button') || null;
    const dentroBarra = el => {
        if (!el || !barra) return null;
        const r = el.getBoundingClientRect(); const c = barra.getBoundingClientRect();
        return r.top >= c.top - 2 && r.bottom <= c.bottom + 2;
    };
    const riquadroTavolo = tavolo.getBoundingClientRect();

    // Fuori dal tavolo: si ignorano gli elementi che un contenitore scorrevole
    // ritaglia di proposito (mano e riga comandi scorrono in orizzontale).
    const ritagliato = el => {
        for (let p = el.parentElement; p && p !== tavolo; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (/(auto|scroll|hidden)/.test(s.overflowX + s.overflowY)) return true;
        }
        return false;
    };
    const fuori = [];
    for (const el of tavolo.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.05) continue;
        const esce = r.left < riquadroTavolo.left - 2 || r.top < riquadroTavolo.top - 2
            || r.right > riquadroTavolo.right + 2 || r.bottom > riquadroTavolo.bottom + 2;
        if (!esce || ritagliato(el)) continue;
        const nome = typeof el.className === 'string' && el.className.trim()
            ? '.' + el.className.trim().split(/\\s+/)[0] : el.tagName.toLowerCase();
        fuori.push(nome + ' ' + riquadro(el).w + 'x' + riquadro(el).h + ' @' + riquadro(el).x + ',' + riquadro(el).y);
        if (fuori.length >= 6) break;
    }

    return JSON.stringify({
        mulligan,
        vp: innerWidth + 'x' + innerHeight,
        coarse: matchMedia('(pointer: coarse)').matches,
        fine: matchMedia('(pointer: fine)').matches,
        tavolo: riquadro(tavolo),
        barra: riquadro(q('.mt-arena-bar')),
        campo: riquadro(campo),
        cartaCampo: riquadro(cartaCampo),
        cartaCampoDentro: (() => {
            if (!cartaCampo || !campo) return null;
            const c = cartaCampo.getBoundingClientRect(); const f = campo.getBoundingClientRect();
            return c.top >= f.top - 2 && c.bottom <= f.bottom + 2;
        })(),
        comandi: riquadro(barra),
        avvisoVisibile: dentroBarra(q('.mt-commands .mp-notice')),
        comandiVisibili: dentroBarra(q('.mt-commands .mp-toolbar')),
        bersaglioVisibile: dentroBarra(q('.mt-commands .mp-target')),
        mano: riquadro(mano),
        cartaMano: riquadro(cartaMano),
        pulsanteMano: riquadro(pulsanteMano),
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        altezzaDocumento: document.documentElement.scrollHeight,
        fuori
    });
})()`;

/* ── combattimento ────────────────────────────────────────────────────────── */

// Guidare la partita fino a una schermata di combattimento richiede turni veri:
// si gioca una terra, si evoca una creatura da un mana e si lasciano agire i
// due giocatori finché la schermata non compare. Ogni scenario parte da una
// partita nuova perché mano e campo devono essere diversi.
const COMBATTIMENTO = scenario => `(async () => {
    const SCENARIO = ${JSON.stringify(scenario)};
    const attendi = ms => new Promise(r => setTimeout(r, ms));
    const q = s => document.querySelector(s);
    const arrotonda = n => Math.round(n);
    const riquadro = el => { if (!el) return null; const b = el.getBoundingClientRect();
        return { x: arrotonda(b.x), y: arrotonda(b.y), w: arrotonda(b.width), h: arrotonda(b.height), r: arrotonda(b.right), b: arrotonda(b.bottom) }; };

    for (let i = 0; i < 25 && !q('[data-start-bot]') && !q('.mp-mulligan') && !q('.mt-hand'); i++) await attendi(400);
    if (!q('.mp-mulligan') && !q('.mt-hand')) q('[data-start-bot]')?.click();
    for (let i = 0; i < 40 && !q('.mp-mulligan') && !q('.mt-hand'); i++) await attendi(400);
    q('[data-mulligan="keep"]')?.click();
    for (let i = 0; i < 40 && !q('[data-phase]'); i++) await attendi(300);

    const fase = () => q('[data-phase]');
    const mioTurno = async (limite = 30000) => {
        const inizio = Date.now();
        while (Date.now() - inizio < limite) { if (fase()) return true; await attendi(250); }
        return false;
    };
    const premi = async (pausa = 900) => { fase()?.click(); await attendi(pausa); };
    const inMano = testo => [...document.querySelectorAll('[data-play]')]
        .find(bottone => bottone.textContent.toLowerCase().includes(testo) && !bottone.disabled);
    const giocaTerra = () => { const b = inMano('gioca terra'); b?.click(); return Boolean(b); };
    const evoca = () => { const b = inMano('lancia'); b?.click(); return Boolean(b); };
    const attesa = async (selettore, limite = 30000) => {
        const inizio = Date.now();
        while (Date.now() - inizio < limite) { if (q(selettore)) return true; await attendi(300); }
        return false;
    };

    let raggiunta = true;
    if (SCENARIO === 'attacco') {
        await mioTurno();
        giocaTerra(); await attendi(500);
        evoca(); await attendi(900);
        await premi();                  // chiude il primo turno
        await mioTurno();               // la creatura non ha più la debolezza
        await attendi(400);
        await premi();                  // il turno si ferma al combattimento
        raggiunta = await attesa('.mp-combat [data-declare-attack]');
    } else if (SCENARIO === 'blocco') {
        await mioTurno();
        giocaTerra(); await attendi(500);
        evoca(); await attendi(900);
        await premi();                  // primo turno
        await mioTurno();
        await attendi(300);
        await premi();                  // combattimento mio: non attacco
        await premi(1400);              // «Non attaccare»
        raggiunta = await attesa('[data-block]');   // il bot attacca, tocca a me bloccare
    } else {
        await mioTurno();
        await premi();                  // primo turno senza giocare nulla
        await mioTurno();               // pesco l'ottava carta
        await attendi(400);
        await premi();                  // fine turno: prima si scarta
        raggiunta = await attesa('[data-confirm-discard]');
    }

    // I pulsanti «Attacca» stanno sulle carte in campo, il resto nel pannello:
    // si prendono da tutta la pagina, altrimenti la carta non si misura.
    const SELETTORI = {
        attacco: '[data-attacker], [data-declare-attack], #play-defender',
        blocco: '[data-block], [data-declare-block]',
        scarto: '[data-discard], [data-confirm-discard]'
    };
    // Quanto di un elemento si vede davvero: il riquadro si interseca con
    // ogni contenitore che ritaglia (mano e comandi scorrono, i pulsanti delle
    // carte stanno dentro un riquadro con overflow nascosto) e con lo schermo.
    const visibileDi = el => {
        const r = el.getBoundingClientRect();
        let alto = r.top, sinistra = r.left, basso = r.bottom, destra = r.right;
        // Un ritaglio dentro un contenitore che scorre si recupera scorrendo:
        // solo quello dentro un contenitore fermo rende l'elemento irraggiungibile.
        let bloccatoY = false, bloccatoX = false;
        for (let p = el.parentElement; p; p = p.parentElement) {
            const stile = getComputedStyle(p);
            const c = p.getBoundingClientRect();
            const scorreY = (stile.overflowY === 'auto' || stile.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 1;
            const scorreX = (stile.overflowX === 'auto' || stile.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1;
            if (stile.overflowY !== 'visible') {
                if (r.bottom > c.bottom + 1 || r.top < c.top - 1) bloccatoY = bloccatoY || !scorreY;
                alto = Math.max(alto, c.top); basso = Math.min(basso, c.bottom);
            }
            if (stile.overflowX !== 'visible') {
                if (r.right > c.right + 1 || r.left < c.left - 1) bloccatoX = bloccatoX || !scorreX;
                sinistra = Math.max(sinistra, c.left); destra = Math.min(destra, c.right);
            }
        }
        alto = Math.max(alto, 0); sinistra = Math.max(sinistra, 0);
        basso = Math.min(basso, innerHeight); destra = Math.min(destra, innerWidth);
        return { w: arrotonda(Math.max(0, destra - sinistra)), h: arrotonda(Math.max(0, basso - alto)), bloccatoX, bloccatoY };
    };
    const catena = el => {
        const nomi = [];
        let cassetto = null;
        for (let p = el.parentElement; p && nomi.length < 5; p = p.parentElement) {
            const classe = typeof p.className === 'string' ? p.className.trim().split(' ')[0] : '';
            nomi.push(classe || p.tagName.toLowerCase());
            const stile = getComputedStyle(p);
            if (!cassetto && stile.overflowX !== 'visible') {
                const c = p.getBoundingClientRect();
                cassetto = classe + ' ' + arrotonda(c.x) + ',' + arrotonda(c.y) + ' ' + arrotonda(c.width) + 'x' + arrotonda(c.height)
                    + ' ovf ' + stile.overflowX + '/' + stile.overflowY;
            }
        }
        return nomi.join(' < ') + ' | ' + (cassetto || 'senza ritagli');
    };
    const elementi = [...document.querySelectorAll(SELETTORI[SCENARIO])].map(el => {
        const r = el.getBoundingClientRect();
        const stile = getComputedStyle(el);
        const visibile = visibileDi(el);
        return {
            tipo: el.tagName.toLowerCase(),
            testo: String(el.textContent || el.selectedOptions?.[0]?.textContent || '').trim().slice(0, 28),
            w: arrotonda(r.width), h: arrotonda(r.height), x: arrotonda(r.x), y: arrotonda(r.y),
            visibileW: visibile.w, visibileH: visibile.h,
            bloccatoX: visibile.bloccatoX, bloccatoY: visibile.bloccatoY,
            catena: catena(el),
            diagnosi: (() => {
                const stile = getComputedStyle(el);
                const padre = el.parentElement;
                const sp = padre ? getComputedStyle(padre) : null;
                return 'io ' + arrotonda(r.x) + ',' + arrotonda(r.y) + ' ' + arrotonda(r.width) + 'x' + arrotonda(r.height)
                    + ' flex ' + stile.flex + ' min ' + stile.minInlineSize
                    + (padre ? ' | padre ' + padre.className + ' ' + sp.display + ' wrap ' + sp.flexWrap + ' w ' + arrotonda(padre.getBoundingClientRect().width) + ' ovf ' + sp.overflowX : '');
            })(),
            inCarta: Boolean(el.closest('.mt-card, .mp-hand-card')),
            inMano: Boolean(el.closest('.mt-hand')),
            visibile: stile.display !== 'none' && stile.visibility !== 'hidden' && Number(stile.opacity) > 0.05
        };
    });
    const carte = [...document.querySelectorAll('.mt-hand .mt-card, .mp-hand .mp-hand-card')].map(el => riquadro(el));

    return JSON.stringify({
        scenario: SCENARIO,
        raggiunta,
        pannello: riquadro(q('.mp-combat') || q('.mp-discard')),
        pulsanteTurno: riquadro(fase()),
        elementi,
        carte: carte.length,
        carta: carte[0] || null,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        altezzaDocumento: document.documentElement.scrollHeight
    });
})()`;

const controllaCombattimento = (lotta, scenario, { nome, h }) => {
    const problemi = [];
    const visibili = lotta.elementi.filter(elemento => elemento.visibile);
    if (!lotta.raggiunta || !visibili.length) return [`${nome} · ${scenario}: schermata non raggiunta (nessun controllo trovato)`];
    for (const elemento of visibili) {
        const minimo = elemento.tipo === 'select' ? SOGLIE.tendina
            : elemento.inCarta ? SOGLIE.chipCarta : SOGLIE.pulsanteCombattimento;
        if (elemento.h < minimo) {
            problemi.push(`${nome} · ${scenario}: ${elemento.tipo} «${elemento.testo}» alto ${elemento.h}px, sotto la soglia di ${minimo}px`);
        }
        // Fuori dallo schermo o mangiato da un contenitore che non scorre.
        const tagliatoY = elemento.bloccatoY && elemento.visibileH < elemento.h * 0.6;
        // La mano è una striscia che scorre: una carta tagliata a destra si
        // raggiunge scorrendo, non è un comando fuori dallo schermo.
        const tagliatoX = elemento.bloccatoX && !elemento.inMano && elemento.visibileW < elemento.w * 0.6;
        if (tagliatoY || tagliatoX) {
            problemi.push(`${nome} · ${scenario}: ${elemento.tipo} «${elemento.testo}» si vede solo ${elemento.visibileW}x${elemento.visibileH} di ${elemento.w}x${elemento.h} (${elemento.catena}) [${elemento.diagnosi}]`);
        }
    }
    if (lotta.carta && lotta.carta.h < SOGLIE.cartaMano) {
        problemi.push(`${nome} · ${scenario}: carta in mano alta ${lotta.carta.h}px, sotto la soglia di ${SOGLIE.cartaMano}px`);
    }
    if (lotta.overflowX > 0) problemi.push(`${nome} · ${scenario}: pagina che scorre in orizzontale di ${lotta.overflowX}px`);
    if (lotta.altezzaDocumento > h + SOGLIE.scarto) {
        problemi.push(`${nome} · ${scenario}: pagina alta ${lotta.altezzaDocumento}px su ${h}px`);
    }
    return problemi;
};

const rigaCombattimento = ({ w, h }, scenario, lotta, problemi) => {
    const controlli = lotta.elementi.filter(elemento => elemento.visibile).length;
    return `  ${scenario.padEnd(10)}${`${w}x${h}`.padEnd(12)}${`${controlli} controlli`.padEnd(14)}${problemi.length ? 'X' : 'ok'}`;
};

/* ── controlli ────────────────────────────────────────────────────────────── */

const controllaMulligan = (m, h) => {
    const problemi = [];
    if (!m) return ['schermata del mulligan non comparsa prima della mano'];
    if (m.carte !== 7) problemi.push(`mulligan con ${m.carte} carte invece di 7`);
    if (m.visibili !== m.carte) {
        problemi.push(`nel mulligan si vedono ${m.visibili} carte su ${m.carte}: le altre restano fuori dalla mano`);
    }
    for (const [etichetta, riquadro, inSchermo] of [
        ['«Tieni questa mano»', m.tenere, m.tenereInSchermo],
        ['«Rimescola e pesca»', m.rimescola, m.rimescolaInSchermo]
    ]) {
        if (!riquadro) { problemi.push(`pulsante ${etichetta} assente nel mulligan`); continue; }
        if (!inSchermo) problemi.push(`pulsante ${etichetta} fuori dallo schermo (${riquadro.w}x${riquadro.h} a ${riquadro.x},${riquadro.y})`);
        if (riquadro.h < SOGLIE.pulsanteMulligan) {
            problemi.push(`pulsante ${etichetta} alto ${riquadro.h}px, sotto la soglia di ${SOGLIE.pulsanteMulligan}px`);
        }
    }
    if (m.overflowX > 0) problemi.push(`mulligan che scorre in orizzontale di ${m.overflowX}px`);
    if (m.altezzaDocumento > h + SOGLIE.scarto) problemi.push(`mulligan che scorre in verticale: pagina alta ${m.altezzaDocumento}px su ${h}px`);
    return problemi;
};

const controlla = (misura, { w, h }) => {
    const problemi = controllaMulligan(misura.mulligan, h);
    const nota = [];
    if (misura.errore) return { problemi: [`tavolo non montato (${misura.errore}${misura.avviso ? ': ' + misura.avviso : ''})`], nota };

    if (!misura.coarse) problemi.push('il browser non sta emulando un puntatore coarse');
    if (misura.fine) problemi.push('il browser riporta ancora un puntatore fine');

    const tavolo = misura.tavolo;
    const scarto = SOGLIE.scarto;
    if (Math.abs(tavolo.w - w) > scarto || Math.abs(tavolo.h - h) > scarto || Math.abs(tavolo.x) > scarto || Math.abs(tavolo.y) > scarto) {
        problemi.push(`il tavolo non occupa lo schermo: ${tavolo.w}x${tavolo.h} a ${tavolo.x},${tavolo.y} invece di ${w}x${h} a 0,0`);
    }
    if (misura.overflowX > 0) problemi.push(`pagina che scorre in orizzontale di ${misura.overflowX}px`);
    if (misura.altezzaDocumento > h + scarto) problemi.push(`la pagina è alta ${misura.altezzaDocumento}px su ${h}px`);

    if (!misura.cartaCampo) problemi.push('nessuna carta nel campo dopo aver giocato una terra');
    else {
        if (misura.cartaCampo.h < SOGLIE.cartaCampo) {
            problemi.push(`carta del campo alta ${misura.cartaCampo.h}px, sotto la soglia di ${SOGLIE.cartaCampo}px`);
        }
        if (misura.cartaCampoDentro === false) {
            problemi.push(`carta del campo tagliata dal suo campo (${JSON.stringify(misura.cartaCampo)} dentro ${JSON.stringify(misura.campo)})`);
        }
    }

    if (!misura.cartaMano) problemi.push('nessuna carta in mano');
    else {
        if (misura.cartaMano.h < SOGLIE.cartaMano) problemi.push(`carta in mano alta ${misura.cartaMano.h}px, sotto la soglia di ${SOGLIE.cartaMano}px`);
        if (!misura.pulsanteMano || misura.pulsanteMano.h < SOGLIE.pulsanteMano) {
            problemi.push(`pulsante della carta in mano alto ${misura.pulsanteMano?.h ?? 0}px, sotto la soglia di ${SOGLIE.pulsanteMano}px`);
        }
    }

    if (misura.avvisoVisibile !== true) problemi.push('l\'avviso della partita non sta nella barra comandi');
    if (misura.comandiVisibili !== true) problemi.push('la riga comandi non sta nella barra comandi');
    if (misura.bersaglioVisibile !== true) problemi.push('il selettore del bersaglio non sta nella barra comandi');

    if (misura.fuori.length) problemi.push(`elementi fuori dal tavolo: ${misura.fuori.join(' · ')}`);

    if (misura.barra && misura.barra.h > 60) nota.push(`barra alta ${misura.barra.h}px`);
    return { problemi, nota };
};

const rigaMisura = ({ nome, w, h }, misura) => {
    const cella = valore => (valore ? `${valore.w}x${valore.h}` : '—');
    const mulligan = misura.mulligan ? `${misura.mulligan.visibili}/${misura.mulligan.carte}` : '—';
    return [
        `${nome} ${w}x${h}`.padEnd(34),
        mulligan.padEnd(6),
        cella(misura.mulligan?.carta).padEnd(8),
        cella(misura.cartaCampo).padEnd(8),
        cella(misura.cartaMano).padEnd(8),
        (misura.pulsanteMano ? `${misura.pulsanteMano.h}px` : '—').padEnd(6),
        misura.coarse ? 'sì' : 'NO'
    ].join(' ');
};

/* ── giro completo ────────────────────────────────────────────────────────── */

const eseguiTutto = async () => {
    if (!base) base = 'http://localhost:3000';
    if (!(await serveSorgenti(base))) base = await server.avvia();

    const cdp = await collegaCdp(apriBrowser(`${base}/magic/partita`));
    const esiti = [];
    const righeLotta = [];
    const problemiLotta = [];
    try {
        await scriviMazzo(cdp);
        console.log('misura del tavolo Magic · telefono touch (pointer: coarse)\n');
        console.log('misura'.padEnd(34) + 'mull'.padEnd(7) + 'm.carta'.padEnd(9) + 'campo'.padEnd(9) + 'mano'.padEnd(9) + 'tasto'.padEnd(7) + 'coarse');
        for (const misura of MISURE) {
            await emulaTelefono(cdp, misura);
            await emulaTocco(cdp);
            // Ricarica dopo l'emulazione: il layout deve nascere da telefono.
            await cdp.invia('Page.navigate', { url: `${base}/magic/partita` });
            await new Promise(risolvi => setTimeout(risolvi, 2500));
            const risultato = JSON.parse(await cdp.valuta(MISURA));
            const { problemi, nota } = controlla(risultato, misura);
            console.log(rigaMisura(misura, risultato));
            esiti.push({ misura, problemi, nota });

            // Combattimento: una partita nuova per scenario, perché attacco,
            // blocco e richiesta di scarto richiedono mani e campi diversi.
            for (const scenario of SCENARI) {
                await cdp.invia('Page.navigate', { url: `${base}/magic/partita` });
                await new Promise(risolvi => setTimeout(risolvi, 2500));
                const lotta = JSON.parse(await cdp.valuta(COMBATTIMENTO(scenario)));
                const lista = controllaCombattimento(lotta, scenario, misura);
                righeLotta.push(rigaCombattimento(misura, scenario, lotta, lista));
                problemiLotta.push(...lista);
            }
        }
    } finally {
        cdp.chiudi();
        chiudiBrowser();
        await server.ferma();
    }

    console.log('\ncombattimento              misura      controlli     esito');
    for (const riga of righeLotta) console.log(riga);

    const rotti = esiti.filter(esito => esito.problemi.length);
    console.log('');
    for (const esito of esiti) {
        if (esito.nota.length) console.log(`nota · ${esito.misura.nome}: ${esito.nota.join('; ')}`);
        for (const problema of esito.problemi) console.log(`ERRORE · ${esito.misura.nome}: ${problema}`);
    }
    for (const problema of problemiLotta) console.log(`ERRORE · ${problema}`);
    if (rotti.length || problemiLotta.length) {
        console.log(`\n${rotti.length + problemiLotta.length} controlli fuori soglia su ${esiti.length + righeLotta.length} misure.`);
        process.exitCode = 1;
        return;
    }
    console.log(`Tutte le ${esiti.length + righeLotta.length} misure sono dentro le soglie.`);
};

process.on('SIGINT', async () => { chiudiBrowser(); await server.ferma(); process.exit(130); });

eseguiTutto()
    .catch(async errore => {
        console.error(`\nMisura non eseguita: ${errore.message}`);
        chiudiBrowser();
        await server.ferma();
        process.exitCode = 1;
    });
