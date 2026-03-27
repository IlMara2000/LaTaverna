import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';

const COLORS = ['rosso', 'giallo', 'verde', 'blu'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'cambio_giro', 'salta_turno', 'piu_due'];
const SPECIALS = ['cambio_colore', 'piu_quattro'];

let gameState = {
    deck: [], discardPile: [], players: [], turn: 0, 
    direction: 1, currentColor: '', currentValue: '', 
    gameActive: false, isAnimating: false, numPlayers: 4 
};

export function initSoloGame(container) {
    updateSidebarContext("home"); 
    const h = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (h) h.style.display = 'none';
    renderLayout(container);
}

// --- LOGICA REGOLE ---
window.startGame = function() {
    document.getElementById('start-overlay').style.display = 'none';
    setupDeck();
    gameState.players = Array.from({ length: 4 }, () => []);
    for(let i=0; i < 28; i++) gameState.players[i % 4].push(drawCardSync());

    let firstCard = drawCardSync();
    while(firstCard.type === 'wild') { gameState.deck.push(firstCard); firstCard = drawCardSync(); }
    gameState.discardPile.push(firstCard);
    gameState.currentColor = firstCard.color;
    gameState.currentValue = firstCard.value;
    
    gameState.gameActive = true;
    renderGameView();
    if (gameState.turn !== 0) setTimeout(botPlay, 1500);
}

function setupDeck() {
    gameState.deck = [];
    COLORS.forEach(color => {
        gameState.deck.push({ color, value: '0', type: 'number' });
        for (let i = 0; i < 2; i++) VALUES.slice(1).forEach(v => gameState.deck.push({ color, value: v, type: isNaN(v)?'action':'number' }));
    });
    SPECIALS.forEach(v => { for (let i = 0; i < 4; i++) gameState.deck.push({ color: 'wild', value: v, type: 'wild' }); });
    shuffle(gameState.deck);
}

function nextTurn(skip = false) {
    const steps = skip ? 2 : 1;
    gameState.turn = (gameState.turn + (steps * gameState.direction) + 4) % 4;
    gameState.isAnimating = false;
    renderGameView();
    if (gameState.turn !== 0) setTimeout(botPlay, 1500);
}

// --- EFFETTI CARTE ---
function handlePlay(card) {
    gameState.isAnimating = true;
    gameState.discardPile.push(card);
    gameState.currentValue = card.value;
    if (card.color !== 'wild') gameState.currentColor = card.color;

    let skipNext = false;
    if (card.value === 'salta_turno') skipNext = true;
    if (card.value === 'cambio_giro') gameState.direction *= -1;
    if (card.value === 'piu_due') { penalize(2); skipNext = true; }
    if (card.value === 'piu_quattro') { penalize(4); skipNext = true; }

    if (card.type === 'wild' && gameState.turn === 0) {
        showColorPicker();
    } else {
        if (card.type === 'wild') gameState.currentColor = COLORS[Math.floor(Math.random()*4)];
        setTimeout(() => nextTurn(skipNext), 600);
    }
}

function penalize(n) {
    let target = (gameState.turn + gameState.direction + 4) % 4;
    for(let i=0; i<n; i++) gameState.players[target].push(drawCardSync());
}

// --- AZIONI ---
window.playerPlay = function(i) {
    if (gameState.turn !== 0 || gameState.isAnimating) return;
    const card = gameState.players[0][i];
    if (card.color === 'wild' || card.color === gameState.currentColor || card.value === gameState.currentValue) {
        gameState.players[0].splice(i, 1);
        handlePlay(card);
    }
}

window.playerDraw = function() {
    if (gameState.turn !== 0 || gameState.isAnimating) return;
    gameState.isAnimating = true;
    gameState.players[0].push(drawCardSync());
    setTimeout(() => nextTurn(), 500);
}

function botPlay() {
    if (!gameState.gameActive || gameState.turn === 0) return;
    const hand = gameState.players[gameState.turn];
    const i = hand.findIndex(c => c.color === 'wild' || c.color === gameState.currentColor || c.value === gameState.currentValue);
    
    if (i !== -1) {
        handlePlay(hand.splice(i, 1)[0]);
    } else {
        hand.push(drawCardSync());
        nextTurn();
    }
}

// --- INTERFACCIA ---
function renderLayout(container) {
    container.innerHTML = `
    <style>
        .game-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white; font-family: sans-serif; }
        .card { width: 60px; height: 90px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2rem; cursor: pointer; transition: 0.3s; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        .card.playable { border: 2px solid #9d4ede !important; box-shadow: 0 0 15px #9d4ede; transform: translateY(-10px); }
        .bot-area { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 5px; transition: 0.5s; padding: 10px; border-radius: 15px; }
        .active-turn { background: rgba(157, 78, 221, 0.2); box-shadow: 0 0 20px #9d4ede; }
        .card-back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1px solid #9d4ede; }
        .btn-solo { background: #ff4444; color: white; padding: 12px 40px; border-radius: 50px; font-weight: 900; border: none; cursor: pointer; box-shadow: 0 0 15px rgba(255,68,68,0.4); }
    </style>
    <div class="game-bg">
        <div id="start-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:1000; display:flex; align-items:center; justify-content:center; flex-direction:column;">
            <h1 style="color:#9d4ede; font-size:4rem; margin-bottom:30px;">SOLO</h1>
            <button onclick="startGame()" style="padding:15px 50px; border-radius:50px; background:#9d4ede; border:none; color:black; font-weight:900; cursor:pointer;">INIZIA</button>
        </div>

        <div id="bot-1" class="bot-area" style="top:50px; left:50%; transform:translateX(-50%);"><span>BOT 1</span><div class="hand"></div></div>
        <div id="bot-2" class="bot-area" style="top:50%; left:20px; transform:translateY(-50%);"><span>BOT 2</span><div class="hand"></div></div>
        <div id="bot-3" class="bot-area" style="top:50%; right:20px; transform:translateY(-50%);"><span>BOT 3</span><div class="hand"></div></div>

        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
            <div id="dir-icon" style="font-size:30px; margin-bottom:10px; color:#9d4ede;">↻</div>
            <div style="display:flex; gap:30px; justify-content:center; align-items:center;">
                <div onclick="playerDraw()" class="card card-back" style="width:80px; height:120px;">MAZZO</div>
                <div id="discard-pile" class="card" style="width:90px; height:130px; cursor:default;"></div>
            </div>
            <div id="color-info" style="margin-top:20px; font-size:12px; letter-spacing:2px;">COLORE: <span id="cur-color" style="font-weight:900;"></span></div>
        </div>

        <div id="player-area" style="position:absolute; bottom:100px; width:100%; display:flex; justify-content:center; gap:10px; padding:0 20px;"></div>
        <div style="position:absolute; bottom:30px; width:100%; text-align:center;"><button class="btn-solo">SOLO!</button></div>

        <div id="picker" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:2000; align-items:center; justify-content:center; gap:20px;">
            ${COLORS.map(c => `<div onclick="selectWildColor('${c}')" style="width:80px; height:80px; background:${getHex(c)}; border-radius:20px; cursor:pointer;"></div>`).join('')}
        </div>
    </div>
    `;
}

function renderGameView() {
    const last = gameState.discardPile[gameState.discardPile.length-1];
    const d = document.getElementById('discard-pile');
    d.style.background = getHex(last.color);
    d.innerHTML = `<span>${getSym(last.value)}</span>`;
    
    document.getElementById('cur-color').innerText = gameState.currentColor.toUpperCase();
    document.getElementById('cur-color').style.color = getHex(gameState.currentColor);
    document.getElementById('dir-icon').innerText = gameState.direction === 1 ? "↻" : "↺";

    // Bot Hand Rendering
    [1,2,3].forEach(id => {
        const area = document.getElementById(`bot-${id}`);
        const count = gameState.players[id].length;
        area.classList.toggle('active-turn', gameState.turn === id);
        area.querySelector('.hand').innerHTML = `<div class="card card-back" style="width:30px; height:45px;"></div> <span style="font-weight:900;">${count}</span>`;
    });

    // Player Hand
    const pArea = document.getElementById('player-area');
    pArea.innerHTML = gameState.players[0].map((c, i) => {
        const playable = (c.color === 'wild' || c.color === gameState.currentColor || c.value === gameState.currentValue) && gameState.turn === 0;
        return `<div onclick="playerPlay(${i})" class="card ${playable?'playable':''}" style="background:${getHex(c.color)}; margin-left:-20px;">${getSym(c.value)}</div>`;
    }).join('');
}

window.selectWildColor = function(c) {
    gameState.currentColor = c;
    document.getElementById('picker').style.display = 'none';
    nextTurn(true);
}
function showColorPicker() { document.getElementById('picker').style.display = 'flex'; }

function getHex(c) { return { rosso:'#ff4444', blu:'#0066ff', verde:'#33cc33', giallo:'#ffcc00', wild:'linear-gradient(45deg, #ff4444, #0066ff, #33cc33, #ffcc00)' }[c] || '#fff'; }
function getSym(v) { return { cambio_giro:'🔄', salta_turno:'🚫', piu_due:'+2', piu_quattro:'+4', cambio_colore:'🎨' }[v] || v; }
function drawCardSync() { return gameState.deck.length ? gameState.deck.pop() : (shuffle(gameState.discardPile), gameState.discardPile.pop()); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
