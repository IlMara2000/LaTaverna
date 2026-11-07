/* ============================================================================
   AUDIT IMPAGINAZIONE MOBILE — gira dentro la pagina della Taverna.
   Serve sia agli agenti sia ai controlli manuali.

   Uso dalla console o da `agent-browser eval`:
     window.__mobileAudit(['scacchi', 'dama', 'tictactoe'])
     window.__pageAudit(['/carte', '/shop', '/impostazioni'])

   Ogni report spiega *perché* una pagina è rotta: tavolo che non riempie lo
   schermo, contenuti fuori dal tavolo, comandi sotto i 32px, testi illeggibili.
   ========================================================================== */
(() => {
    const GAME_ROOT = '.scala40-game, .scopa-game, .briscola-game, .solitario-game, .game-master-wrapper:not(#start-screen), .party-game';
    const CARTE = new Set(['scala40', 'scopa', 'briscola', 'solitario', 'solo', 'burraco']);
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const round = n => Math.round(n);
    const box = el => {
        const r = el.getBoundingClientRect();
        return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) };
    };
    const visibile = el => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
    };
    const etichetta = el => {
        const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
    };
    const vaiA = async (dest, path) => {
        history.pushState({ tavernaDestination: dest }, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
        await sleep(900);
    };

    // Avvia una partita: scala livelli, pulsante di start o primo comando utile.
    const avvia = async () => {
        const menu = document.querySelector('#start-screen, #blocks-start');
        if (!menu || !visibile(menu)) return 'già in partita';
        const tentativi = [
            '#levels-container .game-level-button',
            '#blocks-start #levels-container button',
            '#start-screen #levels-container button',
            '#start-screen [data-start], #blocks-start [data-start]',
            '#start-screen #btn-start, #start-screen #start-button, #start-screen #btn-play',
            '#start-screen button:not(#exit-btn):not([id*="online"]):not([id*="mode"])'
        ];
        for (const sel of tentativi) {
            const btn = document.querySelector(sel);
            if (btn && visibile(btn)) {
                btn.click();
                await sleep(900);
                return sel;
            }
        }
        return 'nessun comando di avvio';
    };

    const misuraGioco = (gioco, avvio) => {
        const tavolo = document.querySelector(GAME_ROOT);
        if (!tavolo) return { gioco, avvio, esito: 'nessun tavolo montato' };
        const paginaParty = tavolo.matches('.party-game');
        const vp = { w: window.innerWidth, h: window.innerHeight };
        const t = paginaParty ? { x: 0, y: 0, w: vp.w, h: vp.h } : box(tavolo);
        const dentro = r => r.w > 1 && r.h > 1
            && r.x >= t.x - 2 && r.y >= t.y - 2
            && r.x + r.w <= t.x + t.w + 2 && r.y + r.h <= t.y + t.h + 2;
        const figli = [...tavolo.querySelectorAll('*')].filter(visibile);
        const fuori = figli.filter(el => !dentro(box(el)));
        const comandi = [...tavolo.querySelectorAll('button, [role="button"], a[href]')].filter(visibile);
        const piccoli = comandi
            .map(el => ({ sel: etichetta(el), ...box(el), testo: (el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 22) }))
            .filter(r => Math.min(r.w, r.h) < 32);
        const testi = [...tavolo.querySelectorAll('h1,h2,h3,p,span,small,strong,label,button')]
            .filter(visibile)
            .map(el => ({ size: parseFloat(getComputedStyle(el).fontSize), testo: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18) }))
            .filter(t2 => t2.size < 9 && t2.testo);
        const guscio = tavolo.firstElementChild;
        const g = guscio ? guscio.getBoundingClientRect() : null;
        return {
            gioco,
            avvio,
            classi: document.documentElement.className.trim(),
            viewport: `${vp.w}x${vp.h}`,
            tavolo: `${t.w}x${t.h} @ ${t.x},${t.y}`,
            riempieSchermo: paginaParty || (t.w >= vp.w - 2 && t.h >= vp.h - 2),
            guscio: g ? { serve: guscio.scrollHeight, vede: round(g.height), scrolla: guscio.scrollHeight > g.height + 2 } : null,
            fuoriDalTavolo: fuori.length,
            esempiFuori: fuori.slice(0, 6).map(el => ({ sel: etichetta(el), ...box(el) })),
            comandiSotto32px: piccoli.length,
            esempiComandi: piccoli.slice(0, 8),
            testiSotto9px: testi.length,
            esempiTesti: testi.slice(0, 5),
            overflowOrizzontale: round(tavolo.scrollWidth - tavolo.clientWidth)
        };
    };

    window.__mobileAudit = async (giochi) => {
        const report = [];
        for (const gioco of giochi) {
            const carte = CARTE.has(gioco);
            await vaiA(carte ? 'cards' : 'minigames', carte ? '/carte' : '/minigames');
            const scheda = document.querySelector(`[data-launch-game="${gioco}"]`);
            if (!scheda) {
                report.push({ gioco, esito: 'scheda non trovata nel catalogo' });
                continue;
            }
            scheda.click();
            await sleep(1500);
            const avvio = await avvia();
            await sleep(800);
            report.push(misuraGioco(gioco, avvio));
            const esci = document.querySelector('#back-menu, #btn-exit-ingame, #blocks-exit, #exit-btn, #quit-btn');
            if (esci && visibile(esci)) {
                esci.click();
                await sleep(800);
            }
        }
        return report;
    };

    window.__pageAudit = async (rotte) => {
        const report = [];
        const partenze = {
            '/carte': 'cards', '/minigames': 'minigames', '/shop': 'shop', '/mtcg': 'mtcg',
            '/giochi-di-ruolo': 'rpg', '/oracolo': 'oracle', '/multiplayer': 'multiplayer',
            '/magic': 'magic', '/community': 'community', '/privacy': 'privacy',
            '/impostazioni': 'settings', '/profilo': 'profile', '/musica': 'music',
            '/segnapunti': 'cardCounter', '/libreria': 'reading'
        };
        for (const rotta of rotte) {
            await vaiA(partenze[rotta] || 'home', rotta);
            const app = document.querySelector('#app');
            if (!app) { report.push({ rotta, esito: 'app assente' }); continue; }
            const cs = getComputedStyle(app);
            const radice = app.firstElementChild;
            const r = radice ? radice.getBoundingClientRect() : null;
            const vp = { w: window.innerWidth, h: window.innerHeight };
            const fuori = [...app.querySelectorAll('*')].filter(el => {
                if (!visibile(el)) return false;
                const b = box(el);
                return b.x < -2 || b.x + b.w > vp.w + 2;
            });
            const comandi = [...app.querySelectorAll('button, a[href], [role="button"], input, select, textarea')].filter(visibile);
            const piccoli = comandi.filter(el => {
                const b = box(el);
                return Math.min(b.w, b.h) < 32;
            });
            report.push({
                rotta,
                radice: radice ? etichetta(radice) : null,
                padding: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '),
                contenuto: r ? `${round(r.w)}px @ ${round(r.x)}` : null,
                overflowX: round(app.scrollWidth - app.clientWidth),
                fuoriSchermo: fuori.length,
                esempiFuori: fuori.slice(0, 6).map(el => ({ sel: etichetta(el), ...box(el) })),
                comandiSotto32px: piccoli.length,
                esempiComandi: piccoli.slice(0, 6).map(el => ({ sel: etichetta(el), ...box(el) }))
            });
        }
        return report;
    };

    /* ------------------------------------------------------------------------
       SCHEDA CARTA — misure della dashboard Magic nella viewport corrente:
       griglia della collezione, pannello mazzi e tendina dei dettagli a riposo
       e aperta. Il driver scripts/test-magic-layout.mjs cambia larghezza,
       richiama questa funzione e confronta i numeri con le soglie.
       --------------------------------------------------------------------- */
    const MAGIC_KEYS = ['taverna_magic_collection_v1', 'taverna_magic_decks_v1', 'taverna_magic_wantlist_v1'];
    const MAGIC_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    const preparaMagic = () => {
        // La sincronizzazione cloud sostituirebbe i dati di prova: resta offline.
        try {
            Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
        } catch { /* già offline */ }
        const nomi = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
        const carte = nomi.map((nome, indice) => ({
            id: `prova-${indice}`, name: nome, image: MAGIC_PIXEL, manaCost: '{1}',
            typeLine: 'Instant', oracleText: 'Testo di prova per misurare la tendina dei dettagli. '.repeat(6),
            printedText: '', quantity: 1, language: 'en'
        }));
        localStorage.setItem(MAGIC_KEYS[0], JSON.stringify(carte));
        localStorage.setItem(MAGIC_KEYS[1], JSON.stringify([
            // Ordine volutamente diverso dalla collezione: Delta, Bravo, Foxtrot.
            { id: 'mazzo-prova', name: 'Mazzo di prova', cards: [carte[3], carte[1], carte[5]].map(carta => ({ cardId: carta.id, quantity: 1 })) },
            { id: 'mazzo-prova-2', name: 'Secondo mazzo', cards: carte.slice(2, 5).map(carta => ({ cardId: carta.id, quantity: 1 })) }
        ]));
        localStorage.setItem(MAGIC_KEYS[2], '[]');
        return carte.length;
    };

    window.__magicLayout = async (opzioni = {}) => {
        const attesa = opzioni.attesa ?? 700;
        const dormi = ms => new Promise(resolve => setTimeout(resolve, ms));
        const tondo = n => Math.round(n);
        const rettangolo = el => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: tondo(r.x), y: tondo(r.y), w: tondo(r.width), h: tondo(r.height) };
        };
        const colonne = el => {
            if (!el) return 0;
            const valore = getComputedStyle(el).gridTemplateColumns;
            return valore && valore !== 'none' ? valore.split(/\s+/).filter(voce => parseFloat(voce) > 0).length : 0;
        };
        const corpo = el => (el ? { clientH: el.clientHeight, scrollH: el.scrollHeight } : null);

        preparaMagic();
        const radice = document.getElementById('app') || document.getElementById('ui') || document.body;
        radice.innerHTML = '';
        // Niente rete: apertura carta immediata e nessuna sincronizzazione a metà misura.
        const fetchOriginale = window.fetch;
        window.fetch = (risorsa, opzioniFetch) => {
            const url = typeof risorsa === 'string' ? risorsa : risorsa?.url || '';
            return /scryfall\.com|\/api\/magic\/translate/.test(url)
                ? Promise.reject(new Error('rete disattivata per il test'))
                : fetchOriginale(risorsa, opzioniFetch);
        };

        const attendi = async (prova, ms = 3000) => {
            const fine = Date.now() + ms;
            while (Date.now() < fine) {
                if (prova()) return true;
                await dormi(100);
            }
            return !!prova();
        };

        const modulo = await import('/src/dashboards/magic.js');
        // Il boot della pagina può ripulire #app subito dopo il montaggio (primo caricamento
        // a freddo del dev server): rimonto finché la griglia resta al suo posto.
        let montata = false;
        for (let tentativo = 0; tentativo < 4 && !montata; tentativo++) {
            radice.innerHTML = '';
            modulo.showMagicDashboard(radice);
            montata = await attendi(() => radice.querySelector('[data-open-card]'), 1500);
            if (montata) {
                await dormi(600);
                montata = !!radice.querySelector('[data-open-card]');
            }
        }
        if (!montata) throw new Error('la dashboard Magic non resta montata nella pagina');
        await dormi(attesa);

        const tabCollezione = radice.querySelector('[data-tab="collezione"]');
        if (tabCollezione) { tabCollezione.click(); await dormi(250); }
        const griglia = radice.querySelector('.mv-panel .mv-grid') || radice.querySelector('.mv-grid');
        const collection = {
            cols: colonne(griglia),
            cardW: tondo(griglia?.firstElementChild?.getBoundingClientRect().width || 0),
            gridW: tondo(griglia?.getBoundingClientRect().width || 0),
            cards: griglia ? griglia.children.length : 0
        };

        const tabMazzi = radice.querySelector('[data-tab="mazzi"]');
        if (tabMazzi) { tabMazzi.click(); await dormi(300); }
        const layout = radice.querySelector('.mv-deck-layout');
        const lista = radice.querySelector('.mv-deck-list');
        const grigliaMazzo = radice.querySelector('.mv-deck-content .mv-grid');
        const stileLista = lista ? getComputedStyle(lista) : null;
        const deck = {
            layoutCols: colonne(layout),
            listDisplay: stileLista?.display || null,
            listOverflowX: stileLista?.overflowX || null,
            gridCols: colonne(grigliaMazzo),
            cards: grigliaMazzo ? grigliaMazzo.children.length : 0,
            decks: radice.querySelectorAll('[data-select-deck]').length
        };

        if (tabCollezione) { tabCollezione.click(); await dormi(250); }
        radice.querySelector('[data-open-card]')?.click();
        await dormi(400);

        const modale = radice.querySelector('.mv-modal');
        const arte = radice.querySelector('.mv-modal-art');
        const copia = radice.querySelector('.mv-modal-copy');
        const chiudi = radice.querySelector('.mv-modal-close');
        const maniglia = radice.querySelector('.mv-sheet-grab');
        if (!modale || !copia) throw new Error('la scheda carta non si è aperta');

        const arteRect = rettangolo(arte), copiaRect = rettangolo(copia), modaleRect = rettangolo(modale);
        const min = {
            modal: modaleRect, art: arteRect, copy: copiaRect, close: rettangolo(chiudi),
            gapAbove: arteRect && modaleRect ? arteRect.y - modaleRect.y : null,
            gapBelow: arteRect && copiaRect ? copiaRect.y - (arteRect.y + arteRect.h) : null,
            varMin: getComputedStyle(modale).getPropertyValue('--mv-sheet-min').trim(),
            inlineHeight: copia.style.height || '',
            body: corpo(radice.querySelector('.mv-sheet-body'))
        };

        // La maniglia è focusabile: ArrowUp apre la tendina anche senza gesti touch.
        maniglia?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        await dormi(450);
        const max = {
            copy: rettangolo(copia), art: rettangolo(arte), close: rettangolo(chiudi), grab: rettangolo(maniglia),
            body: corpo(radice.querySelector('.mv-sheet-body'))
        };
        maniglia?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        await dormi(250);

        // Gesti della tendina: pointer sintetici, come un dito che trascina la maniglia.
        let gestures = null;
        if (min.varMin && maniglia) {
            const altezza = () => tondo(copia.getBoundingClientRect().height);
            const punta = (tipo, y) => {
                const r = maniglia.getBoundingClientRect();
                maniglia.dispatchEvent(new PointerEvent(tipo, {
                    bubbles: true, cancelable: true, composed: true, pointerId: 1, pointerType: 'touch',
                    isPrimary: true, button: 0, buttons: tipo === 'pointerup' ? 0 : 1,
                    clientX: tondo(r.left + r.width / 2), clientY: y
                }));
            };
            const passi = {};
            const riposo = altezza();
            const arteRiposo = rettangolo(arte)?.y ?? null;
            // Corse proporzionali all'escursione: su un telefono orizzontale la tendina
            // ha solo 138px fra riposo e apertura, quindi 120px la aprirebbero del tutto.
            const corsa = Math.max(40, tondo((max.copy.h - riposo) * 0.25));
            const corsaLunga = Math.max(60, tondo((max.copy.h - riposo) * 0.6));

            // Il trascinamento segue il dito 1:1 e spegne la transizione.
            punta('pointerdown', 640);
            punta('pointermove', 640 - corsa);
            passi.trascinamento = {
                h: altezza(),
                atteso: riposo + corsa,
                dragging: modale.classList.contains('is-sheet-dragging'),
                transizione: getComputedStyle(copia).transitionDuration,
                arteY: rettangolo(arte)?.y ?? null
            };
            punta('pointerup', 640 - corsa);
            await dormi(350);
            passi.rilascioSottoMeta = altezza();

            // Trascinamento lungo, rilasciato sopra metà altezza: si apre del tutto.
            punta('pointerdown', 700);
            punta('pointermove', 700 - corsaLunga);
            punta('pointerup', 700 - corsaLunga);
            await dormi(350);
            passi.rilascioSopraMeta = altezza();

            // Tocco singolo senza spostamento: richiude.
            punta('pointerdown', 700);
            punta('pointerup', 700);
            await dormi(350);
            passi.tocco = altezza();

            // Sotto la soglia di 5px lo spostamento vale come tocco: da riposo apre.
            punta('pointerdown', 700);
            punta('pointermove', 696);
            punta('pointerup', 696);
            await dormi(350);
            passi.microTrascinamento = altezza();

            // Dall'alto, trascinata verso il basso sotto metà: si richiude.
            punta('pointerdown', 300);
            punta('pointermove', 300 + corsaLunga);
            punta('pointerup', 300 + corsaLunga);
            await dormi(350);
            passi.trascinaGiu = altezza();

            gestures = { riposo, arteRiposo, passi };
        }

        // Swipe sull'arte: lo sfoglio segue il contesto e si ferma ai capi dell'elenco.
        const titolo = () => radice.querySelector('#mv-modal-title')?.textContent?.trim() || null;
        const striscia = (dx, dy) => {
            const nastro = radice.querySelector('.mv-modal-art');
            if (!nastro) return false;
            const r = nastro.getBoundingClientRect();
            const x = tondo(r.left + r.width / 2), y = tondo(r.top + r.height / 2);
            const invia = (tipo, px, py) => nastro.dispatchEvent(new PointerEvent(tipo, {
                bubbles: true, cancelable: true, composed: true, pointerId: 2, pointerType: 'touch',
                isPrimary: true, button: 0, buttons: tipo === 'pointerup' ? 0 : 1,
                clientX: px, clientY: py
            }));
            invia('pointerdown', x, y);
            invia('pointerup', x + dx, y + dy);
            return true;
        };
        const swipes = { collezionePartenza: titolo() };
        striscia(0, -80);
        await dormi(250);
        swipes.collezioneVerticale = titolo();
        striscia(-80, 0);
        await dormi(250);
        swipes.collezioneOrizzontale = titolo();
        striscia(80, 0);
        await dormi(250);
        swipes.collezioneIndietro = titolo();
        striscia(80, 0);
        await dormi(250);
        swipes.collezioneInizio = titolo();
        striscia(80, 0);
        await dormi(250);
        swipes.collezioneFermoInizio = titolo();

        radice.querySelector('.mv-modal-close')?.click();
        await attendi(() => !radice.querySelector('.mv-modal'), 1500);
        radice.querySelector('[data-tab="mazzi"]')?.click();
        await dormi(300);
        radice.querySelector('[data-open-card="prova-3"]')?.click();
        const apertaNelMazzo = await attendi(() => radice.querySelector('.mv-modal'), 2000);
        swipes.mazzoPartenza = apertaNelMazzo ? titolo() : null;
        if (apertaNelMazzo) {
            striscia(0, -80);
            await dormi(250);
            swipes.mazzoDopo = titolo();
            striscia(0, -80);
            await dormi(250);
            swipes.mazzoDopo2 = titolo();
            striscia(0, -80);
            await dormi(250);
            swipes.mazzoFermoFine = titolo();
            striscia(-90, 0);
            await dormi(250);
            swipes.mazzoFermoFineOrizzontale = titolo();
        }
        radice.querySelector('.mv-modal-close')?.click();
        await attendi(() => !radice.querySelector('.mv-modal'), 1500);
        await dormi(150);

        const documento = document.documentElement;
        const overflowX = Math.max(
            documento.scrollWidth - documento.clientWidth,
            document.body.scrollWidth - document.body.clientWidth
        );

        return {
            viewport: { w: window.innerWidth, h: window.innerHeight },
            overflowX: tondo(overflowX),
            collection,
            deck,
            sheet: { enabled: !!min.varMin, min, max, gestures, swipes }
        };
    };
})();
