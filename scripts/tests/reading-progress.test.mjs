import test from 'node:test';
import assert from 'node:assert/strict';
import { getReadingPosition, saveReadingPosition, normalizeReadingPosition, getReaderPreferences, saveReaderPreferences } from '../../src/services/readingProgress.js';
const memory = () => { const data = new Map(); return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) }; };
const position = { page: 7, left: 18, top: 431, zoom: 1.5, fingerprint: 'pdf-a' };

test('reading position retains PDF coordinates and zoom, scoped to each account and book', () => {
    const storage = memory();
    assert.equal(saveReadingPosition('alice', 'book-a', position, storage), true);
    assert.deepEqual({ ...getReadingPosition('alice', 'book-a', storage), updatedAt: 0 }, { ...position, updatedAt: 0 });
    assert.equal(getReadingPosition('bob', 'book-a', storage), null);
    assert.equal(getReadingPosition('alice', 'book-b', storage), null);
    assert.equal(getReadingPosition(null, 'book-a', storage), null);
    saveReadingPosition('alice', 'book-a', { ...position, page: 1, top: 800, zoom: 'page-width' }, storage);
    assert.equal(getReadingPosition('alice', 'book-a', storage).page, 1);
});

test('invalid positions and damaged storage never break reading or overwrite valid progress', () => {
    const storage = memory();
    saveReadingPosition('alice', 'book-a', position, storage);
    for (const patch of [{page:0}, {page:1.5}, {left:NaN}, {top:Infinity}, {zoom:'invalid'}, {zoom:0}, {zoom:Infinity}]) {
        assert.equal(normalizeReadingPosition({...position,...patch}), null);
        assert.equal(saveReadingPosition('alice','book-a',{...position,...patch},storage), false);
    }
    assert.equal(getReadingPosition('alice','book-a',storage).page,7);
    assert.equal(getReadingPosition('alice','book-a',{getItem:()=>'{broken'}),null);
    const blocked = {getItem(){throw Error('blocked');},setItem(){throw Error('quota');}};
    assert.equal(getReadingPosition('alice','book-a',blocked),null);
    assert.equal(saveReadingPosition('alice','book-a',position,blocked),false);
});


test('reading appearance persists per account with safe defaults', () => {
    const storage = memory();
    saveReaderPreferences('alice', { theme: 'sepia', mode: 'page' }, storage);
    assert.deepEqual(getReaderPreferences('alice', storage), { theme: 'sepia', mode: 'page' });
    assert.deepEqual(getReaderPreferences('bob', storage), { theme: 'paper', mode: 'continuous' });
    saveReaderPreferences('alice', { theme: 'invalid', mode: 'invalid' }, storage);
    assert.deepEqual(getReaderPreferences('alice', storage), { theme: 'paper', mode: 'continuous' });
});
