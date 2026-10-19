import { MAGIC_SYMBOLS } from './magicSymbolCatalog.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
// Every game owns its vocabulary. Never substitute Magic art for another TCG.
const registries = new Map([['mtg', MAGIC_SYMBOLS]]);
export function registerCardSymbols(game, symbols) {
    if (!['pokemon', 'yugioh', 'onepiece'].includes(game)) throw new Error('Unsupported symbol registry');
    for (const symbol of Object.values(symbols)) {
        if (!symbol.label || !symbol.source?.startsWith('https://') || !symbol.src?.startsWith(`/assets/symbols/${game}/`)) {
            throw new Error('Original local artwork, an accessible label and source are required');
        }
    }
    registries.set(game, Object.freeze({ ...symbols }));
}
export function renderCardSymbols(text, game = 'mtg') {
    const symbols = registries.get(game);
    return String(text ?? '').split(/(\{[^{}\n]+\})/g).map(part => {
        const symbol = symbols?.[part];
        if (!symbol) return escape(part);
        return `<img class="tcg-symbol tcg-symbol-${escape(game)}" src="${escape(symbol.src)}" alt="${escape(symbol.label)}" title="${escape(symbol.label)}" width="20" height="20" decoding="async">`;
    }).join('');
}
