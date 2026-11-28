import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWantlistExport } from '../../src/services/magicWantlistExport.js';
import { MAGIC_SYMBOLS } from '../../src/services/magicSymbolCatalog.js';
import { renderCardSymbols, registerCardSymbols } from '../../src/services/cardSymbols.js';
const cards = [{ id: 'one', name: 'Lightning Bolt', printedName: 'Fulmine', language: 'it', quantity: 4, manaCost: '{R}', typeLine: 'Instant' }, { id: 'two', name: 'Plains', manaCost: '', quantity: undefined }];
test('wantlist supports all formats, names and valid quantities without network access', () => {
    const it = buildWantlistExport(cards);
    assert.equal(it.content, '4 Fulmine\r\n1 Plains\r\n');
    assert.equal(it.originalNames, 1);
    assert.equal(buildWantlistExport(cards, { language: 'en' }).content, '4 Lightning Bolt\r\n1 Plains\r\n');
    const rows = JSON.parse(buildWantlistExport(cards, { format: 'json' }).content);
    assert.equal(rows.length, 2); assert.equal(rows[0].manaCost, '{R}'); assert.equal(rows[1].quantity, 1);
    const csv = buildWantlistExport(cards, { format: 'csv' });
    assert.ok(csv.content.startsWith('\uFEFF')); assert.ok(csv.content.includes('"Fulmine","4"'));
});
test('wantlist exports only supplied rows; empty or unsupported export is rejected', () => {
    assert.equal(buildWantlistExport(cards.slice(1)).count, 1);
    assert.throws(() => buildWantlistExport([]), /Nessuna carta/);
    assert.throws(() => buildWantlistExport(cards, { format: 'doc' }), /non valido/);
});
test('pdf wantlist is a valid one-card-per-line English list', () => {
    const file = buildWantlistExport(cards, { language: 'en', format: 'pdf' });
    assert.equal(file.mime, 'application/pdf');
    assert.equal(file.filename, 'wantlist-magic-en.pdf');
    const text = Buffer.from(file.content).toString('latin1');
    assert.ok(text.startsWith('%PDF-1.4'));
    assert.ok(text.trimEnd().endsWith('%%EOF'));
    assert.ok(text.includes('(4 Lightning Bolt) Tj'));
    assert.ok(!text.includes('Fulmine'));
    // xref: startxref points at the table and every entry at its object.
    const start = Number(text.match(/startxref\n(\d+)/)[1]);
    assert.equal(text.slice(start, start + 4), 'xref');
    const first = Number(text.match(/0000000000 65535 f \n(\d{10}) 00000 n/)[1]);
    assert.equal(first, text.indexOf('1 0 obj'));
});
test('CSV preserves punctuation and accents without executing formulas', () => {
    const file = buildWantlistExport([{ name: '=HYPERLINK("x")', quantity: 2 }, { name: 'Æther, "Fuoco"\nSecondo', quantity: 0 }], { format: 'csv' });
    assert.ok(file.content.includes('"\'=HYPERLINK(""x"")"'));
    assert.ok(file.content.includes('"Æther, ""Fuoco""\nSecondo","1"'));
});
test('Italian export does not mislabel another language as Italian', () => {
    const file = buildWantlistExport([{ name: 'Island', printedName: 'Insel', language: 'de' }]);
    assert.equal(file.content, '1 Island\r\n'); assert.equal(file.originalNames, 1);
});
test('all catalog symbols resolve to bundled SVG files', () => {
    assert.equal(Object.keys(MAGIC_SYMBOLS).length, 84);
    for (const value of Object.values(MAGIC_SYMBOLS)) {
        const svg = readFileSync(new URL(`../../public${value.src}`, import.meta.url), 'utf8');
        assert.match(svg, /<svg/); assert.ok(!svg.includes('<script')); assert.ok(value.label && value.source);
    }
});
test('mana, hybrid, Phyrexian, tap, untap and energy use original art', () => {
    const html = renderCardSymbols('{2}{W}{U}{B}{R}{G}{C}{S}{W/U}{B/P}{T}{Q}{E}');
    assert.equal((html.match(/<img /g) || []).length, 13);
    assert.ok(!html.includes('{W}')); assert.ok(html.includes('/assets/symbols/mtg/W.svg'));
});
test('symbols escape card markup and never borrow another game’s vocabulary', () => {
    const html = renderCardSymbols('<img src=x onerror=alert(1)> {T} {UNKNOWN}');
    assert.ok(html.startsWith('&lt;img')); assert.ok(html.includes('{UNKNOWN}'));
    assert.equal(renderCardSymbols('{W}{T}', 'pokemon'), '{W}{T}');
    assert.throws(() => registerCardSymbols('pokemon', { '{FIRE}': { src: '/assets/symbols/mtg/R.svg', label: 'Fire', source: 'https://example.com' } }));
});
