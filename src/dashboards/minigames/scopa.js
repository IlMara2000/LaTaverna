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
    document.body.style.touchAction = 'none';

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
    
    // Shuffle (Fisher-Yates)
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
            background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%); 
            color: white; font-family: 'Poppins', sans-serif; 
            display: flex; flex-direction: column; padding: 15px; overflow: hidden; position: relative;
        }
        
        .score-bar { 
            display: flex; justify-content: space-between; background: rgba(255,255,255,0.05); 
            padding: 12px; border-radius: 18px; font-size: 10px; font-weight: 700; border: 1px solid rgba(255,255,255,0.1);
        }
        .score-box { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .score-val { font-size: 16px; color: #ffbd39; }

        .table-area { 
            flex: 1; display: grid; grid-template-columns: repeat(auto-fit, 70px); gap: 10px; 
            align-content: center; justify-content: center;
            background: rgba(0,0,0,0.3); border-radius: 24px; margin: 20px 0; 
            border: 2px dashed rgba(255,255,255,0.05); position: relative;
        }

        .card-scopa { 
            width: 75px; height: 110px; background: #fff; border-radius: 12px;
            display: flex; flex-direction: column; align-items: center; justify-content: space-between;
            padding: 8px; border: 1px solid rgba(0,0,0,0.1); position: relative; transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 4px 15px rgba(0,0,0,0.4); color: #1a1a1a;
        }
        .player-card { cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .player-card:active { transform: translateY(-15px) scale(1.05); z-index: 10; }
        
        .bot-card { 
            background: linear-gradient(135deg, #2a0a4a 0%, #6b21a8 100%); 
            border: 2px solid #9d4ede; box-shadow: 0 0 15px rgba(157,78,221,0.3);
        }

        .hand { display: flex; gap: 12px; justify-content: center; height: 120px; align-items: center; }

        #scopa-toast {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-size: 4rem; font-weight: 900; color: #ffbd39; text-shadow: 0 0 30px rgba(255,189,57,0.8);
            z-index: 100; display: none; pointer-events: none;
            font-family: 'Montserrat', sans-serif; font-style: italic;
        }
        
        .anim-pop { animation: popToast 0.8s ease-out forwards; }
        @keyframes popToast {
            0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
            50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
    </style>
    
    <div class="mobile-emulator">
        <div class="scopa-wrapper">
            <div class="score-bar">
                <div class="score-box"><span>TU</span><span id="p-score" class="score-val">0</span><span>S: <b id="p-s">0</b></span></div>
                <div id="turn-display" style="font-size: 12px; align-self: center; letter-spacing: 1px; font-weight: 900;">IL TUO TURNO</div>
                <div class="score-box"><span>BOT</span><span id="b-score" class="score-val">0</span><span>S: <b id="b-s">0</b></span></div>
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
    turnDisplay.innerText = state.turn === 'player' ? "TUO TURNO" : "PENSANDO...";
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

    // Click eventi solo se è il turno del player e non c'è animazione
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
            <div style="width: 100%; text-align: left; font-weight: 900; font-size: 14px;">${label}</div>
            <div style="font-size: 28px;">${suit.icon}</div>
            <div style="width: 100%; text-align: right; font-weight: 900; font-size: 14px; transform: rotate(180deg)">${label}</div>
        </div>
    `;
}

// --- LOGICA PRESA ---
function findBestCapture(card, table) {
    // 1. Regola Scopa: presa singola obbligatoria se esiste
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
        
        // Verifica Scopa (tavolo vuoto ma deck ancora pieno o mani ancora piene)
        if (state.table.length === 0 && (state.deck.length > 0 || state.playerHand.length > 0)) {
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
        // Controllo fine mano (entrambe le mani vuote)
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
        // Il bot cerca la prima carta che fa una presa, altrimenti scarta la più bassa
        let idx = state.botHand.findIndex(c => findBestCapture(c, state.table));
        if (idx === -1) idx = 0; 
        handleMove(idx, 'bot', state, container);
    }, 1000);
}

function triggerScopa(container) {
    const toast = container.querySelector('#scopa-toast');
    toast.style.display = 'block';
    toast.classList.add('anim-pop');
    setTimeout(() => {
        toast.style.display = 'none';
        toast.classList.remove('anim-pop');
    }, 1200);
}

function finishMatch(state, container) {
    // Le ultime carte a terra vanno a chi ha fatto l'ultima presa
    if (state.table.length > 0) {
        const pool = state.lastCapturePlayer ? state.playerCaptured : state.botCaptured;
        pool.push(...state.table);
        state.table = [];
    }
    
    const pTotal = state.playerCaptured.length + (state.playerScopas * 5); // Calcolo semplificato
    const bTotal = state.botCaptured.length + (state.botScopas * 5);
    
    const msg = pTotal >= bTotal ? "VITTORIA! 🏆" : "HA VINTO IL BOT! 🤖";
    
    alert(`${msg}\n\nTu: ${state.playerCaptured.length} carte + ${state.playerScopas} Scope\nBot: ${state.botCaptured.length} carte + ${state.botScopas} Scope`);
    window.location.hash = "lobby";
}