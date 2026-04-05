import { updateSidebarContext } from '../../components/layout/Sidebar.js';

/**
 * GIOCO: SCOPA
 * Versione Stabile 2.0 - Anti-Crash & Vertical Lock
 * Tema: Amethyst Dark UI
 */

const SUITS = [
    { id: 'bastoni', icon: '🪵', color: '#00ffa3' },
    { id: 'coppe', icon: '🏆', color: '#ff416c' },
    { id: 'denari', icon: '💰', color: '#ffbd39' },
    { id: 'spade', icon: '⚔️', color: '#00d2ff' }
];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; 

export function initScopa(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    // FIX: Configurazione Scroll Mobile (Solo verticale)
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.position = 'relative';
    document.body.style.touchAction = 'pan-y'; 
    document.body.style.backgroundColor = '#090a0f';
    window.scrollTo(0, 0);

    let state = {
        deck: [], playerHand: [], botHand: [], table: [],
        playerCaptured: [], botCaptured: [], playerScopas: 0, botScopas: 0,
        lastCapturePlayer: true, turn: 'player', isAnimating: false
    };

    renderLayout(container, state);
    startGame(state, container);
}

// --- Funzione centralizzata per uscire in sicurezza ---
const quitGame = async (container) => {
    document.body.style.touchAction = '';
    document.body.style.overflowX = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        console.error("Navigazione fallita:", e);
        window.location.reload(); 
    }
};

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

// --- INTERFACCIA ---
function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        @keyframes fadeInUpOnly {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .scopa-wrapper { 
            width: 100%; max-width: 430px; min-height: 100dvh; margin: 0 auto;
            background: radial-gradient(circle at top, rgba(27,39,53,0.8) 0%, rgba(9,10,15,0.9) 100%); 
            color: white; font-family: 'Poppins', sans-serif; 
            display: flex; flex-direction: column; padding: 20px; box-sizing: border-box;
            animation: fadeInUpOnly 0.6s ease-out forwards;
            overflow-x: hidden;
        }

        .score-bar { 
            display: flex; justify-content: space-between; background: rgba(255,255,255,0.05); 
            padding: 15px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid rgba(255,255,255,0.1);
            margin-bottom: 15px;
        }
        
        .table-area { 
            flex: 1; display: grid; grid-template-columns: repeat(auto-fit, 75px); gap: 10px; 
            align-content: center; justify-content: center; min-height: 200px;
            background: rgba(0,0,0,0.2); border-radius: 24px; margin: 10px 0; 
            border: 1px dashed rgba(255,255,255,0.1);
        }

        .card-scopa { 
            width: 75px; height: 110px; background: #fff; border-radius: 12px;
            display: flex; flex-direction: column; align-items: center; justify-content: space-between;
            padding: 8px; border: 1px solid rgba(0,0,0,0.1); transition: 0.3s;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3); color: #1a1a1a; box-sizing: border-box;
        }
        
        .player-card:active { transform: translateY(-15px); }
        .bot-card { background: linear-gradient(135deg, #2a0a4a, #6b21a8); border: 1px solid #9d4ede; }

        .hand { display: flex; gap: 10px; justify-content: center; padding: 15px 0; }

        #scopa-toast {
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            font-size: 3.5rem; font-weight: 900; color: #ffbd39; text-shadow: 0 0 20px rgba(255,189,57,0.6);
            z-index: 100; display: none; pointer-events: none; font-style: italic;
        }

        .btn-exit-scopa {
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
            color: white; padding: 15px; border-radius: 14px; font-weight: 800; font-size: 12px; 
            cursor: pointer; margin-top: 10px; width: 100%;
        }
    </style>
    
    <div class="scopa-wrapper">
        <div class="score-bar">
            <div>TU: <b id="p-score">0</b> (S: <b id="p-s">0</b>)</div>
            <div id="turn-display" style="color: #9d4ede;">TUO TURNO</div>
            <div>BOT: <b id="b-score">0</b> (S: <b id="b-s">0</b>)</div>
        </div>

        <div id="bot-hand" class="hand"></div>
        <div id="table-ui" class="table-area"></div>
        <div id="player-hand" class="hand"></div>
        
        <button id="btn-exit-game" class="btn-exit-scopa">← ESCI DAL GIOCO</button>
        <div id="scopa-toast">SCOPA!</div>
    </div>
    `;

    container.querySelector('#btn-exit-game').onclick = (e) => {
        e.preventDefault();
        quitGame(container);
    };
}

function renderGame(state, container) {
    const tableUI = container.querySelector('#table-ui');
    const playerUI = container.querySelector('#player-hand');
    const botUI = container.querySelector('#bot-hand');
    const turnDisplay = container.querySelector('#turn-display');

    turnDisplay.innerText = state.turn === 'player' ? "TUO TURNO" : "IA...";
    turnDisplay.style.color = state.turn === 'player' ? "#00ffa3" : "#ff416c";

    tableUI.innerHTML = state.table.map(c => renderCardHTML(c)).join('');
    playerUI.innerHTML = state.playerHand.map((c, i) => renderCardHTML(c, i, true)).join('');
    botUI.innerHTML = state.botHand.map(() => `<div class="card-scopa bot-card"></div>`).join('');

    container.querySelector('#p-score').innerText = state.playerCaptured.length;
    container.querySelector('#b-score').innerText = state.botCaptured.length;
    container.querySelector('#p-s').innerText = state.playerScopas;
    container.querySelector('#b-s').innerText = state.botScopas;

    playerUI.querySelectorAll('.player-card').forEach(card => {
        card.onclick = (e) => {
            e.preventDefault();
            if (state.turn === 'player' && !state.isAnimating) {
                handleMove(parseInt(card.dataset.idx), 'player', state, container);
            }
        };
    });
}

function renderCardHTML(card, index = 0, isPlayer = false) {
    const suit = SUITS.find(s => s.id === card.suit);
    const label = card.value === 1 ? 'A' : (card.value === 8 ? 'F' : (card.value === 9 ? 'C' : (card.value === 10 ? 'R' : card.value)));
    const clickable = isPlayer ? 'player-card' : '';
    return `
        <div class="card-scopa ${clickable}" ${isPlayer ? `data-idx="${index}"` : ''}>
            <div style="width: 100%; text-align: left; font-weight: 900; font-size: 12px;">${label}</div>
            <div style="font-size: 24px;">${suit.icon}</div>
            <div style="width: 100%; text-align: right; font-weight: 900; font-size: 12px; transform: rotate(180deg)">${label}</div>
        </div>
    `;
}

function findBestCapture(card, table) {
    const single = table.find(c => c.value === card.value);
    if (single) return [single];

    for (let i = 0; i < table.length; i++) {
        for (let j = i + 1; j < table.length; j++) {
            if (table[i].value + table[j].value === card.value) return [table[i], table[j]];
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
        if (idx === -1) idx = 0; 
        handleMove(idx, 'bot', state, container);
    }, 1000);
}

function triggerScopa(container) {
    const toast = container.querySelector('#scopa-toast');
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 1200);
}

function finishMatch(state, container) {
    if (state.table.length > 0) {
        const pool = state.lastCapturePlayer ? state.playerCaptured : state.botCaptured;
        pool.push(...state.table);
        state.table = [];
    }
    const pTotal = state.playerCaptured.length + (state.playerScopas * 5);
    const bTotal = state.botCaptured.length + (state.botScopas * 5);
    const msg = pTotal >= bTotal ? "VITTORIA! 🏆" : "SCONFITTA! 🤖";
    alert(`${msg}\n\nTu: ${state.playerCaptured.length} + ${state.playerScopas} Scope\nBot: ${state.botCaptured.length} + ${state.botScopas} Scope`);
    quitGame(container);
}