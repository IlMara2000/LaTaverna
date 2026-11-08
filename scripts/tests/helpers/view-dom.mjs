/**
 * Una finestra finta per provare le viste che parlano col DOM.
 *
 * jsdom non sa importare CSS: il loader qui sotto trasforma ogni `.css` in un
 * modulo vuoto, così `scippo.js` si può importare in Node esattamente come lo
 * importa Vite. Nessun dev server, nessun browser, nessuna rete.
 */
import { register } from 'node:module';
import { JSDOM } from 'jsdom';

let hooksInstalled = false;

/** Qualcosa che jsdom non implementa ma che il resto dell'app si aspetta. */
const stubs = {
    matchMedia: () => ({
        matches: false,
        media: '',
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {}
    }),
    ResizeObserver: class {
        observe() {}
        unobserve() {}
        disconnect() {}
    },
    IntersectionObserver: class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() { return []; }
    }
};

/**
 * Monta un DOM nuovo, assegna i globals che il codice usa senza prefisso
 * (`document`, `localStorage`, …) e restituisce la finestra.
 */
export function useDom({ url = 'http://localhost/scippo' } = {}) {
    if (!hooksInstalled) {
        register('./css-stub-loader.mjs', import.meta.url);
        hooksInstalled = true;
    }

    const dom = new JSDOM(
        '<!doctype html><html><body><div id="app"></div></body></html>',
        { url, pretendToBeVisual: true }
    );
    const { window } = dom;

    Object.entries(stubs).forEach(([name, value]) => {
        if (!(name in window)) window[name] = value;
    });

    // Le classi si prestano così come sono: un `.bind()` su un costruttore
    // restituisce una funzione senza `prototype`, e chi fa `class X extends Y`
    // esplode. Solo i metodi hanno bisogno del binding alla finestra.
    [
        'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'DOMParser',
        'MutationObserver', 'DocumentFragment', 'CSS', 'XMLSerializer'
    ].forEach(name => {
        if (window[name]) globalThis[name] = window[name];
    });
    // Niente rebinding di `setTimeout`: jsdom implementa `window.setTimeout`
    // chiamando il `setTimeout` globale, e sostituirlo con quello della finestra
    // crea una ricorsione infinita (RangeError sullo stack). I timer restano
    // quelli di Node; a non lasciare appeso il processo ci pensa lo stub del
    // pacchetto Supabase (undici teneva vivi dei `setImmediate`).
    [
        'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'scrollTo'
    ].forEach(name => {
        if (typeof window[name] === 'function') globalThis[name] = window[name].bind(window);
    });

    globalThis.window = window;
    globalThis.document = window.document;
    globalThis.localStorage = window.localStorage;
    globalThis.sessionStorage = window.sessionStorage;
    if (!globalThis.matchMedia) globalThis.matchMedia = window.matchMedia;
    Object.defineProperty(globalThis, 'navigator', {
        value: window.navigator,
        configurable: true
    });

    // Nessuna rete: alcune viste chiedono i record a Supabase appena montate e
    // senza una risposta finirebbero in una rejection non gestita che sporca
    // (o fa cadere) il test. Una risposta vuota e valida chiude la questione.
    globalThis.fetch = async () => new Response('[]', {
        status: 200,
        headers: { 'content-type': 'application/json' }
    });

    // Il `import.meta.env` di Vite, ricostruito come in un build senza chiavi:
    // `VITE_SUPABASE_URL` resta assente di proposito, così `supabase.js` prende
    // il suo ramo non configurato invece di costruire un client che dovrebbe
    // parlare con qualcuno.
    globalThis.__viteEnv = {
        BASE_URL: '/',
        MODE: 'test',
        DEV: false,
        PROD: false
    };

    return window;
}
