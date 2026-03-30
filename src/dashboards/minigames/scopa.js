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

    // Blocco Scroll per Mobile
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    let state = {
        deck: [], playerHand: [], botHand: [], table: [],
        playerCaptured: [], botCaptured: [], playerScopas: 0, botScopas: 0,
        lastCapturePlayer: true, turn: 'player', isAnimating: false
    };

    renderLayout(container);
    startGame(state, container);
}

// --- LOGICA DI GIOCO ---
function startGame(state, container) {
    state.deck = [];
    SUITS.forEach(s => VALUES.forEach(v => state.deck.push({ suit: s.id, value: v })));
    
    // Shuffle
    for (let i = state.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
    }

    state.playerHand = state.deck.splice(0, 3);
    state.botHand = state.deck.splice(0, 3);
    state.table = state.deck.splice(0, 4);
    renderGame(state, container);
}

// --- INTERFACCIA MOBILE-FIRST ---
function renderLayout(container) {
    container.innerHTML = `
    <style>
        .mobile-emulator { width: 100%; height: 100dvh; background: #05010a; display: flex; justify-content: center; align-items: center; }
        .scopa-wrapper { 
            width: 100%; max-width: 430px; height: 100%; max-height: 932px;
            background: radial-gradient(circle at top, #1b2735 0%, #090a0f 100%); 
            color: white; font-family: 'Poppins', sans-serif; 
            display: flex; flex-direction: column; padding: 20px; overflow: hidden; position: relative;
        }
        
        .score-bar { 
            display: flex; justify-content: space-between; background: rgba(255,255,255,0.05); 
            padding: 10px 15px; border-radius: 15px; font-size: 11px; font-weight: 700; margin-bottom: 10px;
        }

        .table-area { 
            flex: 1; display: flex; flex-wrap: wrap; gap: 10px; align-content: center; justify-content: center;
            background: rgba(0,0,0,0.2); border-radius: 20px; margin: 15px 0; border: 1px dashed rgba(255,255,255,0.1);
        }

        .card-scopa { 
            width: 70px; height: 105px; background: rgba(255,255,255,0.08); border-radius: 10px;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            border: 1px solid rgba(255,255,255,0.1); position: relative; transition: 0.2s;
        }
        .player-card { cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .player-card:active { transform: scale(0.9); }
        .bot-card { background: linear-gradient(135deg, #2a0a4a, #05020a); border-color: #9d4ede; }

        .hand { display: flex; gap: 10px; justify-content: center; min-height: 110px; }

        #scopa-toast {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-size: 3rem; font-weight: 900; color: #ffbd39; text-shadow: 0 0 20px rgba(255,189,57,0.6);
            z-index: 100; display: none; pointer-events: none; animation: pop 0.5s ease;
        }
        @keyframes pop { 0% { transform: translate(-50%, -50%) scale(0.5); } 100% { transform: translate(-50%, -50%) scale(1.2); } }
    </style>
    
    <div class="mobile-emulator">
        <div class="scopa-wrapper">
            <div class="score-bar">
                <span>TU: <span id="p-score">0</span> (S: <span id="p-s">0</span>)</span>
                <span id="turn-display" style="color:#00ffa3">IL TUO TURNO</span>
                <span>BOT: <span id="b-score">0</span> (S: <span id="b-s">0</span>)</span>
            </div>

            <div id="bot-hand" class="hand"></div>
            <div id="table-ui" class="table-area"></div>
            <div id="player-hand" class="hand"></div>
            
            <div id="scopa-toast">SCOPA!</div>
        </div>
    </div>
    `;
}

function renderGame(state, container) {
    const tableUI = container.querySelector('#table-ui');
    const playerUI = container.querySelector('#player-hand');
    const botUI = container.querySelector('#bot-hand');
    const turnDisplay = container.querySelector('#turn-display');

    // Update Turn UI
    turnDisplay.innerText = state.turn === 'player' ? "IL TUO TURNO" : "TURNO BOT";
    turnDisplay.style.color = state.turn === 'player' ? "#00ffa3" : "#ff416c";

    // Render Cards
    tableUI.innerHTML = state.table.map(c => renderCardHTML(c)).join('');
    playerUI.innerHTML = state.playerHand.map((c, i) => renderCardHTML(c, i, true)).join('');
    botUI.innerHTML = state.botHand.map(() => `<div class="card-scopa bot-card"></div>`).join('');

    // Update Stats
    container.querySelector('#p-score').innerText = state.playerCaptured.length;
    container.querySelector('#b-score').innerText = state.botCaptured.length;
    container.querySelector('#p-s').innerText = state.playerScopas;
    container.querySelector('#b-s').innerText = state.botScopas;

    // Attach Events
    playerUI.querySelectorAll('.player-card').forEach(card => {
        card.onclick = () => {
            if (state.turn === 'player' && !state.isAnimating) {
                handleMove(parseInt(card.dataset.idx), 'player', state, container);
            }
        };
    });
}

function renderCardHTML(card, index = 0, isPlayer = false) {
    const suit = SUITS.find(s => s.id === card.suit);
    const label = card.value === 1 ? 'A' : (card.value === 8 ? 'F' : (card.value === 9 ? 'C' : (card.value === 10 ? 'R' : card.value)));
    return `
        <div class="card-scopa ${isPlayer ? 'player-card' : ''}" ${isPlayer ? `data-idx="${index}"` : ''}>
            <span style="font-size:12px; color:${suit.color}">${suit.icon}</span>
            <span style="font-size:22px; font-weight:900;">${label}</span>
        </div>
    `;
}

// --- LOGICA PRESA ---
function findBestCapture(card, table) {
    // 1. Presa singola (obbligatoria se esiste)
    const single = table.find(c => c.value === card.value);
    if (single) return [single];

    // 2. Somma di due carte
    for (let i = 0; i < table.length; i++) {
        for (let j = i + 1; j < table.length; j++) {
            if (table[i].value + table[j].value === card.value) return [table[i], table[j]];
        }
    }
    // 3. Somma di tre carte
    for (let i = 0; i < table.length; i++) {
        for (let j = i + 1; j < table.length; j++) {
            for (let k = j + 1; k < table.length; k++) {
                if (table[i].value + table[j].value + table[k].value === card.value) return [table[i], table[j], table[k]];
            }
        }
    }
    return null;
}

function handleMove(idx, actor, state, container) {
    state.isAnimating = true;
    const hand = actor === 'player' ? state.playerHand : state.botHand;
    const pool = actor === 'player' ? state.playerCaptured : state.botCaptured;
    const card = hand.splice(idx, 1)[0];
    
    const captures = findBestCapture(card, state.table);
    
    if (captures) {
        pool.push(card, ...captures);
        state.table = state.table.filter(c => !captures.includes(c));
        state.lastCapturePlayer = (actor === 'player');
        
        // Verifica Scopa
        if (state.table.length === 0 && state.deck.length > 0) {
            if (actor === 'player') state.playerScopas++; else state.botScopas++;
            triggerScopa(container);
        }
    } else {
        state.table.push(card);
    }

    state.turn = actor === 'player' ? 'bot' : 'player';
    renderGame(state, container);

    setTimeout(() => {
        state.isAnimating = false;
        if (state.playerHand.length === 0 && state.botHand.length === 0) {
            if (state.deck.length > 0) {
                state.playerHand = state.deck.splice(0, 3);
                state.botHand = state.deck.splice(0, 3);
                renderGame(state, container);
            } else {
                return finishMatch(state, container);
            }
        }
        if (state.turn === 'bot') botLogic(state, container);
    }, 600);
}

function botLogic(state, container) {
    setTimeout(() => {
        let idx = state.botHand.findIndex(c => findBestCapture(c, state.table));
        if (idx === -1) idx = 0; // Scarta la prima se non ha prese
        handleMove(idx, 'bot', state, container);
    }, 800);
}

function triggerScopa(container) {
    const toast = container.querySelector('#scopa-toast');
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 1200);
}

function finishMatch(state, container) {
    if (state.table.length > 0) {
        const pool = state.lastCapturePlayer ? state.playerCaptured : state.botCaptured;
        pool.push(...state.table);
    }
    alert(`Partita Finita!\nTu: ${state.playerCaptured.length} carte\nBot: ${state.botCaptured.length} carte`);
    window.location.hash = "lobby";
}
