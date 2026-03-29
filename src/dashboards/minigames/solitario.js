import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

export function initSolitario(container) {
    updateSidebarContext("minigames");

    let state = {
        deck: [],
        waste: [],
        foundations: [[], [], [], []], // Le 4 case finali (A -> K)
        tableau: [[], [], [], [], [], [], []], // Le 7 colonne
        draggedCards: null
    };

    renderLayout(container);
    startNewSolitario(state);
}

function startNewSolitario(state) {
    // Crea mazzo standard 52 carte
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let deck = [];
    suits.forEach(s => values.forEach((v, i) => deck.push({ suit: s, val: v, rank: i + 1, color: (s==='hearts' || s==='diamonds') ? 'red' : 'black', faceUp: false })));
    
    // Shuffle
    deck.sort(() => Math.random() - 0.5);

    // Distribuzione colonne (Tableau)
    for (let i = 0; i < 7; i++) {
        for (let j = 0; j <= i; j++) {
            let card = deck.pop();
            if (j === i) card.faceUp = true;
            state.tableau[i].push(card);
        }
    }
    state.deck = deck;
    renderGame(state);
}

function renderLayout(container) {
    container.innerHTML = `
    <style>
        .sol-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #134e13 0%, #051a05 100%); color:white; font-family:'Inter',sans-serif; position:relative; overflow:hidden; }
        .top-bar { display: flex; justify-content: space-between; padding: 20px 40px; width: 100%; max-width: 1000px; margin: 0 auto; }
        .pile-area { display: flex; gap: 15px; }
        .foundation-area { display: flex; gap: 15px; }
        
        .slot { width: 80px; height: 120px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.1); position: relative; background: rgba(0,0,0,0.1); }
        .card-s { 
            width: 80px; height: 120px; border-radius: 8px; position: absolute; 
            cursor: pointer; user-select: none; transition: transform 0.2s;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3); border: 1px solid #ccc;
            background: white; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center;
            transform-style: preserve-3d;
        }
        .card-s.back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 2px solid #9d4ede; color: transparent; }
        .card-s.red { color: #d63031; }
        .card-s.black { color: #2d3436; }
        
        .tableau { display: flex; justify-content: center; gap: 20px; margin-top: 40px; padding: 0 20px; }
        .col { width: 80px; min-height: 400px; position: relative; }

        @keyframes dealIn { from { transform: translateY(-500px) rotate(20deg); opacity: 0; } to { transform: translateY(0) rotate(0); opacity: 1; } }
        .anim-deal { animation: dealIn 0.5s ease-out backwards; }
    </style>
    <div class="sol-bg">
        <div class="top-bar">
            <div class="pile-area">
                <div id="deck-pile" class="slot" style="background:none;"></div>
                <div id="waste-pile" class="slot"></div>
            </div>
            <div class="foundation-area">
                <div class="slot" data-f="0"></div>
                <div class="slot" data-f="1"></div>
                <div class="slot" data-f="2"></div>
                <div class="slot" data-f="3"></div>
            </div>
        </div>
        <div class="tableau" id="tableau-ui"></div>
    </div>
    `;
}

function createCardUI(card, index = 0, isTableau = false) {
    const el = document.createElement('div');
    const suitIcons = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    el.className = `card-s ${card.faceUp ? card.color : 'back'} ${isTableau ? 'anim-deal' : ''}`;
    el.style.top = isTableau ? `${index * 25}px` : '0px';
    
    if (card.faceUp) {
        el.innerHTML = `
            <div style="position:absolute; top:5px; left:5px; font-weight:900; line-height:1;">${card.val}<br>${suitIcons[card.suit]}</div>
            <div style="font-size:30px;">${suitIcons[card.suit]}</div>
        `;
    }
    return el;
}

function renderGame(state) {
    const deckPile = document.getElementById('deck-pile');
    const wastePile = document.getElementById('waste-pile');
    const tableauUI = document.getElementById('tableau-ui');
    const foundationSlots = document.querySelectorAll('.foundation-area .slot');

    // Deck
    deckPile.innerHTML = state.deck.length > 0 ? `<div class="card-s back"></div>` : '';
    deckPile.onclick = () => drawCard(state);

    // Waste
    wastePile.innerHTML = '';
    if (state.waste.length > 0) wastePile.appendChild(createCardUI(state.waste[state.waste.length-1]));

    // Foundations
    foundationSlots.forEach((slot, i) => {
        slot.innerHTML = '';
        if (state.foundations[i].length > 0) {
            slot.appendChild(createCardUI(state.foundations[i][state.foundations[i].length-1]));
        }
    });

    // Tableau
    tableauUI.innerHTML = '';
    state.tableau.forEach((col, colIdx) => {
        const colEl = document.createElement('div');
        colEl.className = 'col';
        col.forEach((card, cardIdx) => {
            const cardEl = createCardUI(card, cardIdx, true);
            cardEl.style.animationDelay = `${(colIdx + cardIdx) * 0.05}s`;
            
            if (card.faceUp) {
                cardEl.onclick = () => tryAutoMove(card, colIdx, cardIdx, state);
            }
            colEl.appendChild(cardEl);
        });
        tableauUI.appendChild(colEl);
    });
}

function drawCard(state) {
    if (state.deck.length === 0) {
        state.deck = [...state.waste].reverse().map(c => ({...c, faceUp: false}));
        state.waste = [];
    } else {
        let card = state.deck.pop();
        card.faceUp = true;
        state.waste.push(card);
    }
    renderGame(state);
}

function tryAutoMove(card, colIdx, cardIdx, state) {
    // Logica semplificata: se è l'ultima della colonna, prova a metterla in foundation
    if (cardIdx !== state.tableau[colIdx].length - 1) return;

    for (let i = 0; i < 4; i++) {
        const targetPile = state.foundations[i];
        const topCard = targetPile[targetPile.length - 1];

        if ((!topCard && card.rank === 1) || (topCard && topCard.suit === card.suit && card.rank === topCard.rank + 1)) {
            state.foundations[i].push(state.tableau[colIdx].pop());
            if (state.tableau[colIdx].length > 0) state.tableau[colIdx][state.tableau[colIdx].length - 1].faceUp = true;
            renderGame(state);
            checkWin(state);
            return;
        }
    }
}

function checkWin(state) {
    const total = state.foundations.reduce((acc, f) => acc + f.length, 0);
    if (total === 52) {
        alert("COMPLIMENTI! HAI COMPLETATO IL SOLITARIO!");
        showLobby(document.querySelector('.sol-bg').parentElement);
    }
}