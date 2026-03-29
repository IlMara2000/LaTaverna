import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

const SUITS = ['bastoni', 'coppe', 'denari', 'spade'];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; 
const PRIMIERA_VALUES = { 7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 8: 10, 9: 10, 10: 10 };

export function initScopa(container) {
    updateSidebarContext("minigames");

    let state = {
        deck: [], playerHand: [], botHand: [], table: [],
        playerCaptured: [], botCaptured: [], playerScopas: 0, botScopas: 0,
        lastCapturePlayer: true, turn: 'player' 
    };

    renderLayout(container, state);
    startGame(state, container);
}

// ... (IA e Logica Scopa identica a prima)
function startGame(state, container) {
    state.deck = createDeck(); shuffle(state.deck);
    state.playerHand = state.deck.splice(0, 3);
    state.botHand = state.deck.splice(0, 3);
    state.table = state.deck.splice(0, 4);
    renderGame(state, container);
}

function createDeck() {
    let deck = [];
    for (let s of SUITS) { for (let v of VALUES) { deck.push({ suit: s, value: v }); } }
    return deck;
}

function shuffle(deck) { for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } }

function findCaptures(card, table) {
    const single = table.find(c => c.value === card.value);
    if (single) return [single];
    for (let i = 0; i < table.length; i++) {
        for (let j = i + 1; j < table.length; j++) {
            if (table[i].value + table[j].value === card.value) return [table[i], table[j]];
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
        if (state.table.length === 0 && state.deck.length > 0) { state.playerScopas++; showToast("SCOPA! 🃏"); }
    } else { state.table.push(playedCard); }
    state.turn = 'bot'; renderGame(state, container);
    if (state.playerHand.length === 0 && state.botHand.length === 0 && state.deck.length === 0) { endMatch(state, container); } 
    else { setTimeout(() => botTurn(state, container), 1000); }
}

function botTurn(state, container) {
    if (state.botHand.length === 0) { checkNewDeal(state, container); return; }
    let cardIdx = state.botHand.findIndex(c => findCaptures(c, state.table));
    if (cardIdx === -1) cardIdx = 0;
    const playedCard = state.botHand.splice(cardIdx, 1)[0];
    const toCapture = findCaptures(playedCard, state.table);
    if (toCapture) {
        state.botCaptured.push(playedCard, ...toCapture);
        state.table = state.table.filter(c => !toCapture.includes(c));
        state.lastCapturePlayer = false;
        if (state.table.length === 0 && state.deck.length > 0) state.botScopas++;
    } else { state.table.push(playedCard); }
    state.turn = 'player'; checkNewDeal(state, container); renderGame(state, container);
}

function checkNewDeal(state, container) {
    if (state.playerHand.length === 0 && state.botHand.length === 0) {
        if (state.deck.length > 0) {
            state.playerHand = state.deck.splice(0, 3);
            state.botHand = state.deck.splice(0, 3);
            renderGame(state, container);
        } else { endMatch(state, container); }
    }
}

function endMatch(state, container) {
    if (state.table.length > 0) {
        if (state.lastCapturePlayer) state.playerCaptured.push(...state.table);
        else state.botCaptured.push(...state.table);
        state.table = [];
    }
    calculateFinalScore(state, container);
}

function calculateFinalScore(state, container) {
    let pPoints = state.playerScopas; let bPoints = state.botScopas;
    const pCap = state.playerCaptured; const bCap = state.botCaptured;
    const hasSette = (c) => c.some(card => card.suit === 'denari' && card.value === 7);
    if (hasSette(pCap)) pPoints++; else if (hasSette(bCap)) bPoints++;
    if (pCap.length > 20) pPoints++; else if (bCap.length > 20) bPoints++;
    const countD = (c) => c.filter(card => card.suit === 'denari').length;
    if (countD(pCap) > 5) pPoints++; else if (countD(bCap) > 5) bPoints++;
    const getPrimiera = (cards) => {
        let total = 0;
        SUITS.forEach(s => {
            const suitCards = cards.filter(c => c.suit === s);
            if (suitCards.length > 0) total += Math.max(...suitCards.map(c => PRIMIERA_VALUES[c.value]));
        });
        return total;
    };
    if (getPrimiera(pCap) > getPrimiera(bCap)) pPoints++; else bPoints++;
    alert(`FINE PARTITA!\n\nGiocatore: ${pPoints} punti\nBot: ${bPoints} punti`);
    showLobby(container);
}

function renderLayout(container, state) {
    container.innerHTML = `
    <style>
        .scopa-bg { width:100%; height:100dvh; background: #05020a; color:white; font-family:'Inter',sans-serif; position:relative; overflow:hidden; }
        .card-scopa { width: 75px; height: 115px; background: white; border-radius: 12px; color: black; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; box-shadow: 0 4px 15px rgba(0,0,0,0.5); cursor:pointer; transition: 0.2s; border: 2px solid transparent; }
        .card-scopa:hover { transform: translateY(-5px); border-color: var(--amethyst-bright); }
        .table-area { height: 260px; display: flex; align-items: center; justify-content: center; gap: 15px; border: 1px dashed rgba(157, 78, 221, 0.2); margin: 20px; border-radius: 20px; background: rgba(255,255,255,0.02); }
        .score-badge { position: absolute; top: 20px; right: 20px; background: rgba(157, 78, 221, 0.2); padding: 12px 20px; border-radius: 15px; font-size: 11px; }
    </style>
    <div class="scopa-bg fade-in">
        <div class="score-badge">SCORE: <span id="p-scopa">${state.playerScopas}</span> - <span id="b-scopa">${state.botScopas}</span></div>
        <div id="bot-hand-ui" style="position:absolute; top:80px; width:100%; display:flex; justify-content:center; gap:10px; opacity:0.3;"></div>
        <div class="table-area" id="table-ui"></div>
        <div class="hand-area" style="position:absolute; bottom:40px; width:100%; display:flex; justify-content:center; gap:15px;" id="player-hand-ui"></div>
        <div id="toast" style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); font-size:5rem; font-weight:900; color:var(--amethyst-bright); display:none; pointer-events:none; z-index:1000;"></div>
    </div>
    `;
}

function renderGame(state, container) {
    const tableUI = document.getElementById('table-ui');
    const playerUI = document.getElementById('player-hand-ui');
    const botUI = document.getElementById('bot-hand-ui');
    tableUI.innerHTML = state.table.map(c => renderCard(c)).join('');
    playerUI.innerHTML = state.playerHand.map((c, i) => renderCard(c, i, true)).join('');
    botUI.innerHTML = state.botHand.map(() => `<div class="card-scopa" style="background:var(--amethyst-bright); opacity:0.5;"></div>`).join('');
    state.playerHand.forEach((_, i) => { const el = document.getElementById(`card-p-${i}`); if (el) el.onclick = () => handlePlayerPlay(i, state, container); });
    document.getElementById('p-scopa').innerText = state.playerScopas;
    document.getElementById('b-scopa').innerText = state.botScopas;
}

function renderCard(card, index = 0, isPlayer = false) {
    const icons = { bastoni: '🪵', coppe: '🏆', denari: '💰', spade: '⚔️' };
    const id = isPlayer ? `id="card-p-${index}"` : '';
    return `<div ${id} class="card-scopa"><span style="font-size:1.4rem;">${card.value}</span><span style="font-size:1.8rem">${icons[card.suit]}</span></div>`;
}

function showToast(text) {
    const t = document.getElementById('toast'); t.innerText = text; t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 1500);
}