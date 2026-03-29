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
        playerTable: [], // Array di array (sequenze/combinazioni)
        botTable: [],
        discardPile: [],
        turn: 'player',
        phase: 'draw', // 'draw', 'play', 'discard'
        hasTakenPozzetto: false
    };

    renderLayout(container);
    startBurraco(state);
}

function startBurraco(state) {
    // 2 Mazzi di carte francesi incluse le matte (108 carte)
    state.deck = createBurracoDeck();
    shuffle(state.deck);

    // Distribuzione
    state.playerHand = state.deck.splice(0, 11);
    state.botHand = state.deck.splice(0, 11);
    state.pozzetto1 = state.deck.splice(0, 11);
    state.pozzetto2 = state.deck.splice(0, 11);
    state.discardPile.push(state.deck.pop());

    updateUI(state);
}

function createBurracoDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let deck = [];
    // Due mazzi
    for (let i = 0; i < 2; i++) {
        suits.forEach(s => values.forEach(v => deck.push({ suit: s, val: v, isJolly: false })));
        deck.push({ suit: 'joker', val: 'JK', isJolly: true });
        deck.push({ suit: 'joker', val: 'JK', isJolly: true });
    }
    return deck;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

function renderLayout(container) {
    container.innerHTML = `
    <style>
        .burraco-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #0a2a1a 0%, #020a05 100%); color:white; font-family:'Inter',sans-serif; position:relative; overflow:hidden; }
        
        .table-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 20px; height: 50%; margin-top: 60px; }
        .mats { background: rgba(255,255,255,0.03); border: 2px dashed rgba(255,255,255,0.1); border-radius: 20px; padding: 15px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 10px; align-content: flex-start; }
        
        .card-b { width: 50px; height: 75px; background: white; border-radius: 6px; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; position: relative; box-shadow: 0 4px 8px rgba(0,0,0,0.3); transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor: pointer; border: 1px solid #ddd; }
        .card-b:hover { transform: translateY(-10px) rotate(2deg); z-index: 10; }
        .card-b.hearts, .card-b.diamonds { color: #d63031; }
        .card-b.clubs, .card-b.spades { color: #2d3436; }
        .card-b.jolly { background: #9d4ede; color: white; }

        .center-area { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; gap: 30px; }
        .deck-stack { width: 60px; height: 90px; background: linear-gradient(135deg, #1e3799, #0c2461); border: 2px solid white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900; box-shadow: 5px 5px 0px rgba(0,0,0,0.5); cursor: pointer; }
        
        .player-hand-container { position: absolute; bottom: 20px; width: 100%; display: flex; justify-content: center; padding: 0 50px; }
        .hand-card-wrapper { display: flex; transition: 0.5s; }
        
        .btn-game { padding: 10px 20px; border-radius: 50px; border: none; font-weight: 900; cursor: pointer; transition: 0.2s; }
        .btn-calate { background: #2ecc71; color: white; position: absolute; bottom: 120px; right: 20px; }
        
        .label-team { font-size: 10px; opacity: 0.5; letter-spacing: 2px; margin-bottom: 10px; width: 100%; }
        
        @keyframes deal { from { transform: translateY(-500px) rotate(20deg); opacity: 0; } to { transform: translateY(0) rotate(0); opacity: 1; } }
        .deal-anim { animation: deal 0.6s backwards; }
    </style>

    <div class="burraco-bg">
        <div class="table-grid">
            <div class="mats" id="bot-table"><span class="label-team">AVVERSARIO</span></div>
            <div class="mats" id="player-table"><span class="label-team">IL TUO TAVOLO</span></div>
        </div>

        <div class="center-area">
            <div id="main-deck" class="deck-stack">MAZZO</div>
            <div id="discard-stack" style="display:flex; gap: -30px;">
                </div>
        </div>

        <button class="btn-game btn-calate" id="btn-play-meld">CALA COMBINAZIONE</button>

        <div class="player-hand-container">
            <div id="player-hand" class="hand-card-wrapper"></div>
        </div>
        
        <div id="game-info" style="position:absolute; top:20px; right:20px; text-align:right;">
            <div id="turn-display" style="color:#2ecc71; font-weight:900;">TUO TURNO</div>
            <div id="phase-display" style="font-size:12px; opacity:0.7;">Pescate una carta</div>
        </div>
    </div>
    `;
}

function updateUI(state) {
    const handUI = document.getElementById('player-hand');
    const playerTableUI = document.getElementById('player-table');
    const discardUI = document.getElementById('discard-stack');
    const phaseLabel = document.getElementById('phase-display');

    // Rendering Mano (Ventaglio)
    handUI.innerHTML = '';
    state.playerHand.sort((a,b) => a.val.localeCompare(b.val)).forEach((card, i) => {
        const cEl = createCardElement(card);
        cEl.style.marginLeft = i === 0 ? '0' : '-20px';
        cEl.classList.add('deal-anim');
        cEl.style.animationDelay = `${i * 0.05}s`;
        
        cEl.onclick = () => {
            if (state.phase === 'play' || state.phase === 'discard') {
                handleCardAction(card, i, state);
            }
        };
        handUI.appendChild(cEl);
    });

    // Rendering Scarti (solo l'ultima)
    discardUI.innerHTML = '';
    if (state.discardPile.length > 0) {
        const topDiscard = state.discardPile[state.discardPile.length - 1];
        const dEl = createCardElement(topDiscard);
        dEl.onclick = () => { if(state.phase === 'draw') pickDiscard(state); };
        discardUI.appendChild(dEl);
    }

    // Info fase
    phaseLabel.innerText = state.phase === 'draw' ? 'Pesca dal mazzo o dagli scarti' : 
                          state.phase === 'play' ? 'Cala combinazioni o scarta per finire' : 'Seleziona carta da scartare';

    // Gestione Deck
    document.getElementById('main-deck').onclick = () => { if(state.phase === 'draw') drawFromDeck(state); };
}

function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card-b ${card.suit} ${card.isJolly ? 'jolly' : ''}`;
    const suitIcon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', joker: '★' }[card.suit];
    el.innerHTML = `<span>${card.val}</span><span style="font-size:20px">${suitIcon}</span>`;
    return el;
}

function drawFromDeck(state) {
    state.playerHand.push(state.deck.pop());
    state.phase = 'play';
    updateUI(state);
}

function pickDiscard(state) {
    state.playerHand.push(...state.discardPile);
    state.discardPile = [];
    state.phase = 'play';
    updateUI(state);
}

function handleCardAction(card, index, state) {
    // Per ora, cliccare una carta nella fase 'play' la scarta per chiudere il turno
    // In una versione completa qui gestiremo la selezione multipla per le calate
    state.discardPile.push(state.playerHand.splice(index, 1)[0]);
    state.phase = 'draw';
    state.turn = 'bot';
    updateUI(state);
    setTimeout(() => botTurn(state), 1500);
}

function botTurn(state) {
    // IA Semplice: Pesca e scarta
    state.botHand.push(state.deck.pop());
    state.discardPile.push(state.botHand.pop());
    state.turn = 'player';
    state.phase = 'draw';
    updateUI(state);
}