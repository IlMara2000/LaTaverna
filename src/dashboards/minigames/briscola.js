import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { getLevelDifficultyChance, unlockNextLevel, renderLevelLadder } from '../../services/levels.js';
import { bindOnlineModeButton, renderOnlineModeButton } from './onlineModeButton.js';
import './briscola.css';

const SUITS = [
    { id: 'bastoni', name: 'Bastoni', icon: '♣', color: '#2f966a' },
    { id: 'coppe', name: 'Coppe', icon: '⚱', color: '#bd3d68' },
    { id: 'denari', name: 'Denari', icon: '◆', color: '#c48c20' },
    { id: 'spade', name: 'Spade', icon: '⚔', color: '#397ead' }
];

const VALUES = [
    { name: 'Asso', label: 'A', points: 11, rank: 10 },
    { name: '3', label: '3', points: 10, rank: 9 },
    { name: 'Re', label: 'R', points: 4, rank: 8, figure: 'RE' },
    { name: 'Cavallo', label: 'C', points: 3, rank: 7, figure: 'CAVALLO' },
    { name: 'Fante', label: 'F', points: 2, rank: 6, figure: 'FANTE' },
    { name: '7', label: '7', points: 0, rank: 5 },
    { name: '6', label: '6', points: 0, rank: 4 },
    { name: '5', label: '5', points: 0, rank: 3 },
    { name: '4', label: '4', points: 0, rank: 2 },
    { name: '2', label: '2', points: 0, rank: 1 }
];

const createState = () => ({
    deck: [],
    players: [[], []],
    table: [],
    briscola: null,
    lastBriscolaSuit: null,
    turn: 0,
    scores: [0, 0],
    tricks: 0,
    currentLevel: 1,
    gameActive: false,
    gameOver: false,
    isAnimating: false,
    onlineMode: false,
    onlineRoom: null,
    message: '',
    timers: new Set(),
    cleanup: []
});

export function initBriscola(container) {
    if (!container) return;
    try { updateSidebarContext('minigames'); } catch { /* sidebar opzionale */ }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#05010a';

    const state = createState();
    container.innerHTML = renderLayout();

    const cleanupOnlineMode = bindOnlineModeButton(container, {
        gameId: 'briscola',
        gameName: 'Briscola',
        onConnected: room => {
            state.onlineMode = true;
            state.onlineRoom = room;
            state.currentLevel = 1;
            startMatch(container, state);
        }
    });

    const chooseLevel = selectedLevel => {
        cleanupOnlineMode();
        state.onlineMode = false;
        state.onlineRoom = null;
        state.currentLevel = selectedLevel;
        startMatch(container, state);
    };

    renderLevelLadder(
        'briscola',
        container.querySelector('#briscola-levels'),
        chooseLevel,
        false,
        { windowSize: 2 }
    );

    const leaveGame = () => quitGame(container, state, cleanupOnlineMode);
    container.querySelector('#briscola-exit-menu').onclick = leaveGame;
    container.querySelector('#briscola-exit').onclick = leaveGame;
    container.querySelector('#briscola-help').onclick = () => showHelp(container);
    container.querySelector('#briscola-restart').onclick = () => startMatch(container, state);
    container.querySelector('#briscola-modal-close').onclick = () => hideModal(container);
    container.querySelector('#briscola-modal-primary').onclick = () => {
        hideModal(container);
        startMatch(container, state);
    };
    container.querySelector('#briscola-modal-levels').onclick = () => {
        clearRuntime(state);
        cleanupOnlineMode();
        initBriscola(container);
    };
    container.querySelector('#briscola-modal-exit').onclick = leaveGame;

    const keyHandler = event => {
        if (event.key !== 'Escape') return;
        const modal = container.querySelector('#briscola-modal');
        if (modal && !modal.hidden && !state.gameOver) hideModal(container);
    };
    window.addEventListener('keydown', keyHandler);
    state.cleanup.push(() => window.removeEventListener('keydown', keyHandler));
}

function renderLayout() {
    return `
        <div class="game-master-wrapper briscola-game fade-in">
            <section id="briscola-start" class="briscola-start" aria-labelledby="briscola-title">
                <div class="briscola-start-emblem" aria-hidden="true"><span>♣</span><span>◆</span></div>
                <span class="briscola-eyebrow">CARTE ITALIANE · 120 PUNTI</span>
                <h1 id="briscola-title" class="main-title">BRISCOLA</h1>
                <p>Conquista le prese, custodisci le carte forti e arriva per primo a 61.</p>
                ${renderOnlineModeButton('briscola')}
                <section class="briscola-level-select" aria-label="Livelli contro il bot">
                    <span>CONTRO IL BOT</span>
                    <div id="briscola-levels"></div>
                </section>
                <button id="briscola-exit-menu" class="briscola-text-button" type="button">TORNA ALLA TAVERNA</button>
            </section>

            <div class="briscola-shell" hidden aria-label="Tavolo di Briscola">
                <header class="briscola-topbar">
                    <button id="briscola-exit" class="briscola-icon-button briscola-exit-button" type="button" aria-label="Esci dalla Briscola">← <span>ESCI</span></button>
                    <div class="briscola-brand">
                        <span class="briscola-brand-mark" aria-hidden="true">♣</span>
                        <span><small>LA TAVERNA PRESENTA</small><strong>BRISCOLA</strong></span>
                    </div>
                    <div class="briscola-top-actions">
                        <button id="briscola-help" class="briscola-icon-button" type="button" aria-label="Come si gioca">?</button>
                        <button id="briscola-restart" class="briscola-icon-button" type="button" aria-label="Ricomincia la partita">↻</button>
                    </div>
                </header>

                <section class="briscola-scoreboard" aria-label="Punteggio partita">
                    <article class="briscola-score briscola-score-player">
                        <span><small>TU</small><strong id="briscola-player-score">0</strong></span>
                        <div class="briscola-score-track"><i id="briscola-player-progress"></i></div>
                    </article>
                    <div class="briscola-round-status">
                        <small id="briscola-tricks">PRESA 1 DI 20</small>
                        <strong id="briscola-status" aria-live="polite">TOCCA A TE</strong>
                    </div>
                    <article class="briscola-score briscola-score-bot">
                        <span><small id="briscola-opponent-label">BOT · LV.1</small><strong id="briscola-bot-score">0</strong></span>
                        <div class="briscola-score-track"><i id="briscola-bot-progress"></i></div>
                    </article>
                </section>

                <main class="briscola-table">
                    <div class="briscola-felt-ornament" aria-hidden="true"></div>

                    <section class="briscola-seat briscola-bot-seat" aria-label="Mano avversaria">
                        <span class="briscola-seat-label"><i></i><b id="briscola-bot-name">OSTE</b></span>
                        <div id="briscola-bot-hand" class="briscola-hand briscola-hand-bot"></div>
                    </section>

                    <section class="briscola-stock-zone" aria-label="Tallone e carta di briscola">
                        <div class="briscola-stock-copy">
                            <small>TALLONE</small>
                            <strong id="briscola-deck-count">34</strong>
                        </div>
                        <div class="briscola-stock-cards">
                            <div id="briscola-trump-card" class="briscola-trump-card"></div>
                            <div id="briscola-deck" class="briscola-card briscola-card-back" aria-hidden="true"></div>
                        </div>
                    </section>

                    <section class="briscola-trick-zone" aria-label="Presa corrente">
                        <div id="briscola-table-cards" class="briscola-trick-cards">
                            <span class="briscola-empty-trick">LA PROSSIMA PRESA INIZIA QUI</span>
                        </div>
                        <div id="briscola-trump-label" class="briscola-trump-label">BRISCOLA · —</div>
                    </section>

                    <section class="briscola-seat briscola-player-seat" aria-label="La tua mano">
                        <span class="briscola-seat-label"><i></i><b>LA TUA MANO</b></span>
                        <div id="briscola-player-hand" class="briscola-hand briscola-hand-player"></div>
                    </section>
                </main>
            </div>

            <section id="briscola-modal" class="briscola-modal" hidden aria-modal="true" role="dialog" aria-labelledby="briscola-modal-title">
                <div class="briscola-modal-card">
                    <button id="briscola-modal-close" class="briscola-modal-close" type="button" aria-label="Chiudi">×</button>
                    <span id="briscola-modal-eyebrow" class="briscola-eyebrow">REGOLE RAPIDE</span>
                    <h2 id="briscola-modal-title">COME SI GIOCA</h2>
                    <div id="briscola-modal-copy" class="briscola-modal-copy"></div>
                    <div id="briscola-final-score" class="briscola-final-score" hidden></div>
                    <div class="briscola-modal-actions">
                        <button id="briscola-modal-primary" type="button">GIOCA ANCORA</button>
                        <button id="briscola-modal-levels" type="button">CAMBIA LIVELLO</button>
                        <button id="briscola-modal-exit" type="button">ESCI</button>
                    </div>
                </div>
            </section>
        </div>
    `;
}

function createDeck() {
    const deck = SUITS.flatMap(suit => VALUES.map(value => ({ suit: suit.id, ...value })));
    for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function startMatch(container, state) {
    clearTimers(state);
    state.deck = createDeck();
    state.players = [[], []];
    state.table = [];
    state.scores = [0, 0];
    state.tricks = 0;
    state.turn = 0;
    state.gameActive = true;
    state.gameOver = false;
    state.isAnimating = false;
    state.message = '';

    for (let i = 0; i < 3; i += 1) {
        state.players[0].push(state.deck.pop());
        state.players[1].push(state.deck.pop());
    }
    state.briscola = state.deck.pop();
    state.lastBriscolaSuit = state.briscola.suit;

    container.querySelector('#briscola-start').hidden = true;
    container.querySelector('.briscola-shell').hidden = false;
    hideModal(container);
    updateUI(container, state);
}

function getSuit(cardOrId) {
    const id = typeof cardOrId === 'string' ? cardOrId : cardOrId?.suit;
    return SUITS.find(suit => suit.id === id) || SUITS[0];
}

function cardLabel(card) {
    const suit = getSuit(card);
    return `${card.name} di ${suit.name}${card.points ? `, ${card.points} punti` : ''}`;
}

function renderCardInner(card) {
    const suit = getSuit(card);
    const middle = card.figure
        ? `<span class="briscola-figure"><small>${card.figure}</small><b>${suit.icon}</b></span>`
        : `<span class="briscola-card-center-symbol">${suit.icon}<small>${card.name}</small></span>`;
    return `
        <span class="briscola-card-corner"><b>${card.label}</b><i>${suit.icon}</i></span>
        ${middle}
        <span class="briscola-card-corner briscola-card-corner-bottom"><b>${card.label}</b><i>${suit.icon}</i></span>
        <span class="briscola-card-suit-name">${suit.name}</span>
    `;
}

function renderFaceCard(card, extraClass = '') {
    const suit = getSuit(card);
    return `<div class="briscola-card briscola-card-face suit-${suit.id} ${extraClass}" style="--suit-color:${suit.color}">${renderCardInner(card)}</div>`;
}

function updateUI(container, state) {
    if (!state.gameActive && !state.gameOver) return;
    const playerScore = container.querySelector('#briscola-player-score');
    const botScore = container.querySelector('#briscola-bot-score');
    playerScore.textContent = state.scores[0];
    botScore.textContent = state.scores[1];
    container.querySelector('#briscola-player-progress').style.width = `${Math.min(100, state.scores[0] / 61 * 100)}%`;
    container.querySelector('#briscola-bot-progress').style.width = `${Math.min(100, state.scores[1] / 61 * 100)}%`;
    container.querySelector('#briscola-tricks').textContent = `PRESA ${Math.min(20, state.tricks + 1)} DI 20`;
    container.querySelector('#briscola-status').textContent = state.message || getStatusCopy(state);
    container.querySelector('#briscola-opponent-label').textContent = state.onlineMode
        ? 'AVVERSARIO ONLINE'
        : `BOT · LV.${state.currentLevel}`;
    container.querySelector('#briscola-bot-name').textContent = state.onlineMode ? 'AVVERSARIO' : 'OSTE';

    const remainingCards = state.deck.length + (state.briscola ? 1 : 0);
    container.querySelector('#briscola-deck-count').textContent = remainingCards;
    container.querySelector('#briscola-deck').classList.toggle('is-empty', state.deck.length === 0);

    const trumpSuit = getSuit(state.lastBriscolaSuit);
    container.querySelector('#briscola-trump-label').innerHTML = `BRISCOLA <span style="--suit-color:${trumpSuit.color}">${trumpSuit.icon} ${trumpSuit.name}</span>`;
    container.querySelector('#briscola-trump-card').innerHTML = state.briscola
        ? renderFaceCard(state.briscola, 'briscola-card-trump')
        : '<span class="briscola-trump-gone">ULTIMA CARTA PESCATA</span>';

    const botHand = container.querySelector('#briscola-bot-hand');
    botHand.innerHTML = state.players[1]
        .map((_, index) => `<div class="briscola-card briscola-card-back" style="--card-index:${index}" aria-hidden="true"></div>`)
        .join('');

    const playerHand = container.querySelector('#briscola-player-hand');
    playerHand.innerHTML = state.players[0].map((card, index) => {
        const suit = getSuit(card);
        const disabled = state.turn !== 0 || state.isAnimating || !state.gameActive;
        return `
            <button class="briscola-card briscola-card-face suit-${suit.id}" style="--suit-color:${suit.color};--card-index:${index}" data-card-index="${index}" type="button" aria-label="Gioca ${cardLabel(card)}" ${disabled ? 'disabled' : ''}>
                ${renderCardInner(card)}
            </button>
        `;
    }).join('');
    playerHand.querySelectorAll('[data-card-index]').forEach(button => {
        button.onclick = () => playCard(container, state, Number(button.dataset.cardIndex), 0);
    });

    const tableCards = container.querySelector('#briscola-table-cards');
    tableCards.innerHTML = state.table.length
        ? state.table.map((entry, index) => `
            <div class="briscola-played-card ${entry.owner === 0 ? 'from-player' : 'from-bot'}" data-order="${index}">
                ${renderFaceCard(entry.card)}
                <small>${entry.owner === 0 ? 'TU' : (state.onlineMode ? 'ONLINE' : 'OSTE')}</small>
            </div>
        `).join('')
        : '<span class="briscola-empty-trick">LA PROSSIMA PRESA INIZIA QUI</span>';
}

function getStatusCopy(state) {
    if (state.gameOver) return 'PARTITA CONCLUSA';
    if (state.isAnimating) return 'CARTE IN MOVIMENTO';
    if (state.turn === 0) return 'TOCCA A TE';
    return state.onlineMode ? 'TURNO AVVERSARIO' : 'L’OSTE STA PENSANDO';
}

async function playCard(container, state, index, owner) {
    if (!state.gameActive || state.isAnimating || state.turn !== owner || !state.players[owner][index]) return;
    state.isAnimating = true;
    state.message = owner === 0 ? 'CARTA GIOCATA' : 'L’OSTE GIOCA';
    updateUI(container, state);

    const card = state.players[owner][index];
    const source = owner === 0
        ? container.querySelector(`[data-card-index="${index}"]`)
        : container.querySelector('#briscola-bot-hand .briscola-card:last-child');
    const target = container.querySelector('#briscola-table-cards');
    await animateCardMove(source, target, card, owner === 1, state);

    const playedCard = state.players[owner].splice(index, 1)[0];
    state.table.push({ card: playedCard, owner });
    state.message = '';
    updateUI(container, state);

    if (state.table.length === 2) {
        schedule(state, () => resolveRound(container, state), 650);
        return;
    }

    state.turn = 1 - owner;
    state.isAnimating = false;
    updateUI(container, state);
    if (state.turn === 1) schedule(state, () => playBot(container, state), 700);
}

function playBot(container, state) {
    if (!state.gameActive || state.turn !== 1 || state.isAnimating || !state.players[1].length) return;
    const index = chooseBotCard(state);
    playCard(container, state, index, 1);
}

function chooseBotCard(state) {
    const hand = state.players[1];
    const accuracy = getLevelDifficultyChance(state.currentLevel, 0.46, 0.98);
    if (Math.random() > accuracy) return Math.floor(Math.random() * hand.length);

    const trump = state.lastBriscolaSuit;
    const utility = card => card.points * 3 + card.rank + (card.suit === trump ? 18 : 0);
    const indexed = hand.map((card, index) => ({ card, index }));

    if (!state.table.length) {
        return indexed.sort((a, b) => utility(a.card) - utility(b.card))[0].index;
    }

    const lead = state.table[0].card;
    const winning = indexed
        .filter(entry => cardBeats(entry.card, lead, trump))
        .sort((a, b) => utility(a.card) - utility(b.card));
    const pointsAtStake = lead.points;
    if (winning.length && (pointsAtStake >= 2 || winning[0].card.points <= 2)) return winning[0].index;
    return indexed.sort((a, b) => utility(a.card) - utility(b.card))[0].index;
}

function cardBeats(challenger, lead, trumpSuit) {
    if (challenger.suit === lead.suit) return challenger.rank > lead.rank;
    return challenger.suit === trumpSuit && lead.suit !== trumpSuit;
}

function resolveRound(container, state) {
    if (!state.gameActive || state.table.length !== 2) return;
    const [first, second] = state.table;
    const winner = cardBeats(second.card, first.card, state.lastBriscolaSuit) ? second.owner : first.owner;
    const trickPoints = first.card.points + second.card.points;
    state.scores[winner] += trickPoints;
    state.tricks += 1;
    state.turn = winner;
    state.message = winner === 0
        ? `PRESA TUA${trickPoints ? ` · +${trickPoints}` : ''}`
        : `${state.onlineMode ? 'AVVERSARIO' : 'OSTE'} PRENDE${trickPoints ? ` · +${trickPoints}` : ''}`;
    updateUI(container, state);

    schedule(state, () => {
        state.table = [];
        drawAfterRound(state, winner);

        if (!state.players[0].length && !state.players[1].length && !state.deck.length && !state.briscola) {
            finishMatch(container, state);
            return;
        }

        state.message = '';
        state.isAnimating = false;
        updateUI(container, state);
        if (state.turn === 1) schedule(state, () => playBot(container, state), 700);
    }, 900);
}

function drawAfterRound(state, winner) {
    const other = 1 - winner;
    if (state.deck.length) state.players[winner].push(state.deck.pop());
    else if (state.briscola) {
        state.players[winner].push(state.briscola);
        state.briscola = null;
    }

    if (state.deck.length) state.players[other].push(state.deck.pop());
    else if (state.briscola) {
        state.players[other].push(state.briscola);
        state.briscola = null;
    }
}

function finishMatch(container, state) {
    state.gameActive = false;
    state.gameOver = true;
    state.isAnimating = false;
    state.message = 'PARTITA CONCLUSA';
    const won = state.scores[0] > state.scores[1];
    const draw = state.scores[0] === state.scores[1];
    if (won && !state.onlineMode) unlockNextLevel('briscola', state.currentLevel);
    updateUI(container, state);

    const eyebrow = container.querySelector('#briscola-modal-eyebrow');
    const title = container.querySelector('#briscola-modal-title');
    const copy = container.querySelector('#briscola-modal-copy');
    eyebrow.textContent = won ? 'VITTORIA' : (draw ? 'PAREGGIO' : 'SCONFITTA');
    title.textContent = won ? 'LA PRESA È TUA' : (draw ? 'SESSANTA PARI' : 'L’OSTE HA VINTO');
    copy.innerHTML = won
        ? '<p>Hai amministrato meglio le carte forti. Il livello successivo è ora disponibile.</p>'
        : (draw
            ? '<p>Una partita perfettamente equilibrata. Serve una vittoria per sbloccare il livello successivo.</p>'
            : '<p>L’Oste ha custodito meglio le briscole. Puoi chiedere subito la rivincita.</p>');
    const finalScore = container.querySelector('#briscola-final-score');
    finalScore.hidden = false;
    finalScore.innerHTML = `<span><small>TU</small><strong>${state.scores[0]}</strong></span><i>—</i><span><small>${state.onlineMode ? 'ONLINE' : 'OSTE'}</small><strong>${state.scores[1]}</strong></span>`;
    container.querySelector('#briscola-modal-close').hidden = true;
    container.querySelector('#briscola-modal-primary').hidden = false;
    container.querySelector('#briscola-modal-levels').hidden = false;
    container.querySelector('#briscola-modal-exit').hidden = false;
    container.querySelector('#briscola-modal').hidden = false;
}

function showHelp(container) {
    container.querySelector('#briscola-modal-eyebrow').textContent = 'REGOLE RAPIDE';
    container.querySelector('#briscola-modal-title').textContent = 'COME SI GIOCA';
    container.querySelector('#briscola-modal-copy').innerHTML = `
        <ol class="briscola-rules">
            <li><b>Gioca una carta.</b><span>Non devi per forza rispondere allo stesso seme.</span></li>
            <li><b>Vince la carta più alta del seme d’apertura.</b><span>Una briscola batte qualsiasi altro seme.</span></li>
            <li><b>Chi prende pesca per primo e apre la presa dopo.</b><span>Asso e Tre valgono più di tutte le altre carte.</span></li>
            <li><b>Obiettivo: 61 punti.</b><span>Nel mazzo ce ne sono 120 in totale.</span></li>
        </ol>
    `;
    container.querySelector('#briscola-final-score').hidden = true;
    container.querySelector('#briscola-modal-close').hidden = false;
    container.querySelector('#briscola-modal-primary').hidden = true;
    container.querySelector('#briscola-modal-levels').hidden = true;
    container.querySelector('#briscola-modal-exit').hidden = true;
    container.querySelector('#briscola-modal').hidden = false;
}

function hideModal(container) {
    const modal = container.querySelector('#briscola-modal');
    if (modal) modal.hidden = true;
}

function animateCardMove(source, target, card, isBack = false, state) {
    if (!source || !target) return Promise.resolve();
    const start = source.getBoundingClientRect();
    const end = target.getBoundingClientRect();
    const flyer = document.createElement('div');
    const suit = getSuit(card);
    flyer.className = `briscola-card briscola-flying-card ${isBack ? 'briscola-card-back' : `briscola-card-face suit-${suit.id}`}`;
    flyer.style.setProperty('--suit-color', suit.color);
    flyer.style.left = `${start.left}px`;
    flyer.style.top = `${start.top}px`;
    flyer.innerHTML = isBack ? '' : renderCardInner(card);
    document.body.appendChild(flyer);

    return new Promise(resolve => {
        requestAnimationFrame(() => {
            flyer.style.left = `${end.left + end.width / 2 - start.width / 2}px`;
            flyer.style.top = `${end.top + end.height / 2 - start.height / 2}px`;
            flyer.style.transform = `rotate(${isBack ? 5 : -4}deg) scale(.96)`;
            flyer.style.opacity = '0.92';
        });
        schedule(state, () => {
            flyer.remove();
            resolve();
        }, 420);
    });
}

function schedule(state, callback, delay) {
    const timer = window.setTimeout(() => {
        state.timers.delete(timer);
        callback();
    }, delay);
    state.timers.add(timer);
    return timer;
}

function clearTimers(state) {
    state.timers.forEach(timer => window.clearTimeout(timer));
    state.timers.clear();
    document.querySelectorAll('.briscola-flying-card').forEach(card => card.remove());
}

function clearRuntime(state) {
    clearTimers(state);
    state.cleanup.forEach(cleanup => cleanup());
    state.cleanup = [];
    state.gameActive = false;
}

async function quitGame(container, state, cleanupOnlineMode) {
    clearRuntime(state);
    cleanupOnlineMode();
    document.documentElement.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.overflow = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch {
        window.location.reload();
    }
}
