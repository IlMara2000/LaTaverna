import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { applyAction } from '../../src/dashboards/magic/engine/actions.js';
import { parseCardAbilities } from '../../src/dashboards/magicEffects.js';
import { stateViolations } from '../../src/dashboards/magic/engine/state.js';
import { applyStateBasedActions } from '../../src/dashboards/magic/engine/sba.js';
import { isPermanentCard } from '../../src/dashboards/magicRules.js';
import { powerOf, toughnessOf } from '../../src/dashboards/magicMatchEngine.js';

const forest = {
    id: 'Foresta', name: 'Foresta', typeLine: 'Basic Land — Forest', manaCost: '', oracleText: '{T}: Add {G}.', power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 0, image: ''
};
const elf = {
    id: 'Elfo', name: 'Elfo', typeLine: 'Creature — Elf', manaCost: '{G}', oracleText: '', power: '1', toughness: '1', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 1, image: ''
};
const deck = () => Array.from({ length: 100 }, (_, index) => ({ ...(index < 60 ? forest : elf), quantity: 1 }));

const auraPump = {
    id: 'AuraPump', name: 'Aura Pump', typeLine: 'Enchantment — Aura', manaCost: '{G}',
    oracleText: 'Enchant creature\nEnchanted creature gets +3/+3.',
    power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 1, image: ''
};
const auraEtb = {
    id: 'AuraEtb', name: 'Aura Etb', typeLine: 'Enchantment — Aura', manaCost: '{1}{G}',
    oracleText: 'Enchant creature\nWhen this Aura enters the battlefield, draw a card.',
    power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 2, image: ''
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

test('un enchantment Aura è un permanente', () => {
    assert.equal(isPermanentCard(auraPump), true, 'Aura è un permanente');
});

test('il testo continuo dell\'Aura diventa un effetto statico', () => {
    const abilities = parseCardAbilities(auraPump);
    assert.equal(abilities.statics.length, 1, 'Una riga di testo continuo');
    assert.deepEqual(abilities.statics[0].effects, [{ type: 'auraPump', power: 3, toughness: 3, keywords: [] }]);
    assert.deepEqual(abilities.manual, [], 'Niente resta da gestire a mano');
});

test('il trigger "quando entra" di un\'Aura è letto', () => {
    const abilities = parseCardAbilities(auraEtb);
    assert.equal(abilities.triggers.length, 1);
    assert.equal(abilities.triggers[0].event, 'etb');
    assert.deepEqual(abilities.triggers[0].effects, [{ type: 'draw', count: 1 }]);
});

test('lanciare un\'Aura la mette in campo senza violazioni', () => {
    const state = started();
    state.playersData.a.hand = [handCard('aura-1', auraPump)];
    const after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'aura-1' });
    const inPlay = after.playersData.a.battlefield.find(card => card.uid === 'aura-1');
    assert.ok(inPlay, 'L\'Aura è sul campo di battaglia');
    assert.deepEqual(stateViolations(after), []);
});

test('l\'Aura si attacca alla creatura indicata e la pompa', () => {
    let state = started();
    state.playersData.a.battlefield.push({ ...handCard('elfo-1', elf), instanceId: 'elfo-1' });
    state.playersData.a.hand = [handCard('aura-1', auraPump)];

    const after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'aura-1', target: 'card:a:elfo-1' });

    const aura = after.playersData.a.battlefield.find(card => card.uid === 'aura-1');
    const host = after.playersData.a.battlefield.find(card => card.uid === 'elfo-1');
    assert.equal(aura.attachedTo, 'elfo-1', 'L\'Aura ricorda a chi è attaccata');
    assert.equal(powerOf(host), 4, '1/1 più +3/+3');
    assert.equal(toughnessOf(host), 4, '1/1 più +3/+3');
    assert.deepEqual(stateViolations(after), []);
});

test('senza la creatura incantata l\'Aura va al cimitero (704.5m)', () => {
    let state = started();
    state.playersData.a.battlefield.push({ ...handCard('elfo-1', elf), instanceId: 'elfo-1' });
    state.playersData.a.hand = [handCard('aura-1', auraPump)];
    state = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'aura-1', target: 'card:a:elfo-1' });
    state.playersData.a.battlefield = state.playersData.a.battlefield.filter(card => card.uid !== 'elfo-1');

    const after = applyStateBasedActions(state);

    assert.equal(after.playersData.a.battlefield.some(card => card.uid === 'aura-1'), false, 'Non resta in campo');
    assert.equal(after.playersData.a.graveyard.some(card => card.uid === 'aura-1'), true, 'Va al cimitero');
});