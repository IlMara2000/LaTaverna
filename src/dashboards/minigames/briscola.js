import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { getUnlockedLevel, unlockNextLevel, renderLevelLadder } from '../../services/levels.js';

/**
 * GIOCO: BRISCOLA - MASTER EDITION
 * Integrazione UI, Matte Black Cards, e Livelli Infiniti
 */

export function initBriscola(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#05010a';

    const SUITS = [
        { id: 'bastoni', icon: '🪵', color: '#00ffa3' },
        { id: 'coppe', icon: '🏆', color: '#ff416c' },
        { id: 'denari', icon: '💰', color: '#ffbd39' },
        { id: 'spade', icon: '⚔️', color: '#00d2ff' }
    ];

    const VALUES = [
        { name: 'Asso', points: 11, rank: 10 }, { name: '3', points: 10, rank: 9 },
        { name: 'Re', points: 4, rank: 8 }, { name: 'Cavallo', points: 3, rank: 7 },
        { name: 'Fante', points: 2, rank: 6 }, { name: '7', points: 0, rank: 5 },
        { name: '6', points: 0, rank: 4 }, { name: '5', points: 0, rank: 3 },
        { name: '4', points: 0, rank: 2 }, { name: '2', points: 0, rank: 1 }
    ];

    let state = {
        deck: [], players: [[], []], table: [],
        briscola: null, turn: 0, scores: [0, 0],
        gameActive: false, isAnimating: false,
        currentLevel: 1 // Verrà settato dal menu
    };

    container.innerHTML = `
    <div class="game-master-wrapper fade-in">
        
        <div id="start-screen" class="game-master-wrapper" style="position: absolute; inset: 0; z-index: 10000; justify-content: center; background: #05010a;">
            <img src="/assets/logo.png" style="width: 100px; margin-bottom: 25px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 10px;">BRISCOLA</h1>
            <p style="color: var(--amethyst-light); font-size: 11px; font-weight: 800; letter-spacing: 2px; margin-bottom: 30px;">SELEZIONA IL LIVELLO</p>
            
            <div id="levels-container" style="display: flex; flex-direction: column; width: 100%; max-width: 280px; max-height: 250px; overflow-y: auto; padding: 10px; margin-bottom: 20px;">
                </div>

            <button id="exit-btn" class="game-btn-action" style="background: transparent; border: none; opacity: 0.6;">TORNA ALLA TAVERNA</button>
        </div>

        <header class="game-master-header">
            <button id="btn-ingame-exit" class="game-btn-action" style="padding: 10px 20px;">← ESCI</button>
            <div class="game-score-widget">
                <span style="color: #00ffa3;">TU: <b id="p0-score">0</b></span>
                <span style="color: #ff416c;" id="bot-label">BOT: <b id="p1-score">0</b></span>
            </div>
        </header>

        <div id="bot-hand" class="game-player-hand" style="opacity: 0.8; transform: scale(0.85); margin-bottom: auto; gap: -5px;"></div>

        <main class="game-master-table">
            <div id="table-cards" style="display: flex; gap: 20px; align-items: center; justify-content: center; height: 160px; width: 100%;"></div>
            
            <div style="position: absolute; right: 0; display: flex; flex-direction: column; align-items: center;">
                <div id="deck-count" style="font-size: 11px; opacity: 0.5; font-weight: 800; margin-bottom: 5px; letter-spacing: 1px;">CARTE: 40</div>
                <div id="main-deck-visual" class="game-card-unit back" style="transform: scale(0.65); margin-top: -10px;"></div>
                <div id="briscola-card-visual" style="transform: rotate(90deg) scale(0.75); margin-top: -30px; z-index: -1;"></div>
            </div>
        </main>

        <footer id="player-hand" class="game-player-hand" style="margin-top: auto;"></footer>

    </div>
    `;

    // Disegna la scala dei livelli
    renderLevelLadder('briscola', container.querySelector('#levels-container'), (selectedLevel) => {
        state.currentLevel = selectedLevel;
        container.querySelector('#start-screen').remove();
        container.querySelector('#bot-label').innerHTML = `BOT (LV.${state.currentLevel}): <b id="p1-score">0</b>`;
        startMatch();
    });

    const quit = async () => {
        document.body.style.touchAction = '';
        document.body.style.overflow = 'auto';
        try {
            const { showMinigamesList } = await import('../../minigamelist.js');
            showMinigamesList(document.getElementById('app') || container);
        } catch (e) { window.location.reload(); }
    };

    container.querySelector('#exit-btn').onclick = quit;
    container.querySelector('#btn-ingame-exit').onclick = quit;

    // Generatore dell'interno della carta (Minimal + Emoji separate)
    const renderCardInner = (c) => {
        if (!c) return '';
        const suit = SUITS.find(s => s.id === c.suit);
        let val = c.name === 'Asso' ? 'A' : (c.name === 'Re' ? 'R' : (c.name === 'Cavallo' ? 'C' : (c.name === 'Fante' ? 'F' : c.name)));
        let faceEmoji = '';
        if (c.name === 'Re') faceEmoji = '👑';
        else if (c.name === 'Cavallo') faceEmoji = '🐎';
        else if (c.name === 'Fante') faceEmoji = '💂';
        const centerIcon = faceEmoji ? faceEmoji : suit.icon;

        return `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="align-self: flex-start; display: flex; align-items: center; gap: 3px; font-size: 1rem; line-height: 1;">
                    <span>${val}</span><span style="font-size: 0.8rem;">${suit.icon}</span>
                </div>
                <div style="align-self: center; font-size: 2.2rem; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
                    ${centerIcon}
                </div>
                <div style="align-self: flex-end; display: flex; align-items: center; gap: 3px; font-size: 1rem; line-height: 1; transform: rotate(180deg);">
                    <span>${val}</span><span style="font-size: 0.8rem;">${suit.icon}</span>
                </div>
            </div>
        `;
    };

    async function animateCardMove(startEl, targetEl, cardData, isBack = false) {
        return new Promise(resolve => {
            const startRect = startEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            const flyer = document.createElement('div');
            flyer.className = `game-card-unit flying-card ${isBack ? 'back' : ''}`;
            if (!isBack) flyer.innerHTML = renderCardInner(cardData);

            flyer.style.left = `${startRect.left}px`;
            flyer.style.top = `${startRect.top}px`;
            document.body.appendChild(flyer);

            requestAnimationFrame(() => {
                flyer.style.left = `${targetRect.left}px`;
                flyer.style.top = `${targetRect.top}px`;
                flyer.style.transform = `rotate(${Math.random() * 20 - 10}deg)`;
            });
            setTimeout(() => { flyer.remove(); resolve(); }, 500);
        });
    }

    const updateUI = () => {
        if (!state.gameActive) return;
        container.querySelector('#p0-score').innerText = state.scores[0];
        container.querySelector('#p1-score').innerText = state.scores[1];
        container.querySelector('#deck-count').innerText = `CARTE: ${state.deck.length}`;

        const bVis = container.querySelector('#briscola-card-visual');
        bVis.innerHTML = state.briscola ? `<div class="game-card-unit" style="border-color: var(--amethyst-bright) !important; box-shadow: 0 0 15px var(--amethyst-glow) !important;">${renderCardInner(state.briscola)}</div>` : '';

        const pHand = container.querySelector('#player-hand');
        pHand.innerHTML = state.players[0].map((c, i) => `<div class="game-card-unit" data-idx="${i}">${renderCardInner(c)}</div>`).join('');

        const bHand = container.querySelector('#bot-hand');
        bHand.innerHTML = state.players[1].map(() => `<div class="game-card-unit back"></div>`).join('');

        const tArea = container.querySelector('#table-cards');
        tArea.innerHTML = state.table.map(t => `<div class="game-card-unit" style="transform: scale(1.05);">${renderCardInner(t.card)}</div>`).join('');

        pHand.querySelectorAll('.game-card-unit').forEach(el => {
            el.onclick = () => { if(state.turn === 0 && !state.isAnimating) playCard(parseInt(el.dataset.idx), 0); };
        });
    };

    async function playCard(idx, pIdx) {
        state.isAnimating = true;
        const card = state.players[pIdx][idx];
        const startEl = pIdx === 0 ? container.querySelector(`#player-hand .game-card-unit[data-idx="${idx}"]`) : container.querySelector(`#bot-hand .game-card-unit`);
        const targetPlaceholder = document.createElement('div');
        targetPlaceholder.style.width = '80px';
        container.querySelector('#table-cards').appendChild(targetPlaceholder);

        await animateCardMove(startEl, targetPlaceholder, card, pIdx !== 0);
        targetPlaceholder.remove();

        state.table.push({ card: state.players[pIdx].splice(idx, 1)[0], owner: pIdx });
        updateUI();

        if (state.table.length === 2) {
            setTimeout(resolveRound, 800);
        } else {
            state.turn = 1 - pIdx;
            state.isAnimating = false;
            if (state.turn === 1) setTimeout(() => playBot(), 1000);
        }
    }

    // INTELIGENZA ARTIFICIALE: Incremento del 2.5% ad ogni livello
    function playBot() {
        const hand = state.players[1];
        let chosenIdx = 0;
        
        // Accuratezza: Max 90% (per non renderlo imbattibile)
        const accuracy = Math.min(0.90, state.currentLevel * 0.025);

        if (Math.random() <= accuracy) {
            // Mossa Intelligente
            if (state.table.length === 0) {
                // Primo a giocare: gioca la carta peggiore (meno rank, meno probabile briscola)
                hand.sort((a,b) => {
                    const isBriscA = a.suit === state.briscola?.suit ? 1 : 0;
                    const isBriscB = b.suit === state.briscola?.suit ? 1 : 0;
                    return (isBriscA - isBriscB) || (a.rank - b.rank);
                });
                chosenIdx = 0;
            } else {
                // Secondo a giocare: Cerca di prendere se ci sono punti, o scarta se non può
                const pCard = state.table[0].card;
                const bSuit = state.briscola?.suit;
                
                let bestIdx = -1;
                let minWinningRank = 99;

                for (let i = 0; i < hand.length; i++) {
                    const c = hand[i];
                    const canWin = (c.suit === pCard.suit && c.rank > pCard.rank) || (c.suit === bSuit && pCard.suit !== bSuit);
                    
                    if (canWin && c.rank < minWinningRank) {
                        minWinningRank = c.rank;
                        bestIdx = i;
                    }
                }

                if (bestIdx !== -1 && pCard.points >= 2) {
                    chosenIdx = bestIdx; // Prendi perché ci sono punti
                } else {
                    // Scarta la peggiore (no punti, no briscola)
                    hand.forEach((c, idx) => {
                        if(c.suit !== bSuit && c.points === 0) chosenIdx = idx;
                    });
                }
            }
            // Trova l'indice originale prima del sort (se applicato) per non buggare la mano
            const cardToPlay = hand[chosenIdx];
            chosenIdx = state.players[1].findIndex(c => c.name === cardToPlay.name && c.suit === cardToPlay.suit);
        } else {
            // Mossa Random
            chosenIdx = Math.floor(Math.random() * hand.length);
        }

        playCard(chosenIdx, 1);
    }

    function resolveRound() {
        const [t1, t2] = state.table;
        const bSuit = state.briscola?.suit || state.lastBriscolaSuit;
        
        let winner;
        if (t1.card.suit === t2.card.suit) winner = t1.card.rank > t2.card.rank ? t1.owner : t2.owner;
        else if (t2.card.suit === bSuit) winner = t2.owner;
        else if (t1.card.suit === bSuit) winner = t1.owner;
        else winner = t1.owner;

        state.scores[winner] += (t1.card.points + t2.card.points);
        state.table = [];
        
        setTimeout(() => {
            if (state.deck.length > 0) {
                state.players[winner].push(state.deck.pop());
                if (state.deck.length === 0) {
                    state.players[1-winner].push(state.briscola);
                    state.briscola = null;
                } else {
                    state.players[1-winner].push(state.deck.pop());
                }
            }

            if (state.players[0].length === 0 && state.deck.length === 0) {
                // FINE PARTITA: Controllo Vittoria e Livello
                if (state.scores[0] > state.scores[1]) {
                    unlockNextLevel('briscola', state.currentLevel);
                    alert(`🏆 VITTORIA! (Punti: ${state.scores[0]})\nHai sbloccato il livello successivo!`);
                } else if (state.scores[0] === state.scores[1]) {
                    alert(`🤝 PAREGGIO (Punti: ${state.scores[0]})\nDevi vincere per salire di livello.`);
                } else {
                    alert(`💀 SCONFITTA (Punti: ${state.scores[0]})\nIl Bot di Livello ${state.currentLevel} ti ha battuto.`);
                }
                return quit();
            }

            state.turn = winner;
            state.isAnimating = false;
            updateUI();
            if (state.turn === 1) setTimeout(() => playBot(), 800);
        }, 600);
    }

    function startMatch() {
        state.deck = [];
        SUITS.forEach(s => VALUES.forEach(v => state.deck.push({ suit: s.id, ...v })));
        state.deck.sort(() => Math.random() - 0.5);
        for(let i=0; i<3; i++) {
            state.players[0].push(state.deck.pop());
            state.players[1].push(state.deck.pop());
        }
        state.briscola = state.deck.pop();
        state.lastBriscolaSuit = state.briscola.suit;
        state.gameActive = true;
        updateUI();
    }
}