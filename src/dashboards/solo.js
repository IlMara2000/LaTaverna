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
    alert("📢 HAI CHIAMATO SOLO!");
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
        playable.sort((a,b) => {
            let tA = gameState.players[1][a].type, tB = gameState.players[1][b].type;
            if (tA === 'wild') return -1;
            if (tA === 'action' && tB === 'number') return -1;
            return 1;
        });
        let chosenIndex = playable[0];
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
        gameState.deck = gameState.discardPile;
        gameState.discardPile = [top];
        shuffle(gameState.deck);
    }
    return gameState.deck.pop();
}
function shuffle(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function endGame(msg) { gameState.gameActive = false; alert(`🏆 ${msg}`); showLobby(gameContainer); }

function renderLayout(container) {
    container.innerHTML = `
        <div class="fade-in" style="width:100%; height:100vh; position:relative; overflow:hidden; background:#05020a; color:white;">
            <button id="back-to-lobby-solo" style="position: absolute; top: 20px; left: 20px; z-index: 100; background: rgba(157, 78, 221, 0.1); border: 1px solid rgba(157, 78, 221, 0.4); color: var(--amethyst-bright); padding: 10px 15px; border-radius: 12px; cursor: pointer; font-size: 10px; font-weight: 800; letter-spacing: 1px; backdrop-filter: blur(10px);">← LIBRERIA</button>
            <div id="game-status" style="position:absolute; top:25px; left:50%; transform:translateX(-50%); text-transform:uppercase; letter-spacing:1px; color:var(--amethyst-bright); font-weight:900;"></div>
            <div id="bot-hand" style="position:absolute; top:20px; right:20px; display:flex; gap:5px;"></div>
            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); display:flex; gap:20px; align-items:center;">
                <div id="deck-pile" onclick="playerDrawCard()" style="width:80px; height:120px; background:linear-gradient(135deg, #1a0a2a, #0a020f); border:2px solid #333; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:900;">SOLO</div>
                <div id="discard-card" style="width:100px; height:150px; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 0 20px rgba(157, 78, 221, 0.3);"></div>
                <div style="font-size:12px; text-transform:uppercase; opacity:0.6;">Colore: <span id="current-color" style="font-weight:bold;"></span></div>
            </div>
            <div id="player-hand" style="position:absolute; bottom:120px; left:50%; transform:translateX(-50%); display:flex; gap:-15px; padding: 0 40px; width:90%; justify-content:center; overflow-x:auto;"></div>
            <button onclick="callSolo()" style="position:absolute; bottom:30px; right:30px; background:#ff4444; color:white; border:none; padding:15px 30px; border-radius:12px; font-weight:900; cursor:pointer; box-shadow:0 0 15px rgba(255,68,68,0.4);">SOLO!</button>
            <button id="open-rules" style="position:absolute; bottom:30px; left:30px; background:rgba(255,255,255,0.05); color:white; border:1px solid rgba(255,255,255,0.2); padding:10px 15px; border-radius:8px; cursor:pointer; font-size:11px;">REGOLE</button>
            
            <div id="color-picker-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; align-items:center; justify-content:center; backdrop-filter:blur(5px);">
                <div style="background:#0a020f; border:1px solid var(--amethyst-bright); padding:30px; border-radius:20px; text-align:center;">
                    <h3>SCEGLI UN COLORE</h3>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:20px;">
                        <div onclick="selectWildColor('rosso')" style="width:60px; height:60px; background:#ff4444; border-radius:10px; cursor:pointer;"></div>
                        <div onclick="selectWildColor('blu')" style="width:60px; height:60px; background:#0066ff; border-radius:10px; cursor:pointer;"></div>
                        <div onclick="selectWildColor('verde')" style="width:60px; height:60px; background:#33cc33; border-radius:10px; cursor:pointer;"></div>
                        <div onclick="selectWildColor('giallo')" style="width:60px; height:60px; background:#ffcc00; border-radius:10px; cursor:pointer;"></div>
                    </div>
                </div>
            </div>

            <div id="rules-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:9999; overflow-y:auto; padding:30px; backdrop-filter:blur(10px);">
                <button id="close-rules" style="position:fixed; top:20px; right:20px; background:none; border:1px solid #ff4444; color:#ff4444; padding:5px 10px; border-radius:5px; cursor:pointer;">CHIUDI X</button>
                <div style="max-width:600px; margin: 40px auto; line-height:1.6;">
                    <h2 style="color:var(--amethyst-bright);">REGOLE: SOLO - LA SFIDA</h2>
                    <p>Abbina per colore o numero. Se rimani con una carta premi SOLO!</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('back-to-lobby-solo').onclick = () => {
        gameState.gameActive = false;
        showLobby(container);
    };
    document.getElementById('open-rules').onclick = () => document.getElementById('rules-overlay').style.display = 'block';
    document.getElementById('close-rules').onclick = () => document.getElementById('rules-overlay').style.display = 'none';
}

function renderGameView() {
    document.getElementById('game-status').innerText = gameState.turn === 0 ? "⚠️ TUO TURNO" : "🤖 BOT STA GIOCANDO...";
    const discardCard = gameState.discardPile[gameState.discardPile.length - 1];
    const discardDiv = document.getElementById('discard-card');
    discardDiv.style.background = getHex(discardCard.color);
    discardDiv.innerHTML = `<span style="font-size:4rem; font-weight:900; color:${['blu','rosso'].includes(discardCard.color) ? 'white' : 'black'}">${getSymbol(discardCard.value)}</span>`;
    document.getElementById('current-color').innerText = gameState.currentColor.toUpperCase();
    document.getElementById('current-color').style.color = getHex(gameState.currentColor);
    document.getElementById('bot-hand').innerHTML = gameState.players[1].map(() => `<div style="width:25px; height:40px; background:#1a0a2a; border-radius:4px; border:1px solid rgba(255,255,255,0.1);"></div>`).join('') + `<span style="opacity:0.5; font-size:12px; margin-left:5px;">${gameState.players[1].length}</span>`;
    document.getElementById('player-hand').innerHTML = gameState.players[0].map((card, index) => {
        const playable = canPlay(card);
        return `<div onclick="playerPlayCard(${index})" style="width:80px; height:120px; background:${getHex(card.color)}; border-radius:10px; margin-left:-10px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-weight:900; border: 2px solid ${playable ? 'var(--amethyst-bright)' : 'black'}; transform: translateY(${playable ? '0px' : '20px'}); opacity: ${playable || gameState.turn !== 0 ? '1' : '0.5'};"><span style="font-size:2rem; color:${['blu','rosso','wild'].includes(card.color) ? 'white' : 'black'}">${getSymbol(card.value)}</span></div>`;
    }).join('');
}

function showColorPicker() {
    gameState.forcedColorChange = true;
    document.getElementById('color-picker-modal').style.display = 'flex';
}

function getHex(c) { return { rosso:'#ff4444', giallo:'#ffcc00', verde:'#33cc33', blu:'#0066ff', wild:'linear-gradient(135deg, #ff4444, #0066ff, #33cc33)' }[c] || '#333'; }
function getSymbol(v) { return { cambio_giro:'🔄', salta_turno:'🚫', piu_due:'+2', cambio_colore:'🎨', piu_quattro:'+4' }[v] || v; }
