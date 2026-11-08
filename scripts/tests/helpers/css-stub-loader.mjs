/**
 * Hook di caricamento per Node: quello che capisce Vite e Node no.
 *
 * - i fogli di stile diventano moduli vuoti (il test guarda il DOM, non i colori);
 * - i `.json` diventano moduli ES, senza obbligare ogni file a dichiarare
 *   `with { type: 'json' }` solo per far contento il test runner;
 * - `import.meta.env` diventa `globalThis.__viteEnv`, l'oggetto che il test
 *   prepara prima di importare la vista (`VITE_SUPABASE_URL` compresa: senza
 *   una URL il client Supabase esplode all'import, e il test non deve
 *   accendere nessuna rete).
 *
 * La sostituzione è testuale: nei sorgenti dell'app `import.meta.env` compare
 * solo come accesso reale, mai dentro stringhe o commenti.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ENV = 'globalThis.__viteEnv';
const SIDEBAR_STUB = new URL('./sidebar-stub.mjs', import.meta.url).href;
const SUPABASE_JS_STUB = new URL('./supabase-js-stub.mjs', import.meta.url).href;

/**
 * La sidebar trascina dentro navigazione, preferenze e client Supabase: troppo
 * per un test che guarda solo il DOM di una vista. Al suo posto, uno stub muto.
 */
export async function resolve(specifier, context, next) {
    const resolved = await next(specifier, context);
    if (/\/src\/components\/layout\/Sidebar\.js$/.test(resolved.url)) {
        return { ...resolved, url: SIDEBAR_STUB, shortCircuit: true };
    }
    // Il pacchetto Supabase importa undici e non lascia mai spegnere il
    // processo di test. Si sostituisce il pacchetto, non il nostro modulo.
    if (resolved.url.includes('@supabase/supabase-js')) {
        return { ...resolved, url: SUPABASE_JS_STUB, shortCircuit: true };
    }
    return resolved;
}

export async function load(url, context, next) {
    if (url.endsWith('.css')) {
        return { format: 'module', source: 'export default {};', shortCircuit: true };
    }
    if (url.endsWith('.json')) {
        const raw = await readFile(fileURLToPath(url), 'utf8');
        return { format: 'module', source: `export default ${JSON.stringify(JSON.parse(raw))};`, shortCircuit: true };
    }
    if (url.startsWith('file:') && url.includes('/src/')) {
        const source = await readFile(fileURLToPath(url), 'utf8');
        if (source.includes('import.meta.env')) {
            return {
                format: 'module',
                source: source.replaceAll('import.meta.env', ENV),
                shortCircuit: true
            };
        }
    }
    return next(url, context);
}
