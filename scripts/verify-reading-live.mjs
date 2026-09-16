// Explicit integration check: uses two temporary anonymous accounts and real Storage/RLS.
// Run only against the configured development/project backend with --confirm-live.
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { createReadingLibrary, READING_BUCKET } from '../src/services/readingLibrary.js';

if (!process.argv.includes('--confirm-live')) throw new Error('Pass --confirm-live to create temporary test accounts.');
const env = loadEnv('development', process.cwd(), '');
const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const a = client(); const b = client(); const visitor = client();
const libraryA = createReadingLibrary(a); const libraryB = createReadingLibrary(b);
const bookIds = [];
const paths = [];
let owner; let other;
const pdf = new File(['%PDF-1.4\n1 0 obj<</Type /Catalog>>endobj\n%%EOF'], 'lettura-verifica.pdf', { type: 'application/pdf' });
try {
    const first = await a.auth.signInAnonymously();
    if (first.error) throw first.error;
    owner = first.data.user.id;
    const second = await b.auth.signInAnonymously();
    if (second.error) throw second.error;
    other = second.data.user.id;
    console.log('TEMPORARY_ACCOUNT_IDS', JSON.stringify([owner, other]));
    const book = await libraryA.uploadBook(pdf, { title: 'Verifica Lettura Zeta', userId: owner });
    bookIds.push(book.id); paths.push(book.storage_path);
    assert.equal(book.is_public, false);
    assert.equal((await b.from('reading_books').select('*').eq('id', book.id)).data.length, 0);
    assert.ok((await b.storage.from(READING_BUCKET).download(book.storage_path)).error);
    assert.ok((await visitor.storage.from(READING_BUCKET).download(book.storage_path)).error);
    assert.equal((await libraryA.downloadBook(book)).type, 'application/pdf');
    assert.ok((await b.from('reading_favorites').insert({ user_id: other, book_id: book.id })).error);
    console.log('PASS: private PDF and metadata inaccessible to a second account and visitors');

    await libraryA.setVisibility(book.id, true, owner);
    assert.equal((await b.from('reading_books').select('*').eq('id', book.id)).data.length, 1);
    assert.equal((await visitor.from('reading_books').select('*').eq('id', book.id)).data.length, 1);
    assert.equal((await libraryB.downloadBook(book)).type, 'application/pdf');
    assert.equal((await visitor.storage.from(READING_BUCKET).download(book.storage_path)).error, null);
    await assert.rejects(libraryB.setVisibility(book.id, false, other));
    const { data: publicUrl } = a.storage.from(READING_BUCKET).getPublicUrl(book.storage_path);
    assert.notEqual((await fetch(publicUrl.publicUrl)).status, 200);
    console.log('PASS: explicit sharing allows reading, only the owner can change visibility, bucket stays private');

    await libraryB.setFavorite(book.id, true, other);
    const favorites = await libraryB.listBooks({ view: 'favorites', userId: other });
    assert.ok(favorites.books.some(item => item.id === book.id));
    const collection = await libraryB.saveCollection('Verifica raccolta', other);
    await libraryB.setBookCollection(book.id, collection.id, true, other);
    assert.equal((await libraryA.listCollections(owner)).length, 0);
    assert.equal((await a.from('reading_collection_books').select('*').eq('collection_id', collection.id)).data.length, 0);
    assert.ok((await a.from('reading_collection_books').insert({ user_id: owner, collection_id: collection.id, book_id: book.id })).error);
    assert.ok((await libraryB.listBooks({ view: 'collection', userId: other, collectionId: collection.id })).books.some(item => item.id === book.id));
    await libraryB.saveCollection('Verifica rinominata', other, collection.id);
    const reopened = createReadingLibrary(b);
    assert.equal((await reopened.listCollections(other))[0].name, 'Verifica rinominata');
    assert.ok((await reopened.listFavorites(other, [book.id])).has(book.id));
    console.log('PASS: favorites and collections persist and are isolated between accounts');

    const alpha = await libraryA.uploadBook(pdf, { title: 'Verifica Lettura Alfa', author: 'Autore prova', userId: owner });
    bookIds.push(alpha.id); paths.push(alpha.storage_path);
    await libraryA.setVisibility(alpha.id, true, owner);
    const board = await libraryB.listBooks({ view: 'board', search: 'Verifica Lettura' });
    assert.deepEqual(board.books.map(item => item.title), ['Verifica Lettura Alfa', 'Verifica Lettura Zeta']);
    assert.equal((await libraryB.listBooks({ view: 'board', search: 'Autore prova' })).books[0].id, alpha.id);
    console.log('PASS: board indexed alphabetically and searchable by title and author');

    await libraryA.setVisibility(book.id, false, owner);
    await assert.rejects(libraryB.downloadBook(book), /non è più disponibile/);
    // Force an origin request: already authorized CDN/browser copies cannot be recalled.
    assert.ok((await b.storage.from(READING_BUCKET).download(`${book.storage_path}?cacheNonce=${crypto.randomUUID()}`, {}, { cache: 'no-store' })).error);
    assert.equal((await libraryB.listBooks({ view: 'favorites', userId: other })).count, 0);
    assert.equal((await libraryB.listBooks({ view: 'collection', userId: other, collectionId: collection.id })).count, 0);
    await libraryB.setBookCollection(book.id, collection.id, false, other);
    await libraryB.deleteCollection(collection.id, other);
    await libraryB.setFavorite(book.id, false, other);
    console.log('PASS: revoking publication removes access through board, favorites and collections');
} finally {
    if (owner) {
        if (bookIds.length) {
            const deletion = await a.from('reading_books').delete().in('id', bookIds);
            if (deletion.error) console.error('Metadata cleanup failed:', deletion.error.message);
        }
        if (paths.length) {
            const deletion = await a.storage.from(READING_BUCKET).remove(paths);
            if (deletion.error) console.error('File cleanup failed:', deletion.error.message);
        }
        await a.auth.signOut();
    }
    if (other) {
        await b.from('reading_collections').delete().eq('user_id', other);
        await b.auth.signOut();
    }
    console.log('Delete these temporary auth users via an administrator after the test:', JSON.stringify([owner, other].filter(Boolean)));
}
