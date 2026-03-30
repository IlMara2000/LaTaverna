import { updateSidebarContext } from '../../components/layout/Sidebar.js';

export function initBriscola(container) {
    updateSidebarContext("minigames");

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
        .briscola-wrapper { width:100%; height:100dvh; background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%); position:relative; overflow:hidden; color:white; font-family: 'Poppins', sans-serif; }
        
        /* Widget Punteggio in alto a destra */
        .score-widget { position:absolute; top:20px; right:20px; background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); padding: 15px; border-radius: 20px; min-width: 150px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 10; }
        .score-line { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; font-weight: 900; font-size: 0.9rem; }
        .score-val { font-size: 1.2rem; }

        /* Carte in stile Vetro */
        .b-card { width: 85px; height: 125px; border-radius: 16px; background: rgba(255,255,255,0.05); color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; border: 1px solid rgba(255,255,255,0.1); transition: 0.3s; position: relative; cursor: pointer; text-align: center; }
        .b-card:hover { transform: translateY(-10px); border-color: #9d4ede; box-shadow: 0 0 20px rgba(157,78,221,0.3); }
        .b-card.back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1.5px solid #9d4ede; color: #9d4ede; cursor: default; }
        
        .active-glow { border: 2px solid #00ffa3 !important; box-shadow: 0 0 15px rgba(0,255,163,0.2); }
        .btn-start { background: linear-gradient(45deg, #9d4ede, #ff416c); color: white; padding: 20px 50px; border-radius: 15px; font-weight: 900; border: none; cursor: pointer; font-size: 1.4rem; text-transform: uppercase; }
        
        #player-side, #bot-side { transition: 0.5s; border-radius: 25px; padding: 10px; border: 2px solid transparent; }
    </style>

    <div class="briscola-wrapper">
        <div id="briscola-overlay" style="position:fixed; inset:0; background:rgba(9,10,15,0.95); z-index:100; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:20px; backdrop-filter: blur(15px);">
            <h1 style="font-size:4rem; font-weight:900; background: linear-gradient(to right, #9d4ede, #ff416c); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">BRISCOLA</h1>
            <button class="btn-start" id="start-game-btn">Inizia Partita</button>
        </div>

        <div class="score-widget">
            <div class="score-line"><span>TU</span> <span id="s0" class="score-val" style="color:#00ffa3;">0</span></div>
            <div class="score-line"><span>BOT</span> <span id="s1" class="score-val" style="color:#ff416c;">0</span></div>
            <div id="deck-count" style="font-size: 10px; opacity:0.5; margin-top:5px; text-align:center;">Carte: 40</div>
        </div>

        <div id="bot-side" style="position:absolute; top:40px; left:50%; transform:translateX(-50%); display:flex; gap:10px;"></div>

        <div id="mid-table" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); display:flex; align-items:center; gap:60px;">
            <div style="position:relative; width:90px; height:130px;">
                <div id="briscola-slot" style="position:absolute; left:40px; transform:rotate(90deg);"></div>
                <div id="deck-visual" class="b-card back" style="position:absolute; left:0; font-size:10px;">MAZZO</div>
            </div>
            <div id="played-cards" style="display:flex; gap:20px; min-width:200px; justify-content:center; perspective: 1000px;"></div>
        </div>

        <div id="player-side" style="position:absolute; bottom:60px; left:50%; transform:translateX(-50%); display:flex; gap:15px;"></div>
    </div>
    `;

    const getCardUI = (c) => {
        if (!c) return '';
        const suitData = SUITS.find(s => s.id === c.suit);
        return `
            <span style="font-size:10px; color:${suitData.color}; font-weight:900; margin-bottom:5px;">${c.suit.toUpperCase()}</span>
            <span style="font-size:2rem; margin:5px 0;">${suitData.icon}</span>
            <span style="font-size:16px; font-weight:900;">${c.name}</span>
        `;
    };

    const renderView = () => {
        if (!state.gameActive) return;

        // Aggiorna Slot Briscola
        const bSlot = container.querySelector('#briscola-slot');
        bSlot.innerHTML = state.briscola ? `<div class="b-card" style="border-color:#9d4ede">${getCardUI(state.briscola)}</div>` : '';
        
        // Visual Deck
        container.querySelector('#deck-visual').style.display = state.deck.length > 0 ? 'flex' : 'none';
        container.querySelector('#deck-count').innerText = `Carte nel mazzo: ${state.deck.length}`;

        // Mano Bot
        const botSide = container.querySelector('#bot-side');
        botSide.innerHTML = state.players[1].map(() => `<div class="b-card back"></div>`).join('');
        botSide.classList.toggle('active-glow', state.turn === 1);

        // Mano Giocatore
        const pSide = container.querySelector('#player-side');
        pSide.innerHTML = state.players[0].map((c, i) => `<div class="b-card" data-idx="${i}">${getCardUI(c)}</div>`).join('');
        pSide.classList.toggle('active-glow', state.turn === 0);

        // Carte sul tavolo
        container.querySelector('#played-cards').innerHTML = state.table.map(t => `
            <div class="b-card fade-in" style="transform: rotate(${t.owner === 0 ? '-5deg' : '5deg'}) scale(1.1);">
                ${getCardUI(t.card)}
            </div>
        `).join('');

        // Punteggi
        container.querySelector('#s0').innerText = state.scores[0];
        container.querySelector('#s1').innerText = state.scores[1];

        // Eventi click
        pSide.querySelectorAll('.b-card').forEach(card => {
            card.onclick = () => { if(state.turn === 0 && !state.isAnimating) playCard(parseInt(card.dataset.idx), 0); };
        });
    };

    const playCard = (idx, pIdx) => {
        state.isAnimating = true;
        state.table.push({ card: state.players[pIdx].splice(idx, 1)[0], owner: pIdx });
        renderView();

        if (state.table.length === 2) { 
            setTimeout(resolveRound, 800); 
        } else {
            state.turn = 1 - pIdx;
            state.isAnimating = false;
            renderView();
            if (state.turn === 1) setTimeout(botLogic, 1000);
        }
    };

    const botLogic = () => {
        if (state.players[1].length === 0) return;
        // Bot semplice: gioca la prima carta
        playCard(0, 1);
    };

    const resolveRound = () => {
        const [t1, t2] = state.table;
        const briscolaSuit = state.briscola.suit;
        let winner;

        if (t1.card.suit === t2.card.suit) {
            winner = t1.card.rank > t2.card.rank ? t1.owner : t2.owner;
        } else if (t2.card.suit === briscolaSuit) {
            winner = t2.owner;
        } else if (t1.card.suit === briscolaSuit) {
            winner = t1.owner;
        } else {
            winner = t1.owner; // Vince chi ha aperto se non c'è briscola e i semi sono diversi
        }

        state.scores[winner] += (t1.card.points + t2.card.points);
        state.table = [];
        
        setTimeout(() => {
            // Pesca
            if (state.deck.length > 0) {
                state.players[winner].push(state.deck.pop());
                // L'ultima carta è la briscola stessa
                const opponentIdx = 1 - winner;
                if (state.deck.length === 0 && state.briscola) {
                    state.players[opponentIdx].push(state.briscola);
                    state.briscola = null;
                } else {
                    state.players[opponentIdx].push(state.deck.pop());
                }
            }

            if (state.players[0].length === 0) {
                const msg = state.scores[0] > 60 ? "🏆 VITTORIA!" : (state.scores[0] === 60 ? "🤝 PAREGGIO!" : "💀 SCONFITTA!");
                alert(`${msg}\nTu: ${state.scores[0]} - Bot: ${state.scores[1]}`);
                return initBriscola(container);
            }

            state.turn = winner;
            state.isAnimating = false;
            renderView();
            if (state.turn === 1) setTimeout(botLogic, 800);
        }, 600);
    };

    container.querySelector('#start-game-btn').onclick = () => {
        container.querySelector('#briscola-overlay').style.display = 'none';
        state.deck = [];
        SUITS.forEach(s => VALUES.forEach(v => state.deck.push({ suit: s.id, ...v })));
        
        // Shuffle
        for (let i = state.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
        }

        // Distribuzione iniziale
        for(let i=0; i<3; i++) {
            state.players[0].push(state.deck.pop());
            state.players[1].push(state.deck.pop());
        }
        state.briscola = state.deck.pop();
        state.gameActive = true;
        renderView();
    };
}