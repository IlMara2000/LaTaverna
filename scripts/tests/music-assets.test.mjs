import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const readJson = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));

test('previous releases can still load every music URL after a deployment', () => {
    const legacy = ['tavern', 'common-room', 'dungeon', 'battle', 'arcane', 'cards', 'chess', 'challenge'];
    const rewrites = readJson('vercel.json').rewrites;
    const catalog = readJson('src/data/musicCatalog.json');
    const current = new Set(Object.values(catalog).flatMap(p => p.tracks.map(t => t.url)));
    const destinations = new Set();
    for (const name of legacy) {
        const rule = rewrites.find(r => r.source === `/audio/${name}.mp3`);
        assert.ok(rule, `Missing compatibility URL for ${name}`);
        assert.ok(current.has(rule.destination), `Alias ${name} must point to a current recording`);
        assert.ok(statSync(new URL(`public${rule.destination}`, root)).size > 0);
        destinations.add(rule.destination);
    }
    assert.equal(destinations.size, legacy.length, 'Keep distinct recordings for the eight previous tracks');
});
