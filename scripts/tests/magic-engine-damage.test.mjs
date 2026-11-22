import test from 'node:test';
import assert from 'node:assert/strict';
import { mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { createEngineMatch } from '../../src/dashboards/magic/engine/turn.js';
import { dealCombatDamage } from '../../src/dashboards/magic/engine/combat.js';
import { SBA_RULES } from '../../src/dashboards/magic/engine/sba.js';

const forest = {
    id: 'Foresta', name: 'Foresta', typeLine: 'Basic Land — Forest', manaCost: '', oracleText: '{T}: Add {G}.',
    power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 0, image: ''
};
const elf = {
    id: 'Elfo', name: 'Elfo', typeLine: 'Creature — Elf', manaCost: '{G}', oracleText: '',
    power: '1', toughness: '1', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 1, image: ''
};
const deck = () => Array.from({ length: 100 }, (_, index) => ({ ...(index < 60 ? forest : elf), quantity: 1 }));
const permanent = (uid, overrides = {}) => ({
    uid, instanceId: uid, id: uid, name: uid, typeLine: 'Creature — Human', manaCost: '{1}{G}',
    oracleText: '', power: '2', toughness: '2', keywords: [], colors: ['G'], colorIdentity: ['G'],
    tapped: false, summoningSick: false, damageMarked: 0, counters: { plusOne: 0 },
    turnBoost: { power: 0, toughness: 0 }, ...overrides
});

const started = () => {
    let state = createEngineMatch({
        players: [
            { id: 'a', name: 'Tu', cards: deck() },
            { id: 'b', name: 'Giocatore 2', cards: deck() }
        ]
    });
    state = mulliganAction(state, 'a', 'keep');
    state = mulliganAction(state, 'b', 'keep');
    state.playersData.a.hand = [];
    state.playersData.b.hand = [];
    return state;
};

/**
 * Combattimento già pronto per il passo del danno: attaccanti, bloccanti e
 * ordine si passano a mano, così il test parla solo di CR 510.
 */
const damageReady = (attackers = [], blockers = []) => {
    const state = started();
    state.phase = 'combat';
    state.step = 'combatDamage';
    state.playersData.a.battlefield = attackers;
    state.playersData.b.battlefield = blockers;
    const map = {};
    for (const attacker of attackers) {
        const ids = blockers
            .filter(blocker => (blocker.blocks || []).includes(attacker.uid))
            .map(blocker => blocker.uid);
        if (ids.length) map[attacker.uid] = ids;
    }
    state.combat = {
        step: 'damage',
        attackerIds: attackers.map(card => card.instanceId),
        defender: 'b',
        blockers: map,
        order: map,
        damageDone: false,
        blockersDeclared: true
    };
    return state;
};
const pair = (attacker, blockers) => {
    const list = blockers.map(blocker => ({ ...permanent(blocker.uid, blocker), blocks: [attacker.uid] }));
    return damageReady([permanent(attacker.uid, attacker)], list);
};

test('CR 510.1c: il danno si assegna in ordine, non tutti sul primo', () => {
    const state = pair({ uid: 'att', power: '5', toughness: '5' }, [
        { uid: 'b1', power: '2', toughness: '2' },
        { uid: 'b2', power: '2', toughness: '2' }
    ]);
    const after = dealCombatDamage(state);
    assert.equal(after.playersData.b.battlefield.length, 0, 'due 2/2 prendono 2 e 3 danni');
    assert.equal(after.playersData.a.battlefield.length, 1);
    assert.equal(after.playersData.a.battlefield[0].damageMarked, 4);
    assert.equal(after.playersData.b.life, 40, 'senza trapassare il giocatore non prende nulla');
    assert.equal(after.combat.damageStep, 'done');
    assert.equal(after.lastSba.filter(entry => entry.rule === SBA_RULES.lethalDamage).length, 2);
});

test('CR 510.1c: fermarsi dopo il danno letale al primo bloccante', () => {
    const state = pair({ uid: 'att', power: '3', toughness: '3' }, [
        { uid: 'b1', power: '2', toughness: '2' },
        { uid: 'b2', power: '2', toughness: '2' }
    ]);
    const after = dealCombatDamage(state);
    assert.deepEqual(after.playersData.b.graveyard.map(card => card.name), ['b1']);
    assert.equal(after.playersData.b.battlefield[0].name, 'b2');
    assert.equal(after.playersData.b.battlefield[0].damageMarked, 1);
    assert.equal(after.playersData.a.battlefield.length, 0, 'il 3/3 muore per i 4 danni dei due bloccanti');
});

test('CR 510.1c: trapassare porta al giocatore solo il danno che avanza', () => {
    const state = pair({ uid: 'att', power: '6', toughness: '6', keywords: ['Trample'] }, [
        { uid: 'b1', power: '2', toughness: '2' },
        { uid: 'b2', power: '2', toughness: '2' }
    ]);
    const after = dealCombatDamage(state);
    assert.equal(after.playersData.b.battlefield.length, 0);
    assert.equal(after.playersData.b.life, 38);
    assert.equal(after.playersData.a.battlefield.length, 1, 'il 6/6 sopravvive ai 4 danni');
});

test('CR 510.1c: con tocco letale basta un danno per bloccante', () => {
    const state = pair({ uid: 'att', power: '1', toughness: '1', keywords: ['Deathtouch'] }, [
        { uid: 'grande', power: '5', toughness: '5' }
    ]);
    const after = dealCombatDamage(state);
    assert.equal(after.playersData.b.battlefield.length, 0, 'il 5/5 muore per un danno da tocco letale');
    assert.equal(after.playersData.a.battlefield.length, 0, 'l’1/1 muore per i 5 danni');
    assert.equal(after.lastSba.filter(entry => entry.rule === SBA_RULES.deathtouch).length, 1);
});

test('CR 510.4: con prima colpo ci sono due passate di danno', () => {
    const state = pair({ uid: 'att', power: '2', toughness: '2', keywords: ['First strike'] }, [
        { uid: 'b1', power: '2', toughness: '2' }
    ]);
    const first = dealCombatDamage(state);
    assert.equal(first.combat.damageStep, 'first');
    assert.equal(first.playersData.b.battlefield.length, 0, 'il bloccante muore nel primo passaggio');
    assert.equal(first.playersData.a.battlefield[0].damageMarked, 0, 'e non fa danno di ritorno');

    const normal = dealCombatDamage(first);
    assert.equal(normal.combat.damageStep, 'done');
    assert.throws(() => dealCombatDamage(normal), /già stato assegnato/i);
});

test('CR 510.4: senza prima colpo il danno è una passata sola', () => {
    const state = pair({ uid: 'att', power: '2', toughness: '2' }, [{ uid: 'b1', power: '2', toughness: '2' }]);
    const after = dealCombatDamage(state);
    assert.equal(after.combat.damageStep, 'done');
    assert.equal(after.playersData.a.battlefield.length, 0);
    assert.equal(after.playersData.b.battlefield.length, 0);
});

test('CR 510.1c: prima colpo e trapassare spostano subito l’eccesso', () => {
    const state = pair({ uid: 'att', power: '2', toughness: '2', keywords: ['First strike', 'Trample'] }, [
        { uid: 'b1', power: '1', toughness: '1' }
    ]);
    const first = dealCombatDamage(state);
    assert.equal(first.playersData.b.battlefield.length, 0);
    assert.equal(first.playersData.b.life, 39, 'un danno passa al giocatore già nel primo passaggio');
});

test('CR 510.1a: un attaccante non bloccato colpisce il giocatore e i comandanti contano', () => {
    const state = damageReady([permanent('cmd', { power: '3', toughness: '3', isCommander: true })], []);
    const after = dealCombatDamage(state);
    assert.equal(after.playersData.b.life, 37);
    assert.equal(after.playersData.b.commanderDamage.cmd, 3);
    assert.equal(after.playersData.a.battlefield[0].tapped, false, 'tappare è del passo degli attaccanti, non del danno');
});
