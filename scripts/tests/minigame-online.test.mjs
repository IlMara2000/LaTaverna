import test from 'node:test';
import assert from 'node:assert/strict';
import { enterMatch, changeMatch, cardPerspective, onlineSeat, ONLINE_TIMEOUT } from '../../src/dashboards/minigames/onlineMatchProtocol.js';

const roster = ['host', 'guest'];
const now = 100000;
test('two humans entering share one deal; the second client does not redeal', () => {
    const first = enterMatch({}, 'solo', 0, { players: [['red'], ['blue']], turn: 0 }, roster, now);
    const second = enterMatch(first, 'solo', 1, { players: [['wrong'], ['deal']], turn: 0 }, roster, now + 1);
    assert.equal(first.onlineMatch.id, second.onlineMatch.id);
    assert.deepEqual(second.onlineMatch.state, first.onlineMatch.state);
    assert.deepEqual(second.onlineMatch.presence, [now, now + 1]);
});
test('no moves before the other human joins, after leaving or after timeout', () => {
    const first = enterMatch({}, 'solo', 0, {}, roster, now);
    assert.throws(() => changeMatch(first, first.onlineMatch.id, 0, 0, {}, now), /attesa/);
    const both = enterMatch(first, 'solo', 1, {}, roster, now);
    assert.throws(() => changeMatch(both, both.onlineMatch.id, 0, 0, {}, now + ONLINE_TIMEOUT), /attesa/);
    both.onlineMatch.presence[1] = null;
    assert.throws(() => changeMatch(both, both.onlineMatch.id, 0, 0, {}, now), /attesa/);
});
test('a delayed or duplicate move cannot overwrite a newer revision', () => {
    const first = enterMatch({}, 'solo', 0, { turn: 0 }, roster, now);
    const both = enterMatch(first, 'solo', 1, {}, roster, now);
    const moved = changeMatch(both, both.onlineMatch.id, 0, 0, { turn: 1 }, now);
    assert.equal(moved.onlineMatch.revision, 1);
    assert.throws(() => changeMatch(moved, moved.onlineMatch.id, 0, 0, { turn: 0 }, now), /aggiornata/);
    assert.throws(() => changeMatch(moved, 'old-match', 1, 1, {}, now), /attiva/);
});
test('different games cannot replace an active opponent; new roster gets a fresh match', () => {
    const first = enterMatch({}, 'solo', 0, {}, roster, now);
    assert.throws(() => enterMatch(first, 'briscola', 1, {}, roster, now), /altro gioco/);
    const replacement = enterMatch(first, 'solo', 1, { fresh: true }, ['host', 'new-guest'], now);
    assert.notEqual(replacement.onlineMatch.id, first.onlineMatch.id);
});
test('guest sees its own hand, turn, score, trick owner and result; conversion is reversible', () => {
    const snapshot = { players: [['host-card'], ['guest-card']], turn: 1, scores: [30, 45], table: [{ owner: 0, card: 'A' }], winner: 1 };
    const guest = cardPerspective(snapshot, 1);
    assert.deepEqual(guest.players[0], ['guest-card']);
    assert.equal(guest.turn, 0);
    assert.equal(guest.scores[0], 45);
    assert.equal(guest.table[0].owner, 1);
    assert.equal(guest.winner, 0);
    assert.deepEqual(cardPerspective(guest, 1), snapshot);
    assert.equal(snapshot.turn, 1);
});
test('only the two room members receive player seats', () => {
    const room = { hostClientId: 'host', guestClientId: 'guest' };
    assert.equal(onlineSeat(room, 'host'), 0);
    assert.equal(onlineSeat(room, 'guest'), 1);
    assert.throws(() => onlineSeat(room, 'stranger'), /Non fai parte/);
});

// Exercise Solo's real move code so online special cards cannot reintroduce bot turns.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function soloHarness() {
    const source = readFileSync(new URL('../../src/dashboards/minigames/solo.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/gm, '').replace('export function initSoloGame', 'function initSoloGame');
    let commits = 0;
    const context = vm.createContext({
        setTimeout: () => { throw new Error('Online must never schedule a bot'); },
        window: {}, console, getRoomParticipants: () => ['host', 'guest'],
    });
    vm.runInContext(`${source}
        updateUI = () => {};
        logStatus = () => {};
        animateCardMove = async () => {};
        globalThis.api = { startGame, playCard, endTurn, botLogic };
    `, context);
    const state = { onlineMode: true, turn: 0, direction: 1, gameActive: true, isAnimating: false,
        currentColor: 'red', currentVal: '7', playerSaidSolo: true, catchableBots: [], discardPile: [{color:'red', val:'7'}],
        deck: Array.from({length:20}, () => ({color:'yellow',val:'3'})),
        players: [[], [{color:'blue',val:'8'}, {color:'green',val:'6'}]],
        onlineSync: { commit: () => { commits++; } }
    };
    const container = { querySelector: () => ({style:{}}) };
    return { api: context.api, state, container, commits: () => commits };
}
for (const value of ['5', 'SKIP', 'REV', '+2', '+4', 'WILD']) {
    test(`Solo online ${value} is applied to the other human and never calls AI`, async () => {
        const h = soloHarness();
        const wild = ['+4','WILD'].includes(value);
        h.state.players[0] = [{color:wild?'wild':'red',val:value}, {color:'blue',val:'1'}, {color:'green',val:'2'}];
        await h.api.playCard(0, 0, h.state, h.container);
        if (wild) {
            assert.equal(h.state.choosingColor, true);
            assert.equal(h.commits(), 0, 'wild color is chosen before publishing the move');
            h.state.currentColor = 'green';
            h.state.choosingColor = false;
            h.api.endTurn(h.state, h.container);
        }
        assert.equal(h.state.players[1].length, value === '+2' ? 4 : value === '+4' ? 6 : 2);
        assert.equal(h.state.turn, ['SKIP','REV','+2','+4'].includes(value) ? 0 : 1);
        assert.equal(h.commits(), 1);
    });
}
test('Solo online victory is shared instead of unlocking a bot level or quitting locally', async () => {
    const h = soloHarness();
    h.state.players[0] = [{color:'red',val:'5'}];
    await h.api.playCard(0,0,h.state,h.container);
    assert.equal(h.state.winner,0);
    assert.equal(h.state.gameActive,false);
    assert.equal(h.commits(),1);
});
test('Solo bot entry point is inert online; online deals two hands and local deals four', () => {
    const h = soloHarness();
    h.api.botLogic(h.state,h.container);
    h.api.startGame(h.state,h.container);
    assert.equal(h.state.players.length,2);
    assert.ok(h.state.players.every(hand => hand.length === 7));
    h.state.onlineMode = false;
    h.api.startGame(h.state,h.container);
    assert.equal(h.state.players.length,4);
});
