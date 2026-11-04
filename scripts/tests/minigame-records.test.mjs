import test from 'node:test';
import assert from 'node:assert/strict';
import {
    STORAGE_KEY,
    normalizeRecord,
    getMinigameRecord,
    recordMinigameResult,
    describeMinigameRecord,
    renderMinigameRecordLine,
    resetMinigameRecord
} from '../../src/services/minigameRecords.js';

function fakeStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        data,
        getItem: key => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => { data.set(key, String(value)); },
        removeItem: key => { data.delete(key); }
    };
}

test('an untouched game reports an empty record, not undefined', () => {
    const storage = fakeStorage();
    assert.deepEqual(getMinigameRecord('scopa', { storage }), {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        streak: 0,
        bestStreak: 0,
        bestScore: null,
        lastOutcome: null,
        lastPlayedAt: null
    });
    assert.equal(describeMinigameRecord('scopa', { storage }), 'Nessuna partita');
    assert.equal(renderMinigameRecordLine('scopa', { storage }), '');
});

test('wins, losses and draws accumulate and the win streak resets', () => {
    const storage = fakeStorage();
    const at = Date.UTC(2026, 10, 4);
    recordMinigameResult('briscola', 'win', { storage, at });
    recordMinigameResult('briscola', 'win', { storage, at });
    let record = getMinigameRecord('briscola', { storage });
    assert.equal(record.played, 2);
    assert.equal(record.wins, 2);
    assert.equal(record.streak, 2);
    assert.equal(record.bestStreak, 2);
    assert.equal(record.lastPlayedAt, new Date(at).toISOString());

    recordMinigameResult('briscola', 'loss', { storage, at });
    record = getMinigameRecord('briscola', { storage });
    assert.equal(record.played, 3);
    assert.equal(record.losses, 1);
    assert.equal(record.streak, 0);
    assert.equal(record.bestStreak, 2);
    assert.equal(record.lastOutcome, 'loss');

    recordMinigameResult('briscola', 'draw', { storage, at });
    assert.equal(getMinigameRecord('briscola', { storage }).draws, 1);
});

test('best score respects the direction of the game', () => {
    const storage = fakeStorage();
    recordMinigameResult('scopa', 'win', { storage, score: 11 });
    recordMinigameResult('scopa', 'win', { storage, score: 7 });
    recordMinigameResult('scopa', 'win', { storage, score: 13 });
    assert.equal(getMinigameRecord('scopa', { storage }).bestScore, 13);

    recordMinigameResult('solitario', 'win', { storage, score: 140, betterWhen: 'lower' });
    recordMinigameResult('solitario', 'win', { storage, score: 96, betterWhen: 'lower' });
    recordMinigameResult('solitario', 'win', { storage, score: 120, betterWhen: 'lower' });
    assert.equal(getMinigameRecord('solitario', { storage }).bestScore, 96);
});

test('invalid input is ignored without touching stored records', () => {
    const storage = fakeStorage();
    assert.equal(recordMinigameResult('', 'win', { storage }), null);
    assert.equal(recordMinigameResult('scopa', 'victory', { storage }), null);
    recordMinigameResult('scopa', 'win', { storage });
    assert.equal(getMinigameRecord('scopa', { storage }).played, 1);
    assert.deepEqual(getMinigameRecord(null, { storage }).played, 0);
});

test('corrupted or foreign payloads never break the games', () => {
    const broken = fakeStorage({ [STORAGE_KEY]: '{not json' });
    assert.equal(getMinigameRecord('scopa', { storage: broken }).played, 0);
    recordMinigameResult('scopa', 'win', { storage: broken });
    assert.equal(getMinigameRecord('scopa', { storage: broken }).played, 1);

    const foreign = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ version: 99, games: { scopa: { played: 5 } } }) });
    assert.equal(getMinigameRecord('scopa', { storage: foreign }).played, 0);

    const nonsense = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, games: { scopa: { played: -3, wins: 'molte', bestScore: 'x' } } }) });
    assert.deepEqual(getMinigameRecord('scopa', { storage: nonsense }), {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        streak: 0,
        bestStreak: 0,
        bestScore: null,
        lastOutcome: null,
        lastPlayedAt: null
    });
});

test('normalizeRecord never reports more results than games played', () => {
    const record = normalizeRecord({ played: 2, wins: 9, losses: 9, draws: 9, streak: 1 });
    assert.equal(record.wins, 2);
    assert.equal(record.losses, 2);
    assert.equal(record.draws, 2);
});

test('the record line summarises wins, losses and the current streak', () => {
    const storage = fakeStorage();
    recordMinigameResult('scala40', 'win', { storage, score: 40 });
    recordMinigameResult('scala40', 'win', { storage, score: 55 });
    recordMinigameResult('scala40', 'loss', { storage });
    assert.equal(describeMinigameRecord('scala40', { storage }), '2 vinte · 1 perse');
    assert.equal(renderMinigameRecordLine('scala40', { storage }), 'Record: 2 vinte · 1 perse · record 55');
    const cleared = resetMinigameRecord('scala40', { storage });
    assert.equal(cleared, true);
    assert.equal(getMinigameRecord('scala40', { storage }).played, 0);
});
