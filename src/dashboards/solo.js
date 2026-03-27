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

// --- LOGICA MAZZO E REGOLE ---
function setupDeck() {
    gameState.deck = [];
    COLORS.forEach(color => {
        VALUES.forEach(val => {
            gameState.deck.push({ color, value: val });
            if (val !== '0') gameState.deck.push({ color, value: val });
        });
    });
    for (let i = 0; i < 4; i++) {
        gameState.deck.push({ color: 'wild', value: 'cambio_colore' });
        gameState.deck.push({ color: 'wild', value: 'piu_quattro' });
    }
    shuffle(gameState.deck);
}

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
}

function drawCardSync() {
    if (gameState.deck.length === 0) {
        const top = gameState.discardPile.pop();
        gameState.deck = [...gameState.discardPile];
        shuffle(gameState.deck);
        gameState.discardPile = [top];
    }
    return gameState.deck.pop();
}

// --- AZIONI GIOCO ---
window.playerDraw = function() {
    if (gameState.turn !== 0 || gameState.isAnimating) return;
    gameState.players[0].push(drawCardSync());
    nextTurn();
};

window.playerPlay = function(index) {
    if (gameState.turn !== 0 || gameState.isAnimating) return;
    const card = gameState.players[0][index];
    if (isPlayable(card)) {
        gameState.players[0].splice(index, 1);
        playCard(card, 'player-area');
    }
};

function isPlayable(card) {
    return card.color === 'wild' || card.color === gameState.currentColor || card.value === gameState.currentValue;
}

function playCard(card, fromId) {
    gameState.isAnimating = true;
    animateCardPlay(fromId, card, () => {
        gameState.discardPile.push(card);
        gameState.currentValue = card.value;
        
        if (card.color === 'wild') {
            if (gameState.turn === 0) {
                document.getElementById('picker').style.display = 'flex';
            } else {
                selectWildColor(COLORS[Math.floor(Math.random() * 4)]);
            }
        } else {
            gameState.currentColor = card.color;
            applyEffect(card);
            gameState.isAnimating = false;
            nextTurn();
        }
    });
}

window.selectWildColor = function(color) {
    gameState.currentColor = color;
    document.getElementById('picker').style.display = 'none';
    
    if (gameState.currentValue === 'piu_quattro') {
        const target = getNextPlayer();
        for(let i=0; i<4; i++) gameState.players[target].push(drawCardSync());
    }
    
    gameState.isAnimating = false;
    nextTurn();
};

function applyEffect(card) {
    if (card.value === 'salta_turno') {
        gameState.turn = getNextPlayer();
    } else if (card.value === 'cambio_giro') {
        gameState.direction *= -1;
    } else if (card.value === 'piu_due') {
        const target = getNextPlayer();
        gameState.players[target].push(drawCardSync());
        gameState.players[target].push(drawCardSync());
    }
}

function getNextPlayer() {
    let next = gameState.turn + gameState.direction;
    if (next >= 4) next = 0;
    if (next < 0) next = 3;
    return next;
}

function nextTurn() {
    if (gameState.players[gameState.turn].length === 0) {
        alert(gameState.turn === 0 ? "HAI VINTO!" : `BOT ${gameState.turn} HA VINTO!`);
        location.reload();
        return;
    }
    gameState.turn = getNextPlayer();
    renderGameView();
    if (gameState.turn !== 0) setTimeout(botPlay, 1500);
}

function botPlay() {
    const hand = gameState.players[gameState.turn];
    const index = hand.findIndex(c => isPlayable(c));
    if (index !== -1) {
        const card = hand.splice(index, 1)[0];
        playCard(card, `bot-${gameState.turn}`);
    } else {
        hand.push(drawCardSync());
        nextTurn();
    }
}

// --- ANIMAZIONE LANCIO ---
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
        fly.style.transform = `rotate(${Math.random() * 20 - 10}deg)`;
    }, 10);

    setTimeout(() => {
        document.body.removeChild(fly);
        callback();
    }, 600);
}

// --- RENDER LAYOUT ---
function renderLayout(container) {
    container.innerHTML = `
    <style>
        .game-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white; font-family: 'Inter', sans-serif; }
        .card { width: 65px; height: 95px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2rem; cursor: pointer; transition: 0.3s; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 5px 15px rgba(0,0,0,0.6); }
        .playable { border: 2px solid #9d4ede !important; box-shadow: 0 0 20px #9d4ede; transform: translateY(-15px); }
        .bot-area { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: 0.5s; padding: 12px; border-radius: 20px; }
        .active-turn { background: rgba(157, 78, 221, 0.1); border: 1px solid rgba(157, 78, 221, 0.3); box-shadow: 0 0 25px #9d4ede44; }
        .card-back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1.5px solid #9d4ede; color: #9d4ede; font-size: 0.7rem; }
        .btn-purple { background: #9d4ede; color: black; padding: 18px 40px; border-radius: 50px; font-weight: 900; border: none; cursor: pointer; width: 100%; margin-bottom: 15px; }
        .btn-outline { background: rgba(255,255,255,0.05); color: white; padding: 15px 40px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; width: 100%; }
        .exit-btn { position: absolute; top: 20px; left: 20px; background: rgba(255,68,68,0.15); border: 1px solid #ff4444; color: white; padding: 8px 15px; border-radius: 10px; font-size: 11px; font-weight: 800; cursor: pointer; z-index: 100; transition: 0.3s; }
        .exit-btn:hover { background: #ff4444; color: black; }
    </style>
    <div class="game-bg">
        <button class="exit-btn" id="btn-exit">ESCI</button>

        <div id="start-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:5000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
            <div style="text-align:center; width: 85%; max-width: 300px;">
                <h1 style="color:#9d4ede; font-size:4rem; font-weight:900; margin-bottom:40px; text-shadow: 0 0 20px #9d4ede88;">SOLO</h1>
                <button class="btn-purple" onclick="showMode('single')">VS BOT</button>
                <button class="btn-outline" onclick="showMode('multi')">MULTIPLAYER</button>
            </div>
        </div>

        <div id="bot-1" class="bot-area" style="top:70px; left:50%; transform:translateX(-50%);"><span>BOT 1</span><div class="hand"></div></div>
        <div id="bot-2" class="bot-area" style="top:50%; left:20px; transform:translateY(-50%);"><span>BOT 2</span><div class="hand"></div></div>
        <div id="bot-3" class="bot-area" style="top:50%; right:20px; transform:translateY(-50%);"><span>BOT 3</span><div class="hand"></div></div>

        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
            <div id="dir-icon" style="font-size:30px; margin-bottom:10px; color:#9d4ede;">↻</div>
            <div style="display:flex; gap:30px; align-items:center;">
                <div id="deck-draw" onclick="playerDraw()" class="card card-back">MAZZO</div>
                <div id="discard-pile" class="card" style="width:85px; height:120px; cursor:default;"></div>
            </div>
            <div id="color-info" style="margin-top:20px; font-size:10px; letter-spacing:2px; background:rgba(0,0,0,0.3); padding:5px 15px; border-radius:20px;">
                COLORE: <span id="cur-color" style="font-weight:900;"></span>
            </div>
        </div>

        <div id="player-area" style="position:absolute; bottom:110px; width:100%; display:flex; justify-content:center; gap:5px; padding:0 20px;"></div>
        
        <div style="position:absolute; bottom:30px; width:100%; text-align:center;">
            <button class="btn-purple" style="width:auto; padding: 12px 50px; background:#ff4444; color:white;">SOLO!</button>
        </div>

        <div id="picker" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:6000; align-items:center; justify-content:center; gap:25px;">
            ${COLORS.map(c => `<div onclick="selectWildColor('${c}')" style="width:80px; height:80px; background:${getHex(c)}; border-radius:20px; cursor:pointer;"></div>`).join('')}
        </div>
    </div>
    `;

    document.getElementById('btn-exit').onclick = () => {
        const h = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
        if (h) h.style.display = 'flex';
        showLobby(container);
    };
}

window.showMode = function(mode) {
    if (mode === 'multi') return alert("🛠️ Online in arrivo!");
    document.getElementById('start-overlay').style.display = 'none';
    startGame();
}

function startGame() {
    setupDeck();
    gameState.players = Array.from({ length: 4 }, () => []);
    for(let i=0; i < 28; i++) gameState.players[i % 4].push(drawCardSync());
    let first = drawCardSync();
    while(first.color === 'wild') { gameState.deck.push(first); shuffle(gameState.deck); first = drawCardSync(); }
    gameState.discardPile.push(first);
    gameState.currentColor = first.color;
    gameState.currentValue = first.value;
    gameState.gameActive = true;
    renderGameView();
}

function renderGameView() {
    if (!gameState.gameActive) return;
    const last = gameState.discardPile[gameState.discardPile.length-1];
    const d = document.getElementById('discard-pile');
    d.style.background = getHex(last.color);
    d.innerHTML = `<span>${getSym(last.value)}</span>`;
    
    document.getElementById('cur-color').innerText = gameState.currentColor.toUpperCase();
    document.getElementById('cur-color').style.color = getHex(gameState.currentColor);
    document.getElementById('dir-icon').innerText = gameState.direction === 1 ? '↻' : '↺';
    
    [1,2,3].forEach(id => {
        const area = document.getElementById(`bot-${id}`);
        area.classList.toggle('active-turn', gameState.turn === id);
        area.querySelector('.hand').innerHTML = `<div class="card card-back" style="width:30px; height:45px;"></div><span style="font-weight:900; margin-left:10px;">${gameState.players[id].length}</span>`;
    });

    const pArea = document.getElementById('player-area');
    pArea.innerHTML = gameState.players[0].map((c, i) => {
        const playable = isPlayable(c) && gameState.turn === 0;
        return `<div onclick="playerPlay(${i})" class="card ${playable?'playable':''}" style="background:${getHex(c.color)}; margin-left:-25px; z-index:${i}">${getSym(c.value)}</div>`;
    }).join('');
}

function getHex(c) { return { rosso:'#ff4444', blu:'#0066ff', verde:'#33cc33', giallo:'#ffcc00', wild:'linear-gradient(45deg, #ff4444, #0066ff, #33cc33, #ffcc00)' }[c] || '#fff'; }
function getSym(v) { return { cambio_giro:'🔄', salta_turno:'🚫', piu_due:'+2', piu_quattro:'+4', cambio_colore:'🎨' }[v] || v; }
