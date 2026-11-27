import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, mulliganAction } from '../../src/dashboards/magicMatchEngine.js';
import { applyAction } from '../../src/dashboards/magic/engine/actions.js';
import { parseCardAbilities } from '../../src/dashboards/magicEffects.js';
import { stateViolations } from '../../src/dashboards/magic/engine/state.js';

const forest = {
    id: 'Foresta', name: 'Foresta', typeLine: 'Basic Land — Forest', manaCost: '', oracleText: '{T}: Add {G}.', power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 0, image: ''
};
const elf = {
    id: 'Elfo', name: 'Elfo', typeLine: 'Creature — Elf', manaCost: '{G}', oracleText: '', power: '1', toughness: '1', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 1, image: ''
};
const deck = () => Array.from({ length: 100 }, (_, index) => ({ ...(index < 60 ? forest : elf), quantity: 1 }));

const modalCard = {
    id: 'ModalCard', name: 'Modal Test', typeLine: 'Sorcery', manaCost: '{2}{G}',
    oracleText: 'Choose one —\n• Draw two cards.\n• Create two 2/2 green Snake creature tokens.',
    power: '', toughness: '', keywords: [], colors: ['G'], colorIdentity: ['G'], cmc: 3, image: ''
};
const marchOfMultitudes = {
    id: 'MarchOfMultitudes', name: 'March of Multitudes', typeLine: 'Sorcery', manaCost: '{2}{G}',
    oracleText: 'Choose one —\n• Put two +1/+1 counters on target creature you control.\n• Creatures you control get +2/+2 until end of turn.\n• Create two 2/2 green Wolf creature tokens.',
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

test('parseCardAbilities recognizes a "choose one" spell', () => {
    const abilities = parseCardAbilities(modalCard);
    assert.ok(abilities.spells.length > 0, 'La magia modale deve essere letta');
    assert.ok(Array.isArray(abilities.spells[0].modes), 'Deve esporre l\'elenco dei modi');
    assert.equal(abilities.spells[0].modes.length, 2, 'Due modi per questa carta');
});

test('i modi di una magia modale sono letti con il loro testo', () => {
    const modes = parseCardAbilities(modalCard).spells[0].modes;
    assert.match(modes[0].text, /Draw two cards/i);
    assert.match(modes[1].text, /Snake/i);
});

test('una magia con tre modi li conserva tutti', () => {
    const modes = parseCardAbilities(marchOfMultitudes).spells[0].modes;
    assert.equal(modes.length, 3, 'March of Multitudes ha tre modi');
});

test('lanciare una magia modale non viola lo stato', () => {
    const state = started();
    state.playersData.a.hand = [handCard('modal-1', modalCard)];
    const after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'modal-1' });
    assert.deepEqual(stateViolations(after), []);
});

test('il modo scelto al lancio è quello che si risolve', () => {
    const state = started();
    const libraryBefore = state.playersData.a.library.length;
    state.playersData.a.hand = [handCard('modal-2', modalCard)];

    const after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'modal-2', mode: 0 });

    assert.equal(after.playersData.a.library.length, libraryBefore - 2, 'Il modo 0 pesca due carte');
    assert.deepEqual(stateViolations(after), []);
});

test('scegliere l\'altro modo dà un risultato diverso', () => {
    const state = started();
    const libraryBefore = state.playersData.a.library.length;
    state.playersData.a.hand = [handCard('modal-3', modalCard)];

    const after = applyAction(state, { type: 'castSpell', playerId: 'a', uid: 'modal-3', mode: 1 });

    assert.equal(after.playersData.a.library.length, libraryBefore, 'Il modo 1 non pesca');
    assert.equal(after.playersData.a.battlefield.filter(card => card.isToken).length, 2, 'Il modo 1 crea due pedine');
    assert.deepEqual(stateViolations(after), []);
});