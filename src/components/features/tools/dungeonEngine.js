// Original, deterministic generator. No Donjon code or content is embedded.
export const escapeMarkup = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function seededRandom(seed) {
    let state = 2166136261;
    for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
    return () => {
        state += 0x6D2B79F5;
        let n = Math.imul(state ^ state >>> 15, 1 | state);
        n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
        return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
}
const bounded = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Math.floor(Number(value)))) : fallback;
export function generateDungeon(options = {}) {
    const seed = String(options.seed || 'taverna');
    const random = seededRandom(seed);
    const pick = list => list[Math.floor(random() * list.length)];
    const count = bounded(options.rooms, 12, 5, 36);
    const columns = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / columns);
    const cell = 12;
    const width = columns * cell + 2, height = rows * cell + 2;
    const grid = Array.from({ length: height }, () => Array(width).fill(0));
    const rooms = Array.from({ length: count }, (_, i) => {
        const w = 4 + Math.floor(random() * 5), h = 4 + Math.floor(random() * 5);
        const x = 2 + i % columns * cell + Math.floor(random() * (cell - w - 2));
        const y = 2 + Math.floor(i / columns) * cell + Math.floor(random() * (cell - h - 2));
        for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) grid[yy][xx] = 1;
        return { id: i + 1, x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2),
            name: pick(['Sala delle statue', 'Cripta silenziosa', 'Archivio allagato', 'Cappella in rovina', 'Laboratorio abbandonato', 'Deposito sigillato']),
            detail: pick(['Un soffio freddo muove la polvere.', 'Orme fresche spariscono vicino alla parete.', 'Una campana lontana risuona a intervalli.', 'Rune consumate ricoprono il soffitto.', 'Una voce chiede di essere liberata.']),
            secret: pick(['Una nicchia custodisce una chiave di rame.', 'Una lastra nasconde un diario cifrato.', 'Un filo aziona un allarme: CD 13 per individuarlo.', 'Un custode vuole un pegno per lasciar passare.', 'Una fonte offre acqua limpida e una visione.']) };
    });
    const connections = [];
    const connected = [rooms[0]], pending = rooms.slice(1);
    while (pending.length) {
        let best;
        for (const a of connected) for (const b of pending) {
            const distance = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
            if (!best || distance < best.distance) best = { a, b, distance };
        }
        connections.push([best.a, best.b]);
        connected.push(best.b); pending.splice(pending.indexOf(best.b), 1);
    }
    if (options.loops) for (let i = 0; i < rooms.length - 1; i += 3) connections.push([rooms[i], rooms[i + 1]]);
    const doors = [], doorCells = new Set();
    for (const [a, b] of connections) {
        let x = a.cx, y = a.cy;
        const path = [[x, y]];
        const horizontalFirst = options.corridors !== 'vertical';
        const walkX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); path.push([x, y]); } };
        const walkY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); path.push([x, y]); } };
        if (horizontalFirst) { walkX(); walkY(); } else { walkY(); walkX(); }
        path.forEach(([xx, yy]) => { grid[yy][xx] = 1; });
        if (options.doors !== 'none') {
            const contains = (room, xx, yy) => xx >= room.x && xx < room.x + room.w && yy >= room.y && yy < room.y + room.h;
            for (let i = 1; i < path.length; i++) {
                const [xx, yy] = path[i], [px, py] = path[i - 1];
                if (!rooms.some(room => contains(room, px, py)) || rooms.some(room => contains(room, xx, yy))) continue;
                const key = `${xx},${yy}`;
                if (doorCells.has(key)) continue;
                doorCells.add(key);
                doors.push({ x: xx, y: yy, vertical: xx !== px, kind: options.doors === 'mixed' ? pick(['Porta', 'Bloccata', 'Segreta', 'Trappola', 'Saracinesca']) : 'Porta' });
            }
        }
    }
    return { version: 1, seed, name: String(options.name || 'Il sotterraneo dimenticato'), width, height, grid, rooms, doors,
        stairs: options.stairs === false ? [] : [{ x: rooms[0].cx, y: rooms[0].cy, direction: 'up' }, { x: rooms.at(-1).cx, y: rooms.at(-1).cy, direction: 'down' }] };
}
export function dungeonSvg(dungeon, { player = false, grid = true, style = 'parchment' } = {}) {
    const scale = 20;
    const dark = style === 'amethyst';
    const floor = dark ? '#cfb8e4' : '#f7f0df', wall = dark ? '#21142f' : '#242027';
    const tiles = dungeon.grid.flatMap((row, y) => row.flatMap((value, x) => value ? [`<rect x="${x * scale}" y="${y * scale}" width="20" height="20"/>`] : [])).join('');
    const doors = dungeon.doors.filter(d => !player || d.kind !== 'Segreta').map(d => `<rect x="${d.x * scale + (d.vertical ? 7 : 1)}" y="${d.y * scale + (d.vertical ? 1 : 7)}" width="${d.vertical ? 6 : 18}" height="${d.vertical ? 18 : 6}" fill="${!player && d.kind !== 'Porta' ? '#a34044' : '#fff'}" stroke="#21142f" stroke-width="2"/>`).join('');
    const labels = player ? '' : dungeon.rooms.map(r => `<text x="${r.cx * scale + 10}" y="${r.cy * scale + 8}" text-anchor="middle" fill="#21142f" font-family="sans-serif" font-size="12">${r.id}</text>`).join('');
    const stairs = dungeon.stairs.map(s => `<path d="M${s.x * scale + 3} ${s.y * scale + 12}h14m-12 3h10m-8 3h6" stroke="#21142f" fill="none" stroke-width="2"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${dungeon.width * scale}" height="${dungeon.height * scale}" viewBox="0 0 ${dungeon.width * scale} ${dungeon.height * scale}" role="img" aria-label="${escapeMarkup(dungeon.name)}"><title>${escapeMarkup(dungeon.name)}</title><defs><pattern id="dungeon-grid" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="${floor}"/><path d="M20 0H0V20" fill="none" stroke="#756886" stroke-opacity=".25"/></pattern></defs><rect width="100%" height="100%" fill="${wall}"/><g shape-rendering="crispEdges" fill="${grid ? 'url(#dungeon-grid)' : floor}">${tiles}</g>${doors}${stairs}${labels}</svg>`;
}
export function dungeonNotes(dungeon) {
    return `${dungeon.name}\nSeed: ${dungeon.seed}\n\n${dungeon.rooms.map(r => `${r.id}. ${r.name}\n${r.detail}\nSegreto del Master: ${r.secret}`).join('\n\n')}\n\nPorte: ${dungeon.doors.map(d => `${d.x},${d.y}: ${d.kind}`).join('; ')}`;
}
