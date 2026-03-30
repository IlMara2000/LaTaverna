import { updateSidebarContext } from '../../components/layout/Sidebar.js';

export function initSolitario(container) {
    updateSidebarContext("minigames");

    // Blocco Scroll per mobile
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    let state = {
        deck: [],
        waste: [],
        foundations: [[], [], [], []],
        tableau: [[], [], [], [], [], [], []],
        selected: null
    };

    renderLayout(container);
    startNewSolitario(state, container);
}

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
    
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Distribuzione
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
    
    renderGame(state, container);
}

function renderLayout(container) {
    container.innerHTML = `
    <style>
        .mobile-emulator { width: 100%; height: 100dvh; background: #05010a; display: flex; justify-content: center; align-items: center; }
        .sol-wrapper { 
            width: 100%; max-width: 430px; height: 100%; max-height: 932px;
            background: radial-gradient(circle at top, #1b2735 0%, #090a0f 100%); 
            display: flex; flex-direction: column; padding: 10px; overflow: hidden; position: relative;
        }
        .top-row { display: flex; justify-content: space-between; margin-bottom: 15px; padding: 5px; }
        .slot { 
            width: 48px; height: 72px; border-radius: 6px; 
            border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);
            position: relative; display: flex; align-items: center; justify-content: center;
        }
        
        .card-s { 
            width: 48px; height: 72px; border-radius: 6px; position: absolute; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.4); border: 0.5px solid rgba(255,255,255,0.15);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: sans-serif; cursor: pointer; transition: transform 0.1s;
        }
        .card-s.back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1px solid #9d4ede; }
        .card-s.face-up { background: #fff; color: #000; }
        .card-s.selected { outline: 3px solid #00ffa3; z-index: 100 !important; }

        .tableau-area { display: flex; justify-content: space-between; flex: 1; padding: 0 2px; }
        .col { width: 48px; position: relative; }
        
        .card-value { position: absolute; top: 2px; left: 3px; font-size: 11px; font-weight: 900; line-height: 1; }
        .card-suit-small { position: absolute; top: 12px; left: 3px; font-size: 8px; }
        .card-suit-main { font-size: 24px; }
    </style>
    <div class="mobile-emulator">
        <div class="sol-wrapper">
            <div class="top-row">
                <div style="display:flex; gap:6px;">
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
        </div>
    </div>
    `;
}

function renderCardHTML(card, index = 0, isTableau = false) {
    const isSelected = card.selected ? 'selected' : '';
    const style = isTableau ? `style="top: ${index * 16}px; z-index: ${index};"` : '';
    
    if (!card.faceUp) return `<div class="card-s back" ${style}></div>`;

    return `
        <div class="card-s face-up ${isSelected}" ${style} data-suit="${card.suit}" data-rank="${card.rank}">
            <div class="card-value">${card.val}</div>
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
    deckPile.innerHTML = state.deck.length > 0 ? `<div class="card-s back"></div>` : `<div style="color:white; opacity:0.3; font-size:20px;">↺</div>`;
    deckPile.onclick = () => { drawCard(state); renderGame(state, container); };

    // Scarti
    wastePile.innerHTML = state.waste.length > 0 ? renderCardHTML(state.waste[state.waste.length - 1]) : '';
    if (state.waste.length > 0) {
        wastePile.querySelector('.card-s').onclick = (e) => {
            e.stopPropagation();
            handleCardSelection({type: 'waste'}, state, container);
        };
    }

    // Foundation
    foundations.forEach((slot, i) => {
        const stack = state.foundations[i];
        slot.innerHTML = stack.length > 0 ? renderCardHTML(stack[stack.length - 1]) : '';
        slot.onclick = () => handleFoundationClick(i, state, container);
    });

    // Tableau
    tableauUI.innerHTML = '';
    state.tableau.forEach((col, colIdx) => {
        const colEl = document.createElement('div');
        colEl.className = 'col';
        colEl.onclick = () => handleTableauClick(colIdx, -1, state, container); // Click su colonna vuota
        
        col.forEach((card, cardIdx) => {
            const cardEl = document.createElement('div');
            cardEl.innerHTML = renderCardHTML(card, cardIdx, true);
            const inner = cardEl.firstElementChild;
            
            if (card.faceUp) {
                inner.onclick = (e) => {
                    e.stopPropagation();
                    handleTableauClick(colIdx, cardIdx, state, container);
                };
                inner.ondblclick = () => tryAutoFoundation(colIdx, state, container);
            }
            colEl.appendChild(inner);
        });
        tableauUI.appendChild(colEl);
    });
}

// --- LOGICA AZIONI ---

function drawCard(state) {
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
    
    // Se abbiamo una selezione, proviamo a muovere
    if (state.selected) {
        const moveData = state.selected;
        const sourceStack = getSourceStack(moveData, state);
        const cardsToMove = sourceStack.slice(moveData.cardIdx);
        const movingCard = cardsToMove[0];
        const targetCard = col[col.length - 1];

        let canMove = false;
        if (!targetCard && movingCard.rank === 13) canMove = true; // Re su vuoto
        if (targetCard && targetCard.isRed !== movingCard.isRed && targetCard.rank === movingCard.rank + 1) canMove = true;

        if (canMove) {
            const slice = sourceStack.splice(moveData.cardIdx);
            state.tableau[colIdx].push(...slice);
            cleanUpAfterMove(moveData.colIdx, state);
            state.selected = null;
        } else {
            state.selected = null; // Deseleziona se mossa invalida
        }
    } else if (cardIdx !== -1 && col[cardIdx].faceUp) {
        // Seleziona
        state.selected = { type: 'tableau', colIdx, cardIdx };
    }
    renderGame(state, container);
}

function handleFoundationClick(fIdx, state, container) {
    if (state.selected) {
        const moveData = state.selected;
        const sourceStack = getSourceStack(moveData, state);
        if (sourceStack.length - 1 !== moveData.cardIdx) return; // Muovi solo l'ultima

        const movingCard = sourceStack[moveData.cardIdx];
        const targetStack = state.foundations[fIdx];
        const top = targetStack[targetStack.length - 1];

        if ((!top && movingCard.rank === 1) || (top && top.suit === movingCard.suit && movingCard.rank === top.rank + 1)) {
            targetStack.push(sourceStack.pop());
            cleanUpAfterMove(moveData.colIdx, state);
            state.selected = null;
        }
    }
    renderGame(state, container);
}

function getSourceStack(moveData, state) {
    if (moveData.type === 'waste') return state.waste;
    return state.tableau[moveData.colIdx];
}

function handleCardSelection(data, state, container) {
    state.selected = { type: data.type, colIdx: null, cardIdx: state.waste.length - 1 };
    renderGame(state, container);
}

function cleanUpAfterMove(sourceColIdx, state) {
    if (sourceColIdx !== null) {
        const col = state.tableau[sourceColIdx];
        if (col && col.length > 0) col[col.length - 1].faceUp = true;
    }
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
            cleanUpAfterMove(colIdx, state);
            renderGame(state, container);
            return;
        }
    }
}
