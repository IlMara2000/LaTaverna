import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';

export function initBriscola(container) {
    updateSidebarContext("home"); 
    const menuTrigger = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (menuTrigger) menuTrigger.style.display = 'none';

    const SUITS = ['bastoni', 'coppe', 'denari', 'spade'];
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
        .briscola-wrapper { width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white; font-family: sans-serif; }
        .b-card { width: 75px; height: 110px; border-radius: 12px; background: #fff; color: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; box-shadow: 0 5px 15px rgba(0,0,0,0.5); cursor: pointer; transition: 0.2s; border: 2px solid rgba(255,255,255,0.1); user-select: none; }
        .b-card.back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1.5px solid #9d4ede; color: #9d4ede; font-size: 10px; }
        .active-glow { box-shadow: 0 0 20px #9d4edeaa; background: rgba(157, 78, 221, 0.1); border-radius: 15px; }
        .btn-exit { position: absolute; top: 20px; left: 20px; background: rgba(255,68,68,0.2); border: 1px solid #ff4444; color: white; padding: 8px 15px; border-radius: 10px; font-size: 11px; cursor: pointer; z-index: 100; font-weight: bold; }
        .btn-start { background: #9d4ede; color: black; padding: 18px 60px; border-radius: 50px; font-weight: 900; border: none; cursor: pointer; font-size: 1.2rem; box-shadow: 0 0 20px #9d4ede66; }
    </style>
    <div class="briscola-wrapper">
        <button class="btn-exit" id="exit-briscola">ESCI</button>
        
        <div id="briscola-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:5000; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:20px; backdrop-filter: blur(10px);">
            <h1 style="color:#9d4ede; font-size:3.5rem; font-weight:900; text-shadow: 0 0 20px #9d4ede66;">BRISCOLA</h1>
            <button class="btn-start" id="start-game-btn">INIZIA PARTITA</button>
        </div>

        <div id="bot-side" style="position:absolute; top:60px; left:50%; transform:translateX(-50%); display:flex; gap:10px; padding:15px; transition: 0.3s;"></div>

        <div id="mid-table" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); display:flex; align-items:center; gap:40px;">
            <div style="position:relative; width:80px; height:120px;">
                <div id="briscola-slot" style="position:absolute; left:35px; transform:rotate(90deg);"></div>
                <div class="b-card back" style="position:absolute; left:0; cursor:default; display:flex; align-items:center; justify-content:center;">MAZZO</div>
            </div>
            <div id="played-cards" style="display:flex; gap:15px; min-width:180px; justify-content:center;"></div>
        </div>

        <div style="position:absolute; right:20px; top:20px; text-align:right; font-family:monospace; background: rgba(0,0,0,0.4); padding: 10px; border-radius: 10px; border: 1px solid rgba(157,78,221,0.2);">
            TU: <span id="s0" style="color:#9d4ede; font-weight:bold;">0</span><br>
            BOT: <span id="s1" style="color:#ff4444; font-weight:bold;">0</span>
        </div>

        <div id="player-side" style="position:absolute; bottom:80px; left:50%; transform:translateX(-50%); display:flex; gap:12px; padding:15px; transition: 0.3s;"></div>
    </div>
    `;

    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } };

    const getCardUI = (c) => {
        if (!c) return '';
        const icons = { bastoni: '🪵', coppe: '🏆', denari: '💰', spade: '⚔️' };
        return `
            <span style="font-size:10px; opacity:0.5; margin-bottom:5px;">${c.suit.toUpperCase()}</span>
            <span style="font-size:1.8rem; margin:2px 0;">${icons[c.suit]}</span>
            <span style="font-size:14px; font-weight:900;">${c.name}</span>
        `;
    };

    const renderView = () => {
        if (!state.gameActive) return;
        
        const briscolaSlot = document.getElementById('briscola-slot');
        if (state.deck.length > 0 || state.briscola) {
             briscolaSlot.innerHTML = `<div class="b-card">${getCardUI(state.briscola)}</div>`;
        } else {
             briscolaSlot.innerHTML = '';
        }
        
        const botSide = document.getElementById('bot-side');
        botSide.innerHTML = state.players[1].map(() => `<div class="b-card back"></div>`).join('');
        botSide.className = state.turn === 1 ? 'active-glow' : '';

        const playerSide = document.getElementById('player-side');
        playerSide.innerHTML = state.players[0].map((c, i) => `<div class="b-card" data-idx="${i}">${getCardUI(c)}</div>`).join('');
        playerSide.className = state.turn === 0 ? 'active-glow' : '';

        document.getElementById('played-cards').innerHTML = state.table.map(t => `<div class="b-card">${getCardUI(t.card)}</div>`).join('');
        document.getElementById('s0').innerText = state.scores[0];
        document.getElementById('s1').innerText = state.scores[1];

        playerSide.querySelectorAll('.b-card').forEach(card => {
            card.onclick = () => { if(state.turn === 0 && !state.isAnimating) playCard(parseInt(card.dataset.idx), 0); };
        });
    };

    const playCard = (idx, pIdx) => {
        state.isAnimating = true;
        state.table.push({ card: state.players[pIdx].splice(idx, 1)[0], owner: pIdx });
        renderView();

        if (state.table.length === 2) {
            setTimeout(resolveRound, 1000);
        } else {
            state.turn = 1 - pIdx;
            state.isAnimating = false;
            renderView();
            if (state.turn === 1) setTimeout(() => playCard(0, 1), 1000);
        }
    };

    const resolveRound = () => {
        const [t1, t2] = state.table;
        let winIdx;

        if (t1.card.suit === t2.card.suit) {
            winIdx = t1.card.rank > t2.card.rank ? t1.owner : t2.owner;
        } else if (t2.card.suit === state.briscola.suit) {
            winIdx = t2.owner;
        } else {
            winIdx = t1.owner;
        }

        state.scores[winIdx] += (t1.card.points + t2.card.points);
        state.table = [];

        setTimeout(() => {
            if (state.deck.length > 0) {
                state.players[winIdx].push(state.deck.pop());
                state.players[1 - winIdx].push(state.deck.pop());
            }

            if (state.players[0].length === 0 && state.deck.length === 0) {
                const msg = state.scores[0] > 60 ? "HAI VINTO!" : (state.scores[0] === 60 ? "PAREGGIO!" : "HAI PERSO!");
                alert(`${msg}\nPunteggio: ${state.scores[0]} a ${state.scores[1]}`);
                return initBriscola(container);
            }

            state.turn = winIdx;
            state.isAnimating = false;
            renderView();
            if (state.turn === 1) setTimeout(() => playCard(0, 1), 1000);
        }, 500);
    };

    document.getElementById('start-game-btn').onclick = () => {
        document.getElementById('briscola-overlay').style.display = 'none';
        state.deck = [];
        SUITS.forEach(s => VALUES.forEach(v => state.deck.push({ suit: s, ...v })));
        shuffle(state.deck);
        
        for(let i=0; i<3; i++) { 
            state.players[0].push(state.deck.pop()); 
            state.players[1].push(state.deck.pop()); 
        }
        
        state.briscola = state.deck[0]; 
        state.gameActive = true;
        renderView();
    };

    document.getElementById('exit-briscola').onclick = () => {
        if (menuTrigger) menuTrigger.style.display = 'flex';
        showLobby(container);
    };
}
