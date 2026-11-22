import test from 'node:test';
import assert from 'node:assert/strict';
import { mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { createEngineMatch, passPriority } from '../../src/dashboards/magic/engine/turn.js';
import { castToStack } from '../../src/dashboards/magic/engine/stack.js';
import { openChoice } from '../../src/dashboards/magic/engine/choices.js';
import { stepOf } from '../../src/dashboards/magic/engine/state.js';

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
const handCard = (uid, base = elf) => ({ ...base, uid });

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
    state.playersData.a.battlefield = [];
    state.playersData.b.battlefield = [];
    return state;
};

test('CR 117: la priorità parte dal giocatore attivo e passa solo con il «passa»', () => {
    const state = started();
    assert.equal(state.priority.playerId, 'a');
    assert.deepEqual(state.priority.passed, []);
    const passed = passPriority(state, 'a');
    assert.equal(passed.priority.playerId, 'b');
    assert.deepEqual(passed.priority.passed, ['a']);
    // Chi non ha la priorità non può passarla: non è una cortesia, è la regola.
    assert.throws(() => passPriority(passed, 'a'), /priorità/i);
    assert.equal(state.priority.playerId, 'a', 'lo stato di partenza non viene mutato');
});

test('CR 117.4: quando tutti passano con lo stack vuoto si cambia passo', () => {
    let state = passPriority(started(), 'a');
    state = passPriority(state, 'b');
    assert.equal(stepOf(state), 'beginCombat');
    assert.equal(state.priority.playerId, 'a', 'dopo il cambio di passo riparte chi ha il turno');
    assert.deepEqual(state.priority.passed, []);
});

test('CR 405/117: una magia risolve solo quando tutti hanno passato, ultima entrata per prima', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('foresta', { ...forest, power: '', toughness: '', manaCost: '' })];
    state.playersData.a.hand = [handCard('elfo-1')];
    const cast = castToStack(state, 'a', { uid: 'elfo-1' });
    assert.equal(cast.stack.length, 1);
    assert.equal(cast.stack[0].card.name, 'Elfo');
    assert.equal(cast.playersData.a.hand.length, 0, 'la carta ha lasciato la mano pagando il costo');
    assert.equal(cast.playersData.a.battlefield.length, 1, 'la creatura non è ancora in campo');
    assert.equal(cast.playersData.a.battlefield[0].tapped, true, 'la terra si è tappata per pagare');
    assert.equal(cast.priority.playerId, 'a', 'chi lancia riceve di nuovo la priorità');

    const waiting = passPriority(cast, 'a');
    assert.equal(waiting.stack.length, 1, 'con un solo «passa» la magia è ancora sullo stack');
    assert.equal(waiting.priority.playerId, 'b');

    const resolved = passPriority(waiting, 'b');
    assert.equal(resolved.stack.length, 0);
    assert.ok(resolved.playersData.a.battlefield.some(card => card.name === 'Elfo'));
    assert.equal(resolved.priority.playerId, 'a');
});

test('CR 117: senza priorità non si lancia nulla, nemmeno un istantaneo', () => {
    const state = started();
    state.playersData.b.hand = [handCard('risposta', { typeLine: 'Instant', manaCost: '{G}', oracleText: 'Draw a card.' })];
    assert.throws(() => castToStack(state, 'b', { uid: 'risposta' }), /priorità/i);
});

test('CR 307/308: una magia normale aspetta una fase principale, un istantaneo no', () => {
    let state = started();
    state = passPriority(state, 'a');
    state = passPriority(state, 'b'); // beginCombat
    assert.equal(stepOf(state), 'beginCombat');
    state.playersData.a.battlefield = [permanent('foresta', { ...forest, power: '', toughness: '', manaCost: '' })];
    state.playersData.a.hand = [handCard('lenta', { typeLine: 'Sorcery', manaCost: '{G}', name: 'Lenta', oracleText: 'Draw a card.' })];
    assert.throws(() => castToStack(state, 'a', { uid: 'lenta' }), /fase principale/i);

    state.playersData.a.hand = [handCard('risposta', { typeLine: 'Instant', manaCost: '{G}', name: 'Risposta', oracleText: 'Draw a card.' })];
    const cast = castToStack(state, 'a', { uid: 'risposta' });
    assert.equal(cast.stack.length, 1, 'l’istantaneo entra anche durante il combattimento');
});

test('CR 117.1a: una scelta in sospeso ferma la priorità di tutti', () => {
    const state = openChoice(started(), {
        kind: 'discard', playerId: 'a', prompt: 'Scarta una carta',
        options: [{ id: 'c1', label: 'Carta 1' }], min: 1, max: 1
    });
    assert.throws(() => passPriority(state, 'a'), /scelta in sospeso/i);
    assert.throws(() => passPriority(state, 'b'), /scelta in sospeso/i);
});

test('i passi veri arrivano fino al turno successivo passando la priorità', () => {
    let state = started();
    const seen = [];
    for (let guard = 0; guard < 12; guard += 1) {
        state = passPriority(state, 'a');
        state = passPriority(state, 'b');
        seen.push(stepOf(state));
        if (state.activePlayer === 'b' && stepOf(state) === 'main1') break;
    }
    assert.deepEqual(seen.slice(0, 4), ['beginCombat', 'declareAttackers', 'main2', 'end']);
    assert.ok(seen.includes('cleanup'), 'il turno passa dal passo di pulizia');
    assert.equal(state.activePlayer, 'b', 'senza attaccanti il turno passa all’altro giocatore');
    assert.equal(stepOf(state), 'main1');
});
