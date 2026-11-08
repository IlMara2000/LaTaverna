import test from 'node:test';
import assert from 'node:assert/strict';

import { CARD_TYPES, compareCards } from '../../src/services/scippoEngine.js';
import {
    DRUNK_DECK_TOTAL,
    EGG_IDS,
    FRAGMENTS,
    QUADERNO_STORAGE_KEY,
    SALE_CARD,
    SECRET_LINE,
    canPersistQuaderno,
    chooseCantina,
    isDrunkDeck,
    isMisspelledDeckName,
    isWitchingHour,
    parseChallengeCode,
    loadQuaderno,
    normalizeQuaderno,
    noteQuadernoVisit,
    openCantina,
    quadernoProgress,
    registerEgg,
    resolveCantinaTurn,
    saveQuaderno,
    transcriptionFor,
    wrongWordPool
} from '../../src/services/scippoSecret.js';

const fakeStorage = () => {
    const map = new Map();
    return {
        getItem: key => (map.has(key) ? map.get(key) : null),
        setItem: (key, value) => map.set(key, String(value)),
        removeItem: key => map.delete(key)
    };
};

const fullQuaderno = () => normalizeQuaderno({ eggs: [...EGG_IDS] });

test('SCIPPO segreto: otto righe, otto sbagli, e la carta del sale resta fuori dal mazzo', () => {
    assert.equal(EGG_IDS.length, 8);
    assert.equal(new Set(EGG_IDS).size, 8, 'gli otto sbagli hanno id distinti');
    assert.deepEqual(FRAGMENTS.map(fragment => fragment.id), [...EGG_IDS]);

    const readable = FRAGMENTS.slice(0, 7);
    assert.equal(readable.length, 7);
    readable.forEach(fragment => {
        assert.equal(fragment.secret, undefined, `${fragment.id} non è la riga coperta`);
        assert.ok(fragment.label.length > 0);
        assert.ok(fragment.text.length > 30, `${fragment.id} ha una riga vera`);
    });

    const secret = FRAGMENTS[7];
    assert.equal(secret.secret, true);
    assert.equal(secret.text, SECRET_LINE);
    assert.match(SECRET_LINE, /fuoco spento/);
    assert.match(SECRET_LINE, /il sale che non c’è/);

    assert.equal(SALE_CARD.id, 'sale');
    assert.equal(SALE_CARD.beats, undefined, 'la carta del sale non batte niente');
    assert.equal(Object.keys(CARD_TYPES).length, 4, 'il motore resta a quattro semi');
    assert.throws(() => compareCards('sale', 'jolly'), /sconosciuta/);
    assert.throws(() => compareCards('jolly', 'sale'), /sconosciuta/);
});

test('SCIPPO segreto: la cantina non si apre senza gli otto sbagli', () => {
    const storage = fakeStorage();
    const fresh = loadQuaderno(storage);
    assert.deepEqual(fresh.eggs, []);
    assert.equal(fresh.cantina, 'locked');
    assert.equal(fresh.visits, 0);
    assert.equal(fresh.transcriptions, 0);
    assert.equal(fresh.version, 1);
    assert.equal(canPersistQuaderno(storage), true);

    // Una cantina "aperta" con sette sbagli viene richiusa dal normalizzatore.
    const premature = normalizeQuaderno({ eggs: EGG_IDS.slice(0, 7), cantina: 'revealed' });
    assert.equal(premature.cantina, 'locked');
    assert.equal(openCantina(premature).cantina, 'locked');

    let quaderno = fresh;
    const added = registerEgg(quaderno, 'pulsante');
    assert.equal(added.added, true);
    quaderno = added.quaderno;
    assert.deepEqual(quaderno.eggs, ['pulsante']);
    assert.equal(registerEgg(quaderno, 'pulsante').added, false, 'lo stesso sbaglio non si conta due volte');
    assert.equal(registerEgg(quaderno, 'sbaglio-inventato').added, false);
    assert.deepEqual(registerEgg(quaderno, 'sbaglio-inventato').quaderno.eggs, ['pulsante']);

    assert.equal(quadernoProgress(quaderno).found, 1);
    assert.equal(quadernoProgress(quaderno).nextEgg, 'orario');
    assert.equal(quadernoProgress(quaderno).complete, false);

    const complete = fullQuaderno();
    assert.equal(quadernoProgress(complete).complete, true);
    assert.equal(quadernoProgress(complete).nextEgg, null);
    assert.equal(openCantina(complete).cantina, 'revealed');
    assert.equal(openCantina(openCantina(complete)).cantina, 'revealed', 'rientrare non riscrive lo stato');
});

test('SCIPPO segreto: il Quaderno sopravvive a dati corrotti e alla scheda chiusa', () => {
    const storage = fakeStorage();
    const dirty = normalizeQuaderno({
        version: 9,
        eggs: ['turno', 'turno', 'inventato', 42, 'pulsante'],
        cantina: 'spalancata',
        visits: -12,
        transcriptions: 'tante'
    });
    assert.equal(dirty.version, 1);
    assert.deepEqual(dirty.eggs, ['pulsante', 'turno'], 'ordine degli slot, id ignoti scartati');
    assert.equal(dirty.cantina, 'locked');
    assert.equal(dirty.visits, 0);
    assert.equal(dirty.transcriptions, 0);

    assert.deepEqual(normalizeQuaderno(null).eggs, []);
    assert.deepEqual(normalizeQuaderno('niente').eggs, []);
    assert.deepEqual(normalizeQuaderno({ eggs: 'otto' }).eggs, []);

    const saved = saveQuaderno({ eggs: ['orario', 'refuso'], visits: 3 }, storage);
    assert.equal(saved.visits, 3);
    const raw = JSON.parse(storage.getItem(QUADERNO_STORAGE_KEY));
    assert.deepEqual(raw.eggs, ['orario', 'refuso']);

    const reloaded = loadQuaderno(storage);
    assert.deepEqual(reloaded.eggs, ['orario', 'refuso']);
    assert.equal(reloaded.visits, 3);

    storage.setItem(QUADERNO_STORAGE_KEY, '{non è json');
    assert.deepEqual(loadQuaderno(storage).eggs, [], 'un file illeggibile non rompe il gioco');

    const visits = noteQuadernoVisit(noteQuadernoVisit(reloaded));
    assert.equal(visits.visits, 5);

    // Storage bloccato: il Quaderno continua a funzionare in memoria.
    assert.equal(canPersistQuaderno(null), false);
    assert.deepEqual(loadQuaderno(null).eggs, [], 'senza storage non c’è progresso salvato');
});

test('SCIPPO segreto: al tavolo 0 il jolly vince, sempre, senza dadi', () => {
    const turn = resolveCantinaTurn();
    assert.equal(turn.player, SALE_CARD.id);
    assert.equal(turn.dealer, 'jolly');
    assert.equal(turn.winner, 'dealer');
    assert.equal(turn.points, 0);
    assert.equal(turn.impossible, true);
    assert.deepEqual(resolveCantinaTurn(), turn, 'nessuna casualità: stesso turno, stesso esito');
    assert.deepEqual(resolveCantinaTurn(), resolveCantinaTurn());
});

test('SCIPPO segreto: la trascrizione sbaglia una parola diversa a ogni visita', () => {
    const pool = wrongWordPool();
    assert.equal(pool.length, 9);
    assert.equal(new Set(pool).size, 9);

    const seen = pool.map((word, index) => {
        const transcription = transcriptionFor(index);
        assert.equal(transcription.word, word);
        assert.notEqual(transcription.text, SECRET_LINE, `${word}: la trascrizione è sbagliata`);
        assert.match(transcription.text, /che non c’è/);
        return transcription.text;
    });
    assert.equal(new Set(seen).size, 9, 'nove trascrizioni, nove testi diversi');
    assert.deepEqual(transcriptionFor(9), transcriptionFor(0), 'la nona visita ricomincia');
    assert.equal(transcriptionFor(-1).word, pool[1], 'l’indice negativo non esplode');
    assert.equal(transcriptionFor('boh').word, pool[0]);

    const complete = fullQuaderno();
    const opened = openCantina(complete);
    assert.equal(chooseCantina(complete, 'write').cantina, 'locked', 'senza rivelazione non si sceglie');

    const written = chooseCantina(opened, 'write');
    assert.equal(written.cantina, 'transcribed');
    assert.equal(written.transcriptions, 1);
    const writtenAgain = chooseCantina(written, 'write');
    assert.equal(writtenAgain.transcriptions, 1, 'la scelta si fa una volta sola');
    assert.equal(writtenAgain.cantina, 'transcribed');

    const kept = chooseCantina(opened, 'keep');
    assert.equal(kept.cantina, 'kept');
    assert.equal(kept.transcriptions, 0);
    assert.equal(chooseCantina(opened, 'brucia').cantina, 'revealed', 'un modo inventato non fa niente');
});

test('SCIPPO segreto: le 03:33 sono un’ora sola, non una finestra', () => {
    assert.equal(isWitchingHour(new Date(2026, 0, 1, 3, 0, 0)), true);
    assert.equal(isWitchingHour(new Date(2026, 0, 1, 3, 59, 59)), true, 'tutta l’ora delle tre');
    assert.equal(isWitchingHour(new Date(2026, 0, 1, 2, 59, 59)), false);
    assert.equal(isWitchingHour(new Date(2026, 0, 1, 4, 0, 0)), false);
    assert.equal(isWitchingHour(new Date(2026, 0, 1, 0, 0, 0)), false, 'mezzanotte non è la stessa cosa');
    assert.equal(isWitchingHour(new Date(2026, 0, 1, 15, 30, 0)), false);
    assert.equal(isWitchingHour(new Date('non una data')), false);
});

test('SCIPPO segreto: i tre riconoscitori degli sbagli', () => {
    // 3 — Il Nome Sbagliato: una P sola, e gli accenti non salvano nessuno.
    assert.equal(isMisspelledDeckName('scipo'), true);
    assert.equal(isMisspelledDeckName(' SCIPO '), true);
    assert.equal(isMisspelledDeckName('Scipò'), true);
    assert.equal(isMisspelledDeckName('scippo'), false, 'il nome giusto non paga');
    assert.equal(isMisspelledDeckName('scipo!'), false);
    assert.equal(isMisspelledDeckName('mazzo del baro'), false);
    assert.equal(isMisspelledDeckName(''), false);
    assert.equal(isMisspelledDeckName(null), false);

    // 5 — Il Tavolo Sconosciuto: il codice ignoto viene accettato e giocato.
    const known = parseChallengeCode('difficile-1z');
    assert.equal(known.unknown, false);
    assert.equal(known.difficulty, 'difficile');
    assert.equal(known.seed, 36 + 35, 'il seed resta in base 36');
    assert.equal(known.requested, 'difficile');

    const unknownTable = parseChallengeCode('sconosciuto-1');
    assert.equal(unknownTable.unknown, true);
    assert.equal(unknownTable.requested, 'sconosciuto');
    assert.equal(unknownTable.difficulty, 'normale', 'il tavolo sconosciuto deve restare giocabile');
    assert.equal(unknownTable.seed, 1);

    assert.equal(parseChallengeCode(' FACILE-z ').difficulty, 'facile');
    assert.equal(parseChallengeCode(' FACILE-z ').unknown, false);
    [null, '', 'facile', 'facile-', '-1', 'facile-1-2', 42].forEach(value => {
        assert.equal(parseChallengeCode(value), null, `${String(value)} non è un codice`);
    });

    // 7 — La Bilancia Ubriaca: ogni carta legale, la somma no.
    assert.equal(DRUNK_DECK_TOTAL, 32, 'tutto al massimo: 10 + 10 + 10 + 2');
    assert.equal(isDrunkDeck({ botta: 10, scudo: 10, finta: 10, jolly: 2 }), true);
    assert.equal(isDrunkDeck({ botta: 10, scudo: 10, finta: 6, jolly: 2 }), false);
    assert.equal(isDrunkDeck({ botta: 6, scudo: 6, finta: 6, jolly: 2 }), false, 'il mazzo standard non paga');
    assert.equal(isDrunkDeck({ botta: 10, scudo: 10, finta: 11, jolly: 1 }), false, 'una carta fuori scala non paga');
    assert.equal(isDrunkDeck({ botta: 12, scudo: 3, finta: 3, jolly: 2 }), false);
    assert.equal(isDrunkDeck(null), false);
    assert.equal(isDrunkDeck({}), false);
});

test('SCIPPO segreto: gli sbagli delle schermate esistenti pagano una volta sola', () => {
    const storage = fakeStorage();
    let quaderno = loadQuaderno(storage);

    const ghost = registerEgg(quaderno, 'pulsante');
    assert.equal(ghost.added, true);
    quaderno = ghost.quaderno;
    assert.equal(registerEgg(quaderno, 'pulsante').added, false, 'il pulsante inesistente paga una volta sola');

    const typo = registerEgg(quaderno, 'refuso');
    assert.equal(typo.added, true);
    quaderno = typo.quaderno;

    const table = registerEgg(quaderno, 'tavolo');
    assert.equal(table.added, true);
    quaderno = table.quaderno;

    const balance = registerEgg(quaderno, 'bilancia');
    assert.equal(balance.added, true);
    quaderno = balance.quaderno;

    assert.deepEqual(quaderno.eggs, ['pulsante', 'refuso', 'tavolo', 'bilancia'], 'ordine degli slot');
    assert.equal(quadernoProgress(quaderno).found, 4);
    assert.equal(quadernoProgress(quaderno).nextEgg, 'orario');
    assert.equal(quadernoProgress(quaderno).complete, false, 'quattro sbagli non aprono la cantina');

    saveQuaderno(quaderno, storage);
    assert.deepEqual(loadQuaderno(storage).eggs, ['pulsante', 'refuso', 'tavolo', 'bilancia']);
});

test('SCIPPO segreto: leggere il Quaderno non tocca il profilo di gioco', () => {
    const storage = fakeStorage();
    saveQuaderno(fullQuaderno(), storage);
    assert.equal(storage.getItem('taverna:scippo:v1'), null, 'chiavi separate: il profilo resta intatto');
    assert.equal(QUADERNO_STORAGE_KEY, 'taverna:scippo:quaderno:v1');
    assert.ok(storage.getItem(QUADERNO_STORAGE_KEY));
});
