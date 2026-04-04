import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: SOLITARIO (Klondike)
// Versione Mobile-First ottimizzata
// ==========================================

export function initSolitario(container) {
    updateSidebarContext("minigames");

    // FIX: Rimossi position: fixed e width: 100%.
    // Manteniamo il blocco dell'overscroll per evitare rimbalzi durante il drag
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#090a0f';

    let state = {
        deck: [],
        waste: [],
        foundations: [[], [], [], []],
        tableau: [[], [], [], [], [], [], []],
        selected: null // { type, colIdx, cardIdx }
    };

    renderLayout(container, state);
    startNewSolitario(state, container);
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
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        window.location.hash = "lobby"; 
    }
};

function startNewSolitario(state, container) {
    const suits = [
        { id: 'hearts', icon: '♥', color: '#ff416c' },
        { id: 'diamonds', icon: '♦', color: '#ff416c' },
        { id: 'clubs', icon: '♣', color: '#00d2ff' },
        { id: 'spades', icon: '♠', color: '#00d2ff' }
    ];
    const values = [
        { val: 'A', rank: 1 }, { val: '2', rank: 2 }, { val: '3', rank: 3 },
        { val: '4', rank: 4 }, { val: '5', rank: 5 }, { val: '6', rank: 6 },
        { val: '7', rank: 7 }, { val: '8', rank: 8 }, { val: '9', rank: 9 },
        { val: '10', rank: 10 }, { val: 'J', rank: 11 }, { val: 'Q', rank: 12 }, { val: 'K', rank: 13 }
    ];

    let deck = [];
    suits.forEach(s => values.forEach(v => {
        deck.push({ 
            ...v, suit: s.id, icon: s.icon, color: s.color, faceUp: false,
            isRed: (s.id === 'hearts' || s.id === 'diamonds')
        });
    }));
    
    // Shuffle (Fisher-Yates)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Distribuzione Tableau
    for (let i = 0; i < 7; i++) {
        state.tableau[i] = [];
        for (let j = 0; j <= i; j++) {
            let card = deck.pop();
            if (j === i) card.faceUp = true;
            state.tableau[i].push(card);
        }
    }
    state.deck = deck;
    state.waste = [];
    state.foundations = [[], [], [], []];
    state.selected = null;
    
    renderGame(state, container);
}

// --- INTERFACCIA ---

function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .solitario-wrapper { 
            width: 100%; max-width: 430px; height: 100dvh; margin: 0 auto;
            background: radial-gradient(circle at top, rgba(27,39,53,0.8) 0%, rgba(9,10,15,0.9) 100%); 
            display: flex; flex-direction: column; padding: calc(15px + env(safe-area-inset-top)) 12px calc(15px + env(safe-area-inset-bottom)) 12px; 
            overflow: hidden; position: relative;
            animation: cardEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            box-sizing: border-box;
        }

        @media (min-width: 431px) {
            .solitario-wrapper { border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); height: 90vh; margin-top: 5vh; box-shadow: 0 0 50px rgba(0,0,0,0.5); }
        }
        
        .top-row { display: flex; justify-content: space-between; margin-bottom: 20px; flex-shrink: 0; }
        .slot { 
            width: 52px; height: 78px; border-radius: 8px; 
            border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
            position: relative; display: flex; align-items: center; justify-content: center;
        }
        
        .card-s { 
            width: 52px; height: 78px; border-radius: 8px; position: absolute; 
            box-shadow: 0 4px 8px rgba(0,0,0,0.5); border: 1px solid rgba(0,0,0,0.1);
            display: flex; flex-direction: column; padding: 4px;
            font-family: 'Montserrat', sans-serif; cursor: pointer; transition: transform 0.15s;
            user-select: none; -webkit-tap-highlight-color: transparent; outline: none; box-sizing: border-box;
        }
        .card-s.back { background: linear-gradient(135deg, #2a0a4a 0%, #6b21a8 100%); border: 1px solid #9d4ede; }
        .card-s.face-up { background: #fff; color: #000; }
        .card-s.selected { 
            transform: translateY(-8px) scale(1.05); 
            box-shadow: 0 0 15px #00ffa3; 
            z-index: 1000 !important; 
            border: 2px solid #00ffa3;
        }

        .tableau-area { display: flex; justify-content: space-between; flex: 1; align-items: flex-start; overflow-y: auto; padding-bottom: 20px; -webkit-overflow-scrolling: touch; }
        .tableau-area::-webkit-scrollbar { display: none; }
        .col { width: 52px; height: 100%; position: relative; min-height: 100px; }
        
        .card-val-ui { font-size: 14px; font-weight: 900; line-height: 1; margin-bottom: 2px; }
        .card-suit-small { font-size: 10px; line-height: 1; }
        .card-suit-main { position: absolute; bottom: 4px; right: 4px; font-size: 20px; opacity: 0.8; }

        .action-btns { display: flex; gap: 10px; margin-top: auto; padding-top: 10px; flex-shrink: 0; }
        .btn-action-sol { 
            flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            color: white; padding: 12px; border-radius: 12px; font-size: 11px; font-weight: 800;
            cursor: pointer; -webkit-tap-highlight-color: transparent; outline: none; transition: 0.2s;
        }
        .btn-action-sol:active { transform: scale(0.95); background: rgba(255,255,255,0.1); }
    </style>

    <div class="solitario-wrapper">
        <div class="top-row">
            <div style="display:flex; gap:8px;">
                <div id="deck-pile" class="slot"></div>
                <div id="waste-pile" class="slot"></div>
            </div>
            <div style="display:flex; gap:4px;">
                <div class="slot foundation" data-f="0"></div>
                <div class="slot foundation" data-f="1"></div>
                <div class="slot foundation" data-f="2"></div>
                <div class="slot foundation" data-f="3"></div>
            </div>
        </div>
        
        <div class="tableau-area" id="tableau-ui"></div>
        
        <div class="action-btns">
            <button class="btn-action-sol" id="btn-restart">↻ RIAVVIA</button>
            
            <button class="btn-action-sol" id="btn-quit">← ESCI DAL GIOCO</button>
        </div>
    </div>
    `;

    container.querySelector('#btn-quit').onclick = (e) => {
        e.preventDefault();
        quitGame(container);
    };
}

function renderCardHTML(card, index = 0, isTableau = false, isSelected = false) {
    const selClass = isSelected ? 'selected' : '';
    const style = isTableau ? `style="top: ${index * 18}px; z-index: ${index};"` : '';
    
    if (!card.faceUp) return `<div class="card-s back" ${style}></div>`;

    return `
        <div class="card-s face-up ${selClass}" ${style}>
            <div class="card-val-ui" style="color:${card.color}">${card.val}</div>
            <div class="card-suit-small" style="color:${card.color}">${card.icon}</div>
            <div class="card-suit-main" style="color:${card.color}">${card.icon}</div>
        </div>
    `;
}

function renderGame(state, container) {
    const deckPile = container.querySelector('#deck-pile');
    const wastePile = container.querySelector('#waste-pile');
    const tableauUI = container.querySelector('#tableau-ui');
    const foundations = container.querySelectorAll('.foundation');

    // Mazzo
    deckPile.innerHTML = state.deck.length > 0 ? `<div class="card-s back"></div>` : `<div style="color:white; opacity:0.3; font-size:24px;">↺</div>`;
    deckPile.onclick = (e) => { e.preventDefault(); drawCard(state); renderGame(state, container); };

    // Scarti
    wastePile.innerHTML = '';
    if (state.waste.length > 0) {
        const isSelected = state.selected?.type === 'waste';
        const cardUI = document.createElement('div');
        cardUI.innerHTML = renderCardHTML(state.waste[state.waste.length - 1], 0, false, isSelected);
        const cardEl = cardUI.firstElementChild;
        cardEl.onclick = (e) => {
            e.stopPropagation();
            state.selected = isSelected ? null : { type: 'waste' };
            renderGame(state, container);
        };
        wastePile.appendChild(cardEl);
    }

    // Fondazioni (A-K)
    foundations.forEach((slot, i) => {
        const stack = state.foundations[i];
        slot.innerHTML = stack.length > 0 ? renderCardHTML(stack[stack.length - 1]) : `<span style="opacity:0.1; font-size:20px; color:white; font-family:'Montserrat';">A</span>`;
        slot.onclick = (e) => { e.preventDefault(); handleFoundationClick(i, state, container); };
    });

    // Tableau
    tableauUI.innerHTML = '';
    state.tableau.forEach((col, colIdx) => {
        const colEl = document.createElement('div');
        colEl.className = 'col';
        colEl.onclick = (e) => { e.preventDefault(); handleTableauClick(colIdx, -1, state, container); };
        
        col.forEach((card, cardIdx) => {
            const isSelected = state.selected?.type === 'tableau' && 
                             state.selected.colIdx === colIdx && 
                             cardIdx >= state.selected.cardIdx;

            const cardWrapper = document.createElement('div');
            cardWrapper.innerHTML = renderCardHTML(card, cardIdx, true, isSelected);
            const cardEl = cardWrapper.firstElementChild;
            
            if (card.faceUp) {
                cardEl.onclick = (e) => {
                    e.stopPropagation();
                    handleTableauClick(colIdx, cardIdx, state, container);
                };
                // Doppio tap per mandare in fondazione
                cardEl.ondblclick = (e) => { e.preventDefault(); tryAutoFoundation(colIdx, state, container); };
            }
            colEl.appendChild(cardEl);
        });
        tableauUI.appendChild(colEl);
    });

    container.querySelector('#btn-restart').onclick = () => startNewSolitario(state, container);
}

// --- LOGICA ---

function drawCard(state) {
    state.selected = null;
    if (state.deck.length === 0) {
        state.deck = state.waste.reverse().map(c => ({...c, faceUp: false}));
        state.waste = [];
    } else {
        const card = state.deck.pop();
        card.faceUp = true;
        state.waste.push(card);
    }
}

function handleTableauClick(colIdx, cardIdx, state, container) {
    const col = state.tableau[colIdx];

    if (state.selected) {
        // Tenta di muovere
        const moveData = state.selected;
        const sourceStack = moveData.type === 'waste' ? state.waste : state.tableau[moveData.colIdx];
        const cardsToMove = sourceStack.slice(moveData.type === 'waste' ? sourceStack.length-1 : moveData.cardIdx);
        const movingCard = cardsToMove[0];
        const targetCard = col[col.length - 1];

        let canMove = false;
        if (!targetCard) {
            if (movingCard.rank === 13) canMove = true; // Re su spazio vuoto
        } else if (targetCard.faceUp) {
            // Regola: colore alternato e rango decrescente
            if (targetCard.isRed !== movingCard.isRed && targetCard.rank === movingCard.rank + 1) {
                canMove = true;
            }
        }

        if (canMove) {
            const slice = sourceStack.splice(moveData.type === 'waste' ? sourceStack.length-1 : moveData.cardIdx);
            state.tableau[colIdx].push(...slice);
            if (moveData.type === 'tableau') revealTop(moveData.colIdx, state);
            state.selected = null;
        } else {
            state.selected = null;
        }
    } else if (cardIdx !== -1 && col[cardIdx].faceUp) {
        state.selected = { type: 'tableau', colIdx, cardIdx };
    }
    renderGame(state, container);
}

function handleFoundationClick(fIdx, state, container) {
    if (state.selected) {
        const moveData = state.selected;
        const sourceStack = moveData.type === 'waste' ? state.waste : state.tableau[moveData.colIdx];
        
        // In fondazione si muove solo una carta alla volta (l'ultima dello stack)
        if (moveData.type === 'tableau' && moveData.cardIdx !== sourceStack.length - 1) {
            state.selected = null;
            renderGame(state, container);
            return;
        }

        const movingCard = sourceStack[sourceStack.length - 1];
        const targetStack = state.foundations[fIdx];
        const top = targetStack[targetStack.length - 1];

        let canMove = false;
        if (!top && movingCard.rank === 1) canMove = true; // Asso su vuoto
        else if (top && top.suit === movingCard.suit && movingCard.rank === top.rank + 1) canMove = true;

        if (canMove) {
            targetStack.push(sourceStack.pop());
            if (moveData.type === 'tableau') revealTop(moveData.colIdx, state);
            state.selected = null;
            
            // Check Win condition
            checkWinCondition(state, container);
            
        } else {
            state.selected = null;
        }
    }
    renderGame(state, container);
}

function revealTop(colIdx, state) {
    const col = state.tableau[colIdx];
    if (col && col.length > 0) col[col.length - 1].faceUp = true;
}

function tryAutoFoundation(colIdx, state, container) {
    const col = state.tableau[colIdx];
    const card = col[col.length - 1];
    if (!card) return;

    for (let i = 0; i < 4; i++) {
        const target = state.foundations[i];
        const top = target[target.length - 1];
        if ((!top && card.rank === 1) || (top && top.suit === card.suit && card.rank === top.rank + 1)) {
            target.push(col.pop());
            revealTop(colIdx, state);
            state.selected = null;
            renderGame(state, container);
            checkWinCondition(state, container);
            return;
        }
    }
}

// FIX: Aggiunto container ai parametri per poter usare quitGame in caso di vittoria
function checkWinCondition(state, container) {
    const isWin = state.foundations.every(f => f.length === 13);
    if (isWin) {
        setTimeout(() => {
            alert("COMPLIMENTI! HAI VINTO AL SOLITARIO! 🏆");
            quitGame(container); // Utilizza il nuovo sistema di uscita
        }, 500);
    }
}
