import { updateSidebarContext } from '../../components/layout/Sidebar.js';

/**
 * GIOCO: BURRACO
 * Versione Stabile 2.3 - Premium Amethyst 5.4 UI (Borderless)
 */

export function initBurraco(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }
    
    // FIX: Configurazione mobile-friendly aggressiva per i giochi di carte
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'hidden'; 
    document.body.style.position = 'relative';
    document.body.style.touchAction = 'none'; 
    document.body.style.overscrollBehavior = 'none';
    document.body.style.backgroundColor = '#05010a'; 
    window.scrollTo(0, 0);

    renderSelectionMenu(container);
}

// --- Funzione centralizzata per uscire in sicurezza ---
const quitGame = async (container) => {
    document.body.style.overflowY = 'auto';
    document.body.style.overflowX = '';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.backgroundColor = '';
    
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        console.error("Errore navigazione:", e);
        window.location.reload(); 
    }
};

// --- 1. SELEZIONE MODALITÀ (STILE PREMIUM BORDERLESS) ---
function renderSelectionMenu(container) {
    // RIMOSSO: Ogni traccia di .setup-card, border, box-shadow e limitazioni di larghezza.
    // Ora è un overlay puro e piatto che riempie lo schermo.
    container.innerHTML = `
    <div class="fade-in" style="position:absolute; inset:0; background:rgba(5, 2, 10, 0.95); backdrop-filter: blur(10px); z-index:11000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 20px; box-sizing: border-box;">
        
        <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 40px; filter: drop-shadow(0 0 20px rgba(157,78,221,0.5));">BURRACO</h1>
        
        <button class="btn-primary" id="mode-2" style="width: 100%; max-width: 280px; margin-bottom: 15px; font-size: 1.1rem; border: none; background: var(--accent-gradient);">GIOCA 1 VS 1</button>
        <button id="btn-quit-start" class="btn-back-glass" style="width: 100%; max-width: 280px; border-left: none;">← TORNA ALLA LIBRERIA</button>
        
    </div>
    `;

    document.getElementById('mode-2').onclick = (e) => { e.preventDefault(); startGame(container, 2); };
    document.getElementById('btn-quit-start').onclick = (e) => { e.preventDefault(); quitGame(container); };
}

function startGame(container, players) {
    let state = {
        mode: players, deck: [],
        hands: { player: [], bot1: [] },
        tables: { team1: [], team2: [] },
        discardPile: [], turn: 'player', phase: 'draw',
        selectedIndices: [], tutorMsg: "Tocca il mazzo per pescare o prendi gli scarti."
    };

    renderLayout(container, state);
    initLogic(state, container);
}

// --- 2. LAYOUT GIOCO (PREMIUM UI BORDERLESS) ---
function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        /* RIMOSSO: La @media query che aggiungeva il border-radius e il bordo a 431px! */
        .burraco-game-wrapper { 
            width:100%; max-width: 500px; height:100dvh; margin: 0 auto;
            background: radial-gradient(circle at center, rgba(10,42,26,0.8) 0%, rgba(2,10,5,0.9) 100%); 
            color:white; font-family:'Poppins',sans-serif; position:relative; overflow:hidden; display:flex; flex-direction:column;
            box-sizing: border-box;
        }

        .btn-exit-game { 
            position: absolute; top: calc(15px + env(safe-area-inset-top)); left: 15px; z-index: 100; 
            background: var(--glass-surface); border: 1px solid var(--glass-border); 
            color: white; padding: 8px 16px; border-radius: 14px; font-weight: 800; font-size: 10px; 
            cursor: pointer; outline: none; transition: 0.2s; backdrop-filter: blur(10px);
        }
        .btn-exit-game:active { transform: scale(0.95); background: rgba(157, 78, 221, 0.2); border-color: var(--amethyst-bright); }
        
        .tables-container { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: calc(55px + env(safe-area-inset-top)) 15px 15px 15px; overflow: hidden; }
        
        .mats { 
            height: 130px; background: var(--glass-surface); border: 1px solid var(--glass-border); 
            border-radius: 16px; padding: 12px; position: relative; display: flex; gap: 10px; 
            overflow-x: auto; -webkit-overflow-scrolling: touch; box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
        }
        
        .tutor-box { 
            position: absolute; top: calc(15px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); 
            background: rgba(5, 2, 10, 0.85); border-left: 3px solid #9d4ede; padding: 8px 16px; 
            border-radius: 10px; font-size: 11px; z-index: 10; backdrop-filter: blur(10px); 
            pointer-events: none; white-space: nowrap; font-weight: 700; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }
        
        .card-b { 
            width: 44px; height: 64px; background: white; border-radius: 6px; color: black; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            font-weight: 800; font-size: 11px; position: relative; transition: transform 0.2s, box-shadow 0.2s; 
            cursor: pointer; flex-shrink: 0; user-select: none; -webkit-tap-highlight-color: transparent; 
            box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 1px solid rgba(0,0,0,0.1);
        }
        .card-b.selected { transform: translateY(-15px); border: 2px solid var(--amethyst-bright); z-index: 10; box-shadow: 0 0 15px rgba(157, 78, 221, 0.6); }
        
        .center-area { display: flex; justify-content: center; align-items: center; gap: 40px; padding: 15px; background: rgba(0,0,0,0.2); border-top: 1px solid var(--glass-border); border-bottom: 1px solid var(--glass-border); }
        
        .deck-stack { 
            width: 50px; height: 70px; background: linear-gradient(135deg, #1e3799, #0c2461); 
            border: 2px solid rgba(255,255,255,0.5); border-radius: 8px; display: flex; align-items: center; 
            justify-content: center; font-size: 8px; font-weight: 900; cursor: pointer; outline: none; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: 0.2s;
        }
        .deck-stack:active { transform: scale(0.95); }
        
        .player-hand-container { padding: 15px 15px calc(20px + env(safe-area-inset-bottom)) 15px; display: flex; flex-direction: column; align-items: center; gap: 12px; background: rgba(0,0,0,0.4); }
        .hand-wrapper { display: flex; justify-content: flex-start; height: 90px; align-items: flex-end; width: 100%; overflow-x: auto; gap: 3px; -webkit-overflow-scrolling: touch; padding-bottom: 5px; }
        
        .btn-action { flex: 1; padding: 14px; border-radius: 14px; border: none; font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 11px; cursor: pointer; text-transform: uppercase; outline: none; transition: 0.2s; letter-spacing: 1px; }
        #btn-meld { background: linear-gradient(135deg, #2ecc71, #27ae60); color: white; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.4); }
        #btn-discard { background: linear-gradient(135deg, #ff416c, #ff4b2b); color: white; box-shadow: 0 4px 15px rgba(255, 65, 108, 0.4); }
        .btn-action:disabled { opacity: 0.3; pointer-events: none; box-shadow: none; filter: grayscale(100%); }
        .btn-action:active { transform: scale(0.95); }
    </style>

    <div class="burraco-game-wrapper fade-in">
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
            <div style="display:flex; gap:15px; width:100%;">
                <button class="btn-action" id="btn-meld">CALA COMBO</button>
                <button class="btn-action" id="btn-discard">SCARTA</button>
            </div>
            <div id="player-hand" class="hand-wrapper"></div>
        </div>
    </div>
    `;

    document.getElementById('btn-exit-ingame').onclick = (e) => { e.preventDefault(); quitGame(container); };
}

// --- 3. LOGICA DI GIOCO ---
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
        el.style.marginRight = "-15px"; 
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
        el.innerHTML = `<span style="font-size:9px; opacity:0.5; position:absolute; top:4px; left:8px; font-weight:800; letter-spacing:1px; font-family:'Montserrat', sans-serif;">${label}</span>`;
        data.forEach(group => {
            const gDiv = document.createElement('div');
            gDiv.style.display = "flex";
            gDiv.style.flexDirection = "column";
            gDiv.style.marginTop = "15px";
            group.forEach((card, i) => {
                const c = createCardElement(card);
                c.style.marginTop = i === 0 ? '0' : '-50px';
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
            alert("🏆 VITTORIA! Hai chiuso la partita.");
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
    el.innerHTML = `<span style="font-size:12px;">${card.val}</span><span style="font-size:16px;">${icon}</span>`;
    
    if(card.suit === 'hearts' || card.suit === 'diamonds') el.style.color = '#ff416c'; 
    return el;
}

function createBurracoDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'], values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    let deck = [];
    suits.forEach(s => values.forEach(v => deck.push({suit:s, val:v, isJolly:false})));
    return deck;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
