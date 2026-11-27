import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { applyAction } from '../../src/dashboards/magic/engine/actions.js';
import { stateViolations } from '../../src/dashboards/magic/engine/state.js';
import { parseCardAbilities, triggerMatches } from '../../src/dashboards/magicEffects.js';

const forest = {
    id: 'Foresta', name: 'Foresta', typeLine: 'Basic Land — Forest', manaCost: '', oracleText: '{T}: Add {G}.', power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 0, image: ''
};
const elf = {
    id: 'Elfo', name: 'Elfo', typeLine: 'Creature — Elf', manaCost: '{G}', oracleText: '', power: '1', toughness: '1', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 1, image: ''
};
const deck = () => Array.from({ length: 100 }, (_, index) => ({ ...(index < 60 ? forest : elf), quantity: 1 }));

const creatureETB = {
    id: 'CreaturaETB', name: 'Creatura ETB', typeLine: 'Creature — Elf Warrior', manaCost: '{2}{G}',
    oracleText: 'When this creature enters the battlefield, draw a card.',
    power: '2', toughness: '2', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 3, image: ''
};
const creaturePlain = {
    id: 'CreaturaPlain', name: 'Creatura Semplice', typeLine: 'Creature — Human', manaCost: '{1}',
    oracleText: '', power: '1', toughness: '1', keywords: [], colors: [], colorIdentity: [], cmc: 1, image: ''
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
    state.playersData.a.battlefield = Array.from({ length: 6 }, (_, index) => ({ ...handCard(`terra-${index}`, forest), instanceId: `terra-${index}` }));
    state.playersData.b.battlefield = [];
    return state;
};

test('il trigger "quando entra" è letto dal parser', () => {
    const triggers = parseCardAbilities(creatureETB).triggers;
    assert.ok(triggers.length > 0, 'La creatura deve avere un trigger');
    assert.equal(triggers[0].event, 'etb', 'L\'evento è l\'ingresso in campo');
    assert.match(triggers[0].text, /enters the battlefield/i);
});

test('una creatura senza testo non ha trigger', () => {
    assert.equal(parseCardAbilities(creaturePlain).triggers.length, 0);
});

test('il trigger si attiva quando entra la creatura stessa', () => {
    const trigger = parseCardAbilities(creatureETB).triggers[0];
    const self = { uid: 'etb-1', typeLine: 'Creature — Elf Warrior' };
    assert.equal(triggerMatches(trigger, {
        watcher: self, watcherOwnerId: 'a', source: self, sourceOwnerId: 'a', activePlayerId: 'a'
    }), true, 'Si attiva sul proprio ingresso');
});

test('il trigger "self" non si attiva per un\'altra creatura', () => {
    const trigger = parseCardAbilities(creatureETB).triggers[0];
    const watcher = { uid: 'etb-1', typeLine: 'Creature — Elf Warrior' };
    const other = { uid: 'etb-2', typeLine: 'Creature — Elf Warrior' };
    assert.equal(triggerMatches(trigger, {
        watcher, watcherOwnerId: 'a', source: other, sourceOwnerId: 'a', activePlayerId: 'a'
    }), false, 'Un altro permanente non fa scattare il trigger self');
});

test('giocare la creatura ETB non lascia violazioni di stato', () => {
    const state = started();
    state.playersData.a.hand = [handCard('etb-1', creatureETB)];
    const after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'etb-1' });
    assert.ok(after.playersData.a.battlefield.some(card => card.uid === 'etb-1'), 'La creatura è in campo');
    assert.deepEqual(stateViolations(after), []);
});