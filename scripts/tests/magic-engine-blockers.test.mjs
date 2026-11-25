import test from 'node:test';
import assert from 'node:assert/strict';
import { mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { createEngineMatch } from '../../src/dashboards/magic/engine/turn.js';
import { declareBlockers } from '../../src/dashboards/magic/engine/combat.js';
import { answerChoice } from '../../src/dashboards/magic/engine/choices.js';
import { applyAction } from '../../src/dashboards/magic/engine/actions.js';
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

/** Stato fermo nel passo dei bloccanti, con gli attaccanti già dichiarati. */
const blocking = (attackers = [], blockers = []) => {
    const state = started();
    state.phase = 'combat';
    state.step = 'declareBlockers';
    state.playersData.a.battlefield = attackers;
    state.playersData.b.battlefield = blockers;
    state.combat = {
        step: 'blockers',
        attackerIds: attackers.map(card => card.instanceId),
        defender: 'b',
        blockers: {},
        order: {},
        damageDone: false,
        blockersDeclared: false
    };
    resetPriority(state, 'a');
    return state;
};

test('CR 509.1: un attaccante può essere bloccato da più creature, e l’ordine è registrato', () => {
    const state = blocking(
        [permanent('att')],
        [permanent('b1'), permanent('b2')]
    );
    const blocked = declareBlockers(state, 'b', { blockers: { att: ['b1', 'b2'] } });
    assert.deepEqual(blocked.combat.blockers.att, ['b1', 'b2']);
    assert.deepEqual(blocked.combat.order.att, ['b1', 'b2'], 'senza ordine esplicito vale quello di dichiarazione');
    assert.equal(blocked.combat.blockersDeclared, true);
    assert.equal(blocked.playersData.b.battlefield.find(card => card.uid === 'b1').blocking, 'att');
    assert.equal(blocked.combat.step, 'blockers', 'il passo non salta: prima si passa la priorità');
    // CR 509.3: con più bloccanti l'attaccante sceglie l'ordine del danno.
    assert.equal(blocked.pendingChoice.kind, 'orderBlockers');
    assert.equal(blocked.pendingChoice.playerId, 'a');
    assert.deepEqual(blocked.pendingChoice.options.map(option => option.id), ['b1', 'b2']);
});

test('CR 509.1a: un bloccante non può bloccare due attaccanti', () => {
    const state = blocking(
        [permanent('att-1'), permanent('att-2')],
        [permanent('b1')]
    );
    assert.throws(() => declareBlockers(state, 'b', {
        blockers: { 'att-1': ['b1'], 'att-2': ['b1'] }
    }), /due attaccanti/i);
});

test('CR 509.1b: volare si blocca solo con volare o portata, anche con più bloccanti', () => {
    const state = blocking(
        [permanent('angelo', { keywords: ['flying'] })],
        [permanent('orso'), permanent('pegaso', { keywords: ['flying'] }), permanent('arciere', { keywords: ['reach'] })]
    );
    assert.throws(() => declareBlockers(state, 'b', { blockers: { angelo: ['orso'] } }), /volare/i);
    const blocked = declareBlockers(state, 'b', { blockers: { angelo: ['pegaso', 'arciere'] } });
    assert.deepEqual(blocked.combat.blockers.angelo.sort(), ['arciere', 'pegaso']);
});

test('CR 509.3: l’ordine si può dichiarare subito e non lascia domande aperte', () => {
    const state = blocking(
        [permanent('att')],
        [permanent('b1'), permanent('b2')]
    );
    const blocked = declareBlockers(state, 'b', {
        blockers: { att: ['b1', 'b2'] },
        order: { att: ['b2', 'b1'] }
    });
    assert.deepEqual(blocked.combat.order.att, ['b2', 'b1']);
    assert.equal(blocked.pendingChoice, null);
});

test('CR 509.3: la domanda sull’ordine la risponde solo chi attacca', () => {
    const state = blocking([permanent('att')], [permanent('b1'), permanent('b2')]);
    const blocked = declareBlockers(state, 'b', { blockers: { att: ['b1', 'b2'] } });
    assert.throws(() => answerChoice(blocked, 'b', ['b1', 'b2']), /non spetta a te/i);
    assert.throws(() => answerChoice(blocked, 'a', ['b1']), /esattamente 2/i);
    assert.throws(() => answerChoice(blocked, 'a', ['b1', 'sconosciuto']), /non è valida/i);
    const answered = answerChoice(blocked, 'a', ['b2', 'b1']);
    assert.deepEqual(answered.combat.order.att, ['b2', 'b1']);
    assert.equal(answered.pendingChoice, null);
});

// Il tavolo risponde alle scelte con la mossa tipizzata `choose`, non con una
// scorciatoia: se questo percorso non funziona, il pannello non basta.
test('CR 509.3: la scelta dell’ordine si risponde con la mossa «choose»', () => {
    const state = blocking([permanent('att')], [permanent('b1'), permanent('b2')]);
    const blocked = declareBlockers(state, 'b', { blockers: { att: ['b1', 'b2'] } });
    const answered = applyAction(blocked, { type: 'choose', playerId: 'a', selection: ['b2', 'b1'] });
    assert.deepEqual(answered.combat.order.att, ['b2', 'b1']);
    assert.equal(answered.pendingChoice, null);
    // Con la domanda chiusa la priorità torna a scorrere: era qui che la
    // partita restava ferma quando nessun pulsante rispondeva.
    const passed = applyAction(answered, { type: 'passPriority', playerId: 'a' });
    assert.equal(passed.pendingChoice, null);
    assert.equal(passed.priority.playerId, 'b');
});

test('CR 509.2: solo il difensore dichiara, una volta sola', () => {
    const state = blocking([permanent('att')], [permanent('b1')]);
    assert.throws(() => declareBlockers(state, 'a', {}), /Solo il giocatore attaccato/i);
    const blocked = declareBlockers(state, 'b', { blockers: { att: 'b1' } });
    assert.deepEqual(blocked.combat.blockers.att, ['b1'], 'anche un bloccante singolo è un elenco');
    assert.throws(() => declareBlockers(blocked, 'b', {}), /già stati dichiarati/i);
});

test('CR 509: un bloccante tappato non è un bloccante', () => {
    const state = blocking([permanent('att')], [permanent('tappato', { tapped: true })]);
    assert.throws(() => declareBlockers(state, 'b', { blockers: { att: ['tappato'] } }), /tappata/i);
});
