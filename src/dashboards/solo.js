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

let gameContainer = null;

export function initSoloGame(container) {
    gameContainer = container;
    updateSidebarContext("home"); 
    const h = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (h) h.style.display = 'none';
    renderLayout(container);
}

// --- ANIMAZIONE VOLO CARTA ---
function animateCard(fromId, toId, cardData, callback) {
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    if (!fromEl || !toEl) return callback ? callback() : null;

    const start = fromEl.getBoundingClientRect();
    const end = toEl.getBoundingClientRect();

    const fly = document.createElement('div');
    fly.className = 'card' + (cardData ? '' : ' card-back');
    fly.style.position = 'fixed';
    fly.style.left = `${start.left}px`;
    fly.style.top = `${start.top}px`;
    fly.style.zIndex = '9999';
    fly.style.transition = 'all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    
    if (cardData) {
        fly.style.background = getHex(cardData.color);
        fly.innerHTML = `<span>${getSym(cardData.value)}</span>`;
    }

    document.body.appendChild(fly);

    requestAnimationFrame(() => {
        fly.style.left = `${end.left}px`;
        fly.style.top = `${end.top}px`;
        fly.style.transform = `scale(0.8) rotate(${Math.random() * 20 - 10}deg)`;
        if (!cardData) fly.style.opacity = '0'; // Dissolvenza per la distribuzione
    });

    setTimeout(() => {
        document.body.removeChild(fly);
        if (callback) callback();
    }, 500);
}

// --- LOGICA DI GIOCO ---
window.showMode = function(mode) {
    if (mode === 'multi') return alert("🛠️ Multiplayer Online in arrivo!");
    document.getElementById('start-overlay').style.display = 'none';
    startInitialDeal();
}

function startInitialDeal() {
    setupDeck();
    gameState.players = Array.from({ length: 4 }, () => []);
    gameState.isAnimating = true;
    
    let cardsToDeal = 28; // 7 per 4 giocatori
    let currentDealt = 0;

    const interval = setInterval(() => {
        const pIdx = currentDealt % 4;
        const targetId = pIdx === 0 ? 'player-area' : `bot-${pIdx}`;
        const card = drawCardSync();
        
        animateCard('deck-draw', targetId, null, () => {
            gameState.players[pIdx].push(card);
            renderGameView();
        });

        currentDealt++;
        if (currentDealt >= cardsToDeal) {
            clearInterval(interval);
            setTimeout(() => {
                // Pesca la prima carta dello scarto
                let firstCard = drawCardSync();
                while(firstCard.type === 'wild') { gameState.deck.push(firstCard); firstCard = drawCardSync(); }
                
                animateCard('deck-draw', 'discard-pile', firstCard, () => {
                    gameState.discardPile.push(firstCard);
                    gameState.currentColor = firstCard.color;
                    gameState.currentValue = firstCard.value;
                    gameState.gameActive = true;
                    gameState.isAnimating = false;
                    renderGameView();
                    if (gameState.turn !== 0) setTimeout(botPlay, 1000);
                });
            }, 600);
        }
    }, 150); // Velocità distribuzione
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

// --- AZIONI TURNI ---
function handlePlayEffect(card, sourceId) {
    gameState.isAnimating = true;
    animateCard(sourceId, 'discard-pile', card, () => {
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
    if (gameState.turn !== 0 && gameState.gameActive) setTimeout(botPlay, 1500);
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
    animateCard('deck-draw', 'player-area', null, () => {
        gameState.players[0].push(drawCardSync());
        gameState.isAnimating = false;
        renderGameView();
        setTimeout(() => nextTurn(), 500);
    });
}

function botPlay() {
    if (!gameState.gameActive || gameState.turn === 0 || gameState.isAnimating) return;
    const pIdx = gameState.turn;
    const hand = gameState.players[pIdx];
    const i = hand.findIndex(c => c.color === 'wild' || c.color === gameState.currentColor || c.value === gameState.currentValue);
    
    if (i !== -1) {
        const card = hand.splice(i, 1)[0];
        handlePlayEffect(card, `bot-${pIdx}`);
    } else {
        animateCard('deck-draw', `bot-${pIdx}`, null, () => {
            hand.push(drawCardSync());
            renderGameView();
            setTimeout(() => nextTurn(), 600);
        });
    }
}

// --- RENDER ---
function renderLayout(container) {
    container.innerHTML = `
    <style>
        .game-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white; font-family: 'Inter', sans-serif; }
        .card { width: 60px; height: 90px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2rem; cursor: pointer; transition: 0.3s; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        .playable { border: 2px solid #9d4ede !important; box-shadow: 0 0 15px #9d4ede; transform: translateY(-10px); }
        .bot-area { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px; border-radius: 15px; }
        .active-turn { background: rgba(157, 78, 221, 0.2); box-shadow: 0 0 20px #9d4ede; }
        .card-back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1px solid #9d4ede; color: #9d4ede; font-size: 0.6rem; }
        .btn-exit { position: absolute; top: 20px; left: 20px; background: rgba(255,68,68,0.2); border: 1px solid #ff4444; color: white; padding: 8px 16px; border-radius: 10px; z-index: 100; cursor: pointer; }
    </style>
    <div class="game-bg">
        <button class="btn-exit" id="exit-btn">ESCI</button>

        <div id="start-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:5000; display:flex; align-items:center; justify-content:center;">
            <div style="text-align:center; width: 80%; max-width: 300px;">
                <h1 style="color:#9d4ede; font-size:4rem; margin-bottom:40px;">SOLO</h1>
                <button style="width:100%; padding:18px; border-radius:50px; background:#9d4ede; border:none; font-weight:900; margin-bottom:15px;" onclick="showMode('single')">VS BOT</button>
                <button style="width:100%; padding:15px; border-radius:50px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.2); color:white;" onclick="showMode('multi')">MULTIPLAYER</button>
            </div>
        </div>

        <div id="bot-1" class="bot-area" style="top:50px; left:50%; transform:translateX(-50%);"><span>BOT 1</span><div class="hand"></div></div>
        <div id="bot-2" class="bot-area" style="top:50%; left:15px; transform:translateY(-50%);"><span>BOT 2</span><div class="hand"></div></div>
        <div id="bot-3" class="bot-area" style="top:50%; right:15px; transform:translateY(-50%);"><span>BOT 3</span><div class="hand"></div></div>

        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
            <div id="dir-icon" style="font-size:30px; margin-bottom:10px; color:#9d4ede;">↻</div>
            <div style="display:flex; gap:30px; justify-content:center; align-items:center;">
                <div id="deck-draw" onclick="playerDraw()" class="card card-back" style="width:80px; height:120px;">MAZZO</div>
                <div id="discard-pile" class="card" style="width:90px; height:130px; cursor:default;"></div>
            </div>
            <div id="color-info" style="margin-top:20px; font-size:10px; background:rgba(0,0,0,0.4); padding:5px 15px; border-radius:20px;">
                COLORE: <span id="cur-color"></span>
            </div>
        </div>

        <div id="player-area" style="position:absolute; bottom:110px; width:100%; display:flex; justify-content:center; gap:5px; padding:0 20px;"></div>
        <div style="position:absolute; bottom:30px; width:100%; text-align:center;"><button style="background:#ff4444; color:white; padding:12px 60px; border-radius:50px; border:none; font-weight:900;">SOLO!</button></div>

        <div id="picker" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:6000; align-items:center; justify-content:center; gap:20px;">
            ${COLORS.map(c => `<div onclick="selectWildColor('${c}')" style="width:80px; height:80px; background:${getHex(c)}; border-radius:20px;"></div>`).join('')}
        </div>
    </div>
    `;

    document.getElementById('exit-btn').onclick = () => {
        const h = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
        if (h) h.style.display = 'flex';
        showLobby(container);
    };
}

function renderGameView() {
    if (!gameState.players.length) return;
    const last = gameState.discardPile[gameState.discardPile.length-1];
    if(last) {
        const d = document.getElementById('discard-pile');
        d.style.background = getHex(last.color);
        d.innerHTML = `<span>${getSym(last.value)}</span>`;
    }
    
    document.getElementById('cur-color').innerText = gameState.currentColor.toUpperCase();
    document.getElementById('cur-color').style.color = getHex(gameState.currentColor);
    document.getElementById('dir-icon').innerText = gameState.direction === 1 ? "↻" : "↺";

    [1,2,3].forEach(id => {
        const area = document.getElementById(`bot-${id}`);
        const count = gameState.players[id].length;
        area.classList.toggle('active-turn', gameState.turn === id);
        area.querySelector('.hand').innerHTML = `<div class="card card-back" style="width:30px; height:45px;">SOLO</div> <span style="font-weight:900;">${count}</span>`;
    });

    const pArea = document.getElementById('player-area');
    pArea.innerHTML = gameState.players[0].map((c, i) => {
        const playable = (c.color === 'wild' || c.color === gameState.currentColor || c.value === gameState.currentValue) && gameState.turn === 0 && !gameState.isAnimating;
        return `<div onclick="playerPlay(${i})" class="card ${playable?'playable':''}" style="background:${getHex(c.color)}; margin-left:-25px; z-index:${i}">${getSym(c.value)}</div>`;
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
