/**
 * `@supabase/supabase-js`, ma senza undici.
 *
 * È l'unica cosa che serve neutralizzare: il pacchetto si porta dietro il
 * client realtime e con lui undici, che tiene vivi dei `setImmediate` e
 * impedisce al processo di test di uscire. Sostituendo il pacchetto e non il
 * nostro modulo, `src/services/supabase.js` gira per intero — ramo «non
 * configurato» compreso — e i test vedono esattamente quello che vede un build
 * senza chiavi.
 *
 * Se un test arriva a chiamare `createClient` vuol dire che l'ambiente
 * risultava configurato, cioè che il test ha smesso di guardare un build non
 * configurato. Meglio esplodere subito che misurare un ramo che in produzione,
 * senza `VITE_SUPABASE_URL`, non esiste.
 */
export const createClient = () => {
    throw new Error(
        "createClient chiamato in un test: l'ambiente deve restare non configurato (niente VITE_SUPABASE_URL)."
    );
};

export default { createClient };
