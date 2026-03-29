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
        <h1 style="margin-bottom:30px;">Scegli Modalità Burraco</h1>
        <button class="mode-btn" id="mode-2">1 VS 1 (Tutorial)</button>
        <button class="mode-btn" id="mode-4">2 VS 2 (A Coppie)</button>
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
        pozzetti: [[], []],
        tables: { team1: [], team2: [] }, // team1: giocatore+bot2, team2: bot1+bot3
        discardPile: [],
        turn: 'player',
        phase: 'draw',
        selectedCardIndex: null,
        tutorMsg: "Benvenuto! Inizia pescando una carta dal mazzo."
    };

    renderLayout(container, state);
    initLogic(state);
}

// --- 2. LOGICA DI GIOCO & DIDATTICA ---
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
        .mats { flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; padding: 10px; position: relative; display: flex; align-items: center; gap: 10px; overflow-x: auto; }
        
        /* TUTOR BOX */
        .tutor-box { position: absolute; top: 70px; right: 20px; width: 200px; background: rgba(0,0,0,0.8); border-left: 4px solid #9d4ede; padding: 15px; border-radius: 8px; font-size: 12px; z-index: 10; animation: slideIn 0.5s; }
        
        .card-b { width: 45px; height: 65px; background: white; border-radius: 6px; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; position: relative; box-shadow: 0 3px 6px rgba(0,0,0,0.3); transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor: pointer; border: 1px solid #ddd; }
        .card-b.selected { transform: translateY(-20px) scale(1.1) !important; box-shadow: 0 10px 20px rgba(157,78,221,0.4); border: 2px solid #9d4ede; z-index: 100; }
        .card-b.hint { box-shadow: 0 0 15px #2ecc71; border: 2px solid #2ecc71; }
        
        .center-area { display: flex; justify-content: center; align-items: center; gap: 25px; padding: 10px; }
        .deck-stack { width: 55px; height: 80px; background: linear-gradient(135deg, #1e3799, #0c2461); border: 2px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; box-shadow: 4px 4px 0px rgba(0,0,0,0.4); cursor: pointer; }
        
        .player-hand-container { padding-bottom: 95px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .hand-wrapper { display: flex; justify-content: center; height: 80px; }
        
        @keyframes slideIn { from { opacity:0; transform:translateX(50px); } to { opacity:1; transform:translateX(0); } }
    </style>

    <div class="burraco-bg">
        <div id="tutor-container" class="tutor-box">
            <b style="color:#9d4ede; display:block; margin-bottom:5px;">🤖 IL TUTOR</b>
            <span id="tutor-text">${state.tutorMsg}</span>
        </div>

        <div class="tables-container">
            <div class="mats" id="bot-table"><span style="font-size:9px; opacity:0.5; position:absolute; top:5px;">TAVOLO AVVERSARIO</span></div>
            <div class="mats" id="player-table"><span style="font-size:9px; opacity:0.5; position:absolute; top:5px;">IL TUO TAVOLO</span></div>
        </div>

        <div class="center-area">
            <div id="main-deck" class="deck-stack">MAZZO</div>
            <div id="discard-pile-ui" style="display:flex;"></div>
        </div>

        <div class="player-hand-container">
            <div style="display:flex; gap:10px; margin-bottom:5px;">
                <button class="btn-calate" id="btn-meld" style="background:#2ecc71;">CALA COMBO</button>
                <button class="btn-calate" id="btn-discard" style="background:#e74c3c;">SCARTA</button>
            </div>
            <div id="player-hand" class="hand-wrapper"></div>
        </div>
    </div>
    `;
}

// --- 3. AGGIORNAMENTO UI CON SUGGERIMENTI ---
function updateUI(state) {
    const handUI = document.getElementById('player-hand');
    const discardUI = document.getElementById('discard-pile-ui');
    const tutorText = document.getElementById('tutor-text');

    // Update Tutor
    tutorText.innerText = state.tutorMsg;

    // Render Mano
    handUI.innerHTML = '';
    state.hands.player.forEach((card, i) => {
        const cEl = createCardElement(card);
        cEl.style.marginLeft = i === 0 ? '0' : '-18px';
        if (state.selectedCardIndex === i) cEl.classList.add('selected');
        
        // Suggerimento Didattico: Evidenzia Pinelle e Jolly
        if (card.val === '2' || card.isJolly) cEl.style.border = "1px solid gold";

        cEl.onclick = () => {
            state.selectedCardIndex = i;
            analyzeHand(state, card); // Analisi Tutor
            updateUI(state);
        };
        handUI.appendChild(cEl);
    });

    // Render Scarti
    discardUI.innerHTML = '';
    state.discardPile.slice(-3).forEach((card, i) => {
        const dEl = createCardElement(card);
        dEl.style.marginLeft = i === 0 ? '0' : '-35px';
        dEl.onclick = () => { if(state.phase === 'draw') pickDiscard(state); };
        discardUI.appendChild(dEl);
    });

    document.getElementById('main-deck').onclick = () => { if(state.phase === 'draw') drawFromDeck(state); };
    document.getElementById('btn-discard').onclick = () => { 
        if(state.phase === 'play' && state.selectedCardIndex !== null) handleDiscard(state);
    };
}

// --- 4. ANALISI TUTOR (Didattica) ---
function analyzeHand(state, card) {
    if (card.isJolly) {
        state.tutorMsg = "Questo è un Jolly! Può sostituire qualsiasi carta in una scala o un tris.";
    } else if (card.val === '2') {
        state.tutorMsg = "Questa è una Pinella (il 2). Vale come un jolly ma può essere usata anche come un 2 naturale.";
    } else {
        state.tutorMsg = `Hai selezionato ${card.val}. Cerca altre carte dello stesso seme per fare una scala!`;
    }
}

// --- 5. AZIONI GIOCO ---
function drawFromDeck(state) {
    const card = state.deck.pop();
    state.hands.player.push(card);
    state.phase = 'play';
    state.tutorMsg = "Hai pescato! Ora puoi calare combinazioni o scartare per finire il turno.";
    updateUI(state);
}

function handleDiscard(state) {
    const card = state.hands.player.splice(state.selectedCardIndex, 1)[0];
    state.discardPile.push(card);
    state.selectedCardIndex = null;
    state.phase = 'draw';
    state.turn = 'bot1';
    state.tutorMsg = "Turno dell'avversario. Osserva le sue mosse!";
    updateUI(state);
    setTimeout(() => botTurn(state), 1500);
}

// --- 6. IA AVVERSARIA (Simulata) ---
function botTurn(state) {
    // Logica IA Base (Espandibile con Groq)
    const botHand = state.hands.bot1;
    botHand.push(state.deck.pop()); // Pesca sempre
    
    // Scarta la prima carta per ora
    state.discardPile.push(botHand.pop());
    
    state.turn = 'player';
    state.tutorMsg = "Tocca a te! Pesca dal mazzo o prendi l'ultimo scarto.";
    updateUI(state);
}

// --- UTILS ---
function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card-b ${card.suit} ${card.isJolly ? 'jolly' : ''}`;
    const suitIcon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '★' }[card.suit];
    el.innerHTML = `<span>${card.val}</span><span style="font-size:18px">${suitIcon}</span>`;
    if(card.suit === 'hearts' || card.suit === 'diamonds') el.style.color = 'red';
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
