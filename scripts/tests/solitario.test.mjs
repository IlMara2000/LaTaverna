import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SOLITAIRE_SUITS, createSolitaireDeck, createSolitaireGame, canMoveSolitaire,
    solitaireSourceCards, moveSolitaire, drawSolitaire, solitaireFoundationTarget
} from '../../src/dashboards/minigames/solitarioEngine.js';

const card = (suit, rank, faceUp = true) => ({ id: `${suit}-${rank}`, suit, rank, faceUp });
const emptyState = () => ({ stock: [], waste: [], foundations: [[], [], [], []], tableau: [[], [], [], [], [], [], []], moves: 0, won: false });
const tableau = (pile, index = 0) => ({ type: 'tableau', pile, index });
const foundation = pile => ({ type: 'foundation', pile });
const waste = { type: 'waste' };

test('Klondike uses exactly 52 distinct poker cards and deals seven correctly exposed columns', () => {
    const deck = createSolitaireDeck(() => 0.5);
    assert.equal(deck.length, 52);
    assert.equal(new Set(deck.map(entry => entry.id)).size, 52);
    for (const suit of SOLITAIRE_SUITS) {
        assert.deepEqual(deck.filter(entry => entry.suit === suit.id).map(entry => entry.rank).sort((a, b) => a - b), Array.from({ length: 13 }, (_, i) => i + 1));
    }
    const state = createSolitaireGame(() => 0.5);
    assert.deepEqual(state.tableau.map(pile => pile.length), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(state.stock.length, 24);
    for (const pile of state.tableau) assert.deepEqual(pile.map(entry => entry.faceUp), pile.map((_, index) => index === pile.length - 1));
    assert.ok(state.stock.every(entry => !entry.faceUp));
});

test('draw-one, recycling and repeated passes preserve order without mutating undo states', () => {
    const initial = emptyState();
    initial.stock = [card('cuori', 2, false), card('picche', 5, false), card('fiori', 7, false)];
    let state = initial;
    const firstPass = [];
    for (let i = 0; i < 3; i += 1) {
        state = drawSolitaire(state);
        firstPass.push(state.waste.at(-1).id);
    }
    assert.deepEqual(firstPass, ['fiori-7', 'picche-5', 'cuori-2']);
    assert.equal(initial.waste.length, 0);
    assert.equal(initial.stock.length, 3);
    assert.ok(initial.stock.every(entry => !entry.faceUp));
    const beforeRecycle = state;
    state = drawSolitaire(state);
    assert.equal(state.waste.length, 0);
    assert.equal(beforeRecycle.waste.length, 3);
    assert.ok(state.stock.every(entry => !entry.faceUp));
    const secondPass = [];
    for (let i = 0; i < 3; i += 1) {
        state = drawSolitaire(state);
        secondPass.push(state.waste.at(-1).id);
    }
    assert.deepEqual(secondPass, firstPass);
    assert.equal(state.moves, 7);
});

test('tableau requires descending alternating colors and only kings fill empty columns', () => {
    const state = emptyState();
    state.waste = [card('cuori', 6)];
    state.tableau[0] = [card('picche', 7)];
    state.tableau[1] = [card('quadri', 7)];
    state.tableau[2] = [card('fiori', 8)];
    assert.equal(canMoveSolitaire(state, waste, tableau(0)), true);
    assert.equal(canMoveSolitaire(state, waste, tableau(1)), false);
    assert.equal(canMoveSolitaire(state, waste, tableau(2)), false);
    assert.equal(canMoveSolitaire(state, waste, tableau(3)), false);
    state.waste = [card('cuori', 13)];
    assert.equal(canMoveSolitaire(state, waste, tableau(3)), true);
});

test('moving a full face-up sequence automatically flips the exposed card and remains undoable', () => {
    const state = emptyState();
    state.tableau[0] = [card('fiori', 2, false), card('cuori', 7), card('picche', 6), card('quadri', 5)];
    state.tableau[1] = [card('fiori', 8)];
    const before = JSON.stringify(state);
    const next = moveSolitaire(state, tableau(0, 1), tableau(1));
    assert.deepEqual(next.tableau[1].map(entry => entry.rank), [8, 7, 6, 5]);
    assert.equal(next.tableau[0].length, 1);
    assert.equal(next.tableau[0][0].faceUp, true);
    assert.equal(JSON.stringify(state), before);
    assert.equal(next.moves, 1);
    assert.equal(canMoveSolitaire(state, tableau(0, 0), tableau(1)), false);
    assert.equal(canMoveSolitaire(state, tableau(0, 1), tableau(0)), false);
});

test('hidden or incorrectly ordered sequences cannot be moved', () => {
    const state = emptyState();
    state.tableau[0] = [card('cuori', 7), card('quadri', 6)];
    state.tableau[1] = [card('picche', 8)];
    assert.deepEqual(solitaireSourceCards(state, tableau(0)), []);
    assert.equal(moveSolitaire(state, tableau(0), tableau(1)), state);
    assert.deepEqual(solitaireSourceCards(state, tableau(0, -1)), []);
    state.tableau[0] = [card('cuori', 7), card('picche', 5)];
    assert.equal(canMoveSolitaire(state, tableau(0), tableau(1)), false);
});

test('foundations accept only one card of their suit in ace-to-king order', () => {
    const state = emptyState();
    state.waste = [card('cuori', 1)];
    assert.deepEqual(solitaireFoundationTarget(state, waste), foundation(0));
    assert.equal(canMoveSolitaire(state, waste, foundation(1)), false);
    const next = moveSolitaire(state, waste, foundation(0));
    assert.equal(next.waste.length, 0);
    assert.equal(next.foundations[0][0].rank, 1);
    next.waste = [card('cuori', 3)];
    assert.equal(canMoveSolitaire(next, waste, foundation(0)), false);
    next.waste = [card('cuori', 2)];
    assert.equal(canMoveSolitaire(next, waste, foundation(0)), true);
    state.tableau[0] = [card('cuori', 2), card('picche', 1)];
    assert.equal(canMoveSolitaire(state, tableau(0), foundation(0)), false);
    assert.equal(solitaireFoundationTarget(state, tableau(0)), null);
});

test('a foundation top may return to a valid tableau column', () => {
    const state = emptyState();
    state.foundations[0] = [card('cuori', 1), card('cuori', 2)];
    state.tableau[0] = [card('picche', 3)];
    const next = moveSolitaire(state, foundation(0), tableau(0));
    assert.equal(next.foundations[0].length, 1);
    assert.deepEqual(next.tableau[0].map(entry => entry.rank), [3, 2]);
});

test('putting the final king onto its foundation wins and blocks further play', () => {
    const state = emptyState();
    state.foundations = SOLITAIRE_SUITS.map((suit, index) => Array.from({ length: index === 3 ? 12 : 13 }, (_, rank) => card(suit.id, rank + 1)));
    state.waste = [card('picche', 13)];
    const won = moveSolitaire(state, waste, foundation(3));
    assert.equal(won.won, true);
    assert.equal(won.foundations.flat().length, 52);
    assert.equal(moveSolitaire(won, foundation(3), tableau(0)), won);
    assert.equal(drawSolitaire(won), won);
    assert.equal(state.won, false);
});

test('long valid action sequences conserve all 52 cards', () => {
    let state = createSolitaireGame(() => 0.42);
    for (let step = 0; step < 500 && !state.won; step += 1) {
        const sources = [waste, ...state.tableau.flatMap((pile, index) => pile.map((_, cardIndex) => tableau(index, cardIndex)))];
        let next = state;
        for (const source of sources) {
            const target = solitaireFoundationTarget(state, source);
            if (target) { next = moveSolitaire(state, source, target); break; }
        }
        if (next === state) next = drawSolitaire(state);
        state = next;
        const allCards = [...state.stock, ...state.waste, ...state.tableau.flat(), ...state.foundations.flat()];
        assert.equal(allCards.length, 52);
        assert.equal(new Set(allCards.map(entry => entry.id)).size, 52);
    }
});
