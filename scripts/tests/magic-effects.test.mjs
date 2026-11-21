// Effetti delle carte: ogni test costruisce una partita vera e verifica che il
// testo Oracle cambi lo stato. Se un effetto non è riconosciuto deve dirlo
// («da gestire a mano»), mai sparire in silenzio.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    activateAbility, advancePhase, castSpell, createMatch, declareAttackers, declareBlockers,
    discardCards, mulliganAction, powerOf, resolveCombat, toughnessOf
} from '../../src/dashboards/magicMatchEngine.js';
import { resolveOracleText } from '../../src/dashboards/magicRules.js';
import {
    applyEffects, parseCardAbilities, recomputeStatics, textSupport
} from '../../src/dashboards/magicEffects.js';

const permanent = (uid, overrides = {}) => ({
    uid, instanceId: uid, id: uid, name: uid, manaCost: '{1}{G}', typeLine: 'Creature — Human',
    oracleText: '', power: '2', toughness: '2', keywords: [], colors: ['G'], colorIdentity: ['G'],
    tapped: false, summoningSick: false, damageMarked: 0, counters: { plusOne: 0 }, turnBoost: { power: 0, toughness: 0 },
    ...overrides
});

const library = Array.from({ length: 60 }, (_, index) => permanent(`lib-${index}`, { uid: `lib-${index}` }));
const hundred = () => library.slice(0, 40).map(card => ({ ...card, quantity: 1 }))
    .concat(library.slice(0, 60).map(card => ({ ...card, quantity: 1 })));

const started = () => {
    let state = createMatch({
        players: [
            { id: 'a', name: 'Tu', cards: hundred() },
            { id: 'b', name: 'Avversario', cards: hundred() }
        ]
    });
    state = mulliganAction(state, 'a', 'keep');
    state = mulliganAction(state, 'b', 'keep');
    return state;
};

test('l’innesco «quando entra» pesca davvero', () => {
    let state = started();
    const card = permanent('saggio', {
        id: 'Saggio', name: 'Saggio', typeLine: 'Creature — Wizard',
        oracleText: 'When this creature enters, draw a card.'
    });
    state.playersData.a.hand = [card];
    state.playersData.a.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 1, C: 1 };
    const handBefore = state.playersData.a.hand.length;
    state = castSpell(state, 'a', 'saggio');
    assert.equal(state.playersData.a.hand.length, handBefore, 'la carta esce dalla mano e l’innesco pesca una carta');
    assert.ok(state.log.some(line => /peschi 1 carta/.test(line)), state.log.join(' | '));
});

test('l’innesco «quando entra» fa danno al bersaglio scelto', () => {
    let state = started();
    state.playersData.b.battlefield = [permanent('vittima', { toughness: '3' })];
    const card = permanent('fulmine', {
        id: 'Fulmine', name: 'Fulmine', typeLine: 'Creature — Elemental',
        oracleText: 'When this creature enters, it deals 2 damage to any target.'
    });
    state.playersData.a.hand = [card];
    state.playersData.a.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 1, C: 1 };
    state = castSpell(state, 'a', 'fulmine', 'card:b:vittima');
    assert.equal(state.playersData.b.battlefield[0].damageMarked, 2);
});

test('l’innesco di attacco colpisce il giocatore attaccato', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('brigante', {
        oracleText: 'Whenever this creature attacks, it deals 2 damage to that player.'
    })];
    state = advancePhase(state, 'a');
    state = declareAttackers(state, 'a', ['brigante'], 'b');
    assert.equal(state.playersData.b.life, 38);
});

test('l’innesco di mantenimento scatta all’inizio del turno', () => {
    let state = started();
    state.playersData.b.battlefield = [permanent('idolo', {
        oracleText: 'At the beginning of your upkeep, you lose 1 life.'
    })];
    // Il turno passa da a a b: il mantenimento di b è l'inizio del suo turno.
    state = advancePhase(state, 'a');
    state = advancePhase(state, 'a');
    state = advancePhase(state, 'a');
    const excess = state.playersData.a.hand.length - 7;
    if (excess > 0) state.playersData.a.hand = state.playersData.a.hand.slice(excess);
    state = advancePhase(state, 'a');
    assert.equal(state.playersData.b.life, 39);
});

test('un’abilità attivata paga tap e mana e applica l’effetto', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('pozzo', {
        oracleText: '{2}, {T}: Draw a card.'
    })];
    state.playersData.a.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 2 };
    const handBefore = state.playersData.a.hand.length;
    state = activateAbility(state, 'a', 'pozzo', 0);
    assert.equal(state.playersData.a.hand.length, handBefore + 1);
    assert.equal(state.playersData.a.battlefield[0].tapped, true);
    assert.equal(state.playersData.a.manaPool.C, 0);
});

test('un’abilità che chiede una scelta non viene inventata', () => {
    const parsed = parseCardAbilities({
        name: 'Mago', typeLine: 'Creature — Wizard',
        oracleText: '{1}{B}, Sacrifice a creature: Destroy target creature.'
    });
    assert.equal(parsed.activated.length, 1);
    assert.equal(parsed.activated[0].supported, false);
    let state = started();
    state.playersData.a.battlefield = [permanent('mago', { oracleText: '{1}{B}, Sacrifice a creature: Destroy target creature.' })];
    assert.throws(() => activateAbility(state, 'a', 'mago', 0), /a mano/);
});

test('volare: una creatura di terra non può bloccare un volante, portata sì', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('angelo', { keywords: ['Flying'], oracleText: 'Flying' })];
    state.playersData.b.battlefield = [permanent('guardia')];
    state = advancePhase(state, 'a');
    state = declareAttackers(state, 'a', ['angelo'], 'b');
    assert.throws(() => declareBlockers(state, 'b', { angelo: 'guardia' }), /volare|portata/);

    const withReach = started();
    withReach.playersData.a.battlefield = [permanent('angelo', { keywords: ['Flying'], oracleText: 'Flying' })];
    withReach.playersData.b.battlefield = [permanent('arciere', { keywords: ['Reach'], oracleText: 'Reach' })];
    const combat = advancePhase(withReach, 'a');
    const attacking = declareAttackers(combat, 'a', ['angelo'], 'b');
    const blocked = declareBlockers(attacking, 'b', { angelo: 'arciere' });
    assert.equal(blocked.combat.blockers.angelo, 'arciere');
});

test('un permanente indistruttibile sopravvive alla distruzione', () => {
    const state = started();
    state.playersData.b.battlefield = [permanent('colosso', { oracleText: 'Indestructible' })];
    resolveOracleText(
        { name: 'Ira', typeLine: 'Sorcery', oracleText: 'Destroy target creature.' },
        state, 'a', 'card:b:colosso'
    );
    assert.equal(state.playersData.b.battlefield.length, 1);
});

test('una stregoneria che distrugge tutte le creature svuota i campi', () => {
    const state = started();
    state.playersData.a.battlefield = [permanent('mio')];
    state.playersData.b.battlefield = [permanent('suo'), permanent('suo-2')];
    resolveOracleText({ name: 'Ira', typeLine: 'Sorcery', oracleText: 'Destroy all creatures.' }, state, 'a');
    assert.equal(state.playersData.a.battlefield.length, 0);
    assert.equal(state.playersData.b.battlefield.length, 0);
    assert.equal(state.playersData.b.graveyard.length, 2);
});

test('parola chiave concessa fino a fine turno abilita il volo', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('gabbiano')];
    state.playersData.b.battlefield = [permanent('guardia')];
    resolveOracleText(
        { name: 'Ali', typeLine: 'Instant', oracleText: 'Target creature gains flying until end of turn.' },
        state, 'a', 'card:a:gabbiano'
    );
    state = advancePhase(state, 'a');
    state = declareAttackers(state, 'a', ['gabbiano'], 'b');
    assert.throws(() => declareBlockers(state, 'b', { gabbiano: 'guardia' }), /volare|portata/);
});

test('le pedine entrano in campo e i segnalini si sommano', () => {
    const state = started();
    resolveOracleText({
        name: 'Evocazione', typeLine: 'Sorcery',
        oracleText: 'Create two 1/1 white Soldier creature tokens.'
    }, state, 'a');
    assert.equal(state.playersData.a.battlefield.filter(card => card.isToken).length, 2);

    state.playersData.a.battlefield.push(permanent('orso', { power: '2', toughness: '2' }));
    resolveOracleText({
        name: 'Crescita', typeLine: 'Instant',
        oracleText: 'Put two +1/+1 counters on target creature.'
    }, state, 'a', 'card:a:orso');
    const orso = state.playersData.a.battlefield.find(card => card.name === 'orso');
    assert.equal(orso.counters.plusOne, 2);
});

test('il testo non riconosciuto resta dichiarato, non ignorato', () => {
    const card = {
        name: 'Strano', typeLine: 'Creature — Illusion',
        oracleText: 'Whenever a creature you control dies, draw a card.'
    };
    const parsed = parseCardAbilities(card);
    assert.equal(parsed.triggers.length, 0);
    assert.ok(parsed.manual.length >= 1);
    const support = textSupport(card);
    assert.equal(support.automated, 0);
    assert.ok(support.manual >= 1);
});

test('una carta con innesco automatico risulta coperta da textSupport', () => {
    const support = textSupport({
        name: 'Saggio', typeLine: 'Creature — Wizard',
        oracleText: 'When this creature enters, draw a card.'
    });
    assert.equal(support.automated, 1);
    assert.equal(support.manual, 0);
});

test('una magia modale espone i modi e applica solo quello scelto', () => {
    const card = {
        name: 'Scelta', typeLine: 'Sorcery', manaCost: '{1}{G}',
        oracleText: 'Choose one —\n• Draw two cards.\n• You gain 3 life.'
    };
    const parsed = parseCardAbilities(card);
    assert.equal(parsed.spells.length, 1);
    assert.equal(parsed.spells[0].modes.length, 2);
    assert.equal(parsed.spells[0].modes[0].effects[0].type, 'draw');
    assert.equal(textSupport(card).automated, 2, 'entrambi i modi sono supportati');

    let state = started();
    state.playersData.a.hand = [permanent('scelta', {
        id: 'Scelta', name: 'Scelta', typeLine: 'Sorcery', manaCost: '{1}{G}',
        oracleText: card.oracleText, power: '', toughness: ''
    })];
    state.playersData.a.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 3, C: 0 };
    state = castSpell(state, 'a', 'scelta', '', 1);
    assert.equal(state.playersData.a.life, 43);
    assert.equal(state.playersData.a.hand.length, 0);
    assert.ok(state.log.some(line => /Modo scelto: You gain 3 life/.test(line)), state.log.join(' | '));
});

test('l’innesco con un soggetto diverso da «this» guarda forza e controllore', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('araldo', {
        oracleText: 'Whenever a creature you control with power 3 or greater enters, draw a card.'
    })];
    state.playersData.a.hand = [permanent('debole', { power: '2', toughness: '2' })];
    state.playersData.a.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 3, C: 0 };
    state = castSpell(state, 'a', 'debole');
    assert.equal(state.playersData.a.hand.length, 0, 'la 2/2 non soddisfa la condizione');

    state.playersData.a.hand = [permanent('forte', { power: '3', toughness: '3' })];
    state.playersData.a.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 3, C: 0 };
    state = castSpell(state, 'a', 'forte');
    assert.equal(state.playersData.a.hand.length, 1, 'la 3/3 fa pescare: una carta in mano');

    // La creatura dell'avversario non deve far scattare un innesco «che controlli».
    state.playersData.a.hand = [];
    state.playersData.b.battlefield = [permanent('straniero', { power: '4', toughness: '4' })];
    state.playersData.b.life = 40;
    state = advancePhase(state, 'a');
    state = advancePhase(state, 'a');
    state = advancePhase(state, 'a');
    const excess = state.playersData.a.hand.length - 7;
    if (excess > 0) state = discardCards(state, 'a', state.playersData.a.hand.slice(0, excess).map(card => card.uid));
    state = advancePhase(state, 'a');
    assert.equal(state.playersData.a.hand.length, 0, 'la creatura avversaria non fa pescare il controllore dell’araldo');
});

test('un anthem statico pompa solo le creature del controllore', () => {
    let state = started();
    state.playersData.a.battlefield = [
        permanent('insegna', {
            typeLine: 'Enchantment', oracleText: 'Creatures you control get +1/+1.', power: '', toughness: ''
        }),
        permanent('soldato')
    ];
    state.playersData.b.battlefield = [permanent('nemico')];
    recomputeStatics(state);
    const soldato = state.playersData.a.battlefield.find(card => card.name === 'soldato');
    const nemico = state.playersData.b.battlefield[0];
    assert.deepEqual([powerOf(soldato), toughnessOf(soldato)], [3, 3]);
    assert.deepEqual([powerOf(nemico), toughnessOf(nemico)], [2, 2]);

    state = advancePhase(state, 'a');
    state = declareAttackers(state, 'a', ['soldato'], 'b');
    state = declareBlockers(state, 'b', {});
    state = resolveCombat(state, 'a');
    assert.equal(state.playersData.b.life, 37, 'la 2/2 con anthem fa 3 danni');
});

test('il tipo scelto dal permanente pompa solo le creature di quel tipo', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('brigante', { typeLine: 'Creature — Goblin Warrior' })];
    state.playersData.a.hand = [permanent('totem', {
        id: 'Totem', name: 'Totem', typeLine: 'Artifact', manaCost: '', power: '', toughness: '',
        oracleText: 'As this artifact enters, choose a creature type.\nCreatures you control of the chosen type get +1/+1.'
    })];
    state = castSpell(state, 'a', 'totem');
    const totem = state.playersData.a.battlefield.find(card => card.name === 'Totem');
    assert.equal(totem.chosenType, 'Goblin');
    const goblin = state.playersData.a.battlefield.find(card => card.name === 'brigante');
    assert.equal(powerOf(goblin), 3);
    assert.ok(state.log.some(line => /tipo scelto Goblin/.test(line)), state.log.join(' | '));
});

test('«this artifact deals N damage to you» colpisce il controllore', () => {
    const state = started();
    resolveOracleText({
        name: 'Maledizione', typeLine: 'Artifact',
        oracleText: 'This artifact deals 2 damage to you.'
    }, state, 'a');
    assert.equal(state.playersData.a.life, 38);
});

test('la clausola «if you control…» si valuta prima di applicare l’effetto', () => {
    const state = started();
    const condition = { kind: 'creature', count: 1, minPower: 4 };
    state.playersData.a.battlefield = [permanent('gigante', { power: '4' })];
    let hand = state.playersData.a.hand.length;
    applyEffects([{ type: 'draw', count: 1, condition }], { state, controllerId: 'a', sourceName: 'Oracolo' });
    assert.equal(state.playersData.a.hand.length, hand + 1);
    state.playersData.a.battlefield = [permanent('piccolo', { power: '2' })];
    hand = state.playersData.a.hand.length;
    const skipped = applyEffects([{ type: 'draw', count: 1, condition }], { state, controllerId: 'a', sourceName: 'Oracolo' });
    assert.equal(state.playersData.a.hand.length, hand);
    assert.ok(skipped.log.some(line => /condizione non soddisfatta/.test(line)), skipped.log.join(' | '));
});

test('supporto, restrizioni di lancio e mana ristretto non restano «a mano»', () => {
    const parsed = parseCardAbilities({
        name: 'Alfiere', typeLine: 'Creature — Soldier',
        oracleText: 'When this creature enters, support 2.\n{2}: Draw a card. Activate only as a sorcery.'
    });
    assert.equal(parsed.triggers.length, 1);
    assert.equal(parsed.triggers[0].effects[0].type, 'support');
    assert.equal(parsed.triggers[0].unsupported.length, 0);
    assert.equal(parsed.activated[0].unsupported.length, 0);
});
