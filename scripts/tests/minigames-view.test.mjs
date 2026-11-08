/**
 * Test di fumo delle altre viste dei minigiochi.
 *
 * Sono le viste che nella storia del progetto hanno avuto correzioni di DOM e
 * layout: la scacchiera del tris, il tavolo della Briscola, la Scala 40 e il
 * tavolo di Solo. jsdom non fa layout, quindi qui non si prova che «entri nello
 * schermo»: si prova che la vista si monti, che disegni la struttura giusta e
 * che il primo gesto arrivi davvero al motore invece di perdersi.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { useDom } from './helpers/view-dom.mjs';

async function mountView(path, initName) {
    const window = useDom();
    document.body.innerHTML = '<div id="app"></div>';
    const container = document.getElementById('app');
    const module = await import(path);
    assert.equal(typeof module[initName], 'function', `${initName} non è esportata`);
    module[initName](container);
    return { window, container };
}

test('tic tac toe: la scacchiera locale è intera e il primo tocco viene accettato', async () => {
    const { window, container } = await mountView('../../src/dashboards/minigames/tictactoe.js', 'initTicTacToe');
    try {
        assert.ok(container.querySelector('#start-screen'), 'si parte dalla scelta della modalità');

        // La dimensione dichiarata deve essere quella disegnata: è l'invariante
        // dietro la correzione «scacchiera intera in partita».
        container.querySelector('#ttt-size-cycle').click();
        const size = container.querySelector('#ttt-size-copy').textContent.match(/(\d+)×(\d+)/);
        assert.ok(size, 'la dimensione è dichiarata in chiaro');
        const side = Number(size[1]);

        container.querySelector('#ttt-local-mode').click();
        const cells = container.querySelectorAll('[data-cell-index]');
        assert.equal(cells.length, side * side, `${side}×${side} caselle, tutte presenti`);
        cells.forEach(cell => assert.equal(cell.disabled, false, 'a partita nuova nessuna casella è bloccata'));

        const turnBefore = container.querySelector('#turn-indicator').textContent;
        container.querySelector('[data-cell-index="0"]').click();
        const first = container.querySelector('[data-cell-index="0"]');
        assert.equal(first.textContent.trim(), 'X', 'il primo simbolo è la X');
        assert.equal(first.disabled, true, 'la casella giocata non si rigioca');
        assert.notEqual(container.querySelector('#turn-indicator').textContent, turnBefore, 'il turno passa all’altro');
    } finally {
        window.close();
    }
});

test('briscola: dal livello si entra al tavolo con tre carte e la carta giocata parte', async () => {
    const { window, container } = await mountView('../../src/dashboards/minigames/briscola.js', 'initBriscola');
    try {
        const level = container.querySelector('#briscola-levels .game-level-button');
        assert.ok(level, 'la scala dei livelli è disegnata');
        level.click();

        assert.equal(container.querySelector('#briscola-start').hidden, true, 'la schermata iniziale si toglie');
        assert.equal(container.querySelector('.briscola-shell').hidden, false, 'il tavolo prende il suo posto');

        const hand = container.querySelectorAll('#briscola-player-hand [data-card-index]');
        assert.equal(hand.length, 3, 'tre carte in mano');
        assert.equal(container.querySelectorAll('#briscola-bot-hand .briscola-card').length, 3, 'tre carte coperte all’oste');
        assert.match(container.querySelector('#briscola-deck-count').textContent, /^\d+$/, 'il mazzo mostra quante carte restano');

        hand[0].click();
        assert.equal(container.querySelector('#briscola-status').textContent, 'CARTA GIOCATA', 'il gesto arriva allo stato');
        // La carta che vola vive su <body>, fuori dal contenitore della vista.
        assert.ok(document.querySelector('.briscola-flying-card'), 'la carta si stacca dalla mano');
    } finally {
        window.close();
    }
});

test('scala 40: il tavolo ha le carte in mano e l’aiuto si apre e si chiude', async () => {
    const { window, container } = await mountView('../../src/dashboards/minigames/scala40.js', 'initScala40');
    try {
        assert.ok(container.querySelector('.s40-table'), 'il tavolo è disegnato');
        assert.ok(container.querySelectorAll('.s40-hand .s40-card').length > 0, 'la mano del giocatore ha carte');
        assert.match(container.querySelector('.s40-hand-label').textContent, /LA TUA MANO/i);

        assert.equal(container.querySelector('[data-s40-help]').hidden, true, 'l’aiuto parte chiuso');
        container.querySelector('[data-s40="help"]').click();
        // Si rilegge il nodo ogni volta: la vista ridisegna il guscio, quindi un
        // riferimento tenuto da parte diventerebbe un nodo staccato dal DOM.
        assert.equal(container.querySelector('[data-s40-help]').hidden, false, 'l’aiuto si apre');
        container.querySelector('[data-s40="help-close"]').click();
        assert.equal(container.querySelector('[data-s40-help]').hidden, true, 'e si richiude');
    } finally {
        window.close();
    }
});

test('solo: dal livello si siede al tavolo con le carte in mano e i comandi', async () => {
    const { window, container } = await mountView('../../src/dashboards/minigames/solo.js', 'initSoloGame');
    try {
        const level = container.querySelector('#levels-container .game-level-button');
        assert.ok(level, 'la scala dei livelli è disegnata');
        level.click();

        assert.equal(container.querySelector('#start-screen'), null, 'la schermata iniziale viene rimossa');
        assert.ok(container.querySelector('#player-hand').children.length > 0, 'la mano del giocatore è piena');
        assert.ok(container.querySelector('#deck-draw'), 'il mazzo è cliccabile');
        assert.ok(container.querySelector('#btn-pass'), 'c’è il comando per passare il turno');
    } finally {
        window.close();
    }
});
