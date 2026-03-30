import { updateSidebarContext } from '../../components/layout/Sidebar.js';

export function initSolitario(container) {
    updateSidebarContext("minigames");

    let state = {
        deck: [],
        waste: [],
        foundations: [[], [], [], []], // Case A -> K
        tableau: [[], [], [], [], [], [], []], // Le 7 colonne
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
        { val: '7', rank: 7 }, { val: '8', rank: 8 }, { name: '9', rank: 9 },
        { val: '10', rank: 10 }, { val: 'J', rank: 11 }, { val: 'Q', rank: 12 }, { val: 'K', rank: 13 }
    ];

    let deck = [];
    suits.forEach(s => values.forEach(v => {
        deck.push({ 
            ...v, 
            suit: s.id, 
            icon: s.icon, 
            color: s.color, 
            faceUp: false,
            isRed: (s.id === 'hearts' || s.id === 'diamonds')
        });
    }));
    
    // Shuffle
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
    
    renderGame(state, container);
}

function renderLayout(container) {
    container.innerHTML = `
    <style>
        .sol-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%); color:white; font-family:'Poppins',sans-serif; position:relative; overflow:hidden; }
        .top-bar { display: flex; justify-content: space-between; padding: 25px; width: 100%; max-width: 900px; margin: 0 auto; }
        .slot { width: 85px; height: 125px; border-radius: 12px; border: 2px dashed rgba(255,255,255,0.05); position: relative; background: rgba(255,255,255,0.02); }
        
        .card-s { 
            width: 85px; height: 125px; border-radius: 12px; position: absolute; 
            cursor: pointer; user-select: none; transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);
            background: rgba(30, 30, 40, 0.95); backdrop-filter: blur(5px);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .card-s.back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1.5px solid #9d4ede; }
        .card-s.face-up { background: rgba(255,255,255,0.08); }
        .card-s:hover { border-color: #9d4ede; transform: translateY(-2px); }

        .tableau { display: flex; justify-content: center; gap: 15px; margin-top: 20px; }
        .col { width: 85px; min-height: 500px; position: relative; }
        
        .btn-exit { position: absolute; top: 20px; left: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 8px 15px; border-radius: 10px; cursor: pointer; font-size: 12px; }
    </style>
    <div class="sol-bg">
        <button class="btn-exit" id="sol-back">← ESCI</button>
        <div class="top-bar">
            <div style="display:flex; gap:15px;">
                <div id="deck-pile" class="slot" style="border:none; cursor:pointer;"></div>
                <div id="waste-pile" class="slot"></div>
            </div>
            <div style="display:flex; gap:10px;">
                <div class="slot foundation" data-f="0"></div>
                <div class="slot foundation" data-f="1"></div>
                <div class="slot foundation" data-f="2"></div>
                <div class="slot foundation" data-f="3"></div>
            </div>
        </div>
        <div class="tableau" id="tableau-ui"></div>
    </div>
    `;
    container.querySelector('#sol-back').onclick = () => window.location.hash = "lobby";
}

function renderCard(card, index = 0, isTableau = false) {
    const el = document.createElement('div');
    el.className = `card-s ${card.faceUp ? 'face-up' : 'back'}`;
    if (isTableau) el.style.top = `${index * 28}px`;

    if (card.faceUp) {
        el.style.color = card.color;
        el.innerHTML = `
            <div style="position:absolute; top:8px; left:8px; font-weight:900; line-height:0.9; font-size:14px;">${card.val}<br><span style="font-size:10px">${card.icon}</span></div>
            <div style="font-size:2.5rem; opacity:0.8;">${card.icon}</div>
        `;
        el.draggable = true;
    }
    return el;
}

function renderGame(state, container) {
    const deckPile = container.querySelector('#deck-pile');
    const wastePile = container.querySelector('#waste-pile');
    const tableauUI = container.querySelector('#tableau-ui');
    const foundations = container.querySelectorAll('.foundation');

    // Mazzo e Scarti
    deckPile.innerHTML = state.deck.length > 0 ? `<div class="card-s back"></div>` : `<div class="card-s back" style="opacity:0.2; border-style:dashed;">↺</div>`;
    deckPile.onclick = () => drawCard(state, container);

    wastePile.innerHTML = '';
    if (state.waste.length > 0) {
        wastePile.appendChild(renderCard(state.waste[state.waste.length - 1]));
    }

    // Case Finali
    foundations.forEach((slot, i) => {
        slot.innerHTML = '';
        if (state.foundations[i].length > 0) {
            slot.appendChild(renderCard(state.foundations[i][state.foundations[i].length - 1]));
        }
        setupDropZone(slot, 'foundation', i, state, container);
    });

    // Colonne Tableau
    tableauUI.innerHTML = '';
    state.tableau.forEach((col, colIdx) => {
        const colEl = document.createElement('div');
        colEl.className = 'col';
        colEl.dataset.col = colIdx;
        
        if (col.length === 0) setupDropZone(colEl, 'tableau', colIdx, state, container);

        col.forEach((card, cardIdx) => {
            const cardEl = renderCard(card, cardIdx, true);
            if (card.faceUp) {
                cardEl.ondblclick = () => tryQuickMove(colIdx, card, state, container);
                setupDrag(cardEl, colIdx, cardIdx, state);
                // Solo l'ultima carta o una sequenza può ricevere drop
                setupDropZone(cardEl, 'tableau', colIdx, state, container, cardIdx);
            }
            colEl.appendChild(cardEl);
        });
        tableauUI.appendChild(colEl);
    });
}

// --- LOGICA GIOCO ---

function drawCard(state, container) {
    if (state.deck.length === 0) {
        state.deck = [...state.waste].reverse().map(c => ({...c, faceUp: false}));
        state.waste = [];
    } else {
        let card = state.deck.pop();
        card.faceUp = true;
        state.waste.push(card);
    }
    renderGame(state, container);
}

function tryQuickMove(fromCol, card, state, container) {
    // Prova a spostare in Foundation con doppio click
    for (let i = 0; i < 4; i++) {
        const target = state.foundations[i];
        const last = target[target.length - 1];
        if ((!last && card.rank === 1) || (last && last.suit === card.suit && card.rank === last.rank + 1)) {
            state.foundations[i].push(state.tableau[fromCol].pop());
            finalizeMove(fromCol, state, container);
            return;
        }
    }
}

function finalizeMove(fromCol, state, container) {
    if (fromCol !== null && state.tableau[fromCol].length > 0) {
        state.tableau[fromCol][state.tableau[fromCol].length - 1].faceUp = true;
    }
    renderGame(state, container);
    checkWin(state, container);
}

// --- DRAG & DROP ---

function setupDrag(el, colIdx, cardIdx, state) {
    el.addEventListener('dragstart', (e) => {
        const dragData = { colIdx, cardIdx };
        e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    });
}

function setupDropZone(el, type, targetIdx, state, container, cardIdxOnCol = null) {
    el.addEventListener('dragover', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        const movingCards = state.tableau[data.colIdx].slice(data.cardIdx);
        const cardToMove = movingCards[0];

        if (type === 'foundation') {
            if (movingCards.length > 1) return;
            const target = state.foundations[targetIdx];
            const last = target[target.length - 1];
            if ((!last && cardToMove.rank === 1) || (last && last.suit === cardToMove.suit && cardToMove.rank === last.rank + 1)) {
                state.foundations[targetIdx].push(state.tableau[data.colIdx].pop());
                finalizeMove(data.colIdx, state, container);
            }
        } else if (type === 'tableau') {
            const targetCol = state.tableau[targetIdx];
            const last = targetCol[targetCol.length - 1];
            
            let canMove = false;
            if (!last && cardToMove.rank === 13) canMove = true; // K su colonna vuota
            if (last && last.isRed !== cardToMove.isRed && last.rank === cardToMove.rank + 1) canMove = true;

            if (canMove) {
                const slice = state.tableau[data.colIdx].splice(data.cardIdx);
                state.tableau[targetIdx].push(...slice);
                finalizeMove(data.colIdx, state, container);
            }
        }
    });
}

function checkWin(state, container) {
    const total = state.foundations.reduce((acc, f) => acc + f.length, 0);
    if (total === 52) {
        alert("SOLITARIO COMPLETATO! 🏆");
        window.location.hash = "lobby";
    }
}