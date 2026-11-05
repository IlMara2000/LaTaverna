import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CARD_IDS,
    CARD_TYPES,
    DEFAULT_DECK_COMPOSITION,
    HAND_SIZE,
    REGULATION_TURNS,
    advanceMatch,
    compareCards,
    createBottinoQueue,
    createMatch,
    createRng,
    deckTotal,
    expandDeck,
    getLegalCards,
    getPublicUnknownCards,
    outcomeForSeat,
    playCard,
    validateDeckComposition
} from '../../src/services/scippoEngine.js';
import { chooseBotCard, isBotDifficulty } from '../../src/services/scippoBot.js';
import {
    createDefaultProfile,
    dailyChallengeKey,
    getActiveComposition,
    getDailyChallenge,
    loadScippoProfile,
    normalizeScippoProfile,
    recordScippoMatch,
    saveDeck,
    saveScippoProfile,
    setActiveDeck
} from '../../src/services/scippoProfile.js';

const handCount = match => match.hands[0].length + match.piles[0].length + match.discards[0].length;

function playDeterministicTurn(match, { playerRng, botDifficulty = 'difficile' } = {}) {
    const playerCard = match.hands[0][Math.floor(playerRng() * match.hands[0].length)];
    const playerResult = playCard(match, 0, playerCard);
    assert.equal(playerResult.ok, true, playerResult.error);
    let next = playerResult.match;

    const botCard = chooseBotCard({
        match: next,
        seat: 1,
        difficulty: botDifficulty,
        rng: createRng(next.seed ^ (next.turn * 2654435761))
    });
    assert.ok(next.hands[1].includes(botCard), 'il BOT gioca solo carte della propria mano');
    const botResult = playCard(next, 1, botCard);
    assert.equal(botResult.ok, true, botResult.error);
    next = botResult.match;
    assert.equal(next.phase, 'reveal');
    return next;
}

test('SCIPPO: ogni combinazione di carte produce il risultato corretto', () => {
    const expected = {
        'botta|scudo': 'b',
        'botta|finta': 'a',
        'botta|jolly': 'b',
        'scudo|botta': 'a',
        'scudo|finta': 'b',
        'scudo|jolly': 'b',
        'finta|botta': 'b',
        'finta|scudo': 'a',
        'finta|jolly': 'b',
        'jolly|botta': 'a',
        'jolly|scudo': 'a',
        'jolly|finta': 'a'
    };

    CARD_IDS.forEach(card => {
        assert.equal(compareCards(card, card), 'draw', `${card} contro ${card}`);
    });
    CARD_IDS.forEach(cardA => {
        CARD_IDS.forEach(cardB => {
            if (cardA === cardB) return;
            assert.equal(compareCards(cardA, cardB), expected[`${cardA}|${cardB}`], `${cardA} vs ${cardB}`);
            assert.equal(
                compareCards(cardA, cardB),
                { a: 'b', b: 'a', draw: 'draw' }[compareCards(cardB, cardA)],
                'il confronto è simmetrico'
            );
        });
    });
    assert.throws(() => compareCards('botta', 'carta-inventata'), /sconosciuta/);
    assert.equal(Object.keys(CARD_TYPES).length, 4);
});

test('SCIPPO: validazione del mazzo condivisa da client, salvataggio e motore', () => {
    const standard = validateDeckComposition(DEFAULT_DECK_COMPOSITION);
    assert.equal(standard.valid, true);
    assert.equal(standard.total, 20);
    assert.equal(expandDeck(DEFAULT_DECK_COMPOSITION).length, 20);
    assert.equal(deckTotal(DEFAULT_DECK_COMPOSITION), 20);

    assert.equal(validateDeckComposition({ botta: 10, scudo: 10, finta: 0, jolly: 0 }).valid, false);
    assert.equal(validateDeckComposition({ botta: 7, scudo: 7, finta: 4, jolly: 2 }).valid, true);
    assert.equal(validateDeckComposition({ botta: 6, scudo: 6, finta: 6, jolly: 3 }).valid, false);
    assert.equal(validateDeckComposition({ botta: 5, scudo: 5, finta: 5, jolly: 5 }).valid, false);
    assert.equal(validateDeckComposition({ botta: 2, scudo: 8, finta: 8, jolly: 2 }).valid, false);
    assert.equal(validateDeckComposition({ botta: 10, scudo: 10, finta: 0, jolly: 0 }).total, 20);
    assert.equal(validateDeckComposition(null).valid, false);
    assert.match(validateDeckComposition({ botta: 6, scudo: 6, finta: 6, jolly: 0 }).errors[0] || '', /20 carte/);

    const profileDeck = saveDeck(createDefaultProfile(), {
        name: 'Mazzo del baro',
        composition: { botta: 7, scudo: 7, finta: 4, jolly: 2 }
    });
    assert.equal(profileDeck.error, null);
    assert.equal(profileDeck.profile.activeDeckId, profileDeck.deck.id);
    assert.deepEqual(getActiveComposition(profileDeck.profile), { botta: 7, scudo: 7, finta: 4, jolly: 2 });
    assert.equal(validateDeckComposition(profileDeck.deck.composition).valid, true);
});

test('SCIPPO: 300 partite complete non duplicano carte, non superano il mazzo e conservano i punti', () => {
    const playerRng = createRng(4242);

    for (let index = 0; index < 300; index += 1) {
        const matchUses = Object.fromEntries(CARD_IDS.map(id => [id, 0]));
        let match = createMatch({ seed: index, decks: [DEFAULT_DECK_COMPOSITION, DEFAULT_DECK_COMPOSITION] });
        assert.equal(match.turn, 1);
        assert.equal(match.hands[0].length, HAND_SIZE);
        assert.equal(match.hands[1].length, HAND_SIZE);
        assert.equal(match.piles[0].length, 20 - HAND_SIZE);
        assert.ok([1, 2, 3].includes(match.bottino));

        let guard = 0;
        while (!match.finished) {
            assert.equal(match.phase, 'choose');
            assert.ok(guard++ < 40, 'la partita termina');
            match = playDeterministicTurn(match, { playerRng, botDifficulty: index % 3 === 0 ? 'facile' : 'difficile' });
            const entry = match.lastTurn;
            assert.equal(entry.plays.length, 2);
            assert.notEqual(entry.plays[0].card, undefined);
            matchUses[entry.plays[0].card] += 1;
            matchUses[entry.plays[1].card] += 1;
            if (entry.winnerSeat !== null) {
                assert.ok(entry.bottino >= 1);
                assert.equal(entry.scores[entry.winnerSeat], match.scores[entry.winnerSeat]);
            }
            match = advanceMatch(match);
            assert.ok(handCount(match) === 20, 'nessuna carta creata o persa');
        }

        assert.equal(match.phase, 'over');
        assert.equal(match.history.filter(entry => !entry.overtime).length, REGULATION_TURNS);
        assert.equal(match.scores[0] + match.scores[1], match.history.reduce((sum, entry) => sum + (entry.winnerSeat === null ? 0 : entry.bottino), 0));
        assert.ok(match.scores[0] + match.scores[1] <= 16 + Math.max(0, match.history.length - REGULATION_TURNS));
        assert.ok(outcomeForSeat(match, 0) === null || ['win', 'loss', 'draw'].includes(outcomeForSeat(match, 0)));
        assert.ok(match.turn <= REGULATION_TURNS + 12);
        assert.ok(match.history.length >= REGULATION_TURNS);
        [0, 1].forEach(seat => {
            assert.ok(match.history.filter(entry => entry.plays[seat]).length <= 20);
        });
        if (match.endReason === 'spareggio') {
            assert.ok(match.overtime);
            assert.equal(match.history.at(-1).bottino, 1);
        }
        if (match.overtime) {
            const firstOvertime = match.history.find(entry => entry.overtime);
            assert.equal(firstOvertime.bottino, 1);
        }
        // In una singola partita ogni carta fisica esiste al massimo 12 volte
        // (6 + 6) e il JOLLY 4 volte: nessuna carta viene duplicata.
        Object.entries(matchUses).forEach(([card, uses]) => {
            const max = card === 'jolly' ? 4 : 12;
            assert.ok(uses <= max, `${card} giocato ${uses} volte in una partita`);
        });
    }
});

test('SCIPPO: spareggio con carte rimaste, bottino da 1 e fine senza carte inventate', () => {
    let foundOvertime = false;
    for (let seed = 0; seed < 400 && !foundOvertime; seed += 1) {
        let match = createMatch({ seed, decks: [DEFAULT_DECK_COMPOSITION, DEFAULT_DECK_COMPOSITION] });
        let guard = 0;
        while (!match.finished && guard++ < 40) {
            match = playDeterministicTurn(match, { playerRng: createRng(seed + guard) });
            match = advanceMatch(match);
        }
        if (match.overtime) {
            foundOvertime = true;
            assert.ok(match.turn > REGULATION_TURNS);
            assert.ok(match.history.some(entry => entry.overtime && entry.turn === REGULATION_TURNS + 1));
            const overtimeEntries = match.history.filter(entry => entry.overtime);
            assert.ok(overtimeEntries.every(entry => entry.bottino === 1));
            assert.ok(match.hands[0].length <= HAND_SIZE);
            assert.ok(match.piles[0].length <= 16);
            assert.ok(handCount(match) === 20);
            // Nessuna carta extra: la somma delle carte usate nelle fasi extra
            // non supera le carte residue del mazzo.
            const used = match.history.length * 2;
            assert.ok(used <= 40);
        }
    }
    assert.equal(foundOvertime, true, 'almeno una partita simulata arriva allo spareggio');
});

test('SCIPPO: il BOT non legge la carta coperta né la mano dell’avversario', () => {
    const base = createMatch({ seed: 9090, decks: [DEFAULT_DECK_COMPOSITION, DEFAULT_DECK_COMPOSITION] });
    assert.equal(base.phase, 'choose');
    ['facile', 'normale', 'difficile'].forEach(difficulty => {
        const before = chooseBotCard({ match: base, seat: 1, difficulty, rng: createRng(777) });
        // Simula la scelta segreta del giocatore (cambia mano e pending).
        const playerCard = base.hands[0][0];
        const pending = playCard(base, 0, playerCard).match;
        const after = chooseBotCard({ match: pending, seat: 1, difficulty, rng: createRng(777) });
        assert.equal(after, before, `${difficulty}: la scelta del BOT non dipende da dati nascosti`);
        assert.ok(base.hands[1].includes(after));
    });

    // Le informazioni pubbliche non includono la mano avversaria.
    const unknown = getPublicUnknownCards(base, 1);
    assert.equal(unknown.length, 20);
    const afterReveal = playDeterministicTurn(base, { playerRng: createRng(1) });
    assert.equal(getPublicUnknownCards(afterReveal, 1).length, 19, 'ogni scarto rivelato riduce le carte ignote');
});

test('SCIPPO: BOT deterministico con lo stesso seed e più forte alle difficoltà alte', () => {
    const match = createMatch({ seed: 1234, decks: [DEFAULT_DECK_COMPOSITION, DEFAULT_DECK_COMPOSITION] });
    const first = chooseBotCard({ match, seat: 1, difficulty: 'difficile', rng: createRng(55) });
    const second = chooseBotCard({ match, seat: 1, difficulty: 'difficile', rng: createRng(55) });
    assert.equal(first, second, 'stesso scenario, stessa scelta');
    assert.ok(isBotDifficulty('facile') && isBotDifficulty('difficile'));
    assert.equal(isBotDifficulty('impossibile'), false);

    const playGame = (hardSeat, seed) => {
        let game = createMatch({ seed, decks: [DEFAULT_DECK_COMPOSITION, DEFAULT_DECK_COMPOSITION] });
        let guard = 0;
        while (!game.finished && guard++ < 40) {
            const firstDifficulty = hardSeat === 0 ? 'difficile' : 'facile';
            const secondDifficulty = hardSeat === 0 ? 'facile' : 'difficile';
            const cardA = chooseBotCard({ match: game, seat: 0, difficulty: firstDifficulty, rng: createRng(game.seed + game.turn) });
            let step = playCard(game, 0, cardA).match;
            const cardB = chooseBotCard({ match: step, seat: 1, difficulty: secondDifficulty, rng: createRng(step.seed + step.turn + 7) });
            step = playCard(step, 1, cardB).match;
            step = advanceMatch(step);
            game = step;
        }
        return game.winner;
    };

    let hardWins = 0;
    let easyWins = 0;
    for (let seed = 0; seed < 120; seed += 1) {
        const hardSeat = seed % 2;
        const winner = playGame(hardSeat, seed);
        if (winner === hardSeat) hardWins += 1;
        else if (winner !== null) easyWins += 1;
    }
    assert.ok(hardWins > easyWins, `difficile ${hardWins} vs facile ${easyWins}`);
});

test('SCIPPO: stessa sfida, stesso scenario per entrambi i giocatori', () => {
    const seed = 987654321;
    const a = createMatch({ seed, decks: [DEFAULT_DECK_COMPOSITION, DEFAULT_DECK_COMPOSITION] });
    const b = createMatch({ seed, decks: [DEFAULT_DECK_COMPOSITION, DEFAULT_DECK_COMPOSITION] });
    assert.deepEqual(a.hands, b.hands);
    assert.deepEqual(a.piles, b.piles);
    assert.deepEqual(a.bottinoQueue, b.bottinoQueue);
    assert.equal(a.bottino, b.bottino);
    assert.equal(createBottinoQueue(8, createRng(1)).length, 8);
    assert.ok(createBottinoQueue(8, createRng(1)).every(value => [1, 2, 3].includes(value)));
    assert.equal(Boolean(getDailyChallenge(new Date())), true);
    assert.equal(typeof dailyChallengeKey(new Date()), 'string');
});

test('SCIPPO: profilo, mazzi e statistiche locali restano coerenti', () => {
    const storage = (() => {
        const map = new Map();
        return {
            getItem: key => (map.has(key) ? map.get(key) : null),
            setItem: (key, value) => map.set(key, String(value)),
            removeItem: key => map.delete(key)
        };
    })();

    saveScippoProfile(createDefaultProfile(), storage);
    let profile = loadScippoProfile(storage);
    assert.equal(profile.stats.played, 0);
    assert.equal(profile.activeDeckId, 'standard');

    profile = recordScippoMatch(profile, { outcome: 'win', difficulty: 'normale', score: 9, match: null });
    profile = recordScippoMatch(profile, { outcome: 'win', difficulty: 'difficile', score: 11, match: null });
    profile = recordScippoMatch(profile, { outcome: 'draw', difficulty: 'facile', score: 6, match: null });
    assert.equal(profile.stats.played, 3);
    assert.equal(profile.stats.wins, 2);
    assert.equal(profile.stats.draws, 1);
    assert.equal(profile.stats.streak, 0);
    assert.equal(profile.stats.bestStreak, 2);
    assert.equal(profile.stats.bestScore, 11);
    assert.equal(profile.stats.winsByLevel.difficile, 1);

    const saved = saveDeck(profile, { name: 'Prova', composition: DEFAULT_DECK_COMPOSITION });
    assert.equal(saved.error, null);
    assert.equal(setActiveDeck(saved.profile, 'standard').profile.activeDeckId, 'standard');
    assert.equal(setActiveDeck(saved.profile, 'mazzo-inesistente').error !== null, true);

    const raw = JSON.parse(storage.getItem('taverna:scippo:v1'));
    raw.stats.played = -5;
    const cleaned = normalizeScippoProfile(raw);
    assert.equal(cleaned.stats.played, 0);
    assert.deepEqual(cleaned.stats.winsByLevel, { facile: 0, normale: 0, difficile: 0 });

    assert.ok(getLegalCards(createMatch({ seed: 1 }), 0).length === HAND_SIZE);
});
