import { updateSidebarContext } from '../../components/layout/Sidebar.js';

export function initBriscola(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    // BLOCCO SCROLL GLOBALE 100% (Amethyst 5.4 Standard)
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'hidden'; // Blocco totale pagina
    document.body.style.position = 'relative';
    document.body.style.touchAction = 'none'; // Nessun trascinamento
    document.body.style.overscrollBehavior = 'none';
    document.body.style.backgroundColor = '#05010a'; // Match del bg-dark
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
        .briscola-wrapper { 
            width: 100%; max-width: 430px; height: 100dvh; margin: 0 auto;
            position: relative; overflow: hidden; color: var(--text-primary); 
            font-family: 'Poppins', sans-serif; box-sizing: border-box; 
            background: radial-gradient(circle at center, rgba(27,39,53,0.8) 0%, rgba(9,10,15,0.9) 100%);
        }
        
        .btn-exit-game {
            position: absolute; top: calc(15px + env(safe-area-inset-top)); left: 15px; z-index: 100;
            background: var(--glass-surface); border: 1px solid var(--glass-border);
            color: white; padding: 8px 16px; border-radius: 14px; font-weight: 800; font-size: 10px;
            cursor: pointer; outline: none; transition: 0.2s; backdrop-filter: blur(10px);
        }
        .btn-exit-game:active { transform: scale(0.95); background: rgba(157, 78, 221, 0.2); border-color: var(--amethyst-bright); }
        
        .score-widget { 
            position: absolute; top: calc(15px + env(safe-area-inset-top)); right: 15px; 
            background: var(--glass-surface); backdrop-filter: blur(10px); 
            border: 1px solid var(--glass-border); padding: 10px 15px; border-radius: 16px; 
            min-width: 110px; z-index: 10; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .score-line { display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: 0.75rem; margin-bottom: 4px; }
        
        .b-card { 
            width: 75px; height: 110px; border-radius: 14px; 
            background: var(--glass-surface); color: white; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; 
            border: 1px solid var(--glass-border); transition: transform 0.2s, box-shadow 0.2s; position: relative; 
            cursor: pointer; text-align: center; user-select: none; -webkit-tap-highlight-color: transparent;
            box-shadow: 0 4px 10px rgba(0,0,0,0.4);
        }
        
        .player-card:active { transform: translateY(-15px) scale(1.05); z-index: 10; box-shadow: 0 10px 20px rgba(157, 78, 221, 0.4); border-color: var(--amethyst-bright); }
        
        .b-card.back { background: var(--accent-gradient); border: 1px solid var(--amethyst-bright); color: transparent; }
        
        .active-glow { position: relative; }
        .active-glow::after {
            content: ''; position: absolute; inset: -5px; border-radius: 20px;
            border: 2px solid #00ffa3; opacity: 0.5; animation: pulseGlow 1.5s infinite; pointer-events: none;
        }
        #bot-side.active-glow::after { border-color: var(--danger); }
        
        @keyframes pulseGlow { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.05); opacity: 0; } }

        #player-side { position: absolute; bottom: calc(25px + env(safe-area-inset-bottom)); width: 100%; display: flex; justify-content: center; gap: 8px; z-index: 5; }
        #bot-side { position: absolute; top: calc(75px + env(safe-area-inset-top)); width: 100%; display: flex; justify-content: center; gap: 8px; z-index: 5; }
        #mid-table { width: 100%; height: 200px; position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
    </style>

    <div class="briscola-wrapper fade-in">
        
        <div id="briscola-overlay" style="position:absolute; inset:0; background:rgba(5, 2, 10, 0.95); backdrop-filter: blur(10px); z-index:11000; display:flex; align-items:center; justify-content:center; flex-direction:column; padding: 20px; box-sizing: border-box;">
            
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 40px; filter: drop-shadow(0 0 20px rgba(157,78,221,0.5));">BRISCOLA</h1>
            
            <button class="btn-primary" id="start-game-btn" style="width: 100%; max-width: 280px; margin-bottom: 15px; font-size: 1.1rem; border: none; background: var(--accent-gradient);">GIOCA ORA</button>
            <button id="btn-quit-start" class="btn-back-glass" style="width: 100%; max-width: 280px; border-left: none;">MULTIPLAYER</button>
            
        </div>

        <button class="btn-exit-game" id="btn-exit-ingame" style="display: none;">← ESCI</button>

        <div class="score-widget" id="score-ui" style="display: none;">
            <div class="score-line"><span>TU</span> <span id="s0" style="color:#00ffa3;">0</span></div>
            <div class="score-line"><span>BOT</span> <span id="s1" style="color:var(--danger);">0</span></div>
            <div id="deck-count" style="font-size: 9px; opacity:0.5; margin-top:8px; text-align:center; font-family: 'Montserrat', sans-serif; letter-spacing: 1px;">CARTE: 40</div>
        </div>

        <div id="bot-side" style="display: none;"></div>
        
        <div id="mid-table" style="display: none;">
            <div id="played-cards" style="display:flex; gap:10px; height: 110px;"></div>
            <div style="position:relative; width:120px; height:80px; margin-top: 20px;">
                <div id="briscola-slot" style="position:absolute; transform:rotate(90deg); left: 30px;"></div>
                <div id="deck-visual" class="b-card back" style="position:absolute; transform: scale(0.8); left: -10px; font-size:9px;"></div>
            </div>
        </div>
        
        <div id="player-side" style="display: none;"></div>
    </div>
    `;

    const quitGame = async () => {
        document.body.style.touchAction = '';
        document.body.style.overflowX = '';
        document.body.style.overflowY = 'auto'; // Ripristina scroll verticale
        document.body.style.overscrollBehavior = '';
        document.body.style.backgroundColor = '';
        try {
            const { showMinigamesList } = await import('../../minigamelist.js');
            showMinigamesList(document.getElementById('app') || container);
        } catch (e) {
            window.location.reload(); 
        }
    };

    container.querySelector('#btn-quit-start').onclick = quitGame;
    container.querySelector('#btn-exit-ingame').onclick = quitGame;

    const getCardUI = (c) => {
        if (!c) return '';
        const suitData = SUITS.find(s => s.id === c.suit);
        return `
            <span style="font-size:9px; color:${suitData.color}; font-weight:900; letter-spacing: 1px;">${c.suit.toUpperCase()}</span>
            <span style="font-size:1.8rem; margin: 5px 0; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">${suitData.icon}</span>
            <span style="font-size:15px; font-weight:900; color: white;">${c.name}</span>
        `;
    };

    const renderView = () => {
        if (!state.gameActive) return;
        
        const bSlot = container.querySelector('#briscola-slot');
        bSlot.innerHTML = state.briscola ? `<div class="b-card" style="transform: scale(0.8); border: 2px solid var(--amethyst-bright); box-shadow: 0 0 15px var(--amethyst-glow);">${getCardUI(state.briscola)}</div>` : '';
        
        container.querySelector('#deck-visual').style.display = state.deck.length > 0 ? 'flex' : 'none';
        container.querySelector('#deck-count').innerText = `CARTE: ${state.deck.length}`;
        
        const botSide = container.querySelector('#bot-side');
        botSide.innerHTML = state.players[1].map(() => `<div class="b-card back" style="transform: scale(0.85); margin: 0 -10px;"></div>`).join('');
        botSide.classList.toggle('active-glow', state.turn === 1);
        
        const pSide = container.querySelector('#player-side');
        pSide.innerHTML = state.players[0].map((c, i) => `<div class="b-card player-card" data-idx="${i}">${getCardUI(c)}</div>`).join('');
        pSide.classList.toggle('active-glow', state.turn === 0);
        
        container.querySelector('#played-cards').innerHTML = state.table.map(t => `<div class="b-card" style="cursor:default;">${getCardUI(t.card)}</div>`).join('');
        container.querySelector('#s0').innerText = state.scores[0];
        container.querySelector('#s1').innerText = state.scores[1];

        pSide.querySelectorAll('.b-card.player-card').forEach(card => {
            card.onclick = (e) => { 
                e.preventDefault();
                if(state.turn === 0 && !state.isAnimating) playCard(parseInt(card.dataset.idx), 0); 
            };
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
            if (state.turn === 1) setTimeout(() => playCard(0, 1), 1000);
        }
    };

    const resolveRound = () => {
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
                const isWin = state.scores[0] > 60;
                const isDraw = state.scores[0] === 60;
                const msg = isWin ? "🏆 VITTORIA!" : (isDraw ? "🤝 PAREGGIO!" : "💀 SCONFITTA!");
                alert(`${msg}\nTu: ${state.scores[0]} - Bot: ${state.scores[1]}`);
                return quitGame();
            }

            state.turn = winner;
            state.isAnimating = false;
            renderView();
            if (state.turn === 1) setTimeout(() => playCard(0, 1), 800);
        }, 600);
    };

    container.querySelector('#start-game-btn').onclick = (e) => {
        e.preventDefault();
        container.querySelector('#briscola-overlay').style.display = 'none';
        container.querySelector('#btn-exit-ingame').style.display = 'block';
        container.querySelector('#score-ui').style.display = 'block';
        container.querySelector('#bot-side').style.display = 'flex';
        container.querySelector('#mid-table').style.display = 'flex';
        container.querySelector('#player-side').style.display = 'flex';

        state.deck = [];
        SUITS.forEach(s => VALUES.forEach(v => state.deck.push({ suit: s.id, ...v })));
        
        for (let i = state.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
        }

        for(let i=0; i<3; i++) {
            state.players[0].push(state.deck.pop());
            state.players[1].push(state.deck.pop());
        }
        state.briscola = state.deck.pop();
        state.lastBriscolaSuit = state.briscola.suit;
        state.gameActive = true;
        renderView();
    };
}
