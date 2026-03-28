import { showLobby } from '../lobby.js';

// --- COSTANTI E CONFIGURAZIONE ---
const SUITS = ['bastoni', 'coppe', 'denari', 'spade'];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // 8=Fante, 9=Cavallo, 10=Re
const PRIMIERA_VALUES = { 7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 8: 10, 9: 10, 10: 10 };

export function initScopa(container) {
    // Nascondiamo il menu per focus totale durante il match
    const menuTrigger = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (menuTrigger) menuTrigger.style.display = 'none';

    let state = {
        deck: [],
        playerHand: [],
        botHand: [],
        table: [],
        playerCaptured: [],
        botCaptured: [],
        playerScopas: 0,
        botScopas: 0,
        lastCapturePlayer: true, 
        turn: 'player' 
    };

    renderLayout(container, state);
    startGame(state, container);
}

// --- LOGICA DI GIOCO ---

function startGame(state, container) {
    state.deck = createDeck();
    shuffle(state.deck);
    
    // Distribuzione iniziale: 3 a testa, 4 in tavola
    state.playerHand = state.deck.splice(0, 3);
    state.botHand = state.deck.splice(0, 3);
    state.table = state.deck.splice(0, 4);

    renderGame(state, container);
}

function createDeck() {
    let deck = [];
    for (let s of SUITS) {
        for (let v of VALUES) {
            deck.push({ suit: s, value: v });
        }
    }
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function findCaptures(card, table) {
    // 1. Regola Ufficiale: Se c'è una carta uguale, DEVI prendere quella
    const single = table.find(c => c.value === card.value);
    if (single) return [single];

    // 2. Altrimenti, cerca combinazioni che sommano al valore della carta giocata
    // Usiamo una ricerca semplice per combinazioni di due o tre carte
    for (let i = 0; i < table.length; i++) {
        for (let j = i + 1; j < table.length; j++) {
            if (table[i].value + table[j].value === card.value) {
                return [table[i], table[j]];
            }
        }
    }
    return null;
}

function handlePlayerPlay(cardIndex, state, container) {
    if (state.turn !== 'player') return;

    const playedCard = state.playerHand.splice(cardIndex, 1)[0];
    const toCapture = findCaptures(playedCard, state.table);

    if (toCapture) {
        state.playerCaptured.push(playedCard, ...toCapture);
        state.table = state.table.filter(c => !toCapture.includes(c));
        state.lastCapturePlayer = true;

        if (state.table.length === 0 && state.deck.length > 0) {
            state.playerScopas++;
            showToast("SCOPA! 🃏");
        }
    } else {
        state.table.push(playedCard);
    }

    state.turn = 'bot';
    renderGame(state, container);
    
    if (state.playerHand.length === 0 && state.botHand.length === 0 && state.deck.length === 0) {
        endMatch(state, container);
    } else {
        setTimeout(() => botTurn(state, container), 1000);
    }
}

function botTurn(state, container) {
    if (state.botHand.length === 0) {
        checkNewDeal(state, container);
        return;
    }

    // IA Semplice: il bot gioca la prima carta che può catturare qualcosa
    let cardIdx = state.botHand.findIndex(c => findCaptures(c, state.table));
    if (cardIdx === -1) cardIdx = 0; // Se non può prendere nulla, gioca la prima

    const playedCard = state.botHand.splice(cardIdx, 1)[0];
    const toCapture = findCaptures(playedCard, state.table);

    if (toCapture) {
        state.botCaptured.push(playedCard, ...toCapture);
        state.table = state.table.filter(c => !toCapture.includes(c));
        state.lastCapturePlayer = false;
        if (state.table.length === 0 && state.deck.length > 0) state.botScopas++;
    } else {
        state.table.push(playedCard);
    }

    state.turn = 'player';
    checkNewDeal(state, container);
    renderGame(state, container);
}

function checkNewDeal(state, container) {
    if (state.playerHand.length === 0 && state.botHand.length === 0) {
        if (state.deck.length > 0) {
            state.playerHand = state.deck.splice(0, 3);
            state.botHand = state.deck.splice(0, 3);
            renderGame(state, container);
        } else {
            endMatch(state, container);
        }
    }
}

function endMatch(state, container) {
    // Assegna le ultime carte rimaste a terra a chi ha preso l'ultima volta
    if (state.table.length > 0) {
        if (state.lastCapturePlayer) state.playerCaptured.push(...state.table);
        else state.botCaptured.push(...state.table);
        state.table = [];
    }
    calculateFinalScore(state, container);
}

// --- CALCOLO PUNTEGGI ---

function calculateFinalScore(state, container) {
    let pPoints = state.playerScopas;
    let bPoints = state.botScopas;

    const pCap = state.playerCaptured;
    const bCap = state.botCaptured;

    // Settebello
    const hasSette = (c) => c.some(card => card.suit === 'denari' && card.value === 7);
    if (hasSette(pCap)) pPoints++; else if (hasSette(bCap)) bPoints++;

    // Carte (Più di 20)
    if (pCap.length > 20) pPoints++; else if (bCap.length > 20) bPoints++;

    // Denari (Più di 5)
    const countD = (c) => c.filter(card => card.suit === 'denari').length;
    if (countD(pCap) > 5) pPoints++; else if (countD(bCap) > 5) bPoints++;

    // Primiera
    const getPrimiera = (cards) => {
        let total = 0;
        SUITS.forEach(s => {
            const suitCards = cards.filter(c => c.suit === s);
            if (suitCards.length > 0) total += Math.max(...suitCards.map(c => PRIMIERA_VALUES[c.value]));
        });
        return total;
    };
    const pPri = getPrimiera(pCap);
    const bPri = getPrimiera(bCap);
    if (pPri > bPri) pPoints++; else if (bPri > pPri) bPoints++;

    alert(`FINE PARTITA!\n\nGiocatore: ${pPoints} punti\nBot: ${bPoints} punti`);
    showLobby(container);
}

// --- RENDERING UI ---

function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .scopa-bg { width:100%; height:100dvh; background: #05020a; color:white; font-family:'Inter',sans-serif; position:relative; overflow:hidden; }
        .card-scopa { width: 75px; height: 115px; background: white; border-radius: 12px; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; box-shadow: 0 4px 15px rgba(0,0,0,0.5); cursor:pointer; transition: 0.2s; border: 2px solid transparent; }
        .card-scopa:hover { transform: translateY(-5px); border-color: var(--amethyst-bright); }
        .card-scopa.denari { color: #d4af37; } .card-scopa.spade { color: #2d3436; } .card-scopa.bastoni { color: #825a2c; } .card-scopa.coppe { color: #d63031; }
        .table-area { height: 260px; display: flex; align-items: center; justify-content: center; gap: 15px; border: 1px dashed rgba(157, 78, 221, 0.2); margin: 20px; border-radius: 20px; background: rgba(255,255,255,0.02); }
        .hand-area { position: absolute; bottom: 40px; width: 100%; display: flex; justify-content: center; gap: 15px; }
        .score-badge { position: absolute; top: 20px; right: 20px; background: rgba(157, 78, 221, 0.2); padding: 12px 20px; border-radius: 15px; font-size: 11px; letter-spacing: 1px; }
        .exit-btn { position: absolute; top: 20px; left: 20px; background: rgba(255,68,68,0.1); border: 1px solid rgba(255,68,68,0.3); color: white; padding: 10px 18px; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 10px; }
    </style>
    <div class="scopa-bg fade-in">
        <button class="exit-btn" id="exit-scopa">ESCI</button>
        <div class="score-badge">SCORE: <span id="p-scopa">${state.playerScopas}</span> - <span id="b-scopa">${state.botScopas}</span></div>
        <div id="bot-hand-ui" style="position:absolute; top:80px; width:100%; display:flex; justify-content:center; gap:10px; opacity:0.3;"></div>
        <div class="table-area" id="table-ui"></div>
        <div class="hand-area" id="player-hand-ui"></div>
        <div id="toast" style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); font-size:5rem; font-weight:900; color:var(--amethyst-bright); display:none; pointer-events:none; z-index:1000; text-shadow: 0 0 30px rgba(157, 78, 221, 0.8);"></div>
    </div>
    `;

    document.getElementById('exit-scopa').onclick = () => {
        const menu = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
        if (menu) menu.style.display = 'flex';
        showLobby(container);
    };
}

function renderGame(state, container) {
    const tableUI = document.getElementById('table-ui');
    const playerUI = document.getElementById('player-hand-ui');
    const botUI = document.getElementById('bot-hand-ui');

    tableUI.innerHTML = state.table.map(c => renderCard(c)).join('');
    playerUI.innerHTML = state.playerHand.map((c, i) => renderCard(c, i, true)).join('');
    botUI.innerHTML = state.botHand.map(() => `<div class="card-scopa" style="background:var(--amethyst-bright); border:1px solid white; opacity:0.5;"></div>`).join('');

    state.playerHand.forEach((_, i) => {
        const el = document.getElementById(`card-p-${i}`);
        if (el) el.onclick = () => handlePlayerPlay(i, state, container);
    });

    document.getElementById('p-scopa').innerText = state.playerScopas;
    document.getElementById('b-scopa').innerText = state.botScopas;
}

function renderCard(card, index = 0, isPlayer = false) {
    const icons = { bastoni: '🪵', coppe: '🏆', denari: '💰', spade: '⚔️' };
    const id = isPlayer ? `id="card-p-${index}"` : '';
    return `
        <div ${id} class="card-scopa ${card.suit}">
            <span style="font-size:1.4rem; margin-bottom:5px;">${card.value}</span>
            <span style="font-size:1.8rem">${icons[card.suit]}</span>
        </div>
    `;
}

function showToast(text) {
    const t = document.getElementById('toast');
    t.innerText = text;
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 1500);
}
