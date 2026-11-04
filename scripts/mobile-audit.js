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
})();
