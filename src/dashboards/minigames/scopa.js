import { renderOnlineModeButton, bindOnlineModeButton } from './onlineModeButton.js';
import { connectOnlineGame } from './onlineGameSession.js';
import { scopaPerspective } from './onlineMatchProtocol.js';
import { setExperienceTheme } from '../../services/experienceTheme.js';
import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { SCOPA_SUITS, cardName, captureOptions, createScopaMatch, nextScopaRound, playScopaMove, chooseScopaMove } from './scopaEngine.js';
import './scopa.css';

const suitOf = card => SCOPA_SUITS.find(suit => suit.id === card.suit);
const shortName = card => `${card.label}${suitOf(card).symbol}`;

function cardInner(card) {
    const suit = suitOf(card);
    const middle = card.value > 7
        ? `<span class="scopa-portrait"><b>${card.label}</b><i>${suit.symbol}</i></span>`
        : `<span class="scopa-pips scopa-pips-${card.value}">${Array.from({ length: card.value }, (_, index) => `<i class="scopa-pip-${index}">${suit.symbol}</i>`).join('')}</span>`;
    return `<span class="scopa-corner"><b>${card.label}</b><i>${suit.symbol}</i></span>${middle}<span class="scopa-corner scopa-corner-bottom"><b>${card.label}</b><i>${suit.symbol}</i></span>`;
}

function face(card, attributes = '', isButton = false) {
    const tag = isButton ? 'button' : 'div';
    return `<${tag} class="scopa-card scopa-face${suitOf(card).red ? ' is-red' : ''}" ${isButton ? 'type="button"' : 'role="img"'} aria-label="${cardName(card)}, valore ${card.value}" ${attributes}>${cardInner(card)}</${tag}>`;
}

const rules = `
    <p>Si gioca contro l’Oste con <b>40 carte da poker</b>: A, 2, 3, 4, 5, 6, 7, J, Q e K di cuori, quadri, fiori e picche.</p>
    <ol>
        <li><b>A = 1, J = 8, Q = 9, K = 10.</b> Le altre carte valgono il loro numero. Si danno 3 carte a testa e 4 scoperte sul tavolo; esaurite le mani, se ne distribuiscono altre 3.</li>
        <li>Gioca una carta per prenderne <b>una dello stesso valore</b>. Questa presa ha la precedenza su ogni somma. Se manca una carta uguale, puoi prendere più carte la cui somma dà il valore giocato. Se hai più prese possibili, scegli tu.</li>
        <li>Se puoi prendere, devi farlo. Altrimenti lasci la carta sul tavolo. Svuotare il tavolo vale <b>1 punto di scopa</b>, tranne all’ultima giocata della smazzata.</li>
        <li>A fine smazzata, chi ha fatto l’ultima presa raccoglie le carte rimaste, senza scopa. Si assegna 1 punto per ciascuna maggioranza: <b>carte, quadri e primiera</b>, più 1 per il <b>7♦ (settebello)</b>. In parità, la categoria non assegna punti.</li>
        <li>Per la primiera conta la carta migliore di ogni seme: 7 = 21, 6 = 18, A = 16, 5 = 15, 4 = 14, 3 = 13, 2 = 12, figure = 10. Devi avere tutti e quattro i semi.</li>
        <li>Vince chi ha più punti alla fine di una smazzata e raggiunge almeno <b>11</b>. Se siete pari a 11 o più, si continua. Il primo giocatore cambia a ogni smazzata.</li>
    </ol>`;

export function initScopa(container) {
    if (!container) return;
    updateSidebarContext('minigames');
    setExperienceTheme('scopa', 'experience');
    container.innerHTML = `
        <div class="scopa-game">
            <div class="scopa-shell">
                <header class="scopa-header">
                    <button type="button" class="scopa-button scopa-exit" data-action="exit">← <span>Esci</span></button>
                    <div class="scopa-brand"><span aria-hidden="true">♦</span><div><small>LA TAVERNA</small><h1>SCOPA</h1></div></div>
                    <div class="scopa-actions"><button type="button" class="scopa-button" data-action="help" aria-label="Come si gioca">?</button><button type="button" class="scopa-button" data-action="restart" aria-label="Ricomincia la partita">↻</button></div>
                </header>
                <section class="scopa-welcome">
                    <div class="scopa-welcome-cards" aria-hidden="true">${face({ id: 'spades-A', suit: 'spades', label: 'A', name: 'Asso', value: 1 })}${face({ id: 'diamonds-7', suit: 'diamonds', label: '7', name: '7', value: 7 })}${face({ id: 'hearts-K', suit: 'hearts', label: 'K', name: 'Re', value: 10 })}</div>
                    <span class="scopa-eyebrow">40 CARTE DA POKER · CONTRO L’OSTE</span>
                    <h2>Un tavolo da ripulire.</h2>
                    <p>Trova la presa giusta, conquista il settebello e arriva a 11 punti.</p>
                    ${renderOnlineModeButton('scopa')}<button type="button" class="scopa-button scopa-primary" data-action="start">GIOCA A SCOPA</button>
                    <p class="scopa-rank-note">A = 1 · J = 8 · Q = 9 · K = 10<br>♥ Cuori · ♦ Quadri · ♣ Fiori · ♠ Picche</p>
                </section>
                <section class="scopa-scoreboard" hidden aria-label="Punteggio partita"></section>
                <main class="scopa-board" hidden>
                    <section class="scopa-opponent" aria-label="Mano dell’Oste"><div class="scopa-opponent-copy"></div><div class="scopa-opponent-hand" aria-hidden="true"></div><div class="scopa-stock"></div></section>
                    <section class="scopa-table-area" aria-label="Carte sul tavolo"><div class="scopa-table-label">SUL TAVOLO</div><div class="scopa-table-cards"></div></section>
                    <section class="scopa-feedback"><p class="scopa-last-move" aria-live="polite"></p><p class="scopa-status" aria-live="polite"></p><div class="scopa-choices"></div></section>
                    <section class="scopa-player" aria-label="La tua mano"><div class="scopa-player-hand"></div><p>LA TUA MANO <span>· A = 1 · J = 8 · Q = 9 · K = 10</span></p></section>
                </main>
            </div>
            <dialog class="scopa-dialog" aria-labelledby="scopa-dialog-title"><div class="scopa-dialog-head"><span class="scopa-eyebrow">SCOPA · CARTE DA POKER</span><button type="button" class="scopa-button" data-action="close-dialog" aria-label="Chiudi">×</button></div><h2 id="scopa-dialog-title"></h2><div class="scopa-dialog-copy"></div><div class="scopa-dialog-actions"></div></dialog>
        </div>`;

    const root = container.querySelector('.scopa-game');
    const query = selector => root.querySelector(selector);
    const dialog = query('.scopa-dialog');
    const online = { onlineMode: false };
    let match = null;
    let selected = null;
    let choices = [];
    let botTimer = null;
    let stopped = false;
    let dialogKind = null;

    function clearBot() {
        window.clearTimeout(botTimer);
        botTimer = null;
    }

    function cleanup() {
        if (stopped) return;
        stopped = true;
        stopOnline();
        clearBot();
        observer.disconnect();
        root.removeEventListener('click', handleClick);
        dialog.removeEventListener('cancel', cancelDialog);
        if (dialog.open) dialog.close();
    }

    const observer = new MutationObserver(() => {
        if (!root.isConnected) cleanup();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    function scheduleBot() {
        clearBot();
        if (online.onlineMode || stopped || !match || match.round.over || match.round.turn !== 1 || dialog.open) return;
        botTimer = window.setTimeout(() => {
            botTimer = null;
            if (stopped || !root.isConnected) return;
            const move = chooseScopaMove(match.round);
            if (move) makeMove(1, move.index, move.ids);
        }, 900);
    }

    function showDialog(kind, title, copy, actions = '') {
        clearBot();
        dialogKind = kind;
        query('#scopa-dialog-title').textContent = title;
        query('.scopa-dialog-copy').innerHTML = copy;
        query('.scopa-dialog-actions').innerHTML = actions;
        query('[data-action="close-dialog"]').hidden = kind === 'result';
        if (!dialog.open) dialog.showModal();
        const focusTarget = kind === 'result' ? query('.scopa-dialog-actions button') : query('[data-action="close-dialog"]');
        focusTarget?.focus();
    }

    function closeDialog() {
        if (dialogKind === 'result') return;
        dialog.close();
        dialogKind = null;
        scheduleBot();
    }

    function cancelDialog(event) {
        event.preventDefault();
        closeDialog();
    }

    function start() {
        clearBot();
        if (dialog.open) dialog.close();
        dialogKind = null;
        match = createScopaMatch();
        selected = null;
        choices = [];
        query('.scopa-welcome').hidden = true;
        query('.scopa-scoreboard').hidden = false;
        query('.scopa-board').hidden = false;
        render();
    }

    function render() {
        if (stopped || !match) return;
        const round = match.round;
        query('.scopa-scoreboard').innerHTML = `<div><small>TU</small><strong>${match.totals[0]}<span> / 11</span></strong></div><div class="scopa-round"><small>SMAZZATA ${match.number}</small><b>${round.over ? 'CONTEGGIO PUNTI' : round.turn === 0 ? 'TOCCA A TE' : (online.onlineMode ? 'TURNO AVVERSARIO' : 'L’OSTE PENSA')}</b></div><div><small>${online.onlineMode ? 'AVVERSARIO' : 'OSTE'}</small><strong>${match.totals[1]}<span> / 11</span></strong></div>`;
        query('.scopa-opponent-copy').innerHTML = `<b>${online.onlineMode ? 'AVVERSARIO' : 'OSTE'}</b><small>${round.captured[1].length} carte prese · ${round.sweeps[1]} scope</small>`;
        query('.scopa-opponent-hand').innerHTML = round.hands[1].map(() => '<div class="scopa-card scopa-back"></div>').join('');
        query('.scopa-stock').innerHTML = `<small>NEL MAZZO</small><strong>${round.deck.length}</strong>`;
        const possibleIds = new Set(choices.flat());
        query('.scopa-table-cards').innerHTML = round.table.length
            ? round.table.map(card => face(card, possibleIds.has(card.id) ? 'data-available="true"' : '')).join('')
            : '<div class="scopa-empty-table"><span aria-hidden="true">♦</span><p>Il tavolo è libero</p></div>';
        query('.scopa-player-hand').innerHTML = round.hands[0].map((card, index) => face(card, `data-hand-index="${index}" aria-pressed="${selected === index}" ${round.turn !== 0 || round.over ? 'disabled' : ''}`, true)).join('');
        query('.scopa-player > p').innerHTML = `LA TUA MANO <span>· ${round.captured[0].length} carte prese · ${round.sweeps[0]} scope</span>`;
        const last = round.lastMove;
        query('.scopa-last-move').textContent = last
            ? `${last.player === 0 ? 'Tu' : online.onlineMode ? 'Avversario' : 'L’Oste'}: ${shortName(last.card)}${last.taken.length ? ` prende ${last.taken.map(shortName).join(' + ')}` : ' sul tavolo'}${last.sweep ? ' · SCOPA! +1' : ''}`
            : 'Carte da poker · il 7♦ è il settebello.';
        query('.scopa-last-move').classList.toggle('is-scopa', Boolean(last?.sweep));
        query('.scopa-status').textContent = round.over ? 'Smazzata conclusa.' : selected !== null
            ? `Scegli cosa prendere con ${shortName(round.hands[0][selected])}:`
            : round.turn === 0 ? 'Scegli una carta dalla tua mano.' : (online.onlineMode ? 'In attesa dell’avversario.' : 'L’Oste sta scegliendo la sua carta…');
        query('.scopa-choices').innerHTML = selected !== null
            ? `${choices.map((ids, index) => `<button type="button" class="scopa-button scopa-capture-choice" data-capture-index="${index}">Prendi ${ids.map(id => shortName(round.table.find(card => card.id === id))).join(' + ')}</button>`).join('')}<button type="button" class="scopa-button scopa-cancel-choice" data-action="cancel-choice">Annulla</button>`
            : '';
    }

    function selectCard(index) {
        if (!match || match.round.turn !== 0 || match.round.over || dialog.open) return;
        const card = match.round.hands[0][index];
        if (!card) return;
        const options = captureOptions(card, match.round.table);
        if (options.length <= 1) {
            makeMove(0, index, options[0] || []);
        } else {
            selected = index;
            choices = options;
            render();
            query('[data-capture-index]')?.focus();
        }
    }

    function makeMove(player, index, ids) {
        if (!playScopaMove(match, player, index, ids)) return;
        selected = null;
        choices = [];
        render();
        if (online.onlineMode) { void online.onlineSync.commit(); return; }
        if (match.round.over) showResult();
        else scheduleBot();
    }

    function showResult() {
        const result = match.round.result;
        const rows = [
            ['Carte', result.cardCounts.map(count => `${count} carte`), result.points.cards],
            ['Quadri ♦', result.diamondCounts.map(count => `${count} quadri`), result.points.diamonds],
            ['Settebello 7♦', null, result.points.settebello],
            ['Primiera', result.primieras.map(value => value.eligible ? String(value.total) : 'Semi incompleti'), result.points.primiera],
            ['Scope', null, result.points.sweeps]
        ];
        const table = `<table class="scopa-result-table"><thead><tr><th>Categoria</th><th>Tu</th><th>Oste</th></tr></thead><tbody>${rows.map(([name, notes, points]) => `<tr><th scope="row">${name}</th>${points.map((point, owner) => `<td><b>${point > 0 ? '+' : ''}${point}</b>${notes ? `<small>${notes[owner]}</small>` : ''}</td>`).join('')}</tr>`).join('')}<tr class="scopa-result-total"><th scope="row">Smazzata</th><td>+${result.totals[0]}</td><td>+${result.totals[1]}</td></tr><tr class="scopa-result-total"><th scope="row">Partita</th><td>${match.totals[0]}</td><td>${match.totals[1]}</td></tr></tbody></table>`;
        const last = match.round.lastMove;
        const leftoverNote = last.leftovers.length ? `<p class="scopa-result-note">Le ${last.leftovers.length} carte rimaste vanno ${last.leftoversOwner === 0 ? 'a te' : 'all’Oste'}, che ha fatto l’ultima presa.</p>` : '';
        const title = match.over ? match.winner === 0 ? 'Hai vinto la partita!' : 'L’Oste vince la partita' : `Smazzata ${match.number} conclusa`;
        const note = match.over ? 'La partita è conclusa. Pronto per la rivincita?' : match.totals[0] === match.totals[1] && match.totals[0] >= 11 ? 'Siete in parità: serve un’altra smazzata per decidere il vincitore.' : 'Si gioca fino a 11 punti, con il conteggio alla fine della smazzata.';
        showDialog('result', online.onlineMode ? title.replace('L’Oste', 'L’avversario') : title, `${online.onlineMode ? table.replace('Oste', 'Avversario') : table}${leftoverNote}<p>${note}</p>`, `<button type="button" class="scopa-button scopa-primary" data-action="${match.over ? 'restart' : 'next-round'}" ${online.onlineMode && online.onlineSeat !== 0 ? 'disabled' : ''}>${match.over ? 'RIVINCITA' : 'PROSSIMA SMAZZATA'}</button><button type="button" class="scopa-button" data-action="exit">TORNA ALLA SALA GIOCHI</button>`);
    }

    async function handleClick(event) {
        const button = event.target.closest('button');
        if (!button || !root.contains(button) || button.disabled) return;
        if (button.dataset.handIndex !== undefined) return selectCard(Number(button.dataset.handIndex));
        if (button.dataset.captureIndex !== undefined) {
            const ids = choices[Number(button.dataset.captureIndex)];
            if (selected !== null && ids) makeMove(0, selected, ids);
            return;
        }
        switch (button.dataset.action) {
            case 'start':
            case 'restart':
                if (online.onlineMode && online.onlineSeat !== 0) break;
                if (!online.onlineMode) stopOnline();
                start();
                if (online.onlineMode) void online.onlineSync.commit(current => ({turn:0,match:createScopaMatch()}));
                break;
            case 'help': showDialog('help', 'Come si gioca', rules); break;
            case 'close-dialog': closeDialog(); break;
            case 'cancel-choice': selected = null; choices = []; render(); break;
            case 'next-round':
                if (online.onlineMode && online.onlineSeat !== 0) break;
                if (nextScopaRound(match)) {
                    dialog.close();
                    dialogKind = null;
                    selected = null;
                    choices = [];
                    render();
                    if (online.onlineMode) void online.onlineSync.commit();
                    else scheduleBot();
                }
                break;
            case 'exit': {
                cleanup();
                const { showMinigamesList } = await import('../../minigamelist.js');
                if (root.isConnected) showMinigamesList(container, { filter: 'cards' });
                break;
            }
        }
    }
    const stopOnline = bindOnlineModeButton(container, {
        gameId: 'scopa', gameName: 'Scopa',
        onConnected: room => {
            online.onlineMode = true; start();
            return connectOnlineGame(container, online, {
                gameId: 'scopa', room,
                read: seat => { const canonical = scopaPerspective(match, seat); return {turn: canonical.round.over ? 0 : canonical.round.turn, match: canonical}; },
                apply: (snapshot, seat) => {
                    match = scopaPerspective(snapshot.match, seat); selected = null; choices = [];
                    if (dialog.open) dialog.close(); dialogKind = null;
                    render(); if (match.round.over) showResult();
                }
            });
        }
    });
    root.addEventListener('click', handleClick);
    dialog.addEventListener('cancel', cancelDialog);
    return cleanup;
}
