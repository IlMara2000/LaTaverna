import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon, dungeonSvg } from '../../src/components/features/tools/dungeonEngine.js';
import { constrainHandle } from '../../src/components/layout/floatingHandle.js';

test('menu keeps interior coordinates and remains reachable on every edge and corner', () => {
    const view = { left: 0, top: 0, width: 390, height: 844 };
    const middle = constrainHandle(123, 345, 56, 56, view);
    assert.equal(middle.left, 123); assert.equal(middle.top, 345);
    for (const x of [-1000, 120, 2000]) for (const y of [-1000, 300, 2000]) {
        const p = constrainHandle(x, y, 56, 56, view);
        assert.ok(p.left >= -28 && p.left <= 362);
        assert.ok(p.top >= -28 && p.top <= 816);
    }
    const p = constrainHandle(-100, 900, 56, 56, view);
    assert.deepEqual(p.clipped, { left: 28, right: 0, top: 0, bottom: 28 });
});
test('menu follows visual viewport bounds when keyboard or zoom changes them', () => {
    const p = constrainHandle(400, 800, 56, 56, { left: 20, top: 80, width: 250, height: 300 });
    assert.equal(p.left, 242); assert.equal(p.top, 352);
});
test('dungeon is reproducible, bounded and every floor tile is connected', () => {
    for (const rooms of [5, 12, 36]) for (let i = 0; i < 20; i++) {
        const options = { seed: `case-${i}`, rooms, loops: i % 2 === 0, corridors: i % 3 ? 'vertical' : 'horizontal', doors: 'mixed' };
        const d = generateDungeon(options);
        assert.deepEqual(d, generateDungeon(options)); assert.equal(d.rooms.length, rooms);
        const first = d.rooms[0], stack = [[first.cx, first.cy]], seen = new Set();
        while (stack.length) {
            const [x,y] = stack.pop(), key = `${x},${y}`;
            if (seen.has(key) || !d.grid[y]?.[x]) continue;
            seen.add(key);
            stack.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
        }
        assert.equal(seen.size, d.grid.flat().filter(Boolean).length);
        for (const r of d.rooms) assert.ok(r.x > 0 && r.y > 0 && r.x+r.w < d.width && r.y+r.h < d.height);
    }
});
test('player export excludes room labels, secret doors, special door colors and hostile markup', () => {
    const d = generateDungeon({ seed: 'privacy', name: '<script>alert(1)</script>', doors: 'mixed' });
    d.doors = [{ x: 1, y: 1, kind: 'Segreta', vertical: true }];
    const svg = dungeonSvg(d, { player: true });
    assert.ok(!svg.includes('<script>')); assert.ok(!svg.includes('<text'));
    assert.ok(!svg.includes('#a34044'));
    assert.ok(!svg.includes('fill="#fff"'));
    assert.ok(dungeonSvg(d).includes('fill="#a34044"'));
});
test('dungeon options remove stairs and doors and clamp invalid room counts', () => {
    const d = generateDungeon({ rooms: 999, doors: 'none', stairs: false });
    assert.equal(d.rooms.length, 36); assert.equal(d.doors.length, 0); assert.equal(d.stairs.length, 0);
    assert.equal(generateDungeon({ rooms: 'bad' }).rooms.length, 12);
});
