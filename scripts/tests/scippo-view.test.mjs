/**
 * Test di fumo della vista SCIPPO: DOM vero (jsdom) e moduli veri.
 *
 * Serve a coprire quello che i test puri non possono vedere — che la home si
 * disegni, che il foglio regole dica quello che fa il motore e che un toast
 * sopravviva a un ridisegno. Niente dev server: si importa `scippo.js` e si
 * cliccano i `data-action` come fa il giocatore.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { useDom } from './helpers/view-dom.mjs';

useDom();

const { initScippo } = await import('../../src/dashboards/minigames/scippo.js');
const { compareCards, REGULATION_TURNS, DECK_SIZE } = await import('../../src/services/scippoEngine.js');
const {
    CANTINA_COPY,
    EGG_IDS,
    SECRET_LINE,
    loadQuaderno,
    registerEgg,
    saveQuaderno,
    transcriptionFor
} = await import('../../src/services/scippoSecret.js');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

let container = null;

/** Monta la vista. `reset` svuota lo storage quando si vuole un mondo pulito. */
function mount(reset = true) {
    window.__scippoCleanup?.();
    if (reset) window.localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    container = document.getElementById('app');
    initScippo(container);
    return container;
}

function click(selector) {
    const element = container.querySelector(selector);
    assert.ok(element, `manca ${selector} nel DOM`);
    element.click();
    return element;
}

const text = () => container.textContent.replace(/\s+/g, ' ').trim();

test('la home si disegna e la striscia delle regole non mente sul JOLLY', () => {
    mount();
    const app = container.querySelector('.scippo-app');
    assert.equal(app?.dataset.screen, 'home', 'la vista parte dalla home');

    const strip = container.querySelector('.sc-rules-strip')?.textContent.replace(/\s+/g, ' ') || '';
    assert.match(strip, /👊 batte 🎭/);
    assert.match(strip, /🃏 batte tutto/);

    // La striscia è solo copia: qui si controlla che il motore faccia lo stesso.
    assert.equal(compareCards('jolly', 'botta'), 'a');
    assert.equal(compareCards('scudo', 'jolly'), 'b');
    assert.equal(compareCards('jolly', 'jolly'), 'draw');
});

test('il foglio regole cita i numeri del motore e si chiude', () => {
    mount();
    click('[data-action="rules"]');

    const sheet = document.querySelector('.sc-sheet-panel');
    assert.ok(sheet, 'il foglio regole si apre');
    const copy = sheet.textContent.replace(/\s+/g, ' ');

    assert.match(copy, new RegExp(`${DECK_SIZE} carte`));
    assert.match(copy, new RegExp(`${REGULATION_TURNS} turni`));
    assert.match(copy, /JOLLY batte tutto/);
    assert.match(copy, /il bottino non passa al turno dopo/);

    click('[data-action="sheet-close"]');
    assert.equal(document.querySelector('.sc-sheet-panel'), null, 'il foglio si chiude');
});

test('il toast del salvataggio mazzo sopravvive al rerender e poi scade', async () => {
    mount();
    click('[data-action="deck"]');

    const input = container.querySelector('#sc-deck-name');
    assert.ok(input, 'il campo nome mazzo esiste');
    input.value = 'Mazzo di prova';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));

    click('[data-action="deck-save"]');

    const saved = container.querySelectorAll('.sc-toast');
    assert.equal(saved.length, 1, 'un solo toast dopo il salvataggio');
    assert.match(saved[0].textContent, /salvato e attivo/);

    // Il bug storico: il rerender sostituiva innerHTML e portava via il toast.
    click('[data-action="deck-inc"][data-card="botta"]');
    const afterRerender = container.querySelectorAll('.sc-toast');
    assert.equal(afterRerender.length, 1, 'il rerender non duplica il toast');
    assert.match(afterRerender[0].textContent, /salvato e attivo/, 'il rerender non mangia il toast');

    await wait(2600);
    assert.equal(container.querySelector('.sc-toast'), null, 'il toast scade da solo');
});

test('il Quaderno entra in home a zero e una partita parte con quattro carte', () => {
    mount();
    assert.match(text(), /0\/8/, 'il Quaderno parte da zero sbagli su otto');

    click('[data-action="play"]');
    assert.equal(container.querySelector('.scippo-app')?.dataset.screen, 'match');
    assert.equal(container.querySelectorAll('.sc-hand-card').length, 4, 'mano da quattro carte');
    assert.ok(container.querySelector('[data-action="exit-taverna"]'), 'la partita ha una via d’uscita');
});

test('tre «RESTO A COMBATTERE» registrano l’uovo e lasciano il Quaderno a 1/8', async () => {
    mount();
    click('[data-action="play"]');

    for (let attempt = 1; attempt <= 3; attempt += 1) {
        click('[data-action="exit-taverna"]');
        await wait(0);
        const reconsider = container.querySelector('[data-action="exit-reconsider"]');
        assert.ok(reconsider, `il foglio «te ne vai?» si apre al giro ${attempt}`);
        reconsider.click();
        assert.equal(document.querySelector('.sc-sheet'), null, 'il foglio si chiude a ogni giro');
        if (attempt < 3) {
            assert.equal(container.querySelector('.sc-toast'), null, 'niente premio ai primi due giri');
        }
    }
    assert.match(container.querySelector('.sc-toast').textContent, /QUADERNO 1\/8/);

    // Il Quaderno sa cosa ha appena registrato.
    assert.deepEqual(loadQuaderno().eggs, ['annulla']);

    // Riaprire la vista equivale a ricaricare la pagina: il Quaderno ricorda.
    mount(false);
    click('[data-action="quaderno"]');
    assert.equal(container.querySelector('.sc-quaderno')?.dataset.screen, 'quaderno');
    assert.match(text(), /1\/8/);
    assert.equal(container.querySelectorAll('.scq-row.is-found').length, 1, 'una sola riga trovata');
});

test('a Quaderno incompleto la porta resta chiusa e l’ottava riga coperta', () => {
    window.localStorage.clear();
    const seeded = registerEgg(loadQuaderno(), 'annulla');
    saveQuaderno(seeded.quaderno);
    mount(false);

    click('[data-action="quaderno"]');
    assert.match(text(), new RegExp(CANTINA_COPY.refusal));
    assert.equal(container.querySelector('[data-action="cantina-sit"]'), null, 'niente tavolo 0 a metà Quaderno');

    // La riga cifrata: c'è il retro bruciato, non c'è nessun fronte leggibile.
    const covered = container.querySelector('.scq-covered');
    assert.ok(covered, 'l’ottava riga è una carta coperta');
    assert.equal(container.querySelector('.scq-sale-card--back'), null, 'senza perdere non si legge il retro');

    covered.click();
    assert.match(container.querySelector('.sc-toast').textContent, new RegExp(CANTINA_COPY.notYourTurn));
});

test('con otto sbagli si siede al tavolo 0, il JOLLY vince e la riga diventa leggibile', () => {
    window.localStorage.clear();
    let quaderno = loadQuaderno();
    EGG_IDS.forEach(id => {
        const result = registerEgg(quaderno, id);
        if (result.added) quaderno = result.quaderno;
    });
    assert.deepEqual(quaderno.eggs, EGG_IDS, 'gli otto sbagli sono tutti registrati');
    saveQuaderno(quaderno);
    mount(false);

    click('[data-action="quaderno"]');
    assert.match(text(), /8\/8/);

    click('[data-action="cantina-sit"]');
    const table = container.querySelector('.sc-cantina');
    assert.equal(table?.dataset.stage, 'table', 'si arriva al tavolo 0');
    assert.match(text(), /BOTTINO ZERO/);
    assert.equal(container.querySelector('.scq-sale-card--back'), null, 'al tavolo il retro non è ancora leggibile');

    click('[data-action="cantina-play"]');
    const reveal = container.querySelector('.sc-cantina');
    assert.equal(reveal?.dataset.stage, 'reveal', 'il turno si gioca e si rivela');
    assert.match(text(), /JOLLY\./, 'il banco mostra il JOLLY');
    assert.match(text(), /NON DOVEVO/, 'il banco sa di non dover vincere');

    // Il retro della carta del sale: qui sì, la riga si legge.
    const back = container.querySelector('.scq-sale-card--back .scq-line--back');
    assert.equal(back?.textContent.trim(), SECRET_LINE, 'la riga esce intera solo perdendo');

    click('[data-action="cantina-choose"][data-mode="write"]');
    const written = container.querySelector('.scq-line--back')?.textContent.trim();
    assert.ok(written, 'dopo SCRIVILA la riga resta a schermo');
    assert.notEqual(written, SECRET_LINE, 'scriverla la sbaglia');
    assert.match(text(), new RegExp(CANTINA_COPY.written));

    const stored = loadQuaderno();
    assert.equal(stored.cantina, 'transcribed', 'la scelta resta salvata');
    assert.ok(stored.transcriptions > 0, 'la trascrizione conta le volte che l’hai scritta');
    assert.notEqual(transcriptionFor(stored.transcriptions).text, SECRET_LINE, 'quello che resta scritto non è la riga vera');
});

test.after(() => {
    window.__scippoCleanup?.();
    // jsdom con `pretendToBeVisual` tiene vivo un timer per i frame: senza
    // close() il processo resta appeso per una decina di secondi a fine suite.
    window.close();
});
