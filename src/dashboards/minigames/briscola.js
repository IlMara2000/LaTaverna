import { updateSidebarContext } from '../../components/layout/Sidebar.js';

/**
 * GIOCO: BRISCOLA - MASTER EDITION (Responsive & Animated)
 * Tema: Amethyst Ultra-Dark
 */

export function initBriscola(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    // BLOCCO TOTALE DELLO SCROLL E DEL PULL-TO-REFRESH
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
        gameActive: false, isAnimating: false
    };

    container.innerHTML = `
    <style>
        /* LAYOUT ADATTIVO FULL-SCREEN */
        .briscola-master-container {
            width: 100%;
            height: 100dvh;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            align-items: center;
            background: radial-gradient(circle at 50% 50%, #1a0b2e 0%, #05010a 100%);
            color: white;
            font-family: 'Poppins', sans-serif;
            position: relative;
            overflow: hidden;
            padding: env(safe-area-inset-top) 20px env(safe-area-inset-bottom) 20px;
            box-sizing: border-box;
        }

        /* HEADER E SCORE */
        .game-header {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 10;
        }

        .score-display {
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(157, 78, 221, 0.3);
            padding: 10px 20px;
            border-radius: 20px;
            display: flex;
            gap: 20px;
            font-weight: 900;
            box-shadow: 0 0 20px rgba(0,0,0,0.5);
        }

        /* TAVOLO CENTRALE */
        .game-table {
            flex: 1;
            width: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            position: relative;
        }

        .played-area {
            display: flex;
            gap: 20px;
            height: 150px;
            align-items: center;
            justify-content: center;
            margin-bottom: 30px;
        }

        /* CARTE: DIMENSIONI DINAMICHE */
        .card-b {
            width: clamp(70px, 15vw, 100px);
            height: clamp(100px, 22vw, 145px);
            background: #fff;
            border-radius: 12px;
            color: #000;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 8px;
            box-sizing: border-box;
            box-shadow: 0 10px 20px rgba(0,0,0,0.4);
            transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
            position: relative;
            user-select: none;
        }

        .card-b.back {
            background: linear-gradient(135deg, #5a189a 0%, #240046 100%);
            border: 2px solid var(--amethyst-bright);
            color: transparent;
        }

        .player-hand .card-b:hover {
            transform: translateY(-20px) scale(1.05);
            box-shadow: 0 15px 30px rgba(157, 78, 221, 0.5);
        }

        /* ANIMAZIONE CARTA CHE VOLA */
        .flying-card {
            position: fixed;
            z-index: 9999;
            pointer-events: none;
            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .hand-container {
            display: flex;
            gap: 15px;
            padding: 20px;
            z-index: 5;
        }

        .briscola-side-info {
            position: absolute;
            right: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }

        /* OVERLAY START */
        #start-screen {
            position: fixed;
            inset: 0;
            background: #05010a;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.5s ease;
        }

        .btn-glow {
            background: var(--accent-gradient);
            border: none;
            color: white;
            padding: 18px 50px;
            border-radius: 50px;
            font-weight: 900;
            font-size: 1.2rem;
            cursor: pointer;
            box-shadow: 0 0 20px var(--amethyst-glow);
            transition: 0.3s;
        }

        .btn-glow:active { transform: scale(0.9); }
    </style>

    <div class="briscola-master-container">
        
        <div id="start-screen">
            <img src="/assets/logo.png" style="width: 100px; margin-bottom: 20px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 40px;">BRISCOLA</h1>
            <button class="btn-glow" id="play-btn">INIZIA SFIDA</button>
            <button id="exit-btn" style="margin-top: 25px; background:none; border:none; color:white; opacity:0.4; font-weight:700; cursor:pointer;">TORNA INDIETRO</button>
        </div>

        <div class="game-header">
            <button id="btn-ingame-exit" style="background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: white; padding: 10px 20px; border-radius: 15px; font-weight: 800; font-size: 12px; cursor:pointer;">← ESCI</button>
            <div class="score-display">
                <div style="color: #00ffa3;">TU: <span id="p0-score">0</span></div>
                <div style="color: #ff416c;">BOT: <span id="p1-score">0</span></div>
            </div>
        </div>

        <div id="bot-hand" class="hand-container" style="opacity: 0.6; transform: scale(0.85);"></div>

        <div class="game-table">
            <div class="played-area" id="table-cards"></div>
            
            <div class="briscola-side-info">
                <div id="deck-count" style="font-size: 10px; opacity: 0.5; font-weight: 800;">CARTE: 40</div>
                <div id="main-deck-visual" class="card-b back" style="transform: scale(0.6); margin-top: -30px;"></div>
                <div id="briscola-card-visual" style="transform: rotate(90deg) scale(0.7); margin-top: -20px;"></div>
            </div>
        </div>

        <div id="player-hand" class="hand-container player-hand"></div>

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

    // --- LOGICA ANIMAZIONI ---
    async function animateCardMove(startEl, targetEl, cardData, isBack = false) {
        return new Promise(resolve => {
            const startRect = startEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();
            
            const flyer = document.createElement('div');
            flyer.className = `card-b flying-card ${isBack ? 'back' : ''}`;
            
            if (!isBack) {
                const suitData = SUITS.find(s => s.id === cardData.suit);
                flyer.innerHTML = `
                    <div style="font-weight:900; color:${suitData.color}">${cardData.name[0]}</div>
                    <div style="font-size: 2rem; align-self:center;">${suitData.icon}</div>
                    <div style="font-weight:900; align-self:flex-end; transform:rotate(180deg); color:${suitData.color}">${cardData.name[0]}</div>
                `;
            }

            flyer.style.left = `${startRect.left}px`;
            flyer.style.top = `${startRect.top}px`;
            document.body.appendChild(flyer);

            // Frame successivo per far partire la transizione
            requestAnimationFrame(() => {
                flyer.style.left = `${targetRect.left}px`;
                flyer.style.top = `${targetRect.top}px`;
                flyer.style.transform = `rotate(${Math.random() * 20 - 10}deg)`;
            });

            setTimeout(() => {
                flyer.remove();
                resolve();
            }, 500);
        });
    }

    const renderCardHTML = (c) => {
        if (!c) return '';
        const suit = SUITS.find(s => s.id === c.suit);
        return `
            <div style="width:100%; text-align:left; font-weight:900; font-size: 14px; color:${suit.color}">${c.name === 'Asso' ? 'A' : (c.name === 'Re' ? 'R' : (c.name === 'Cavallo' ? 'C' : (c.name === 'Fante' ? 'F' : c.name)))}</div>
            <div style="font-size: 2.2rem; align-self: center; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.2));">${suit.icon}</div>
            <div style="width:100%; text-align:right; font-weight:900; font-size: 14px; transform: rotate(180deg); color:${suit.color}">${c.name === 'Asso' ? 'A' : (c.name === 'Re' ? 'R' : (c.name === 'Cavallo' ? 'C' : (c.name === 'Fante' ? 'F' : c.name)))}</div>
        `;
    };

    const updateUI = () => {
        if (!state.gameActive) return;
        
        // Punteggi
        container.querySelector('#p0-score').innerText = state.scores[0];
        container.querySelector('#p1-score').innerText = state.scores[1];
        container.querySelector('#deck-count').innerText = `CARTE: ${state.deck.length}`;

        // Briscola
        const bVis = container.querySelector('#briscola-card-visual');
        bVis.innerHTML = state.briscola ? `<div class="card-b">${renderCardHTML(state.briscola)}</div>` : '';

        // Mano Giocatore
        const pHand = container.querySelector('#player-hand');
        pHand.innerHTML = state.players[0].map((c, i) => `
            <div class="card-b" data-idx="${i}">${renderCardHTML(c)}</div>
        `).join('');

        // Mano Bot (Coperte)
        const bHand = container.querySelector('#bot-hand');
        bHand.innerHTML = state.players[1].map(() => `<div class="card-b back"></div>`).join('');

        // Tavolo
        const tArea = container.querySelector('#table-cards');
        tArea.innerHTML = state.table.map(t => `<div class="card-b">${renderCardHTML(t.card)}</div>`).join('');

        // Listeners carte giocatore
        pHand.querySelectorAll('.card-b').forEach(el => {
            el.onclick = () => { if(state.turn === 0 && !state.isAnimating) playCard(parseInt(el.dataset.idx), 0); };
        });
    };

    async function playCard(idx, pIdx) {
        state.isAnimating = true;
        const card = state.players[pIdx][idx];
        
        // Animazione
        const startEl = pIdx === 0 
            ? container.querySelector(`#player-hand .card-b[data-idx="${idx}"]`)
            : container.querySelector(`#bot-hand .card-b`);
        
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
            if (state.turn === 1) setTimeout(() => playCard(0, 1), 1000);
        }
    }

    function resolveRound() {
        const [t1, t2] = state.table;
        const bSuit = state.briscola?.suit || state.lastBriscolaSuit;
        
        let winner;
        if (t1.card.suit === t2.card.suit) {
            winner = t1.card.rank > t2.card.rank ? t1.owner : t2.owner;
        } else if (t2.card.suit === bSuit) {
            winner = t2.owner;
        } else if (t1.card.suit === bSuit) {
            winner = t1.owner;
        } else {
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
                const msg = state.scores[0] > 60 ? "VITTORIA!" : (state.scores[0] === 60 ? "PAREGGIO" : "SCONFITTA");
                alert(`${msg}\nTu: ${state.scores[0]} - Bot: ${state.scores[1]}`);
                return quit();
            }

            state.turn = winner;
            state.isAnimating = false;
            updateUI();
            if (state.turn === 1) setTimeout(() => playCard(0, 1), 800);
        }, 600);
    }

    container.querySelector('#play-btn').onclick = () => {
        container.querySelector('#start-screen').style.display = 'none';
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