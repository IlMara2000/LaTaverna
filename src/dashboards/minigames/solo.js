import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

const COLORS = ['red', 'blue', 'green', 'yellow'];

const getHex = (color) => {
    const hex = { red: '#ff4b2b', blue: '#00d2ff', green: '#2ecc71', yellow: '#f1c40f', wild: '#1a1a1a' };
    return hex[color] || '#ffffff';
};

// Sostituiti simboli con +2 e +4 come richiesto
const getCardContent = (val) => {
    const symbols = {
        'SKIP': '🚫',
        'REV': '🔄',
        '+2': '+2',
        'WILD': '🌈',
        '+4': '+4'
    };
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
        .bot-status { display: flex; flex-direction: column; align-items: center; padding: 10px; border-radius: 15px; background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); transition: 0.3s ease; min-width: 85px; }
        .bot-status.active { border-color: #00d2ff; box-shadow: 0 0 20px rgba(0, 210, 255, 0.3); transform: scale(1.05); background: rgba(0, 210, 255, 0.1); }
        .card-count { font-weight: 900; color: #00d2ff; font-size: 1.3rem; }

        .table-center { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); text-align: center; width: 100%; }
        .pile-container { display: flex; justify-content: center; gap: 40px; align-items: center; }
        
        .card-solo { width: 80px; height: 115px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.6rem; border: 3px solid rgba(255,255,255,0.9); position: relative; box-shadow: 0 8px 15px rgba(0,0,0,0.4); user-select: none; }
        .card-back { background: linear-gradient(135deg, #1a1a1a 0%, #434343 100%); border-color: #555; }
        .card-back::after { content: 'S'; font-size: 2rem; opacity: 0.2; }
        
        /* Animazione volo semplificata */
        .flying-card { position: fixed; z-index: 9999; pointer-events: none; transition: all 0.4s ease-out; }

        .player-ui { position: absolute; bottom: 0; width: 100%; z-index: 20; display: flex; flex-direction: column; align-items: center; padding-bottom: 20px; }
        .hand-container { width: 100%; display: flex; justify-content: center; }
        .hand-scroll { display: flex; gap: 8px; padding: 20px; overflow-x: auto; scrollbar-width: none; min-height: 150px; align-items: flex-end; }
        .hand-scroll::-webkit-scrollbar { display: none; }
        
        .card-solo.playable { transition: transform 0.2s ease; cursor: pointer; }
        .card-solo.playable:hover { transform: translateY(-15px); z-index: 10; }

        .btn-solo { background: linear-gradient(45deg, #ff416c, #ff4b2b); color: white; border: none; padding: 12px 35px; border-radius: 50px; font-weight: 900; margin-bottom: 10px; display: none; cursor:pointer; }
        .btn-solo.pulse { display: block; animation: miniPulse 0.6s infinite alternate; }
        
        @keyframes miniPulse { from { transform: scale(1); } to { transform: scale(1.08); } }

        #picker-wild { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); backdrop-filter: blur(15px); z-index:10000; grid-template-columns: 1fr 1fr; gap: 15px; padding: 30px; align-content: center; }
        .color-tile { height: 120px; border-radius: 20px; cursor: pointer; }
        
        #start-overlay { position:fixed; inset:0; background:#090a0f; z-index:11000; display:flex; flex-direction:column; align-items:center; justify-content:center; }
        .title-anim { font-size: 4.5rem; font-weight: 900; background: linear-gradient(to right, #00d2ff, #9d4ede); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    </style>

    <div class="game-bg">
        <div id="start-overlay">
            <h1 class="title-anim">SOLO</h1>
            <button id="btn-start" style="margin-top:30px; background:white; border:none; padding:15px 50px; border-radius:50px; color:#090a0f; font-weight:900; cursor:pointer;">GIOCA</button>
        </div>

        <div class="opponents-container">
            <div id="bot-stat-1" class="bot-status"><span>BOT 1</span><div class="card-count" id="cnt-1">7</div></div>
            <div id="bot-stat-2" class="bot-status"><span>BOT 2</span><div class="card-count" id="cnt-2">7</div></div>
            <div id="bot-stat-3" class="bot-status"><span>BOT 3</span><div class="card-count" id="cnt-3">7</div></div>
        </div>

        <div class="table-center">
            <div id="direction-info" style="font-size:2rem; margin-bottom:15px;">↻</div>
            <div class="pile-container">
                <div id="deck-draw" class="card-solo card-back"></div>
                <div id="discard-pile" class="card-solo" style="background:white; color:black;"></div>
            </div>
            <div id="color-line" style="width: 100px; height: 4px; margin: 25px auto; border-radius: 10px; transition: 0.4s;"></div>
        </div>

        <div class="player-ui">
            <button id="solo-alert" class="btn-solo">SOLO!</button>
            <div class="hand-container">
                <div id="player-hand" class="hand-scroll"></div>
            </div>
        </div>

        <div id="picker-wild">
            ${COLORS.map(c => `<div class="color-tile" data-color="${c}" style="background:${getHex(c)};"></div>`).join('')}
        </div>
    </div>
    `;
}

async function animateCard(fromEl, toEl, cardData, isBack = false) {
    return new Promise(resolve => {
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        
        const flyer = document.createElement('div');
        flyer.className = `card-solo flying-card ${isBack ? 'card-back' : ''}`;
        if (!isBack) {
            flyer.style.backgroundColor = getHex(cardData.color);
            flyer.innerText = getCardContent(cardData.val);
            flyer.style.color = (cardData.color === 'yellow' || cardData.color === 'wild') ? 'black' : 'white';
        }
        
        flyer.style.width = `${fromRect.width}px`;
        flyer.style.height = `${fromRect.height}px`;
        flyer.style.top = `${fromRect.top}px`;
        flyer.style.left = `${fromRect.left}px`;
        
        document.body.appendChild(flyer);

        // Trigger reflow
        flyer.getBoundingClientRect();

        // Semplificata: rotazione fissa e movimento fluido
        flyer.style.top = `${toRect.top}px`;
        flyer.style.left = `${toRect.left}px`;
        flyer.style.transform = `rotate(${Math.random() * 20 - 10}deg)`;

        setTimeout(() => {
            flyer.remove();
            resolve();
        }, 400); // Animazione più rapida
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
    COLORS.forEach(c => {
        state.deck.push({color: c, val: '0'});
        for(let i=1; i<=9; i++) {
            state.deck.push({color: c, val: i.toString()});
            state.deck.push({color: c, val: i.toString()});
        }
        ['SKIP', 'REV', '+2'].forEach(v => {
            state.deck.push({color: c, val: v});
            state.deck.push({color: c, val: v});
        });
    });
    for(let i=0; i<4; i++) {
        state.deck.push({color: 'wild', val: 'WILD'});
        state.deck.push({color: 'wild', val: '+4'});
    }
    
    state.deck.sort(() => Math.random() - 0.5);

    for(let p=0; p<4; p++) {
        state.players[p] = [];
        for(let i=0; i<7; i++) state.players[p].push(state.deck.pop());
    }

    let first = state.deck.pop();
    while(first.color === 'wild') { state.deck.unshift(first); first = state.deck.pop(); }

    state.currentColor = first.color;
    state.currentVal = first.val;
    state.discardPile.push(first);
    state.gameActive = true;
    updateUI(state);
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
    const targetEl = pIdx === 0 ? document.getElementById('player-hand') : document.getElementById(`bot-stat-${pIdx}`);
    
    await animateCard(document.getElementById('deck-draw'), targetEl, card, pIdx !== 0);
    
    state.players[pIdx].push(card);
    state.isAnimating = false;
    
    if (pIdx === 0 && manual) {
        const canPlay = card.color === 'wild' || card.color === state.currentColor || card.val === state.currentVal;
        if (!canPlay) setTimeout(() => endTurn(state), 300);
    }
    updateUI(state);
}

async function playCard(pIdx, cardIdx, state) {
    if (state.isAnimating) return;
    const card = state.players[pIdx][cardIdx];

    if (card.color !== 'wild' && card.color !== state.currentColor && card.val !== state.currentVal) return;

    state.isAnimating = true;
    const cardEl = pIdx === 0 ? document.querySelector(`[data-idx="${cardIdx}"]`) : document.getElementById(`bot-stat-${pIdx}`);
    
    await animateCard(cardEl, document.getElementById('discard-pile'), card);

    if (pIdx === 0 && state.players[0].length === 2 && !state.hasSaidSolo) {
        state.pendingPenalty = true;
    }

    state.players[pIdx].splice(cardIdx, 1);
    state.discardPile.push(card);
    state.currentVal = card.val;
    if (card.color !== 'wild') state.currentColor = card.color;

    if (card.val === 'REV') {
        state.direction *= -1;
        document.getElementById('direction-info').style.transform = `rotate(${state.direction === 1 ? 0 : 180}deg)`;
    }
    
    if (card.val === 'SKIP') nextTurn(state);
    if (card.val === '+2') {
        const target = (state.turn + state.direction + 4) % 4;
        state.isAnimating = false;
        await drawCard(target, state); await drawCard(target, state);
        state.isAnimating = true;
        nextTurn(state);
    }
    if (card.val === '+4') {
        const target = (state.turn + state.direction + 4) % 4;
        state.isAnimating = false;
        for(let i=0; i<4; i++) await drawCard(target, state);
        state.isAnimating = true;
        nextTurn(state);
    }

    state.isAnimating = false;
    if (card.color === 'wild') {
        if (pIdx === 0) document.getElementById('picker-wild').style.display = 'grid';
        else {
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
        alert("SOLO dimenticato! +2 carte 🤡");
        drawCard(0, state); drawCard(0, state);
        state.pendingPenalty = false;
    }
    state.hasSaidSolo = false;
    updateUI(state);
    if (checkWin(state)) return;
    nextTurn(state);
    updateUI(state);
    if (state.turn !== 0) setTimeout(() => botLogic(state), 600);
}

function botLogic(state) {
    const hand = state.players[state.turn];
    const playableIdx = hand.findIndex(c => c.color === 'wild' || c.color === state.currentColor || c.val === state.currentVal);
    if (playableIdx !== -1) playCard(state.turn, playableIdx, state);
    else drawCard(state.turn, state);
}

function checkWin(state) {
    for(let i=0; i<4; i++) {
        if (state.players[i].length === 0) {
            alert(i === 0 ? "CAMPIONE! 👑" : `BOT ${i} VINCE! 🦾`);
            location.reload();
            return true;
        }
    }
    return false;
}

function updateUI(state) {
    const top = state.discardPile[state.discardPile.length-1];
    const dp = document.getElementById('discard-pile');
    dp.style.backgroundColor = getHex(top.color === 'wild' ? 'wild' : top.color);
    dp.style.color = (top.color === 'yellow' || top.color === 'wild') ? 'black' : 'white';
    dp.innerText = getCardContent(top.val);
    
    const colorLine = document.getElementById('color-line');
    colorLine.style.backgroundColor = getHex(state.currentColor);

    const pArea = document.getElementById('player-hand');
    pArea.innerHTML = state.players[0].map((c, i) => `
        <div class="card-solo playable" 
             style="background:${getHex(c.color)}; color:${(c.color === 'yellow' || c.color === 'wild') ? 'black' : 'white'};" 
             data-idx="${i}">
            ${getCardContent(c.val)}
        </div>
    `).join('');
    
    pArea.querySelectorAll('.card-solo').forEach(el => {
        el.onclick = () => { if(state.turn === 0 && !state.isAnimating) playCard(0, parseInt(el.dataset.idx), state); };
    });

    document.getElementById('solo-alert').classList.toggle('pulse', state.players[0].length === 2 && state.turn === 0);

    for(let i=1; i<=3; i++) {
        const el = document.getElementById(`bot-stat-${i}`);
        el.classList.toggle('active', state.turn === i);
        document.getElementById(`cnt-${i}`).innerText = state.players[i].length;
    }
}