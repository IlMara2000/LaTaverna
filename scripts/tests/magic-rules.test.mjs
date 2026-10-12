import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addManaProduction, tapManaSource, spellNeedsTarget, resolveOracleText,
    canPayMana,
    chooseManaProductionOption,
    emptyManaPool,
    manaProductionOptions,
    payMana,
} from '../../src/dashboards/magicRules.js';

test('recognizes tap and mana activation costs without inventing sacrifice abilities', () => {
    assert.deepEqual(manaProductionOptions({ oracleText: '{T}: Add {C}{C}.', producedMana: ['C'] }), [['C', 'C']]);
    assert.deepEqual(manaProductionOptions({ oracleText: '{1}, {T}: Add {U} or {B}.', producedMana: ['U', 'B'] }), [['U'], ['B']]);
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

test('a basic land uses its only color even when the color selector names another color', () => {
    const player = {manaPool:emptyManaPool()}, land = {typeLine:'Basic Land — Island'};
    assert.deepEqual(tapManaSource(player,land,'G'),['U']);
    assert.equal(player.manaPool.U,1);
    assert.throws(()=>tapManaSource(player,land,'G'),/tappata/);
    assert.equal(player.manaPool.U,1);
});

test('Signet pays activation mana atomically and produces both colors', () => {
    const player = {manaPool:emptyManaPool()}, signet = {oracleText:'{1}, {T}: Add {G}{U}.'};
    assert.throws(()=>tapManaSource(player,signet),/insufficiente/);
    assert.equal(signet.tapped,undefined);
    player.manaPool.C=1;
    assert.deepEqual(tapManaSource(player,signet),['G','U']);
    assert.equal(player.manaPool.C,0);assert.equal(player.manaPool.G,1);assert.equal(player.manaPool.U,1);
    assert.ok(payMana(player.manaPool,'{G}{U}'));
});

test('mana creatures wait a turn unless they have haste; failed activations do not tap', () => {
    const player={manaPool:emptyManaPool()}, elf={typeLine:'Creature — Elf',oracleText:'{T}: Add {G}.',summoningSick:true};
    assert.throws(()=>tapManaSource(player,elf),/evocazione/);assert.equal(elf.tapped,undefined);
    elf.keywords=['Haste'];assert.deepEqual(tapManaSource(player,elf),['G']);
});

test('Command Tower respects identity; conditional and restricted mana is not granted freely', () => {
    assert.deepEqual(manaProductionOptions({oracleText:"{T}: Add one mana of any color in your commander's color identity."},['U','G']),[['U'],['G']]);
    assert.deepEqual(manaProductionOptions({oracleText:'{T}: Add {G}. Activate only if you control a creature.'}),[]);
    assert.deepEqual(manaProductionOptions({oracleText:'{T}: Add {C}{C}. Spend this mana only to cast artifact spells.'}),[]);
});

test('colored, hybrid, variable and commander costs consume exactly the required mana', () => {
    assert.ok(payMana({...emptyManaPool(),U:1,G:1},'{U/G}{U}'));
    assert.equal(payMana({...emptyManaPool(),C:2},'{G/P}'),null,'Phyrexian life cannot be paid with generic mana');
    assert.ok(payMana({...emptyManaPool(),G:1},'{G/P}'));
    assert.equal(payMana({...emptyManaPool(),G:1,C:3},'{X}{G}',2,2),null);
    assert.deepEqual(payMana({...emptyManaPool(),G:1,C:4},'{X}{G}',2,2),emptyManaPool());
});

test('permanent abilities do not require a casting target', () => {
    assert.equal(spellNeedsTarget({typeLine:'Creature — Wizard',oracleText:'{T}: Destroy target artifact.'}),false);
    assert.equal(spellNeedsTarget({typeLine:'Creature — Elf',oracleText:'When this creature enters, destroy target artifact.'}),false);
    assert.equal(spellNeedsTarget({typeLine:'Instant',oracleText:'This spell deals 3 damage to any target.'}),true);
});

test('damage aimed at a creature does not hit its controller or remove all identical cards', () => {
    const creature={id:'same',instanceId:'first',typeLine:'Creature',toughness:'2'}, other={...creature,instanceId:'second'};
    const state={playersData:{a:{life:40,battlefield:[creature,other],graveyard:[]}},playerNames:{a:'Alice'}};
    resolveOracleText({name:'Bolt',oracleText:'This spell deals 3 damage to any target.'},state,'a','card:a:first');
    assert.equal(state.playersData.a.life,40);assert.deepEqual(state.playersData.a.battlefield,[other]);
    assert.equal(state.playersData.a.graveyard.length,1);
});
