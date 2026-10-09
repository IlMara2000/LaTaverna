export const SOLITAIRE_SUITS = [
    { id: 'cuori', name: 'Cuori', symbol: '♥', color: 'red' },
    { id: 'quadri', name: 'Quadri', symbol: '♦', color: 'red' },
    { id: 'fiori', name: 'Fiori', symbol: '♣', color: 'black' },
    { id: 'picche', name: 'Picche', symbol: '♠', color: 'black' }
];

export function createSolitaireDeck(random = Math.random) {
    const deck = SOLITAIRE_SUITS.flatMap(suit => Array.from({ length: 13 }, (_, index) => ({
        id: `${suit.id}-${index + 1}`, suit: suit.id, rank: index + 1, faceUp: false
    })));
    for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

export function createSolitaireGame(random = Math.random) {
    const stock = createSolitaireDeck(random);
    const tableau = Array.from({ length: 7 }, () => []);
    for (let column = 0; column < 7; column += 1) {
        for (let row = 0; row <= column; row += 1) {
            const card = stock.pop();
            card.faceUp = row === column;
            tableau[column].push(card);
        }
    }
    return { stock, waste: [], foundations: Array.from({ length: 4 }, () => []), tableau, moves: 0, won: false };
}

export function solitaireRankLabel(rank) {
    return ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[rank] || String(rank);
}

export function solitaireCardName(card) {
    const value = ({ 1: 'Asso', 11: 'Jack', 12: 'Donna', 13: 'Re' })[card.rank] || String(card.rank);
    return `${value} di ${SOLITAIRE_SUITS.find(suit => suit.id === card.suit)?.name || card.suit}`;
}

function isRed(card) {
    return card.suit === 'cuori' || card.suit === 'quadri';
}

export function solitaireSourceCards(state, source) {
    if (!source) return [];
    if (source.type === 'waste') return state.waste.length ? state.waste.slice(-1) : [];
    if (source.type === 'foundation') return state.foundations[source.pile]?.slice(-1) || [];
    if (source.type !== 'tableau' || !Number.isInteger(source.index) || source.index < 0) return [];
    const cards = state.tableau[source.pile]?.slice(source.index) || [];
    if (!cards.length || cards.some(card => !card.faceUp)) return [];
    for (let index = 1; index < cards.length; index += 1) {
        if (cards[index - 1].rank !== cards[index].rank + 1 || isRed(cards[index - 1]) === isRed(cards[index])) return [];
    }
    return cards;
}

export function canMoveSolitaire(state, source, target) {
    if (state.won || !source || !target || (source.type === target.type && source.pile === target.pile)) return false;
    const cards = solitaireSourceCards(state, source);
    if (!cards.length) return false;
    const card = cards[0];
    if (target.type === 'foundation') {
        const pile = state.foundations[target.pile];
        return Boolean(pile && cards.length === 1 && card.suit === SOLITAIRE_SUITS[target.pile]?.id && card.rank === pile.length + 1);
    }
    if (target.type === 'tableau') {
        const pile = state.tableau[target.pile];
        if (!pile) return false;
        const top = pile.at(-1);
        return top ? top.faceUp && top.rank === card.rank + 1 && isRed(top) !== isRed(card) : card.rank === 13;
    }
    return false;
}

function copyState(state) {
    const copyPile = pile => pile.map(card => ({ ...card }));
    return { ...state, stock: copyPile(state.stock), waste: copyPile(state.waste), foundations: state.foundations.map(copyPile), tableau: state.tableau.map(copyPile) };
}

// Actions return a new state; invalid actions preserve the original for reliable undo.
export function moveSolitaire(state, source, target) {
    if (!canMoveSolitaire(state, source, target)) return state;
    const next = copyState(state);
    let cards;
    if (source.type === 'waste') cards = [next.waste.pop()];
    else if (source.type === 'foundation') cards = [next.foundations[source.pile].pop()];
    else {
        cards = next.tableau[source.pile].splice(source.index);
        const exposed = next.tableau[source.pile].at(-1);
        if (exposed) exposed.faceUp = true;
    }
    if (target.type === 'foundation') next.foundations[target.pile].push(...cards);
    else next.tableau[target.pile].push(...cards);
    next.moves += 1;
    next.won = next.foundations.every(pile => pile.length === 13);
    return next;
}

export function drawSolitaire(state) {
    if (state.won || (!state.stock.length && !state.waste.length)) return state;
    const next = copyState(state);
    if (next.stock.length) {
        const card = next.stock.pop();
        card.faceUp = true;
        next.waste.push(card);
    } else {
        next.stock = next.waste.reverse().map(card => ({ ...card, faceUp: false }));
        next.waste = [];
    }
    next.moves += 1;
    return next;
}

export function solitaireFoundationTarget(state, source) {
    const cards = solitaireSourceCards(state, source);
    if (cards.length !== 1) return null;
    const target = { type: 'foundation', pile: SOLITAIRE_SUITS.findIndex(suit => suit.id === cards[0].suit) };
    return canMoveSolitaire(state, source, target) ? target : null;
}
