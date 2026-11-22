import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GAME_VERSION, STEPS, STEP_INDEX, stateHash, stateViolations, stepOf, stepsView, stableStringify
} from '../../src/dashboards/magic/engine/state.js';
import { createMatch, mulliganAction, declareAttackers, advancePhase } from '../../src/dashboards/magicMatchEngine.js';

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
    let state = createMatch({
        players: [
            { id: 'a', name: 'Tu', cards: deck() },
            { id: 'b', name: 'Giocatore 2', cards: deck() }
        ]
    });
    state = mulliganAction(state, 'a', 'keep');
    state = mulliganAction(state, 'b', 'keep');
    return state;
};

test('i passi sono i dodici delle regole, in ordine', () => {
    assert.equal(STEPS.length, 12);
    assert.deepEqual(STEPS.map(step => step.id), [
        'untap', 'upkeep', 'draw', 'main1', 'beginCombat', 'declareAttackers',
        'declareBlockers', 'combatDamage', 'endCombat', 'main2', 'end', 'cleanup'
    ]);
    assert.equal(GAME_VERSION, 4);
    assert.equal(STEP_INDEX.declareBlockers, 6);
});

test('il passo si deduce dalle fasi del motore, combattimento compreso', () => {
    const state = started();
    assert.equal(stepOf(state), 'main1');
    let next = advancePhase(state, 'a');
    assert.equal(stepOf(next), 'declareAttackers');
    next.playersData.a.battlefield = [permanent('attaccante')];
    next = declareAttackers(next, 'a', ['attaccante']);
    assert.equal(stepOf(next), 'declareBlockers');
    const steps = stepsView(next);
    assert.equal(steps.filter(step => step.active).length, 1);
    assert.equal(steps.find(step => step.active).id, 'declareBlockers');
    assert.equal(steps.filter(step => step.done).length, 6);
});

test('una carta in due zone è una violazione, non un caso limite', () => {
    const state = started();
    const card = { ...permanent('doppia') };
    state.playersData.a.battlefield = [card];
    state.playersData.a.graveyard = [card];
    const problems = stateViolations(state);
    assert.equal(problems.length, 1);
    assert.equal(problems[0].reason, 'carta in due zone');
    // L'ordine segue le zone dello stato, non quello in cui il test le ha scritte.
    assert.deepEqual(problems[0].zones.sort(), ['battlefield', 'graveyard']);

    const clean = started();
    assert.deepEqual(stateViolations(clean), []);
});

test('l\'impronta dello stato è stabile e cambia solo quando cambia la partita', () => {
    const first = started();
    const copy = structuredClone(first);
    assert.equal(stateHash(first), stateHash(copy));
    assert.equal(stableStringify({ b: 1, a: 2 }), stableStringify({ a: 2, b: 1 }));

    const changed = structuredClone(first);
    changed.playersData.a.life -= 1;
    assert.notEqual(stateHash(changed), stateHash(first));
});
