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

// --- ANIMAZIONE LANCIO CARTA ---
function animateCardPlay(fromId, card, callback) {
    const fromEl = document.getElementById(fromId);
    const targetEl = document.getElementById('discard-pile');
    if (!fromEl || !targetEl) return callback();

    const startRect = fromEl.getBoundingClientRect();
    const endRect = targetEl.getBoundingClientRect();

    const fly = document.createElement('div');
    fly.className = 'card';
    fly.style.position = 'fixed';
    fly.style.left = `${startRect.left}px`;
    fly.style.top = `${startRect.top}px`;
    fly.style.background = getHex(card.color);
    fly.style.zIndex = '10000';
    fly.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    fly.innerHTML = `<span>${getSym(card.value)}</span>`;
    document.body.appendChild(fly);

    setTimeout(() => {
        fly.style.left = `${endRect.left}px`;
        fly.style.top = `${endRect.top}px`;
        fly.style.transform = `rotate(${Math.random() * 20 - 10}deg) scale(1.1)`;
    }, 10);

    setTimeout(() => {
        document.body.removeChild(fly);
        callback();
    }, 600);
}

// --- LOGICA DI GIOCO ---
window.showMode = function(mode) {
    if (mode === 'multi') return alert("🛠️ Multiplayer Online in arrivo!");
    document.getElementById('start-overlay').style.display = 'none';
    startGame();
}

function startGame() {
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

function handlePlayEffect(card, sourceId) {
    gameState.isAnimating = true;
    
    animateCardPlay(sourceId, card, () => {
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
            nextTurn(skipNext);
        }
    });
}

function nextTurn(skip = false) {
    const steps = skip ? 2 : 1;
    gameState.turn = (gameState.turn + (steps * gameState.direction) + 4) % 4;
    gameState.isAnimating = false;
    renderGameView();
    if (gameState.turn !== 0 && gameState.gameActive) setTimeout(botPlay, 2000);
}

function penalize(n) {
    let target = (gameState.turn + gameState.direction + 4) % 4;
    for(let i=0; i<n; i++) gameState.players[target].push(drawCardSync());
}

window.playerPlay = function(i) {
    if (gameState.turn !== 0 || gameState.isAnimating) return;
    const card = gameState.players[0][i];
    if (card.color === 'wild' || card.color === gameState.currentColor || card.value === gameState.currentValue) {
        gameState.players[0].splice(i, 1);
        handlePlayEffect(card, 'player-area');
    }
}

window.playerDraw = function() {
    if (gameState.turn !== 0 || gameState.isAnimating) return;
    gameState.isAnimating = true;
    gameState.players[0].push(drawCardSync());
    renderGameView();
    setTimeout(() => nextTurn(), 800);
}

function botPlay() {
    if (!gameState.gameActive || gameState.turn === 0) return;
    const pIdx = gameState.turn;
    const hand = gameState.players[pIdx];
    const i = hand.findIndex(c => c.color === 'wild' || c.color === gameState.currentColor || c.value === gameState.currentValue);
    
    if (i !== -1) {
        const card = hand.splice(i, 1)[0];
        handlePlayEffect(card, `bot-${pIdx}`);
    } else {
        hand.push(drawCardSync());
        renderGameView();
        setTimeout(() => nextTurn(), 1000);
    }
}

// --- RENDER ---
function renderLayout(container) {
    container.innerHTML = `
    <style>
        .game-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white; font-family: 'Inter', sans-serif; }
        .card { width: 65px; height: 95px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.3rem; cursor: pointer; transition: 0.3s; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 5px 15px rgba(0,0,0,0.6); }
        .playable { border: 2.5px solid #9d4ede !important; box-shadow: 0 0 20px #9d4ede; transform: translateY(-15px); }
        .bot-area { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: 0.5s; padding: 15px; border-radius: 20px; min-width: 80px; }
        .active-turn { background: rgba(157, 78, 221, 0.15); box-shadow: 0 0 25px 2px #9d4ede; border: 1px solid rgba(157, 78, 221, 0.3); }
        .card-back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1.5px solid #9d4ede; color: #9d4ede; font-size: 0.7rem; }
        .btn-main { background: #9d4ede; color: black; padding: 18px 40px; border-radius: 50px; font-weight: 900; border: none; cursor: pointer; width: 100%; margin-bottom: 15px; transition: 0.3s; }
        .btn-sec { background: rgba(255,255,255,0.05); color: white; padding: 15px 40px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; width: 100%; }
    </style>
    <div class="game-bg">
        <div id="start-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:5000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
            <div style="text-align:center; width: 80%; max-width: 320px;">
                <h1 style="color:#9d4ede; font-size:4.5rem; font-weight:900; margin-bottom:40px; text-shadow: 0 0 20px #9d4ede;">SOLO</h1>
                <button class="btn-main" onclick="showMode('single')">GIOCA VS BOT</button>
                <button class="btn-sec" onclick="showMode('multi')">MULTIPLAYER ONLINE</button>
            </div>
        </div>

        <div id="bot-1" class="bot-area" style="top:60px; left:50%; transform:translateX(-50%);">
            <span style="font-size:12px; opacity:0.7;">BOT 1</span>
            <div class="hand" style="display:flex;"></div>
        </div>
        <div id="bot-2" class="bot-area" style="top:50%; left:20px; transform:translateY(-50%);">
            <span style="font-size:12px; opacity:0.7;">BOT 2</span>
            <div class="hand"></div>
        </div>
        <div id="bot-3" class="bot-area" style="top:50%; right:20px; transform:translateY(-50%);">
            <span style="font-size:12px; opacity:0.7;">BOT 3</span>
            <div class="hand"></div>
        </div>

        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
            <div id="dir-icon" style="font-size:32px; margin-bottom:15px; color:#9d4ede; text-shadow: 0 0 10px #9d4ede;">↻</div>
            <div style="display:flex; gap:35px; justify-content:center; align-items:center;">
                <div id="deck-draw" onclick="playerDraw()" class="card card-back" style="width:85px; height:125px;">MAZZO</div>
                <div id="discard-pile" class="card" style="width:95px; height:135px; cursor:default; transform:rotate(2deg);"></div>
            </div>
            <div id="color-info" style="margin-top:25px; font-size:11px; letter-spacing:3px; background:rgba(0,0,0,0.4); padding:8px 20px; border-radius:30px;">
                COLORE: <span id="cur-color" style="font-weight:900;"></span>
            </div>
        </div>

        <div id="player-area" style="position:absolute; bottom:110px; width:100%; display:flex; justify-content:center; gap:5px; padding:0 10px;"></div>
        
        <div style="position:absolute; bottom:30px; width:100%; text-align:center;">
            <button class="btn-main" style="width:auto; padding: 12px 60px; background:#ff4444; color:white; box-shadow: 0 0 20px rgba(255,68,68,0.4);">SOLO!</button>
        </div>

        <div id="picker" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:6000; align-items:center; justify-content:center; gap:30px;">
            ${COLORS.map(c => `<div onclick="selectWildColor('${c}')" style="width:90px; height:90px; background:${getHex(c)}; border-radius:25px; cursor:pointer; box-shadow: 0 0 20px ${getHex(c)}66;"></div>`).join('')}
        </div>
    </div>
    `;
}

function renderGameView() {
    if (!gameState.gameActive) return;
    const last = gameState.discardPile[gameState.discardPile.length-1];
    const d = document.getElementById('discard-pile');
    d.style.background = getHex(last.color);
    d.innerHTML = `<span style="color:${['blu','rosso','wild'].includes(last.color)?'white':'#1a0a2a'}">${getSym(last.value)}</span>`;
    
    document.getElementById('cur-color').innerText = gameState.currentColor.toUpperCase();
    document.getElementById('cur-color').style.color = getHex(gameState.currentColor);
    document.getElementById('dir-icon').innerText = gameState.direction === 1 ? "↻" : "↺";
    document.getElementById('dir-icon').style.transform = `scaleX(${gameState.direction})`;

    [1,2,3].forEach(id => {
        const area = document.getElementById(`bot-${id}`);
        const count = gameState.players[id].length;
        area.classList.toggle('active-turn', gameState.turn === id);
        area.querySelector('.hand').innerHTML = `<div class="card card-back" style="width:35px; height:50px; margin-left:-15px;">SOLO</div> <span style="font-weight:900; margin-left:10px;">${count}</span>`;
    });

    const pArea = document.getElementById('player-area');
    pArea.classList.toggle('active-turn', gameState.turn === 0);
    pArea.innerHTML = gameState.players[0].map((c, i) => {
        const playable = (c.color === 'wild' || c.color === gameState.currentColor || c.value === gameState.currentValue) && gameState.turn === 0 && !gameState.isAnimating;
        return `<div onclick="playerPlay(${i})" class="card ${playable?'playable':''}" style="background:${getHex(c.color)}; margin-left:-30px; z-index:${i}; color:${['blu','rosso','wild'].includes(c.color)?'white':'#1a0a2a'}">${getSym(c.value)}</div>`;
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
