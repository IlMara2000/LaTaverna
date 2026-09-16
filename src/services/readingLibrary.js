export const READING_BUCKET = 'reading_books';
export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const READING_PAGE_SIZE = 24;

export function bookTitleFromFilename(name = '') {
    return name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, 200) || 'Libro senza titolo';
}

export async function validateReadingPdf(file) {
    if (!file || !/\.pdf$/i.test(file.name || '')) throw new Error('Scegli un file PDF.');
    if (!file.size) throw new Error('Il PDF è vuoto.');
    if (file.size > MAX_PDF_BYTES) throw new Error('Il PDF supera il limite di 50 MB.');
    const header = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (header !== '%PDF-') throw new Error('Il file selezionato non è un PDF valido.');
}

const cleanText = (value, max, label) => {
    const text = String(value || '').trim();
    if (!text || text.length > max) throw new Error(`${label}: inserisci da 1 a ${max} caratteri.`);
    return text;
};

export function readingErrorMessage(error) {
    if (['42P01', 'PGRST205'].includes(error?.code) || /bucket not found/i.test(error?.message || '')) {
        return 'La biblioteca non è ancora disponibile. Riprova tra poco.';
    }
    if (error?.code === '23505') return 'Esiste già una raccolta con questo nome.';
    if (/jwt|not authenticated|session/i.test(error?.message || '')) return 'La sessione è scaduta. Accedi di nuovo.';
    return error?.message || 'Operazione non riuscita. Riprova.';
}

// The client is injected so the same access and upload flow can be exercised in tests.
export function createReadingLibrary(client) {
    async function account(expectedId) {
        const { data, error } = await client.auth.getUser();
        if (error || !data?.user) throw new Error('Accedi al tuo account per salvare la biblioteca.');
        if (expectedId && data.user.id !== expectedId) throw new Error('La sessione è cambiata. Riapri Lettura.');
        return data.user;
    }

    const checked = async query => {
        const { data, error, count } = await query;
        if (error) throw error;
        return { data, count };
    };

    return {
        async getUser() {
            const { data, error } = await client.auth.getUser();
            if (error && error.name !== 'AuthSessionMissingError') throw error;
            return data?.user || null;
        },

        async listBooks({ view = 'board', userId, collectionId, search = '', page = 0 } = {}) {
            if (view !== 'board' && !userId) return { books: [], count: 0 };
            let selection = '*';
            if (view === 'favorites') selection += ',reading_favorites!inner(user_id)';
            if (view === 'collection') selection += ',reading_collection_books!inner(collection_id,user_id)';
            let query = client.from('reading_books').select(selection, { count: 'exact' });
            if (view === 'board') query = query.eq('is_public', true);
            if (view === 'mine') query = query.eq('owner_id', userId);
            if (view === 'favorites') query = query.eq('reading_favorites.user_id', userId);
            if (view === 'collection') query = query.eq('reading_collection_books.user_id', userId)
                .eq('reading_collection_books.collection_id', collectionId);
            const term = search.trim().replace(/[\\%_]/g, '\\$&');
            if (term) query = query.ilike('search_text', `%${term}%`);
            const { data, count } = await checked(query.order('title').order('id')
                .range(page * READING_PAGE_SIZE, (page + 1) * READING_PAGE_SIZE - 1));
            return { books: data || [], count: count || 0 };
        },

        async listFavorites(userId, bookIds) {
            if (!userId || !bookIds.length) return new Set();
            const { data } = await checked(client.from('reading_favorites').select('book_id')
                .eq('user_id', userId).in('book_id', bookIds));
            return new Set((data || []).map(row => row.book_id));
        },

        async uploadBook(file, { title, author = '', userId }) {
            await validateReadingPdf(file);
            const bookTitle = cleanText(title, 200, 'Titolo');
            const bookAuthor = String(author).trim();
            if (bookAuthor.length > 160) throw new Error('Il nome autore può contenere al massimo 160 caratteri.');
            const user = await account(userId);
            const id = crypto.randomUUID();
            const path = `${user.id}/${id}.pdf`;
            await checked(client.storage.from(READING_BUCKET).upload(path, file, {
                contentType: 'application/pdf', cacheControl: '0', upsert: false
            }));
            try {
                // Publication is deliberately a separate operation, after a successful upload.
                const { data } = await checked(client.from('reading_books').insert({
                    id, owner_id: user.id, title: bookTitle, author: bookAuthor,
                    original_name: file.name.slice(0, 255), size_bytes: file.size, is_public: false
                }).select().single());
                return data;
            } catch (error) {
                // Storage and Postgres cannot share a transaction. Remove an orphan on metadata failure.
                try { await client.storage.from(READING_BUCKET).remove([path]); } catch { /* Remains private. */ }
                throw error;
            }
        },

        async setVisibility(bookId, isPublic, userId) {
            await account(userId);
            const { data } = await checked(client.from('reading_books').update({ is_public: isPublic === true })
                .eq('id', bookId).eq('owner_id', userId).select().single());
            return data;
        },

        async downloadBook(book) {
            // Re-check database RLS on every open, including when Storage has an older cached download.
            const { data: accessible } = await checked(client.from('reading_books').select('storage_path')
                .eq('id', book.id).maybeSingle());
            if (!accessible) throw new Error('Questo libro non è più disponibile per il tuo account.');
            const { data } = await checked(client.storage.from(READING_BUCKET).download(accessible.storage_path, {}, { cache: 'no-store' }));
            return new Blob([data], { type: 'application/pdf' });
        },

        async setFavorite(bookId, favorite, userId) {
            await account(userId);
            const query = favorite
                ? client.from('reading_favorites').upsert({ user_id: userId, book_id: bookId }, { onConflict: 'user_id,book_id' })
                : client.from('reading_favorites').delete().eq('user_id', userId).eq('book_id', bookId);
            await checked(query);
        },

        async listCollections(userId) {
            if (!userId) return [];
            // Paginate to avoid the API's default row limit silently losing personal collections.
            const rows = [];
            for (let offset = 0; ; offset += 500) {
                const { data } = await checked(client.from('reading_collections').select('*').eq('user_id', userId)
                    .order('name').order('id').range(offset, offset + 499));
                rows.push(...data);
                if (data.length < 500) return rows;
            }
        },

        async saveCollection(name, userId, id = null) {
            await account(userId);
            const collectionName = cleanText(name, 80, 'Nome raccolta');
            const query = id
                ? client.from('reading_collections').update({ name: collectionName }).eq('id', id).eq('user_id', userId)
                : client.from('reading_collections').insert({ user_id: userId, name: collectionName });
            const { data } = await checked(query.select().single());
            return data;
        },

        async deleteCollection(id, userId) {
            await account(userId);
            await checked(client.from('reading_collections').delete().eq('id', id).eq('user_id', userId));
        },

        async bookCollections(bookId, userId) {
            const { data } = await checked(client.from('reading_collection_books').select('collection_id')
                .eq('user_id', userId).eq('book_id', bookId));
            return new Set(data.map(row => row.collection_id));
        },

        async setBookCollection(bookId, collectionId, included, userId) {
            await account(userId);
            const query = included
                ? client.from('reading_collection_books').upsert({ user_id: userId, book_id: bookId, collection_id: collectionId },
                    { onConflict: 'collection_id,book_id' })
                : client.from('reading_collection_books').delete().eq('user_id', userId)
                    .eq('collection_id', collectionId).eq('book_id', bookId);
            await checked(query);
        }
    };
}
