import { updateSidebarContext } from '../../components/layout/Sidebar.js';

export function initBurraco(container) {
    updateSidebarContext("minigames");
    
    // Blocca lo scroll del body e fissa la visuale
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';

    renderSelectionMenu(container);
}

// --- 1. SELEZIONE MODALITÀ (STILE MOBILE) ---
function renderSelectionMenu(container) {
    container.innerHTML = `
    <style>
        .mobile-emulator { width:100%; height:100dvh; background:#05010a; display:flex; justify-content:center; align-items:center; }
        .burraco-wrapper { 
            width:100%; max-width:430px; height:100%; max-height:932px; 
            background:#05020a; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; color:white; position:relative;
        }
        .mode-btn { width:80%; padding:18px; border-radius:18px; border:1px solid #9d4ede; background:rgba(157,78,221,0.1); color:white; font-size:16px; font-weight:900; cursor:pointer; transition:0.3s; text-transform:uppercase; -webkit-tap-highlight-color: transparent; }
        .mode-btn:active { background:#9d4ede; transform:scale(0.95); }
    </style>
    <div class="mobile-emulator">
        <div class="burraco-wrapper">
            <h1 style="margin-bottom:30px; letter-spacing:5px; font-family:'Montserrat'; font-size:2.5rem;">BURRACO</h1>
            <button class="mode-btn" id="mode-2">GIOCA 1 VS 1</button>
        </div>
    </div>
    `;

    document.getElementById('mode-2').onclick = () => startGame(container, 2);
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
    initLogic(state);
}

// --- 2. LAYOUT OTTIMIZZATO ---
function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .mobile-emulator { width:100%; height:100dvh; background:#05010a; display:flex; justify-content:center; align-items:center; }
        .burraco-wrapper { 
            width:100%; max-width:430px; height:100%; max-height:932px; 
            background: radial-gradient(circle at center, #0a2a1a 0%, #020a05 100%); 
            color:white; font-family:'Poppins',sans-serif; position:relative; overflow:hidden; display:flex; flex-direction:column;
        }
        .tables-container { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 15px; margin-top: 40px; overflow-y: hidden; }
        .mats { height: 130px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; position: relative; display: flex; align-items: flex-start; gap: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        
        .tutor-box { position: absolute; top: 10px; left: 15px; right: 15px; background: rgba(0,0,0,0.7); border-left: 3px solid #9d4ede; padding: 8px 12px; border-radius: 8px; font-size: 11px; z-index: 10; backdrop-filter: blur(5px); pointer-events: none; }
        
        .card-b { width: 42px; height: 60px; background: white; border-radius: 5px; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 10px; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transition: transform 0.2s; cursor: pointer; flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
        .card-b.selected { transform: translateY(-15px); border: 2px solid #9d4ede; z-index: 10; box-shadow: 0 0 12px #9d4ede; }
        
        .center-area { display: flex; justify-content: center; align-items: center; gap: 40px; padding: 10px; background: rgba(0,0,0,0.2); }
        .deck-stack { width: 50px; height: 70px; background: linear-gradient(135deg, #1e3799, #0c2461); border: 2px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        
        .player-hand-container { padding: 10px 10px 40px 10px; display: flex; flex-direction: column; align-items: center; gap: 10px; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.1); }
        .hand-wrapper { display: flex; justify-content: flex-start; height: 85px; align-items: flex-end; width: 100%; overflow-x: auto; padding-bottom: 10px; gap: 2px; -webkit-overflow-scrolling: touch; }
        
        .btn-action { flex: 1; padding: 12px; border-radius: 10px; border: none; font-weight: 900; font-size: 11px; cursor: pointer; text-transform: uppercase; -webkit-tap-highlight-color: transparent; }
        #btn-meld { background: #2ecc71; color: white; }
        #btn-discard { background: #e74c3c; color: white; }
        .btn-action:disabled { opacity: 0.2; filter: grayscale(1); pointer-events: none; }
        
        .meld-group { display: flex; flex-direction: column; height: fit-content; min-width: 42px; margin-right: 5px; }
        
        /* Nascondi scrollbar per pulizia estetica */
        .hand-wrapper::-webkit-scrollbar, .mats::-webkit-scrollbar { display: none; }
    </style>

    <div class="mobile-emulator">
        <div class="burraco-wrapper">
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
    </div>
    `;
}

// --- 3. LOGICA DI GIOCO COMPLETA ---
function initLogic(state) {
    state.deck = createBurracoDeck();
    shuffle(state.deck);
    state.hands.player = state.deck.splice(0, 11);
    state.hands.bot1 = state.deck.splice(0, 11);
    state.discardPile.push(state.deck.pop());
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
        else state.tutorMsg = "Seleziona almeno 3 carte per una combo.";
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
    if(deckEl) deckEl.onclick = () => { if(isPlayer && state.phase === 'draw') drawFromDeck(state); };
    if(btnDiscard) btnDiscard.onclick = () => handleDiscard(state);
    if(btnMeld) btnMeld.onclick = () => handleMeld(state, targetPilaIndex);
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
        el.innerHTML = `<span style="font-size:8px; opacity:0.4; position:absolute; top:2px; left:5px; pointer-events:none;">${label}</span>`;
        data.forEach(group => {
            const gDiv = document.createElement('div');
            gDiv.className = 'meld-group';
            group.forEach((card, i) => {
                const c = createCardElement(card);
                c.style.marginTop = i === 0 ? '0' : '-48px';
                c.style.transform = 'scale(0.85)';
                c.style.zIndex = i;
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
        c.style.zIndex = i;
        c.onclick = (e) => { 
            e.preventDefault();
            if(state.turn === 'player' && state.phase === 'draw') pickDiscard(state); 
        };
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
    setTimeout(() => botAction(state), 1500);
}

function botAction(state) {
    if (state.turn !== 'bot') return;
    if(state.deck.length > 0) state.hands.bot1.push(state.deck.pop());
    
    const botHand = state.hands.bot1;
    let moved = false;
    
    // Prova ad attaccare alle pile esistenti
    for (let i = botHand.length - 1; i >= 0; i--) {
        let targetIdx = findTargetPila([botHand[i]], state.tables.team2);
        if (targetIdx !== -1) {
            state.tables.team2[targetIdx].push(botHand.splice(i, 1)[0]);
            state.tables.team2[targetIdx].sort((a,b) => getCardValue(a) - getCardValue(b));
            moved = true;
            break; 
        }
    }

    // Se non ha attaccato, cerca nuove combinazioni
    if(!moved) {
        const combos = findCombinations(state.hands.bot1);
        if(combos.length >= 3) {
            const val = combos[0].val;
            const group = [];
            for(let i = state.hands.bot1.length - 1; i >= 0; i--) {
                if(state.hands.bot1[i].val === val || state.hands.bot1[i].isJolly) group.push(state.hands.bot1.splice(i, 1)[0]);
            }
            state.tables.team2.push(group);
        }
    }

    setTimeout(() => {
        if(state.hands.bot1.length > 0) state.discardPile.push(state.hands.bot1.pop());
        state.turn = 'player';
        state.phase = 'draw';
        state.tutorMsg = "Tocca il mazzo per pescare.";
        updateUI(state);
    }, 1000);
}

// --- UTILS ---
function validateCombo(cards) {
    if (cards.length < 3) return false;
    const jollies = cards.filter(c => c.isJolly).length;
    const normalCards = cards.filter(c => !c.isJolly);
    if (jollies > 1) return false;
    if (normalCards.length > 0) {
        const firstVal = normalCards[0].val;
        if (normalCards.every(c => c.val === firstVal)) return true;
        const suit = normalCards[0].suit;
        if (normalCards.every(c => c.suit === suit)) {
            const values = normalCards.map(c => getCardValue(c)).sort((a, b) => a - b);
            if (new Set(values).size !== values.length) return false;
            let gaps = 0;
            for (let i = 0; i < values.length - 1; i++) gaps += (values[i+1] - values[i] - 1);
            return gaps <= jollies;
        }
    }
    return false;
}

function getCardValue(card) {
    if (card.isJolly) return 0;
    const mapping = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
    return mapping[card.val];
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card-b ${card.suit}`;
    const icon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '★' }[card.suit];
    el.innerHTML = `<span>${card.val}</span><span style="font-size:14px">${icon}</span>`;
    if(!card.isJolly && (card.suit === 'hearts' || card.suit === 'diamonds')) el.style.color = '#d63031';
    if(card.isJolly) { el.style.background = '#9d4ede'; el.style.color = 'white'; }
    return el;
}

function createBurracoDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'], values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    let deck = [];
    for(let i=0; i<2; i++) {
        suits.forEach(s => values.forEach(v => deck.push({suit:s, val:v, isJolly:false})));
        deck.push({suit:'joker', val:'JK', isJolly:true}, {suit:'joker', val:'JK', isJolly:true});
    }
    return deck;
}

function findCombinations(hand) {
    let counts = {};
    hand.forEach(c => { if(!c.isJolly) counts[c.val] = (counts[c.val] || 0) + 1; });
    let vals = Object.keys(counts).filter(v => counts[v] >= 2);
    return hand.filter(c => vals.includes(c.val) || c.isJolly);
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }