import { updateSidebarContext } from '../../components/layout/Sidebar.js';

export function initBurraco(container) {
    updateSidebarContext("minigames");
    
    // FIX: Configurazione pulita per evitare il bug del congelamento
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#090a0f'; 

    renderSelectionMenu(container);
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
        // Percorso relativo corretto per tornare alla lista
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        console.error("Errore navigazione:", e);
        window.location.reload(); 
    }
};

// --- 1. SELEZIONE MODALITÀ (STILE MOBILE) ---
function renderSelectionMenu(container) {
    container.innerHTML = `
    <style>
        .burraco-start-wrapper { 
            width:100%; max-width:430px; height:100dvh; margin: 0 auto;
            display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; color:white;
            animation: cardEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            background: radial-gradient(circle at center, rgba(10,42,26,0.8) 0%, rgba(2,10,5,0.9) 100%); 
        }
        @media (min-width: 431px) {
            .burraco-start-wrapper { border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); height: 90vh; margin-top: 5vh; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        }
        .mode-btn { 
            width:80%; padding:18px; border-radius:18px; border:1px solid #9d4ede; 
            background:rgba(157,78,221,0.1); color:white; font-size:16px; font-weight:900; 
            cursor:pointer; transition:0.3s; text-transform:uppercase; 
            -webkit-tap-highlight-color: transparent; outline: none; box-shadow: 0 4px 15px rgba(157,78,221,0.2);
        }
        .mode-btn:active { background:#9d4ede; transform:scale(0.95); }
    </style>
    <div class="burraco-start-wrapper">
        <h1 style="margin-bottom:30px; letter-spacing:5px; font-family:'Montserrat'; font-size:2.5rem; background: linear-gradient(135deg, #9d4ede, #ff416c); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">BURRACO</h1>
        <button class="mode-btn" id="mode-2">GIOCA 1 VS 1</button>
        <button id="btn-quit-start" style="margin-top: 20px; background:transparent; border:none; color:rgba(255,255,255,0.5); font-weight:700; cursor:pointer; outline: none; font-size: 12px; text-transform: uppercase;">← Torna Indietro</button>
    </div>
    `;

    document.getElementById('mode-2').onclick = (e) => { e.preventDefault(); startGame(container, 2); };
    document.getElementById('btn-quit-start').onclick = (e) => { e.preventDefault(); quitGame(container); };
}

function startGame(container, players) {
    let state = {
        mode: players,
        deck: [],
        hands: { player: [], bot1: [] },
        tables: { team1: [], team2: [] },
        discardPile: [],
        turn: 'player',
        phase: 'draw',
        selectedIndices: [],
        tutorMsg: "Tocca il mazzo per pescare o prendi gli scarti."
    };

    renderLayout(container, state);
    initLogic(state, container);
}

function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .burraco-game-wrapper { 
            width:100%; max-width:430px; height:100dvh; margin: 0 auto;
            background: radial-gradient(circle at center, rgba(10,42,26,0.8) 0%, rgba(2,10,5,0.9) 100%); 
            color:white; font-family:'Poppins',sans-serif; position:relative; overflow:hidden; display:flex; flex-direction:column;
            animation: cardEntrance 0.5s ease-out forwards; box-sizing: border-box;
        }
        @media (min-width: 431px) {
            .burraco-game-wrapper { border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); height: 90vh; margin-top: 5vh; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        }
        .btn-exit-game { position: absolute; top: calc(15px + env(safe-area-inset-top)); left: 15px; z-index: 100; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 10px; cursor: pointer; outline: none; }
        .tables-container { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: calc(55px + env(safe-area-inset-top)) 15px 15px 15px; overflow: hidden; }
        .mats { height: 130px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; position: relative; display: flex; gap: 10px; overflow-x: auto; }
        .tutor-box { position: absolute; top: calc(15px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.8); border-left: 3px solid #9d4ede; padding: 8px 12px; border-radius: 8px; font-size: 10px; z-index: 10; backdrop-filter: blur(5px); pointer-events: none; }
        .card-b { width: 42px; height: 60px; background: white; border-radius: 5px; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 10px; position: relative; transition: transform 0.2s; cursor: pointer; flex-shrink: 0; user-select: none; }
        .card-b.selected { transform: translateY(-15px); border: 2px solid #9d4ede; z-index: 10; box-shadow: 0 0 12px #9d4ede; }
        .center-area { display: flex; justify-content: center; align-items: center; gap: 40px; padding: 10px; background: rgba(0,0,0,0.2); }
        .deck-stack { width: 50px; height: 70px; background: linear-gradient(135deg, #1e3799, #0c2461); border: 2px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; cursor: pointer; outline: none; }
        .player-hand-container { padding: 10px 10px calc(20px + env(safe-area-inset-bottom)) 10px; display: flex; flex-direction: column; align-items: center; gap: 10px; background: rgba(0,0,0,0.4); border-top: 1px solid rgba(255,255,255,0.1); }
        .hand-wrapper { display: flex; justify-content: flex-start; height: 85px; align-items: flex-end; width: 100%; overflow-x: auto; gap: 2px; }
        .btn-action { flex: 1; padding: 12px; border-radius: 10px; border: none; font-weight: 900; font-size: 11px; cursor: pointer; text-transform: uppercase; outline: none; }
        #btn-meld { background: #2ecc71; color: white; }
        #btn-discard { background: #e74c3c; color: white; }
        .btn-action:disabled { opacity: 0.2; pointer-events: none; }
    </style>

    <div class="burraco-game-wrapper">
        <button class="btn-exit-game" id="btn-exit-ingame">← ESCI</button>
        <div id="tutor-container" class="tutor-box"><span id="tutor-text"></span></div>
        <div class="tables-container">
            <div class="mats" id="bot-table"></div>
            <div class="mats" id="player-table"></div>
        </div>
        <div class="center-area">
            <div id="main-deck" class="deck-stack">MAZZO</div>
            <div id="discard-pile-ui" style="display:flex; min-width:50px; min-height:70px; position:relative;"></div>
        </div>
        <div class="player-hand-container">
            <div style="display:flex; gap:10px; width:100%;">
                <button class="btn-action" id="btn-meld">CALA COMBO</button>
                <button class="btn-action" id="btn-discard">SCARTA</button>
            </div>
            <div id="player-hand" class="hand-wrapper"></div>
        </div>
    </div>
    `;

    document.getElementById('btn-exit-ingame').onclick = (e) => { e.preventDefault(); quitGame(container); };
}

function initLogic(state, container) {
    state.deck = createBurracoDeck();
    shuffle(state.deck);
    state.hands.player = state.deck.splice(0, 11);
    state.hands.bot1 = state.deck.splice(0, 11);
    state.discardPile.push(state.deck.pop());
    state.container = container; 
    updateUI(state);
}

function updateUI(state) {
    const isPlayer = state.turn === 'player';
    const selectedCards = state.selectedIndices.map(i => state.hands.player[i]);
    const targetPilaIndex = findTargetPila(selectedCards, state.tables.team1);
    const isNewCombo = validateCombo(selectedCards);
    const canMeld = (isNewCombo || (selectedCards.length > 0 && targetPilaIndex !== -1));

    if (isPlayer && state.phase === 'play') {
        if (isNewCombo) state.tutorMsg = "Combo valida! Cala sul tavolo.";
        else if (targetPilaIndex !== -1) state.tutorMsg = "Puoi attaccare queste carte.";
        else state.tutorMsg = "Seleziona almeno 3 carte.";
    }

    const tutorEl = document.getElementById('tutor-text');
    if(tutorEl) tutorEl.innerText = state.tutorMsg;

    const btnDiscard = document.getElementById('btn-discard');
    const btnMeld = document.getElementById('btn-meld');
    
    if(btnDiscard) btnDiscard.disabled = !isPlayer || state.selectedIndices.length !== 1 || state.phase !== 'play';
    if(btnMeld) btnMeld.disabled = !isPlayer || !canMeld || state.phase !== 'play';
    
    renderHand(state);
    renderTables(state);
    renderDiscard(state);

    const deckEl = document.getElementById('main-deck');
    if(deckEl) deckEl.onclick = (e) => { e.preventDefault(); if(isPlayer && state.phase === 'draw') drawFromDeck(state); };
    if(btnDiscard) btnDiscard.onclick = (e) => { e.preventDefault(); handleDiscard(state); };
    if(btnMeld) btnMeld.onclick = (e) => { e.preventDefault(); handleMeld(state, targetPilaIndex); };
}

function findTargetPila(selectedCards, table) {
    if (selectedCards.length === 0) return -1;
    for (let i = 0; i < table.length; i++) {
        let potentialGroup = [...table[i], ...selectedCards];
        if (validateCombo(potentialGroup)) return i;
    }
    return -1;
}

function renderHand(state) {
    const container = document.getElementById('player-hand');
    if(!container) return;
    container.innerHTML = '';
    state.hands.player.forEach((card, i) => {
        const el = createCardElement(card);
        if (state.selectedIndices.includes(i)) el.classList.add('selected');
        el.style.marginRight = "-12px"; 
        el.onclick = (e) => {
            e.preventDefault();
            if (state.turn !== 'player' || state.phase === 'draw') return;
            const pos = state.selectedIndices.indexOf(i);
            if (pos > -1) state.selectedIndices.splice(pos, 1);
            else state.selectedIndices.push(i);
            updateUI(state);
        };
        container.appendChild(el);
    });
}

function renderTables(state) {
    const drawTable = (id, data, label) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = `<span style="font-size:8px; opacity:0.4; position:absolute; top:2px; left:5px;">${label}</span>`;
        data.forEach(group => {
            const gDiv = document.createElement('div');
            gDiv.style.display = "flex";
            gDiv.style.flexDirection = "column";
            group.forEach((card, i) => {
                const c = createCardElement(card);
                c.style.marginTop = i === 0 ? '0' : '-48px';
                c.style.transform = 'scale(0.85)';
                gDiv.appendChild(c);
            });
            el.appendChild(gDiv);
        });
    };
    drawTable('player-table', state.tables.team1, "IL TUO TAVOLO");
    drawTable('bot-table', state.tables.team2, "TAVOLO AVVERSARIO");
}

function renderDiscard(state) {
    const el = document.getElementById('discard-pile-ui');
    if(!el) return;
    el.innerHTML = '';
    state.discardPile.slice(-3).forEach((card, i) => {
        const c = createCardElement(card);
        c.style.position = "absolute";
        c.style.left = `${i * 12}px`;
        c.onclick = (e) => { e.preventDefault(); if(state.turn === 'player' && state.phase === 'draw') pickDiscard(state); };
        el.appendChild(c);
    });
}

function drawFromDeck(state) {
    if(state.deck.length > 0) {
        state.hands.player.push(state.deck.pop());
        state.phase = 'play';
        updateUI(state);
    }
}

function pickDiscard(state) {
    if(state.discardPile.length > 0) {
        state.hands.player.push(...state.discardPile);
        state.discardPile = [];
        state.phase = 'play';
        updateUI(state);
    }
}

function handleMeld(state, targetPilaIndex) {
    const cards = state.selectedIndices.sort((a,b)=>b-a).map(i => state.hands.player.splice(i,1)[0]);
    if (targetPilaIndex !== -1) {
        state.tables.team1[targetPilaIndex].push(...cards);
        state.tables.team1[targetPilaIndex].sort((a, b) => getCardValue(a) - getCardValue(b));
    } else {
        cards.sort((a, b) => getCardValue(a) - getCardValue(b));
        state.tables.team1.push(cards);
    }
    state.selectedIndices = [];
    updateUI(state);
}

function handleDiscard(state) {
    const card = state.hands.player.splice(state.selectedIndices[0], 1)[0];
    state.discardPile.push(card);
    state.selectedIndices = [];
    state.turn = 'bot';
    state.phase = 'draw';
    state.tutorMsg = "Il Bot sta pensando...";
    updateUI(state);
    setTimeout(() => {
        if (state.hands.player.length === 0) {
            alert("Vittoria!");
            quitGame(state.container);
            return;
        }
        botAction(state);
    }, 1200);
}

function botAction(state) {
    if (state.turn !== 'bot') return;
    if(state.deck.length > 0) state.hands.bot1.push(state.deck.pop());
    setTimeout(() => {
        if(state.hands.bot1.length > 0) state.discardPile.push(state.hands.bot1.pop());
        state.turn = 'player';
        state.phase = 'draw';
        state.tutorMsg = "Tocca il mazzo per pescare.";
        updateUI(state);
    }, 800);
}

function validateCombo(cards) {
    if (cards.length < 3) return false;
    const normalCards = cards.filter(c => !c.isJolly);
    if (normalCards.length === 0) return false;
    const firstVal = normalCards[0].val;
    return normalCards.every(c => c.val === firstVal);
}

function getCardValue(card) {
    const mapping = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
    return mapping[card.val] || 0;
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card-b`;
    const icon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[card.suit];
    el.innerHTML = `<span>${card.val}</span><span>${icon}</span>`;
    if(card.suit === 'hearts' || card.suit === 'diamonds') el.style.color = '#d63031';
    return el;
}

function createBurracoDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'], values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    let deck = [];
    suits.forEach(s => values.forEach(v => deck.push({suit:s, val:v, isJolly:false})));
    return deck;
}

function findCombinations(hand) { return []; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
