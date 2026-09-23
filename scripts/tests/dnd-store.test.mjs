import test from 'node:test';
import assert from 'node:assert/strict';
import { dndLocalStore, getLocalDndUser, isLocalDndUser } from '../../src/services/dndLocalStore.js';

const withStorage = (entries, run) => {
    const previous = globalThis.localStorage;
    const data = new Map(Object.entries(entries));
    globalThis.localStorage = {
        getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, String(value))
    };
    try { run(); } finally {
        if (previous === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previous;
    }
};

test('existing D&D campaigns retain their owner, characters, map and tokens', () => {
    const userId = '10000000-1000-4000-8000-100000000001';
    const session = { id: 'saved-session', user_id: userId, map_url: '/maps/castle.png', data: { round: 3 } };
    const hero = { id: 'saved-hero', user_id: userId, name: 'Mira' };
    const token = { id: 'saved-token', session_id: session.id, x: 120, y: 80 };
    withStorage({
        taverna_dnd5e_local_user_id: userId,
        taverna_dnd5e_local_sessions: JSON.stringify([session]),
        taverna_dnd5e_local_characters: JSON.stringify([hero]),
        taverna_dnd5e_local_tokens: JSON.stringify([token])
    }, () => {
        assert.equal(getLocalDndUser().id, userId);
        assert.equal(isLocalDndUser(getLocalDndUser()), true);
        assert.deepEqual(dndLocalStore.sessions.list(userId).data, [session]);
        assert.deepEqual(dndLocalStore.characters.list(userId).data, [hero]);
        assert.deepEqual(dndLocalStore.tokens.list(session.id).data, [token]);
        dndLocalStore.sessions.updateData(session.id, { round: 4 });
        dndLocalStore.tokens.update(token.id, { x: 220 });
        assert.equal(dndLocalStore.sessions.get(session.id).data.map_url, session.map_url);
        assert.equal(dndLocalStore.tokens.list(session.id).data[0].x, 220);
        assert.equal(dndLocalStore.tokens.list(session.id).data[0].y, 80);
    });
});

test('removing one D&D session leaves the other table and its chat intact', () => {
    withStorage({
        taverna_dnd5e_local_sessions: JSON.stringify([{ id: 'a' }, { id: 'b' }]),
        taverna_dnd5e_local_tokens: JSON.stringify([{ id: 'ta', session_id: 'a' }, { id: 'tb', session_id: 'b' }]),
        taverna_dnd5e_local_chat: JSON.stringify([{ id: 'ca', session_id: 'a' }, { id: 'cb', session_id: 'b' }])
    }, () => {
        dndLocalStore.sessions.delete('a');
        assert.equal(dndLocalStore.sessions.get('a').data, null);
        assert.equal(dndLocalStore.sessions.get('b').data.id, 'b');
        assert.deepEqual(dndLocalStore.tokens.list('a').data, []);
        assert.equal(dndLocalStore.tokens.list('b').data[0].id, 'tb');
        assert.deepEqual(dndLocalStore.chat.list('a').data, []);
        assert.equal(dndLocalStore.chat.list('b').data[0].id, 'cb');
    });
});
