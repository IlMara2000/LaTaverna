import { isSupabaseConfigured, supabase } from './supabase.js';

const checked = async query => {
    const { data, error } = await query;
    if (error) throw error;
    return data;
};

const cardData = card => ({
    name: card.name,
    image: card.image || '',
    manaCost: card.manaCost || '',
    typeLine: card.typeLine || '',
    oracleText: card.oracleText || '',
    power: card.power ?? '',
    toughness: card.toughness ?? '',
    cmc: Number(card.cmc || 0),
    colors: Array.isArray(card.colors) ? card.colors : [],
    colorIdentity: Array.isArray(card.colorIdentity) ? card.colorIdentity : [],
    commanderLegality: card.commanderLegality || 'unknown',
    set: card.set || '',
    rarity: card.rarity || ''
});

export async function getMagicAccount() {
    if (!isSupabaseConfigured) return null;
    const current = await supabase.auth.getUser();
    if (current.data?.user?.id) return current.data.user;
    const guest = await supabase.auth.signInAnonymously();
    if (guest.error) throw guest.error;
    return guest.data?.user || null;
}

export async function loadMagicLibrary(userId) {
    const collection = await checked(supabase.from('magic_collections').select('id,is_public').eq('user_id', userId).maybeSingle());
    const cards = collection
        ? await checked(supabase.from('magic_collection_cards').select('card_id,card_name,quantity,card_data').eq('collection_id', collection.id))
        : [];
    const decks = await checked(supabase.from('magic_decks').select('id,name,commanders,is_public').eq('user_id', userId).order('created_at'));
    const deckCards = decks.length
        ? await checked(supabase.from('magic_deck_cards').select('deck_id,card_id,quantity').in('deck_id', decks.map(deck => deck.id)))
        : [];
    return {
        collectionId: collection?.id || null,
        collectionPublic: collection?.is_public === true,
        hasCloudData: Boolean(collection || decks.length),
        cards: (cards || []).map(row => ({ ...(row.card_data || {}), id: row.card_id, name: row.card_name, quantity: row.quantity })),
        decks: (decks || []).map(deck => ({
            id: deck.id, name: deck.name,
            commanders: Array.isArray(deck.commanders) ? deck.commanders : [],
            isPublic: deck.is_public === true,
            cards: (deckCards || []).filter(row => row.deck_id === deck.id).map(row => ({ cardId: row.card_id, quantity: row.quantity }))
        }))
    };
}

const replaceChildRows = async (table, parentColumn, parentId, rows, ownerColumn = null, ownerId = null) => {
    let query = supabase.from(table).select('card_id').eq(parentColumn, parentId);
    if (ownerColumn) query = query.eq(ownerColumn, ownerId);
    const existing = await checked(query);
    const ids = new Set(rows.map(row => row.card_id));
    const removed = (existing || []).map(row => row.card_id).filter(id => !ids.has(id));
    if (removed.length) {
        let deletion = supabase.from(table).delete().eq(parentColumn, parentId).in('card_id', removed);
        if (ownerColumn) deletion = deletion.eq(ownerColumn, ownerId);
        await checked(deletion);
    }
    if (rows.length) await checked(supabase.from(table).upsert(rows, { onConflict: `${parentColumn},card_id` }));
};

export async function saveMagicLibrary({ userId, cards, decks }) {
    const found = await checked(supabase.from('magic_collections').select('id').eq('user_id', userId).maybeSingle());
    const collection = found || await checked(supabase.from('magic_collections').insert({ user_id: userId }).select('id').single());
    const collectionRows = cards.filter(card => card?.id && card?.name).map(card => ({
        collection_id: collection.id, card_id: String(card.id), card_name: String(card.name).slice(0, 120),
        quantity: Math.min(99, Math.max(1, Number(card.quantity) || 1)), card_data: cardData(card), updated_at: new Date().toISOString()
    }));
    await replaceChildRows('magic_collection_cards', 'collection_id', collection.id, collectionRows);

    const existingDecks = await checked(supabase.from('magic_decks').select('id').eq('user_id', userId));
    const existingIds = new Set((existingDecks || []).map(deck => deck.id));
    const activeIds = new Set(decks.map(deck => deck.id));
    const removedDeckIds = [...existingIds].filter(id => !activeIds.has(id));
    if (removedDeckIds.length) await checked(supabase.from('magic_decks').delete().eq('user_id', userId).in('id', removedDeckIds));

    const cardById = new Map(cards.map(card => [String(card.id), card]));
    for (const deck of decks) {
        const parent = { id: deck.id, user_id: userId, name: String(deck.name || 'Mazzo').trim().slice(0, 80) || 'Mazzo', commanders: deck.commanders || [], updated_at: new Date().toISOString() };
        if (existingIds.has(deck.id)) await checked(supabase.from('magic_decks').update({ name: parent.name, commanders: parent.commanders, updated_at: parent.updated_at }).eq('id', deck.id).eq('user_id', userId));
        else await checked(supabase.from('magic_decks').insert({ ...parent, format: 'commander' }));
        const rows = (deck.cards || []).filter(entry => cardById.has(String(entry.cardId))).map(entry => {
            const card = cardById.get(String(entry.cardId));
            return { deck_id: deck.id, card_id: String(entry.cardId), card_name: String(card.name).slice(0, 120), quantity: Math.min(99, Math.max(1, Number(entry.quantity) || 1)), card_data: cardData(card) };
        });
        await replaceChildRows('magic_deck_cards', 'deck_id', deck.id, rows);
    }
    return { collectionId: collection.id };
}

export async function setMagicCollectionPublic(userId, collectionId, isPublic) {
    const data = await checked(supabase.from('magic_collections').update({ is_public: isPublic === true, updated_at: new Date().toISOString() })
        .eq('id', collectionId).eq('user_id', userId).select('id,is_public').single());
    return data;
}

export async function setMagicDeckPublic(userId, deckId, isPublic) {
    const data = await checked(supabase.from('magic_decks').update({ is_public: isPublic === true, updated_at: new Date().toISOString() })
        .eq('id', deckId).eq('user_id', userId).select('id,is_public').single());
    return data;
}

export async function listPublicMagicDecks() {
    if (!isSupabaseConfigured) throw new Error('Il catalogo dei mazzi pubblici non è disponibile in questa installazione.');
    return (await checked(supabase.from('magic_decks').select('id,name,commanders').eq('is_public', true).order('name').limit(100))) || [];
}

export async function loadPublicMagicShare({ collectionId, deckId }) {
    if (collectionId) {
        const collection = await checked(supabase.from('magic_collections').select('id,is_public').eq('id', collectionId).eq('is_public', true).maybeSingle());
        if (!collection) throw new Error('Questa collezione non è pubblica o non esiste più.');
        const cards = await checked(supabase.from('magic_collection_cards').select('card_id,card_name,quantity,card_data').eq('collection_id', collection.id).order('card_name'));
        return { type: 'collection', cards: (cards || []).map(row => ({ ...(row.card_data || {}), id: row.card_id, name: row.card_name, quantity: row.quantity })) };
    }
    const deck = await checked(supabase.from('magic_decks').select('id,name,commanders,is_public').eq('id', deckId).eq('is_public', true).maybeSingle());
    if (!deck) throw new Error('Questo mazzo non è pubblico o non esiste più.');
    const cards = await checked(supabase.from('magic_deck_cards').select('card_id,card_name,quantity,card_data').eq('deck_id', deck.id).order('card_name'));
    return { type: 'deck', name: deck.name, commanders: deck.commanders || [], cards: (cards || []).map(row => ({ ...(row.card_data || {}), id: row.card_id, name: row.card_name, quantity: row.quantity })) };
}
