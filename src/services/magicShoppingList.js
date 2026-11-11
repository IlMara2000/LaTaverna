// Righe senza prezzo, per l'avviso della lista acquisti.
// Modulo puro (nessun DOM, nessun import) così è verificabile senza montare la dashboard.

const priceKey = currency => (currency === 'usd' ? 'unit_price_usd' : 'unit_price_eur');

/**
 * Righe senza prezzo nella valuta indicata, con l'id della stampa: l'avviso può
 * così elencare *quali* carte mancano di prezzo (non solo quante) e aprirle al clic.
 * L'elenco è completo: nessun taglio, perché una carta nascosta è una carta che
 * l'utente non sa di dover cercare.
 */
export function unpricedCards(lines = [], currency = 'eur') {
    const key = priceKey(currency);

    const rows = (Array.isArray(lines) ? lines : [])
        .filter(line => line && (line[key] === null || line[key] === undefined))
        .map(line => ({ cardId: String(line.card_id ?? ''), name: String(line.card_name || '').trim() }))
        .filter(row => row.name);

    // Lo stesso nome può arrivare da stampe diverse: resta la prima occorrenza.
    const seen = new Set();
    const unique = [];
    for (const row of rows) {
        if (seen.has(row.name)) continue;
        seen.add(row.name);
        unique.push(row);
    }
    return unique;
}
