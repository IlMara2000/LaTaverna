// Sorgente casuale del motore: un PRNG con seme, non `Math.random`.
//
// Con `Math.random` una partita non si può ripetere: un replay non torna, un
// test che pesca tre carte non è riproducibile e un bug di mischia si vede una
// volta su dieci. Qui ogni stato porta il proprio seme e ogni estrazione lo
// consuma, quindi la stessa sequenza di azioni dà sempre lo stesso risultato.

/** Mulberry32: 32 bit di stato, veloce e con distribuzione accettabile. */
export const createRng = (seed = 1) => {
    let state = (Number(seed) >>> 0) || 1;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Mischia sul posto con il generatore dato: stesso seme, stesso ordine. */
export const shuffleWith = (rng, items = []) => {
    if (typeof rng !== 'function') throw new Error('shuffleWith: serve un generatore.');
    for (let index = items.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(rng() * (index + 1));
        [items[index], items[swap]] = [items[swap], items[index]];
    }
    return items;
};

/** Intero fra 0 e max-1 (per le scelte automatiche, non per le regole). */
export const randomInt = (rng, max) => Math.floor(rng() * Math.max(1, max));

/** Seme leggibile e riproducibile dai log: parte da un intero, non da un UUID. */
export const newSeed = (clock = Date.now()) => (Number(clock) >>> 0) || 1;
