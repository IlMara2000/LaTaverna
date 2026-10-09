import test from 'node:test';
import assert from 'node:assert/strict';
import { SCOPA_SUITS, createScopaDeck, captureOptions, primiera, scoreScopaRound, createScopaMatch, nextScopaRound, playScopaMove, chooseScopaMove } from '../../src/dashboards/minigames/scopaEngine.js';

const card = (value, suit = 'hearts') => ({ id: `${suit}-${value}`, suit, value, label: ({ 1: 'A', 8: 'J', 9: 'Q', 10: 'K' })[value] || String(value), name: String(value) });
function randomFrom(seed) {
    return () => {
        seed = (1664525 * seed + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}
function scenario({ hand = [], other = [], table = [], deck = [], captured = [[], []], lastCapture = null, totals = [0, 0] } = {}) {
    const match = createScopaMatch(randomFrom(1));
    Object.assign(match.round, { hands: [hand, other], table, deck, captured, lastCapture, turn: 0 });
    match.totals = totals;
    return match;
}

function inventory(round) {
    return [...round.deck, ...round.table, ...round.hands.flat(), ...round.captured.flat()];
}

test('deck contains exactly the requested 40 poker cards with J=8, Q=9, K=10', () => {
    const deck = createScopaDeck(randomFrom(9));
    assert.equal(deck.length, 40);
    assert.equal(new Set(deck.map(item => item.id)).size, 40);
    for (const suit of SCOPA_SUITS) {
        assert.deepEqual(deck.filter(item => item.suit === suit.id).sort((a, b) => a.value - b.value).map(item => item.label), ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K']);
    }
});

test('equal single-card captures take priority over all sums and offer the choice of suit', () => {
    const table = [card(2), card(3), card(5, 'diamonds'), card(5, 'spades')];
    assert.deepEqual(captureOptions(card(5, 'clubs'), table), [['diamonds-5'], ['spades-5']]);
    const match = scenario({ hand: [card(5, 'clubs')], table, other: [card(7)] });
    const before = JSON.stringify(match);
    assert.equal(playScopaMove(match, 0, 0, ['hearts-2', 'hearts-3']), false);
    assert.equal(JSON.stringify(match), before);
    assert.equal(playScopaMove(match, 0, 0, ['diamonds-5']), true);
    assert.equal(match.round.captured[0].length, 2);
    assert.equal(match.round.table.some(item => item.id === 'spades-5'), true);
});

test('sum captures enumerate all legal combinations without duplicates', () => {
    const table = [card(1), card(2), card(3), card(4)];
    assert.deepEqual(captureOptions(card(5), table), [['hearts-1', 'hearts-4'], ['hearts-2', 'hearts-3']]);
    assert.deepEqual(captureOptions(card(10), table), [['hearts-1', 'hearts-2', 'hearts-3', 'hearts-4']]);
    assert.deepEqual(captureOptions(card(2), [card(3), card(4)]), []);
});

test('a legal capture is mandatory, and a discard is allowed only without any capture', () => {
    const match = scenario({ hand: [card(3)], other: [card(7)], table: [card(1), card(2)] });
    assert.equal(playScopaMove(match, 0, 0), false);
    assert.equal(playScopaMove(match, 1, 0), false);
    assert.equal(playScopaMove(match, 0, 99), false);
    assert.equal(playScopaMove(match, 0, 0, ['hearts-1', 'hearts-1']), false);
    assert.equal(playScopaMove(match, 0, 0, ['hearts-1', 'hearts-2']), true);
    assert.deepEqual(match.round.sweeps, [1, 0]);
    assert.equal(match.round.lastMove.sweep, true);
    assert.equal(playScopaMove(match, 1, 0), true);
    assert.equal(match.round.lastMove.taken.length, 0);
});

test('emptying the table on the final play does not score scopa', () => {
    const match = scenario({ hand: [card(3)], table: [card(1), card(2)] });
    assert.equal(playScopaMove(match, 0, 0, ['hearts-1', 'hearts-2']), true);
    assert.equal(match.round.over, true);
    assert.deepEqual(match.round.sweeps, [0, 0]);
    assert.equal(match.round.lastMove.sweep, false);
});

test('leftovers go to the last capturing player, including the final discarded card', () => {
    const match = scenario({ hand: [card(1)], table: [card(9)], lastCapture: 1 });
    assert.equal(playScopaMove(match, 0, 0), true);
    assert.deepEqual(match.round.captured[1].map(item => item.value), [9, 1]);
    assert.equal(match.round.lastMove.leftoversOwner, 1);
    assert.equal(match.round.lastMove.leftovers.length, 2);
    assert.equal(match.round.table.length, 0);
    assert.equal(match.round.sweeps[1], 0);
});

test('primiera uses the best card of each suit and requires all four suits', () => {
    const sevens = SCOPA_SUITS.map(suit => card(7, suit.id));
    assert.deepEqual(primiera([...sevens, card(6)]), { total: 84, eligible: true });
    assert.deepEqual(primiera([card(7), card(6)]), { total: 21, eligible: false });
    assert.deepEqual(primiera([card(1), card(2, 'diamonds'), card(8, 'clubs'), card(6, 'spades')]), { total: 56, eligible: true });
});

test('scoring handles equal card and diamond counts, settebello and primiera ties', () => {
    const deck = createScopaDeck(randomFrom(2));
    const captured = [deck.filter(item => item.value % 2 === 1), deck.filter(item => item.value % 2 === 0)];
    const result = scoreScopaRound(captured, [2, 1]);
    assert.deepEqual(result.cardCounts, [20, 20]);
    assert.deepEqual(result.diamondCounts, [5, 5]);
    assert.deepEqual(result.points.cards, [0, 0]);
    assert.deepEqual(result.points.diamonds, [0, 0]);
    assert.deepEqual(result.points.settebello, [1, 0]);
    assert.deepEqual(result.points.primiera, [1, 0]);
    assert.deepEqual(result.totals, [4, 1]);
    const allFigures = [SCOPA_SUITS.map(suit => card(8, suit.id)), SCOPA_SUITS.map(suit => card(9, suit.id))];
    assert.deepEqual(scoreScopaRound(allFigures, [0, 0]).points.primiera, [0, 0]);
    assert.deepEqual(scoreScopaRound([[card(7)], [card(6)]], [0, 0]).points.primiera, [0, 0]);
});

test('crossing 11 while tied continues, then a lead at the end wins', () => {
    // Final capture earns player zero the card majority, with all other categories tied.
    const match = scenario({ hand: [card(2)], table: [card(2, 'clubs')], totals: [10, 11] });
    assert.equal(playScopaMove(match, 0, 0, ['clubs-2']), true);
    assert.deepEqual(match.totals, [11, 11]);
    assert.equal(match.over, false);
    assert.equal(nextScopaRound(match, randomFrom(5)), true);
    assert.equal(match.number, 2);
    assert.equal(match.round.turn, 1);
    assert.equal(nextScopaRound(match), false);
    Object.assign(match.round, { hands: [[card(2)], []], deck: [], table: [card(2, 'clubs')], captured: [[], []], turn: 0 });
    assert.equal(playScopaMove(match, 0, 0, ['clubs-2']), true);
    assert.deepEqual(match.totals, [12, 11]);
    assert.equal(match.over, true);
    assert.equal(match.winner, 0);
    assert.equal(nextScopaRound(match), false);
});

test('100 seeded rounds preserve all 40 cards, deal three at a time and end after 36 moves', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
        const match = createScopaMatch(randomFrom(seed));
        assert.deepEqual(match.round.hands.map(hand => hand.length), [3, 3]);
        assert.equal(match.round.table.length, 4);
        assert.equal(match.round.deck.length, 30);
        assert.ok(match.round.table.filter(item => item.value === 10).length < 3);
        let count = 0;
        while (!match.round.over && count < 40) {
            const player = match.round.turn;
            const move = chooseScopaMove(match.round, player);
            assert.ok(move);
            assert.equal(playScopaMove(match, player, move.index, move.ids), true);
            const cards = inventory(match.round);
            assert.equal(cards.length, 40);
            assert.equal(new Set(cards.map(item => item.id)).size, 40);
            assert.ok(match.round.hands.every(hand => hand.length <= 3));
            count += 1;
            if (count % 6 === 0 && count < 36) assert.deepEqual(match.round.hands.map(hand => hand.length), [3, 3]);
        }
        assert.equal(count, 36);
        assert.equal(match.round.captured.flat().length, 40);
        assert.equal(match.round.table.length, 0);
        assert.equal(match.round.deck.length, 0);
        const before = JSON.stringify(match);
        assert.equal(playScopaMove(match, match.round.turn, 0), false);
        assert.equal(JSON.stringify(match), before);
    }
});

test('seeded computer games reach a winner through multiple alternating rounds', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
        const random = randomFrom(seed);
        const match = createScopaMatch(random);
        while (!match.over && match.number < 30) {
            while (!match.round.over) {
                const player = match.round.turn;
                const move = chooseScopaMove(match.round, player);
                assert.equal(playScopaMove(match, player, move.index, move.ids), true);
            }
            if (!match.over) nextScopaRound(match, random);
        }
        assert.equal(match.over, true);
        assert.ok(match.totals[match.winner] >= 11);
        assert.ok(match.totals[match.winner] > match.totals[1 - match.winner]);
    }
});
