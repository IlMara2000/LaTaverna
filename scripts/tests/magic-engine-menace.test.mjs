import test from 'node:test';
import assert from 'node:assert/strict';
import { mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { createEngineMatch } from '../../src/dashboards/magic/engine/turn.js';
import { combatActions, declareBlockers } from '../../src/dashboards/magic/engine/combat.js';
import { resetPriority } from '../../src/dashboards/magic/engine/priority.js';

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

/** Partita ferma nel passo dei bloccanti, con un solo attaccante. */
const blocking = attacker => {
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
    state.playersData.a.battlefield = [attacker];
    state.playersData.b.battlefield = [permanent('b1'), permanent('b2')];
    state.phase = 'combat';
    state.step = 'declareBlockers';
    state.combat = {
        step: 'blockers',
        attackerIds: [attacker.instanceId],
        defender: 'b',
        target: { kind: 'player', ownerId: 'b', uid: '' },
        blockers: {},
        order: {},
        damageDone: false,
        blockersDeclared: false
    };
    resetPriority(state, 'b');
    return state;
};

test('CR 702.111b: una sola creatura non può bloccare chi ha minaccia', () => {
    const state = blocking(permanent('att', { keywords: ['menace'] }));
    assert.throws(
        () => declareBlockers(state, 'b', { blockers: { att: ['b1'] } }),
        /minaccia/i
    );
});

test('CR 702.111b: con minaccia due creature bloccano davvero', () => {
    const state = blocking(permanent('att', { keywords: ['menace'] }));
    const blocked = declareBlockers(state, 'b', { blockers: { att: ['b1', 'b2'] } });
    assert.deepEqual(blocked.combat.blockers.att.sort(), ['b1', 'b2']);
});

test('il tavolo non offre un bloccante singolo contro la minaccia', () => {
    const state = blocking(permanent('att', { keywords: ['menace'] }));
    const declaration = combatActions(state, 'b').find(action => action.type === 'declareBlockers');
    assert.ok(declaration, 'La dichiarazione dei blocchi è disponibile');
    assert.deepEqual(declaration.choices.att, [], 'Nessun blocco singolo è legale');
});

test('senza minaccia il bloccante singolo resta fra le opzioni', () => {
    const state = blocking(permanent('att'));
    const declaration = combatActions(state, 'b').find(action => action.type === 'declareBlockers');
    assert.deepEqual(declaration.choices.att.sort(), ['b1', 'b2']);
});
