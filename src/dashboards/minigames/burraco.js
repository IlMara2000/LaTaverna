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
        <button class="mode-btn" id="mode-2">GIOCA 1 VS 1</button>
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
        tutorMsg: "Inizia il tuo turno: pesca dal mazzo o prendi gli scarti."
    };

    renderLayout(container, state);
    initLogic(state);
}

// --- 2. LAYOUT ---
function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .burraco-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #0a2a1a 0%, #020a05 100%); color:white; font-family:'Inter',sans-serif; position:relative; overflow:hidden; display:flex; flex-direction:column; }
        .tables-container { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 20px; margin-top: 40px; overflow-y: auto; }
        .mats { flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; padding: 15px; position: relative; display: flex; align-items: flex-start; gap: 15px; overflow-x: auto; min-height:140px; }
        .tutor-box { position: absolute; top: 70px; right: 20px; width: 220px; background: rgba(0,0,0,0.85); border-left: 4px solid #9d4ede; padding: 15px; border-radius: 8px; font-size: 12px; z-index: 10; border: 1px solid rgba(157,78,221,0.3); }
        .card-b { width: 45px; height: 65px; background: white; border-radius: 6px; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; position: relative; box-shadow: 0 3px 6px rgba(0,0,0,0.3); transition: transform 0.2s; cursor: pointer; border: 1px solid #ddd; flex-shrink: 0; }
        .card-b.selected { transform: translateY(-20px); border: 2px solid #9d4ede; z-index: 10; box-shadow: 0 0 15px #9d4ede; }
        .center-area { display: flex; justify-content: center; align-items: center; gap: 30px; padding: 10px; }
        .deck-stack { width: 55px; height: 80px; background: linear-gradient(135deg, #1e3799, #0c2461); border: 2px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; cursor: pointer; }
        .player-hand-container { padding-bottom: 95px; display: flex; flex-direction: column; align-items: center; gap: 15px; }
        .hand-wrapper { display: flex; justify-content: center; height: 90px; align-items: flex-end; width: 100%; }
        .btn-action { padding: 12px 24px; border-radius: 12px; border: none; font-weight: 900; font-size: 13px; cursor: pointer; transition: 0.3s; }
        #btn-meld { background: #2ecc71; color: white; box-shadow: 0 0 0px #2ecc71; }
        #btn-meld.valid-combo { box-shadow: 0 0 20px #2ecc71; transform: scale(1.05); }
        #btn-discard { background: #e74c3c; color: white; }
        .btn-action:disabled { opacity: 0.3; filter: grayscale(1); cursor: not-allowed; transform: scale(1) !important; box-shadow: none !important; }
        .meld-group { display: flex; flex-direction: column; height: fit-content; min-width: 45px; }
    </style>

    <div class="burraco-bg">
        <div id="tutor-container" class="tutor-box"><b style="color:#9d4ede; display:block;">🤖 TUTOR</b><span id="tutor-text"></span></div>
        <div class="tables-container">
            <div class="mats" id="bot-table"></div>
            <div class="mats" id="player-table"></div>
        </div>
        <div class="center-area">
            <div id="main-deck" class="deck-stack">MAZZO</div>
            <div id="discard-pile-ui" style="display:flex; min-width:60px; min-height:80px; position:relative;"></div>
        </div>
        <div class="player-hand-container">
            <div style="display:flex; gap:15px;">
                <button class="btn-action" id="btn-meld">CALA SUL TAVOLO</button>
                <button class="btn-action" id="btn-discard">SCARTA</button>
            </div>
            <div id="player-hand" class="hand-wrapper"></div>
        </div>
    </div>
    `;
}

// --- 3. LOGICA DI GIOCO ---
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
        if (isNewCombo) state.tutorMsg = "Puoi calare questa nuova combinazione!";
        else if (targetPilaIndex !== -1) state.tutorMsg = "Puoi aggiungere queste carte a una pila esistente.";
        else state.tutorMsg = "Seleziona una combo (min 3) o carte da attaccare.";
    }

    document.getElementById('tutor-text').innerText = state.tutorMsg;
    const btnDiscard = document.getElementById('btn-discard');
    const btnMeld = document.getElementById('btn-meld');
    
    btnDiscard.disabled = !isPlayer || state.selectedIndices.length !== 1 || state.phase !== 'play';
    btnMeld.disabled = !isPlayer || !canMeld || state.phase !== 'play';
    
    if (canMeld && isPlayer && state.phase === 'play') btnMeld.classList.add('valid-combo');
    else btnMeld.classList.remove('valid-combo');

    renderHand(state);
    renderTables(state);
    renderDiscard(state);

    document.getElementById('main-deck').onclick = () => { if(isPlayer && state.phase === 'draw') drawFromDeck(state); };
    btnDiscard.onclick = () => handleDiscard(state);
    btnMeld.onclick = () => handleMeld(state, targetPilaIndex);
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
    container.innerHTML = '';
    state.hands.player.forEach((card, i) => {
        const el = createCardElement(card);
        if (state.selectedIndices.includes(i)) el.classList.add('selected');
        el.onclick = () => {
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
        el.innerHTML = `<span style="font-size:9px; opacity:0.5; position:absolute; top:5px;">${label}</span>`;
        data.forEach(group => {
            const gDiv = document.createElement('div');
            gDiv.className = 'meld-group';
            group.forEach((card, i) => {
                const c = createCardElement(card);
                c.style.marginTop = i === 0 ? '0' : '-45px';
                c.style.transform = 'scale(0.85)';
                c.style.zIndex = i;
                gDiv.appendChild(c);
            });
            el.appendChild(gDiv);
        });
    };
    drawTable('player-table', state.tables.team1, "TUO TAVOLO");
    drawTable('bot-table', state.tables.team2, "TAVOLO AVVERSARIO");
}

function renderDiscard(state) {
    const el = document.getElementById('discard-pile-ui');
    el.innerHTML = '';
    state.discardPile.slice(-3).forEach((card, i) => {
        const c = createCardElement(card);
        c.style.marginLeft = i === 0 ? '0' : '-35px';
        c.onclick = () => { if(state.turn === 'player' && state.phase === 'draw') pickDiscard(state); };
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
        // Ordinamento intelligente che tiene conto dei Joker
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
    updateUI(state);
    setTimeout(() => botAction(state), 1500);
}

function botAction(state) {
    if (state.turn !== 'bot') return;
    if(state.deck.length > 0) state.hands.bot1.push(state.deck.pop());
    
    const botHand = state.hands.bot1;
    let moved = false;
    
    for (let i = botHand.length - 1; i >= 0; i--) {
        let targetIdx = findTargetPila([botHand[i]], state.tables.team2);
        if (targetIdx !== -1) {
            state.tables.team2[targetIdx].push(botHand.splice(i, 1)[0]);
            state.tables.team2[targetIdx].sort((a,b) => getCardValue(a) - getCardValue(b));
            moved = true;
            break; 
        }
    }

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
        updateUI(state);
    }, 1000);
}

// --- UTILS ---
function validateCombo(cards) {
    if (cards.length < 3) return false;
    
    const jollies = cards.filter(c => c.isJolly).length;
    const normalCards = cards.filter(c => !c.isJolly);
    
    if (jollies > 1) return false; // Regola Burraco: max 1 jolly per sequenza

    // CASO 1: Tris/Quartetti (Tutti lo stesso valore)
    if (normalCards.length > 0) {
        const firstVal = normalCards[0].val;
        const allSameValue = normalCards.every(c => c.val === firstVal);
        if (allSameValue) return true;
    }

    // CASO 2: Scale (Sequenza dello stesso seme)
    if (normalCards.length > 0) {
        const suit = normalCards[0].suit;
        const sameSuit = normalCards.every(c => c.suit === suit);
        if (sameSuit) {
            const values = normalCards.map(c => getCardValue(c)).sort((a, b) => a - b);
            
            // Verifica duplicati nelle scale (non ammessi tranne jolly)
            const hasDuplicates = new Set(values).size !== values.length;
            if (hasDuplicates) return false;

            let gaps = 0;
            for (let i = 0; i < values.length - 1; i++) {
                gaps += (values[i+1] - values[i] - 1);
            }
            
            // Se i buchi tra le carte sono colmabili dal numero di jolly, è valida
            return gaps <= jollies;
        }
    }
    
    return false;
}

function getCardValue(card) {
    if (card.isJolly) return 0; // Per ordinamento, il jolly sta spesso in fondo o all'inizio
    const mapping = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
    return mapping[card.val];
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card-b ${card.suit} ${card.isJolly ? 'jolly' : ''}`;
    const icon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '★' }[card.suit];
    el.innerHTML = `<span>${card.val}</span><span style="font-size:16px">${icon}</span>`;
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
    let vals = Object.keys(counts).filter(v => counts[v] >= 2); // 2 carte + 1 jolly possibile
    return hand.filter(c => vals.includes(c.val) || c.isJolly);
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }