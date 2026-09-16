import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadingLibrary, validateReadingPdf, bookTitleFromFilename, MAX_PDF_BYTES } from '../../src/services/readingLibrary.js';

const pdf = () => new File(['%PDF-1.4\n%%EOF'], 'Un_libro.pdf', { type: 'application/pdf' });

function fakeClient({ insertError = null, uploadError = null, currentUser = 'account-a', accessible = null } = {}) {
    const calls = [];
    const storage = {
        upload: async (...args) => { calls.push(['upload', ...args]); return { error: uploadError }; },
        remove: async (...args) => { calls.push(['remove', ...args]); return { error: null }; },
        download: async (...args) => { calls.push(['download', ...args]); return { data: pdf(), error: null }; }
    };
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: currentUser } } }) },
        storage: { from: () => storage },
        from: table => {
            const query = {};
            for (const method of ['insert', 'update', 'select', 'eq', 'order', 'ilike', 'range']) {
                query[method] = (...args) => { calls.push([method, table, ...args]); return query; };
            }
            query.single = async () => ({ data: { id: 'book-a', is_public: false }, error: insertError });
            query.maybeSingle = async () => ({ data: accessible, error: null });
            query.then = (resolve, reject) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve, reject);
            return query;
        }
    };
    return { client, calls };
}

test('only PDF contents, nonempty files and the size limit are accepted', async () => {
    await validateReadingPdf(pdf());
    await assert.rejects(validateReadingPdf(new File(['<html>'], 'fake.pdf')), /PDF valido/);
    await assert.rejects(validateReadingPdf(new File(['%PDF-1.4'], 'fake.txt')), /Scegli un file PDF/);
    await assert.rejects(validateReadingPdf(new File([], 'empty.pdf')), /vuoto/);
    await assert.rejects(validateReadingPdf({ name: 'huge.pdf', size: MAX_PDF_BYTES + 1 }), /50 MB/);
    assert.equal(bookTitleFromFilename('Il_mio-libro.PDF'), 'Il mio libro');
});

test('upload stores a private book and never publishes as a side effect', async () => {
    const { client, calls } = fakeClient();
    await createReadingLibrary(client).uploadBook(pdf(), { title: 'Un libro', userId: 'account-a' });
    assert.deepEqual(calls.filter(call => ['upload', 'insert'].includes(call[0])).map(call => call[0]), ['upload', 'insert']);
    assert.equal(calls.find(call => call[0] === 'insert')[2].is_public, false);
    assert.equal(calls.find(call => call[0] === 'insert')[2].owner_id, 'account-a');
    assert.equal(calls.some(call => call[0] === 'update'), false);
    assert.equal(calls.find(call => call[0] === 'upload')[3].upsert, false);
});

test('metadata failure removes the orphan file; upload failure never inserts metadata', async () => {
    const failedInsert = fakeClient({ insertError: new Error('metadata failed') });
    await assert.rejects(createReadingLibrary(failedInsert.client).uploadBook(pdf(), { title: 'Libro', userId: 'account-a' }), /metadata failed/);
    assert.equal(failedInsert.calls.filter(call => call[0] === 'remove').length, 1);
    assert.equal(failedInsert.calls.find(call => call[0] === 'remove')[1][0], failedInsert.calls.find(call => call[0] === 'upload')[1]);
    const failedUpload = fakeClient({ uploadError: new Error('upload failed') });
    await assert.rejects(createReadingLibrary(failedUpload.client).uploadBook(pdf(), { title: 'Libro', userId: 'account-a' }), /upload failed/);
    assert.equal(failedUpload.calls.some(call => call[0] === 'insert'), false);
});

test('an account change blocks uploads and sharing before writes', async () => {
    const { client, calls } = fakeClient({ currentUser: 'account-b' });
    const library = createReadingLibrary(client);
    await assert.rejects(library.uploadBook(pdf(), { title: 'Libro', userId: 'account-a' }), /sessione è cambiata/);
    await assert.rejects(library.setVisibility('book-a', true, 'account-a'), /sessione è cambiata/);
    assert.equal(calls.length, 0);
});

test('search escapes wildcard characters and paginates on the server', async () => {
    const { client, calls } = fakeClient();
    await createReadingLibrary(client).listBooks({ view: 'board', search: '100%_storie', page: 1 });
    assert.deepEqual(calls.find(call => call[0] === 'ilike').slice(2), ['search_text', '%100\\%\\_storie%']);
    assert.deepEqual(calls.find(call => call[0] === 'range').slice(2), [24, 47]);
    assert.deepEqual(calls.find(call => call[0] === 'eq').slice(2), ['is_public', true]);
});

test('opening a PDF rechecks access before asking Storage for a potentially cached copy', async () => {
    const denied = fakeClient();
    await assert.rejects(createReadingLibrary(denied.client).downloadBook({ id: 'book-a', storage_path: 'stale.pdf' }), /non è più disponibile/);
    assert.equal(denied.calls.some(call => call[0] === 'download'), false);
    const allowed = fakeClient({ accessible: { storage_path: 'verified.pdf' } });
    const blob = await createReadingLibrary(allowed.client).downloadBook({ id: 'book-a', storage_path: 'stale.pdf' });
    assert.equal(blob.type, 'application/pdf');
    assert.equal(allowed.calls.find(call => call[0] === 'download')[1], 'verified.pdf');
});
