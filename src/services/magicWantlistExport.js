const quantity = value => Number.isFinite(Number(value)) ? Math.max(1, Math.floor(Number(value))) : 1;
const csvCell = value => {
    let text = String(value ?? '');
    // Prevent spreadsheet applications from treating imported names as formulas.
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
};
export function buildWantlistExport(cards, { language = 'it', format = 'txt' } = {}) {
    if (!['it', 'en'].includes(language) || !['txt', 'csv', 'json'].includes(format)) throw new Error('Formato di esportazione non valido.');
    if (!Array.isArray(cards) || !cards.length) throw new Error('Nessuna carta da esportare. Modifica il filtro o aggiungi carte alla wantlist.');
    let originalNames = 0;
    const rows = cards.map(card => {
        const italian = card.printedName && (!card.language || card.language === 'it') ? card.printedName : '';
        if (language === 'it' && !italian) originalNames++;
        return { name: language === 'it' && italian ? italian : card.name || card.printedName || 'Carta senza nome', quantity: quantity(card.quantity), id: card.id || '', manaCost: card.manaCost || '', typeLine: card.typeLine || '' };
    });
    const mime = { txt: 'text/plain', csv: 'text/csv', json: 'application/json' }[format];
    const content = format === 'json' ? JSON.stringify(rows, null, 2) : format === 'csv'
        ? '\uFEFF' + [(language === 'it' ? ['nome', 'quantità', 'id', 'costo mana', 'tipo'] : ['name', 'quantity', 'id', 'mana cost', 'type']).map(csvCell).join(','), ...rows.map(row => Object.values(row).map(csvCell).join(','))].join('\r\n')
        : rows.map(row => `${row.quantity} ${row.name}`).join('\r\n') + '\r\n';
    return { filename: `wantlist-magic-${language}.${format}`, mime: `${mime};charset=utf-8`, content, count: rows.length, originalNames };
}

// Keep this synchronous with the user's click, including in Safari/iOS.
export function downloadWantlist(file) {
    const url = URL.createObjectURL(new Blob([file.content], { type: file.mime }));
    const link = document.createElement('a');
    link.href = url; link.download = file.filename; link.hidden = true;
    document.body.append(link);
    try { link.click(); }
    finally {
        link.remove();
        // Downloads can start after this event finishes on mobile browsers.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
}
