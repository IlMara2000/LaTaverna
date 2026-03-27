import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';

const COLORS = ['rosso', 'giallo', 'verde', 'blu'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'cambio_giro', 'salta_turno', 'piu_due'];
const SPECIALS = ['cambio_colore', 'piu_quattro'];

let gameState = {
    deck: [], discardPile: [], players: [], turn: 0, 
    direction: 1, currentColor: '', currentValue: '', 
    gameActive: false, forcedColorChange: false, hasCalledSolo: false,
    numPlayers: 4, isAnimating: false 
};

let gameContainer = null;

export function initSoloGame(container) {
    gameContainer = container;
    updateSidebarContext("home"); 
    const h = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (h) h.style.display = 'none';
    renderLayout(container);
}

// --- SETUP ---
window.startGame = function() {
    document.getElementById('start-overlay').style.display = 'none';
    setupDeck();
    gameState.players = Array.from({ length: gameState.numPlayers }, () => []);
    
    // Distribuzione iniziale (7 carte a testa)
    for(let i=0; i < gameState.numPlayers * 7; i++) {
        gameState.players[i % gameState.numPlayers].push(drawCardSync());
    }

    let firstCard = drawCardSync();
    while(firstCard.type === 'wild') { gameState.deck.push(firstCard); shuffle(gameState.deck); firstCard = drawCardSync(); }
    gameState.discardPile.push(firstCard);
    gameState.currentColor = firstCard.color;
    gameState.currentValue = firstCard.value;
    
    gameState.gameActive = true;
    renderGameView();
    startTurn();
}

function setupDeck() {
    gameState.deck = [];
    COLORS.forEach(color => {
        gameState.deck.push({ color, value: '0', type: 'number' });
        for (let i = 0; i < 2; i++) {
            VALUES.slice(1).forEach(value => {
                gameState.deck.push({ color, value, type: isNaN(value) ? 'action' : 'number' });
            });
        }
    });
    SPECIALS.forEach(value => {
        for (let i = 0; i < 4; i++) gameState.deck.push({ color: 'wild', value, type: 'wild' });
    });
    shuffle(gameState.deck);
}

// --- CORE LOGIC (REGOLE UFFICIALI) ---
function startTurn() {
    if (!gameState.gameActive) return;
    renderGameView();
    
    if (gameState.turn !== 0) {
        setTimeout(botPlay, 2000); // 2 secondi di attesa per "leggere" la mossa precedente
    }
}

function nextTurn(skipNext = false) {
    // Se skipNext è true, il giocatore successivo viene saltato (es. dopo un +2, +4 o Salta Turno)
    let steps = skipNext ? 2 : 1;
    gameState.turn = (gameState.turn + (steps * gameState.direction) + gameState.numPlayers) % gameState.numPlayers;
    
    gameState.isAnimating = false;
    startTurn();
}

function handleCardEffects(card) {
    gameState.discardPile.push(card);
    gameState.currentValue = card.value;
    if (card.color !== 'wild') gameState.currentColor = card.color;

    let skip = false;

    switch (card.value) {
        case 'cambio_giro':
            if (gameState.numPlayers === 2) skip = true; // In 2 giocatori vale come Salta Turno
            else gameState.direction *= -1;
            break;
        case 'salta_turno':
            skip = true;
            break;
        case 'piu_due':
            penalizeNext(2);
            skip = true; // Chi pesca, salta il turno
            break;
        case 'piu_quattro':
            penalizeNext(4);
            skip = true; // Chi pesca, salta il turno
            if (gameState.turn === 0) {
                showColorPicker();
                return; // Aspetta la scelta del colore prima di passare
            } else {
                // Bot sceglie colore
                gameState.currentColor = COLORS[Math.floor(Math.random()*4)];
            }
            break;
        case 'cambio_colore':
            if (gameState.turn === 0) {
                showColorPicker();
                return;
            }
            gameState.currentColor = COLORS[Math.floor(Math.random()*4)];
            break;
    }
    
    nextTurn(skip);
}

function penalizeNext(count) {
    let nextIdx = (gameState.turn + gameState.direction + gameState.numPlayers) % gameState.numPlayers;
    for(let i=0; i<count; i++) gameState.players[nextIdx].push(drawCardSync());
}

// --- AZIONI GIOCATORE ---
window.playerPlayCard = function(idx) {
    if (gameState.turn !== 0 || gameState.isAnimating) return;
    const card = gameState.players[0][idx];
    
    if (canPlay(card)) {
        gameState.isAnimating = true;
        gameState.players[0].splice(idx, 1);
        handleCardEffects(card);
    }
}

window.playerDrawCard = function() {
    if (gameState.turn !== 0 || gameState.isAnimating) return;
    gameState.isAnimating = true;
    
    animateCardDeal(0, 0.8, () => {
        gameState.players[0].push(drawCardSync());
        // Se la carta pescata è giocabile, le regole UNO permettono di giocarla subito, 
        // ma per semplicità qui passiamo il turno.
        nextTurn();
    });
}

function botPlay() {
    if (gameState.turn === 0 || !gameState.gameActive) return;
    
    let pIdx = gameState.turn;
    let hand = gameState.players[pIdx];
    let playableIdx = hand.findIndex(c => canPlay(c));

    if (playableIdx !== -1) {
        let card = hand.splice(playableIdx, 1)[0];
        handleCardEffects(card);
    } else {
        animateCardDeal(pIdx, 0.8, () => {
            hand.push(drawCardSync());
            nextTurn();
        });
    }
}

// --- UTILS ---
function canPlay(card) {
    return card.color === 'wild' || card.color === gameState.currentColor || card.value === gameState.currentValue;
}

function drawCardSync() {
    if (gameState.deck.length === 0) {
        let top = gameState.discardPile.pop();
        gameState.deck = [...gameState.discardPile];
        gameState.discardPile = [top];
        shuffle(gameState.deck);
    }
    return gameState.deck.pop();
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
}

function animateCardDeal(pIdx, duration, callback) {
    // Visual feedback del volo (semplificato per stabilità)
    setTimeout(callback, duration * 1000);
}

// --- RENDER ---
function renderLayout(container) {
    container.innerHTML = `
    <style>
        .solo-card { width: 60px; height: 90px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; cursor: pointer; border: 1px solid #000; }
        .bot-area { position: absolute; padding: 10px; border-radius: 10px; background: rgba(0,0,0,0.3); }
        .active { border: 2px solid yellow !important; box-shadow: 0 0 15px yellow; }
    </style>
    <div style="width:100%; height:100dvh; background:#1a1a1a; color:white; position:relative; overflow:hidden;">
        <div id="start-overlay" style="position:absolute; inset:0; background:black; z-index:100; display:flex; align-items:center; justify-content:center;">
             <button onclick="startGame()" style="padding:20px 40px; font-size:20px; cursor:pointer;">INIZIA PARTITA</button>
        </div>

        <div id="bot-1" class="bot-area" style="top:20px; left:50%; transform:translateX(-50%);">Bot 1</div>
        <div id="bot-2" class="bot-area" style="top:50%; left:20px; transform:translateY(-50%);">Bot 2</div>
        <div id="bot-3" class="bot-area" style="top:50%; right:20px; transform:translateY(-50%);">Bot 3</div>

        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center;">
            <div id="dir-text" style="font-size:20px; margin-bottom:10px;"></div>
            <div style="display:flex; gap:20px;">
                <div id="deck-element" onclick="playerDrawCard()" style="width:70px; height:100px; background:purple; border-radius:10px; cursor:pointer;">MAZZO</div>
                <div id="discard-pile" style="width:70px; height:100px; border-radius:10px;"></div>
            </div>
            <p id="current-color-display" style="margin-top:10px; font-weight:bold;"></p>
        </div>

        <div id="player-hand" style="position:absolute; bottom:40px; left:50%; transform:translateX(-50%); display:flex; gap:10px; padding:20px;"></div>
    </div>
    <div id="color-picker" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:200; align-items:center; justify-content:center;">
        <button onclick="selectColor('rosso')" style="background:red; width:80px; height:80px;"></button>
        <button onclick="selectColor('blu')" style="background:blue; width:80px; height:80px;"></button>
        <button onclick="selectColor('verde')" style="background:green; width:80px; height:80px;"></button>
        <button onclick="selectColor('giallo')" style="background:yellow; width:80px; height:80px;"></button>
    </div>
    `;
}

window.selectColor = function(c) {
    gameState.currentColor = c;
    document.getElementById('color-picker').style.display = 'none';
    nextTurn(true); // Dopo il +4 o cambio colore, passa il turno
}

function showColorPicker() {
    document.getElementById('color-picker').style.display = 'flex';
}

function renderGameView() {
    const hand = document.getElementById('player-hand');
    hand.innerHTML = gameState.players[0].map((c, i) => `
        <div onclick="playerPlayCard(${i})" class="solo-card" style="background:${getHex(c.color)}">
            ${c.value.replace('_', ' ')}
        </div>
    `).join('');

    const discard = document.getElementById('discard-pile');
    const last = gameState.discardPile[gameState.discardPile.length-1];
    discard.style.background = getHex(last.color);
    discard.innerText = last.value.replace('_', ' ');

    document.getElementById('current-color-display').innerText = "COLORE: " + gameState.currentColor.toUpperCase();
    document.getElementById('current-color-display').style.color = getHex(gameState.currentColor);
    document.getElementById('dir-text').innerText = gameState.direction === 1 ? "GIRO: ORARIO ↻" : "GIRO: ANTIORARIO ↺";

    // Evidenzia bot attivo
    [1,2,3].forEach(i => document.getElementById(`bot-${i}`).classList.toggle('active', gameState.turn === i));
}

function getHex(c) {
    const m = { rosso: '#ff4b4b', blu: '#4b77ff', verde: '#4bff4b', giallo: '#ffeb4b', wild: 'linear-gradient(45deg, red, blue, green, yellow)' };
    return m[c] || '#fff';
}

function endGame(m) { alert(m); location.reload(); }
