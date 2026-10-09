export const SCOPA_SUITS = [
    { id: 'hearts', name: 'Cuori', symbol: '♥', red: true },
    { id: 'diamonds', name: 'Quadri', symbol: '♦', red: true },
    { id: 'clubs', name: 'Fiori', symbol: '♣', red: false },
    { id: 'spades', name: 'Picche', symbol: '♠', red: false }
];

const RANKS = [
    ['A', 'Asso', 1], ['2', '2', 2], ['3', '3', 3], ['4', '4', 4],
    ['5', '5', 5], ['6', '6', 6], ['7', '7', 7],
    ['J', 'Jack', 8], ['Q', 'Donna', 9], ['K', 'Re', 10]
];

export function createScopaDeck(random = Math.random) {
    const deck = SCOPA_SUITS.flatMap(suit => RANKS.map(([label, name, value]) => ({
        id: `${suit.id}-${label}`, suit: suit.id, label, name, value
    })));
    for (let index = deck.length - 1; index > 0; index -= 1) {
        const other = Math.floor(random() * (index + 1));
        [deck[index], deck[other]] = [deck[other], deck[index]];
    }
    return deck;
}

export function cardName(card) {
    return `${card.name} di ${SCOPA_SUITS.find(suit => suit.id === card.suit).name}`;
}

export function captureOptions(card, table) {
    // A matching single card must be taken before considering sums.
    const equals = table.filter(item => item.value === card.value);
    if (equals.length) return equals.map(item => [item.id]);
    const options = [];
    const visit = (start, sum, chosen) => {
        if (sum === card.value) {
            options.push(chosen);
            return;
        }
        for (let index = start; index < table.length; index += 1) {
            if (sum + table[index].value <= card.value) {
                visit(index + 1, sum + table[index].value, [...chosen, table[index].id]);
            }
        }
    };
    visit(0, 0, []);
    return options;
}

export function primiera(cards) {
    const values = { 1: 16, 2: 12, 3: 13, 4: 14, 5: 15, 6: 18, 7: 21, 8: 10, 9: 10, 10: 10 };
    const best = SCOPA_SUITS.map(suit => Math.max(0, ...cards.filter(card => card.suit === suit.id).map(card => values[card.value])));
    return { total: best.reduce((sum, value) => sum + value, 0), eligible: best.every(Boolean) };
}

export function scoreScopaRound(captured, sweeps) {
    const cardCounts = captured.map(cards => cards.length);
    const diamondCounts = captured.map(cards => cards.filter(card => card.suit === 'diamonds').length);
    const primieras = captured.map(primiera);
    const majority = counts => counts.map((count, player) => Number(count > counts[1 - player]));
    const points = {
        cards: majority(cardCounts),
        diamonds: majority(diamondCounts),
        settebello: captured.map(cards => Number(cards.some(card => card.suit === 'diamonds' && card.value === 7))),
        primiera: majority(primieras.map(result => result.eligible ? result.total : 0)),
        sweeps: [...sweeps]
    };
    return {
        points, cardCounts, diamondCounts, primieras,
        totals: [0, 1].map(player => Object.values(points).reduce((sum, category) => sum + category[player], 0))
    };
}

function dealHands(round) {
    for (let index = 0; index < 3; index += 1) {
        round.hands[round.starter].push(round.deck.pop());
        round.hands[1 - round.starter].push(round.deck.pop());
    }
}

export function createScopaRound(starter = 0, random = Math.random) {
    const deck = createScopaDeck(random);
    // An opening table with three or four kings is redealt. Swapping one king
    // with a non-king also keeps deterministic random sources safe from loops.
    const table = deck.splice(-4);
    while (table.filter(card => card.value === 10).length >= 3) {
        const tableIndex = table.findIndex(card => card.value === 10);
        const deckIndex = deck.findIndex(card => card.value !== 10);
        [table[tableIndex], deck[deckIndex]] = [deck[deckIndex], table[tableIndex]];
    }
    const round = {
        deck, table, hands: [[], []], captured: [[], []], sweeps: [0, 0],
        starter, turn: starter, lastCapture: null, moves: 0, over: false, result: null, lastMove: null
    };
    dealHands(round);
    return round;
}

export function createScopaMatch(random = Math.random) {
    return { round: createScopaRound(0, random), number: 1, totals: [0, 0], over: false, winner: null };
}

export function nextScopaRound(match, random = Math.random) {
    if (!match.round.over || match.over) return false;
    match.number += 1;
    match.round = createScopaRound((match.number - 1) % 2, random);
    return true;
}

export function playScopaMove(match, player, handIndex, captureIds = []) {
    const round = match.round;
    if (round.over || match.over || round.turn !== player) return false;
    const card = round.hands[player]?.[handIndex];
    if (!card || !Array.isArray(captureIds)) return false;
    const options = captureOptions(card, round.table);
    const validCapture = options.some(option => option.length === captureIds.length && option.every(id => captureIds.includes(id)));
    if (options.length ? !validCapture : captureIds.length !== 0) return false;

    round.hands[player].splice(handIndex, 1);
    const taken = round.table.filter(item => captureIds.includes(item.id));
    const finalPlay = !round.deck.length && round.hands.every(hand => hand.length === 0);
    let sweep = false;
    if (taken.length) {
        round.table = round.table.filter(item => !captureIds.includes(item.id));
        round.captured[player].push(card, ...taken);
        round.lastCapture = player;
        sweep = !round.table.length && !finalPlay;
        if (sweep) round.sweeps[player] += 1;
    } else {
        round.table.push(card);
    }
    round.moves += 1;
    round.lastMove = { player, card, taken, sweep, leftovers: [], leftoversOwner: null };
    round.turn = 1 - player;
    if (finalPlay) {
        if (round.table.length && round.lastCapture !== null) {
            round.lastMove.leftovers = [...round.table];
            round.lastMove.leftoversOwner = round.lastCapture;
            round.captured[round.lastCapture].push(...round.table);
            round.table = [];
        }
        round.over = true;
        round.result = scoreScopaRound(round.captured, round.sweeps);
        match.totals = match.totals.map((score, owner) => score + round.result.totals[owner]);
        match.over = Math.max(...match.totals) >= 11 && match.totals[0] !== match.totals[1];
        if (match.over) match.winner = Number(match.totals[1] > match.totals[0]);
    } else if (round.hands.every(hand => hand.length === 0)) {
        dealHands(round);
    }
    return true;
}

export function chooseScopaMove(round, player = 1) {
    const moves = round.hands[player].flatMap((card, index) => {
        const options = captureOptions(card, round.table);
        return (options.length ? options : [[]]).map(ids => {
            const taken = [card, ...round.table.filter(item => ids.includes(item.id))];
            const remaining = ids.length ? round.table.filter(item => !ids.includes(item.id)) : [...round.table, card];
            const finalPlay = !round.deck.length && round.hands[0].length + round.hands[1].length === 1;
            let utility = ids.length ? taken.length : -card.value / 20;
            if (ids.length) {
                utility += taken.filter(item => item.suit === 'diamonds').length * 1.8;
                utility += taken.filter(item => item.value === 7).length * 1.5;
                if (taken.some(item => item.suit === 'diamonds' && item.value === 7)) utility += 12;
                if (!remaining.length && !finalPlay) utility += 10;
            } else if (card.suit === 'diamonds' && card.value === 7) utility -= 10;
            const tableSum = remaining.reduce((sum, item) => sum + item.value, 0);
            if (tableSum > 0 && tableSum <= 10 && !finalPlay) utility -= 2;
            return { index, ids, utility };
        });
    });
    return moves.sort((first, second) => second.utility - first.utility)[0] || null;
}
