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
// Solo i tavoli da carte con mano a ventaglio, corsie o meld hanno senso in
// orizzontale. Tris, scacchi, dama, Tetris e i giochi party stanno in verticale:
// ruotarli era la vera fonte di disorientamento.
const LANDSCAPE_TABLE_SELECTOR = '.scala40-game, .scopa-game, .briscola-game, .solitario-game, .solo-game-wrapper, .burraco-game';
const HINT_KEY = 'taverna_table_hint_seen';
const COMPACT_SHORT_SIDE = 560;

// Schermate di avvio (scelta modalità/livello): sono menu verticali, non
// tavoli. Ruotarle le rendeva colonne di testo illeggibili.
const START_SCREEN_SELECTOR = '.briscola-start, .scopa-welcome, .blocks-start, .tictactoe-start-screen, #start-screen';

const visibile = el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.display !== 'none'
        && s.visibility !== 'hidden' && Number(s.opacity) > 0.05;
};

// Elementi puramente decorativi (cerchi, ornamenti): non occupano spazio
// utile ma allargano le misure di overflow.
const decorativo = el => getComputedStyle(el).pointerEvents === 'none';

const html = document.documentElement;
let table = null;
let timer = 0;
let observer = null;

/**
 * Il banner cookie è fisso in basso e non deve coprire il tavolo: lo spazio
 * riservato (`--tv-consent-space`, altezza del banner più il distacco) si
 * toglie dall'altezza utile finché il banner è aperto.
 */
function bannerSpace() {
    const value = Number.parseFloat(getComputedStyle(html).getPropertyValue('--tv-consent-space'));
    return Number.isFinite(value) ? value : 0;
}

function measure() {
    const width = window.innerWidth;
    const height = window.innerHeight - bannerSpace();
    const portrait = height > width;
    // I tavoli storici mettono la scelta modalità in un wrapper annidato: è un
    // menu verticale, non un tavolo. Ruotarlo rendeva i testi colonne
    // illeggibili, quindi la rotazione parte solo a partita avviata.
    const startAperta = Boolean(table)
        && [...table.querySelectorAll(START_SCREEN_SELECTOR)].some(visibile);
    const menuAperto = Boolean(table)
        && (Boolean(table.querySelector(':scope > .game-master-wrapper')) || startAperta);
    html.classList.toggle('table-menu', menuAperto);
    const landscapeTable = Boolean(table?.matches?.(LANDSCAPE_TABLE_SELECTOR));
    const rotated = portrait && landscapeTable && !menuAperto;
    const stageWidth = rotated ? height : width;
    const stageHeight = rotated ? width : height;
    const compact = landscapeTable && !menuAperto && (rotated || stageHeight <= COMPACT_SHORT_SIDE);

    html.classList.toggle('table-mode', Boolean(table) && landscapeTable);
    html.classList.toggle('table-rotated', rotated);
    html.classList.toggle('table-compact', compact);
    html.style.setProperty('--stage-w', `${Math.round(stageWidth)}px`);
    html.style.setProperty('--stage-h', `${Math.round(stageHeight)}px`);
}

// I tavoli storici mettono la schermata iniziale in un wrapper annidato:
// anche quello va misurato, altrimenti resta alto 844px e finisce fuori.
const SHELL_SELECTOR = ':scope > .s40-shell, :scope > .scopa-shell, :scope > .solitario-shell, :scope > .briscola-shell, :scope > .game-master-wrapper';

/**
 * Se il tavolo non entra nell'altezza disponibile (telefoni bassi), il
 * contenuto viene ridotto in scala: nulla viene tagliato né diventa
 * irraggiungibile con lo scroll.
 */
function fitToStage() {
    if (!table || html.classList.contains('table-menu') || !html.classList.contains('table-compact')) {
        html.style.setProperty('--table-fit', '1');
        html.classList.remove('table-fit');
        return;
    }
    const shell = table.querySelector(SHELL_SELECTOR) || table.firstElementChild;
    if (!shell) return;
    // La scala agisce solo con transform: la misura resta stabile, senza loop.
    // Si guarda anche il tavolo intero: il contenuto può sfuggire al guscio.
    // 10px di margine: senza, Scala 40 e Solitario sforano di poco sul bordo.
    const available = table.clientHeight - 10;
    // scrollHeight non vede i figli in overflow negativo o assoluti: si guarda
    // anche dove finisce davvero l'ultimo figlio. La misura è relativa al
    // guscio e salta gli ornamenti, che non sono contenuto.
    const base = shell.offsetTop;
    const fondo = [...shell.children]
        .filter(el => !decorativo(el))
        .reduce(
            (massimo, el) => Math.max(massimo, el.offsetTop - base + el.offsetHeight),
            0
        );
    const needed = Math.max(shell.scrollHeight, fondo, table.scrollHeight - 14);
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

let hintTimer = 0;

/**
 * Se il tavolo è ruotato via CSS il telefono è ancora in verticale: senza una
 * riga di testo l'utente vede la partita di lato e non sa perché. L'avviso
 * resta nella orientamento reale del telefono, quindi è leggibile subito.
 */
function showOrientationHint() {
    try { if (sessionStorage.getItem(HINT_KEY) === '1') return; } catch { /* storage negato */ }
    let node = document.getElementById('table-orientation-hint');
    if (!node) {
        node = document.createElement('div');
        node.id = 'table-orientation-hint';
        node.setAttribute('role', 'status');
        node.innerHTML = '<span aria-hidden="true">⟳</span><p>Ruota il telefono: questo tavolo si gioca in orizzontale.</p><button type="button">Ho capito</button>';
        node.querySelector('button').addEventListener('click', () => {
            try { sessionStorage.setItem(HINT_KEY, '1'); } catch { /* storage negato */ }
            hideOrientationHint();
        });
        document.body.appendChild(node);
    }
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(hideOrientationHint, 7000);
}

function hideOrientationHint() {
    window.clearTimeout(hintTimer);
    document.getElementById('table-orientation-hint')?.remove();
}

function update() {
    table = document.querySelector(CARD_TABLE_SELECTOR);
    measure();
    if (html.classList.contains('table-rotated')) showOrientationHint();
    else hideOrientationHint();
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
    hideOrientationHint();
    html.classList.remove('table-mode', 'table-rotated', 'table-compact');
});

// Aggancio di servizio: utile ai controlli manuali e agli strumenti di test.
window.__tableOrientation = { refresh: update, fit: fitToStage };

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        observer?.disconnect();
        observer = null;
        table = null;
        hideOrientationHint();
        html.classList.remove('table-mode', 'table-rotated', 'table-compact');
        html.style.removeProperty('--stage-w');
        html.style.removeProperty('--stage-h');
    });
}
