import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { createEngineMatch } from '../../src/dashboards/magic/engine/turn.js';
import { applyAction, legalActions } from '../../src/dashboards/magic/engine/actions.js';
import { resetPriority } from '../../src/dashboards/magic/engine/priority.js';
import { stateViolations } from '../../src/dashboards/magic/engine/state.js';

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
    oracleText: '', power: '3', toughness: '3', keywords: [], colors: ['G'], colorIdentity: ['G'],
    tapped: false, summoningSick: false, damageMarked: 0, counters: { plusOne: 0 },
    turnBoost: { power: 0, toughness: 0 }, ...overrides
});

const planeswalker = overrides => permanent('pw', {
    name: 'Planeswalker di prova', typeLine: 'Planeswalker — Test', manaCost: '{2}{G}',
    oracleText: '+1: Draw a card.', power: '', toughness: '', loyalty: 5,
    counters: undefined, turnBoost: undefined, ...overrides
});

/** Partita con l'attaccante già pronto e il planeswalker dell'avversario in campo. */
const attacking = (attacker = {}, walker = {}) => {
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
    state.playersData.a.battlefield = [permanent('att', attacker)];
    state.playersData.b.battlefield = [planeswalker(walker)];
    state.phase = 'combat';
    state.step = 'declareAttackers';
    state.combat = null;
    resetPriority(state, 'a');
    return state;
};

/** Dichiara l'attacco, lascia passare i blocchi e arriva al danno scritto. */
const resolveAttack = (state, defender) => {
    let next = applyAction(state, { type: 'declareAttackers', playerId: 'a', uids: ['att'], defender });
    next = applyAction(next, { type: 'advanceStep' }); // bloccanti: nessuno blocca
    for (let guard = 0; guard < 8 && next.step === 'combatDamage'; guard += 1) {
        next = applyAction(next, { type: 'passPriority', playerId: next.priority.playerId });
    }
    return next;
};

test('le creature non bloccate tolgono lealtà al planeswalker attaccato', () => {
    const after = resolveAttack(attacking(), 'planeswalker:b:pw');
    const walker = after.playersData.b.battlefield.find(card => card.uid === 'pw');
    assert.ok(walker, 'Il planeswalker resta in campo se la lealtà basta');
    assert.equal(walker.loyalty, 2, 'Da 5 a 2: il danno è lealtà, non punti vita');
    assert.equal(after.playersData.b.life, 40, 'Il giocatore non perde vita');
    assert.deepEqual(stateViolations(after), []);
});

test('a zero lealtà il planeswalker va al cimitero (704.5i)', () => {
    const after = resolveAttack(attacking({ power: '5' }), 'planeswalker:b:pw');
    assert.equal(after.playersData.b.battlefield.some(card => card.uid === 'pw'), false, 'Non resta in campo');
    assert.ok(after.playersData.b.graveyard.some(card => card.uid === 'pw'), 'Va al cimitero');
    assert.ok((after.lastSba || []).some(entry => entry.rule === '704.5i'), 'La regola applicata è la 704.5i');
    assert.deepEqual(stateViolations(after), []);
});

test('se il planeswalker è bloccato, il giocatore non subisce nulla', () => {
    let state = attacking();
    state.playersData.b.battlefield = [planeswalker(), permanent('muro', { power: '0', toughness: '6' })];
    state.step = 'declareAttackers';
    state.combat = null;
    resetPriority(state, 'a');
    let next = applyAction(state, { type: 'declareAttackers', playerId: 'a', uids: ['att'], defender: 'planeswalker:b:pw' });
    next = applyAction(next, { type: 'declareBlockers', playerId: 'b', blockers: { att: ['muro'] } });
    next = applyAction(next, { type: 'advanceStep' });
    for (let guard = 0; guard < 8 && next.step === 'combatDamage'; guard += 1) {
        next = applyAction(next, { type: 'passPriority', playerId: next.priority.playerId });
    }
    const walker = next.playersData.b.battlefield.find(card => card.uid === 'pw');
    assert.equal(walker?.loyalty, 5, 'La lealtà non cala');
    assert.equal(next.playersData.b.life, 40, 'Nessun danno al giocatore');
});

test('un danno diretto a un planeswalker toglie lealtà invece di segnare danno', () => {
    let state = createMatch({
        players: [
            { id: 'a', name: 'Tu', cards: deck() },
            { id: 'b', name: 'Giocatore 2', cards: deck() }
        ]
    });
    state = mulliganAction(state, 'a', 'keep');
    state = mulliganAction(state, 'b', 'keep');
    const bolt = {
        id: 'Dardo', uid: 'dardo-1', name: 'Dardo', typeLine: 'Instant', manaCost: '{G}',
        oracleText: 'This deals 3 damage to any target.', power: '', toughness: '',
        keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 1, image: ''
    };
    state.playersData.a.hand = [bolt];
    state.playersData.a.battlefield = [{ ...forest, uid: 'foresta-1', instanceId: 'foresta-1', tapped: false }];
    state.playersData.b.battlefield = [planeswalker()];
    const after = applyAction(state, {
        type: 'castSpell', playerId: 'a', uid: 'dardo-1', target: 'card:b:pw'
    });
    const walker = after.playersData.b.battlefield.find(card => card.uid === 'pw');
    assert.equal(walker.loyalty, 2, 'Da 5 a 2');
    assert.equal(walker.damageMarked, 0, 'Un planeswalker non segna danno');
});

test('il view model offre i planeswalker fra i bersagli dell’attacco', () => {
    const state = attacking();
    const declaration = legalActions(state, 'a').find(action => action.type === 'declareAttackers');
    assert.ok(declaration, 'La dichiarazione degli attaccanti è fra le mosse legali');
    assert.deepEqual(declaration.defenders.map(entry => entry.value), ['b', 'planeswalker:b:pw']);
    assert.match(declaration.defenders[1].label, /lealtà 5/);
});
