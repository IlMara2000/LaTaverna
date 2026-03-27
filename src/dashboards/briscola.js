import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';

export function initBriscola(container) {
    // 1. Reset e Setup Iniziale
    updateSidebarContext("home"); 
    const menuTrigger = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (menuTrigger) menuTrigger.style.display = 'none';

    // 2. Variabili locali (protette dentro la funzione per non andare in conflitto con SOLO)
    const SUITS = ['bastoni', 'coppe', 'denari', 'spade'];
    const VALUES = [
        { n: 'Asso', v: 11, rank: 10 }, { n: '3', v: 10, rank: 9 },
        { n: 'Re', v: 4, rank: 8 }, { n: 'Cavallo', v: 3, rank: 7 },
        { n: 'Fante', v: 2, rank: 6 }, { n: '7', v: 0, rank: 5 },
        { n: '6', v: 0, rank: 4 }, { n: '5', v: 0, rank: 3 },
        { n: '4', v: 0, rank: 2 }, { n: '2', v: 0, rank: 1 }
    ];

    let state = {
        deck: [], players: [[], []], table: [], 
        briscola: null, turn: 0, scores: [0, 0],
        gameActive: false, isAnimating: false
    };

    // 3. Render Interfaccia
    container.innerHTML = `
    <style>
        .briscola-wrapper { width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white; }
        .b-card { width: 70px; height: 105px; border-radius: 12px; background: #fff; color: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; box-shadow: 0 5px 15px rgba(0,0,0,0.5); cursor: pointer; transition: 0.2s; border: 2px solid rgba(255,255,255,0.1); }
        .b-card.back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1.5px solid #9d4ede; color: #9d4ede; font-size: 10px; }
        .active-glow { box-shadow: 0 0 20px #9d4ede66; background: rgba(157, 78, 221, 0.05); border-radius: 15px; }
        .btn-exit { position: absolute; top: 20px; left: 20px; background: rgba(255,68,68,0.2); border: 1px solid #ff4444; color: white; padding: 8px 15px; border-radius: 10px; font-size: 11px; cursor: pointer; z-index: 100; }
        .btn-start { background: #9d4ede; color: black; padding: 15px 50px; border-radius: 50px; font-weight: 900; border: none; cursor: pointer; font-size: 1.2rem; }
    </style>
    <div class="briscola-wrapper">
        <button class="btn-exit" id="exit-briscola">ESCI</button>
        
        <div id="briscola-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:5000; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:20px;">
            <h1 style="color:#9d4ede; font-size:3.5rem; font-weight:900;">BRISCOLA</h1>
            <button class="btn-start" id="start-game-btn">INIZIA PARTITA</button>
        </div>

        <div id="bot-side" style="position:absolute; top:50px; left:50%; transform:translateX(-50%); display:flex; gap:10px; padding:10px;"></div>

        <div id="mid-table" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); display:flex; align-items:center; gap:40px;">
            <div style="position:relative; width:80px; height:120px;">
                <div id="briscola-slot" style="position:absolute; left:30px; transform:rotate(90deg);"></div>
                <div class="b-card back" style="position:absolute; left:0; cursor:default;">MAZZO</div>
            </div>
            <div id="played-cards" style="display:flex; gap:15px; min-width:160px; justify-content:center;"></div>
        </div>

        <div style="position:absolute; right:20px; top:20px; text-align:right; font-family:monospace;">
            PLAYER: <span id="s0" style="color:#9d4ede;">0</span><br>
            BOT: <span id="s1" style="color:#ff4444;">0</span>
        </div>

        <div id="player-side" style="position:absolute; bottom:60px; left:50%; transform:translateX(-50%); display:flex; gap:10px; padding:10px;"></div>
    </div>
    `;

    // 4. Logica Interna
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } };

    const renderView = () => {
        if (!state.gameActive) return;
        document.getElementById('briscola-slot').innerHTML = `<div class="b-card">${getCardUI(state.briscola)}</div>`;
        
        const botSide = document.getElementById('bot-side');
        botSide.innerHTML = state.players[1].map(() => `<div class="b-card back"></div>`).join('');
        botSide.classList.toggle('active-glow', state.turn === 1);

        const playerSide = document.getElementById('player-side');
        playerSide.innerHTML = state.players[0].map((c, i) => `<div class="b-card" data-idx="${i}">${getCardUI(c)}</div>`).join('');
        playerSide.classList.toggle('active-glow', state.turn === 0);

        document.getElementById('played-cards').innerHTML = state.table.map(t => `<div class="b-card">${getCardUI(t.card)}</div>`).join('');
        document.getElementById('s0').innerText = state.scores[0];
        document.getElementById('s1').innerText = state.scores[1];

        // Event Listeners per le carte
        playerSide.querySelectorAll('.b-card').forEach(card => {
            card.onclick = () => { if(state.turn === 0) playCard(parseInt(card.dataset.idx), 0); };
        });
    };

    const getCardUI = (c) => {
        if (!c) return '';
        const icons = { bastoni: '🪵', coppe: '🏆', denari: '💰', spade: '⚔️' };
        return `<span style="font-size:8px;opacity:0.5">${c.suit}</span><span style="font-size:1.4rem;margin:4px 0">${icons[c.suit]}</span><span style="font-size:12px">${c.name}</span>`;
    };

    const playCard = (idx, pIdx) => {
        if (state.isAnimating) return;
        state.isAnimating = true;
        state.table.push({ card: state.players[pIdx].splice(idx, 1)[0], owner: pIdx });
        renderView();

        if (state.table.length === 2) {
            setTimeout(resolveRound, 1000);
        } else {
            state.turn = 1 - pIdx;
            state.isAnimating = false;
            if (state.turn === 1) setTimeout(() => playCard(0, 1), 1000);
            renderView();
        }
    };

    const resolveRound = () => {
        const [t1, t2] = state.table;
        let winIdx = (t1.card.suit === t2.card.suit) 
            ? (t1.card.rank > t2.card.rank ? t1.owner : t2.owner)
            : (t2.card.suit === state.briscola.suit ? t2.owner : t1.owner);

        state.scores[winIdx] += (t1.card.points + t2.card.points);
        state.table = [];

        if (state.deck.length > 0) {
            state.players[winIdx].push(state.deck.pop());
            state.players[1-winIdx].push(state.deck.pop());
        }

        if (state.players[0].length === 0) {
            alert(`Fine! Punteggio: ${state.scores[0]} a ${state.scores[1]}`);
            return initBriscola(container);
        }

        state.turn = winIdx;
        state.isAnimating = false;
        renderView();
        if (state.turn === 1) setTimeout(() => playCard(0, 1), 1000);
    };

    // 5. Eventi pulsanti
    document.getElementById('start-game-btn').onclick = () => {
        document.getElementById('briscola-overlay').style.display = 'none';
        state.deck = [];
        SUITS.forEach(s => VALUES.forEach(v => state.deck.push({ suit: s, ...v })));
        shuffle(state.deck);
        for(let i=0; i<3; i++) { state.players[0].push(state.deck.pop()); state.players[1].push(state.deck.pop()); }
        state.briscola = state.deck[0];
        state.gameActive = true;
        renderView();
    };

    document.getElementById('exit-briscola').onclick = () => {
        if (menuTrigger) menuTrigger.style.display = 'flex';
        showLobby(container);
    };
}
