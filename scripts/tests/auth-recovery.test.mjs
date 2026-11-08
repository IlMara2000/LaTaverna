/**
 * Recupero password: riconoscimento del link e regole della nuova password.
 *
 * Il riconoscimento decide se mostrare il modulo di reset invece del portale:
 * se sbaglia, il link di Supabase apre la home e la password non si può più
 * cambiare. La validazione invece deve restare identica a registrazione e
 * impostazioni, perché la fonte è la stessa: passwordPolicy.js.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { useDom } from './helpers/view-dom.mjs';

// DOM neutro: il frammento di recupero non deve finire nello snapshot che
// supabase.js legge all'import, altrimenti ogni caso successivo eredita
// l'intenzione del primo.
const window = useDom({ url: 'http://localhost/' });

const { isPasswordRecoveryLink } = await import('../../src/services/recoveryLink.js');
const { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePassword } = await import('../../src/services/passwordPolicy.js');

const goTo = url => window.history.replaceState({}, '', url);

// --- Riconoscimento del link -------------------------------------------

test('il frammento con type=recovery è riconosciuto', () => {
    const link = 'https://lataverna.xyz/#access_token=abc123&refresh_token=def456&expires_in=3600&type=recovery';
    assert.equal(isPasswordRecoveryLink(link), true);
});

test('il link PKCE con type=recovery in query string è riconosciuto', () => {
    assert.equal(isPasswordRecoveryLink('https://lataverna.xyz/?code=abc123&type=recovery'), true);
});

test('un frammento di altro tipo non è un recupero password', () => {
    assert.equal(isPasswordRecoveryLink('https://lataverna.xyz/#access_token=abc123&type=invite'), false);
    assert.equal(isPasswordRecoveryLink('https://lataverna.xyz/#access_token=abc123&type=signup'), false);
});

test('il tipo deve essere esattamente recovery, non un prefisso', () => {
    assert.equal(isPasswordRecoveryLink('https://lataverna.xyz/#type=recoveryX'), false);
});

test('un URL malformato non fa esplodere il riconoscimento', () => {
    assert.equal(isPasswordRecoveryLink('http://[malformato'), false);
});

test('senza frammento, senza query e senza segno in sessione non è un recupero', () => {
    goTo('/');
    window.sessionStorage.removeItem('taverna_password_recovery');
    assert.equal(isPasswordRecoveryLink(), false);
});

test('il frammento nella barra degli indirizzi viene letto a runtime', () => {
    goTo('/#access_token=abc123&refresh_token=def456&type=recovery');
    assert.equal(isPasswordRecoveryLink(), true);
    goTo('/');
});

test('il segno lasciato in sessionStorage vale dopo che il client ha ripulito l’URL', () => {
    goTo('/');
    window.sessionStorage.setItem('taverna_password_recovery', '1');
    assert.equal(isPasswordRecoveryLink(), true);
    window.sessionStorage.removeItem('taverna_password_recovery');
});

// --- Regole della nuova password ---------------------------------------

test('una password più corta del minimo viene rifiutata con il minimo in chiaro', () => {
    const tooShort = 'a'.repeat(PASSWORD_MIN_LENGTH - 2) + '1';
    assert.equal(tooShort.length, PASSWORD_MIN_LENGTH - 1);
    assert.match(validatePassword(tooShort), new RegExp(String(PASSWORD_MIN_LENGTH)), 'il messaggio dice quanti caratteri servono');
});

test('una password vuota viene rifiutata', () => {
    assert.ok(validatePassword(''), 'la stringa vuota non passa');
});

test('al minimo con lettera e numero la password è accettata', () => {
    const ok = 'taverna' + '1'.repeat(Math.max(0, PASSWORD_MIN_LENGTH - 'taverna'.length));
    assert.equal(ok.length, PASSWORD_MIN_LENGTH);
    assert.equal(validatePassword(ok), '');
});

test('solo lettere o solo numeri non bastano', () => {
    assert.match(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH + 2)), /lettera e un numero/);
    assert.match(validatePassword('1'.repeat(PASSWORD_MIN_LENGTH + 2)), /lettera e un numero/);
});

test('al massimo la password è accettata, un carattere in più no', () => {
    const ok = 'a'.repeat(PASSWORD_MAX_LENGTH - 1) + '1';
    assert.equal(ok.length, PASSWORD_MAX_LENGTH);
    assert.equal(validatePassword(ok), '');
    assert.match(validatePassword(ok + 'a'), new RegExp(String(PASSWORD_MAX_LENGTH)), 'il limite massimo è dichiarato');
});