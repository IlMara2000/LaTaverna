import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

export function initBurraco(container) {
    updateSidebarContext("minigames");
    renderSelectionMenu(container);
}

// --- 1. SELEZIONE MODALITÀ ---
function renderSelectionMenu(container) {
    container.innerHTML = `
    <style>
        .menu-overlay { width:100%; height:100dvh; background:#05020a; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; color:white; }
        .mode-btn { width:280px; padding:20px; border-radius:15px; border:1px solid #9d4ede; background:rgba(157,78,221,0.1); color:white; font-size:18px; font-weight:900; cursor:pointer; transition:0.3s; }
        .mode-btn:hover { background:#9d4ede; transform:scale(1.05); }
    </style>
    <div class="menu-overlay">
        <h1 style="margin-bottom:30px; letter-spacing:5px;">BURRACO</h1>
        <button class="mode-btn" id="mode-2">1 VS 1</button>
        <button class="mode-btn" id="mode-4">2 VS 2</button>
    </div>
    `;

    document.getElementById('mode-2').onclick = () => startGame(container, 2);
    document.getElementById('mode-4').onclick = () => startGame(container, 4);
}

function startGame(container, players) {
    let state = {
        mode: players,
        deck: [],
        hands: { player: [], bot1: [], bot2: [], bot3: [] },
        // bot2 è il compagno del player (Team 1), bot1 e bot3 sono Team 2
        playerSequence: players === 2 ? ['player', 'bot1'] : ['player', 'bot1', 'bot2', 'bot3'],
        turnIndex: 0,
        pozzetti: [[], []],
        tables: { team1: [], team2: [] },
        discardPile: [],
        turn: 'player',
        phase: 'draw',
        selectedIndices: [],
        tutorMsg: "Inizia il tuo turno: pesca dal mazzo o prendi l'intero monte scarti."
    };

    renderLayout(container, state);
    initLogic(state);
}

// --- 2. LOGICA & LAYOUT ---
function initLogic(state) {
    state.deck = createBurracoDeck();
    shuffle(state.deck);
    
    // Distribuzione
    state.hands.player = state.deck.splice(0, 11);
    state.hands.bot1 = state.deck.splice(0, 11);
    if(state.mode === 4) {
        state.hands.bot2 = state.deck.splice(0, 11);
        state.hands.bot3 = state.deck.splice(0, 11);
    }
    
    state.pozzetti[0] = state.deck.splice(0, 11);
    state.pozzetti[1] = state.deck.splice(0, 11);
    state.discardPile.push(state.deck.pop());
    updateUI(state);
}

function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .burraco-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #0a2a1a 0%, #020a05 100%); color:white; font-family:'Inter',sans-serif; position:relative; overflow:hidden; display:flex; flex-direction:column; }
        .tables-container { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 20px; margin-top: 40px; }
        .mats { flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; padding: 10px; position: relative; display: flex; align-items: center; gap: 10px; overflow-x: auto; min-height:100px; }
        .tutor-box { position: absolute; top: 70px; right: 20px; width: 220px; background: rgba(0,0,0,0.85); border-left: 4px solid #9d4ede; padding: 15px; border-radius: 8px; font-size: 12px; z-index: 10; border: 1px solid rgba(157,78,221,0.3); }
        
        .card-b { width: 45px; height: 65px; background: white; border-radius: 6px; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; position: relative; box-shadow: 0 3px 6px rgba(0,0,0,0.3); transition: transform 0.3s; cursor: pointer; border: 1px solid #ddd; flex-shrink: 0; }
        .card-b.selected { transform: translateY(-20px); box-shadow: 0 5px 15px rgba(157,78,221,0.8); border: 2px solid #9d4ede; z-index: 10; }
        .card-b.jolly { background: #9d4ede !important; color: white !important; }
        
        .center-area { display: flex; justify-content: center; align-items: center; gap: 30px; padding: 10px; }
        .deck-stack { width: 55px; height: 80px; background: linear-gradient(135deg, #1e3799, #0c2461); border: 2px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; box-shadow: 4px 4px 0px rgba(0,0,0,0.4); cursor: pointer; }
        
        .player-hand-container { padding-bottom: 95px; display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .hand-wrapper { display: flex; justify-content: center; height: 90px; align-items: flex-end; width: 100%; }
        
        .btn-action { padding: 12px 24px; border-radius: 12px; border: none; font-weight: 900; font-size: 13px; cursor: pointer; text-transform: uppercase; transition: 0.3s; display: flex; align-items: center; gap: 8px; }
        #btn-meld { background: #2ecc71; color: white; }
        #btn-discard { background: #e74c3c; color: white; }
        .btn-action:disabled { opacity: 0.3; filter: grayscale(1); }
        .meld-group { display: flex; margin-right: 15px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 5px; }
        
        .turn-indicator { position: absolute; top: 10px; left: 20px; font-size: 12px; font-weight: bold; color: #9d4ede; text-transform: uppercase; }
    </style>

    <div class="burraco-bg">
        <div class="turn-indicator" id="turn-display">TURNO: TUO</div>
        <div id="tutor-container" class="tutor-box">
            <b style="color:#9d4ede; display:block; margin-bottom:5px;">🤖 IL TUTOR</b>
            <span id="tutor-text">${state.tutorMsg}</span>
        </div>
        <div class="tables-container">
            <div class="mats" id="bot-table"><span style="font-size:9px; opacity:0.5; position:absolute; top:5px;">TAVOLO TEAM AVVERSARIO</span></div>
            <div class="mats" id="player-table"><span style="font-size:9px; opacity:0.5; position:absolute; top:5px;">IL VOSTRO TAVOLO (TEAM 1)</span></div>
        </div>
        <div class="center-area">
            <div id="main-deck" class="deck-stack">MAZZO</div>
            <div id="discard-pile-ui" style="display:flex; min-width:60px; min-height:80px; position:relative;"></div>
        </div>
        <div class="player-hand-container">
            <div style="display:flex; gap:15px;">
                <button class="btn-action" id="btn-meld"><span>🎴</span> CALA SUL TAVOLO</button>
                <button class="btn-action" id="btn-discard"><span>🗑️</span> SCARTA</button>
            </div>
            <div id="player-hand" class="hand-wrapper"></div>
        </div>
    </div>
    `;
}

// --- 3. UI & LOGICA TURNI ---
function updateUI(state) {
    const isPlayerTurn = state.turn === 'player';
    
    document.getElementById('turn-display').innerText = `TURNO: ${state.turn.toUpperCase()}`;
    document.getElementById('tutor-text').innerText = state.tutorMsg;
    
    const btnDiscard = document.getElementById('btn-discard');
    const btnMeld = document.getElementById('btn-meld');
    btnDiscard.disabled = !isPlayerTurn || state.selectedIndices.length !== 1 || state.phase !== 'play';
    btnMeld.disabled = !isPlayerTurn || state.selectedIndices.length < 3 || state.phase !== 'play';

    // Update Hands & Tables
    renderHand(state);
    renderTables(state);
    renderDiscard(state);

    // Deck click
    document.getElementById('main-deck').onclick = () => { 
        if(state.phase === 'draw' && isPlayerTurn) drawFromDeck(state); 
    };
    
    btnDiscard.onclick = () => handleDiscard(state);
    btnMeld.onclick = () => handleMeld(state);
}

function renderHand(state) {
    const handUI = document.getElementById('player-hand');
    handUI.innerHTML = '';
    state.hands.player.forEach((card, i) => {
        const cEl = createCardElement(card);
        if (state.selectedIndices.includes(i)) cEl.classList.add('selected');
        cEl.onclick = () => {
            if (state.turn !== 'player' || state.phase === 'draw') return;
            const idx = state.selectedIndices.indexOf(i);
            if (idx > -1) state.selectedIndices.splice(idx, 1);
            else state.selectedIndices.push(i);
            updateUI(state);
        };
        handUI.appendChild(cEl);
    });
}

function renderTables(state) {
    const pTable = document.getElementById('player-table');
    const bTable = document.getElementById('bot-table');
    
    const drawTable = (el, data) => {
        const title = el.querySelector('span').outerHTML;
        el.innerHTML = title;
        data.forEach(group => {
            const gDiv = document.createElement('div');
            gDiv.className = 'meld-group';
            group.forEach((card, i) => {
                const c = createCardElement(card);
                c.style.marginLeft = i === 0 ? '0' : '-30px';
                c.style.transform = 'scale(0.8)';
                gDiv.appendChild(c);
            });
            el.appendChild(gDiv);
        });
    };
    drawTable(pTable, state.tables.team1);
    drawTable(bTable, state.tables.team2);
}

function renderDiscard(state) {
    const discardUI = document.getElementById('discard-pile-ui');
    discardUI.innerHTML = '';
    state.discardPile.slice(-3).forEach((card, i) => {
        const dEl = createCardElement(card);
        dEl.style.marginLeft = i === 0 ? '0' : '-35px';
        dEl.onclick = () => {
            if(state.phase === 'draw' && state.turn === 'player') pickDiscard(state);
        };
        discardUI.appendChild(dEl);
    });
}

// --- 4. AZIONI GIOCO ---
function nextTurn(state) {
    state.turnIndex = (state.turnIndex + 1) % state.playerSequence.length;
    state.turn = state.playerSequence[state.turnIndex];
    state.phase = 'draw';
    
    if(state.turn === 'player') {
        state.tutorMsg = "Tocca a te! Pesca o raccogli gli scarti.";
        updateUI(state);
    } else {
        state.tutorMsg = `Turno di ${state.turn}...`;
        updateUI(state);
        setTimeout(() => botExecution(state), 1500);
    }
}

function botExecution(state) {
    const currentBot = state.turn;
    const hand = state.hands[currentBot];

    // 1. Pesca (Sempre dal mazzo per ora)
    if(state.deck.length > 0) hand.push(state.deck.pop());
    
    // 2. Logica meld bot (Team 1: Player+Bot2 | Team 2: Bot1+Bot3)
    const teamKey = (currentBot === 'bot2') ? 'team1' : 'team2';
    const combos = findCombinations(hand);
    if(combos.length >= 3) {
        const val = combos[0].val;
        const group = [];
        for(let i = hand.length-1; i >= 0; i--) {
            if(hand[i].val === val) group.push(hand.splice(i, 1)[0]);
        }
        state.tables[teamKey].push(group);
    }

    // 3. Scarta
    setTimeout(() => {
        if(hand.length > 0) state.discardPile.push(hand.pop());
        nextTurn(state);
    }, 1000);
}

function drawFromDeck(state) {
    state.hands.player.push(state.deck.pop());
    state.phase = 'play';
    state.tutorMsg = "Hai pescato. Ora gioca o scarta.";
    updateUI(state);
}

function pickDiscard(state) {
    state.hands.player.push(...state.discardPile);
    state.discardPile = [];
    state.phase = 'play';
    updateUI(state);
}

function handleMeld(state) {
    const selected = state.selectedIndices.sort((a,b)=>b-a).map(i => state.hands.player.splice(i,1)[0]);
    state.tables.team1.push(selected);
    state.selectedIndices = [];
    updateUI(state);
}

function handleDiscard(state) {
    const card = state.hands.player.splice(state.selectedIndices[0], 1)[0];
    state.discardPile.push(card);
    state.selectedIndices = [];
    nextTurn(state);
}

// --- UTILS ---
function findCombinations(hand) {
    let counts = {};
    hand.forEach(c => counts[c.val] = (counts[c.val] || 0) + 1);
    let values = Object.keys(counts).filter(v => counts[v] >= 3);
    return hand.filter(c => values.includes(c.val));
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card-b ${card.suit} ${card.isJolly ? 'jolly' : ''}`;
    const suitIcon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '★' }[card.suit];
    el.innerHTML = `<span>${card.val}</span><span style="font-size:18px">${suitIcon}</span>`;
    if(!card.isJolly && (card.suit === 'hearts' || card.suit === 'diamonds')) el.style.color = '#d63031';
    return el;
}

function createBurracoDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let deck = [];
    for (let i = 0; i < 2; i++) {
        suits.forEach(s => values.forEach(v => deck.push({ suit: s, val: v, isJolly: false })));
        deck.push({ suit: 'joker', val: 'JK', isJolly: true }, { suit: 'joker', val: 'JK', isJolly: true });
    }
    return deck;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }