/**
 * Provocazioni contestuali. Sono cosmetiche: non cambiano mai le regole.
 * `pickMessage` evita di ripetere la stessa battuta due volte di fila.
 */

const POOLS = {
    win: [
        'SCIPPATO E UMILIATO.',
        'GRAZIE PER I PUNTI.',
        'MA STAVI GIOCANDO?',
        'CHIAMA UN ADULTO.',
        'IL BOTTINO È MIO, LA DIGNITÀ TUA È IN SALDO.',
        'NON ERA NEANCHE UNA SFIDA.'
    ],
    loss: [
        'CHE FIGURA DI MERDA.',
        'IL TUO CERVELLO È IN BUFFERING.',
        'ERA TUTTO CALCOLATO. MALE.',
        'RIPROVA, FENOMENO.',
        'TI HANNO SCIPPATO NEL SALOTTO.',
        'ANCHE IL BOT SI È ANNOIATO.'
    ],
    draw: [
        'DUE GENI DEL MALE.',
        'NESSUNO DEI DUE HA CAPITO NIENTE.',
        'PARITÀ DI QI.',
        'STESSA MOSSA, STESSA CONFUSIONE.',
        'IL BOTTINO È ANCORA LÌ. GUARDATEVI.'
    ],
    scippo: [
        'FERMI TUTTI.',
        'QUESTO È UNO SCIPPO.',
        'ADESSO SI FA SUL SERIO.',
        'HO APPENA FIRMATO IL MIO CAPOLAVORO.',
        'RISCHIO CALCOLATO. PIÙ O MENO.'
    ],
    resultWin: [
        'HAI APPENA COMMESSO UNO SCIPPO LEGALE.',
        'L’UMILIAZIONE È SERVITA, A TEMPERATURA AMBIENTE.',
        'IL BOTTINO È TUO. LA COLPA È SUA.'
    ],
    resultLoss: [
        'TI HANNO FATTO LE SCARPE. E PURE LE CARTE.',
        'RIVINCITA? SÌ, MA FAI MENO DANNI.',
        'IL TAVOLO HA GIÀ DIMENTICATO IL TUO NOME.'
    ],
    resultDraw: [
        'NESSUNO VINCE. TUTTI FANNO FIGURA.',
        'PARITÀ: IL NULLA CON DIVISA SPORTIVA.',
        'DUE STRATEGIE, ZERO RISULTATI.'
    ]
};

const lastIndex = new Map();

function stableSalt(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.abs(Math.trunc(value));
    const text = String(value ?? '');
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
        hash = (Math.imul(hash, 31) + text.charCodeAt(index)) >>> 0;
    }
    return hash;
}

export function pickMessage(kind, salt = Date.now()) {
    const pool = POOLS[kind];
    if (!pool?.length) return '';
    let index = stableSalt(salt) % pool.length;
    if (pool.length > 1 && index === lastIndex.get(kind)) index = (index + 1) % pool.length;
    lastIndex.set(kind, index);
    return pool[index];
}

export function resultMessage(outcome, salt = Date.now()) {
    if (outcome === 'win') return pickMessage('resultWin', salt);
    if (outcome === 'loss') return pickMessage('resultLoss', salt);
    return pickMessage('resultDraw', salt);
}

export function resetMessageMemory() {
    lastIndex.clear();
}
