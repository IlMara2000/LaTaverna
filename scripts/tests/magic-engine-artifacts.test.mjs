import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { applyAction } from '../../src/dashboards/magic/engine/actions.js';
import { stateViolations } from '../../src/dashboards/magic/engine/state.js';
import { isPermanentCard, manaAbilityOptions } from '../../src/dashboards/magicRules.js';

const forest = {
    id: 'Foresta', name: 'Foresta', typeLine: 'Basic Land — Forest', manaCost: '', oracleText: '{T}: Add {G}.', power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 0, image: ''
};
const elf = {
    id: 'Elfo', name: 'Elfo', typeLine: 'Creature — Elf', manaCost: '{G}', oracleText: '', power: '1', toughness: '1', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 1, image: ''
};
const deck = () => Array.from({ length: 100 }, (_, index) => ({ ...(index < 60 ? forest : elf), quantity: 1 }));

const manaArtifact = {
    id: 'ManaArtifact', name: 'Mana Artifact', typeLine: 'Artifact', manaCost: '{1}',
    oracleText: '{T}: Add one mana of any color.', power: '', toughness: '', keywords: [],
    colors: [], colorIdentity: [], cmc: 1, image: ''
};
const bronzeBombard = {
    id: 'BronzeBombard', name: 'Bronze Bombard', typeLine: 'Artifact Creature — Goat', manaCost: '{3}',
    oracleText: '', power: '4', toughness: '4', keywords: [], colors: [], colorIdentity: [], cmc: 3, image: ''
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

test('artifacts are permanent cards', () => {
    assert.equal(isPermanentCard(manaArtifact), true, 'Artifact è un permanente');
    assert.equal(isPermanentCard(bronzeBombard), true, 'Artifact creature è un permanente');
});

test('giocare una creatura artefatto la mette in campo', () => {
    const state = started();
    state.playersData.a.hand = [handCard('bombard-1', bronzeBombard)];
    const after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'bombard-1' });
    assert.ok(after.playersData.a.battlefield.some(card => card.uid === 'bombard-1'), 'Artifact creature in campo');
    assert.deepEqual(stateViolations(after), []);
});

test('un artefatto con "{T}: Add one mana of any color" è una fonte di mana', () => {
    const options = manaAbilityOptions(manaArtifact);
    assert.ok(options.length > 0, 'Deve offrire almeno una produzione di mana');
});

test('tappare l\'artefatto riempie il pool di mana', () => {
    const state = started();
    state.playersData.a.hand = [handCard('artifact-1', manaArtifact)];
    let after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'artifact-1' });
    after = applyAction(after, { type: 'tapMana', playerId: 'a', uid: 'artifact-1' });
    const total = Object.values(after.playersData.a.manaPool || {}).reduce((sum, count) => sum + count, 0);
    assert.equal(total, 1, 'Un mana prodotto: ' + JSON.stringify(after.playersData.a.manaPool));
    assert.deepEqual(stateViolations(after), []);
});