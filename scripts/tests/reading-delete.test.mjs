import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadingLibrary } from '../../src/services/readingLibrary.js';

function fixture({ owner = 'me', storageError = null, metadataError = null, currentUser = 'me' } = {}) {
    const calls = [];
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: currentUser } } }) },
        storage: { from: () => ({ remove: async paths => { calls.push(['remove', paths]); return { error: storageError }; } }) },
        from: () => {
            let operation = 'select'; const query = {};
            for (const method of ['select', 'eq', 'update', 'delete']) query[method] = (...args) => {
                calls.push([method, ...args]); if (['update', 'delete'].includes(method)) operation = method; return query;
            };
            query.single = async () => ({ data: { id: 'book' } });
            query.maybeSingle = async () => operation === 'delete'
                ? { data: metadataError ? null : { id: 'book' }, error: metadataError }
                : { data: owner ? { id: 'book', owner_id: owner, storage_path: `${owner}/book.pdf`, is_public: true } : null };
            return query;
        }
    };
    return { library: createReadingLibrary(client), calls };
}
test('public book removal unpublishes, removes the file, then deletes its metadata', async () => {
    const { library, calls } = fixture(); await library.deleteBook('book', 'me');
    assert.deepEqual(calls.filter(c => ['update','remove','delete'].includes(c[0])), [
        ['update',{is_public:false}], ['remove',['me/book.pdf']], ['delete']
    ]);
    assert.ok(calls.filter(c => c[0] === 'eq' && c[1] === 'owner_id' && c[2] === 'me').length === 3);
});
test('a missing book, another owner or a changed account cannot delete files', async () => {
    for (const options of [{owner:null},{owner:'someone-else'},{currentUser:'changed'}]) {
        const {library,calls}=fixture(options); await assert.rejects(library.deleteBook('book','me'));
        assert.equal(calls.some(c=>['remove','delete','update'].includes(c[0])),false);
    }
});
test('storage failure keeps the metadata available for retry and reports incomplete deletion', async () => {
    const {library,calls}=fixture({storageError:new Error('offline')});
    await assert.rejects(library.deleteBook('book','me'),/Eliminazione incompleta/);
    assert.equal(calls.some(c=>c[0]==='delete'),false);
});
test('metadata failure after file removal is reported, and retry completes safely', async () => {
    const failed=fixture({metadataError:new Error('offline')});
    await assert.rejects(failed.library.deleteBook('book','me'),/riprova/);
    const retry=fixture(); await retry.library.deleteBook('book','me');
    assert.equal(retry.calls.filter(c=>c[0]==='remove').length,1);
});
