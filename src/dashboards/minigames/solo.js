import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

const COLORS = ['red', 'blue', 'green', 'yellow'];
const getHex = (color) => {
    const hex = { red: '#ff4b2b', blue: '#00d2ff', green: '#2ecc71', yellow: '#f1c40f', wild: '#1a1a1a' };
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
        .game-bg { width:100%; height:100dvh; background: #0f0c29; background: linear-gradient(to bottom, #24243e, #302b63, #0f0c29); position:relative; overflow:hidden; color:white; font-family: 'Poppins', sans-serif; }
        
        /* Bots Status */
        .opponents-container { display: flex; justify-content: space-around; padding: 15px; position: absolute; top: 0; width: 100%; z-index: 10; }
        .bot-status { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); transition: all 0.4s ease; min-width: 80px; }
        .bot-status.active { border-color: #9d4ede; box-shadow: 0 0 15px rgba(157, 78, 221, 0.5); transform: translateY(5px); background: rgba(157, 78, 221, 0.1); }
        .card-count { font-weight: 900; color: #9d4ede; font-size: 1.1rem; }

        /* Centro Tavolo */
        .table-center { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%); text-align: center; width: 100%; }
        .pile-container { display: flex; justify-content: center; gap: 30px; align-items: center; perspective: 1000px; }
        
        .card-solo { width: 80px; height: 115px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.6rem; border: 3px solid rgba(255,255,255,0.9); position: relative; transition: transform 0.3s ease, box-shadow 0.3s ease; box-shadow: 0 6px 12px rgba(0,0,0,0.3); cursor: pointer; user-select: none; }
        .card-back { background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); color: white; }
        .card-back::after { content: 'SOLO'; font-size: 0.7rem; letter-spacing: 1px; }
        
        .flying-card { position: fixed; z-index: 9999; pointer-events: none; transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1); }

        /* Area Giocatore Ottimizzata */
        .player-ui { position: absolute; bottom: 0; width: 100%; z-index: 20; display: flex; flex-direction: column; align-items: center; padding-bottom: env(safe-area-inset-bottom, 20px); }
        .hand-container { width: 100%; display: flex; justify-content: center; overflow: visible; padding: 20px 0; }
        .hand-scroll { display: flex; gap: 8px; padding: 10px 30px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; overflow-y: visible; min-height: 140px; }
        .hand-scroll::-webkit-scrollbar { display: none; }
        
        /* Carta Libera nella mano */
        .card-solo.playable { flex-shrink: 0; transform-origin: bottom center; }
        .card-solo.playable:active { transform: scale(1.1) translateY(-20px); z-index: 100; }

        .btn-solo { background: linear-gradient(to right, #ff4b2b, #ff416c); color: white; border: none; padding: 12px 35px; border-radius: 50px; font-weight: 900; margin-bottom: 10px; box-shadow: 0 4px 15px rgba(255, 65, 108, 0.3); display: none; }
        .btn-solo.pulse { display: block; animation: pulseSolo 1.2s infinite; }
        
        @keyframes pulseSolo { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }

        #picker-wild { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); backdrop-filter: blur(15px); z-index:10000; grid-template-columns: 1fr 1fr; gap: 15px; padding: 40px; align-content: center; }
        .color-tile { height: 120px; border-radius: 20px; border: 3px solid rgba(255,255,255,0.1); }
    </style>

    <div class="game-bg">
        <div id="start-overlay" style="position:fixed; inset:0; background:#0f0c29; z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <h1 style="font-size:4rem; font-weight:900; background: linear-gradient(to right, #6a11cb, #2575fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">SOLO</h1>
            <button id="btn-start" style="margin-top:20px; background:white; border:none; padding:15px 45px; border-radius:50px; color:#302b63; font-weight:900; cursor:pointer;">GIOCA ORA</button>
        </div>

        <div class="opponents-container">
            <div id="bot-stat-1" class="bot-status"><span>BOT 1</span><div class="card-count" id="cnt-1">7</div></div>
            <div id="bot-stat-2" class="bot-status"><span>BOT 2</span><div class="card-count" id="cnt-2">7</div></div>
            <div id="bot-stat-3" class="bot-status"><span>BOT 3</span><div class="card-count" id="cnt-3">7</div></div>
        </div>

        <div class="table-center">
            <div id="direction-info" style="font-size:2rem; margin-bottom:15px; opacity:0.6;">↻</div>
            <div class="pile-container">
                <div id="deck-draw" class="card-solo card-back"></div>
                <div id="discard-pile" class="card-solo" style="background:white; color:black;"></div>
            </div>
            <div id="color-line" style="width: 100px; height: 4px; margin: 25px auto; border-radius: 10px; transition: 0.5s;"></div>
        </div>

        <div class="player-ui">
            <button id="solo-alert" class="btn-solo">SOLO!</button>
            <div class="hand-container">
                <div id="player-hand" class="hand-scroll"></div>
            </div>
        </div>

        <div id="picker-wild">
            ${COLORS.map(c => `<div class="color-tile" data-color="${c}" style="background:${getHex(c)}"></div>`).join('')}
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
            flyer.innerText = cardData.val;
            flyer.style.color = (cardData.color === 'yellow' || cardData.color === 'wild') ? 'black' : 'white';
        }
        
        flyer.style.left = `${fromRect.left}px`;
        flyer.style.top = `${fromRect.top}px`;
        flyer.style.width = `${fromRect.width}px`;
        flyer.style.height = `${fromRect.height}px`;
        
        document.body.appendChild(flyer);
        
        // Forza reflow
        flyer.offsetWidth;

        flyer.style.left = `${toRect.left}px`;
        flyer.style.top = `${toRect.top}px`;
        flyer.style.transform = `rotate(${Math.random() * 10 - 5}deg)`;

        setTimeout(() => {
            flyer.remove();
            resolve();
        }, 700);
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
        if (!canPlay) setTimeout(() => endTurn(state), 400);
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
        document.getElementById('direction-info').innerText = state.direction === 1 ? '↻' : '↺';
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
        alert("Non hai detto SOLO! +2 penalità.");
        drawCard(0, state); drawCard(0, state);
        state.pendingPenalty = false;
    }
    state.hasSaidSolo = false;
    updateUI(state);
    if (checkWin(state)) return;
    nextTurn(state);
    updateUI(state);
    if (state.turn !== 0) setTimeout(() => botLogic(state), 1000);
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
            alert(i === 0 ? "VITTORIA!" : `BOT ${i} VINCE!`);
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
    dp.innerText = top.val;
    
    const colorLine = document.getElementById('color-line');
    colorLine.style.backgroundColor = getHex(state.currentColor);
    colorLine.style.boxShadow = `0 0 15px ${getHex(state.currentColor)}`;

    const pArea = document.getElementById('player-hand');
    pArea.innerHTML = state.players[0].map((c, i) => `
        <div class="card-solo playable" style="background:${getHex(c.color)}; color:${(c.color === 'yellow' || c.color === 'wild') ? 'black' : 'white'};" data-idx="${i}">
            ${c.val}
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