import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addManaProduction,
    canPayMana,
    chooseManaProductionOption,
    emptyManaPool,
    manaProductionOptions,
    payMana,
} from '../../src/dashboards/magicRules.js';

test('recognizes only mana abilities payable by tapping without another cost', () => {
    assert.deepEqual(manaProductionOptions({ oracleText: '{T}: Add {C}{C}.', producedMana: ['C'] }), [['C', 'C']]);
    assert.deepEqual(manaProductionOptions({ oracleText: '{1}, {T}: Add {U} or {B}.', producedMana: ['U', 'B'] }), []);
    assert.deepEqual(manaProductionOptions({ oracleText: '{T}, Sacrifice Lotus Petal: Add one mana of any color.', producedMana: ['W', 'U', 'B', 'R', 'G'] }), []);
});

test('recognizes basic land types, including Wastes, without card text', () => {
    assert.deepEqual(manaProductionOptions({ typeLine: 'Basic Land — Plains', oracleText: '' }), [['W']]);
    assert.deepEqual(manaProductionOptions({ typeLine: 'Basic Land — Wastes', oracleText: '' }), [['C']]);
});

test('automatic choice selects the dual-land color that enables a spell', () => {
    const dualLand = { oracleText: '{T}: Add {G} or {U}.' };
    assert.equal(chooseManaProductionOption({ manaPool: emptyManaPool() }, dualLand, ['{U}']), 1);
    assert.equal(chooseManaProductionOption({ manaPool: { ...emptyManaPool(), U: 1 } }, dualLand, ['{U}{G}']), 0);
});

test('tapping adds the selected option and rejects an invalid option index', () => {
    const player = { manaPool: emptyManaPool(), colorIdentity: ['G', 'U'] };
    const land = { oracleText: '{T}: Add {G} or {U}.' };
    assert.deepEqual(addManaProduction(player, land, 1), ['U']);
    assert.equal(player.manaPool.U, 1);
    assert.deepEqual(addManaProduction(player, land, -1), []);
    assert.equal(player.manaPool.G, 0);
});

test('pays colored symbols before generic mana and keeps unspent mana', () => {
    const pool = { ...emptyManaPool(), C: 1, U: 1, G: 1 };
    assert.equal(canPayMana(pool, '{G}{2}'), true);
    assert.deepEqual(payMana(pool, '{G}{2}'), { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
    assert.equal(canPayMana({ ...emptyManaPool(), U: 2 }, '{G}{1}'), false);
});
