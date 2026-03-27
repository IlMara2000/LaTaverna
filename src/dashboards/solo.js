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
let isAnimating = false;

export function initSoloGame(container) {
    gameContainer = container;
    updateSidebarContext("home"); 
    
    // Nascondi l'hamburger menu (sidebar trigger)
    const hamburger = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (hamburger) hamburger.style.display = 'none';

    renderLayout(container);
}

// --- LOGICA DI SETUP E ANIMAZIONI ---

window.showModeSelection = function(mode) {
    document.getElementById('mode-selection').style.display = 'none';
    if (mode === 'single') {
        startGame();
    } else {
        document.getElementById('multiplayer-ui').style.display = 'block';
    }
}

window.backToModeSelection = function() {
    document.getElementById('multiplayer-ui').style.display = 'none';
    document.getElementById('mode-selection').style.display = 'block';
}

window.mockMultiplayer = function() {
    alert("🛠️ I server Multiplayer sono in costruzione! Questa interfaccia è pronta per essere collegata a Firebase/Socket.io. Nel frattempo, gioca VS Bot!");
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

// Distribuzione con animazione rapida iniziale
function fastInitialDeal(onComplete) {
    gameState.players = Array.from({ length: gameState.numPlayers }, () => []);
    let cardsDealt = 0;
    const totalCards = 7 * gameState.numPlayers;
    
    // Animazione a raffica
    let interval = setInterval(() => {
        let pIdx = cardsDealt % gameState.numPlayers;
        gameState.players[pIdx].push(drawCardSync());
        animateCardDeal(pIdx, 0.15); // volo veloce
        renderGameView();
        
        cardsDealt++;
        if (cardsDealt >= totalCards) {
            clearInterval(interval);
            setTimeout(() => {
                // Prima carta al centro
                let firstCard;
                do {
                    firstCard = drawCardSync();
                    if (firstCard.type === 'wild') gameState.deck.push(firstCard);
                } while (firstCard.type === 'wild');
                
                gameState.discardPile.push(firstCard);
                gameState.currentColor = firstCard.color;
                gameState.currentValue = firstCard.value;
                renderGameView();
                onComplete();
            }, 500);
        }
    }, 120);
}

// Funzione core per far volare le carte dal deck al giocatore
function animateCardDeal(targetIndex, duration = 0.4, callback = null) {
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
    flyingCard.style.transitionDuration = `${duration}s`;
    document.body.appendChild(flyingCard);

    // Forza il reflow del browser
    flyingCard.getBoundingClientRect();

    // Sposta la carta verso il centro del bersaglio
    flyingCard.style.left = `${targetRect.left + (targetRect.width / 2) - 30}px`;
    flyingCard.style.top = `${targetRect.top + (targetRect.height / 2) - 45}px`;
    flyingCard.style.transform = `scale(0.5) rotate(${Math.random() * 60 - 30}deg)`;
    flyingCard.style.opacity = '0';

    setTimeout(() => {
        if (document.body.contains(flyingCard)) document.body.removeChild(flyingCard);
        if (callback) callback();
    }, duration * 1000);
}

// --- LOGICA DEI TURNI ---

function startTurn() {
    renderGameView();
    if (gameState.players[gameState.turn].length === 0) {
        endGame(gameState.turn === 0 ? "HAI VINTO!" : `HA VINTO IL BOT ${gameState.turn}!`);
        return;
    }
    if (gameState.turn !== 0) setTimeout(botPlay, 1500);
}

window.playerPlayCard = function(cardIndex) {
    if (gameState.turn !== 0 || !gameState.gameActive || gameState.forcedColorChange || isAnimating) return;
    const card = gameState.players[0][cardIndex];
    if (canPlay(card)) {
        gameState.players[0].splice(cardIndex, 1);
        handleCardEffects(card);
        
        if (gameState.players[0].length === 1 && !gameState.hasCalledSolo) {
            alert("⚠️ Non hai chiamato SOLO! Peschi 2 carte.");
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
    animateCardDeal(0, 0.4, () => {
        gameState.players[0].push(drawCardSync());
        gameState.hasCalledSolo = false;
        isAnimating = false;
        nextTurn();
    });
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
        isAnimating = true;
        animateCardDeal(pIdx, 0.4, () => {
            gameState.players[pIdx].push(drawCardSync());
            isAnimating = false;
            nextTurn();
        });
    }
}

function handleCardEffects(card) {
    gameState.discardPile.push(card);
    gameState.currentValue = card.value;
    if (card.color !== 'wild') gameState.currentColor = card.color;

    switch (card.value) {
        case 'cambio_giro': case 'salta_turno': nextTurn(true); break;
        case 'piu_due':
            penalizePlayer((gameState.turn + 1) % gameState.numPlayers, 2);
            nextTurn(true); break;
        case 'piu_quattro':
            penalizePlayer((gameState.turn + 1) % gameState.numPlayers, 4);
            if (gameState.turn === 0) showColorPicker();
            nextTurn(true); break;
        case 'cambio_colore': if (gameState.turn === 0) showColorPicker(); break;
    }
}

function penalizePlayer(pIdx, amount) {
    isAnimating = true;
    let count = 0;
    let intv = setInterval(() => {
        animateCardDeal(pIdx, 0.3, () => {
            gameState.players[pIdx].push(drawCardSync());
            renderGameView();
        });
        count++;
        if (count >= amount) {
            clearInterval(intv);
            setTimeout(() => { isAnimating = false; }, 400);
        }
    }, 200);
}

function canPlay(card) { return card.type === 'wild' || card.color === gameState.currentColor || card.value === gameState.currentValue; }
function nextTurn(skip = false) { if (!gameState.gameActive) return; gameState.turn = (gameState.turn + (skip ? 2 : 1)) % gameState.numPlayers; startTurn(); }

function drawCardSync() {
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

// --- RENDERIZZAZIONE ---

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
            .bot-pos { position: absolute; display: flex; gap: 5px; align-items: center; padding: 10px; transition: 0.3s; border-radius: 15px; }
            
            /* Glow per il giocatore attivo */
            .active-turn { 
                box-shadow: 0 0 25px 5px var(--amethyst-bright); 
                background: rgba(157, 78, 221, 0.1); 
            }
            
            /* Animazione Carta Volante */
            .flying-card {
                position: fixed; width: 60px; height: 90px; border-radius: 8px;
                background: linear-gradient(135deg, #331155, #110522);
                border: 2px solid var(--amethyst-bright);
                z-index: 9999; pointer-events: none;
                transition-property: top, left, transform, opacity;
                transition-timing-function: cubic-bezier(0.25, 0.8, 0.25, 1);
            }

            .main-btn {
                background: var(--amethyst-bright); color: black; border: none; padding: 15px 30px; 
                border-radius: 50px; font-weight: 900; cursor: pointer; transition: 0.3s; box-shadow: 0 0 20px rgba(157, 78, 221, 0.4);
                display: block; width: 100%; margin-bottom: 15px; text-transform: uppercase;
            }
            .main-btn:hover { transform: scale(1.05); }
            .sec-btn {
                background: rgba(255,255,255,0.05); color: white; border: 1px solid rgba(255,255,255,0.2); 
                padding: 15px 30px; border-radius: 50px; font-weight: 800; cursor: pointer; transition: 0.3s;
                display: block; width: 100%; margin-bottom: 15px;
            }
            .input-room {
                width: 100%; padding: 15px; border-radius: 12px; border: 1px solid var(--amethyst-bright);
                background: rgba(0,0,0,0.5); color: white; text-align: center; margin-bottom: 15px; font-weight: 900; letter-spacing: 2px; outline: none;
            }
        </style>

        <div class="fade-in" style="width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white;">
            
            <div id="start-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:2000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
                <div style="text-align:center; max-width: 350px; width: 90%;">
                    <h1 style="font-size:4rem; font-weight:900; letter-spacing:5px; color:var(--amethyst-bright); margin-bottom:10px;">SOLO</h1>
                    <p style="opacity:0.5; font-size:12px; margin-bottom: 40px; letter-spacing:2px;">LA SFIDA ALL'ULTIMA CARTA</p>
                    
                    <div id="mode-selection">
                        <button class="main-btn" onclick="showModeSelection('single')">Gioca VS Bot (1v3)</button>
                        <button class="sec-btn" onclick="showModeSelection('multi')">Multigiocatore Online</button>
                    </div>

                    <div id="multiplayer-ui" style="display:none; text-align: left;">
                        <input type="text" id="room-code-input" class="input-room" placeholder="CODICE STANZA (es. 1A2B)" maxlength="6">
                        <button class="main-btn" onclick="mockMultiplayer()">Unisciti alla partita</button>
                        <div style="text-align:center; margin: 15px 0; opacity:0.5; font-size:12px;">OPPURE</div>
                        <button class="sec-btn" onclick="mockMultiplayer()" style="color:var(--amethyst-bright); border-color:var(--amethyst-bright);">Crea nuova Stanza</button>
                        <button onclick="backToModeSelection()" style="background:none; border:none; color:white; opacity:0.5; width:100%; cursor:pointer; margin-top:10px;">← Torna indietro</button>
                    </div>
                </div>
            </div>

            <div style="padding:20px; display:flex; justify-content:space-between; width:100%; position:absolute; z-index:100;">
                <button id="exit-game" style="background:rgba(255,68,68,0.2); border:1px solid #ff4444; color:white; padding:8px 15px; border-radius:10px; cursor:pointer; font-size:10px;">ESCI</button>
                <div id="turn-indicator" style="font-weight:900; letter-spacing:2px; text-transform:uppercase; color:var(--amethyst-bright); background:rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 20px;"></div>
                <div style="width:80px;"></div>
            </div>

            <div id="bot-top" class="bot-pos" style="top:60px; left:50%; transform:translateX(-50%);"></div>
            <div id="bot-left" class="bot-pos" style="top:50%; left:10px; transform:translateY(-50%) rotate(90deg);"></div>
            <div id="bot-right" class="bot-pos" style="top:50%; right:10px; transform:translateY(-50%) rotate(-90deg);"></div>

            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
                <div style="display:flex; gap:30px; align-items:center; justify-content:center; margin-bottom:20px;">
                    <div id="deck-element" onclick="playerDrawCard()" style="width:80px; height:120px; background:linear-gradient(135deg, #331155, #110522); border:2px solid var(--amethyst-bright); border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; transform:rotate(-5deg); box-shadow: 0 10px 20px rgba(0,0,0,0.5);">
                        <span style="font-size:10px; font-weight:900; color:var(--amethyst-bright);">DECK</span>
                    </div>
                    <div id="discard-card" class="solo-card" style="width:90px; height:130px; cursor:default; transform:rotate(3deg);"></div>
                </div>
                <div id="color-info" style="font-size:11px; letter-spacing:2px; background:rgba(0,0,0,0.5); padding:8px 15px; border-radius:20px; display:inline-block; border:1px solid rgba(255,255,255,0.1);">
                    COLORE: <span id="current-color-txt" style="font-weight:900;"></span>
                </div>
            </div>

            <div id="player-hand-container" class="bot-pos" style="bottom:90px; left:50%; transform:translateX(-50%); width: 90%; justify-content:center;">
                <div id="player-hand" style="display:flex; justify-content:center; align-items:center; width: 100%;"></div>
            </div>

            <div style="position:absolute; bottom:20px; width:100%; display:flex; justify-content:space-around; align-items:center; padding:0 20px;">
                <button onclick="callSolo()" style="background:#ff4444; border:none; color:white; padding:12px 40px; border-radius:50px; font-weight:900; cursor:pointer; box-shadow:0 0 20px rgba(255,68,68,0.4); letter-spacing:2px;">SOLO!</button>
            </div>

            <div id="color-picker-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:3000; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
                <div style="text-align:center;">
                    <h3 style="margin-bottom:20px; letter-spacing:3px;">SCEGLI COLORE</h3>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                        <div onclick="selectWildColor('rosso')" style="width:80px; height:80px; background:#ff4444; border-radius:20px; cursor:pointer; box-shadow:0 0 20px rgba(255,68,68,0.5);"></div>
                        <div onclick="selectWildColor('blu')" style="width:80px; height:80px; background:#0066ff; border-radius:20px; cursor:pointer; box-shadow:0 0 20px rgba(0,102,255,0.5);"></div>
                        <div onclick="selectWildColor('verde')" style="width:80px; height:80px; background:#33cc33; border-radius:20px; cursor:pointer; box-shadow:0 0 20px rgba(51,204,51,0.5);"></div>
                        <div onclick="selectWildColor('giallo')" style="width:80px; height:80px; background:#ffcc00; border-radius:20px; cursor:pointer; box-shadow:0 0 20px rgba(255,204,0,0.5);"></div>
                    </div>
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

    // Turno: Evidenzia il div corretto
    const turnTxt = ["TUO TURNO", "BOT 1", "BOT 2", "BOT 3"];
    document.getElementById('turn-indicator').innerText = turnTxt[gameState.turn];
    
    // Assegna la classe 'active-turn' a chi sta giocando per il bagliore
    const containers = ['player-hand-container', 'bot-top', 'bot-left', 'bot-right'];
    containers.forEach((id, idx) => {
        const el = document.getElementById(id);
        if (el) {
            if (gameState.turn === idx) el.classList.add('active-turn');
            else el.classList.remove('active-turn');
        }
    });

    // Discard
    const lastCard = gameState.discardPile[gameState.discardPile.length - 1];
    if (lastCard) {
        const discardDiv = document.getElementById('discard-card');
        discardDiv.style.background = getHex(lastCard.color);
        discardDiv.innerHTML = `<span style="color:${['blu','rosso','wild'].includes(lastCard.color) ? 'white' : '#1a0a2a'}">${getSymbol(lastCard.value)}</span>`;
    }
    
    document.getElementById('current-color-txt').innerText = gameState.currentColor.toUpperCase();
    document.getElementById('current-color-txt').style.color = getHex(gameState.currentColor === 'wild' ? 'rosso' : gameState.currentColor);

    // Render Bots
    const renderBot = (id, playerIdx) => {
        const el = document.getElementById(id);
        if (!el) return;
        const count = gameState.players[playerIdx].length;
        el.innerHTML = Array.from({ length: Math.min(count, 5) }).map((_, i) => `<div class="solo-card bot-back" style="width:30px; height:45px; margin-left:-15px; z-index:${i};"></div>`).join('') + 
                       `<span style="font-size:12px; margin-left:10px; font-weight:900;">${count}</span>`;
    };
    renderBot('bot-top', 1);
    renderBot('bot-left', 2);
    renderBot('bot-right', 3);

    // Player Hand
    const handDiv = document.getElementById('player-hand');
    if (handDiv) {
        handDiv.innerHTML = gameState.players[0].map((card, i) => {
            const playable = canPlay(card) && gameState.turn === 0 && !isAnimating;
            return `
                <div onclick="playerPlayCard(${i})" class="solo-card ${playable ? 'playable' : ''}" 
                     style="background:${getHex(card.color)}; margin-left:-20px; z-index:${i}; opacity:${gameState.turn === 0 ? 1 : 0.7}">
                     <span style="color:${['blu','rosso','wild'].includes(card.color) ? 'white' : '#1a0a2a'}">${getSymbol(card.value)}</span>
                </div>
            `;
        }).join('');
    }
}

function getHex(c) { 
    return { rosso:'#ff4444', giallo:'#ffcc00', verde:'#33cc33', blu:'#0066ff', wild:'linear-gradient(135deg, #ff4444, #0066ff, #33cc33, #ffcc00)' }[c] || '#333'; 
}

function getSymbol(v) { 
    return { cambio_giro:'🔄', salta_turno:'🚫', piu_due:'+2', cambio_colore:'🎨', piu_quattro:'+4' }[v] || v; 
}
