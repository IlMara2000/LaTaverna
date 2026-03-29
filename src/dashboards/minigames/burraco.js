import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

export function initBurraco(container) {
    updateSidebarContext("minigames");

    let state = {
        deck: [],
        playerHand: [],
        botHand: [],
        pozzetto1: [],
        pozzetto2: [],
        playerTable: [], 
        botTable: [],
        discardPile: [],
        turn: 'player',
        phase: 'draw', 
        hasTakenPozzetto: false
    };

    renderLayout(container);
    startBurraco(state);
}

function startBurraco(state) {
    state.deck = createBurracoDeck();
    shuffle(state.deck);

    state.playerHand = state.deck.splice(0, 11);
    state.botHand = state.deck.splice(0, 11);
    state.pozzetto1 = state.deck.splice(0, 11);
    state.pozzetto2 = state.deck.splice(0, 11);
    state.discardPile.push(state.deck.pop());

    // Inizializza l'interfaccia con i dati generati
    updateUI(state);
}

function renderLayout(container) {
    container.innerHTML = `
    <style>
        .burraco-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #0a2a1a 0%, #020a05 100%); color:white; font-family:'Inter',sans-serif; position:relative; overflow:hidden; display: flex; flex-direction: column; }
        
        .tables-container { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 20px; margin-top: 40px; }
        .mats { flex: 1; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; padding: 10px; position: relative; overflow-x: auto; display: flex; align-items: center; gap: 10px; }
        .label-team { position: absolute; top: 5px; left: 10px; font-size: 9px; opacity: 0.4; letter-spacing: 1.5px; text-transform: uppercase; pointer-events: none; }

        .center-area { display: flex; justify-content: center; align-items: center; gap: 20px; padding: 10px; }
        .deck-stack { width: 55px; height: 80px; background: linear-gradient(135deg, #1e3799, #0c2461); border: 2px solid white; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900; box-shadow: 4px 4px 0px rgba(0,0,0,0.4); cursor: pointer; }
        .discard-stack { width: 55px; height: 80px; position: relative; }

        .card-b { width: 48px; height: 70px; background: white; border-radius: 6px; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; position: relative; box-shadow: 0 3px 6px rgba(0,0,0,0.3); transition: 0.2s; cursor: pointer; border: 1px solid #ddd; }
        .card-b.hearts, .card-b.diamonds { color: #d63031; }
        .card-b.clubs, .card-b.spades { color: #2d3436; }
        .card-b.jolly { background: #9d4ede; color: white; border-color: #7b2cbf; }

        .player-hand-container { 
            padding-bottom: 95px; /* Alzate per visibilità sopra Navbar */
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            gap: 15px;
        }
        .hand-card-wrapper { display: flex; justify-content: center; }
        
        .btn-calate { 
            background: #2ecc71; 
            color: white; 
            padding: 10px 25px; 
            border-radius: 50px; 
            border: none; 
            font-weight: 900; 
            cursor: pointer; 
            box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3);
            font-size: 13px;
        }
        
        #game-info { position: absolute; top: 15px; width: 100%; text-align: center; pointer-events: none; }
    </style>

    <div class="burraco-bg">
        <div id="game-info">
            <div id="turn-display" style="color:#2ecc71; font-weight:900;">TUO TURNO</div>
            <div id="phase-display" style="font-size:11px; opacity:0.8;">Pesca una carta</div>
        </div>

        <div class="tables-container">
            <div class="mats" id="bot-table"><span class="label-team">AVVERSARIO</span></div>
            <div class="mats" id="player-table"><span class="label-team">IL TUO TAVOLO</span></div>
        </div>

        <div class="center-area">
            <div id="main-deck" class="deck-stack">MAZZO</div>
            <div id="discard-stack-ui" class="discard-stack"></div>
        </div>

        <div class="player-hand-container">
            <button class="btn-calate" id="btn-play-meld">CALA COMBINAZIONE</button>
            <div id="player-hand" class="hand-card-wrapper"></div>
        </div>
    </div>
    `;
}

function updateUI(state) {
    const handUI = document.getElementById('player-hand');
    const discardUI = document.getElementById('discard-stack-ui');
    const phaseLabel = document.getElementById('phase-display');

    if(!handUI || !discardUI) return;

    handUI.innerHTML = '';
    state.playerHand.forEach((card, i) => {
        const cEl = createCardElement(card);
        cEl.style.marginLeft = i === 0 ? '0' : '-15px';
        cEl.style.zIndex = i;
        cEl.onclick = () => {
            if (state.phase === 'play' || state.phase === 'discard') handleCardAction(card, i, state);
        };
        handUI.appendChild(cEl);
    });

    discardUI.innerHTML = '';
    if (state.discardPile.length > 0) {
        const topDiscard = state.discardPile[state.discardPile.length - 1];
        const dEl = createCardElement(topDiscard);
        dEl.onclick = () => { if(state.phase === 'draw') pickDiscard(state); };
        discardUI.appendChild(dEl);
    }

    phaseLabel.innerText = state.phase === 'draw' ? 'Pesca dal mazzo o dagli scarti' : 
                          state.phase === 'play' ? 'Cala o scarta per finire' : 'Seleziona scarto';

    document.getElementById('main-deck').onclick = () => { if(state.phase === 'draw') drawFromDeck(state); };
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card-b ${card.suit} ${card.isJolly ? 'jolly' : ''}`;
    const suitIcon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '★' }[card.suit];
    el.innerHTML = `<span>${card.val}</span><span style="font-size:18px">${suitIcon}</span>`;
    return el;
}

function drawFromDeck(state) {
    if(state.deck.length === 0) return;
    state.playerHand.push(state.deck.pop());
    state.phase = 'play';
    updateUI(state);
}

function pickDiscard(state) {
    if(state.discardPile.length === 0) return;
    state.playerHand.push(...state.discardPile);
    state.discardPile = [];
    state.phase = 'play';
    updateUI(state);
}

function handleCardAction(card, index, state) {
    state.discardPile.push(state.playerHand.splice(index, 1)[0]);
    state.phase = 'draw';
    state.turn = 'bot';
    updateUI(state);
    setTimeout(() => botTurn(state), 1200);
}

function botTurn(state) {
    if(state.deck.length > 0) state.botHand.push(state.deck.pop());
    state.discardPile.push(state.botHand.pop());
    state.turn = 'player';
    state.phase = 'draw';
    updateUI(state);
}

function createBurracoDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let deck = [];
    for (let i = 0; i < 2; i++) {
        suits.forEach(s => values.forEach(v => deck.push({ suit: s, val: v, isJolly: false })));
        deck.push({ suit: 'joker', val: 'JK', isJolly: true });
        deck.push({ suit: 'joker', val: 'JK', isJolly: true });
    }
    return deck;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
