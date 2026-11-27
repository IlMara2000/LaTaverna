import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { applyAction, legalActions } from '../../src/dashboards/magic/engine/actions.js';
import { applyStateBasedActions } from '../../src/dashboards/magic/engine/sba.js';
import { stateViolations } from '../../src/dashboards/magic/engine/state.js';
import { isPermanentCard } from '../../src/dashboards/magicRules.js';
import { parseCardAbilities } from '../../src/dashboards/magicEffects.js';

const forest = {
    id: 'Foresta', name: 'Foresta', typeLine: 'Basic Land — Forest', manaCost: '', oracleText: '{T}: Add {G}.', power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 0, image: ''
};
const elf = {
    id: 'Elfo', name: 'Elfo', typeLine: 'Creature — Elf', manaCost: '{G}', oracleText: '', power: '1', toughness: '1', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 1, image: ''
};
const deck = () => Array.from({ length: 100 }, (_, index) => ({ ...(index < 60 ? forest : elf), quantity: 1 }));

const planeswalker = {
    id: 'PlaneswalkerTest', name: 'Planeswalker Test', typeLine: 'Planeswalker — Test',
    manaCost: '{2}{G}', oracleText: '+1: Draw a card.\n-3: Destroy target creature.', loyalty: 4,
    power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 3, image: ''
};
const handCard = (uid, base = elf) => ({ ...base, uid });

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
    state.playersData.a.battlefield = Array.from({ length: 4 }, (_, index) => ({ ...handCard(`terra-${index}`, forest), instanceId: `terra-${index}` }));
    state.playersData.b.battlefield = [];
    return state;
};

/** La partita con il planeswalker già in campo. */
const withPlaneswalker = () => {
    const state = started();
    state.playersData.a.battlefield.push({ ...handCard('pw-1', planeswalker), instanceId: 'pw-1' });
    return state;
};

test('planeswalker is recognized as a permanent card', () => {
    assert.equal(isPermanentCard(planeswalker), true, 'Planeswalker deve essere un permanent card');
});

test('le abilità di lealtà sono lette una per riga, con il loro cambiamento', () => {
    const abilities = parseCardAbilities(planeswalker);
    assert.deepEqual(abilities.loyalty.map(ability => ability.change), [1, -3]);
    assert.deepEqual(abilities.loyalty.map(ability => ability.text), ['+1: Draw a card.', '-3: Destroy target creature.']);
    assert.deepEqual(abilities.loyalty.map(ability => ability.effects), [[{ type: 'draw', count: 1 }], [{ type: 'destroy', scope: 'target' }]]);
    assert.deepEqual(abilities.manual, [], 'Nessuna riga resta da gestire a mano');
});

test('il planeswalker entra in campo con la sua lealtà', () => {
    const state = started();
    state.playersData.a.hand = [handCard('pw-1', planeswalker)];
    const after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'pw-1' });
    const inPlay = after.playersData.a.battlefield.find(card => card.uid === 'pw-1');
    assert.ok(inPlay, 'Planeswalker in campo');
    assert.equal(inPlay.loyalty, 4, 'Entra con la lealtà stampata');
    assert.deepEqual(stateViolations(after), []);
});

test('il +1 alza la lealtà e pesca', () => {
    const state = withPlaneswalker();
    const libraryBefore = state.playersData.a.library.length;
    const after = applyAction(state, { type: 'activateLoyalty', playerId: 'a', uid: 'pw-1', index: 0 });
    const walker = after.playersData.a.battlefield.find(card => card.uid === 'pw-1');
    assert.equal(walker.loyalty, 5, 'Da 4 a 5');
    assert.equal(after.playersData.a.library.length, libraryBefore - 1, 'Pesca una carta');
    assert.deepEqual(stateViolations(after), []);
});

test('il -3 distrugge la creatura bersaglio e scende la lealtà', () => {
    const state = withPlaneswalker();
    state.playersData.b.battlefield = [{ ...handCard('elfo-b', elf), instanceId: 'elfo-b' }];
    const after = applyAction(state, { type: 'activateLoyalty', playerId: 'a', uid: 'pw-1', index: 1, target: 'card:b:elfo-b' });
    const walker = after.playersData.a.battlefield.find(card => card.uid === 'pw-1');
    assert.equal(walker.loyalty, 1, 'Da 4 a 1');
    assert.equal(after.playersData.b.battlefield.some(card => card.uid === 'elfo-b'), false, 'La creatura non è più in campo');
    assert.equal(after.playersData.b.graveyard.some(card => card.uid === 'elfo-b'), true, 'Va al cimitero');
});

test('le abilità di lealtà compaiono fra le mosse legali', () => {
    const actions = legalActions(withPlaneswalker(), 'a');
    const loyalty = actions.filter(action => action.type === 'activateLoyalty');
    assert.equal(loyalty.length, 2, 'Due abilità disponibili');
    assert.ok(loyalty.some(action => /\+1/.test(action.label)), 'Il +1 si vede');
    assert.ok(loyalty.some(action => action.requiresTarget), 'Il -3 chiede un bersaglio');
});

test('una sola abilità di lealtà per turno', () => {
    const state = withPlaneswalker();
    const once = applyAction(state, { type: 'activateLoyalty', playerId: 'a', uid: 'pw-1', index: 0 });
    assert.throws(
        () => applyAction(once, { type: 'activateLoyalty', playerId: 'a', uid: 'pw-1', index: 0 }),
        /lealtà/i
    );
});

test('non si può scendere sotto zero di lealtà', () => {
    const state = withPlaneswalker();
    state.playersData.a.battlefield.find(card => card.uid === 'pw-1').loyalty = 2;
    assert.throws(
        () => applyAction(state, { type: 'activateLoyalty', playerId: 'a', uid: 'pw-1', index: 1, target: 'card:b:elfo-b' }),
        /lealtà/i
    );
});

test('un planeswalker a zero lealtà va al cimitero (704.5i)', () => {
    const state = withPlaneswalker();
    state.playersData.a.battlefield.find(card => card.uid === 'pw-1').loyalty = 0;
    const after = applyStateBasedActions(state);
    assert.equal(after.playersData.a.battlefield.some(card => card.uid === 'pw-1'), false, 'Non resta in campo');
    assert.ok(after.playersData.a.graveyard.some(card => card.uid === 'pw-1'), 'Va al cimitero');
    assert.ok(after.lastSba.some(entry => entry.rule === '704.5i'), 'Il diario cita la regola');
});
