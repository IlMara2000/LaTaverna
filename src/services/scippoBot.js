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
    getPublicUnknownCards,
    scippoAvailable
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

/** Probabilità pubblica di vittoria/sconfitta della carta, senza dati nascosti. */
function publicOdds(card, match, seat) {
    const pool = publicOpponentPool(match, seat);
    if (!pool.length) return { win: 0, loss: 0, draw: 1 };
    let win = 0;
    let loss = 0;
    let draw = 0;
    pool.forEach(opponentCard => {
        const outcome = compareCards(card, opponentCard);
        if (outcome === 'a') win += 1;
        else if (outcome === 'b') loss += 1;
        else draw += 1;
    });
    return { win: win / pool.length, loss: loss / pool.length, draw: draw / pool.length };
}

/**
 * La SCIPPATA è una scommessa, non un pulsante da premere a caso. Il BOT
 * decide solo su probabilità pubbliche, bottino, punteggio e turni rimasti.
 */
function chooseScippo({ match, seat, difficulty, card, rng }) {
    if (!scippoAvailable(match, seat)) return false;
    const odds = publicOdds(card, match, seat);
    const diff = scoreDifferential(match, seat);
    const left = turnsLeft(match);
    const bottino = match.bottino;

    if (difficulty === 'facile') {
        return bottino >= 2 && odds.win > 0.5 && rng() < 0.16;
    }

    // Con bottino basso e partita lunga il rischio non paga.
    if (bottino === 1 && left > 2 && diff >= 0) return false;
    if (odds.win <= odds.loss) return false;

    if (difficulty === 'normale') {
        if (left <= 2 && diff < 0) return odds.win > 0.44;
        return odds.win >= 0.56 && rng() < 0.55;
    }

    // Difficile: cerca il colpo che sposta davvero la partita.
    if (left <= 2 && diff < 0) return odds.win > 0.4;
    if (bottino === 1 && diff >= 0) return false;
    return odds.win >= 0.54 && rng() < 0.7;
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

/** Sceglie carta e SCIPPATA. Non legge mai mano o carta coperta avversaria. */
export function chooseBotMove({ match, seat = 1, difficulty = 'normale', rng } = {}) {
    const hand = match?.hands?.[seat];
    if (!Array.isArray(hand) || !hand.length) return { card: null, scippo: false };
    const random = typeof rng === 'function' ? rng : createRng((match.seed >>> 0) ^ (match.turn * 2654435761));
    const level = SCIPPO_BOT_LEVELS[difficulty] ? difficulty : 'normale';
    const card = level === 'facile'
        ? playEasy(hand, match, seat, random)
        : level === 'difficile'
            ? playHard(hand, match, seat, random)
            : playNormal(hand, match, seat, random);
    return {
        card,
        scippo: chooseScippo({ match, seat, difficulty: level, card, rng: random })
    };
}

/**
 * Compatibilità: restituisce solo la carta. La UI usa `chooseBotMove` per
 * gestire anche la dichiarazione della SCIPPATA.
 */
export function chooseBotCard({ match, seat = 1, difficulty = 'normale', rng } = {}) {
    return chooseBotMove({ match, seat, difficulty, rng }).card;
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
