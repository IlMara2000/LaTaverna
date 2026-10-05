const cleanName = name => String(name || '').replace(/[\r\n]/g, ' ').trim();

/** Format a Commander list for Manabrew's text deck importer. */
export function formatManabrewCommanderList(deck, cards = []) {
    const byId = new Map(cards.map(card => [card.id, card]));
    const commanderIds = new Set(deck?.commanders || []);
    const commanders = [...commanderIds].map(id => byId.get(id)).filter(Boolean);
    const main = (deck?.cards || [])
        .filter(entry => !commanderIds.has(entry.cardId))
        .map(entry => ({ card: byId.get(entry.cardId), quantity: Number(entry.quantity) || 0 }))
        .filter(entry => entry.card && entry.quantity > 0);

    if (commanders.length !== commanderIds.size) throw new Error('Una carta comandante non è presente nella tua raccolta.');
    if (!commanders.length) throw new Error('Seleziona il comandante prima di esportare il mazzo.');
    if (main.some(({ card }) => !cleanName(card.name))) throw new Error('Il mazzo contiene una carta senza nome.');

    return [
        'Commander',
        ...commanders.map(card => `1 ${cleanName(card.name)}`),
        '',
        'Deck',
        ...main.map(({ card, quantity }) => `${quantity} ${cleanName(card.name)}`),
    ].join('\n');
}
