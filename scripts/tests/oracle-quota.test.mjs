import test from 'node:test';
import assert from 'node:assert/strict';

import {formatOracleQuota} from '../../src/services/oracleQuota.js';

test('ORACOLO: una richiesta residua usa il singolare', () => {
    assert.equal(formatOracleQuota(1), '1 richiesta disponibile oggi.');
});

test('ORACOLO: più richieste residue usano il plurale', () => {
    assert.equal(formatOracleQuota(2), '2 richieste disponibili oggi.');
    assert.equal(formatOracleQuota(7), '7 richieste disponibili oggi.');
});

test('ORACOLO: a quota zero invita a tornare domani', () => {
    assert.equal(formatOracleQuota(0), 'Quota Oracolo esaurita per oggi. Torna domani per continuare la conversazione.');
});

test('ORACOLO: una quota non numerica mostra un messaggio dedicato senza NaN', () => {
    for (const value of [undefined, null, '', '   ', 'abc', NaN, Infinity]) {
        assert.equal(formatOracleQuota(value), 'Quota Oracolo non disponibile. Riprova più tardi.');
    }
});
