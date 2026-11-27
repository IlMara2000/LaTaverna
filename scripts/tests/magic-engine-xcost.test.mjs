import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { applyAction } from '../../src/dashboards/magic/engine/actions.js';
import { canPayMana, payMana, emptyManaPool } from '../../src/dashboards/magicRules.js';
import { stateViolations } from '../../src/dashboards/magic/engine/state.js';
import { parseCardAbilities } from '../../src/dashboards/magicEffects.js';
import { resolveStack } from '../../src/dashboards/magic/engine/stack.js';

const forest = {
    id: 'Foresta', name: 'Foresta', typeLine: 'Basic Land — Forest', manaCost: '', oracleText: '{T}: Add {G}.', power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 0, image: ''
};
const elf = {
    id: 'Elfo', name: 'Elfo', typeLine: 'Creature — Elf', manaCost: '{G}', oracleText: '', power: '1', toughness: '1', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 1, image: ''
};
const deck = () => Array.from({ length: 100 }, (_, index) => ({ ...(index < 60 ? forest : elf), quantity: 1 }));

const started = () => {
    let state = createMatch({
        players: [
            { id: 'a', name: 'Tu', cards: deck() },
            { id: 'b', name: 'Giocatore 2', cards: deck() }
        ]
    });
    state = mulliganAction(state, 'a', 'keep');
    state = mulliganAction(state, 'b', 'keep');
    state.playersData.a.hand = [];
    state.playersData.b.hand = [];
    state.playersData.a.battlefield = [];
    state.playersData.b.battlefield = [];
    return state;
};

test('il costo {X} cresce con il valore scelto per X', () => {
    const pool = { ...emptyManaPool(), C: 5 };
    assert.equal(canPayMana(pool, '{X}', 0), true, 'con X=0 non serve mana');
    assert.equal(canPayMana(pool, '{X}', 3), true, 'con X=3 e 5 incolori si paga');
    assert.equal(canPayMana(pool, '{X}', 6), false, 'con X=6 e 5 incolori non si paga');
});

test('il costo {2}{X} somma la parte generica e X', () => {
    const pool = { ...emptyManaPool(), C: 5 };
    assert.equal(canPayMana(pool, '{2}{X}', 0), true, 'X=0 costa solo {2}');
    assert.equal(canPayMana(pool, '{2}{X}', 3), true, 'X=3 costa 5');
    assert.equal(canPayMana(pool, '{2}{X}', 4), false, 'X=4 costerebbe 6');
});

test('payMana scala dal pool il costo con X', () => {
    const after = payMana({ ...emptyManaPool(), C: 4 }, '{2}{X}', 1);
    assert.equal(after.C, 1, '4 incolori meno (2 + 1) restano 1');
});

test('il costo colorato {G}{X} chiede il verde più X generico', () => {
    const pool = { ...emptyManaPool(), G: 1, C: 2 };
    assert.equal(canPayMana(pool, '{G}{X}', 2), true, 'verde più 2 incolori');
    assert.equal(canPayMana({ ...emptyManaPool(), C: 3 }, '{G}{X}', 0), false, 'senza verde non si paga');
});

test('il testo «X» resta generico finché non si lancia la magia', () => {
    const abilities = parseCardAbilities({ id: 'X', name: 'Combo', typeLine: 'Sorcery', manaCost: '{X}', oracleText: 'Draw X cards.' });
    assert.equal(abilities.spells[0].effects[0].x, true, 'L\'effetto sa che il numero è X');
});

test('lanciare con X=2 pesca due carte e tappa due terre', () => {
    const state = started();
    state.playersData.a.battlefield = Array.from({ length: 4 }, (_, index) => ({ ...forest, uid: `t-${index}`, instanceId: `t-${index}`, tapped: false }));
    state.playersData.a.hand = [{ ...elf, id: 'SpellX', name: 'Combo', typeLine: 'Sorcery', manaCost: '{X}', oracleText: 'Draw X cards.', cmc: 0, uid: 'spell-x' }];
    const libraryBefore = state.playersData.a.library.length;

    const after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'spell-x', xValue: 2 });

    assert.equal(after.playersData.a.library.length, libraryBefore - 2, 'Il grimorio cala di due carte');
    assert.equal(after.playersData.a.battlefield.filter(card => card.tapped).length, 2, 'Due terre pagano {X}');
    assert.ok(after.log.some(line => /peschi 2 carte/i.test(line)), 'Il diario dice quante carte hai pescato');
    assert.deepEqual(stateViolations(after), []);
});

test('lanciare con X=0 non tappa nulla', () => {
    const state = started();
    state.playersData.a.battlefield = Array.from({ length: 4 }, (_, index) => ({ ...forest, uid: `t-${index}`, instanceId: `t-${index}`, tapped: false }));
    state.playersData.a.hand = [{ ...elf, id: 'SpellX', name: 'Combo', typeLine: 'Sorcery', manaCost: '{X}', oracleText: 'Draw X cards.', cmc: 0, uid: 'spell-x' }];
    const libraryBefore = state.playersData.a.library.length;

    const after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'spell-x' });

    assert.equal(after.playersData.a.library.length, libraryBefore, 'X=0 non pesca');
    assert.equal(after.playersData.a.battlefield.filter(card => card.tapped).length, 0, 'X=0 è gratis');
    assert.deepEqual(stateViolations(after), []);
});

test('anche via stack la magia si risolve con il suo X', () => {
    const state = started();
    state.playersData.a.battlefield = Array.from({ length: 4 }, (_, index) => ({ ...forest, uid: `t-${index}`, instanceId: `t-${index}` }));
    state.playersData.a.hand = [{ ...elf, id: 'SpellX', name: 'Combo', typeLine: 'Sorcery', manaCost: '{X}', oracleText: 'Draw X cards.', cmc: 0, uid: 'spell-x' }];
    const libraryBefore = state.playersData.a.library.length;

    const onStack = applyAction(state, { type: 'castToStack', playerId: 'a', uid: 'spell-x', xValue: 3 });
    const resolved = resolveStack(onStack);

    assert.equal(resolved.playersData.a.library.length, libraryBefore - 3, 'Il valore scelto accompagna la magia sullo stack');
});

test('senza mana per {X} il lancio è rifiutato', () => {
    const state = started();
    state.playersData.a.battlefield = [];
    state.playersData.a.hand = [{ ...elf, id: 'SpellX', name: 'Combo', typeLine: 'Sorcery', manaCost: '{X}', oracleText: 'Draw X cards.', cmc: 0, uid: 'spell-x' }];
    assert.throws(() => applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'spell-x', xValue: 2 }), /mana/i);
});