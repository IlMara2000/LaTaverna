import '../dashboards/minigames/table-landscape.css';

/**
 * MODALITÀ TAVOLO
 * I giochi di carte devono restare in vista laterale anche quando il telefono
 * ha la rotazione automatica disattivata. Non possiamo obbligare il sistema,
 * quindi: se il viewport è verticale ruotiamo il tavolo di 90° via CSS; se il
 * telefono viene ruotato davvero il browser passa in landscape e la rotazione
 * CSS si toglie da sola. In entrambi i casi la partita è sempre orizzontale.
 */

const CARD_TABLE_SELECTOR = '.scala40-game, .scopa-game, .briscola-game, .solitario-game, .game-master-wrapper:not(#start-screen)';
const COMPACT_SHORT_SIDE = 560;

const html = document.documentElement;
let table = null;
let timer = 0;
let observer = null;

function measure() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const portrait = height > width;
    const rotated = portrait && Boolean(table);
    const stageWidth = rotated ? height : width;
    const stageHeight = rotated ? width : height;
    const compact = Boolean(table) && (rotated || stageHeight <= COMPACT_SHORT_SIDE);

    html.classList.toggle('table-mode', Boolean(table));
    html.classList.toggle('table-rotated', rotated);
    html.classList.toggle('table-compact', compact);
    html.style.setProperty('--stage-w', `${Math.round(stageWidth)}px`);
    html.style.setProperty('--stage-h', `${Math.round(stageHeight)}px`);
}

const SHELL_SELECTOR = ':scope > .s40-shell, :scope > .scopa-shell, :scope > .solitario-shell, :scope > .briscola-shell';

/**
 * Se il tavolo non entra nell'altezza disponibile (telefoni bassi), il
 * contenuto viene ridotto in scala: nulla viene tagliato né diventa
 * irraggiungibile con lo scroll.
 */
function fitToStage() {
    if (!table || !html.classList.contains('table-compact')) {
        html.style.setProperty('--table-fit', '1');
        html.classList.remove('table-fit');
        return;
    }
    const shell = table.querySelector(SHELL_SELECTOR) || table.firstElementChild;
    if (!shell) return;
    // La scala agisce solo con transform: la misura resta stabile, senza loop.
    // Si guarda anche il tavolo intero: il contenuto può sfuggire al guscio.
    const available = table.clientHeight - 10;
    const needed = Math.max(shell.scrollHeight, table.scrollHeight - 14);
    // Il tavolo deve restare interamente dentro lo schermo: la scala può
    // scendere fino a 0.6. Alzare questo minimo fa uscire i comandi dal bordo.
    const ratio = needed > available + 2 ? Math.max(0.6, available / needed) : 1;
    html.style.setProperty('--table-fit', ratio.toFixed(3));
    html.classList.toggle('table-fit', ratio < 0.999);
}

let fitTimers = [];
function queueFit() {
    fitTimers.forEach(window.clearTimeout);
    fitTimers = [0, 120, 420, 900].map(delay => window.setTimeout(fitToStage, delay));
}

function update() {
    table = document.querySelector(CARD_TABLE_SELECTOR);
    measure();
    queueFit();
}

// Un timer invece di requestAnimationFrame: la rotazione deve essere pronta
// anche quando la scheda non è in primo piano (rAF lì resta sospeso).
function schedule() {
    if (timer) return;
    timer = window.setTimeout(() => {
        timer = 0;
        update();
    }, 16);
}

function start() {
    if (observer) return;
    if (!document.body) {
        window.setTimeout(start, 30);
        return;
    }
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('fullscreenchange', schedule);
    document.addEventListener('visibilitychange', schedule);
    update();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
    start();
}

window.addEventListener('pagehide', () => {
    html.classList.remove('table-mode', 'table-rotated', 'table-compact');
});

// Aggancio di servizio: utile ai controlli manuali e agli strumenti di test.
window.__tableOrientation = { refresh: update, fit: fitToStage };

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        observer?.disconnect();
        observer = null;
        table = null;
        html.classList.remove('table-mode', 'table-rotated', 'table-compact');
        html.style.removeProperty('--stage-w');
        html.style.removeProperty('--stage-h');
    });
}
