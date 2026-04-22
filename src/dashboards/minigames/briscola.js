import { updateSidebarContext } from '../../components/layout/Sidebar.js';

/**
 * GIOCO: BRISCOLA - MASTER EDITION
 * Integrazione totale con global.css
 * Stile Carte: Matte Black Minimalist
 */

export function initBriscola(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    // Pulizia per la vista di gioco
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    window.scrollTo(0, 0);

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
        gameActive: false, isAnimating: false
    };

    container.innerHTML = `
    <style>
        /* OVERRIDES SPECIFICI BRISCOLA (Design Matte Black) */
        
        .card-matte {
            background: #121212 !important; /* Nero opaco profondo */
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            box-shadow: 0 8px 20px rgba(0,0,0,0.7) !important;
            color: rgba(255, 255, 255, 0.9) !important;
        }

        .card-matte.back {
            background: linear-gradient(135deg, #1a1a1a 0%, #050505 100%) !important;
            border: 2px solid rgba(255, 255, 255, 0.05) !important;
            color: transparent !important;
        }

        /* Interazione Carte Giocatore */
        #player-hand .card-matte { cursor: pointer; }
        #player-hand .card-matte:active {
            transform: translateY(-15px) scale(1.02);
            border-color: var(--amethyst-bright) !important;
            box-shadow: 0 15px 30px rgba(157, 78, 221, 0.4) !important;
            z-index: 100;
        }

        /* Animazione volo */
        .flying-card {
            position: fixed;
            z-index: 9999;
            pointer-events: none;
            transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        /* Layout Lato Briscola */
        .briscola-layout {
            position: absolute;
            right: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
    </style>

    <div class="game-master-wrapper fade-in">
        
        <div id="start-screen" class="game-master-wrapper" style="position: absolute; inset: 0; z-index: 10000; justify-content: center;">
            <img src="/assets/logo.png" style="width: 90px; margin-bottom: 25px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 40px;">BRISCOLA</h1>
            <button class="game-btn-action" id="play-btn" style="width: 100%; max-width: 280px; padding: 18px; font-size: 1.1rem; background: var(--accent-gradient); border: none;">INIZIA SFIDA</button>
            <button id="exit-btn" class="game-btn-action" style="background: transparent; border: none; margin-top: 15px; opacity: 0.6;">TORNA ALLA TAVERNA</button>
        </div>

        <header class="game-master-header">
            <button id="btn-ingame-exit" class="game-btn-action">← ESCI</button>
            <div class="game-score-widget">
                <span style="color: #00ffa3;">TU: <b id="p0-score">0</b></span>
                <span style="color: #ff416c;">BOT: <b id="p1-score">0</b></span>
            </div>
        </header>

        <div id="bot-hand" class="game-player-hand" style="opacity: 0.8; transform: scale(0.85); gap: -10px;"></div>

        <main class="game-master-table">
            <div id="table-cards" style="display: flex; gap: 20px; align-items: center; justify-content: center; height: 160px; width: 100%;"></div>
            
            <div class="briscola-layout">
                <div id="deck-count" style="font-size: 11px; opacity: 0.4; font-weight: 800; margin-bottom: 8px; letter-spacing: 1px;">CARTE: 40</div>
                <div id="main-deck-visual" class="game-card-unit card-matte back" style="transform: scale(0.65); margin-top: -20px; box-shadow: 0 0 20px rgba(0,0,0,0.8) !important;"></div>
                <div id="briscola-card-visual" style="transform: rotate(90deg) scale(0.75); margin-top: -30px; z-index: -1;"></div>
            </div>
        </main>

        <footer id="player-hand" class="game-player-hand"></footer>

    </div>
    `;

    // Funzione di uscita fluida
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

    // --- ANIMAZIONE CARTE ---
    async function animateCardMove(startEl, targetEl, cardData, isBack = false) {
        return new Promise(resolve => {
            const startRect = startEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            
            const flyer = document.createElement('div');
            flyer.className = `game-card-unit card-matte flying-card ${isBack ? 'back' : ''}`;
            
            if (!isBack) flyer.innerHTML = renderCardInner(cardData);

            flyer.style.left = `${startRect.left}px`;
            flyer.style.top = `${startRect.top}px`;
            flyer.style.width = `${startRect.width}px`;
            flyer.style.height = `${startRect.height}px`;
            document.body.appendChild(flyer);

            requestAnimationFrame(() => {
                flyer.style.left = `${targetRect.left}px`;
                flyer.style.top = `${targetRect.top}px`;
                flyer.style.transform = `rotate(${Math.random() * 15 - 7.5}deg) scale(1.05)`;
            });

            setTimeout(() => {
                flyer.remove();
                resolve();
            }, 400);
        });
    }

    // Costruisce il contenuto Minimal Matte Black
    const renderCardInner = (c) => {
        if (!c) return '';
        const suit = SUITS.find(s => s.id === c.suit);
        // Prende solo la prima lettera o il numero
        let val = c.name === 'Asso' ? 'A' : (c.name === 'Re' ? 'R' : (c.name === 'Cavallo' ? 'C' : (c.name === 'Fante' ? 'F' : c.name)));
        
        return `
            <div style="font-size: 1.4rem; font-weight: 900; align-self: flex-start; line-height: 1;">${val}</div>
            <div style="font-size: 3rem; align-self: center; filter: drop-shadow(0 2px 10px rgba(0,0,0,0.8)); margin: auto 0;">${suit.icon}</div>
            <div style="font-size: 1.4rem; font-weight: 900; align-self: flex-end; line-height: 1; transform: rotate(180deg);">${val}</div>
        `;
    };

    const updateUI = () => {
        if (!state.gameActive) return;
        
        container.querySelector('#p0-score').innerText = state.scores[0];
        container.querySelector('#p1-score').innerText = state.scores[1];
        container.querySelector('#deck-count').innerText = `CARTE: ${state.deck.length}`;

        // Briscola a terra
        const bVis = container.querySelector('#briscola-card-visual');
        bVis.innerHTML = state.briscola ? `<div class="game-card-unit card-matte" style="border: 1px solid var(--amethyst-bright) !important; box-shadow: 0 0 20px var(--amethyst-glow) !important;">${renderCardInner(state.briscola)}</div>` : '';

        // Giocatore
        const pHand = container.querySelector('#player-hand');
        pHand.innerHTML = state.players[0].map((c, i) => `
            <div class="game-card-unit card-matte player-hand-card" data-idx="${i}">
                ${renderCardInner(c)}
            </div>
        `).join('');

        // Bot
        const bHand = container.querySelector('#bot-hand');
        bHand.innerHTML = state.players[1].map(() => `<div class="game-card-unit card-matte back"></div>`).join('');

        // Tavolo Centrale
        const tArea = container.querySelector('#table-cards');
        tArea.innerHTML = state.table.map(t => `
            <div class="game-card-unit card-matte" style="transform: scale(1.05);">
                ${renderCardInner(t.card)}
            </div>
        `).join('');

        // Click eventi giocatore
        pHand.querySelectorAll('.game-card-unit').forEach(el => {
            el.onclick = () => { if(state.turn === 0 && !state.isAnimating) playCard(parseInt(el.dataset.idx), 0); };
        });
    };

    async function playCard(idx, pIdx) {
        state.isAnimating = true;
        const card = state.players[pIdx][idx];
        
        const startEl = pIdx === 0 
            ? container.querySelector(`#player-hand .game-card-unit[data-idx="${idx}"]`)
            : container.querySelector(`#bot-hand .game-card-unit`);
        
        const targetPlaceholder = document.createElement('div');
        targetPlaceholder.style.width = '80px'; // Spazio fittizio
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
            if (state.turn === 1) setTimeout(() => playCard(0, 1), 1000);
        }
    }

    function resolveRound() {
        const [t1, t2] = state.table;
        const bSuit = state.briscola?.suit || state.lastBriscolaSuit;
        
        let winner = t1.owner;
        if (t1.card.suit === t2.card.suit) {
            winner = t1.card.rank > t2.card.rank ? t1.owner : t2.owner;
        } else if (t2.card.suit === bSuit) {
            winner = t2.owner;
        } else if (t1.card.suit === bSuit) {
            winner = t1.owner;
        }

        state.scores[winner] += (t1.card.points + t2.card.points);
        state.table = [];
        
        setTimeout(() => {
            // Pesca
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
                const msg = state.scores[0] > 60 ? "🏆 VITTORIA!" : (state.scores[0] === 60 ? "🤝 PAREGGIO" : "💀 SCONFITTA");
                alert(`${msg}\nTu: ${state.scores[0]} - Bot: ${state.scores[1]}`);
                return quit();
            }

            state.turn = winner;
            state.isAnimating = false;
            updateUI();
            if (state.turn === 1) setTimeout(() => playCard(0, 1), 800);
        }, 500);
    }

    container.querySelector('#play-btn').onclick = () => {
        container.querySelector('#start-screen').remove();
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
    };
}