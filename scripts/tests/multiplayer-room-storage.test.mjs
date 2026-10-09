import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function storageHarness() {
    const values = new Map();
    const context = vm.createContext({
        SUPABASE_CONFIG: {},
        localStorage: {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
            removeItem: key => values.delete(key),
        },
    });
    const source = readFileSync(new URL('../../src/services/minigameMultiplayer.js', import.meta.url), 'utf8')
        .replace(/^import .*;\n/gm, '').replaceAll('export ', '');
    vm.runInContext(`${source}\nglobalThis.api = {saveRoom, getSavedMinigameRoom, getSavedMagicRoom, clearSavedMinigameRoom};`, context);
    return context.api;
}
const room = (code, scope = 'minigames', updatedAt = '2026-10-09T10:00:00Z') => ({ code, data: {scope}, updatedAt });

test('late reads and disconnect writes from a previous room cannot replace the new connection', () => {
    const api = storageHarness();
    api.saveRoom(room('OLD123'), true);
    api.saveRoom(room('NEW123'), true);
    api.saveRoom(room('OLD123', 'minigames', '2026-10-09T10:01:00Z'));
    assert.equal(api.getSavedMinigameRoom().code, 'NEW123');
    api.clearSavedMinigameRoom();
    api.saveRoom(room('NEW123'));
    assert.equal(api.getSavedMinigameRoom(), null, 'a late response cannot reconnect after leaving');
});

test('older events cannot roll back a saved room, and Magic keeps a separate connection', () => {
    const api = storageHarness();
    api.saveRoom(room('NEW123', 'minigames', '2026-10-09T10:02:00Z'), true);
    api.saveRoom(room('NEW123'));
    assert.equal(api.getSavedMinigameRoom().updatedAt, '2026-10-09T10:02:00Z');
    api.saveRoom(room('MAG123', 'magic'), true);
    assert.equal(api.getSavedMinigameRoom().code, 'NEW123');
    assert.equal(api.getSavedMagicRoom().code, 'MAG123');
});
