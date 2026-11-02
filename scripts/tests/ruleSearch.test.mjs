import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuleSearch, tokenize, snippetSegments, categoryLabel } from '../../src/services/ruleSearch.js';

const corpus = {
    passages: [
        { c: 'Combat', t: 'Attack of Opportunity', x: 'A hostile creature provokes an opportunity attack when it moves out of a creature\'s reach. The attack interrupts the provoking creature\'s movement, occurring right before the creature leaves the reach.' },
        { c: 'Combat', t: 'Reaction', x: 'A reaction is an instant response to a trigger of some kind. A reaction can occur after your turn but before the next creature\'s turn starts.' },
        { c: 'Spells', t: 'Fireball', x: 'A streak of fire shoots from your pointing finger to a point you choose within range. Each creature in a 20-foot radius must make a Dexterity saving throw.' },
        { c: 'Conditions', t: 'Poisoned', x: 'A poisoned creature has disadvantage on attack rolls and ability checks.' },
        { c: 'Abilities', t: 'Using Ability Scores', x: 'An ability check tests a character\'s or monster\'s innate talent and training in an effort to overcome a challenge.' },
    ],
};

test('tokenize maps italian rule terms to english', () => {
    const tokens = tokenize('opportunità di attacco');
    assert.ok(tokens.includes('opportunity'));
    assert.ok(tokens.includes('attack'));
    assert.ok(!tokens.includes('di'));
});

test('tokenize keeps english queries and strips stopwords', () => {
    const tokens = tokenize('the opportunity attack');
    assert.deepEqual(tokens, ['opportunity', 'attack']);
});

test('tokenize adds singular form of english plurals', () => {
    assert.ok(tokenize('spells').includes('spell'));
});

test('search ranks the matching rule passage first', () => {
    const search = createRuleSearch(corpus);
    const [first] = search('quando un mostro esce dalla portata provoca un attacco');
    assert.equal(first.title, 'Attack of Opportunity');
});

test('search works for a plain english query', () => {
    const search = createRuleSearch(corpus);
    const results = search('dexterity saving throw fireball');
    assert.equal(results[0].title, 'Fireball');
});

test('search returns empty for queries without usable terms', () => {
    const search = createRuleSearch(corpus);
    assert.deepEqual(search('come si fa?'), []);
    assert.deepEqual(search(''), []);
});

test('snippet marks the matched terms and keeps the original text', () => {
    const segments = snippetSegments('A poisoned creature has disadvantage on attack rolls.', ['poisoned']);
    const marked = segments.filter(segment => segment.mark).map(segment => segment.t);
    assert.deepEqual(marked, ['poisoned']);
    const plain = segments.filter(segment => !segment.mark).map(segment => segment.t).join('');
    assert.ok(plain.includes('creature has disadvantage'));
});

test('category labels translate the top level to italian', () => {
    assert.equal(categoryLabel('Combat'), 'Combattimento');
    assert.equal(categoryLabel('Classes / Druid'), 'Classi / Druid');
});
