import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: SOLO MASTER EDITION (Responsive)
// Versione Stabile 2.5 - Full Animated & Borderless
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
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    // BLOCCO SCROLL GLOBALE PER ESPERIENZA APP-LIKE
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none'; 
    document.body.style.backgroundColor = '#05010a';
    window.scrollTo(0, 0);
    
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

const quitGame = async (container) => {
    document.body.style.touchAction = '';
    document.body.style.overflowY = 'auto';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) { window.location.reload(); }
};

function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .solo-master-wrapper { 
            width: 100%; height: 100dvh; 
            background: radial-gradient(circle at center, #1a0b2e 0%, #05010a 100%); 
            position: relative; overflow: hidden; color: white; font-family: 'Poppins', sans-serif; 
            display: flex; flex-direction: column; box-sizing: border-box;
        }

        .btn-exit-solo {
            position: absolute; top: calc(15px + env(safe-area-inset-top)); left: 15px; z-index: 100;
            background: var(--glass-surface); border: 1px solid var(--glass-border);
            color: white; padding: 10px 20px; border-radius: 15px; font-weight: 800; font-size: 12px; cursor:pointer;
        }

        /* AVVERSARI ADATTIVI */
        .opponents-row { 
            display: flex; justify-content: space-evenly; width: 100%; 
            padding: calc(60px + env(safe-area-inset-top)) 10px 10px 10px; box-sizing: border-box; 
        }
        
        .bot-pill { 
            background: rgba(255,255,255,0.03); backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border); border-radius: 20px;
            padding: 10px 20px; text-align: center; transition: 0.3s;
            min-width: 80px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .bot-pill.active { border-color: #9d4ede; background: rgba(157,78,221,0.15); transform: translateY(-5px); box-shadow: 0 10px 20px rgba(157,78,221,0.3); }

        /* TAVOLO CENTRALE */
        .center-table {
            flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; position: relative;
        }

        .card-solo { 
            width: clamp(75px, 12vw, 100px); 
            height: clamp(110px, 18vw, 145px); 
            border-radius: 12px; display: flex; align-items: center; justify-content: center; 
            font-weight: 900; font-size: clamp(1.4rem, 3vw, 2rem); border: 3px solid #fff; 
            box-shadow: 0 10px 20px rgba(0,0,0,0.5); user-select: none; transition: 0.3s;
            position: relative; cursor: pointer;
        }
        .card-back { background: linear-gradient(135deg, #5a189a 0%, #240046 100%); }

        .flying-card { position: fixed; z-index: 9999; pointer-events: none; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); }

        /* MANO GIOCATORE */
        .player-area { 
            width: 100%; padding-bottom: calc(20px + env(safe-area-inset-bottom));
            display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.3);
        }
        .hand-scroll { 
            display: flex; gap: 10px; padding: 20px; overflow-x: auto; width: 100%; 
            justify-content: center; box-sizing: border-box;
        }
        
        #picker-wild { 
            display:none; position:fixed; inset:0; background:rgba(5,2,10,0.9); 
            backdrop-filter: blur(20px); z-index:10000; grid-template-columns: 1fr 1fr; 
            gap: 20px; padding: 40px; align-content: center; 
        }
        .color-tile { height: 140px; border-radius: 25px; cursor: pointer; border: 3px solid rgba(255,255,255,0.1); transition: 0.2s; }
        .color-tile:active { transform: scale(0.9); }

        #start-overlay {
            position: fixed; inset: 0; background: #05010a; z-index: 11000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
    </style>

    <div class="solo-master-wrapper fade-in">
        
        <div id="start-overlay">
            <img src="/assets/logo.png" style="width: 100px; margin-bottom: 20px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 4rem; margin-bottom: 40px;">SOLO</h1>
            <button class="btn-primary" id="btn-start" style="width: 100%; max-width: 280px; margin-bottom: 15px; border:none; background: var(--accent-gradient);">GIOCA ORA</button>
            <button id="btn-quit-start" class="btn-back-glass" style="width: 100%; max-width: 280px;">TORNA INDIETRO</button>
        </div>

        <button class="btn-exit-solo" id="btn-exit-ingame">← ESCI</button>
        
        <div class="opponents-row">
            <div id="bot-pill-1" class="bot-pill"><span>BOT 1</span><div id="cnt-1" style="font-weight:900; color:#9d4ede;">7</div></div>
            <div id="bot-pill-2" class="bot-pill"><span>BOT 2</span><div id="cnt-2" style="font-weight:900; color:#9d4ede;">7</div></div>
            <div id="bot-pill-3" class="bot-pill"><span>BOT 3</span><div id="cnt-3" style="font-weight:900; color:#9d4ede;">7</div></div>
        </div>
        
        <div class="center-table">
            <div id="stack-info" style="color:#ff416c; font-weight:900; height:24px; margin-bottom:15px; text-shadow: 0 0 10px rgba(255,65,108,0.5);"></div>
            <div style="display: flex; gap: 30px; align-items: center;">
                <div id="deck-draw" class="card-solo card-back"></div>
                <div id="discard-pile" class="card-solo" style="background:white; color:black;"></div>
            </div>
            <div id="color-indicator" style="width: 100px; height: 6px; margin-top: 30px; border-radius: 10px; transition: 0.5s;"></div>
        </div>
        
        <div class="player-area">
            <div style="display:flex; gap:10px; margin-bottom: 10px;">
                <button id="btn-pass" style="display:none; background:rgba(255,255,255,0.1); border:1px solid #fff; color:white; padding:8px 20px; border-radius:20px; font-weight:800;">PASSA</button>
                <button id="solo-alert" style="display:none; background:#ff416c; color:white; padding:8px 20px; border-radius:20px; font-weight:900; border:none;">SOLO!</button>
            </div>
            <div id="player-hand" class="hand-scroll"></div>
        </div>
        
        <div id="picker-wild">
            ${COLORS.map(c => `<div class="color-tile" data-color="${c}" style="background:${getHex(c)};"></div>`).join('')}
        </div>
    </div>
    `;

    container.querySelector('#btn-quit-start').onclick = () => quitGame(container);
    container.querySelector('#btn-exit-ingame').onclick = () => quitGame(container);
}

// --- ANIMAZIONI CARTE VOLANTI ---
async function animateCardMove(startEl, targetEl, cardData, isBack = false) {
    return new Promise(resolve => {
        const startRect = startEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        
        const flyer = document.createElement('div');
        flyer.className = `card-solo flying-card ${isBack ? 'card-back' : ''}`;
        
        if (!isBack) {
            flyer.style.backgroundColor = getHex(cardData.color);
            flyer.innerText = getCardContent(cardData.val);
            flyer.style.color = (cardData.color === 'yellow' || cardData.color === 'wild') ? 'black' : 'white';
        }

        flyer.style.left = `${startRect.left}px`;
        flyer.style.top = `${startRect.top}px`;
        flyer.style.width = `${startRect.width}px`;
        flyer.style.height = `${startRect.height}px`;
        document.body.appendChild(flyer);
        
        requestAnimationFrame(() => {
            flyer.style.left = `${targetRect.left}px`;
            flyer.style.top = `${targetRect.top}px`;
            flyer.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;
        });

        setTimeout(() => { flyer.remove(); resolve(); }, 450);
    });
}

function attachInitialListeners(container, state) {
    container.querySelector('#btn-start').onclick = () => {
        container.querySelector('#start-overlay').style.display = 'none';
        startGame(state, container);
    };

    container.querySelector('#deck-draw').onclick = () => {
        if (state.turn === 0 && !state.isAnimating) drawCard(0, state, container, true);
    };

    container.querySelector('#btn-pass').onclick = () => endTurn(state, container);

    container.querySelectorAll('.color-tile').forEach(tile => {
        tile.onclick = () => {
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
    
    for(let p=0; p<4; p++) { 
        state.players[p] = []; 
        for(let i=0; i<7; i++) state.players[p].push(state.deck.pop()); 
    }

    let first = state.deck.pop();
    state.currentColor = first.color === 'wild' ? 'red' : first.color;
    state.currentVal = first.val;
    state.discardPile.push(first);
    state.gameActive = true;
    updateUI(state, container);
}

async function drawCard(pIdx, state, container, manual = false) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    const card = state.deck.pop();
    const startEl = container.querySelector('#deck-draw');
    const targetEl = pIdx === 0 ? container.querySelector('#player-hand') : container.querySelector(`#bot-pill-${pIdx}`);
    
    await animateCardMove(startEl, targetEl, card, pIdx !== 0);
    
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
    const startEl = pIdx === 0 ? container.querySelector(`[data-idx="${cardIdx}"]`) : container.querySelector(`#bot-pill-${pIdx}`);
    const targetEl = container.querySelector('#discard-pile');
    
    await animateCardMove(startEl, targetEl, card);

    state.players[pIdx].splice(cardIdx, 1);
    state.discardPile.push(card);
    state.currentVal = card.val;
    if (card.color !== 'wild') state.currentColor = card.color;

    if (card.color === 'wild' && pIdx === 0) {
        container.querySelector('#picker-wild').style.display = 'grid';
    } else {
        if (card.color === 'wild' && pIdx !== 0) state.currentColor = COLORS[Math.floor(Math.random()*4)];
        endTurn(state, container);
    }
    state.isAnimating = false;
}

function endTurn(state, container) {
    for(let i=0; i<4; i++) {
        if (state.players[i].length === 0) {
            alert(i === 0 ? "🏆 VITTORIA!" : "💀 HAI PERSO!");
            return quitGame(container);
        }
    }
    state.turn = (state.turn + 1) % 4;
    updateUI(state, container);
    if (state.turn !== 0) setTimeout(() => botLogic(state, container), 1000);
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
    dp.style.color = (top.color === 'yellow' || top.color === 'wild') ? 'black' : 'white';
    dp.innerText = getCardContent(top.val);
    
    container.querySelector('#color-indicator').style.backgroundColor = getHex(state.currentColor);
    container.querySelector('#color-indicator').style.boxShadow = `0 0 20px ${getHex(state.currentColor)}`;

    const pArea = container.querySelector('#player-hand');
    pArea.innerHTML = state.players[0].map((c, i) => `
        <div class="card-solo" style="background:${getHex(c.color)}; color: ${(c.color === 'yellow' || c.color === 'wild') ? 'black' : 'white'}; flex-shrink:0; margin-right: -20px;" data-idx="${i}">
            ${getCardContent(c.val)}
        </div>
    `).join('');
    
    pArea.querySelectorAll('.card-solo').forEach(el => {
        el.onclick = () => { if(state.turn === 0) playCard(0, parseInt(el.dataset.idx), state, container); };
    });

    for(let i=1; i<=3; i++) {
        container.querySelector(`#bot-pill-${i}`).classList.toggle('active', state.turn === i);
        container.querySelector(`#cnt-${i}`).innerText = state.players[i].length;
    }
}