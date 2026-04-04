import { updateSidebarContext } from '../../components/layout/Sidebar.js';

export function initBriscola(container) {
    updateSidebarContext("minigames");

    // FIX: Pulizia scroll e configurazione mobile-friendly
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none'; 
    document.body.style.backgroundColor = '#090a0f'; // Match sfondo globale

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
            background: radial-gradient(circle at center, rgba(27,39,53,0.8) 0%, rgba(9,10,15,0.9) 100%); 
            position: relative; overflow: hidden; color: white; font-family: 'Poppins', sans-serif;
            box-sizing: border-box; animation: cardEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        
        @media (min-width: 431px) {
            .briscola-wrapper { border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); height: 90dvh; margin-top: 5vh; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        }

        .btn-exit-game {
            position: absolute; top: calc(15px + env(safe-area-inset-top)); left: 15px; z-index: 100;
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 10px;
            cursor: pointer; -webkit-tap-highlight-color: transparent; outline: none; transition: 0.2s;
        }
        .btn-exit-game:active { transform: scale(0.95); background: rgba(255,255,255,0.1); }
        
        .score-widget { 
            position: absolute; top: calc(15px + env(safe-area-inset-top)); right: 15px; 
            background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); 
            border: 1px solid rgba(255,255,255,0.1); padding: 10px; border-radius: 15px; min-width: 110px; z-index: 10; 
        }
        .score-line { display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: 0.7rem; }
        
        .b-card { 
            width: 75px; height: 110px; border-radius: 12px; background: rgba(255,255,255,0.05); color: white; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; 
            border: 1px solid rgba(255,255,255,0.1); transition: 0.3s; position: relative; cursor: pointer; text-align: center;
            user-select: none; -webkit-tap-highlight-color: transparent; outline: none;
        }
        .b-card.back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1.5px solid #9d4ede; color: #9d4ede; }
        
        .active-glow::after {
            content: ''; position: absolute; inset: -5px; border-radius: 20px;
            border: 2px solid #00ffa3; opacity: 0.5; animation: pulseGlow 1.5s infinite; pointer-events: none;
        }
        @keyframes pulseGlow { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.05); opacity: 0; } }

        .btn-start { 
            background: linear-gradient(45deg, #9d4ede, #ff416c); color: white; padding: 15px 40px; 
            border-radius: 15px; font-weight: 900; border: none; cursor: pointer; font-size: 1.2rem; 
            text-transform: uppercase; -webkit-tap-highlight-color: transparent; outline: none;
        }
        
        #player-side { position: absolute; bottom: calc(25px + env(safe-area-inset-bottom)); width: 100%; display: flex; justify-content: center; gap: 8px; z-index: 5; }
        #bot-side { position: absolute; top: calc(75px + env(safe-area-inset-top)); width: 100%; display: flex; justify-content: center; gap: 8px; z-index: 5; }
        #mid-table { width: 100%; height: 200px; position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
    </style>

    <div class="briscola-wrapper">
        <div id="briscola-overlay" style="position:absolute; inset:0; background:rgba(9,10,15,0.98); z-index:100; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:20px; backdrop-filter: blur(15px);">
            <h1 style="font-size:3rem; font-weight:900; background: linear-gradient(to right, #9d4ede, #ff416c); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; font-family:'Montserrat'; margin: 0;">BRISCOLA</h1>
            <button class="btn-start" id="start-game-btn">GIOCA ORA</button>
            <button id="btn-quit-start" style="margin-top: 20px; background:transparent; border:none; color:rgba(255,255,255,0.5); font-weight:700; cursor:pointer; outline: none; font-size: 12px; text-transform: uppercase;">← Torna Indietro</button>
        </div>

        <button class="btn-exit-game" id="btn-exit-ingame" style="display: none;">← ESCI</button>

        <div class="score-widget" id="score-ui" style="display: none;">
            <div class="score-line"><span>TU</span> <span id="s0" style="color:#00ffa3;">0</span></div>
            <div class="score-line"><span>BOT</span> <span id="s1" style="color:#ff416c;">0</span></div>
            <div id="deck-count" style="font-size: 9px; opacity:0.5; margin-top:5px; text-align:center;">Carte: 40</div>
        </div>

        <div id="bot-side" style="display: none;"></div>
        <div id="mid-table" style="display: none;">
            <div id="played-cards" style="display:flex; gap:10px; height: 110px;"></div>
            <div style="position:relative; width:120px; height:80px; margin-top: 20px;">
                <div id="briscola-slot" style="position:absolute; transform:rotate(90deg); left: 30px;"></div>
                <div id="deck-visual" class="b-card back" style="position:absolute; transform: scale(0.8); left: -10px; font-size:9px;">MAZZO</div>
            </div>
        </div>
        <div id="player-side" style="display: none;"></div>
    </div>
    `;

    // Funzione centralizzata per uscire senza rompere lo scroll
    const quitGame = async () => {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.style.position = '';
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
            <span style="font-size:8px; color:${suitData.color}; font-weight:900;">${c.suit.toUpperCase()}</span>
            <span style="font-size:1.5rem;">${suitData.icon}</span>
            <span style="font-size:14px; font-weight:900;">${c.name}</span>
        `;
    };

    const renderView = () => {
        if (!state.gameActive) return;
        container.querySelector('#briscola-slot').innerHTML = state.briscola ? `<div class="b-card" style="transform: scale(0.8);">${getCardUI(state.briscola)}</div>` : '';
        container.querySelector('#deck-visual').style.display = state.deck.length > 0 ? 'flex' : 'none';
        container.querySelector('#deck-count').innerText = `MAZZO: ${state.deck.length}`;
        
        const botSide = container.querySelector('#bot-side');
        botSide.innerHTML = state.players[1].map(() => `<div class="b-card back" style="transform: scale(0.85); margin: 0 -10px;"></div>`).join('');
        botSide.classList.toggle('active-glow', state.turn === 1);
        
        const pSide = container.querySelector('#player-side');
        pSide.innerHTML = state.players[0].map((c, i) => `<div class="b-card" data-idx="${i}">${getCardUI(c)}</div>`).join('');
        pSide.classList.toggle('active-glow', state.turn === 0);
        
        container.querySelector('#played-cards').innerHTML = state.table.map(t => `<div class="b-card">${getCardUI(t.card)}</div>`).join('');
        container.querySelector('#s0').innerText = state.scores[0];
        container.querySelector('#s1').innerText = state.scores[1];

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
            if (state.turn === 1) setTimeout(() => playCard(0, 1), 1000);
        }
    };

    const resolveRound = () => {
        const [t1, t2] = state.table;
        const bSuit = state.briscola?.suit || state.lastBriscolaSuit;
        let winner = (t1.card.suit === t2.card.suit) ? (t1.card.rank > t2.card.rank ? t1.owner : t2.owner) : (t2.card.suit === bSuit ? t2.owner : (t1.card.suit === bSuit ? t1.owner : t1.owner));
        state.scores[winner] += (t1.card.points + t2.card.points);
        state.table = [];
        
        setTimeout(() => {
            if (state.deck.length > 0) {
                state.players[winner].push(state.deck.pop());
                if (state.deck.length === 0) { state.players[1-winner].push(state.briscola); state.briscola = null; }
                else state.players[1-winner].push(state.deck.pop());
            }
            if (state.players[0].length === 0) { alert(state.scores[0] > 60 ? "VITTORIA!" : "SCONFITTA!"); return quitGame(); }
            state.turn = winner; state.isAnimating = false; renderView(); if (state.turn === 1) setTimeout(() => playCard(0, 1), 800);
        }, 600);
    };

    container.querySelector('#start-game-btn').onclick = () => {
        container.querySelector('#briscola-overlay').style.display = 'none';
        container.querySelector('#btn-exit-ingame').style.display = 'block';
        container.querySelector('#score-ui').style.display = 'block';
        container.querySelector('#bot-side').style.display = 'flex';
        container.querySelector('#mid-table').style.display = 'flex';
        container.querySelector('#player-side').style.display = 'flex';
        state.deck = []; SUITS.forEach(s => VALUES.forEach(v => state.deck.push({ suit: s.id, ...v })));
        state.deck.sort(() => Math.random() - 0.5);
        for(let i=0; i<3; i++) { state.players[0].push(state.deck.pop()); state.players[1].push(state.deck.pop()); }
        state.briscola = state.deck.pop(); state.lastBriscolaSuit = state.briscola.suit;
        state.gameActive = true; renderView();
    };
}
