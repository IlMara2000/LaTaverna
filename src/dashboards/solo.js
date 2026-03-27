import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';

// Costanti di Gioco
const COLORS = ['rosso', 'giallo', 'verde', 'blu'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'cambio_giro', 'salta_turno', 'piu_due'];
const SPECIALS = ['cambio_colore', 'piu_quattro'];

let gameState = {
    deck: [], discardPile: [], players: [], turn: 0, 
    currentColor: '', currentValue: '', gameActive: false, 
    forcedColorChange: false, hasCalledSolo: false,
    numPlayers: 4 // Tu + 3 Bot
};

let gameContainer = null;

export function initSoloGame(container) {
    gameContainer = container;
    updateSidebarContext("home"); 
    
    // Nascondi l'hamburger menu (sidebar trigger)
    const hamburger = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (hamburger) hamburger.style.display = 'none';

    renderLayout(container);
}

function startGame() {
    gameState.gameActive = true;
    document.getElementById('start-overlay').style.display = 'none';
    setupDeck();
    dealCards();
    startTurn();
}

function setupDeck() {
    gameState.deck = [];
    COLORS.forEach(color => {
        gameState.deck.push({ color, value: '0', type: 'number' });
        for (let i = 0; i < 2; i++) {
            VALUES.slice(1).forEach(value => {
                let type = isNaN(value) ? 'action' : 'number';
                gameState.deck.push({ color, value, type });
            });
        }
    });
    SPECIALS.forEach(value => {
        for (let i = 0; i < 4; i++) {
            gameState.deck.push({ color: 'wild', value, type: 'wild' });
        }
    });
    shuffle(gameState.deck);
}

function dealCards() {
    gameState.players = Array.from({ length: gameState.numPlayers }, () => []);
    for (let i = 0; i < 7; i++) {
        for (let p = 0; p < gameState.numPlayers; p++) {
            gameState.players[p].push(drawCard());
        }
    }
    let firstCard;
    do {
        firstCard = drawCard();
        if (firstCard.type === 'wild') gameState.deck.push(firstCard);
    } while (firstCard.type === 'wild');
    
    gameState.discardPile.push(firstCard);
    gameState.currentColor = firstCard.color;
    gameState.currentValue = firstCard.value;
}

function startTurn() {
    renderGameView();
    if (gameState.players[gameState.turn].length === 0) {
        endGame(gameState.turn === 0 ? "HAI VINTO!" : `HA VINTO IL BOT ${gameState.turn}!`);
        return;
    }
    if (gameState.turn !== 0) setTimeout(botPlay, 1500);
}

window.playerPlayCard = function(cardIndex) {
    if (gameState.turn !== 0 || !gameState.gameActive || gameState.forcedColorChange) return;
    const card = gameState.players[0][cardIndex];
    if (canPlay(card)) {
        gameState.players[0].splice(cardIndex, 1);
        handleCardEffects(card);
        if (gameState.players[0].length === 1 && !gameState.hasCalledSolo) {
            alert("⚠️ Non hai chiamato SOLO! Peschi 2 carte.");
            gameState.players[0].push(drawCard(), drawCard());
        }
        gameState.hasCalledSolo = false;
        if (!gameState.forcedColorChange) nextTurn();
    }
}

window.playerDrawCard = function() {
    if (gameState.turn !== 0 || !gameState.gameActive) return;
    gameState.players[0].push(drawCard());
    gameState.hasCalledSolo = false;
    nextTurn();
}

window.callSolo = function() {
    if (gameState.turn !== 0 || !gameState.gameActive) return;
    gameState.hasCalledSolo = true;
    renderGameView();
}

window.selectWildColor = function(color) {
    gameState.currentColor = color;
    gameState.forcedColorChange = false;
    document.getElementById('color-picker-modal').style.display = 'none';
    nextTurn();
}

window.triggerStart = function() {
    startGame();
}

function botPlay() {
    if (!gameState.gameActive) return;
    let pIdx = gameState.turn;
    let playable = [];
    gameState.players[pIdx].forEach((card, i) => { if (canPlay(card)) playable.push(i); });

    if (playable.length > 0) {
        let chosenIndex = playable[Math.floor(Math.random() * playable.length)];
        const card = gameState.players[pIdx][chosenIndex];
        gameState.players[pIdx].splice(chosenIndex, 1);
        handleCardEffects(card);

        if (card.type === 'wild') {
            const counts = {};
            gameState.players[pIdx].forEach(c => counts[c.color] = (counts[c.color] || 0) + 1);
            gameState.currentColor = COLORS.reduce((a, b) => (counts[a] || 0) > (counts[b] || 0) ? a : b);
        }
        if (!gameState.forcedColorChange) nextTurn();
    } else {
        gameState.players[pIdx].push(drawCard());
        nextTurn();
    }
}

function handleCardEffects(card) {
    gameState.discardPile.push(card);
    gameState.currentValue = card.value;
    if (card.color !== 'wild') gameState.currentColor = card.color;

    switch (card.value) {
        case 'cambio_giro': case 'salta_turno': nextTurn(true); break;
        case 'piu_due':
            let targetP = (gameState.turn + 1) % gameState.numPlayers;
            gameState.players[targetP].push(drawCard(), drawCard());
            nextTurn(true); break;
        case 'piu_quattro':
            let targetP4 = (gameState.turn + 1) % gameState.numPlayers;
            for(let i=0;i<4;i++) gameState.players[targetP4].push(drawCard());
            if (gameState.turn === 0) showColorPicker();
            nextTurn(true); break;
        case 'cambio_colore': if (gameState.turn === 0) showColorPicker(); break;
    }
}

function canPlay(card) { return card.type === 'wild' || card.color === gameState.currentColor || card.value === gameState.currentValue; }
function nextTurn(skip = false) { if (!gameState.gameActive) return; gameState.turn = (gameState.turn + (skip ? 2 : 1)) % gameState.numPlayers; startTurn(); }
function drawCard() {
    if (gameState.deck.length === 0) {
        const top = gameState.discardPile.pop();
        gameState.deck = [...gameState.discardPile];
        gameState.discardPile = [top];
        shuffle(gameState.deck);
    }
    return gameState.deck.pop();
}
function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }

function endGame(msg) { 
    gameState.gameActive = false; 
    alert(`🏆 ${msg}`); 
    const hamburger = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (hamburger) hamburger.style.display = 'flex';
    showLobby(gameContainer); 
}

function renderLayout(container) {
    container.innerHTML = `
        <style>
            .solo-card {
                width: 60px; height: 90px; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                font-weight: 900; font-size: 1.4rem; cursor: pointer;
                transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                position: relative; border: 1px solid rgba(255,255,255,0.1);
            }
            .bot-back { background: linear-gradient(135deg, #1a0a2a, #05020a); border: 1px solid var(--amethyst-bright); }
            .playable { border: 2px solid var(--amethyst-bright) !important; box-shadow: 0 0 15px var(--amethyst-bright); transform: translateY(-10px); }
            .bot-pos { position: absolute; display: flex; gap: 5px; align-items: center; }
        </style>

        <div class="fade-in" style="width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white;">
            
            <div id="start-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:2000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
                <div style="text-align:center;">
                    <h1 style="font-size:3rem; font-weight:900; letter-spacing:5px; color:var(--amethyst-bright); margin-bottom:30px;">SOLO</h1>
                    <button onclick="triggerStart()" style="background:var(--amethyst-bright); color:black; border:none; padding:20px 50px; border-radius:50px; font-weight:900; font-size:1.2rem; cursor:pointer; box-shadow:0 0 30px var(--amethyst-bright);">AVVIA PARTITA</button>
                    <p style="margin-top:20px; opacity:0.5; font-size:12px;">Sfida 3 avversari automatici</p>
                </div>
            </div>

            <div style="padding:20px; display:flex; justify-content:space-between; width:100%; position:absolute; z-index:100;">
                <button id="exit-game" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; color:white; padding:8px 15px; border-radius:10px; cursor:pointer; font-size:10px;">ESCI</button>
                <div id="turn-indicator" style="font-weight:900; letter-spacing:2px; text-transform:uppercase; color:var(--amethyst-bright);"></div>
                <div style="width:80px;"></div>
            </div>

            <div id="bot-top" class="bot-pos" style="top:70px; left:50%; transform:translateX(-50%);"></div>
            <div id="bot-left" class="bot-pos" style="top:50%; left:20px; transform:translateY(-50%) rotate(90deg);"></div>
            <div id="bot-right" class="bot-pos" style="top:50%; right:20px; transform:translateY(-50%) rotate(-90deg);"></div>

            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
                <div style="display:flex; gap:30px; align-items:center; justify-content:center; margin-bottom:20px;">
                    <div onclick="playerDrawCard()" style="width:80px; height:120px; background:linear-gradient(135deg, #331155, #110522); border:2px solid var(--amethyst-bright); border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; transform:rotate(-5deg);">
                        <span style="font-size:10px; font-weight:900;">DECK</span>
                    </div>
                    <div id="discard-card" class="solo-card" style="width:90px; height:130px; cursor:default;"></div>
                </div>
                <div id="color-info" style="font-size:10px; letter-spacing:2px; opacity:0.6;">COLORE: <span id="current-color-txt" style="font-weight:900;"></span></div>
            </div>

            <div id="player-hand" style="position:absolute; bottom:100px; left:50%; transform:translateX(-50%); display:flex; justify-content:center; width:90%; height:140px;"></div>

            <div style="position:absolute; bottom:30px; width:100%; display:flex; justify-content:space-around; align-items:center; padding:0 20px;">
                <button onclick="callSolo()" style="background:#ff4444; border:none; color:white; padding:15px 40px; border-radius:50px; font-weight:900; cursor:pointer; box-shadow:0 0 20px rgba(255,68,68,0.4);">SOLO!</button>
            </div>

            <div id="color-picker-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:3000; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                    <div onclick="selectWildColor('rosso')" style="width:70px; height:70px; background:#ff4444; border-radius:15px; cursor:pointer;"></div>
                    <div onclick="selectWildColor('blu')" style="width:70px; height:70px; background:#0066ff; border-radius:15px; cursor:pointer;"></div>
                    <div onclick="selectWildColor('verde')" style="width:70px; height:70px; background:#33cc33; border-radius:15px; cursor:pointer;"></div>
                    <div onclick="selectWildColor('giallo')" style="width:70px; height:70px; background:#ffcc00; border-radius:15px; cursor:pointer;"></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('exit-game').onclick = () => {
        const hamburger = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
        if (hamburger) hamburger.style.display = 'flex';
        showLobby(container);
    };
}

function renderGameView() {
    if (!gameState.gameActive) return;

    // Turno
    const turnTxt = ["TUO TURNO", "BOT 1 (TOP)", "BOT 2 (LEFT)", "BOT 3 (RIGHT)"];
    document.getElementById('turn-indicator').innerText = turnTxt[gameState.turn];
    document.getElementById('turn-indicator').style.opacity = gameState.turn === 0 ? "1" : "0.5";

    // Discard
    const lastCard = gameState.discardPile[gameState.discardPile.length - 1];
    const discardDiv = document.getElementById('discard-card');
    discardDiv.style.background = getHex(lastCard.color);
    discardDiv.innerHTML = `<span style="color:${['blu','rosso','wild'].includes(lastCard.color) ? 'white' : '#1a0a2a'}">${getSymbol(lastCard.value)}</span>`;
    
    document.getElementById('current-color-txt').innerText = gameState.currentColor.toUpperCase();
    document.getElementById('current-color-txt').style.color = getHex(gameState.currentColor === 'wild' ? 'rosso' : gameState.currentColor);

    // Render Bots
    const renderBot = (id, playerIdx) => {
        const el = document.getElementById(id);
        const count = gameState.players[playerIdx].length;
        el.innerHTML = Array.from({ length: Math.min(count, 5) }).map(() => `<div class="solo-card bot-back" style="width:30px; height:45px; margin-left:-15px;"></div>`).join('') + 
                       `<span style="font-size:10px; margin-left:10px; font-weight:900;">${count}</span>`;
    };
    renderBot('bot-top', 1);
    renderBot('bot-left', 2);
    renderBot('bot-right', 3);

    // Player Hand
    const handDiv = document.getElementById('player-hand');
    handDiv.innerHTML = gameState.players[0].map((card, i) => {
        const playable = canPlay(card) && gameState.turn === 0;
        return `
            <div onclick="playerPlayCard(${i})" class="solo-card ${playable ? 'playable' : ''}" 
                 style="background:${getHex(card.color)}; margin-left:-20px; z-index:${i};">
                 <span style="color:${['blu','rosso','wild'].includes(card.color) ? 'white' : '#1a0a2a'}">${getSymbol(card.value)}</span>
            </div>
        `;
    }).join('');
}

function getHex(c) { 
    return { rosso:'#ff4444', giallo:'#ffcc00', verde:'#33cc33', blu:'#0066ff', wild:'linear-gradient(135deg, #ff4444, #0066ff, #33cc33, #ffcc00)' }[c] || '#333'; 
}

function getSymbol(v) { 
    return { cambio_giro:'🔄', salta_turno:'🚫', piu_due:'+2', cambio_colore:'🎨', piu_quattro:'+4' }[v] || v; 
}
