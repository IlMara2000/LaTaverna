import { updateSidebarContext } from '../../components/layout/Sidebar.js';

/**
 * GIOCO: BURRACO - MASTER EDITION (Responsive & Animated)
 * Versione Stabile 2.5 - Premium Amethyst UI
 */

export function initBurraco(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }
    
    // BLOCCO SCROLL PER ESPERIENZA APP-LIKE
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none'; 
    document.body.style.backgroundColor = '#05010a'; 
    window.scrollTo(0, 0);

    renderSelectionMenu(container);
}

const quitGame = async (container) => {
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) { window.location.reload(); }
};

// --- 1. SELEZIONE MODALITÀ (STILE PREMIUM) ---
function renderSelectionMenu(container) {
    container.innerHTML = `
    <div class="fade-in" style="position:fixed; inset:0; background:#05010a; z-index:11000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 20px;">
        <img src="/assets/logo.png" style="width: 100px; margin-bottom: 20px;" class="pulse-logo">
        <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 40px;">BURRACO</h1>
        <button class="btn-primary" id="mode-2" style="width: 100%; max-width: 300px; margin-bottom: 15px; font-size: 1.1rem; border: none; background: var(--accent-gradient); cursor:pointer;">GIOCA 1 VS 1</button>
        <button id="btn-quit-start" class="btn-back-glass" style="width: 100%; max-width: 300px; cursor:pointer;">TORNA INDIETRO</button>
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
        selectedIndices: [], tutorMsg: "Tocca il mazzo per pescare.",
        isAnimating: false
    };

    renderLayout(container, state);
    initLogic(state, container);
}

// --- 2. LAYOUT GIOCO (FULL RESPONSIVE) ---
function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .burraco-master-wrapper { 
            width:100%; height:100dvh; 
            background: radial-gradient(circle at center, #1a0b2e 0%, #05010a 100%); 
            color:white; font-family:'Poppins',sans-serif; position:relative; overflow:hidden; 
            display:flex; flex-direction:column; box-sizing: border-box;
        }

        .btn-exit-game { 
            position: absolute; top: calc(15px + env(safe-area-inset-top)); left: 15px; z-index: 100; 
            background: var(--glass-surface); border: 1px solid var(--glass-border); 
            color: white; padding: 10px 20px; border-radius: 15px; font-weight: 800; font-size: 12px; cursor:pointer;
        }
        
        .tables-container { flex: 1; display: flex; flex-direction: column; gap: 15px; padding: calc(65px + env(safe-area-inset-top)) 20px 10px 20px; overflow: hidden; }
        
        .mats { 
            flex: 1; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); 
            border-radius: 20px; padding: 15px; position: relative; display: flex; gap: 12px; 
            overflow-x: auto; overflow-y: hidden; box-shadow: inset 0 0 30px rgba(0,0,0,0.3);
        }
        
        .tutor-box { 
            position: absolute; top: calc(15px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); 
            background: rgba(157, 78, 221, 0.2); border: 1px solid var(--amethyst-bright); padding: 8px 20px; 
            border-radius: 50px; font-size: 12px; z-index: 10; backdrop-filter: blur(10px); 
            pointer-events: none; white-space: nowrap; font-weight: 800; color: #fff;
        }
        
        /* DIMENSIONI CARTE DINAMICHE */
        .card-b { 
            width: clamp(45px, 10vw, 65px); 
            height: clamp(65px, 15vw, 95px); 
            background: white; border-radius: 8px; color: black; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            font-weight: 900; font-size: clamp(10px, 2vw, 14px); position: relative; 
            transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1); 
            cursor: pointer; flex-shrink: 0; user-select: none;
            box-shadow: 0 5px 15px rgba(0,0,0,0.4);
        }

        .card-b.selected { transform: translateY(-20px); border: 2.5px solid var(--amethyst-bright); z-index: 10; box-shadow: 0 0 20px var(--amethyst-glow); }
        
        .flying-card { position: fixed; z-index: 9999; pointer-events: none; transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); }

        .center-area { display: flex; justify-content: center; align-items: center; gap: 50px; padding: 20px; background: rgba(0,0,0,0.3); border-top: 1px solid var(--glass-border); }
        
        .deck-stack { 
            width: 55px; height: 80px; background: linear-gradient(135deg, #5a189a, #240046); 
            border: 2px solid #fff; border-radius: 10px; display: flex; align-items: center; 
            justify-content: center; font-size: 9px; font-weight: 900; cursor: pointer;
            box-shadow: 0 0 20px rgba(157, 78, 221, 0.4);
        }
        
        .player-hand-container { padding: 20px 20px calc(25px + env(safe-area-inset-bottom)) 20px; background: rgba(0,0,0,0.5); }
        .hand-wrapper { display: flex; justify-content: center; height: 100px; align-items: flex-end; width: 100%; overflow-x: auto; gap: 5px; padding-bottom: 10px; }
        
        .btn-action { flex: 1; padding: 15px; border-radius: 15px; border: none; font-family: 'Montserrat', sans-serif; font-weight: 900; font-size: 12px; cursor: pointer; text-transform: uppercase; transition: 0.3s; }
        #btn-meld { background: #00ffa3; color: #000; }
        #btn-discard { background: #ff416c; color: #fff; }
        .btn-action:disabled { opacity: 0.2; filter: grayscale(1); transform: scale(0.95); }
    </style>

    <div class="burraco-master-wrapper fade-in">
        <button class="btn-exit-game" id="btn-exit-ingame">← ESCI</button>
        <div id="tutor-container" class="tutor-box"><span id="tutor-text"></span></div>
        
        <div class="tables-container">
            <div class="mats" id="bot-table"></div>
            <div class="mats" id="player-table"></div>
        </div>
        
        <div class="center-area">
            <div id="main-deck" class="deck-stack">MAZZO</div>
            <div id="discard-pile-ui" style="display:flex; min-width:60px; min-height:80px; position:relative;"></div>
        </div>
        
        <div class="player-hand-container">
            <div style="display:flex; gap:15px; width:100%; max-width: 500px; margin: 0 auto 15px auto;">
                <button class="btn-action" id="btn-meld">CALA COMBO</button>
                <button class="btn-action" id="btn-discard">SCARTA</button>
            </div>
            <div id="player-hand" class="hand-wrapper"></div>
        </div>
    </div>
    `;

    document.getElementById('btn-exit-ingame').onclick = (e) => { e.preventDefault(); quitGame(container); };
}

// --- 3. ANIMAZIONI VISIBILI ---
async function animateCardMove(startEl, targetEl, cardData, isBack = false) {
    return new Promise(resolve => {
        if (!startEl || !targetEl) return resolve();
        const startRect = startEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        
        const flyer = document.createElement('div');
        flyer.className = `card-b flying-card`;
        
        if (isBack) {
            flyer.style.background = 'linear-gradient(135deg, #5a189a, #240046)';
            flyer.style.border = '2px solid white';
        } else {
            const icon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[cardData.suit];
            flyer.innerHTML = `<span>${cardData.val}</span><span>${icon}</span>`;
            if(cardData.suit === 'hearts' || cardData.suit === 'diamonds') flyer.style.color = '#ff416c';
        }

        flyer.style.left = `${startRect.left}px`;
        flyer.style.top = `${startRect.top}px`;
        document.body.appendChild(flyer);

        requestAnimationFrame(() => {
            flyer.style.left = `${targetRect.left}px`;
            flyer.style.top = `${targetRect.top}px`;
            flyer.style.transform = `scale(0.8) rotate(${Math.random() * 20 - 10}deg)`;
        });

        setTimeout(() => { flyer.remove(); resolve(); }, 500);
    });
}

// --- 4. LOGICA DI GIOCO ---
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
    if (state.isAnimating) return;
    const isPlayer = state.turn === 'player';
    const selectedCards = state.selectedIndices.map(i => state.hands.player[i]);
    const targetPilaIndex = findTargetPila(selectedCards, state.tables.team1);
    const isNewCombo = validateCombo(selectedCards);
    const canMeld = (isNewCombo || (selectedCards.length > 0 && targetPilaIndex !== -1));

    if (isPlayer && state.phase === 'play') {
        if (isNewCombo) state.tutorMsg = "Combo valida! Cala sul tavolo.";
        else if (targetPilaIndex !== -1) state.tutorMsg = "Puoi attaccare queste carte.";
        else if (state.selectedIndices.length > 0) state.tutorMsg = "Seleziona altre carte...";
        else state.tutorMsg = "Scegli una carta da scartare o una combo.";
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
    if(deckEl) deckEl.onclick = (e) => { if(isPlayer && state.phase === 'draw') handlePlayerDraw(state); };
    if(btnDiscard) btnDiscard.onclick = (e) => { handlePlayerDiscard(state); };
    if(btnMeld) btnMeld.onclick = (e) => { handleMeld(state, targetPilaIndex); };
}

async function handlePlayerDraw(state) {
    state.isAnimating = true;
    const startEl = document.getElementById('main-deck');
    const targetEl = document.getElementById('player-hand');
    const card = state.deck.pop();
    await animateCardMove(startEl, targetEl, card, true);
    state.hands.player.push(card);
    state.phase = 'play';
    state.isAnimating = false;
    updateUI(state);
}

async function handlePlayerPickDiscard(state) {
    if (state.turn !== 'player' || state.phase !== 'draw') return;
    state.isAnimating = true;
    const startEl = document.getElementById('discard-pile-ui');
    const targetEl = document.getElementById('player-hand');
    await animateCardMove(startEl, targetEl, {}, true);
    state.hands.player.push(...state.discardPile);
    state.discardPile = [];
    state.phase = 'play';
    state.isAnimating = false;
    updateUI(state);
}

async function handlePlayerDiscard(state) {
    state.isAnimating = true;
    const idx = state.selectedIndices[0];
    const card = state.hands.player[idx];
    const startEl = document.querySelector(`[data-hand-idx="${idx}"]`);
    const targetEl = document.getElementById('discard-pile-ui');
    
    await animateCardMove(startEl, targetEl, card);
    
    state.hands.player.splice(idx, 1);
    state.discardPile.push(card);
    state.selectedIndices = [];
    state.turn = 'bot';
    state.phase = 'draw';
    state.tutorMsg = "Il Bot sta pensando...";
    state.isAnimating = false;
    updateUI(state);
    
    setTimeout(() => {
        if (state.hands.player.length === 0) {
            alert("🏆 VITTORIA! Hai chiuso la partita.");
            quitGame(state.container);
            return;
        }
        botAction(state);
    }, 1000);
}

// --- HELPER RENDERING ---
function renderHand(state) {
    const container = document.getElementById('player-hand');
    if(!container) return;
    container.innerHTML = '';
    state.hands.player.forEach((card, i) => {
        const el = createCardElement(card);
        el.setAttribute('data-hand-idx', i);
        if (state.selectedIndices.includes(i)) el.classList.add('selected');
        el.style.marginRight = state.hands.player.length > 10 ? "-25px" : "-15px"; 
        el.onclick = () => {
            if (state.turn !== 'player' || state.phase === 'draw' || state.isAnimating) return;
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
        el.innerHTML = `<span style="font-size:10px; opacity:0.5; position:absolute; top:5px; left:10px; font-weight:900;">${label}</span>`;
        data.forEach(group => {
            const gDiv = document.createElement('div');
            gDiv.style.display = "flex";
            gDiv.style.flexDirection = "column";
            gDiv.style.marginTop = "15px";
            group.forEach((card, i) => {
                const c = createCardElement(card);
                c.style.marginTop = i === 0 ? '0' : '-55px';
                c.style.transform = 'scale(0.9)';
                gDiv.appendChild(c);
            });
            el.appendChild(gDiv);
        });
    };
    drawTable('player-table', state.tables.team1, "IL TUO TAVOLO");
    drawTable('bot-table', state.tables.team2, "AVVERSARIO");
}

function renderDiscard(state) {
    const el = document.getElementById('discard-pile-ui');
    if(!el) return;
    el.innerHTML = '';
    state.discardPile.slice(-3).forEach((card, i) => {
        const c = createCardElement(card);
        c.style.position = "absolute";
        c.style.left = `${i * 12}px`;
        c.onclick = () => { if(state.turn === 'player' && state.phase === 'draw') handlePlayerPickDiscard(state); };
        el.appendChild(c);
    });
}

// --- BOT & LOGIC UTILS ---
function botAction(state) {
    if (state.turn !== 'bot') return;
    state.hands.bot1.push(state.deck.pop());
    setTimeout(() => {
        state.discardPile.push(state.hands.bot1.pop());
        state.turn = 'player';
        state.phase = 'draw';
        state.tutorMsg = "Tocca il mazzo per pescare.";
        updateUI(state);
    }, 1000);
}

function findTargetPila(selectedCards, table) {
    if (selectedCards.length === 0) return -1;
    for (let i = 0; i < table.length; i++) {
        let potentialGroup = [...table[i], ...selectedCards];
        if (validateCombo(potentialGroup)) return i;
    }
    return -1;
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

function validateCombo(cards) {
    if (cards.length < 3) return false;
    const firstVal = cards[0].val;
    return cards.every(c => c.val === firstVal);
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
    if(card.suit === 'hearts' || card.suit === 'diamonds') el.style.color = '#ff416c'; 
    return el;
}

function createBurracoDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'], values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    let deck = [];
    suits.forEach(s => values.forEach(v => deck.push({suit:s, val:v})));
    suits.forEach(s => values.forEach(v => deck.push({suit:s, val:v})));
    return deck;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }