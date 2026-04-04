import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: SOLO (Uno-Style)
// Versione Mobile-First ottimizzata
// ==========================================

const COLORS = ['red', 'blue', 'green', 'yellow'];

const getHex = (color) => {
    const hex = { red: '#ff4b2b', blue: '#00d2ff', green: '#2ecc71', yellow: '#f1c40f', wild: '#1a1a1a' };
    return hex[color] || '#ffffff';
};

const getCardContent = (val) => {
    const symbols = { 'SKIP': '🚫', 'REV': '🔄', '+2': '+2', 'WILD': '🌈', '+4': '+4' };
    return symbols[val] || val;
};

export function initSoloGame(container) {
    updateSidebarContext("minigames");

    // FIX: Pulizia scroll e configurazione mobile-friendly
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#090a0f';
    
    let state = {
        deck: [], discardPile: [], players: [[], [], [], []], 
        turn: 0, direction: 1, currentColor: '', currentVal: '',
        gameActive: false, isAnimating: false, hasSaidSolo: false,
        pendingPenalty: false,
        stack: 0,
        canChain: false 
    };

    renderLayout(container, state);
    attachInitialListeners(container, state);
}

// --- Funzione centralizzata per uscire in sicurezza ---
const quitGame = async (container) => {
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.backgroundColor = '';
    
    try {
        // FIX: Import dinamico corretto per tornare alla lista senza ricaricare l'app
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        console.error("Errore navigazione:", e);
        window.location.reload(); 
    }
};

function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .solo-wrapper { 
            width: 100%; max-width: 430px; height: 100dvh; margin: 0 auto;
            background: radial-gradient(circle at center, rgba(27,39,53,0.8) 0%, rgba(9,10,15,0.9) 100%); 
            position: relative; overflow: hidden; color: white; font-family: 'Poppins', sans-serif; 
            animation: cardEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            box-sizing: border-box;
        }
        @media (min-width: 431px) {
            .solo-wrapper { border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); height: 90vh; margin-top: 5vh; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        }
        .btn-exit-game {
            position: absolute; top: calc(15px + env(safe-area-inset-top)); left: 15px; z-index: 100;
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 10px;
            cursor: pointer; outline: none; transition: 0.2s;
        }
        .opponents-container { display: flex; justify-content: space-around; padding: 15px; position: absolute; top: calc(50px + env(safe-area-inset-top)); width: 100%; z-index: 10; }
        .bot-status { display: flex; flex-direction: column; align-items: center; padding: 10px; border-radius: 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255,255,255,0.1); min-width: 80px; font-size: 10px; }
        .bot-status.active { border-color: #00d2ff; background: rgba(0, 210, 255, 0.15); }
        .card-solo { width: 75px; height: 110px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.6rem; border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 12px 25px rgba(0,0,0,0.5); user-select: none; transition: 0.3s; }
        .card-back { background: linear-gradient(135deg, #1a1a1a 0%, #434343 100%); }
        .flying-card { position: fixed; z-index: 9999; pointer-events: none; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        .player-ui { position: absolute; bottom: 0; width: 100%; z-index: 20; display: flex; flex-direction: column; align-items: center; padding-bottom: calc(15px + env(safe-area-inset-bottom)); }
        .hand-scroll { display: flex; gap: 8px; padding: 20px 15px; overflow-x: auto; min-height: 140px; width: 100%; box-sizing: border-box; }
        #picker-wild { display:none; position:absolute; inset:0; background:rgba(0,0,0,0.95); z-index:10000; grid-template-columns: 1fr 1fr; gap: 20px; padding: 40px; align-content: center; }
        .color-tile { height: 120px; border-radius: 20px; cursor: pointer; }
    </style>

    <div class="solo-wrapper">
        <div id="start-overlay" style="position:absolute; inset:0; background:#090a0f; z-index:11000; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <h1 style="font-size: 4rem; font-weight: 900; background: linear-gradient(to bottom, #00d2ff, #9d4ede); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">SOLO</h1>
            <button id="btn-start" style="background:white; border:none; padding:15px 50px; border-radius:50px; color:#000; font-weight:900; cursor:pointer;">GIOCA ORA</button>
            <button id="btn-quit-start" style="margin-top: 20px; background:transparent; border:none; color:rgba(255,255,255,0.5); font-weight:700; cursor:pointer;">← TORNA INDIETRO</button>
        </div>

        <button class="btn-exit-game" id="btn-exit-ingame">← ESCI</button>
        <div class="opponents-container">
            <div id="bot-stat-1" class="bot-status"><span>BOT 1</span><div id="cnt-1">7</div></div>
            <div id="bot-stat-2" class="bot-status"><span>BOT 2</span><div id="cnt-2">7</div></div>
            <div id="bot-stat-3" class="bot-status"><span>BOT 3</span><div id="cnt-3">7</div></div>
        </div>
        <div style="position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%); text-align: center; width: 100%;">
            <div id="stack-indicator" style="color:#ff416c; font-weight:900; height:24px;"></div>
            <div style="display: flex; justify-content: center; gap: 25px; align-items: center;">
                <div id="deck-draw" class="card-solo card-back"></div>
                <div id="discard-pile" class="card-solo" style="background:white; color:black;"></div>
            </div>
            <div id="color-line" style="width: 80px; height: 6px; margin: 20px auto; border-radius: 10px;"></div>
        </div>
        <div class="player-ui">
            <button id="btn-pass" style="background:rgba(255,255,255,0.1); border:1px solid white; color:white; padding:8px 25px; border-radius:20px; display:none; margin-bottom:10px;">PASSA</button>
            <button id="solo-alert" style="display:none; background:red; color:white; padding:10px 30px; border-radius:30px; font-weight:900;">SOLO!</button>
            <div id="player-hand" class="hand-scroll"></div>
        </div>
        <div id="picker-wild">
            ${COLORS.map(c => `<div class="color-tile" data-color="${c}" style="background:${getHex(c)};"></div>`).join('')}
        </div>
    </div>
    `;

    container.querySelector('#btn-quit-start').onclick = (e) => { e.preventDefault(); quitGame(container); };
    container.querySelector('#btn-exit-ingame').onclick = (e) => { e.preventDefault(); quitGame(container); };
}

// --- LOGICA ANIMAZIONI ---
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
        flyer.style.width = `${fromRect.width}px`; flyer.style.height = `${fromRect.height}px`;
        flyer.style.top = `${fromRect.top}px`; flyer.style.left = `${fromRect.left}px`;
        document.body.appendChild(flyer);
        requestAnimationFrame(() => { flyer.style.top = `${toRect.top}px`; flyer.style.left = `${toRect.left}px`; flyer.style.opacity = "0.7"; });
        setTimeout(() => { flyer.remove(); resolve(); }, 400);
    });
}

function attachInitialListeners(container, state) {
    container.querySelector('#btn-start').onclick = () => { container.querySelector('#start-overlay').style.display = 'none'; startGame(state, container); };
    container.querySelector('#deck-draw').onclick = (e) => { e.preventDefault(); if (state.turn === 0 && !state.isAnimating) drawCard(0, state, container, true); };
    container.querySelector('#btn-pass').onclick = (e) => { e.preventDefault(); endTurn(state, container); };
    container.querySelectorAll('.color-tile').forEach(tile => {
        tile.onclick = (e) => {
            e.preventDefault();
            state.currentColor = tile.dataset.color;
            container.querySelector('#picker-wild').style.display = 'none';
            endTurn(state, container);
        };
    });
}

function startGame(state, container) {
    state.deck = [];
    COLORS.forEach(c => {
        for(let i=0; i<=9; i++) state.deck.push({color: c, val: i.toString()});
        ['SKIP', 'REV', '+2'].forEach(v => { state.deck.push({color: c, val: v}); state.deck.push({color: c, val: v}); });
    });
    for(let i=0; i<4; i++) { state.deck.push({color: 'wild', val: 'WILD'}); state.deck.push({color: 'wild', val: '+4'}); }
    state.deck.sort(() => Math.random() - 0.5);
    for(let p=0; p<4; p++) { state.players[p] = []; for(let i=0; i<7; i++) state.players[p].push(state.deck.pop()); }
    let first = state.deck.pop(); state.currentColor = first.color; state.currentVal = first.val; state.discardPile.push(first);
    state.gameActive = true; updateUI(state, container);
}

async function drawCard(pIdx, state, container, manual = false) {
    if (state.isAnimating) return;
    state.isAnimating = true;
    const card = state.deck.pop();
    const targetEl = pIdx === 0 ? container.querySelector('#player-hand') : container.querySelector(`#bot-stat-${pIdx}`);
    await animateCard(container.querySelector('#deck-draw'), targetEl, card, pIdx !== 0);
    state.players[pIdx].push(card);
    state.isAnimating = false;
    if (pIdx === 0 && manual) {
        const canPlay = card.color === 'wild' || card.color === state.currentColor || card.val === state.currentVal;
        if (!canPlay) setTimeout(() => endTurn(state, container), 300);
    }
    updateUI(state, container);
}

async function playCard(pIdx, cardIdx, state, container) {
    if (state.isAnimating) return;
    const card = state.players[pIdx][cardIdx];
    if (card.color !== 'wild' && card.color !== state.currentColor && card.val !== state.currentVal) return;
    state.isAnimating = true;
    const cardEl = pIdx === 0 ? container.querySelector(`[data-idx="${cardIdx}"]`) : container.querySelector(`#bot-stat-${pIdx}`);
    await animateCard(cardEl, container.querySelector('#discard-pile'), card);
    state.players[pIdx].splice(cardIdx, 1);
    state.discardPile.push(card);
    state.currentVal = card.val;
    if (card.color !== 'wild') state.currentColor = card.color;
    if (card.color === 'wild' && pIdx === 0) container.querySelector('#picker-wild').style.display = 'grid';
    else endTurn(state, container);
    state.isAnimating = false;
}

function endTurn(state, container) {
    for(let i=0; i<4; i++) {
        if (state.players[i].length === 0) {
            alert(i === 0 ? "VITTORIA!" : "HAI PERSO!");
            return quitGame(container);
        }
    }
    state.turn = (state.turn + 1) % 4;
    updateUI(state, container);
    if (state.turn !== 0) setTimeout(() => botLogic(state, container), 800);
}

function botLogic(state, container) {
    const hand = state.players[state.turn];
    const idx = hand.findIndex(c => c.color === 'wild' || c.color === state.currentColor || c.val === state.currentVal);
    if (idx !== -1) playCard(state.turn, idx, state, container);
    else drawCard(state.turn, state, container);
}

function updateUI(state, container) {
    const top = state.discardPile[state.discardPile.length-1];
    const dp = container.querySelector('#discard-pile');
    dp.style.backgroundColor = getHex(top.color);
    dp.innerText = getCardContent(top.val);
    container.querySelector('#color-line').style.backgroundColor = getHex(state.currentColor);
    const pArea = container.querySelector('#player-hand');
    pArea.innerHTML = state.players[0].map((c, i) => `<div class="card-solo" style="background:${getHex(c.color)}; flex-shrink:0;" data-idx="${i}">${getCardContent(c.val)}</div>`).join('');
    pArea.querySelectorAll('.card-solo').forEach(el => { el.onclick = () => { if(state.turn === 0) playCard(0, parseInt(el.dataset.idx), state, container); }; });
    for(let i=1; i<=3; i++) {
        container.querySelector(`#bot-stat-${i}`).classList.toggle('active', state.turn === i);
        container.querySelector(`#cnt-${i}`).innerText = state.players[i].length;
    }
}
