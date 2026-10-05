import test from 'node:test';
import assert from 'node:assert/strict';
import { formatManabrewCommanderList } from '../../src/dashboards/magicManabrew.js';

const cards = [
    { id: 'c1', name: 'Atraxa, Praetors’ Voice' },
    { id: 'c2', name: 'Sol Ring' },
    { id: 'c3', name: 'Command Tower' },
];

test('exports one Commander in its own section and keeps mainboard quantities', () => {
    const text = formatManabrewCommanderList({ commanders: ['c1'], cards: [
        { cardId: 'c1', quantity: 1 }, { cardId: 'c2', quantity: 1 }, { cardId: 'c3', quantity: 4 },
    ] }, cards);
    assert.equal(text, 'Commander\n1 Atraxa, Praetors’ Voice\n\nDeck\n1 Sol Ring\n4 Command Tower');
});

test('exports two partner commanders without counting them in the mainboard', () => {
    const text = formatManabrewCommanderList({ commanders: ['c1', 'c2'], cards: [
        { cardId: 'c1', quantity: 1 }, { cardId: 'c2', quantity: 1 }, { cardId: 'c3', quantity: 1 },
    ] }, cards);
    assert.equal(text, 'Commander\n1 Atraxa, Praetors’ Voice\n1 Sol Ring\n\nDeck\n1 Command Tower');
});

test('requires every selected commander to be in the exported deck', () => {
    assert.throws(() => formatManabrewCommanderList({ commanders: ['missing'], cards: [] }, cards), /non è presente/);
});
