import test from 'node:test';
import assert from 'node:assert/strict';

import { renderOracleMarkdown } from '../../src/services/oracleMarkdown.js';

// safeUrl legge location.origin: nei test non c'è un browser, quindi lo simuliamo.
globalThis.location = { origin: 'http://localhost' };

test('ORACOLO: le tabelle Markdown diventano tabelle con intestazione e righe', () => {
    const html = renderOracleMarkdown([
        '**Palla di Fuoco (*Fireball*) — D&D 5e**',
        '',
        '| Parametro | Dettaglio |',
        '|---|---|',
        '| **Tempo di lancio** | 1 azione |',
        '| **Raggio** | 45 m |'
    ].join('\n'));

    assert.match(html, /<div class="oracle-table-wrap"><table><thead><tr><th>Parametro<\/th><th>Dettaglio<\/th><\/tr><\/thead>/);
    assert.match(html, /<tbody><tr><td><strong>Tempo di lancio<\/strong><\/td><td>1 azione<\/td><\/tr>/);
    assert.match(html, /<td>45 m<\/td>/);
    assert.doesNotMatch(html, /\|---\|/, 'la riga di separazione non deve restare testo');
    assert.doesNotMatch(html, /\*\*/, 'non devono restare asterischi di grassetto grezzi');
});

test('ORACOLO: titoli e sezioni ricevono emoji contestuali senza duplicarle', () => {
    const spell = renderOracleMarkdown([
        '## Effetto',
        'Una sfera di fuoco.',
        '',
        '## Note rapide',
        '- Il danno medio è 28.',
        '',
        '**Palla di Fuoco (*Fireball*) — D&D 5e**',
        '8d6 danni.'
    ].join('\n'));

    assert.match(spell, /<h2>✨ Effetto<\/h2>/);
    assert.match(spell, /<h2>📝 Note rapide<\/h2>/);
    assert.match(spell, /<p class="oracle-md-sub"><strong>🎲 Palla di Fuoco \(<em>Fireball<\/em>\) — D&amp;D 5e<\/strong><\/p>/);

    const already = renderOracleMarkdown('## 🎲 Iniziativa\nTesto.');
    assert.match(already, /<h2>🎲 Iniziativa<\/h2>/);
    assert.doesNotMatch(already, /🎲 🎲/, 'l’emoji del modello non va raddoppiata');

    const neutral = renderOracleMarkdown('## Titolo\nNessun tema riconoscibile.');
    assert.match(neutral, /<h2>🕯️ Titolo<\/h2>/);
});

test('ORACOLO: il tema carte usa 🃏 anche nei titoli generici', () => {
    const html = renderOracleMarkdown([
        '**Lightning Bolt**',
        '',
        '**Effetto**',
        'Infligge 3 danni. Aggiungi la carta al mazzo.'
    ].join('\n'));

    assert.match(html, /<strong>🃏 Lightning Bolt<\/strong>/);
    assert.match(html, /<strong>✨ Effetto<\/strong>/);
});

test('ORACOLO: elenchi puntati, numerati e annidati restano strutturati', () => {
    const html = renderOracleMarkdown([
        '- primo **forte**',
        '  - annidato',
        '- secondo',
        '',
        '1. uno',
        '2. due'
    ].join('\n'));

    assert.match(html, /<ul><li>primo <strong>forte<\/strong><ul><li>annidato<\/li><\/ul><\/li><li>secondo<\/li><\/ul>/);
    assert.match(html, /<ol><li>uno<\/li><li>due<\/li><\/ol>/);
    assert.doesNotMatch(html, /<li>[^<]*- /, 'i trattini degli elenchi non devono restare visibili');
});

test('ORACOLO: grassetto, corsivo, codice, citazioni, link e separatori', () => {
    const html = renderOracleMarkdown([
        '**Grassetto** e *corsivo* con `codice`.',
        '',
        '> Una citazione',
        '',
        '---',
        '',
        '[Scryfall](https://scryfall.com)'
    ].join('\n'));

    assert.match(html, /<strong>Grassetto<\/strong> e <em>corsivo<\/em> con <code>codice<\/code>/);
    assert.match(html, /<blockquote><p>Una citazione<\/p><\/blockquote>/);
    assert.match(html, /<hr>/);
    assert.match(html, /<a href="https:\/\/scryfall\.com\/" target="_blank" rel="noopener noreferrer">Scryfall<\/a>/);
});

test('ORACOLO: HTML del modello e URL pericolosi non vengono eseguiti', () => {
    const html = renderOracleMarkdown([
        '**<script>alert(1)</script>**',
        '',
        '<a href="javascript:alert(1)">x</a>',
        '',
        '[clicca](javascript:alert(1))'
    ].join('\n'));

    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /href="javascript:/i);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /&lt;a href=&quot;javascript:alert\(1\)&quot;&gt;x&lt;\/a&gt;/);
});

test('ORACOLO: i blocchi di codice restano codice, senza formattazione interna', () => {
    const html = renderOracleMarkdown('```js\nconst dado = 8;\n```');
    assert.match(html, /<pre><code class="language-js">const dado = 8;<\/code><\/pre>/);
});

test('ORACOLO: le righe consecutive restano separate e le righe vuote creano paragrafi', () => {
    const html = renderOracleMarkdown('Prima riga\nSeconda riga\n\nNuovo paragrafo');
    assert.match(html, /<p>Prima riga<br>Seconda riga<\/p><p>Nuovo paragrafo<\/p>/);
});
