import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createMatch, mulliganAction, playLand, advancePhase, declareAttackers, declareBlockers, passTurn
} from '../../src/dashboards/magicMatchEngine.js';
import { applyAction, isLegal, legalActions } from '../../src/dashboards/magic/engine/actions.js';
import { viewFor } from '../../src/dashboards/magic/engine/view.js';
import { stateHash, stateViolations } from '../../src/dashboards/magic/engine/state.js';
import { createRng, shuffleWith } from '../../src/dashboards/magic/engine/random.js';

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

test('una mossa tipizzata fa esattamente quello che fa la funzione del motore', () => {
    const state = started();
    state.playersData.a.hand = [handCard('terra-1', forest)];
    const viaAction = applyAction(state, { type: 'playLand', playerId: 'a', uid: 'terra-1' });
    const viaEngine = playLand(state, 'a', 'terra-1');
    assert.equal(stateHash(viaAction), stateHash(viaEngine));
    assert.equal(state.playersData.a.hand.length, 1, 'lo stato di partenza non viene mutato');
});

test('una mossa non legale è rifiutata dal motore, non solo nascosta', () => {
    const state = started();
    state.playersData.a.hand = [handCard('elfo-1')];
    assert.equal(isLegal(state, { type: 'playLand', playerId: 'a', uid: 'elfo-1' }), false);
    assert.throws(() => applyAction(state, { type: 'playLand', playerId: 'a', uid: 'elfo-1' }), /terra/i);
    assert.throws(() => applyAction(state, { type: 'teleport', playerId: 'a' }), /non riconosciuta/i);
});

test('le mosse legali sono quelle vere: terra, pass e niente magie non pagabili', () => {
    const state = started();
    state.playersData.a.hand = [handCard('terra-1', forest), { ...handCard('costosa'), manaCost: '{G}{G}{G}' }];
    const actions = legalActions(state, 'a');
    const types = actions.map(action => action.type);
    assert.ok(types.includes('playLand'));
    assert.ok(types.includes('pass'));
    assert.ok(!actions.some(action => action.type === 'castSpell' && action.uid === 'costosa'),
        'senza mana la magia non è una mossa legale');
    assert.equal(new Set(actions.map(action => action.id)).size, actions.length, 'gli identificativi non si ripetono');
});

test('giocare la terra toglie la mossa dall\'elenco e apre il lancio pagabile', () => {
    const state = started();
    state.playersData.a.hand = [handCard('terra-1', forest), handCard('elfo-1')];
    const before = legalActions(state, 'a');
    assert.equal(before.filter(action => action.type === 'playLand').length, 1);
    assert.ok(!before.some(action => action.type === 'castSpell'), 'senza terre il {G} non è pagabile');

    const after = applyAction(state, { type: 'playLand', playerId: 'a', uid: 'terra-1' });
    const actions = legalActions(after, 'a');
    assert.ok(!actions.some(action => action.type === 'playLand'), 'una terra per turno');
    assert.ok(actions.some(action => action.type === 'castSpell' && action.uid === 'elfo-1'));
});

test('fuori turno resta solo la risposta istantanea pagabile', () => {
    const state = started();
    state.playersData.b.hand = [
        { ...handCard('risposta'), typeLine: 'Instant', manaCost: '{G}', oracleText: 'Draw a card.' },
        { ...handCard('lenta'), typeLine: 'Sorcery', manaCost: '{G}', oracleText: 'Draw a card.' }
    ];
    state.playersData.b.battlefield = [permanent('foresta', { ...forest, typeLine: 'Basic Land — Forest', power: '', toughness: '' })];
    const actions = legalActions(state, 'b');
    assert.deepEqual(actions.map(action => action.type), ['castResponse']);
    assert.equal(actions[0].uid, 'risposta');
    assert.ok(!actions.some(action => action.type === 'pass'), 'fuori turno non si passa');
});

test('chi attacca esclude tappate, appena evocate e Defender', () => {
    const state = started();
    state.playersData.a.battlefield = [
        permanent('pronta'),
        permanent('tappata', { tapped: true }),
        permanent('malata', { summoningSick: true }),
        permanent('muro', { keywords: ['Defender'] })
    ];
    const combat = advancePhase(state, 'a');
    const action = legalActions(combat, 'a').find(entry => entry.type === 'declareAttackers');
    assert.ok(action, 'la scelta degli attaccanti è una mossa legale');
    assert.deepEqual(action.choices, ['pronta']);
});

test('i bloccanti proposti rispettano volare e portata', () => {
    const state = started();
    state.playersData.a.battlefield = [permanent('angelo', { keywords: ['flying'] })];
    state.playersData.b.battlefield = [
        permanent('orso'),
        permanent('pegaso', { keywords: ['flying'] }),
        permanent('arciere', { keywords: ['reach'] })
    ];
    const declared = declareAttackers(advancePhase(state, 'a'), 'a', ['angelo']);
    const action = legalActions(declared, 'b').find(entry => entry.type === 'declareBlockers');
    assert.ok(action, 'difendere è una mossa legale');
    assert.deepEqual(action.choices.angelo.sort(), ['arciere', 'pegaso']);
});

test('la vista non espone mani né grimori avversari', () => {
    const state = started();
    state.playersData.b.hand = [handCard('segreto-1'), handCard('segreto-2')];
    const view = viewFor(state, 'a');
    const opponent = view.opponents[0];
    assert.equal(opponent.handCount, 2);
    assert.equal(opponent.libraryCount, state.playersData.b.library.length);
    assert.equal(opponent.hand, undefined);
    assert.equal(opponent.library, undefined);
    assert.equal(JSON.stringify(view).includes('segreto-1'), false);
    assert.equal(view.me.hand.length, state.playersData.a.hand.length);
});

test('la vista porta passi, priorità e mosse legali senza mutare la partita', () => {
    const state = started();
    state.playersData.a.hand = [handCard('terra-1', forest)];
    const before = stateHash(state);
    const view = viewFor(state, 'a');
    assert.equal(stateHash(state), before, 'viewFor non modifica lo stato');
    assert.equal(view.steps.length, 12);
    assert.equal(view.step.id, 'main1');
    assert.equal(view.priority.mine, true);
    assert.equal(view.priority.label, 'La tua priorità');
    assert.deepEqual(view.legalActions.map(action => action.type).sort(), ['adjustLife', 'adjustLife', 'pass', 'playLand']);
    assert.deepEqual(JSON.parse(JSON.stringify(view)), view, 'il view model è serializzabile');

    const waiting = viewFor(state, 'b');
    assert.equal(waiting.priority.mine, false);
    assert.match(waiting.priority.label, /In attesa di Tu/);
});

test('una partita mossa dalle azioni non lascia carte in due zone', () => {
    let state = started();
    state.playersData.a.hand = [handCard('terra-1', forest), handCard('elfo-1')];
    state = applyAction(state, { type: 'playLand', playerId: 'a', uid: 'terra-1' });
    state = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'elfo-1' });
    assert.deepEqual(stateViolations(state), []);
    assert.equal(state.playersData.a.battlefield.length, 2, 'terra più creatura');
    assert.equal(state.playersData.a.hand.length, 0);

    const closed = passTurn(state, 'a');
    assert.equal(closed.activePlayer, 'b');
    assert.deepEqual(stateViolations(closed), []);
});

test('il seme decide la mischia: stesso seme stessa partita', () => {
    const first = shuffleWith(createRng(42), Array.from({ length: 30 }, (_, index) => index));
    const again = shuffleWith(createRng(42), Array.from({ length: 30 }, (_, index) => index));
    assert.deepEqual(first, again);
    const other = shuffleWith(createRng(43), Array.from({ length: 30 }, (_, index) => index));
    assert.notDeepEqual(first, other);
    assert.equal(first.length, 30);
    assert.equal(new Set(first).size, 30);
});
