import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MATCH_RULES,
    validateMatchDeck,
    createMatch,
    mulliganAction,
    advancePhase,
    playLand,
    castSpell,
    declareAttackers,
    declareBlockers,
    resolveCombat,
} from '../../src/dashboards/magicMatchEngine.js';

const card = (overrides = {}) => ({
    id: overrides.id || 'c1',
    name: overrides.name || 'Card',
    typeLine: overrides.typeLine || 'Creature',
    manaCost: overrides.manaCost || '',
    oracleText: overrides.oracleText || '',
    power: overrides.power || '1',
    toughness: overrides.toughness || '1',
    keywords: overrides.keywords || [],
    colors: overrides.colors || [],
    colorIdentity: overrides.colorIdentity || [],
    cmc: overrides.cmc || 0,
    ...overrides,
});

const mountain = (i = 0) => card({
    id: `m${i}`, name: 'Mountain', typeLine: 'Basic Land — Mountain',
    manaCost: '', power: '', toughness: '', colorIdentity: ['R'], cmc: 0,
});

const commanderCard = (overrides = {}) => card({
    id: 'cmd1', name: 'Commander', typeLine: 'Legendary Creature — Goblin',
    manaCost: '{R}', power: '2', toughness: '2', colorIdentity: ['R'], cmc: 1,
    ...overrides,
});

// Build a 99-card deck (mountains only); the commander is passed separately.
const buildDeckCards = () => {
    const cards = [];
    for (let i = 0; i < 99; i++) cards.push(mountain(i));
    return cards;
};

const keepBoth = (state) => {
    state = mulliganAction(state, 'p1', 'keep');
    state = mulliganAction(state, 'p2', 'keep');
    return state;
};

test('MATCH_RULES uses Commander values', () => {
    assert.equal(MATCH_RULES.minDeck, 100);
    assert.equal(MATCH_RULES.maxCopies, 1);
    assert.equal(MATCH_RULES.startingLife, 40);
    assert.equal(MATCH_RULES.openingHand, 7);
    assert.equal(MATCH_RULES.commanderDamageLethal, 21);
});

test('validateMatchDeck rejects fewer than 100 cards', () => {
    const cards = new Map();
    const mountainCard = mountain(0);
    cards.set('m0', mountainCard);
    const entries = [{ cardId: 'm0', quantity: 99 }];
    const result = validateMatchDeck(entries, cards);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => /almeno 100/.test(e)));
    assert.equal(result.total, 99);
});

test('validateMatchDeck accepts 100 cards with singleton non-basics', () => {
    const cards = new Map();
    const m = mountain(0);
    const c = commanderCard();
    cards.set('m0', m);
    cards.set('cmd1', c);
    const entries = [{ cardId: 'm0', quantity: 99 }, { cardId: 'cmd1', quantity: 1 }];
    const result = validateMatchDeck(entries, cards);
    assert.equal(result.valid, true, result.errors.join('; '));
    assert.equal(result.total, 100);
});

test('validateMatchDeck rejects duplicate non-basic cards', () => {
    const cards = new Map();
    const c = commanderCard();
    cards.set('cmd1', c);
    // 98 mountains + 2 copies of the commander
    const m = mountain(0);
    cards.set('m0', m);
    const entries = [{ cardId: 'm0', quantity: 98 }, { cardId: 'cmd1', quantity: 2 }];
    const result = validateMatchDeck(entries, cards);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => /una sola copia/.test(e)));
});

test('createMatch gives 40 starting life to each player', () => {
    const cmd = commanderCard();
    const state = createMatch({
        players: [
            { id: 'p1', name: 'P1', cards: buildDeckCards(), commanders: [cmd] },
            { id: 'p2', name: 'P2', cards: buildDeckCards(), commanders: [cmd] },
        ],
        startingPlayer: 'p1',
    });
    assert.equal(state.playersData.p1.life, 40);
    assert.equal(state.playersData.p2.life, 40);
});

test('createMatch places the commander in the command zone', () => {
    const cmd = commanderCard();
    const state = createMatch({
        players: [
            { id: 'p1', name: 'P1', cards: buildDeckCards(), commanders: [cmd] },
            { id: 'p2', name: 'P2', cards: buildDeckCards(), commanders: [cmd] },
        ],
        startingPlayer: 'p1',
    });
    assert.equal(state.playersData.p1.commandZone.length, 1);
    assert.equal(state.playersData.p1.commandZone[0].name, 'Commander');
    assert.equal(state.playersData.p1.commandZone[0].isCommander, true);
    // Commander is not in the library.
    assert.ok(!state.playersData.p1.library.some(c => c.name === 'Commander'));
});

test('mulligan clears and both keep hands', () => {
    const cmd = commanderCard();
    let state = createMatch({
        players: [
            { id: 'p1', name: 'P1', cards: buildDeckCards(), commanders: [cmd] },
            { id: 'p2', name: 'P2', cards: buildDeckCards(), commanders: [cmd] },
        ],
        startingPlayer: 'p1',
    });
    assert.equal(state.mulliganActive, true);
    state = keepBoth(state);
    assert.equal(state.mulliganActive, false);
});

test('commander tax increases by 2 for each prior cast', () => {
    const cmd = commanderCard({ manaCost: '{R}', cmc: 1 });
    let state = createMatch({
        players: [
            { id: 'p1', name: 'P1', cards: buildDeckCards(), commanders: [cmd] },
            { id: 'p2', name: 'P2', cards: buildDeckCards(), commanders: [cmd] },
        ],
        startingPlayer: 'p1',
    });
    state = keepBoth(state);
    // Play a mountain to have mana.
    const landUid = state.playersData.p1.hand[0].uid;
    state = playLand(state, 'p1', landUid);
    // First cast from command zone: tax 0.
    const cmdUid = state.playersData.p1.commandZone[0].uid;
    state = castSpell(state, 'p1', cmdUid, '');
    assert.equal(state.playersData.p1.commanderCasts[cmdUid], 1);
    assert.ok(state.playersData.p1.battlefield.some(c => c.name === 'Commander'));
    // Move commander back to command zone to cast again.
    const perm = state.playersData.p1.battlefield.find(c => c.name === 'Commander');
    state.playersData.p1.battlefield = state.playersData.p1.battlefield.filter(c => c !== perm);
    state.playersData.p1.commandZone.push({ ...perm, isCommander: true });
    // Provide enough mana for tax (+2) manually.
    state.playersData.p1.manaPool = { W: 0, U: 0, B: 0, R: 1, G: 0, C: 2 };
    // Second cast should succeed (tax paid).
    state = castSpell(state, 'p1', cmdUid, '');
    assert.equal(state.playersData.p1.commanderCasts[cmdUid], 2);
});

test('21 commander damage eliminates the defending player', () => {
    const cmd = commanderCard({ power: '21', manaCost: '{R}', cmc: 1 });
    let state = createMatch({
        players: [
            { id: 'p1', name: 'P1', cards: buildDeckCards(), commanders: [cmd] },
            { id: 'p2', name: 'P2', cards: buildDeckCards(), commanders: [cmd] },
        ],
        startingPlayer: 'p1',
    });
    state = keepBoth(state);
    // p1 attacks with commander (unblocked) -> 21 commander damage -> p2 eliminated.
    const cmdUid = state.playersData.p1.commandZone[0].uid;
    // Move commander to battlefield manually to attack (simulate cast).
    const c = state.playersData.p1.commandZone.pop();
    c.instanceId = c.uid;
    c.tapped = false;
    c.summoningSick = false;
    c.damageMarked = 0;
    c.counters = { plusOne: 0 };
    c.turnBoost = { power: 0, toughness: 0 };
    c.attacking = false;
    state.playersData.p1.battlefield.push(c);
    // Advance to combat.
    state = advancePhase(state, 'p1'); // main1 -> combat
    state = declareAttackers(state, 'p1', [cmdUid], 'p2');
    // p2 declares no blockers.
    state = declareBlockers(state, 'p2', {});
    state = resolveCombat(state, 'p1');
    assert.equal(state.playersData.p2.eliminated, true);
    assert.equal(state.winner, 'p1');
    const dmg = state.playersData.p2.commanderDamage?.[cmdUid];
    assert.equal(dmg, 21);
});
