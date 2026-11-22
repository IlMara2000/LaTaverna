import test from 'node:test';
import assert from 'node:assert/strict';
import { mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { createEngineMatch, passPriority } from '../../src/dashboards/magic/engine/turn.js';
import { castToStack } from '../../src/dashboards/magic/engine/stack.js';
import { openChoice } from '../../src/dashboards/magic/engine/choices.js';
import { applyAction, legalActions } from '../../src/dashboards/magic/engine/actions.js';
import { viewFor } from '../../src/dashboards/magic/engine/view.js';
import { stateViolations, stepOf } from '../../src/dashboards/magic/engine/state.js';

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

test('la vista porta lo stack con chi l’ha lanciata, senza mani nascoste', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('foresta', { ...forest, power: '', toughness: '', manaCost: '' })];
    state.playersData.a.hand = [handCard('elfo-1'), handCard('segreto')];
    state = castToStack(state, 'a', { uid: 'elfo-1' });
    const view = viewFor(state, 'b');
    assert.equal(view.stack.length, 1);
    assert.equal(view.stack[0].sourceName, 'Elfo');
    assert.equal(view.stack[0].controllerName, 'Tu');
    assert.equal(view.stack[0].mine, false);
    assert.equal(view.priority.mine, false);
    assert.match(view.priority.label, /Priorità di Tu/);
    assert.deepEqual(JSON.parse(JSON.stringify(view)), view, 'il view model resta serializzabile');
    assert.equal(JSON.stringify(view).includes('segreto'), false, 'la mano dell’avversario non esce dal view model');
    assert.equal(view.opponents[0].hand, undefined);
});

test('la scelta in sospeso arriva senza opzioni a chi non deve scegliere', () => {
    const state = openChoice(started(), {
        kind: 'discard', playerId: 'a', prompt: 'Scarta una carta',
        options: [{ id: 'c1', label: 'Carta segreta' }, { id: 'c2', label: 'Altra' }], min: 1, max: 1
    });
    const mine = viewFor(state, 'a').pendingChoice;
    assert.equal(mine.mine, true);
    assert.equal(mine.options.length, 2);
    assert.equal(mine.prompt, 'Scarta una carta');
    const other = viewFor(state, 'b').pendingChoice;
    assert.equal(other.mine, false);
    assert.equal(other.hidden, true);
    assert.deepEqual(other.options, []);
    assert.match(other.prompt, /avversario/);
    assert.equal(JSON.stringify(viewFor(state, 'b')).includes('Carta segreta'), false);
});

test('CR 405.1: lo stack è una pila, l’ultima magia lanciata si risolve per prima', () => {
    let state = started();
    state.playersData.a.battlefield = [
        permanent('foresta-1', { ...forest, power: '', toughness: '', manaCost: '' }),
        permanent('foresta-2', { ...forest, name: 'Foresta 2', power: '', toughness: '', manaCost: '' })
    ];
    state.playersData.a.hand = [
        handCard('primo', { typeLine: 'Instant', manaCost: '{G}', name: 'Primo', oracleText: 'Draw a card.' }),
        handCard('secondo', { typeLine: 'Instant', manaCost: '{G}', name: 'Secondo', oracleText: 'Draw a card.' })
    ];
    state = castToStack(state, 'a', { uid: 'primo' });
    state = castToStack(state, 'a', { uid: 'secondo' });
    assert.deepEqual(state.stack.map(item => item.card.name), ['Primo', 'Secondo']);

    state = passPriority(state, 'a');
    state = passPriority(state, 'b');
    assert.equal(state.stack.length, 1);
    assert.equal(state.stack[0].card.name, 'Primo', 'la seconda magia è uscita per prima');
    assert.match(state.log[0], /Secondo/);

    state = passPriority(state, 'a');
    state = passPriority(state, 'b');
    assert.equal(state.stack.length, 0);
    assert.match(state.log[0], /Primo/);
    assert.equal(state.playersData.a.graveyard.length, 2, 'le due magie sono finite nel cimitero');
});

test('le mosse legali nello stato M1 seguono la priorità e lo stack', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('foresta', { ...forest, power: '', toughness: '', manaCost: '' })];
    state.playersData.a.hand = [handCard('elfo-1'), handCard('terra-1', forest)];
    const mine = legalActions(state, 'a');
    const types = mine.map(action => action.type);
    assert.ok(types.includes('passPriority'));
    assert.ok(types.includes('castToStack'), 'la creatura è pagabile con la foresta');
    assert.equal(new Set(mine.map(action => action.id)).size, mine.length, 'gli identificativi non si ripetono');
    assert.deepEqual(legalActions(state, 'b'), [], 'chi non ha priorità non ha mosse');

    state = castToStack(state, 'a', { uid: 'elfo-1' });
    const after = legalActions(state, 'a');
    assert.ok(!after.some(action => action.type === 'castToStack' && action.uid === 'elfo-1'));
    assert.equal(stepOf(state), 'main1');
});

test('le nuove mosse passano da applyAction come le vecchie', () => {
    let state = started();
    state = applyAction(state, { type: 'passPriority', playerId: 'a' });
    assert.equal(state.priority.playerId, 'b');
    assert.throws(() => applyAction(state, { type: 'passPriority', playerId: 'a' }), /priorità/i);
    assert.throws(() => applyAction(state, { type: 'resolveCombat', playerId: 'a' }), /passando la priorità/i);
});

test('CR 509/510 dal tavolo: due bloccanti dichiarati con una mossa e danno in ordine', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('att', { power: '3', toughness: '3' })];
    state = passPriority(state, 'a');
    state = passPriority(state, 'b'); // beginCombat
    state = passPriority(state, 'a');
    state = passPriority(state, 'b'); // declareAttackers
    assert.equal(stepOf(state), 'declareAttackers');

    state = applyAction(state, { type: 'declareAttackers', playerId: 'a', uids: ['att'], defender: 'b' });
    assert.equal(stepOf(state), 'declareBlockers');
    assert.equal(state.combat.step, 'blockers');

    state.playersData.b.battlefield = [permanent('b1'), permanent('b2')];
    state = applyAction(state, {
        type: 'declareBlockers', playerId: 'b',
        blockers: { att: ['b1', 'b2'] }, order: { att: ['b2', 'b1'] }
    });
    assert.deepEqual(state.combat.order.att, ['b2', 'b1']);
    assert.deepEqual(stateViolations(state), []);

    state = passPriority(state, 'a');
    state = passPriority(state, 'b'); // combatDamage
    assert.equal(stepOf(state), 'combatDamage');

    state = passPriority(state, 'a');
    state = passPriority(state, 'b'); // danno risolto
    assert.equal(stepOf(state), 'endCombat');
    // Ordine b2, b1: b2 prende 2 e muore, b1 prende il terzo danno e resta con 1.
    assert.equal(state.playersData.b.battlefield.length, 1);
    assert.equal(state.playersData.b.battlefield[0].damageMarked, 1);
    assert.equal(state.playersData.a.battlefield.length, 0, 'il 3/3 muore per il danno di ritorno');
    assert.equal(state.playersData.b.life, 40);
    assert.deepEqual(stateViolations(state), []);
});
