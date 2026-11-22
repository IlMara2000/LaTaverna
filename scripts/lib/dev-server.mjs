/**
 * VITE TEMPORANEO PER I TEST DI MISURA
 *
 * I test di misura leggono i moduli così come stanno in `src/`: se la porta
 * indicata espone la build statica (`scripts/serve-dist.mjs`) o non risponde
 * affatto, se ne accendono uno proprio su una porta libera e lo spengono
 * all'uscita. Le funzioni stanno qui perché `test-magic-layout.mjs` e
 * `test-magic-table.mjs` ne usano le stesse, e due copie divergono.
 */
import { spawn } from 'node:child_process';
import { connect as netConnect, createServer } from 'node:net';
import { join } from 'node:path';

// Un modulo dei sorgenti: se la risposta è JavaScript e contiene `export`,
// davanti c'è un dev server e non la build statica.
const SONDA = 'src/dashboards/magicPlay.js';

export const serveSorgenti = async url => {
    try {
        const risposta = await fetch(`${url}/${SONDA}`, { signal: AbortSignal.timeout(4000) });
        if (!risposta.ok) return false;
        return /javascript/.test(risposta.headers.get('content-type') || '') && (await risposta.text()).includes('export');
    } catch {
        return false;
    }
};

// Una porta è libera solo se nessuno ascolta su nessuna delle due famiglie:
// Vite si lega a `localhost`, che qui è `::1`, quindi una sonda legata a
// `127.0.0.1` dichiara libera una porta occupata e `--strictPort` fa poi
// fallire l'avvio con `Port 4300 is already in use`.
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

const avviaSu = async (radice, numero) => {
    // Lo stdin resta aperto: il CLI di Vite esce quando lo stdin finisce, e con
    // `ignore` (cioè /dev/null) si spegnerebbe a metà corsa. `CI=1` disattiva
    // anche le scorciatoie da tastiera, che non servono qui.
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
        if (await serveSorgenti(url)) return { processo, url };
        if (processo.exitCode !== null) break;
        await new Promise(risolvi => setTimeout(risolvi, 500));
    }
    processo.kill();
    throw new Error(`Vite temporaneo non pronto su ${url}\n${registro.slice(-600)}`);
};

// SIGTERM e poi SIGKILL: Vite a volte ignora il primo, e i suoi pipe terrebbero
// vivo il processo chiamante anche dopo la stampa dei risultati. L'attesa è
// sulla morte effettiva, così la porta è davvero libera prima di riaccenderlo.
const fermaProcesso = async processo => {
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

/**
 * Un Vite temporaneo alla volta, con il suo stato.
 * `avvia()` risolve con l'URL quando i sorgenti rispondono, `ferma()` spegne il
 * processo (e lo aspetta), `vivo()` dice se qualcuno sta ancora servendo.
 */
export function serverTemporaneo({ radice, portaIniziale = 4300 } = {}) {
    if (!radice) throw new Error('serverTemporaneo: manca la radice del progetto');
    let corrente = null;
    const avvia = async () => {
        let ultimo = null;
        // Se la porta scelta viene presa nella corsa tra sonda e avvio, o Vite
        // muore appena partito, il tentativo successivo riparte da una porta
        // diversa invece di ripetere lo stesso numero.
        for (let tentativo = 0; tentativo < 3; tentativo++) {
            const numero = await portaLibera(portaIniziale + tentativo * 10);
            if (!numero) throw new Error('nessuna porta libera per un Vite temporaneo');
            try {
                corrente = await avviaSu(radice, numero);
                return corrente.url;
            } catch (errore) {
                ultimo = errore;
                console.error(`Vite temporaneo non avviato sulla porta ${numero}: ${String(errore.message).split('\n')[0]}`);
            }
        }
        throw ultimo;
    };
    const ferma = async () => {
        const processo = corrente?.processo;
        corrente = null;
        await fermaProcesso(processo);
    };
    return {
        avvia,
        ferma,
        get url() { return corrente?.url || null; },
        get processo() { return corrente?.processo || null; },
        // Vite può uscire o incantarsi a metà corsa: chi misura deve sapere se
        // il processo è ancora vivo per decidere se riaccenderlo.
        vivo() {
            const processo = corrente?.processo;
            return Boolean(processo) && processo.exitCode === null && processo.signalCode === null;
        }
    };
}
