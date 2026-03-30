import { updateSidebarContext } from '../../components/layout/Sidebar.js';

const SUITS = [
    { id: 'bastoni', icon: '🪵', color: '#00ffa3' },
    { id: 'coppe', icon: '🏆', color: '#ff416c' },
    { id: 'denari', icon: '💰', color: '#ffbd39' },
    { id: 'spade', icon: '⚔️', color: '#00d2ff' }
];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; 

export function initScopa(container) {
    updateSidebarContext("minigames");

    let state = {
        deck: [], playerHand: [], botHand: [], table: [],
        playerCaptured: [], botCaptured: [], playerScopas: 0, botScopas: 0,
        lastCapturePlayer: true, turn: 'player', isAnimating: false
    };

    renderLayout(container, state);
    startGame(state, container);
}

function startGame(state, container) {
    state.deck = [];
    SUITS.forEach(s => VALUES.forEach(v => state.deck.push({ suit: s.id, value: v })));
    for (let i = state.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
    }
    state.playerHand = state.deck.splice(0, 3);
    state.botHand = state.deck.splice(0, 3);
    state.table = state.deck.splice(0, 4);
    renderGame(state, container);
}

function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .scopa-wrapper { 
            width:100%; height:100dvh; 
            background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%); 
            color:white; font-family:'Poppins',sans-serif; 
            position:relative; overflow:hidden;
            display: flex; flex-direction: column; align-items: center; justify-content: space-between;
            padding: 40px 0;
        }
        
        .score-widget { 
            position:absolute; top:20px; right:20px; 
            background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); 
            border: 1px solid rgba(255,255,255,0.1); padding: 15px; 
            border-radius: 20px; min-width: 160px; z-index: 100; 
        }
        .score-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 0.8rem; font-weight: 700; }
        .score-main { font-size: 1.1rem; color: #9d4ede; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; margin-bottom: 5px; }

        .card-scopa { 
            width: 90px; height: 130px; 
            background: rgba(255,255,255,0.07); border-radius: 12px; 
            color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; 
            font-weight: 900; border: 1px solid rgba(255,255,255,0.1); 
            transition: 0.3s; position: relative; cursor:pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        .card-scopa:hover { transform: translateY(-10px) scale(1.05); border-color: #9d4ede; z-index: 10; }
        .card-bot { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1.5px solid #9d4ede; opacity: 0.8; cursor: default; }

        /* AREA TAVOLO CORRETTA */
        .table-area { 
            flex-grow: 1; width: 90%; max-width: 800px;
            display: flex; align-items: center; justify-content: center; 
            flex-wrap: wrap; gap: 20px; 
            margin: 20px 0; padding: 30px;
            border-radius: 40px; background: rgba(255,255,255,0.02);
            border: 2px dashed rgba(157, 78, 221, 0.1);
            min-height: 300px;
        }
        
        .hand-container { display: flex; gap: 15px; justify-content: center; width: 100%; min-height: 140px; }
        
        .turn-indicator { 
            position: absolute; left: 20px; top: 20px; 
            padding: 10px 20px; border-radius: 12px; 
            font-size: 14px; font-weight: 800; text-transform: uppercase; 
        }
        .active-p { background: #00ffa3; color: #000; box-shadow: 0 0 20px rgba(0,255,163,0.3); }
        .active-b { background: #ff416c; color: #fff; box-shadow: 0 0 20px rgba(255,65,108,0.3); }

        #toast-scopa { 
            position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); 
            font-size:6rem; font-weight:900; color:#9d4ede; 
            text-shadow: 0 0 40px rgba(157,78,221,0.8); display:none; 
            pointer-events:none; z-index:2000;
        }
    </style>
    
    <div class="scopa-wrapper">
        <div id="turn-tag" class="turn-indicator active-p">TUO TURNO</div>

        <div class="score-widget">
            <div class="score-row score-main"><span>SCOPE</span> <span><span id="p-scopa">0</span> - <span id="b-scopa">0</span></span></div>
            <div class="score-row" style="color:rgba(255,255,255,0.5)"><span>CARTE</span> <span><span id="p-cap">0</span> - <span id="b-cap">0</span></span></div>
            <div class="score-row" style="color:#ffbd39"><span>DENARI</span> <span><span id="p-den">0</span> - <span id="b-den">0</span></span></div>
        </div>

        <div id="bot-hand-ui" class="hand-container"></div>
        
        <div class="table-area" id="table-ui"></div>
        
        <div id="player-hand-ui" class="hand-container"></div>
        
        <div id="toast-scopa">SCOPA!</div>
    </div>
    `;
}

function renderGame(state, container) {
    const tableUI = container.querySelector('#table-ui');
    const playerUI = container.querySelector('#player-hand-ui');
    const botUI = container.querySelector('#bot-hand-ui');
    const turnTag = container.querySelector('#turn-tag');

    if(state.turn === 'player') {
        turnTag.innerText = "TUO TURNO";
        turnTag.className = "turn-indicator active-p";
    } else {
        turnTag.innerText = "TURNO BOT";
        turnTag.className = "turn-indicator active-b";
    }

    tableUI.innerHTML = state.table.map(c => renderCard(c)).join('');
    playerUI.innerHTML = state.playerHand.map((c, i) => renderCard(c, i, true)).join('');
    botUI.innerHTML = state.botHand.map(() => `<div class="card-scopa card-bot"></div>`).join('');

    container.querySelector('#p-scopa').innerText = state.playerScopas;
    container.querySelector('#b-scopa').innerText = state.botScopas;
    container.querySelector('#p-cap').innerText = state.playerCaptured.length;
    container.querySelector('#b-cap').innerText = state.botCaptured.length;
    container.querySelector('#p-den').innerText = state.playerCaptured.filter(c => c.suit === 'denari').length;
    container.querySelector('#b-den').innerText = state.botCaptured.filter(c => c.suit === 'denari').length;

    playerUI.querySelectorAll('.card-scopa').forEach(card => {
        card.onclick = () => {
            if (state.turn === 'player' && !state.isAnimating) {
                handlePlay(parseInt(card.dataset.idx), 'player', state, container);
            }
        };
    });
}

function renderCard(card, index = 0, isPlayer = false) {
    const suitData = SUITS.find(s => s.id === card.suit);
    const dataIdx = isPlayer ? `data-idx="${index}"` : '';
    const displayVal = card.value === 1 ? 'A' : (card.value === 8 ? 'F' : (card.value === 9 ? 'C' : (card.value === 10 ? 'R' : card.value)));
    
    return `
        <div ${dataIdx} class="card-scopa">
            <span style="font-size:11px; color:${suitData.color}; font-weight:900; text-transform:uppercase;">${card.suit}</span>
            <span style="font-size:2.2rem; margin:8px 0;">${suitData.icon}</span>
            <span style="font-size:1.6rem; font-weight:bold;">${displayVal}</span>
        </div>
    `;
}

// ... rest of the logic (findCaptures, handlePlay, etc.) stays the same ...

function findCaptures(card, table) {
    const single = table.find(c => c.value === card.value);
    if (single) return [single];
    for (let i = 0; i < table.length; i++) {
        for (let j = i + 1; j < table.length; j++) {
            if (table[i].value + table[j].value === card.value) return [table[i], table[j]];
        }
    }
    for (let i = 0; i < table.length; i++) {
        for (let j = i + 1; j < table.length; j++) {
            for (let k = j + 1; k < table.length; k++) {
                if (table[i].value + table[j].value + table[k].value === card.value) return [table[i], table[j], table[k]];
            }
        }
    }
    return null;
}

function handlePlay(cardIndex, actor, state, container) {
    state.isAnimating = true;
    const hand = actor === 'player' ? state.playerHand : state.botHand;
    const capturedPool = actor === 'player' ? state.playerCaptured : state.botCaptured;
    const playedCard = hand.splice(cardIndex, 1)[0];
    const toCapture = findCaptures(playedCard, state.table);
    
    if (toCapture) {
        capturedPool.push(playedCard, ...toCapture);
        state.table = state.table.filter(c => !toCapture.includes(c));
        state.lastCapturePlayer = (actor === 'player');
        if (state.table.length === 0 && state.deck.length > 0) {
            if (actor === 'player') state.playerScopas++; else state.botScopas++;
            showScopaToast(container);
        }
    } else {
        state.table.push(playedCard);
    }

    state.turn = actor === 'player' ? 'bot' : 'player';
    renderGame(state, container);

    setTimeout(() => {
        state.isAnimating = false;
        checkNextStep(state, container);
    }, 600);
}

function checkNextStep(state, container) {
    if (state.playerHand.length === 0 && state.botHand.length === 0) {
        if (state.deck.length > 0) {
            state.playerHand = state.deck.splice(0, 3);
            state.botHand = state.deck.splice(0, 3);
            renderGame(state, container);
        } else {
            endMatch(state, container);
        }
    }
    if (state.turn === 'bot' && !state.isAnimating) {
        setTimeout(() => {
            let bestIdx = state.botHand.findIndex(c => findCaptures(c, state.table));
            if (bestIdx === -1) bestIdx = 0;
            handlePlay(bestIdx, 'bot', state, container);
        }, 800);
    }
}

function showScopaToast(container) {
    const t = container.querySelector('#toast-scopa');
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 1500);
}

function endMatch(state, container) {
    if (state.table.length > 0) {
        if (state.lastCapturePlayer) state.playerCaptured.push(...state.table);
        else state.botCaptured.push(...state.table);
        state.table = [];
    }
    alert("Fine Partita!");
    window.location.hash = "lobby";
}