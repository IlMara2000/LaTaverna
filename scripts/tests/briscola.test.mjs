import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Exercise the existing game rules without loading its CSS or browser services.
const source = readFileSync(new URL('../../src/dashboards/minigames/briscola.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export function initBriscola', 'function initBriscola');

function loadGame(seed = 20260911) {
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x100000000;
    };
    const math = Object.create(Math);
    math.random = random;
    const context = vm.createContext({
        Math: math,
        getLevelDifficultyChance: () => 0.75,
        document: { querySelectorAll: () => [] },
        window: { clearTimeout() {} }
    });
    vm.runInContext(`${source}
        updateUI = () => {};
        globalThis.game = {
            SUITS, createState, createDeck, startMatch, cardBeats,
            drawAfterRound, chooseBotCard, renderCardInner, cardLabel
        };
    `, context, { filename: 'briscola.js' });
    return { ...context.game, random };
}

test('Briscola uses exactly A, 2–7, J, Q, K in all four poker suits', () => {
    const game = loadGame();
    const deck = game.createDeck();
    assert.equal(deck.length, 40);
    assert.equal(new Set(deck.map(card => `${card.suit}-${card.label}`)).size, 40);
    assert.deepEqual(Array.from(game.SUITS, suit => suit.id), ['cuori', 'quadri', 'fiori', 'picche']);
    assert.deepEqual(Array.from(game.SUITS, suit => suit.icon), ['♥', '♦', '♣', '♠']);
    for (const suit of game.SUITS) {
        assert.deepEqual(
            Array.from(deck.filter(card => card.suit === suit.id), card => card.label).sort(),
            ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'].sort()
        );
        assert.equal(suit.color, ['cuori', 'quadri'].includes(suit.id) ? '#c52e3a' : '#202331');
    }
});

test('Poker figures retain Briscola point values and the deck totals 120', () => {
    const game = loadGame();
    const deck = game.createDeck();
    const points = { A: 11, 3: 10, K: 4, Q: 3, J: 2, 7: 0, 6: 0, 5: 0, 4: 0, 2: 0 };
    for (const card of deck) assert.equal(card.points, points[card.label]);
    for (const suit of game.SUITS) {
        assert.equal(deck.filter(card => card.suit === suit.id).reduce((total, card) => total + card.points, 0), 30);
    }
    assert.equal(deck.reduce((total, card) => total + card.points, 0), 120);
});

test('Briscola ranking, opening suit and trump decide the winner', () => {
    const game = loadGame();
    const deck = game.createDeck();
    const card = (label, suit = 'fiori') => deck.find(candidate => candidate.label === label && candidate.suit === suit);
    const descending = ['A', '3', 'K', 'Q', 'J', '7', '6', '5', '4', '2'];
    for (let higher = 0; higher < descending.length; higher += 1) {
        for (let lower = higher + 1; lower < descending.length; lower += 1) {
            assert.equal(game.cardBeats(card(descending[higher]), card(descending[lower]), 'cuori'), true);
            assert.equal(game.cardBeats(card(descending[lower]), card(descending[higher]), 'cuori'), false);
        }
    }
    assert.equal(game.cardBeats(card('A', 'picche'), card('2', 'fiori'), 'cuori'), false, 'an off-suit ace cannot beat the opening suit');
    assert.equal(game.cardBeats(card('2', 'cuori'), card('A', 'fiori'), 'cuori'), true, 'the lowest trump beats a non-trump ace');
    assert.equal(game.cardBeats(card('A', 'fiori'), card('2', 'cuori'), 'cuori'), false, 'a non-trump cannot beat trump');
    assert.equal(game.cardBeats(card('3', 'cuori'), card('K', 'cuori'), 'cuori'), true, 'trump still follows Briscola ranking');
});

test('Numeric poker cards have the right pip count and readable Italian labels', () => {
    const game = loadGame();
    for (const card of game.createDeck()) {
        const html = game.renderCardInner(card);
        assert.ok(!html.includes('undefined'));
        assert.ok(game.cardLabel(card).includes(game.SUITS.find(suit => suit.id === card.suit).name));
        if (card.figure) {
            assert.ok(html.includes(`<b>${card.label}</b>`));
            assert.ok(html.includes(card.figure));
        } else {
            assert.equal((html.match(/--pip-x:/g) || []).length, card.label === 'A' ? 1 : Number(card.label));
        }
    }
});

test('500 complete matches consume all 40 cards over 20 tricks and preserve all 120 points', () => {
    const game = loadGame();
    const container = { querySelector: () => ({ hidden: false }) };
    for (let match = 0; match < 500; match += 1) {
        const state = game.createState();
        game.startMatch(container, state);
        assert.equal(state.players[0].length, 3);
        assert.equal(state.players[1].length, 3);
        assert.equal(state.deck.length, 33);
        assert.ok(state.briscola);
        const played = [];
        while (state.players[0].length || state.players[1].length) {
            state.table = [];
            const leadOwner = state.turn;
            for (const owner of [leadOwner, 1 - leadOwner]) {
                const index = owner === 1
                    ? game.chooseBotCard(state)
                    : Math.floor(game.random() * state.players[owner].length);
                assert.ok(state.players[owner][index], 'each participant can play a card');
                const card = state.players[owner].splice(index, 1)[0];
                played.push(`${card.suit}-${card.label}`);
                state.table.push({ card, owner });
            }
            const [first, second] = state.table;
            const winner = game.cardBeats(second.card, first.card, state.lastBriscolaSuit) ? second.owner : first.owner;
            state.scores[winner] += first.card.points + second.card.points;
            state.tricks += 1;
            state.turn = winner;
            game.drawAfterRound(state, winner);
            assert.equal(state.players[0].length, state.players[1].length);
            assert.ok(state.tricks <= 20);
        }
        assert.equal(state.tricks, 20);
        assert.equal(state.scores[0] + state.scores[1], 120);
        assert.equal(new Set(played).size, 40);
        assert.equal(state.deck.length, 0);
        assert.equal(state.briscola, null);
    }
});
