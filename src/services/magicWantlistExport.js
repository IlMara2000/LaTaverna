const quantity = value => Number.isFinite(Number(value)) ? Math.max(1, Math.floor(Number(value))) : 1;
const csvCell = value => {
    let text = String(value ?? '');
    // Prevent spreadsheet applications from treating imported names as formulas.
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
};

/* PDF minimo senza dipendenze: Helvetica, una carta per riga, pagine A4 da 46
   righe. I byte escono in latin1 (WinAnsi copre i nomi delle carte), quindi la
   lunghezza delle stringhe è anche la lunghezza del file: gli offset della
   xref restano esatti. */
const PDF_RIGHE_PER_PAGINA = 46;
const PDF_MARGINE = 56;
const pdfTesto = value => String(value ?? '').replace(/[^\x20-\xff]/g, '?');
const pdfStringa = value => pdfTesto(value).replace(/[\\()]/g, carattere => `\\${carattere}`);
const pdfPagina = righe => [
    'BT', '/F1 12 Tf', '16 TL', `${PDF_MARGINE} ${842 - PDF_MARGINE} Td`,
    ...righe.map(riga => `(${pdfStringa(riga)}) Tj T*`), 'ET'
].join('\n');

function buildPdf(titolo, righe) {
    const contenuto = [titolo, '', ...righe];
    const pagine = [];
    for (let indice = 0; indice < contenuto.length; indice += PDF_RIGHE_PER_PAGINA) {
        pagine.push(contenuto.slice(indice, indice + PDF_RIGHE_PER_PAGINA));
    }
    const oggetti = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        `<< /Type /Pages /Kids [${pagine.map((_, indice) => `${4 + indice * 2} 0 R`).join(' ')}] /Count ${pagine.length} >>`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
    ];
    pagine.forEach((pagina, indice) => {
        const flusso = pdfPagina(pagina);
        oggetti.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + indice * 2} 0 R >>`);
        oggetti.push(`<< /Length ${flusso.length} >>\nstream\n${flusso}\nendstream`);
    });
    let pdf = '%PDF-1.4\n';
    const offset = oggetti.map((corpo, indice) => {
        const posizione = pdf.length;
        pdf += `${indice + 1} 0 obj\n${corpo}\nendobj\n`;
        return posizione;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${oggetti.length + 1}\n0000000000 65535 f \n`;
    for (const posizione of offset) pdf += `${String(posizione).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${oggetti.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Uint8Array.from(pdf, carattere => carattere.charCodeAt(0));
}

export function buildWantlistExport(cards, { language = 'it', format = 'txt' } = {}) {
    if (!['it', 'en'].includes(language) || !['txt', 'csv', 'json', 'pdf'].includes(format)) throw new Error('Formato di esportazione non valido.');
    if (!Array.isArray(cards) || !cards.length) throw new Error('Nessuna carta da esportare. Modifica il filtro o aggiungi carte alla wantlist.');
    let originalNames = 0;
    const rows = cards.map(card => {
        const italian = card.printedName && (!card.language || card.language === 'it') ? card.printedName : '';
        if (language === 'it' && !italian) originalNames++;
        return { name: language === 'it' && italian ? italian : card.name || card.printedName || 'Carta senza nome', quantity: quantity(card.quantity), id: card.id || '', manaCost: card.manaCost || '', typeLine: card.typeLine || '' };
    });
    const mime = { txt: 'text/plain', csv: 'text/csv', json: 'application/json', pdf: 'application/pdf' }[format];
    const content = format === 'pdf'
        ? buildPdf(`Wantlist Magic - ${rows.length} carte`, rows.map(row => `${row.quantity} ${row.name}`))
        : format === 'json' ? JSON.stringify(rows, null, 2) : format === 'csv'
            ? '\uFEFF' + [(language === 'it' ? ['nome', 'quantità', 'id', 'costo mana', 'tipo'] : ['name', 'quantity', 'id', 'mana cost', 'type']).map(csvCell).join(','), ...rows.map(row => Object.values(row).map(csvCell).join(','))].join('\r\n')
            : rows.map(row => `${row.quantity} ${row.name}`).join('\r\n') + '\r\n';
    return {
        filename: `wantlist-magic-${language}.${format}`,
        mime: format === 'pdf' ? mime : `${mime};charset=utf-8`,
        content, count: rows.length, originalNames
    };
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
