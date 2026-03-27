import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';

// Costanti di Gioco
const COLORS = ['rosso', 'giallo', 'verde', 'blu'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'cambio_giro', 'salta_turno', 'piu_due'];
const SPECIALS = ['cambio_colore', 'piu_quattro'];

let gameState = {
    deck: [], discardPile: [], players: [], turn: 0, 
    currentColor: '', currentValue: '', gameActive: false, 
    forcedColorChange: false, hasCalledSolo: false
};

let gameContainer = null;

export function initSoloGame(container) {
    gameContainer = container;
    updateSidebarContext("home"); 
    gameState.gameActive = true;
    
    renderLayout(container);
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
    gameState.players = [[], []];
    for (let i = 0; i < 7; i++) {
        gameState.players[0].push(drawCard());
        gameState.players[1].push(drawCard());
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
        endGame(gameState.turn === 0 ? "HAI VINTO!" : "HA VINTO IL BOT!");
        return;
    }
    if (gameState.turn === 1) setTimeout(botPlay, 1500);
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

function botPlay() {
    if (!gameState.gameActive) return;
    let playable = [];
    gameState.players[1].forEach((card, i) => { if (canPlay(card)) playable.push(i); });

    if (playable.length > 0) {
        let chosenIndex = playable[Math.floor(Math.random() * playable.length)];
        const card = gameState.players[1][chosenIndex];
        gameState.players[1].splice(chosenIndex, 1);
        handleCardEffects(card);

        if (card.type === 'wild') {
            const counts = {};
            gameState.players[1].forEach(c => counts[c.color] = (counts[c.color] || 0) + 1);
            gameState.currentColor = COLORS.reduce((a, b) => counts[a] > counts[b] ? a : b);
        }
        if (!gameState.forcedColorChange) nextTurn();
    } else {
        gameState.players[1].push(drawCard());
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
            gameState.players[gameState.turn === 0 ? 1 : 0].push(drawCard(), drawCard());
            nextTurn(true); break;
        case 'piu_quattro':
            for(let i=0;i<4;i++) gameState.players[gameState.turn === 0 ? 1 : 0].push(drawCard());
            if (gameState.turn === 0) showColorPicker();
            nextTurn(true); break;
        case 'cambio_colore': if (gameState.turn === 0) showColorPicker(); break;
    }
}

function canPlay(card) { return card.type === 'wild' || card.color === gameState.currentColor || card.value === gameState.currentValue; }
function nextTurn(skip = false) { if (!gameState.gameActive) return; gameState.turn = (gameState.turn + (skip ? 2 : 1)) % 2; startTurn(); }
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
function endGame(msg) { gameState.gameActive = false; alert(`🏆 ${msg}`); showLobby(gameContainer); }

function renderLayout(container) {
    container.innerHTML = `
        <style>
            .solo-card {
                width: 70px; height: 110px; border-radius: 12px;
                display: flex; align-items: center; justify-content: center;
                font-weight: 900; font-size: 1.8rem; cursor: pointer;
                transition: transform 0.3s, box-shadow 0.3s;
                box-shadow: 0 4px 15px rgba(0,0,0,0.4);
                position: relative; border: 1px solid rgba(255,255,255,0.1);
                user-select: none;
            }
            .hand-container {
                display: flex; justify-content: center; align-items: flex-end;
                padding-bottom: 20px; width: 100%; height: 180px;
                perspective: 1000px;
            }
            .player-card-wrapper {
                margin-left: -25px; transition: transform 0.2s;
            }
            .player-card-wrapper:hover { transform: translateY(-30px) scale(1.1); z-index: 100 !important; }
            .playable { border: 2px solid var(--amethyst-bright) !important; box-shadow: 0 0 15px var(--amethyst-bright); }
            .btn-action {
                background: rgba(157, 78, 221, 0.2); border: 1px solid var(--amethyst-bright);
                color: white; padding: 12px 20px; border-radius: 50px;
                font-weight: 800; letter-spacing: 1px; cursor: pointer; transition: 0.3s;
            }
            .btn-action:hover { background: var(--amethyst-bright); color: black; }
        </style>

        <div class="fade-in" style="width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden;">
            
            <div style="padding: 20px; display: flex; justify-content: space-between; align-items: center; position: absolute; width: 100%; z-index: 10;">
                <button id="back-to-lobby-solo" class="btn-action" style="font-size: 10px; padding: 8px 15px;">← LIBRERIA</button>
                <div id="game-status" style="font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;"></div>
                <div id="bot-hand-info" style="background: rgba(255,255,255,0.05); padding: 5px 15px; border-radius: 20px; font-size: 12px; border: 1px solid rgba(255,255,255,0.1);"></div>
            </div>

            <div style="position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 30px; width: 100%;">
                
                <div style="display: flex; gap: 40px; align-items: center;">
                    <div id="deck-pile" onclick="playerDrawCard()" style="width: 85px; height: 130px; background: linear-gradient(135deg, #331155, #110522); border: 2px solid var(--amethyst-bright); border-radius: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transform: rotate(-5deg);">
                        <span style="font-weight: 900; color: var(--amethyst-bright); font-size: 14px;">SOLO</span>
                    </div>

                    <div id="discard-card" class="solo-card" style="width: 100px; height: 150px; cursor: default; transform: rotate(3deg);"></div>
                </div>

                <div id="color-indicator" style="background: rgba(0,0,0,0.4); padding: 8px 20px; border-radius: 30px; font-size: 11px; letter-spacing: 2px; border: 1px solid rgba(255,255,255,0.1);">
                    COLORE ATTUALE: <span id="current-color-name" style="font-weight: 900;"></span>
                </div>
            </div>

            <div style="position: absolute; bottom: 0; width: 100%; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); padding-top: 40px;">
                <div id="player-hand" class="hand-container"></div>
                
                <div style="padding: 20px; display: flex; justify-content: space-between; align-items: center; max-width: 500px; margin: 0 auto;">
                    <button id="open-rules" style="background:none; border:none; color:rgba(255,255,255,0.4); font-size:10px; cursor:pointer;">REGOLE</button>
                    <button onclick="callSolo()" id="solo-btn" class="btn-action" style="background: #ff4444; border-color: #ff4444; box-shadow: 0 0 20px rgba(255,68,68,0.3);">SOLO!</button>
                </div>
            </div>

            <div id="color-picker-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:1000; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
                <div style="text-align:center;">
                    <h3 style="letter-spacing:3px; margin-bottom:30px; font-size:14px;">SCEGLI IL NUOVO COLORE</h3>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
                        <div onclick="selectWildColor('rosso')" style="width:80px; height:80px; background:#ff4444; border-radius:20px; cursor:pointer; box-shadow: 0 0 20px rgba(255,68,68,0.4);"></div>
                        <div onclick="selectWildColor('blu')" style="width:80px; height:80px; background:#0066ff; border-radius:20px; cursor:pointer; box-shadow: 0 0 20px rgba(0,102,255,0.4);"></div>
                        <div onclick="selectWildColor('verde')" style="width:80px; height:80px; background:#33cc33; border-radius:20px; cursor:pointer; box-shadow: 0 0 20px rgba(51,204,51,0.4);"></div>
                        <div onclick="selectWildColor('giallo')" style="width:80px; height:80px; background:#ffcc00; border-radius:20px; cursor:pointer; box-shadow: 0 0 20px rgba(255,204,0,0.4);"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('back-to-lobby-solo').onclick = () => {
        gameState.gameActive = false;
        showLobby(container);
    };
}

function renderGameView() {
    const statusEl = document.getElementById('game-status');
    statusEl.innerText = gameState.turn === 0 ? "Tuo Turno" : "Bot sta pensando...";
    statusEl.style.color = gameState.turn === 0 ? "var(--amethyst-bright)" : "rgba(255,255,255,0.4)";

    document.getElementById('bot-hand-info').innerText = `BOT: ${gameState.players[1].length} CARTE`;

    // Discard Card
    const discardCard = gameState.discardPile[gameState.discardPile.length - 1];
    const discardDiv = document.getElementById('discard-card');
    discardDiv.style.background = getHex(discardCard.color);
    discardDiv.innerHTML = `<span style="color:${['blu','rosso','wild'].includes(discardCard.color) ? 'white' : '#1a0a2a'}">${getSymbol(discardCard.value)}</span>`;

    // Color Indicator
    document.getElementById('current-color-name').innerText = gameState.currentColor.toUpperCase();
    document.getElementById('current-color-name').style.color = getHex(gameState.currentColor === 'wild' ? 'rosso' : gameState.currentColor);

    // Solo Button Highlight
    const soloBtn = document.getElementById('solo-btn');
    if (gameState.players[0].length === 2 && gameState.turn === 0) {
        soloBtn.style.animation = "pulse 1s infinite";
    } else {
        soloBtn.style.animation = "none";
    }

    // Player Hand
    const handDiv = document.getElementById('player-hand');
    handDiv.innerHTML = '';
    
    gameState.players[0].forEach((card, index) => {
        const playable = canPlay(card) && gameState.turn === 0;
        const rotation = (index - (gameState.players[0].length / 2)) * 6;
        const translateY = Math.abs(index - (gameState.players[0].length / 2)) * 4;

        const wrapper = document.createElement('div');
        wrapper.className = 'player-card-wrapper';
        wrapper.style.zIndex = index;
        wrapper.style.transform = `rotate(${rotation}deg) translateY(${translateY}px)`;
        
        wrapper.innerHTML = `
            <div onclick="playerPlayCard(${index})" class="solo-card ${playable ? 'playable' : ''}" 
                 style="background: ${getHex(card.color)}; opacity: ${gameState.turn === 0 ? 1 : 0.7}">
                <span style="color:${['blu','rosso','wild'].includes(card.color) ? 'white' : '#1a0a2a'}">${getSymbol(card.value)}</span>
            </div>
        `;
        handDiv.appendChild(wrapper);
    });
}

function showColorPicker() {
    gameState.forcedColorChange = true;
    document.getElementById('color-picker-modal').style.display = 'flex';
}

function getHex(c) { 
    return { 
        rosso:'#ff4444', 
        giallo:'#ffcc00', 
        verde:'#33cc33', 
        blu:'#0066ff', 
        wild:'linear-gradient(135deg, #ff4444, #0066ff, #33cc33, #ffcc00)' 
    }[c] || '#333'; 
}

function getSymbol(v) { 
    return { 
        cambio_giro:'🔄', 
        salta_turno:'🚫', 
        piu_due:'+2', 
        cambio_colore:'🎨', 
        piu_quattro:'+4' 
    }[v] || v; 
}
