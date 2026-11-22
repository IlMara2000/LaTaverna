import test from 'node:test';
import assert from 'node:assert/strict';
import { mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { createEngineMatch } from '../../src/dashboards/magic/engine/turn.js';
import { applyStateBasedActions, SBA_RULES } from '../../src/dashboards/magic/engine/sba.js';

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
    state.playersData.a.battlefield = [];
    state.playersData.b.battlefield = [];
    return state;
};

const rules = state => (state.lastSba || []).map(entry => entry.rule);

test('CR 704.5g: una creatura con danno letale va al cimitero', () => {
    const state = started();
    state.playersData.a.battlefield = [permanent('ferito', { damageMarked: 2 })];
    const after = applyStateBasedActions(state);
    assert.equal(after.playersData.a.battlefield.length, 0);
    assert.equal(after.playersData.a.graveyard[0].name, 'ferito');
    assert.deepEqual(rules(after), [SBA_RULES.lethalDamage]);
});

test('CR 704.5f: costituzione zero o meno, senza aspettare il danno', () => {
    const state = started();
    state.playersData.a.battlefield = [permanent('debole', { turnBoost: { power: 0, toughness: -3 } })];
    const after = applyStateBasedActions(state);
    assert.equal(after.playersData.a.battlefield.length, 0);
    assert.deepEqual(rules(after), [SBA_RULES.toughness]);
});

test('CR 122.3: i segnalini +1/+1 e −1/−1 si annullano', () => {
    const state = started();
    state.playersData.a.battlefield = [permanent('segnato', {
        counters: { plusOne: 2, minusOne: 1 }
    })];
    const after = applyStateBasedActions(state);
    assert.equal(after.playersData.a.battlefield.length, 1);
    assert.deepEqual(after.playersData.a.battlefield[0].counters, { plusOne: 1, minusOne: 0 });
    assert.deepEqual(rules(after), [SBA_RULES.counters]);
});

test('CR 704.5j: due permanenti omonimi dello stesso giocatore, ne resta uno', () => {
    const state = started();
    state.playersData.a.battlefield = [
        permanent('l1', { name: 'Orso' }),
        permanent('l2', { name: 'Orso' }),
        permanent('l3', { name: 'Orso' })
    ];
    const after = applyStateBasedActions(state);
    assert.equal(after.playersData.a.battlefield.length, 1, 'la regola si ripete finché non ne resta uno');
    assert.equal(after.playersData.a.graveyard.length, 2);
    assert.deepEqual(rules(after), [SBA_RULES.legend, SBA_RULES.legend]);
});

test('CR 704.5a: un giocatore a zero vite perde e la partita ha un vincitore', () => {
    const state = started();
    state.playersData.a.life = 0;
    const after = applyStateBasedActions(state);
    assert.equal(after.playersData.a.eliminated, true);
    assert.equal(after.winner, 'b');
    assert.ok(rules(after).includes(SBA_RULES.life));
});

test('CR 903.10a: 21 danni da comandante eliminano anche con vite alte', () => {
    const state = started();
    state.playersData.a.commanderDamage = { 'b:cmd:1': 21 };
    const after = applyStateBasedActions(state);
    assert.equal(after.playersData.a.eliminated, true);
    assert.equal(after.playersData.a.life, 0);
    assert.equal(after.playersData.b.life, 40);
    assert.ok(rules(after).includes(SBA_RULES.commanderDamage));
});

test('CR 704.5n: un segnalino che muore cessa di esistere', () => {
    const state = started();
    state.playersData.a.battlefield = [permanent('tok', { isToken: true, damageMarked: 2 })];
    const after = applyStateBasedActions(state);
    assert.equal(after.playersData.a.battlefield.length, 0);
    assert.equal(after.playersData.a.graveyard.length, 0, 'non arriva al cimitero');
    assert.match(after.log.join(' '), /cessa di esistere/);
});

test('CR 704.5g: indistruttibile non muore per danno letale', () => {
    const state = started();
    state.playersData.a.battlefield = [permanent('solido', { damageMarked: 9, keywords: ['Indestructible'] })];
    const after = applyStateBasedActions(state);
    assert.equal(after.playersData.a.battlefield.length, 1);
    assert.deepEqual(rules(after), []);
});

test('CR 704.5: le azioni si applicano tutte nello stesso controllo, non una per turno', () => {
    const state = started();
    state.playersData.a.battlefield = [
        permanent('k1', { damageMarked: 2 }),
        permanent('k2', { damageMarked: 2 }),
        permanent('gemella', { name: 'Gemella' }),
        permanent('gemella-2', { name: 'Gemella' })
    ];
    state.playersData.b.life = 0;
    const after = applyStateBasedActions(state);
    assert.equal(after.playersData.a.battlefield.length, 1, 'della coppia leggendaria ne resta una');
    assert.equal(after.playersData.a.battlefield[0].name, 'Gemella');
    assert.equal(after.playersData.a.graveyard.length, 3);
    assert.equal(after.winner, 'a');
    const found = rules(after);
    assert.ok(found.includes(SBA_RULES.lethalDamage));
    assert.ok(found.includes(SBA_RULES.legend));
    assert.ok(found.includes(SBA_RULES.life));
});

test('le SBA non toccano la partita quando non c’è nulla da fare', () => {
    const state = started();
    state.playersData.a.battlefield = [permanent('sano')];
    const after = applyStateBasedActions(state);
    assert.deepEqual(rules(after), []);
    assert.equal(after.playersData.a.battlefield.length, 1);
    assert.equal(state.playersData.a.battlefield.length, 1, 'lo stato di partenza non viene mutato');
});
