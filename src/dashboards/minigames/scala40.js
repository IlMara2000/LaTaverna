import { renderOnlineModeButton, bindOnlineModeButton } from './onlineModeButton.js';
import { connectOnlineGame } from './onlineGameSession.js';
import { recordActivity } from '../../services/communityMetrics.js';
import { newScala40, scalaMove, scalaBotTurn, meldInfo, label, penalty } from './scala40Engine.js';
import { recordMinigameResult, renderMinigameRecordLine } from '../../services/minigameRecords.js';
import { navigateTo } from '../../services/appNavigation.js';
import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { esc } from '../../services/communityUi.js';
import './scala40.css';

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_NAMES = ['picche', 'cuori', 'quadri', 'fiori'];

const RULES = `
    <p>Due mazzi da 52 carte più quattro jolly: si pesca, si cala e si scarta fino a chiudere la smazzata.</p>
    <ol>
        <li><b>Pesca</b> dal mazzo, oppure raccogli la carta in cima agli scarti se hai già aperto il tavolo.</li>
        <li><b>Combinazioni</b>: tris o poker di semi diversi, oppure scale dello stesso seme con almeno tre carte. Un solo jolly per combinazione.</li>
        <li><b>Apertura</b>: prepara una o più combinazioni da almeno 40 punti, poi confermale. Le carte preparate restano fuori dalla mano fino alla conferma.</li>
        <li>Dopo l'apertura puoi <b>attaccare</b> carte alle combinazioni sul tavolo e sostituire un jolly con la carta che rappresenta.</li>
        <li>La carta raccolta dagli scarti e il jolly recuperato vanno giocati <b>nello stesso turno</b>.</li>
        <li>Conserva sempre una carta per lo scarto finale. Non si chiude al primo giro: vince chi resta senza carte, gli altri sommano i punti delle carte rimaste.</li>
    </ol>
    <p>Punteggio delle carte rimaste: jolly 25, asso 11, figure e carte da 8 a 10 il loro valore, dal 2 al 7 il loro numero. <a href="https://www.fisca.it/regolamento_scala.html" target="_blank" rel="noopener noreferrer">Regolamento di riferimento</a>.</p>`;

const isRed = card => card.suit === 1 || card.suit === 2;
const rankText = rank => rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank);
const cardName = card => card.rank === 0
    ? (card.representedRank ? `Jolly come ${rankText(card.representedRank)}` : 'Jolly')
    : `${rankText(card.rank)} di ${SUIT_NAMES[card.suit]}`;

function cardFace(card, { mini = false, extra = '', attrs = '', tag = 'div' } = {}) {
    const joker = card.rank === 0;
    const symbol = joker ? '★' : SUITS[card.suit] || '';
    const shownRank = joker ? (card.representedRank ? rankText(card.representedRank) : '★') : rankText(card.rank);
    const classes = ['s40-card', 's40-face', isRed(card) ? 'is-red' : '', joker ? 'is-joker' : '', mini ? 'is-mini' : '', extra]
        .filter(Boolean).join(' ');
    return `<${tag} class="${classes}"${tag === 'button' ? ' type="button"' : ''} aria-label="${esc(cardName(card))}" ${attrs}>
        <span class="s40-card-corner" aria-hidden="true"><b>${joker ? '★' : shownRank}</b><i>${symbol}</i></span>
        <span class="s40-card-center" aria-hidden="true">${joker ? (card.representedRank ? shownRank : '★') : symbol}${joker ? '<small>JOLLY</small>' : ''}</span>
        <span class="s40-card-corner s40-card-corner-bottom" aria-hidden="true"><b>${joker ? '★' : shownRank}</b><i>${symbol}</i></span>
    </${tag}>`;
}

const cardBack = mini => `<span class="s40-card is-back${mini ? ' is-mini' : ''}" aria-hidden="true"></span>`;

const handPoints = hand => hand.reduce((total, card) => total + penalty(card), 0);

export function initScala40(container) {
    updateSidebarContext('cards');
    let state = newScala40();
    const selected = new Set();
    let message = 'Pesca una carta dal mazzo per cominciare.';
    let timer;
    let disposed = false;
    let recorded = false;
    let activityLogged = false;
    let botError = false;
    const online = { onlineMode: false };
    let seat = 0;
    let stopOnline;

    const shell = document.createElement('div');
    shell.className = 'scala40-game';
    shell.innerHTML = `<div class="scala40-shell">
        ${renderOnlineModeButton('scala40')}
        <div data-scala-view></div>
        <div class="s40-overlay" data-s40-help hidden>
            <section class="s40-panel" role="dialog" aria-modal="true" aria-labelledby="s40-help-title">
                <span class="s40-eyebrow">SCALA 40 · DUE MAZZI E QUATTRO JOLLY</span>
                <h2 id="s40-help-title">Come si gioca</h2>
                ${RULES}
                <div class="s40-actions-row"><button type="button" class="s40-button is-primary" data-s40="help-close">HO CAPITO</button></div>
            </section>
        </div>
    </div>`;
    container.replaceChildren(shell);
    const view = shell.querySelector('[data-scala-view]');
    const help = shell.querySelector('[data-s40-help]');

    const setHelp = open => { help.hidden = !open; };

    const play = action => {
        if (online.onlineMode) {
            if (!online.onlineReady) return;
            void online.onlineSync.commit((current, actor) => {
                if (current.turn !== actor) throw new Error('Attendi il tuo turno.');
                return scalaMove(current, action);
            });
            return;
        }
        try {
            state = scalaMove(state, action);
            botError = false;
            selected.clear();
            message = state.winner !== null
                ? 'Smazzata conclusa.'
                : state.turn === 1
                    ? 'L’Oste sta giocando…'
                    : state.phase === 'draw'
                        ? 'Pesca una carta dal mazzo o raccogli lo scarto.'
                        : 'Seleziona le carte da calare, oppure una carta da scartare.';
            render();
            if (state.turn === 1 && state.winner === null) {
                clearTimeout(timer);
                timer = setTimeout(runBot, 600);
            }
        } catch (error) {
            message = error.message;
            render();
        }
    };

    const runBot = () => {
        if (disposed || online.onlineMode) return;
        try {
            state = scalaBotTurn(state);
        } catch {
            // L'Oste non deve mai bloccare il tavolo: se la smazzata è incoerente si passa il turno.
            botError = true;
            state = { ...state, turn: seat, phase: 'draw' };
        }
        message = state.winner !== null
            ? 'Smazzata conclusa.'
            : botError
                ? 'L’Oste ha passato il turno. Continua a giocare.'
                : 'Tocca a te: pesca una carta.';
        render();
    };

    const restart = () => {
        if (online.onlineMode) return;
        clearTimeout(timer);
        state = newScala40();
        selected.clear();
        recorded = false;
        activityLogged = false;
        botError = false;
        message = 'Nuova smazzata. Pesca una carta dal mazzo.';
        render();
    };

    const opponentMeldPoints = melds => melds.reduce((total, meld) => total + meld.points, 0);

    function render() {
        const hand = state.hands[seat] || [];
        [...selected].forEach(id => { if (!hand.some(card => card.id === id)) selected.delete(id); });
        const ended = state.winner !== null;

        if (ended) {
            if (!activityLogged) { activityLogged = true; void recordActivity('game_completed'); }
            if (!recorded && !online.onlineMode) {
                recorded = true;
                recordMinigameResult('scala40', state.winner === 'draw' ? 'draw' : state.winner === seat ? 'win' : 'loss', {
                    score: handPoints(hand),
                    betterWhen: 'lower'
                });
            }
        }

        const canPlay = state.turn === seat && !ended && (!online.onlineMode || online.onlineReady);
        const selectedCards = hand.filter(card => selected.has(card.id));
        const stagedPoints = state.staged.reduce((total, meld) => total + meld.points, 0);
        const myMelds = state.melds.filter(meld => meld.owner === seat);
        const rivalMelds = state.melds.filter(meld => meld.owner !== seat);
        const rival = online.onlineMode ? 'AVVERSARIO' : 'L’OSTE';
        const discardTop = state.discard.at(-1);
        const target = seat === 0 ? 1 : 0;

        const canAttach = meld => {
            if (!canPlay || !state.opened[seat] || !selectedCards.length) return false;
            if (selectedCards.length >= hand.length) return false;
            const info = meldInfo([...meld.cards, ...selectedCards]);
            return Boolean(info) && info.type === meld.type;
        };

        const renderMeld = meld => {
            const attach = canAttach(meld);
            const hasJoker = meld.cards.some(card => !card.rank);
            const replace = canPlay && state.opened[seat] && selectedCards.length === 1 && selectedCards[0].rank && hasJoker;
            return `<article class="s40-meld${meld.owner === seat ? ' is-mine' : ''}">
                <div class="s40-meld-cards">${meld.cards.map(card => cardFace(card, { mini: true })).join('')}</div>
                <div class="s40-meld-meta">
                    <small>${meld.owner === seat ? 'TU' : rival} · ${meld.type === 'run' ? 'SCALA' : 'TRIS'} · ${meld.points}</small>
                    <span class="s40-meld-actions">
                        <button type="button" data-attach="${state.melds.indexOf(meld)}" ${attach ? '' : 'disabled'}>Attacca</button>
                        ${hasJoker ? `<button type="button" data-replace="${state.melds.indexOf(meld)}" ${replace ? '' : 'disabled'}>Jolly</button>` : ''}
                    </span>
                </div>
            </article>`;
        };

        const badge = opened => `<span class="s40-badge ${opened ? 'is-open' : 'is-closed'}">${opened ? 'APERTO' : 'CHIUSO'}</span>`;

        view.innerHTML = `
        <header class="s40-header">
            <button type="button" class="s40-button s40-exit" data-s40="exit">← <span>Giochi di carte</span></button>
            <div class="s40-brand"><span aria-hidden="true">♣</span><div><small>LA TAVERNA</small><h1>SCALA 40</h1></div></div>
            <div class="s40-actions">
                <button type="button" class="s40-button" data-s40="help" aria-label="Come si gioca">?</button>
                <button type="button" class="s40-button" data-s40="restart" aria-label="Nuova smazzata" ${online.onlineMode ? 'hidden' : ''}>↻</button>
            </div>
        </header>
        <section class="s40-scoreboard" aria-label="Stato della smazzata">
            <div class="s40-score">
                <small>${rival}</small>
                <strong>${state.hands[target].length} <span>carte</span></strong>
                <span>${badge(state.opened[target])} · ${opponentMeldPoints(rivalMelds)} punti</span>
            </div>
            <div class="s40-turn${state.turn === seat ? '' : ' is-opponent'}">
                <b>${ended ? 'SMAZZATA CONCLUSA' : state.turn === seat ? 'TOCCA A TE' : `${rival} GIOCA`}</b>
                <small>${ended ? `${state.turns} Turni` : state.phase === 'draw' ? 'PESCA' : 'CALA O SCARTA'}</small>
            </div>
            <div class="s40-score">
                <small>TU</small>
                <strong>${hand.length} <span>carte</span></strong>
                <span>${badge(state.opened[seat])} · ${opponentMeldPoints(myMelds)} punti</span>
            </div>
        </section>
        <main class="s40-table" aria-label="Tavolo da gioco">
            <div class="s40-opponent">
                <div class="s40-opponent-copy">
                    <b>${rival}</b>
                    <small>${state.hands[target].length} carte in mano · ${state.opened[target] ? 'tavolo aperto' : 'non ha ancora aperto'}</small>
                </div>
                <div class="s40-opponent-hand" aria-hidden="true">${Array.from({ length: Math.min(state.hands[target].length, 7) }, () => cardBack(true)).join('')}</div>
            </div>
            <div class="s40-table-center">
                <div class="s40-melds">
                    ${state.melds.length
                        ? state.melds.map(renderMeld).join('')
                        : '<div class="s40-empty-melds"><span aria-hidden="true">♦</span><p>Nessuna combinazione sul tavolo</p></div>'}
                </div>
                <div class="s40-piles">
                    <div class="s40-pile">
                        <small>MAZZO</small>
                        <button type="button" data-s40="stock" aria-label="Pesca dal mazzo, ${state.stock.length} carte rimaste" ${canPlay && state.phase === 'draw' ? '' : 'disabled'}>
                            ${state.stock.length ? cardBack() : '<span class="s40-card is-slot" aria-hidden="true"><span>↻</span></span>'}
                            ${state.stock.length ? `<span class="s40-stock-count">${state.stock.length}</span>` : ''}
                        </button>
                    </div>
                    <div class="s40-pile">
                        <small>SCARTI</small>
                        ${discardTop
                            ? `<button type="button" data-s40="waste" aria-label="Raccogli ${esc(label(discardTop))}" ${canPlay && state.phase === 'draw' && state.opened[seat] ? '' : 'disabled'}>${cardFace(discardTop)}</button>`
                            : '<span class="s40-card is-slot" aria-hidden="true"><span>·</span><small>VUOTO</small></span>'}
                    </div>
                </div>
            </div>
            <div class="s40-status-area">
                <p class="s40-status" role="status">${esc(message)}</p>
                <p class="s40-hint">${ended
                    ? 'La smazzata è chiusa: guarda i punti rimasti e riprova.'
                    : canPlay
                        ? state.phase === 'draw'
                            ? 'Pesca dal mazzo, oppure raccogli lo scarto se hai già aperto.'
                            : 'Seleziona le carte in mano, poi scegli l’azione.'
                        : `Attendi: gioca ${state.turn === seat ? 'tu' : rival.toLowerCase()}.`}</p>
            </div>
        </main>
        <section class="s40-player" aria-label="La tua mano">
            <div class="s40-hand-label">LA TUA MANO <span>${hand.length} carte · ${state.opened[seat] ? 'tavolo aperto' : 'da aprire'}</span></div>
            <div class="s40-hand">
                ${[...hand].sort((a, b) => a.suit - b.suit || a.rank - b.rank).map(card => cardFace(card, {
                    tag: 'button',
                    extra: `${state.mustPlay.includes(card.id) ? ' is-required' : ''}`,
                    attrs: `data-card="${card.id}" aria-pressed="${selected.has(card.id)}" ${canPlay && state.phase === 'play' ? '' : 'disabled'}`
                })).join('')}
            </div>
            ${state.staged.length ? `<div class="s40-staged">
                <div class="s40-staged-head"><span>APERTURA PREPARATA <b>${stagedPoints}/40</b></span><span>${state.staged.length} combinazion${state.staged.length === 1 ? 'e' : 'i'}</span></div>
                <div class="s40-progress" aria-hidden="true"><i style="width:${Math.min(100, Math.round(stagedPoints / 40 * 100))}%"></i></div>
                <div class="s40-staged-list">${state.staged.map(meld => `<div class="s40-staged-meld">${meld.cards.map(card => cardFace(card, { mini: true })).join('')}<span>${meld.points} pt</span></div>`).join('')}</div>
            </div>` : ''}
            <div class="s40-dock">
                <button type="button" class="s40-button" data-s40="stock" ${canPlay && state.phase === 'draw' ? '' : 'disabled'}>Pesca dal mazzo (${state.stock.length})</button>
                <button type="button" class="s40-button" data-s40="waste" ${canPlay && state.phase === 'draw' && state.opened[seat] ? '' : 'disabled'}>Raccogli ${discardTop ? esc(label(discardTop)) : '—'}</button>
                <button type="button" class="s40-button" data-s40="meld" ${canPlay && selected.size >= 3 ? '' : 'disabled'}>${state.opened[seat] ? 'Cala' : 'Prepara'} combinazione</button>
                <button type="button" class="s40-button" data-s40="discard" ${canPlay && selected.size === 1 && !state.staged.length ? '' : 'disabled'}>Scarta</button>
                ${state.staged.length ? `<button type="button" class="s40-button${stagedPoints >= 40 ? ' is-primary' : ''}" data-s40="open" ${stagedPoints >= 40 ? '' : 'disabled'}>Conferma apertura</button>
                <button type="button" class="s40-button" data-s40="cancel">Riprendi le carte</button>` : ''}
            </div>
        </section>
        ${ended ? `<div class="s40-overlay">
            <section class="s40-panel" role="dialog" aria-modal="true" aria-labelledby="s40-result-title">
                <span class="s40-eyebrow">SMAZZATA CONCLUSA</span>
                <h2 id="s40-result-title">${state.winner === 'draw' ? 'Tavolo bloccato' : state.winner === seat ? 'Hai chiuso la smazzata!' : `Chiude ${rival.toLowerCase()}`}</h2>
                <div class="s40-result-scores">
                    <div><small>TU</small><strong>${handPoints(hand)}</strong><em>punti rimasti in mano</em></div>
                    <div><small>${rival}</small><strong>${handPoints(state.hands[target])}</strong><em>punti rimasti in mano</em></div>
                </div>
                <p>${state.winner === 'draw' ? 'Nessuno è riuscito a chiudere: la smazzata si chiude senza vincitore.' : state.winner === seat ? 'Sei rimasto senza carte: gli avversari sommano i punti delle carte che hanno ancora in mano.' : 'L’avversario è rimasto senza carte: sommi i punti delle carte che hai ancora in mano.'}</p>
                ${renderMinigameRecordLine('scala40') ? `<p class="s40-record">${esc(renderMinigameRecordLine('scala40'))}</p>` : ''}
                <div class="s40-actions-row">
                    ${online.onlineMode ? '' : '<button type="button" class="s40-button is-primary" data-s40="again">NUOVA SMAZZATA</button>'}
                    <button type="button" class="s40-button" data-s40="exit">TORNA AI GIOCHI DI CARTE</button>
                </div>
            </section>
        </div>` : ''}`;

        const actions = {
            exit: () => navigateTo('minigames', container, { filter: 'cards' }),
            help: () => setHelp(true),
            'help-close': () => setHelp(false),
            restart: restart,
            again: restart,
            stock: () => play({ type: 'draw' }),
            waste: () => play({ type: 'draw', source: 'discard' }),
            meld: () => play({ type: 'meld', ids: [...selected] }),
            discard: () => play({ type: 'discard', id: [...selected][0] }),
            open: () => play({ type: 'open' }),
            cancel: () => play({ type: 'cancel' })
        };
        view.querySelectorAll('[data-s40]').forEach(button => {
            const handler = actions[button.dataset.s40];
            if (handler) button.onclick = handler;
        });
        view.querySelectorAll('[data-card]').forEach(button => {
            button.onclick = () => {
                const id = button.dataset.card;
                if (selected.has(id)) selected.delete(id);
                else selected.add(id);
                render();
            };
        });
        view.querySelectorAll('[data-attach]').forEach(button => {
            button.onclick = () => play({ type: 'attach', index: Number(button.dataset.attach), ids: [...selected] });
        });
        view.querySelectorAll('[data-replace]').forEach(button => {
            button.onclick = () => play({ type: 'replace', index: Number(button.dataset.replace), ids: [...selected] });
        });
    }

    window.__communityCleanup = () => { disposed = true; clearTimeout(timer); stopOnline?.(); };
    render();

    stopOnline = bindOnlineModeButton(container, {
        gameId: 'scala40', gameName: 'Scala quaranta', maxPlayers: 2,
        onConnected: room => {
            clearTimeout(timer);
            online.onlineMode = true;
            state = newScala40();
            selected.clear();
            shell.querySelector('.minigame-online-mode-panel').hidden = true;
            const statusLine = shell.querySelector('#scala40-online-status');
            if (statusLine) statusLine.hidden = true;
            return connectOnlineGame(container, online, {
                gameId: 'scala40', room,
                read: () => state,
                apply: (next, mySeat) => {
                    state = next;
                    seat = mySeat;
                    selected.clear();
                    message = state.winner !== null ? 'Smazzata conclusa.' : state.turn === seat ? 'Tocca a te.' : 'Attendi l’avversario.';
                    render();
                },
                onStatus: () => render()
            });
        }
    });
}
