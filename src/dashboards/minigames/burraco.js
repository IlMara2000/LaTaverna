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
        .tutor-box { position: absolute; top: 70px; right: 20px; width: 220px; background: rgba(0,0,0,0.85); border-left: 4px solid #9d4ede; padding: 15px; border-radius: 8px; font-size: 12px; z-index: 10; border: 1px solid rgba(157,78,221,0.3); }
        
        .card-b { width: 45px; height: 65px; background: white; border-radius: 6px; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; position: relative; box-shadow: 0 3px 6px rgba(0,0,0,0.3); transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s; cursor: pointer; border: 1px solid #ddd; }
        .card-b.selected { transform: translateY(-25px) scale(1.1) !important; box-shadow: 0 10px 20px rgba(157,78,221,0.6); border: 2px solid #9d4ede; z-index: 100; }
        .card-b.jolly { background: #9d4ede !important; color: white !important; border-color: #7b2cbf; }
        
        @keyframes comboGlow { 0% { box-shadow: 0 0 5px #2ecc71; } 50% { box-shadow: 0 0 15px #2ecc71; } 100% { box-shadow: 0 0 5px #2ecc71; } }
        .card-combo-hint { animation: comboGlow 1.5s infinite; border: 2px solid #2ecc71 !important; }
        .card-flying { position: fixed; z-index: 9999; pointer-events: none; transition: all 0.6s cubic-bezier(0.5, 0, 0.2, 1); }

        .center-area { display: flex; justify-content: center; align-items: center; gap: 30px; padding: 10px; }
        .deck-stack { width: 55px; height: 80px; background: linear-gradient(135deg, #1e3799, #0c2461); border: 2px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; box-shadow: 4px 4px 0px rgba(0,0,0,0.4); cursor: pointer; }
        
        .player-hand-container { padding-bottom: 95px; display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .hand-wrapper { display: flex; justify-content: center; height: 90px; align-items: flex-end; }
        
        .btn-action { padding: 12px 24px; border-radius: 12px; border: none; font-weight: 900; font-size: 13px; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; transition: 0.3s; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 0px rgba(0,0,0,0.2); }
        .btn-action:active { transform: translateY(2px); box-shadow: none; }
        #btn-meld { background: linear-gradient(to bottom, #2ecc71, #27ae60); color: white; border: 1px solid #27ae60; }
        #btn-discard { background: linear-gradient(to bottom, #e74c3c, #c0392b); color: white; border: 1px solid #c0392b; }
        .btn-action:disabled { opacity: 0.3; cursor: not-allowed; filter: grayscale(1); }
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

// --- 3. UI & ANIMAZIONI ---
function updateUI(state) {
    const handUI = document.getElementById('player-hand');
    const discardUI = document.getElementById('discard-pile-ui');
    const tutorText = document.getElementById('tutor-text');
    const btnDiscard = document.getElementById('btn-discard');
    const btnMeld = document.getElementById('btn-meld');

    tutorText.innerText = state.tutorMsg;
    btnDiscard.disabled = state.selectedIndices.length !== 1 || state.phase !== 'play';
    btnMeld.disabled = state.selectedIndices.length < 3 || state.phase !== 'play';

    const combos = findCombinations(state.hands.player);

    handUI.innerHTML = '';
    state.hands.player.forEach((card, i) => {
        const cEl = createCardElement(card);
        cEl.style.marginLeft = i === 0 ? '0' : '-18px';
        if (state.selectedIndices.includes(i)) cEl.classList.add('selected');
        if (combos.some(c => c.val === card.val)) cEl.classList.add('card-combo-hint');

        cEl.onclick = () => {
            if (state.phase === 'draw') return;
            const idx = state.selectedIndices.indexOf(i);
            if (idx > -1) state.selectedIndices.splice(idx, 1);
            else state.selectedIndices.push(i);
            updateUI(state);
        };
        handUI.appendChild(cEl);
    });

    discardUI.innerHTML = '';
    if (state.discardPile.length > 0) {
        state.discardPile.slice(-3).forEach((card, i) => {
            const dEl = createCardElement(card);
            dEl.style.marginLeft = i === 0 ? '0' : '-35px';
            dEl.style.position = 'relative';
            // Cliccando su qualsiasi carta degli scarti si prende tutto il monte
            dEl.onclick = (e) => {
                e.stopPropagation();
                if(state.phase === 'draw') animateTravel('discard-pile-ui', 'player-hand', () => pickDiscard(state)); 
            };
            discardUI.appendChild(dEl);
        });
    }

    document.getElementById('main-deck').onclick = () => { 
        if(state.phase === 'draw') animateTravel('main-deck', 'player-hand', () => drawFromDeck(state)); 
    };
    
    btnDiscard.onclick = () => handleDiscard(state);
}

function animateTravel(fromId, toId, callback) {
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    if(!fromEl || !toEl) return;
    
    const rectFrom = fromEl.getBoundingClientRect();
    const rectTo = toEl.getBoundingClientRect();

    const dummy = document.createElement('div');
    dummy.className = 'card-b card-flying';
    // Se è il mazzo mostriamo il retro blu, se è lo scarto mostriamo una carta generica
    dummy.style.background = fromId === 'main-deck' ? '#1e3799' : 'white';
    dummy.style.left = rectFrom.left + 'px';
    dummy.style.top = rectFrom.top + 'px';
    document.body.appendChild(dummy);

    requestAnimationFrame(() => {
        dummy.style.left = (rectTo.left + rectTo.width/2 - 22) + 'px';
        dummy.style.top = (rectTo.top) + 'px';
        dummy.style.transform = 'rotate(360deg) scale(1.1)';
    });

    setTimeout(() => {
        dummy.remove();
        callback();
    }, 600);
}

// --- 4. LOGICA GIOCO ---
function drawFromDeck(state) {
    if(state.deck.length === 0) return;
    state.hands.player.push(state.deck.pop());
    state.phase = 'play';
    state.tutorMsg = "Hai pescato dal mazzo. Ora seleziona una carta per scartare o cala una combo.";
    updateUI(state);
}

function pickDiscard(state) {
    if(state.discardPile.length === 0) return;
    // REGOLA UFFICIALE: Prendi TUTTA la pila
    state.hands.player.push(...state.discardPile);
    state.discardPile = []; // Svuota il monte scarti
    state.phase = 'play';
    state.tutorMsg = "Hai raccolto tutto il monte scarti! Gestisci bene le tue carte.";
    updateUI(state);
}

function handleDiscard(state) {
    const idx = state.selectedIndices[0];
    const card = state.hands.player.splice(idx, 1)[0];
    state.discardPile.push(card);
    state.selectedIndices = [];
    state.phase = 'draw';
    state.turn = 'bot1';
    state.tutorMsg = "Hai scartato. Ora tocca all'avversario.";
    updateUI(state);
    setTimeout(() => botTurn(state), 1500);
}

function findCombinations(hand) {
    let counts = {};
    hand.forEach(c => counts[c.val] = (counts[c.val] || 0) + 1);
    let comboValues = Object.keys(counts).filter(v => counts[v] >= 3);
    return hand.filter(c => comboValues.includes(c.val));
}

function botTurn(state) {
    if(state.deck.length > 0) state.hands.bot1.push(state.deck.pop());
    state.discardPile.push(state.hands.bot1.pop());
    state.turn = 'player';
    state.phase = 'draw';
    state.tutorMsg = "Tocca a te! Pesca dal mazzo o prendi gli scarti.";
    updateUI(state);
}

// --- UTILS ---
function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card-b ${card.suit} ${card.isJolly ? 'jolly' : ''}`;
    const suitIcon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '★' }[card.suit];
    el.innerHTML = `<span>${card.val}</span><span style="font-size:18px">${suitIcon}</span>`;
    // Colore rosso solo per cuori e quadri, NON per il Jolly viola
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