import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';

const COLORS = ['rosso', 'giallo', 'verde', 'blu'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'cambio_giro', 'salta_turno', 'piu_due'];
const SPECIALS = ['cambio_colore', 'piu_quattro'];

let gameState = {
    deck: [], discardPile: [], players: [], turn: 0, 
    direction: 1, currentColor: '', currentValue: '', 
    gameActive: false, forcedColorChange: false, hasCalledSolo: false,
    numPlayers: 4 
};

let gameContainer = null;
let isAnimating = false;

export function initSoloGame(container) {
    gameContainer = container;
    updateSidebarContext("home"); 
    const h = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (h) h.style.display = 'none';
    renderLayout(container);
}

// --- LOGICA DI SETUP ---
window.showModeSelection = function(mode) {
    document.getElementById('mode-selection').style.display = 'none';
    if (mode === 'single') startGame();
    else document.getElementById('multiplayer-ui').style.display = 'block';
}

window.backToModeSelection = function() {
    document.getElementById('multiplayer-ui').style.display = 'none';
    document.getElementById('mode-selection').style.display = 'block';
}

function startGame() {
    document.getElementById('start-overlay').style.display = 'none';
    setupDeck();
    fastInitialDeal(() => {
        gameState.gameActive = true;
        startTurn();
    });
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

// --- ANIMAZIONI MIGLIORATE (PIÙ LENTE E FLUIDE) ---
function animateCardDeal(targetIndex, duration = 0.6, callback = null) {
    const deckEl = document.getElementById('deck-element');
    const targets = ['player-hand', 'bot-top', 'bot-left', 'bot-right'];
    const targetEl = document.getElementById(targets[targetIndex]);
    
    if (!deckEl || !targetEl) { if(callback) callback(); return; }

    const deckRect = deckEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();

    const flyingCard = document.createElement('div');
    flyingCard.className = 'flying-card';
    flyingCard.style.left = `${deckRect.left}px`;
    flyingCard.style.top = `${deckRect.top}px`;
    flyingCard.style.transition = `all ${duration}s cubic-bezier(0.165, 0.84, 0.44, 1)`;
    document.body.appendChild(flyingCard);

    requestAnimationFrame(() => {
        flyingCard.style.left = `${targetRect.left + (targetRect.width / 2) - 30}px`;
        flyingCard.style.top = `${targetRect.top + (targetRect.height / 2) - 45}px`;
        flyingCard.style.transform = `scale(0.7) rotate(${Math.random() * 360}deg)`;
        flyingCard.style.opacity = '0.4';
    });

    setTimeout(() => {
        if (document.body.contains(flyingCard)) document.body.removeChild(flyingCard);
        if (callback) callback();
    }, duration * 1000);
}

function fastInitialDeal(onComplete) {
    gameState.players = Array.from({ length: gameState.numPlayers }, () => []);
    let cardsDealt = 0;
    const totalCards = 7 * gameState.numPlayers;
    
    let interval = setInterval(() => {
        let pIdx = cardsDealt % gameState.numPlayers;
        gameState.players[pIdx].push(drawCardSync());
        animateCardDeal(pIdx, 0.5); // Leggermente più veloce solo al setup
        renderGameView();
        cardsDealt++;
        if (cardsDealt >= totalCards) {
            clearInterval(interval);
            setTimeout(() => {
                let firstCard;
                do { firstCard = drawCardSync(); if (firstCard.type === 'wild') gameState.deck.push(firstCard); } while (firstCard.type === 'wild');
                gameState.discardPile.push(firstCard);
                gameState.currentColor = firstCard.color;
                gameState.currentValue = firstCard.value;
                renderGameView();
                onComplete();
            }, 600);
        }
    }, 150);
}

// --- LOGICA DI GIOCO ---
function startTurn() {
    renderGameView();
    if (gameState.players[gameState.turn].length === 0) {
        endGame(gameState.turn === 0 ? "HAI VINTO!" : `HA VINTO IL BOT ${gameState.turn}!`);
        return;
    }
    if (gameState.turn !== 0) setTimeout(botPlay, 1800);
}

function nextTurn(skip = false) {
    if (!gameState.gameActive) return;
    const steps = skip ? 2 : 1;
    gameState.turn = (gameState.turn + (steps * gameState.direction) + gameState.numPlayers) % gameState.numPlayers;
    startTurn();
}

window.playerPlayCard = function(cardIndex) {
    if (gameState.turn !== 0 || !gameState.gameActive || isAnimating) return;
    const card = gameState.players[0][cardIndex];
    if (canPlay(card)) {
        gameState.players[0].splice(cardIndex, 1);
        handleCardEffects(card);
        if (gameState.players[0].length === 1 && !gameState.hasCalledSolo) {
            alert("⚠️ SOLO non chiamato! Peschi 2.");
            penalizePlayer(0, 2);
        } else {
            gameState.hasCalledSolo = false;
            if (!gameState.forcedColorChange) nextTurn();
        }
    }
}

window.playerDrawCard = function() {
    if (gameState.turn !== 0 || !gameState.gameActive || isAnimating) return;
    isAnimating = true;
    animateCardDeal(0, 0.7, () => {
        gameState.players[0].push(drawCardSync());
        gameState.hasCalledSolo = false;
        isAnimating = false;
        nextTurn();
    });
}

function handleCardEffects(card) {
    gameState.discardPile.push(card);
    gameState.currentValue = card.value;
    if (card.color !== 'wild') gameState.currentColor = card.color;
    switch (card.value) {
        case 'cambio_giro': gameState.direction *= -1; if (gameState.numPlayers === 2) nextTurn(true); break;
        case 'salta_turno': nextTurn(true); break;
        case 'piu_due':
            let t2 = (gameState.turn + gameState.direction + gameState.numPlayers) % gameState.numPlayers;
            penalizePlayer(t2, 2); nextTurn(true); break;
        case 'piu_quattro':
            let t4 = (gameState.turn + gameState.direction + gameState.numPlayers) % gameState.numPlayers;
            penalizePlayer(t4, 4); if (gameState.turn === 0) showColorPicker(); nextTurn(true); break;
        case 'cambio_colore': if (gameState.turn === 0) showColorPicker(); break;
    }
}

function botPlay() {
    if (!gameState.gameActive) return;
    let pIdx = gameState.turn;
    let playable = [];
    gameState.players[pIdx].forEach((card, i) => { if (canPlay(card)) playable.push(i); });
    if (playable.length > 0) {
        let chosen = playable[Math.floor(Math.random() * playable.length)];
        const card = gameState.players[pIdx][chosen];
        gameState.players[pIdx].splice(chosen, 1);
        handleCardEffects(card);
        if (card.type === 'wild') {
            const counts = {};
            gameState.players[pIdx].forEach(c => counts[c.color] = (counts[c.color] || 0) + 1);
            gameState.currentColor = COLORS.reduce((a, b) => (counts[a] || 0) > (counts[b] || 0) ? a : b);
        }
        if (!gameState.forcedColorChange) nextTurn();
    } else {
        isAnimating = true;
        animateCardDeal(pIdx, 0.7, () => {
            gameState.players[pIdx].push(drawCardSync());
            isAnimating = false;
            nextTurn();
        });
    }
}

function penalizePlayer(pIdx, amount) {
    isAnimating = true;
    let count = 0;
    let intv = setInterval(() => {
        animateCardDeal(pIdx, 0.5, () => {
            gameState.players[pIdx].push(drawCardSync());
            renderGameView();
        });
        count++;
        if (count >= amount) { clearInterval(intv); setTimeout(() => { isAnimating = false; }, 600); }
    }, 300);
}

// --- UTILS ---
function canPlay(card) { return card.type === 'wild' || card.color === gameState.currentColor || card.value === gameState.currentValue; }
function drawCardSync() {
    if (gameState.deck.length === 0) {
        const top = gameState.discardPile.pop();
        gameState.deck = [...gameState.discardPile]; gameState.discardPile = [top];
        shuffle(gameState.deck);
    }
    return gameState.deck.pop();
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

function endGame(msg) { 
    gameState.gameActive = false; alert(`🏆 ${msg}`); 
    const h = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (h) h.style.display = 'flex';
    showLobby(gameContainer); 
}

// --- RENDER ---
function renderLayout(container) {
    container.innerHTML = `
        <style>
            .solo-card {
                width: 65px; height: 95px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
                font-weight: 900; font-size: 1.4rem; cursor: pointer; transition: 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.6);
                position: relative; border: 1px solid rgba(255,255,255,0.15);
            }
            .bot-back { background: linear-gradient(135deg, #1a0a2a, #05020a); border: 1.5px solid var(--amethyst-bright); }
            .playable { border: 2.5px solid var(--amethyst-bright) !important; box-shadow: 0 0 20px var(--amethyst-bright); transform: translateY(-15px); }
            
            /* Più spazio tra i giocatori e il centro */
            .bot-pos { position: absolute; display: flex; gap: 8px; align-items: center; padding: 15px; transition: 0.5s; border-radius: 20px; z-index: 50; }
            .active-turn { box-shadow: 0 0 30px 5px var(--amethyst-bright); background: rgba(157, 78, 221, 0.2); }
            
            .flying-card {
                position: fixed; width: 65px; height: 95px; border-radius: 10px; background: linear-gradient(135deg, #331155, #110522);
                border: 2px solid var(--amethyst-bright); z-index: 9999; pointer-events: none; opacity: 1;
            }
            .main-btn { background: var(--amethyst-bright); color: black; border: none; padding: 18px; border-radius: 50px; font-weight: 900; cursor: pointer; width: 100%; margin-bottom: 15px; font-size: 1rem; }
            .sec-btn { background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 15px; border-radius: 50px; cursor: pointer; width: 100%; margin-bottom: 15px; }
        </style>

        <div class="fade-in" style="width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white;">
            
            <div id="start-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:2000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(15px);">
                <div style="text-align:center; max-width: 320px; width: 90%;">
                    <h1 style="font-size:4.5rem; font-weight:900; color:var(--amethyst-bright); margin-bottom:40px; text-shadow: 0 0 20px var(--amethyst-bright);">SOLO</h1>
                    <div id="mode-selection">
                        <button class="main-btn" onclick="showModeSelection('single')">VS BOT</button>
                        <button class="sec-btn" onclick="showModeSelection('multi')">MULTIPLAYER</button>
                    </div>
                </div>
            </div>

            <div style="padding:20px; display:flex; justify-content:space-between; width:100%; position:absolute; z-index:100;">
                <button id="exit-game" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; color:white; padding:10px 20px; border-radius:12px;">ESCI</button>
                <div id="turn-indicator" style="font-weight:900; color:var(--amethyst-bright); background:rgba(0,0,0,0.6); padding: 8px 20px; border-radius: 30px; letter-spacing:1.5px;"></div>
                <div style="width:80px;"></div>
            </div>

            <div id="bot-top" class="bot-pos" style="top:40px; left:50%; transform:translateX(-50%);"></div>
            <div id="bot-left" class="bot-pos" style="top:50%; left:30px; transform:translateY(-50%) rotate(90deg);"></div>
            <div id="bot-right" class="bot-pos" style="top:50%; right:30px; transform:translateY(-50%) rotate(-90deg);"></div>

            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
                <div id="dir-icon" style="font-size:30px; margin-bottom:10px; opacity:0.3; transition:0.5s;"></div>
                <div style="display:flex; gap:40px; align-items:center; justify-content:center; margin-bottom:30px;">
                    <div id="deck-element" onclick="playerDrawCard()" style="width:85px; height:125px; background:linear-gradient(135deg, #331155, #110522); border:2.5px solid var(--amethyst-bright); border-radius:15px; cursor:pointer; box-shadow: 0 10px 30px rgba(0,0,0,0.8);"></div>
                    <div id="discard-card" class="solo-card" style="width:95px; height:135px; cursor:default; transform:rotate(5deg);"></div>
                </div>
                <div id="color-info" style="font-size:12px; letter-spacing:3px; background:rgba(0,0,0,0.6); padding:10px 20px; border-radius:30px; border: 1px solid rgba(255,255,255,0.1);">
                    COLORE: <span id="current-color-txt" style="font-weight:900;"></span>
                </div>
            </div>

            <div id="player-hand-container" class="bot-pos" style="bottom:70px; left:50%; transform:translateX(-50%); width: 95%; justify-content:center;">
                <div id="player-hand" style="display:flex; justify-content:center; width: 100%;"></div>
            </div>

            <div style="position:absolute; bottom:20px; width:100%; text-align:center;">
                <button onclick="callSolo()" style="background:#ff4444; color:white; padding:12px 60px; border-radius:50px; font-weight:900; border:none; cursor:pointer; box-shadow: 0 0 20px rgba(255,68,68,0.4);">SOLO!</button>
            </div>

            <div id="color-picker-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:3000; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:30px;">
                    <div onclick="selectWildColor('rosso')" style="width:90px; height:90px; background:#ff4444; border-radius:25px; cursor:pointer;"></div>
                    <div onclick="selectWildColor('blu')" style="width:90px; height:90px; background:#0066ff; border-radius:25px; cursor:pointer;"></div>
                    <div onclick="selectWildColor('verde')" style="width:90px; height:90px; background:#33cc33; border-radius:25px; cursor:pointer;"></div>
                    <div onclick="selectWildColor('giallo')" style="width:90px; height:90px; background:#ffcc00; border-radius:25px; cursor:pointer;"></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('exit-game').onclick = () => {
        const h = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
        if (h) h.style.display = 'flex';
        showLobby(container);
    };
}

function renderGameView() {
    if (!gameState.gameActive) return;
    document.getElementById('turn-indicator').innerText = ["TUO TURNO", "BOT 1", "BOT 2", "BOT 3"][gameState.turn];
    document.getElementById('dir-icon').innerText = gameState.direction === 1 ? "⟳" : "⟲";
    
    const containers = ['player-hand-container', 'bot-top', 'bot-left', 'bot-right'];
    containers.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) idx === gameState.turn ? el.classList.add('active-turn') : el.classList.remove('active-turn');
    });

    const lastCard = gameState.discardPile[gameState.discardPile.length - 1];
    if (lastCard) {
        const d = document.getElementById('discard-card');
        d.style.background = getHex(lastCard.color);
        d.innerHTML = `<span style="color:${['blu','rosso','wild'].includes(lastCard.color) ? 'white' : '#1a0a2a'}">${getSymbol(lastCard.value)}</span>`;
    }
    document.getElementById('current-color-txt').innerText = gameState.currentColor.toUpperCase();
    document.getElementById('current-color-txt').style.color = getHex(gameState.currentColor === 'wild' ? 'rosso' : gameState.currentColor);

    const rb = (id, pi) => {
        const el = document.getElementById(id); if (!el) return;
        const c = gameState.players[pi].length;
        el.innerHTML = Array.from({length: Math.min(c, 5)}).map((_,i) => `<div class="solo-card bot-back" style="width:35px; height:50px; margin-left:-18px; z-index:${i}"></div>`).join('') + `<span style="font-size:14px; margin-left:15px; font-weight:900;">${c}</span>`;
    };
    rb('bot-top', 1); rb('bot-left', 2); rb('bot-right', 3);

    const hand = document.getElementById('player-hand');
    if (hand) {
        hand.innerHTML = gameState.players[0].map((card, i) => {
            const p = canPlay(card) && gameState.turn === 0 && !isAnimating;
            return `<div onclick="playerPlayCard(${i})" class="solo-card ${p ? 'playable' : ''}" style="background:${getHex(card.color)}; margin-left:-25px; z-index:${i}; opacity:${gameState.turn === 0 ? 1 : 0.6}"><span>${getSymbol(card.value)}</span></div>`;
        }).join('');
    }
}

function getHex(c) { return { rosso:'#ff4444', giallo:'#ffcc00', verde:'#33cc33', blu:'#0066ff', wild:'linear-gradient(135deg, #ff4444, #0066ff, #33cc33, #ffcc00)' }[c] || '#333'; }
function getSymbol(v) { return { cambio_giro:'🔄', salta_turno:'🚫', piu_due:'+2', cambio_colore:'🎨', piu_quattro:'+4' }[v] || v; }
