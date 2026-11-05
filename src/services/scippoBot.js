/**
 * Intelligenza artificiale di SCIPPO!.
 *
 * Regola di ferro: il BOT vede solo ciò che vedrebbe un giocatore umano:
 * la propria mano, i propri scarti, gli scarti pubblici dell'avversario, la
 * composizione dichiarata dei mazzi, punteggio, turno e bottino. Non legge mai
 * `match.hands[avversario]` né la carta coperta in `match.pending`.
 */

import {
    CARD_TYPES,
    CARD_IDS,
    DEFAULT_DECK_COMPOSITION,
    compareCards,
    createRng,
    expandDeck,
    getPublicUnknownCards
} from './scippoEngine.js';

export const SCIPPO_BOT_LEVELS = Object.freeze({
    facile: Object.freeze({
        id: 'facile', label: 'Facile', name: 'BOT FACILE',
        description: 'Gioca quasi a caso: perfetto per la prima partita.'
    }),
    normale: Object.freeze({
        id: 'normale', label: 'Normale', name: 'BOT NORMALE',
        description: 'Valuta il bottino e non spreca i JOLLY.'
    }),
    difficile: Object.freeze({
        id: 'difficile', label: 'Difficile', name: 'BOT DIFFICILE',
        description: 'Calcola le probabilità sulle carte ancora nascoste.'
    })
});

const uniqueCards = hand => [...new Set(hand)];

function publicOpponentPool(match, seat) {
    if (match?.composition?.[1 - seat]) return getPublicUnknownCards(match, 1 - seat);
    return expandDeck(DEFAULT_DECK_COMPOSITION);
}

function scoreDifferential(match, seat) {
    return (match.scores[seat] || 0) - (match.scores[1 - seat] || 0);
}

function turnsLeft(match) {
    return match.overtime ? Math.max(match.hands[0].length, match.hands[1].length) : match.maxTurns - match.turn + 1;
}

function playEasy(hand, match, botSeat, rng) {
    const cards = uniqueCards(hand);
    if (cards.includes('jolly') && match.bottino >= 2 && rng() < 0.2) return 'jolly';
    return hand[Math.floor(rng() * hand.length)];
}

function playNormal(hand, match, botSeat, rng) {
    const cards = uniqueCards(hand);
    const points = match.bottino;
    const diff = scoreDifferential(match, botSeat);
    const left = turnsLeft(match);
    const oppPool = publicOpponentPool(match, botSeat);
    const revealed = match.discards[1 - botSeat] || [];

    // Il BOT normale non ricostruisce il mazzo: legge solo le tendenze pubbliche.
    const tendency = { botta: 1, scudo: 1, finta: 1, jolly: 0.6 };
    revealed.forEach(card => {
        if (tendency[card] !== undefined) tendency[card] *= 0.72;
    });

    let bestCard = cards[0];
    let bestValue = -Infinity;
    cards.forEach(card => {
        let value = 0;
        const totalWeight = CARD_IDS.reduce((sum, oppCard) => sum + tendency[oppCard], 0);
        CARD_IDS.forEach(oppCard => {
            const probability = tendency[oppCard] / totalWeight;
            const outcome = compareCards(card, oppCard);
            if (outcome === 'a') value += probability * (points + 0.35);
            else if (outcome === 'b') value -= probability * points;
            else value += probability * 0.1 * points;
        });

        // Conserva il JOLLY quando il bottino è basso, a meno che serva davvero.
        if (card === 'jolly' && points < 2 && left > 2 && diff >= 0) value -= 0.5;
        // Quando si è sotto negli ultimi turni conviene rischiare la vittoria.
        if (left <= 2 && diff < 0) value += 0.45;
        if (left <= 2 && diff > 0) value -= 0.2;
        value += rng() * 0.08;

        if (value > bestValue) {
            bestValue = value;
            bestCard = card;
        }
    });
    return bestCard;
}

/**
 * BOT difficile: distribuzione probabilistica sulle carte non ancora viste
 * dell'avversario (composizione pubblica meno gli scarti già rivelati),
 * valore del bottino, differenza punti e turni rimasti.
 */
function playHard(hand, match, botSeat, rng) {
    const cards = uniqueCards(hand);
    const points = match.bottino;
    const diff = scoreDifferential(match, botSeat);
    const left = turnsLeft(match);
    const oppPool = publicOpponentPool(match, botSeat);
    const oppTotal = oppPool.length || 1;
    const oppCounts = CARD_IDS.reduce((counts, card) => {
        counts[card] = oppPool.filter(candidate => candidate === card).length;
        return counts;
    }, {});

    const scored = cards.map(card => {
        let winChance = 0;
        let drawChance = 0;
        let lossChance = 0;
        CARD_IDS.forEach(oppCard => {
            const probability = oppCounts[oppCard] / oppTotal;
            if (!probability) return;
            const outcome = compareCards(card, oppCard);
            if (outcome === 'a') winChance += probability;
            else if (outcome === 'b') lossChance += probability;
            else drawChance += probability;
        });

        // Il valore atteso è lo swing di punti: vincere vale +bottino,
        // perdere lo regala all'avversario.
        let value = (winChance - lossChance) * points + drawChance * points * 0.12;

        // Non buttare il JOLLY su un bottino da un punto se la partita è lunga.
        if (card === 'jolly') value -= points === 1 && left > 2 ? 0.4 : 0.08;

        // Endgame: sotto, massimizza la vittoria; sopra, evita la sconfitta.
        if (left <= 2) {
            value += diff < 0 ? winChance * 1.4 : -lossChance * 1.1;
        }
        // Se un pareggio basta a mantenere il vantaggio, non rischiare.
        if (match.overtime && diff > 0) value -= lossChance * 1.5;

        return { card, value: value + rng() * 0.02 };
    });

    scored.sort((a, b) => b.value - a.value);
    return scored[0].card;
}

/**
 * Sceglie una carta dalla propria mano. Restituisce `null` se non ci sono
 * carte giocabili.
 */
export function chooseBotCard({ match, seat = 1, difficulty = 'normale', rng } = {}) {
    const hand = match?.hands?.[seat];
    if (!Array.isArray(hand) || !hand.length) return null;
    const random = typeof rng === 'function' ? rng : createRng((match.seed >>> 0) ^ (match.turn * 2654435761));
    const level = SCIPPO_BOT_LEVELS[difficulty] ? difficulty : 'normale';
    if (level === 'facile') return playEasy(hand, match, seat, random);
    if (level === 'difficile') return playHard(hand, match, seat, random);
    return playNormal(hand, match, seat, random);
}

/**
 * Identità pubblica del BOT per una sfida deterministica (stessa partita per
 * tutti coloro che ricevono lo stesso codice).
 */
export function botLabel(difficulty = 'normale') {
    return (SCIPPO_BOT_LEVELS[difficulty] || SCIPPO_BOT_LEVELS.normale).name;
}

export function isBotDifficulty(value) {
    return Object.prototype.hasOwnProperty.call(SCIPPO_BOT_LEVELS, value);
}
