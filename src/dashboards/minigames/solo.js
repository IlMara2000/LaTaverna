import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

const COLORS = ['red', 'blue', 'green', 'yellow'];
const getHex = (color) => {
    const hex = { red: '#ff4444', blue: '#0066ff', green: '#33cc33', yellow: '#ffcc00', wild: '#222' };
    return hex[color] || '#ffffff';
};

export function initSoloGame(container) {
    updateSidebarContext("minigames");
    
    let state = {
        deck: [], discardPile: [], players: [[], [], [], []], 
        turn: 0, direction: 1, currentColor: '', currentVal: '',
        gameActive: false, isAnimating: false, hasSaidSolo: false,
        pendingPenalty: false
    };

    renderLayout(container);
    attachInitialListeners(container, state);
}

function renderLayout(container) {
    container.innerHTML = `
    <style>
        .game-bg { width:100%; height:100dvh; background: radial-gradient(circle at top, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white; font-family: 'Inter', sans-serif; }
        
        /* Dashboard Bot */
        .opponents-container { display: flex; justify-content: space-around; padding: 15px; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(157,78,221,0.2); }
        .bot-status { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px; border-radius: 12px; transition: 0.3s; opacity: 0.5; min-width: 80px;}
        .bot-status.active { opacity: 1; background: rgba(157, 78, 221, 0.2); box-shadow: 0 0 15px #9d4ede66; transform: scale(1.1); }
        .card-count { font-weight: 900; background: #9d4ede; color: black; padding: 2px 8px; border-radius: 10px; font-size: 12px; }

        /* Centro Tavolo */
        .table-center { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%); text-align: center; width: 100%; }
        .pile-container { display: flex; justify-content: center; gap: 20px; align-items: center; margin-bottom: 20px; }
        
        .card-solo { width: 75px; height: 110px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.5rem; border: 2px solid rgba(255,255,255,0.2); position: relative; transition: 0.3s; box-shadow: 0 10px 20px rgba(0,0,0,0.5); }
        .card-back { background: linear-gradient(135deg, #4b1a8a, #1a0536); border: 2px solid #9d4ede; color: #9d4ede; }
        
        .current-color-indicator { width: 100px; height: 4px; margin: 10px auto; border-radius: 2px; transition: 0.5s; }

        /* Area Giocatore */
        .player-ui { position: absolute; bottom: 0; width: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); padding: 20px 0; border-top: 1px solid rgba(255,255,255,0.1); }
        .hand-scroll { display: flex; gap: 10px; overflow-x: auto; padding: 0 20px 15px 20px; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; }
        .hand-scroll::-webkit-scrollbar { display: none; }
        
        .action-bar { display: flex; justify-content: center; gap: 15px; padding: 0 20px; }
        .btn-solo { background: #e74c3c; color: white; border: none; padding: 12px 25px; border-radius: 10px; font-weight: 900; text-transform: uppercase; display: none; }
        .btn-solo.pulse { animation: pulseSolo 0.8s infinite; display: block; }
        
        @keyframes pulseSolo { 0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); } 70% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(231, 76, 60, 0); } 100% { transform: scale(1); } }

        /* Pickers */
        #picker-wild { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:9000; grid-template-columns: 1fr 1fr; gap: 15px; padding: 40px; align-content: center; }
        .color-tile { height: 120px; border-radius: 20px; border: 3px solid rgba(255,255,255,0.2); }
    </style>

    <div class="game-bg">
        <div id="start-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <h1 style="font-size:4rem; font-weight:900; color:#9d4ede; letter-spacing:-2px;">SOLO</h1>
            <button id="btn-start" style="background:#9d4ede; border:none; padding:20px 50px; border-radius:50px; color:black; font-weight:900; font-size:1.2rem; cursor:pointer;">GIOCA VS BOT</button>
        </div>

        <div class="opponents-container">
            <div id="bot-stat-1" class="bot-status"><span>BOT 1</span><div class="card-count" id="cnt-1">7</div></div>
            <div id="bot-stat-2" class="bot-status"><span>BOT 2</span><div class="card-count" id="cnt-2">7</div></div>
            <div id="bot-stat-3" class="bot-status"><span>BOT 3</span><div class="card-count" id="cnt-3">7</div></div>
        </div>

        <div class="table-center">
            <div id="direction-info" style="font-size:1.5rem; margin-bottom:15px; color:#9d4ede; opacity:0.5;">↻</div>
            <div class="pile-container">
                <div id="deck-draw" class="card-solo card-back">SOLO</div>
                <div id="discard-pile" class="card-solo" style="background:white; color:black; transform: rotate(3deg);"></div>
            </div>
            <div id="color-line" class="current-color-indicator"></div>
        </div>

        <div class="player-ui">
            <div id="player-hand" class="hand-scroll"></div>
            <div class="action-bar">
                <button id="solo-alert" class="btn-solo">SOLO!</button>
            </div>
        </div>

        <div id="picker-wild">
            ${COLORS.map(c => `<div class="color-tile" data-color="${c}" style="background:${getHex(c)}"></div>`).join('')}
        </div>
    </div>
    `;
}

function attachInitialListeners(container, state) {
    document.getElementById('btn-start').onclick = () => {
        document.getElementById('start-overlay').style.display = 'none';
        startGame(state);
    };

    document.getElementById('deck-draw').onclick = () => {
        if (state.turn === 0 && !state.isAnimating) {
            drawCard(0, state, true);
        }
    };

    document.getElementById('solo-alert').onclick = () => {
        state.hasSaidSolo = true;
        document.getElementById('solo-alert').classList.remove('pulse');
    };

    document.querySelectorAll('.color-tile').forEach(tile => {
        tile.onclick = () => {
            state.currentColor = tile.dataset.color;
            document.getElementById('picker-wild').style.display = 'none';
            endTurn(state);
        };
    });
}

function startGame(state) {
    state.deck = [];
    // Crea mazzo standard 108 carte
    COLORS.forEach(c => {
        state.deck.push({color: c, val: '0'});
        for(let i=1; i<=9; i++) {
            state.deck.push({color: c, val: i.toString()});
            state.deck.push({color: c, val: i.toString()});
        }
        for(let j=0; j<2; j++) {
            state.deck.push({color: c, val: 'SKIP'});
            state.deck.push({color: c, val: 'REV'});
            state.deck.push({color: c, val: '+2'});
        }
    });
    for(let i=0; i<4; i++) {
        state.deck.push({color: 'wild', val: 'WILD'});
        state.deck.push({color: 'wild', val: '+4'});
    }
    
    state.deck.sort(() => Math.random() - 0.5);

    // Distribuisci
    for(let p=0; p<4; p++) {
        state.players[p] = [];
        for(let i=0; i<7; i++) state.players[p].push(state.deck.pop());
    }

    // Prima carta (non deve essere speciale per semplicità start)
    let first;
    do { first = state.deck.pop(); if(first.color === 'wild') state.deck.unshift(first); } 
    while(first.color === 'wild');

    state.currentColor = first.color;
    state.currentVal = first.val;
    state.discardPile.push(first);
    state.gameActive = true;
    updateUI(state);
}

function drawCard(pIdx, state, manual = false) {
    if (state.deck.length === 0) {
        const top = state.discardPile.pop();
        state.deck = [...state.discardPile].sort(() => Math.random() - 0.5);
        state.discardPile = [top];
    }
    
    const card = state.deck.pop();
    state.players[pIdx].push(card);
    
    if (pIdx === 0 && manual) {
        // Se l'umano pesca, può giocare subito se valida o passare
        const canPlay = card.color === 'wild' || card.color === state.currentColor || card.val === state.currentVal;
        if (!canPlay) setTimeout(() => endTurn(state), 500);
    }
    updateUI(state);
}

function playCard(pIdx, cardIdx, state) {
    const card = state.players[pIdx][cardIdx];
    
    // Regola +4: si può giocare solo se non hai il colore corrente (Regolamento ufficiale)
    if (card.val === '+4' && pIdx === 0) {
        const hasColor = state.players[0].some(c => c.color === state.currentColor);
        if (hasColor) {
            alert("Puoi giocare il +4 solo se non hai carte del colore corrente!");
            return;
        }
    }

    // Validazione base
    if (card.color !== 'wild' && card.color !== state.currentColor && card.val !== state.currentVal) return;

    // Controllo "SOLO!"
    if (pIdx === 0 && state.players[0].length === 2 && !state.hasSaidSolo) {
        state.pendingPenalty = true;
    }

    state.players[pIdx].splice(cardIdx, 1);
    state.discardPile.push(card);
    state.currentVal = card.val;
    if (card.color !== 'wild') state.currentColor = card.color;

    // Gestione Effetti Speciali
    if (card.val === 'REV') {
        state.direction *= -1;
        document.getElementById('direction-info').innerText = state.direction === 1 ? '↻' : '↺';
    }
    
    if (card.val === 'SKIP') nextTurn(state);
    if (card.val === '+2') {
        const target = (state.turn + state.direction + 4) % 4;
        drawCard(target, state); drawCard(target, state);
        nextTurn(state);
    }
    if (card.val === '+4') {
        const target = (state.turn + state.direction + 4) % 4;
        for(let i=0; i<4; i++) drawCard(target, state);
        nextTurn(state);
    }

    if (card.color === 'wild') {
        if (pIdx === 0) {
            document.getElementById('picker-wild').style.display = 'grid';
        } else {
            // Bot sceglie colore più frequente
            const counts = {};
            state.players[pIdx].forEach(c => { if(c.color !== 'wild') counts[c.color] = (counts[c.color] || 0) + 1; });
            state.currentColor = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, COLORS[0]);
            endTurn(state);
        }
    } else {
        endTurn(state);
    }
}

function nextTurn(state) {
    state.turn = (state.turn + state.direction + 4) % 4;
}

function endTurn(state) {
    if (state.pendingPenalty) {
        alert("Non hai detto SOLO! +2 carte.");
        drawCard(0, state); drawCard(0, state);
        state.pendingPenalty = false;
    }
    
    state.hasSaidSolo = false;
    updateUI(state);
    
    if (checkWin(state)) return;
    
    nextTurn(state);
    updateUI(state);

    if (state.turn !== 0) {
        setTimeout(() => botLogic(state), 1200);
    }
}

function botLogic(state) {
    const pIdx = state.turn;
    const hand = state.players[pIdx];
    
    // Se bot resta con 1 carta, lui dice sempre "SOLO" (100% probabilità qui)
    if (hand.length === 2) {
        // simuliamo l'esclamazione
    }

    const playableIdx = hand.findIndex(c => c.color === 'wild' || c.color === state.currentColor || c.val === state.currentVal);
    
    if (playableIdx !== -1) playCard(pIdx, playableIdx, state);
    else {
        drawCard(pIdx, state);
        // Ritenta dopo pesca
        const newHand = state.players[pIdx];
        const lastCard = newHand[newHand.length-1];
        if (lastCard.color === 'wild' || lastCard.color === state.currentColor || lastCard.val === state.currentVal) {
            playCard(pIdx, newHand.length-1, state);
        } else {
            endTurn(state);
        }
    }
}

function checkWin(state) {
    for(let i=0; i<4; i++) {
        if (state.players[i].length === 0) {
            alert(i === 0 ? "🏆 VITTORIA SUPREMA!" : `💻 IL BOT ${i} HA VINTO!`);
            location.reload();
            return true;
        }
    }
    return false;
}

function updateUI(state) {
    // Top Pile
    const top = state.discardPile[state.discardPile.length-1];
    const dp = document.getElementById('discard-pile');
    dp.style.backgroundColor = getHex(top.color === 'wild' ? 'wild' : top.color);
    dp.style.color = (top.color === 'yellow' || top.color === 'wild') ? 'black' : 'white';
    dp.innerText = top.val;
    
    document.getElementById('color-line').style.background = getHex(state.currentColor);

    // Player Hand
    const pArea = document.getElementById('player-hand');
    pArea.innerHTML = state.players[0].map((c, i) => `
        <div class="card-solo" style="background:${getHex(c.color)}; color:${c.color === 'yellow' ? 'black' : 'white'}; min-width:70px;" data-idx="${i}">
            ${c.val}
        </div>
    `).join('');
    
    pArea.querySelectorAll('.card-solo').forEach(el => {
        el.onclick = () => { if(state.turn === 0) playCard(0, parseInt(el.dataset.idx), state); };
    });

    // Solo Button show/hide
    const soloBtn = document.getElementById('solo-alert');
    if (state.players[0].length === 2 && state.turn === 0) {
        soloBtn.classList.add('pulse');
    } else {
        soloBtn.classList.remove('pulse');
    }

    // Bots stats
    for(let i=1; i<=3; i++) {
        const el = document.getElementById(`bot-stat-${i}`);
        el.classList.toggle('active', state.turn === i);
        document.getElementById(`cnt-${i}`).innerText = state.players[i].length;
    }
}