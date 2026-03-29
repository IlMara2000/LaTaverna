import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

const COLORS = ['red', 'blue', 'green', 'yellow'];
const getHex = (color) => {
    const hex = { red: '#ff4b2b', blue: '#00d2ff', green: '#2ecc71', yellow: '#f1c40f', wild: '#1a1a1a' };
    return hex[color] || '#ffffff';
};

const getCardContent = (val) => {
    const symbols = { 'SKIP': '🚫', 'REV': '🔄', 'WILD': '🌈' };
    // Ritorna il numero per +2 e +4 invece delle emoji
    return symbols[val] || val;
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
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;900&display=swap');
        .game-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%); position:relative; overflow:hidden; color:white; font-family: 'Poppins', sans-serif; }
        
        .opponents-container { display: flex; justify-content: space-around; padding: 15px; position: absolute; top: 0; width: 100%; z-index: 10; }
        .bot-status { display: flex; flex-direction: column; align-items: center; padding: 12px; border-radius: 20px; background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.1); transition: 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); min-width: 90px; }
        .bot-status.active { border-color: #00d2ff; box-shadow: 0 0 30px rgba(0, 210, 255, 0.5); transform: scale(1.1); background: rgba(0, 210, 255, 0.15); }
        .card-count { font-weight: 900; color: #00d2ff; font-size: 1.4rem; }

        .table-center { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%); text-align: center; width: 100%; }
        .pile-container { display: flex; justify-content: center; gap: 40px; align-items: center; perspective: 1200px; }
        
        /* Card Design */
        .card-solo { width: 90px; height: 130px; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 2rem; border: 3px solid rgba(255,255,255,0.9); position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.4); user-select: none; transition: transform 0.2s; }
        .card-back { background: linear-gradient(135deg, #1a1a1a 0%, #434343 100%); }
        .card-back::after { content: 'S'; font-size: 3rem; opacity: 0.1; }
        
        .flying-card { position: fixed; z-index: 9999; pointer-events: none; transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1); }

        /* Turn Indicator Overlay */
        #turn-announcer { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 4rem; font-weight: 900; pointer-events: none; opacity: 0; z-index: 5000; text-shadow: 0 0 20px rgba(0,0,0,0.5); transition: 0.4s; }
        #turn-announcer.show { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }

        .player-ui { position: absolute; bottom: 0; width: 100%; z-index: 20; display: flex; flex-direction: column; align-items: center; padding-bottom: 20px; }
        .hand-scroll { display: flex; gap: -15px; padding: 20px; overflow-x: auto; scrollbar-width: none; min-height: 180px; align-items: flex-end; width: 90%; justify-content: center; }
        .hand-scroll::-webkit-scrollbar { display: none; }
        
        .card-solo.playable:hover { transform: translateY(-30px) rotate(2deg); z-index: 100; cursor: pointer; }

        .btn-solo { background: linear-gradient(45deg, #ff416c, #ff4b2b); color: white; border: none; padding: 12px 35px; border-radius: 50px; font-weight: 900; display: none; margin-bottom: 10px; border: 2px solid white; cursor: pointer; }
        .btn-solo.pulse { display: block; animation: pulse 0.8s infinite alternate; }
        @keyframes pulse { from { transform: scale(1); } to { transform: scale(1.1); box-shadow: 0 0 20px #ff416c; } }

        #picker-wild { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); backdrop-filter: blur(15px); z-index:10000; grid-template-columns: 1fr 1fr; gap: 20px; padding: 40px; align-content: center; }
        .color-tile { height: 120px; border-radius: 20px; cursor: pointer; transition: 0.2s; }
        .color-tile:hover { transform: scale(1.05); }

        #start-overlay { position:fixed; inset:0; background:#090a0f; z-index:11000; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    </style>

    <div class="game-bg">
        <div id="turn-announcer">TUO TURNO!</div>
        <div id="start-overlay">
            <h1 style="font-size:5rem; font-weight:900; margin:0;">SOLO</h1>
            <button id="btn-start" style="margin-top:30px; padding:15px 50px; border-radius:50px; font-weight:900; cursor:pointer;">START</button>
        </div>

        <div class="opponents-container">
            ${[1,2,3].map(i => `<div id="bot-stat-${i}" class="bot-status"><span>BOT ${i}</span><div class="card-count" id="cnt-${i}">7</div></div>`).join('')}
        </div>

        <div class="table-center">
            <div id="direction-info" style="font-size:3rem; margin-bottom:10px;">↻</div>
            <div class="pile-container">
                <div id="deck-draw" class="card-solo card-back"></div>
                <div id="discard-pile" class="card-solo" style="background:white; color:black;"></div>
            </div>
            <div id="color-line" style="width:100px; height:8px; margin:25px auto; border-radius:10px; transition:0.5s;"></div>
        </div>

        <div class="player-ui">
            <button id="solo-alert" class="btn-solo">SOLO!</button>
            <div class="hand-scroll" id="player-hand"></div>
        </div>

        <div id="picker-wild">
            ${COLORS.map(c => `<div class="color-tile" data-color="${c}" style="background:${getHex(c)}"></div>`).join('')}
        </div>
    </div>`;
}

async function animateCard(fromEl, toEl, cardData, isBack = false) {
    return new Promise(resolve => {
        const from = fromEl.getBoundingClientRect();
        const to = toEl.getBoundingClientRect();
        const flyer = document.createElement('div');
        flyer.className = `card-solo flying-card ${isBack ? 'card-back' : ''}`;
        if (!isBack) {
            flyer.style.backgroundColor = getHex(cardData.color);
            flyer.innerText = getCardContent(cardData.val);
            flyer.style.color = (cardData.color === 'yellow' || cardData.color === 'wild') ? 'black' : 'white';
        }
        flyer.style.cssText += `left:${from.left}px; top:${from.top}px; width:${from.width}px; height:${from.height}px;`;
        document.body.appendChild(flyer);
        
        requestAnimationFrame(() => {
            flyer.style.left = `${to.left}px`;
            flyer.style.top = `${to.top}px`;
            flyer.style.transform = `rotate(${Math.random()*20-10}deg)`;
            setTimeout(() => { flyer.remove(); resolve(); }, 500);
        });
    });
}

function attachInitialListeners(container, state) {
    document.getElementById('btn-start').onclick = () => {
        document.getElementById('start-overlay').style.display = 'none';
        startGame(state);
    };
    document.getElementById('deck-draw').onclick = () => {
        if (state.turn === 0 && !state.isAnimating) drawCard(0, state, true);
    };
    document.getElementById('solo-alert').onclick = () => {
        state.hasSaidSolo = true;
        document.getElementById('solo-alert').classList.remove('pulse');
    };
    document.querySelectorAll('.color-tile').forEach(t => {
        t.onclick = () => {
            state.currentColor = t.dataset.color;
            document.getElementById('picker-wild').style.display = 'none';
            endTurn(state);
        };
    });
}

function startGame(state) {
    state.deck = [];
    COLORS.forEach(c => {
        for(let i=0; i<=9; i++) { state.deck.push({color:c, val:i.toString()}); if(i>0) state.deck.push({color:c, val:i.toString()}); }
        ['SKIP', 'REV', '+2'].forEach(v => { state.deck.push({color:c, val:v}); state.deck.push({color:c, val:v}); });
    });
    for(let i=0; i<4; i++) { state.deck.push({color:'wild', val:'WILD'}); state.deck.push({color:'wild', val:'+4'}); }
    state.deck.sort(() => Math.random() - 0.5);

    for(let p=0; p<4; p++) {
        state.players[p] = [];
        for(let i=0; i<7; i++) state.players[p].push(state.deck.pop());
    }

    let first = state.deck.pop();
    while(first.color === 'wild') { state.deck.unshift(first); first = state.deck.pop(); }
    state.currentColor = first.color; state.currentVal = first.val;
    state.discardPile.push(first);
    state.gameActive = true;
    updateUI(state);
    announceTurn(state);
}

async function drawCard(pIdx, state, manual = false) {
    if (state.isAnimating) return;
    state.isAnimating = true;
    
    if (state.deck.length === 0) {
        const top = state.discardPile.pop();
        state.deck = [...state.discardPile].sort(() => Math.random() - 0.5);
        state.discardPile = [top];
    }

    const card = state.deck.pop();
    const target = pIdx === 0 ? document.getElementById('player-hand') : document.getElementById(`bot-stat-${pIdx}`);
    await animateCard(document.getElementById('deck-draw'), target, card, pIdx !== 0);
    
    state.players[pIdx].push(card);
    state.isAnimating = false;
    
    if (pIdx === 0 && manual) {
        const playable = card.color === 'wild' || card.color === state.currentColor || card.val === state.currentVal;
        if (!playable) setTimeout(() => endTurn(state), 500);
    }
    updateUI(state);
}

async function playCard(pIdx, cardIdx, state) {
    if (state.isAnimating) return;
    const card = state.players[pIdx][cardIdx];
    if (card.color !== 'wild' && card.color !== state.currentColor && card.val !== state.currentVal) return;

    state.isAnimating = true;
    const origin = pIdx === 0 ? document.querySelector(`[data-idx="${cardIdx}"]`) : document.getElementById(`bot-stat-${pIdx}`);
    await animateCard(origin, document.getElementById('discard-pile'), card);

    if (pIdx === 0 && state.players[0].length === 2 && !state.hasSaidSolo) state.pendingPenalty = true;

    state.players[pIdx].splice(cardIdx, 1);
    state.discardPile.push(card);
    state.currentVal = card.val;
    if (card.color !== 'wild') state.currentColor = card.color;

    if (card.val === 'REV') {
        state.direction *= -1;
        document.getElementById('direction-info').style.transform = `rotate(${state.direction === 1 ? 0 : 180}deg)`;
    }

    let skipNext = card.val === 'SKIP';
    
    if (card.val === '+2' || card.val === '+4') {
        const target = (state.turn + state.direction + 4) % 4;
        const count = card.val === '+2' ? 2 : 4;
        state.isAnimating = false;
        for(let i=0; i<count; i++) await drawCard(target, state);
        state.isAnimating = true;
        skipNext = true;
    }

    state.isAnimating = false;
    if (skipNext) state.turn = (state.turn + state.direction + 4) % 4;

    if (card.color === 'wild') {
        if (pIdx === 0) document.getElementById('picker-wild').style.display = 'grid';
        else {
            const colors = state.players[pIdx].map(c => c.color).filter(c => c !== 'wild');
            state.currentColor = colors.length ? colors[0] : COLORS[0];
            endTurn(state);
        }
    } else endTurn(state);
}

function announceTurn(state) {
    const el = document.getElementById('turn-announcer');
    el.innerText = state.turn === 0 ? "TUO TURNO!" : `TURNO BOT ${state.turn}`;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1000);
}

function endTurn(state) {
    if (state.pendingPenalty) {
        alert("SOLO dimenticato! +2");
        drawCard(0, state); drawCard(0, state);
        state.pendingPenalty = false;
    }
    updateUI(state);
    if (state.players[state.turn].length === 0) {
        alert(state.turn === 0 ? "HAI VINTO!" : "BOT VINCE!");
        return location.reload();
    }
    state.turn = (state.turn + state.direction + 4) % 4;
    state.hasSaidSolo = false;
    announceTurn(state);
    updateUI(state);
    if (state.turn !== 0) setTimeout(() => botLogic(state), 1200);
}

function botLogic(state) {
    if (!state.gameActive || state.turn === 0) return;
    const hand = state.players[state.turn];
    const idx = hand.findIndex(c => c.color === 'wild' || c.color === state.currentColor || c.val === state.currentVal);
    if (idx !== -1) playCard(state.turn, idx, state);
    else drawCard(state.turn, state);
}

function updateUI(state) {
    const top = state.discardPile[state.discardPile.length-1];
    const dp = document.getElementById('discard-pile');
    dp.style.backgroundColor = getHex(top.color === 'wild' ? 'wild' : top.color);
    dp.style.color = (top.color === 'yellow' || top.color === 'wild') ? 'black' : 'white';
    dp.innerText = getCardContent(top.val);

    const colorLine = document.getElementById('color-line');
    colorLine.style.backgroundColor = getHex(state.currentColor);
    colorLine.style.boxShadow = `0 0 20px ${getHex(state.currentColor)}`;

    const hand = document.getElementById('player-hand');
    hand.innerHTML = state.players[0].map((c, i) => `
        <div class="card-solo playable" data-idx="${i}" 
             style="background:${getHex(c.color)}; color:${(c.color === 'yellow' || c.color === 'wild') ? 'black' : 'white'}">
            ${getCardContent(c.val)}
        </div>`).join('');

    hand.querySelectorAll('.card-solo').forEach(el => {
        el.onclick = () => { if(state.turn === 0 && !state.isAnimating) playCard(0, parseInt(el.dataset.idx), state); };
    });

    document.getElementById('solo-alert').classList.toggle('pulse', state.players[0].length === 2 && state.turn === 0);
    [1,2,3].forEach(i => {
        const el = document.getElementById(`bot-stat-${i}`);
        el.classList.toggle('active', state.turn === i);
        document.getElementById(`cnt-${i}`).innerText = state.players[i].length;
    });
}