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

    // Configurazione fissa per Mobile
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';
    
    let state = {
        deck: [], discardPile: [], players: [[], [], [], []], 
        turn: 0, direction: 1, currentColor: '', currentVal: '',
        gameActive: false, isAnimating: false, hasSaidSolo: false,
        pendingPenalty: false,
        stack: 0,
        canChain: false 
    };

    renderLayout(container);
    attachInitialListeners(container, state);
}

function renderLayout(container) {
    container.innerHTML = `
    <style>
        .mobile-emulator { width: 100%; height: 100dvh; background: #05010a; display: flex; justify-content: center; align-items: center; overflow: hidden; }
        .game-bg { 
            width: 100%; max-width: 430px; height: 100%; max-height: 932px;
            background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%); 
            position: relative; overflow: hidden; color: white; font-family: 'Poppins', sans-serif; 
        }

        /* Status Avversari */
        .opponents-container { display: flex; justify-content: space-around; padding: 15px; position: absolute; top: 10px; width: 100%; z-index: 10; }
        .bot-status { 
            display: flex; flex-direction: column; align-items: center; padding: 10px; border-radius: 16px; 
            background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); 
            border: 1px solid rgba(255,255,255,0.1); min-width: 80px; font-size: 10px; transition: 0.3s;
        }
        .bot-status.active { border-color: #00d2ff; box-shadow: 0 0 20px rgba(0, 210, 255, 0.4); background: rgba(0, 210, 255, 0.15); transform: scale(1.05); }
        .card-count { font-weight: 900; color: #00d2ff; font-size: 1.2rem; margin-top: 2px; }
        
        /* Area Centrale */
        .table-center { position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%); text-align: center; width: 100%; }
        .pile-container { display: flex; justify-content: center; gap: 25px; align-items: center; perspective: 1000px; }
        
        .card-solo { 
            width: 75px; height: 110px; border-radius: 12px; display: flex; align-items: center; justify-content: center; 
            font-weight: 900; font-size: 1.6rem; border: 3px solid rgba(255,255,255,0.9); position: relative; 
            box-shadow: 0 12px 25px rgba(0,0,0,0.5); user-select: none; transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .card-back { background: linear-gradient(135deg, #1a1a1a 0%, #434343 100%); border-color: #555; }
        .card-back::after { content: 'S'; color: #00d2ff; font-size: 2rem; }

        .flying-card { position: fixed; z-index: 9999; pointer-events: none; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        
        /* UI Giocatore */
        .player-ui { position: absolute; bottom: 0; width: 100%; z-index: 20; display: flex; flex-direction: column; align-items: center; padding-bottom: env(safe-area-inset-bottom, 20px); }
        .hand-scroll { 
            display: flex; gap: 8px; padding: 20px 15px; overflow-x: auto; 
            scrollbar-width: none; min-height: 140px; width: 100%; box-sizing: border-box;
            mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
        .card-solo.playable { flex-shrink: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .card-solo.playable:active { transform: translateY(-20px) scale(1.1); }
        
        .btn-solo { 
            background: linear-gradient(45deg, #ff416c, #ff4b2b); color: white; border: none; 
            padding: 12px 30px; border-radius: 50px; font-weight: 900; margin-bottom: 10px; 
            display: none; box-shadow: 0 4px 15px rgba(255, 65, 108, 0.4);
            text-transform: uppercase; letter-spacing: 1px;
        }
        .btn-solo.pulse { display: block; animation: soloPulse 0.8s infinite alternate; }
        
        @keyframes soloPulse { from { transform: scale(1); filter: brightness(1); } to { transform: scale(1.1); filter: brightness(1.3); } }

        /* Picker Colore */
        #picker-wild { display:none; position:absolute; inset:0; background:rgba(0,0,0,0.92); backdrop-filter: blur(20px); z-index:10000; grid-template-columns: 1fr 1fr; gap: 20px; padding: 40px; align-content: center; }
        .color-tile { height: 120px; border-radius: 20px; cursor: pointer; border: 4px solid rgba(255,255,255,0.1); transition: 0.2s; }
        .color-tile:active { transform: scale(0.9); border-color: white; }

        #start-overlay { position:absolute; inset:0; background:#090a0f; z-index:11000; display:flex; flex-direction:column; align-items:center; justify-content:center; }
        #direction-info { font-size: 2rem; color: rgba(255,255,255,0.2); transition: 0.5s; font-weight: 900; }
    </style>

    <div class="mobile-emulator">
        <div class="game-bg">
            <div id="start-overlay">
                <h1 style="font-size: 4rem; font-weight: 900; background: linear-gradient(to bottom, #00d2ff, #9d4ede); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -2px;">SOLO</h1>
                <p style="opacity: 0.5; margin-bottom: 30px;">Pronto alla sfida?</p>
                <button id="btn-start" style="background:white; border:none; padding:15px 50px; border-radius:50px; color:#090a0f; font-weight:900; font-size: 1.2rem; cursor:pointer;">GIOCA ORA</button>
            </div>

            <div class="opponents-container">
                <div id="bot-stat-1" class="bot-status"><span>BOT 1</span><div class="card-count" id="cnt-1">7</div></div>
                <div id="bot-stat-2" class="bot-status"><span>BOT 2</span><div class="card-count" id="cnt-2">7</div></div>
                <div id="bot-stat-3" class="bot-status"><span>BOT 3</span><div class="card-count" id="cnt-3">7</div></div>
            </div>

            <div class="table-center">
                <div id="stack-indicator" style="color:#ff416c; font-weight:900; height:24px; margin-bottom:10px; font-size: 0.9rem; text-shadow: 0 0 10px rgba(255,65,108,0.5);"></div>
                <div id="direction-info">↻</div>
                <div class="pile-container">
                    <div id="deck-draw" class="card-solo card-back"></div>
                    <div id="discard-pile" class="card-solo" style="background:white; color:black;"></div>
                </div>
                <div id="color-line" style="width: 80px; height: 6px; margin: 20px auto; border-radius: 10px; transition: 0.5s;"></div>
            </div>

            <div class="player-ui">
                <button id="btn-pass" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.3); color:white; padding:8px 25px; border-radius:20px; display:none; margin-bottom:10px; font-weight:700;">PASSA</button>
                <button id="solo-alert" class="btn-solo">SOLO!</button>
                <div id="player-hand" class="hand-scroll"></div>
            </div>

            <div id="picker-wild">
                ${COLORS.map(c => `<div class="color-tile" data-color="${c}" style="background:${getHex(c)};"></div>`).join('')}
            </div>
        </div>
    </div>
    `;
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

        flyer.style.width = `${fromRect.width}px`;
        flyer.style.height = `${fromRect.height}px`;
        flyer.style.top = `${fromRect.top}px`;
        flyer.style.left = `${fromRect.left}px`;
        document.body.appendChild(flyer);
        
        requestAnimationFrame(() => {
            flyer.style.top = `${toRect.top}px`;
            flyer.style.left = `${toRect.left}px`;
            flyer.style.transform = `rotate(${Math.random() * 40 - 20}deg) scale(0.9)`;
            flyer.style.opacity = "0.7";
        });

        setTimeout(() => { flyer.remove(); resolve(); }, 400);
    });
}

function attachInitialListeners(container, state) {
    container.querySelector('#btn-start').onclick = () => {
        container.querySelector('#start-overlay').style.display = 'none';
        startGame(state, container);
    };

    container.querySelector('#deck-draw').onclick = () => {
        if (state.turn === 0 && !state.isAnimating && !state.canChain) {
            if (state.stack > 0) resolveStack(0, state, container);
            else drawCard(0, state, container, true);
        }
    };

    container.querySelector('#btn-pass').onclick = () => {
        state.canChain = false;
        endTurn(state, container);
    };

    container.querySelector('#solo-alert').onclick = () => {
        state.hasSaidSolo = true;
        container.querySelector('#solo-alert').classList.remove('pulse');
    };

    container.querySelectorAll('.color-tile').forEach(tile => {
        tile.onclick = () => {
            state.currentColor = tile.dataset.color;
            container.querySelector('#picker-wild').style.display = 'none';
            if (!state.canChain) endTurn(state, container);
            else updateUI(state, container);
        };
    });
}

function startGame(state, container) {
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
    updateUI(state, container);
}

async function resolveStack(pIdx, state, container) {
    if (state.isAnimating) return;
    const count = state.stack;
    state.stack = 0;
    for(let i=0; i<count; i++) {
        await drawCard(pIdx, state, container);
    }
    endTurn(state, container);
}

async function drawCard(pIdx, state, container, manual = false) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    if (state.deck.length === 0) {
        const top = state.discardPile.pop();
        state.deck = [...state.discardPile].sort(() => Math.random() - 0.5);
        state.discardPile = [top];
    }
    
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

    // Check Legal Move
    if (state.stack > 0) {
        if (card.val !== state.currentVal) return;
    } else {
        if (!state.canChain && card.color !== 'wild' && card.color !== state.currentColor && card.val !== state.currentVal) return;
        if (state.canChain && card.val !== state.currentVal) return;
    }

    state.isAnimating = true;
    const cardEl = pIdx === 0 ? container.querySelector(`[data-idx="${cardIdx}"]`) : container.querySelector(`#bot-stat-${pIdx}`);
    await animateCard(cardEl, container.querySelector('#discard-pile'), card);

    if (pIdx === 0 && state.players[0].length === 2 && !state.hasSaidSolo) {
        state.pendingPenalty = true;
    }

    state.players[pIdx].splice(cardIdx, 1);
    state.discardPile.push(card);
    state.currentVal = card.val;
    if (card.color !== 'wild') state.currentColor = card.color;

    if (card.val === 'REV') {
        state.direction *= -1;
    }
    if (card.val === '+2') state.stack += 2;
    if (card.val === '+4') state.stack += 4;
    
    const canChainMore = state.players[pIdx].some(c => c.val === card.val);

    if (card.color === 'wild' && pIdx === 0) {
        container.querySelector('#picker-wild').style.display = 'grid';
    } else if (card.color === 'wild' && pIdx !== 0) {
        const counts = {};
        state.players[pIdx].forEach(c => { if(c.color !== 'wild') counts[c.color] = (counts[c.color] || 0) + 1; });
        state.currentColor = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, COLORS[0]);
    }

    state.isAnimating = false;

    if (canChainMore && !['SKIP', 'REV', '+2', '+4'].includes(card.val)) {
        if (pIdx === 0) {
            state.canChain = true;
            updateUI(state, container);
        } else {
            const nextIdx = state.players[pIdx].findIndex(c => c.val === card.val);
            setTimeout(() => playCard(pIdx, nextIdx, state, container), 400);
        }
    } else {
        state.canChain = false;
        if (card.val === 'SKIP' && state.stack === 0) state.turn = (state.turn + state.direction + 4) % 4;
        endTurn(state, container);
    }
}

function endTurn(state, container) {
    if (state.isAnimating) return;
    
    if (state.pendingPenalty) {
        alert("Dimenticato SOLO! +2 carte 🤡");
        drawCard(0, state, container); 
        setTimeout(() => drawCard(0, state, container), 200);
        state.pendingPenalty = false;
    }

    state.hasSaidSolo = false;
    
    // Check Win
    for(let i=0; i<4; i++) {
        if (state.players[i].length === 0) {
            alert(i === 0 ? "VITTORIA! 🏆" : `HA VINTO IL BOT ${i} 🤖`);
            location.reload();
            return;
        }
    }
    
    if (!state.canChain) {
        state.turn = (state.turn + state.direction + 4) % 4;
        updateUI(state, container);
        if (state.turn !== 0) setTimeout(() => botLogic(state, container), 800);
    }
}

function botLogic(state, container) {
    if (state.turn === 0 || state.isAnimating) return;
    const hand = state.players[state.turn];
    
    if (state.stack > 0) {
        const counterIdx = hand.findIndex(c => c.val === state.currentVal);
        if (counterIdx !== -1) playCard(state.turn, counterIdx, state, container);
        else resolveStack(state.turn, state, container);
        return;
    }

    const playableIdx = hand.findIndex(c => c.color === 'wild' || c.color === state.currentColor || c.val === state.currentVal);
    if (playableIdx !== -1) {
        // Il bot dice sempre Solo se ha 2 carte
        if (hand.length === 2) state.hasSaidSolo = true;
        playCard(state.turn, playableIdx, state, container);
    } else {
        drawCard(state.turn, state, container);
    }
}

function updateUI(state, container) {
    const top = state.discardPile[state.discardPile.length-1];
    const dp = container.querySelector('#discard-pile');
    dp.style.backgroundColor = getHex(top.color === 'wild' ? 'wild' : top.color);
    dp.style.color = (top.color === 'yellow' || top.color === 'wild') ? 'black' : 'white';
    dp.innerText = getCardContent(top.val);
    dp.style.transform = `rotate(${Math.random() * 10 - 5}deg)`;
    
    container.querySelector('#color-line').style.backgroundColor = getHex(state.currentColor);
    container.querySelector('#stack-indicator').innerText = state.stack > 0 ? `PESCA +${state.stack}!` : "";
    container.querySelector('#btn-pass').style.display = state.canChain ? "block" : "none";
    container.querySelector('#direction-info').innerText = state.direction === 1 ? "↻" : "↺";
    container.querySelector('#direction-info').style.transform = state.direction === 1 ? "scaleX(1)" : "scaleX(-1)";

    const pArea = container.querySelector('#player-hand');
    pArea.innerHTML = state.players[0].map((c, i) => {
        let isPlayable = false;
        if (state.stack > 0) isPlayable = (c.val === state.currentVal);
        else if (state.canChain) isPlayable = (c.val === state.currentVal);
        else isPlayable = (c.color === 'wild' || c.color === state.currentColor || c.val === state.currentVal);

        return `
            <div class="card-solo playable" 
                 style="background:${getHex(c.color)}; color:${(c.color === 'yellow' || c.color === 'wild') ? 'black' : 'white'}; opacity:${isPlayable ? 1 : 0.4}; transform: scale(${isPlayable ? 1 : 0.9});" 
                 data-idx="${i}">
                ${getCardContent(c.val)}
            </div>`;
    }).join('');
    
    pArea.querySelectorAll('.card-solo').forEach(el => {
        el.onclick = () => { if(state.turn === 0 && !state.isAnimating) playCard(0, parseInt(el.dataset.idx), state, container); };
    });

    container.querySelector('#solo-alert').classList.toggle('pulse', state.players[0].length === 2 && state.turn === 0);

    for(let i=1; i<=3; i++) {
        const el = container.querySelector(`#bot-stat-${i}`);
        el.classList.toggle('active', state.turn === i);
        container.querySelector(`#cnt-${i}`).innerText = state.players[i].length;
    }
}