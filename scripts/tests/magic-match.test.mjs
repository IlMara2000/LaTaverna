import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MATCH_RULES, adjustLife, advancePhase, castSpell, createMatch, declareAttackers, declareBlockers,
    castResponse, discardCards, mulliganAction, playLand, powerOf, resolveCombat, tapMana, validateMatchDeck
} from '../../src/dashboards/magicMatchEngine.js';

const cards = new Map();
const card = (id, overrides = {}) => {
    const value = {
        id, name: id, manaCost: '{1}{G}', cmc: 2, typeLine: 'Creature — Human', oracleText: '',
        power: '2', toughness: '2', keywords: [], colors: ['G'], colorIdentity: ['G'], image: '',
        ...overrides
    };
    cards.set(id, value);
    return value;
};
const creature = card('Elfo', {});
const forest = card('Foresta', { typeLine: 'Basic Land — Forest', manaCost: '', cmc: 0, power: '', toughness: '', oracleText: '{T}: Add {G}.' });
const bears = card('Orsi', {});

const hundred = () => Array.from({ length: 100 }, (_, index) => ({ ...(index < 40 ? forest : creature), quantity: 1 }));

const permanent = (uid, overrides = {}) => ({
    uid, instanceId: uid, id: uid, name: uid, manaCost: '{1}{G}', typeLine: 'Creature — Human',
    oracleText: '', power: '2', toughness: '2', keywords: [], colors: ['G'], colorIdentity: ['G'],
    tapped: false, summoningSick: false, damageMarked: 0, counters: { plusOne: 0 }, turnBoost: { power: 0, toughness: 0 },
    ...overrides
});

const started = () => {
    let state = createMatch({
        players: [
            { id: 'a', name: 'Tu', cards: hundred() },
            { id: 'b', name: 'Giocatore 2', cards: hundred() }
        ]
    });
    state = mulliganAction(state, 'a', 'keep');
    state = mulliganAction(state, 'b', 'keep');
    return state;
};

test('un mazzo da tavolo richiede almeno 100 carte e una sola copia al massimo', () => {
    const shortDeck = [{ cardId: 'Elfo', quantity: 99 }];
    assert.equal(validateMatchDeck(shortDeck, cards).valid, false);
    const fiveCopies = [{ cardId: 'Elfo', quantity: 2 }, { cardId: 'Foresta', quantity: 98 }];
    const five = validateMatchDeck(fiveCopies, cards);
    assert.equal(five.valid, false);
    assert.match(five.errors.join(' '), /Elfo/);
    const basicLands = [{ cardId: 'Foresta', quantity: 100 }];
    assert.equal(validateMatchDeck(basicLands, cards).valid, true);
});

test('la partita distribuisce sette carte, 20 vite e salta la prima pesca', () => {
    const state = started();
    assert.equal(state.mulliganActive, false);
    assert.equal(state.playersData.a.life, MATCH_RULES.startingLife);
    assert.equal(state.playersData.a.hand.length, 7);
    assert.equal(state.playersData.b.hand.length, 7);
    assert.equal(state.playersData.a.library.length, 93);
    assert.equal(state.activePlayer, 'a');
    assert.equal(state.phase, 'main1');
});

test('mulligan londinese: il primo è gratuito, dal secondo si mette in fondo', () => {
    let state = createMatch({
        players: [
            { id: 'a', name: 'Tu', cards: hundred() },
            { id: 'b', name: 'Giocatore 2', cards: hundred() }
        ]
    });
    state = mulliganAction(state, 'a', 'redraw');
    assert.equal(state.playersData.a.cardsToBottom, 0);
    state = mulliganAction(state, 'a', 'redraw');
    assert.equal(state.playersData.a.cardsToBottom, 1);
    assert.throws(() => mulliganAction(state, 'a', 'keep'), /Scegli 1 carta/);
    state = mulliganAction(state, 'a', 'select', 0);
    state = mulliganAction(state, 'a', 'keep');
    assert.equal(state.playersData.a.hand.length, 6);
    assert.equal(state.playersData.a.library.length, 94);
});

test('una terra per turno, solo in fase principale', () => {
    let state = started();
    state.playersData.a.hand = [permanent('terra-1', { typeLine: 'Basic Land — Forest', power: '', toughness: '' }), permanent('terra-2', { typeLine: 'Basic Land — Forest', power: '', toughness: '' })];
    state = playLand(state, 'a', 'terra-1');
    assert.equal(state.playersData.a.battlefield.length, 1);
    assert.throws(() => playLand(state, 'a', 'terra-2'), /già giocato una terra/);
    const combat = advancePhase(state, 'a');
    assert.throws(() => playLand(combat, 'a', 'terra-2'), /fase principale/);
});

test('il lancio paga il mana tappando le terre e risolve la magia', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('foresta', { typeLine: 'Basic Land — Forest', manaCost: '', power: '', toughness: '', oracleText: '{T}: Add {G}.' })];
    state.playersData.a.hand = [permanent('orso', { id: 'Orsi', manaCost: '{1}{G}', name: 'Orsi' })];
    state.playersData.a.colorIdentity = ['G'];
    state = tapMana(state, 'a', 'foresta');
    assert.equal(state.playersData.a.manaPool.G, 1);
    const pushed = castSpell({ ...state, playersData: { ...state.playersData, a: { ...state.playersData.a, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 3, C: 0 } } } }, 'a', 'orso');
    assert.equal(pushed.playersData.a.battlefield.some(item => item.name === 'Orsi'), true);
});

test('un attaccante non bloccato toglie vita al giocatore attaccato', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('attaccante')];
    state = advancePhase(state, 'a');
    state = declareAttackers(state, 'a', ['attaccante'], 'b');
    state = declareBlockers(state, 'b', {});
    state = resolveCombat(state, 'a');
    assert.equal(state.playersData.b.life, 38);
    assert.equal(state.playersData.a.battlefield[0].tapped, true);
});

test('bloccante e attaccante si scambiano danno simultaneo e muoiono entrambi', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('attaccante')];
    state.playersData.b.battlefield = [permanent('bloccante')];
    state = advancePhase(state, 'a');
    state = declareAttackers(state, 'a', ['attaccante'], 'b');
    state = declareBlockers(state, 'b', { attaccante: 'bloccante' });
    state = resolveCombat(state, 'a');
    assert.equal(state.playersData.a.battlefield.length, 0);
    assert.equal(state.playersData.b.battlefield.length, 0);
    assert.equal(state.playersData.a.graveyard.length, 1);
    assert.equal(state.playersData.b.graveyard.length, 1);
    assert.equal(state.playersData.b.life, 40);
});

// Tavolo da quattro: stessa preparazione, turni in ordine e difensore scelto.
const fourPlayers = () => {
    let state = createMatch({
        players: ['a', 'b', 'c', 'd'].map(id => ({ id, name: `Giocatore ${id.toUpperCase()}`, cards: hundred() }))
    });
    for (const id of ['a', 'b', 'c', 'd']) state = mulliganAction(state, id, 'keep');
    return state;
};
const passTurn = (state, id) => {
    let next = advancePhase(state, id);
    next = advancePhase(next, id);
    next = advancePhase(next, id);
    const hand = next.playersData[id].hand;
    const excess = hand.length - MATCH_RULES.openingHand;
    if (excess > 0) next = discardCards(next, id, hand.slice(0, excess).map(card => card.uid));
    return advancePhase(next, id);
};

test('quattro giocatori ricevono sette carte e il turno gira in ordine', () => {
    let state = fourPlayers();
    assert.deepEqual(state.players, ['a', 'b', 'c', 'd']);
    assert.ok(state.players.every(id => state.playersData[id].hand.length === 7));
    assert.equal(state.activePlayer, 'a');
    state = passTurn(state, 'a');
    assert.equal(state.activePlayer, 'b');
    state = passTurn(state, 'b');
    assert.equal(state.activePlayer, 'c');
    state = passTurn(state, 'c');
    assert.equal(state.activePlayer, 'd');
    state = passTurn(state, 'd');
    assert.equal(state.activePlayer, 'a');
    assert.equal(state.turn, 2);
});

test('si attacca il difensore scelto e solo lui può bloccare', () => {
    let state = fourPlayers();
    state.playersData.a.battlefield = [permanent('attaccante')];
    state.playersData.c.battlefield = [permanent('bloccante-c')];
    state = advancePhase(state, 'a');
    state = declareAttackers(state, 'a', ['attaccante'], 'c');
    assert.equal(state.combat.defender, 'c');
    assert.throws(() => declareBlockers(state, 'b', {}), /Solo il giocatore attaccato/);
    const blocked = declareBlockers(state, 'c', { attaccante: 'bloccante-c' });
    assert.equal(blocked.combat.blockers.attaccante, 'bloccante-c');
    const resolved = resolveCombat(blocked, 'a');
    assert.equal(resolved.playersData.c.life, 40);
    assert.equal(resolved.playersData.b.life, 40);
    assert.equal(resolved.playersData.c.battlefield.length, 0);
});

test('un giocatore eliminato viene saltato nel giro di turni', () => {
    let state = fourPlayers();
    state = adjustLife(state, 'a', 'c', -40);
    assert.equal(state.playersData.c.eliminated, true);
    assert.equal(state.winner, null);
    state = passTurn(state, 'a');
    assert.equal(state.activePlayer, 'b');
    state = passTurn(state, 'b');
    assert.equal(state.activePlayer, 'd');
    assert.equal(state.winner, null);
});

test('con quattro giocatori vince l\'ultimo rimasto in gioco', () => {
    let state = fourPlayers();
    state = adjustLife(state, 'a', 'b', -40);
    state = adjustLife(state, 'a', 'c', -40);
    assert.equal(state.winner, null);
    state = adjustLife(state, 'a', 'd', -40);
    assert.equal(state.winner, 'a');
    assert.equal(state.playersData.b.life, 0);
});

test('il vincitore viene annunciato una volta sola', () => {
    let state = started();
    state = adjustLife(state, 'a', 'b', -40);
    assert.equal(state.winner, 'a');
    state = adjustLife(state, 'a', 'b', -1);
    assert.equal(state.log.filter(line => /vince la partita/.test(line)).length, 1);
});

test('la debolezza da evocazione sparisce allo stappare del proprio turno', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('nuova', { summoningSick: true })];
    state = advancePhase(state, 'a');
    state = advancePhase(state, 'a');
    state = advancePhase(state, 'a');
    state = advancePhase(state, 'a');
    assert.equal(state.activePlayer, 'b');
    state = advancePhase(state, 'b');
    state = advancePhase(state, 'b');
    state = advancePhase(state, 'b');
    // Giocatore 2 pesca all'inizio del turno: deve scartare prima di chiuderlo.
    const excess = state.playersData.b.hand.length - MATCH_RULES.openingHand;
    if (excess > 0) state = discardCards(state, 'b', state.playersData.b.hand.slice(0, excess).map(card => card.uid));
    state = advancePhase(state, 'b');
    assert.equal(state.activePlayer, 'a');
    assert.equal(state.playersData.a.battlefield[0].summoningSick, false);
    const combat = advancePhase(state, 'a');
    const attacking = declareAttackers(combat, 'a', ['nuova'], 'b');
    assert.equal(attacking.combat.attackerIds.length, 1);
});

test('prima colpo uccide il bloccante senza subire danno di ritorno', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('prima-colpo', { keywords: ['First strike'] })];
    state.playersData.b.battlefield = [permanent('bloccante')];
    state = advancePhase(state, 'a');
    state = declareAttackers(state, 'a', ['prima-colpo'], 'b');
    state = declareBlockers(state, 'b', { 'prima-colpo': 'bloccante' });
    state = resolveCombat(state, 'a');
    assert.equal(state.playersData.b.battlefield.length, 0);
    assert.equal(state.playersData.a.battlefield.length, 1);
    assert.equal(state.playersData.b.life, 40);
});

test('trapassare trasferisce al giocatore il danno che avanza', () => {
    let state = started();
    state.playersData.a.battlefield = [permanent('grande', { power: '4', toughness: '4', keywords: ['Trample'] })];
    state.playersData.b.battlefield = [permanent('bloccante')];
    state = advancePhase(state, 'a');
    state = declareAttackers(state, 'a', ['grande'], 'b');
    state = declareBlockers(state, 'b', { grande: 'bloccante' });
    state = resolveCombat(state, 'a');
    assert.equal(state.playersData.b.battlefield.length, 0);
    assert.equal(state.playersData.b.life, 38);
    assert.equal(powerOf(state.playersData.a.battlefield[0]), 4);
});

test('un istantaneo può rispondere nel turno avversario', () => {
    const state = passTurn(started(), 'a');
    assert.equal(state.activePlayer, 'b');
    state.playersData.a.battlefield.push(permanent('Bosco', { typeLine: 'Basic Land — Forest', oracleText: '{T}: Add {G}.', power: '', toughness: '' }));
    state.playersData.a.hand = [{ ...card('Risposta', { typeLine: 'Instant', manaCost: '{G}', cmc: 1, power: '', toughness: '' }), uid: 'r1' }];
    const after = castResponse(state, 'a', 'r1');
    assert.equal(after.playersData.a.hand.length, 0);
    assert.match(after.log.join(' '), /risponde con Risposta/);
    assert.equal(after.activePlayer, 'b');
});

test('solo un istantaneo risponde, e nel proprio turno si lancia normalmente', () => {
    const state = passTurn(started(), 'a');
    state.playersData.a.hand = [{ ...card('Lenta', { typeLine: 'Sorcery' }), uid: 'x1' }];
    assert.throws(() => castResponse(state, 'a', 'x1'), /istantaneo/i);
    const own = started();
    own.playersData.a.hand = [{ ...card('Risposta', { typeLine: 'Instant', manaCost: '{G}', cmc: 1 }), uid: 'x2' }];
    assert.throws(() => castResponse(own, 'a', 'x2'), /lancia normalmente/i);
});
