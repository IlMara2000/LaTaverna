/**
 * SoloGame.js - Una versione personalizzata del classico gioco di carte UNO.
 * Nome: "Solo - La Sfida"
 * Regole incluse: Ufficiali (con bottoncino info)
 */

// Costanti di Gioco
const COLORS = ['rosso', 'giallo', 'verde', 'blu'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'cambio_giro', 'salta_turno', 'piu_due'];
const SPECIALS = ['cambio_colore', 'piu_quattro'];

// Stato del Gioco
let gameState = {
    deck: [],
    discardPile: [],
    players: [], // [0] Umano, [1] Bot
    turn: 0,
    direction: 1, // 1 orario, -1 antiorario (non usato in 2 player ma presente per regole)
    currentColor: '',
    currentValue: '',
    gameActive: false,
    forcedColorChange: false, // Per carte Jolly
    hasCalledSolo: false // Per la regola del "SOLO"
};

const uiContainer = document.getElementById('ui'); // Assumiamo che ci sia un container principale

// --- INIZIALIZZAZIONE ---
export function initSoloGame(container) {
    gameState.gameActive = true;
    renderLayout(container);
    setupDeck();
    dealCards();
    startTurn();
}

// --- LOGICA DI GIOCO ---

function setupDeck() {
    gameState.deck = [];
    // Carte colorate
    COLORS.forEach(color => {
        // Un '0' per colore
        gameState.deck.push({ color, value: '0', type: 'number' });
        // Due carte per 1-9 e speciali colorate
        for (let i = 0; i < 2; i++) {
            VALUES.slice(1).forEach(value => {
                let type = isNaN(value) ? 'action' : 'number';
                gameState.deck.push({ color, value, type });
            });
        }
    });
    // Carte Speciali (Jolly)
    SPECIALS.forEach(value => {
        for (let i = 0; i < 4; i++) {
            gameState.deck.push({ color: 'wild', value, type: 'wild' });
        }
    });
    shuffle(gameState.deck);
}

function dealCards() {
    gameState.players = [[], []]; // Mano Umano, Mano Bot
    for (let i = 0; i < 7; i++) {
        gameState.players[0].push(drawCard());
        gameState.players[1].push(drawCard());
    }
    // Prima carta sullo scarto (non speciale)
    let firstCard;
    do {
        firstCard = drawCard();
        if (firstCard.type === 'wild') gameState.deck.push(firstCard); // Rimettila dentro se Jolly
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

    if (gameState.turn === 1) {
        // Turno del Bot
        setTimeout(botPlay, 1500);
    }
}

// --- AZIONI GIOCATORE ---

window.playerPlayCard = function(cardIndex) {
    if (gameState.turn !== 0 || !gameState.gameActive || gameState.forcedColorChange) return;

    const card = gameState.players[0][cardIndex];
    if (canPlay(card)) {
        gameState.players[0].splice(cardIndex, 1); // Rimuovi dalla mano
        handleCardEffects(card);
        
        // Regola SOLO: se hai 1 carta e non l'hai chiamato prima di giocare
        if (gameState.players[0].length === 1 && !gameState.hasCalledSolo) {
            alert("⚠️ Non hai chiamato SOLO! Peschi 2 carte.");
            gameState.players[0].push(drawCard());
            gameState.players[0].push(drawCard());
        }
        gameState.hasCalledSolo = false; // Resetta chiamata

        if (!gameState.forcedColorChange) nextTurn();
    } else {
        alert("Mossa non valida!");
    }
}

window.playerDrawCard = function() {
    if (gameState.turn !== 0 || !gameState.gameActive) return;
    const drawn = drawCard();
    gameState.players[0].push(drawn);
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

// --- LOGICA BOT (AI Semplice) ---
function botPlay() {
    if (!gameState.gameActive) return;
    
    let playable = [];
    gameState.players[1].forEach((card, index) => {
        if (canPlay(card)) playable.push(index);
    });

    if (playable.length > 0) {
        // Priorità carte azione/wild
        playable.sort((a,b) => {
            let typeA = gameState.players[1][a].type;
            let typeB = gameState.players[1][b].type;
            if (typeA === 'wild') return -1;
            if (typeA === 'action' && typeB === 'number') return -1;
            return 1;
        });

        let chosenIndex = playable[0];
        const card = gameState.players[1][chosenIndex];
        
        // Simula chiamata SOLO del bot
        if (gameState.players[1].length === 2) {
            console.log("📢 BOT CHIAMA SOLO!");
        }

        gameState.players[1].splice(chosenIndex, 1);
        handleCardEffects(card);

        // Se Jolly, sceglie colore più frequente
        if (card.type === 'wild') {
            const counts = {};
            gameState.players[1].forEach(c => counts[c.color] = (counts[c.color] || 0) + 1);
            gameState.currentColor = COLORS.reduce((a, b) => counts[a] > counts[b] ? a : b);
            console.log(`🤖 Bot ha scelto colore: ${gameState.currentColor.toUpperCase()}`);
        }
        if (!gameState.forcedColorChange) nextTurn();
    } else {
        gameState.players[1].push(drawCard());
        nextTurn();
    }
}

// --- HELPER LOGICA ---

function handleCardEffects(card) {
    gameState.discardPile.push(card);
    gameState.currentValue = card.value;
    if (card.color !== 'wild') gameState.currentColor = card.color;

    switch (card.value) {
        case 'cambio_giro': // In 2 player, salta il turno
        case 'salta_turno':
            nextTurn(true); // Flag skip
            break;
        case 'piu_due':
            for (let i=0; i<2; i++) gameState.players[gameState.turn === 0 ? 1 : 0].push(drawCard());
            nextTurn(true); // Flag skip (chi subisce il +2 salta turno)
            break;
        case 'piu_quattro':
            for (let i=0; i<4; i++) gameState.players[gameState.turn === 0 ? 1 : 0].push(drawCard());
            // Il Jolly forza cambio colore
            if (gameState.turn === 0) showColorPicker();
            nextTurn(true); // Flag skip
            break;
        case 'cambio_colore':
            if (gameState.turn === 0) showColorPicker();
            break;
        default: break; // Carte numero standard
    }
}

function canPlay(card) {
    if (card.type === 'wild') return true;
    return card.color === gameState.currentColor || card.value === gameState.currentValue;
}

function nextTurn(skip = false) {
    if (!gameState.gameActive) return;
    const increment = skip ? 2 : 1;
    gameState.turn = (gameState.turn + increment) % 2;
    startTurn();
}

function drawCard() {
    if (gameState.deck.length === 0) {
        const topCard = gameState.discardPile.pop();
        gameState.deck = gameState.discardPile;
        gameState.discardPile = [topCard];
        shuffle(gameState.deck);
    }
    return gameState.deck.pop();
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function endGame(message) {
    gameState.gameActive = false;
    alert(`🏆 GIOCO FINITO! ${message}`);
    // Qui puoi mettere logica per tornare alla lobby
}

// --- RENDER UI (Stile Ametista) ---

function renderLayout(container) {
    container.innerHTML = `
        <div id="solo-game" style="width:100%; height:100vh; position:relative; overflow:hidden; background:#05020a; color:white; font-family:sans-serif;">
            
            <div id="game-status" style="position:absolute; top:20px; left:20px; text-transform:uppercase; letter-spacing:1px; color:var(--amethyst-bright);"></div>

            <div id="bot-hand" style="position:absolute; top:20px; right:20px; display:flex; gap:5px;"></div>

            <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); display:flex; gap:20px; align-items:center;">
                <div id="deck-pile" onclick="playerDrawCard()" style="width:80px; height:120px; background:linear-gradient(135deg, #1a0a2a, #0a020f); border:2px solid #333; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center;">Solo</div>
                <div id="discard-card" style="width:100px; height:150px; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 0 20px rgba(157, 78, 221, 0.3);"></div>
                <div style="font-size:12px; text-transform:uppercase; opacity:0.6; display:flex; flex-direction:column; gap:5px;">
                    <div>Colore: <span id="current-color" style="font-weight:bold;"></span></div>
                    <div>Ultima: <span id="current-value"></span></div>
                </div>
            </div>

            <div id="player-hand" style="position:absolute; bottom:120px; left:50%; transform:translateX(-50%); display:flex; gap:-15px; padding: 0 40px; width:90%; justify-content:center;"></div>

            <div style="position:absolute; bottom:20px; right:20px; display:flex; gap:10px;">
                <button onclick="callSolo()" style="background:#ff4444; color:white; border:none; padding:15px 30px; border-radius:12px; font-weight:900; cursor:pointer; box-shadow:0 0 10px rgba(255,68,68,0.3);">SOLO!</button>
            </div>

            <button id="rules-btn" onclick="toggleRules()" style="position:absolute; bottom:20px; left:20px; background:rgba(255,255,255,0.05); color:white; border:1px solid rgba(255,255,255,0.1); padding:10px 15px; border-radius:8px; cursor:pointer; font-size:11px;">REGOLE</button>

            <div id="color-picker-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; align-items:center; justify-content:center; backdrop-filter:blur(5px);">
                <div style="background:#0a020f; border:1px solid var(--amethyst); padding:30px; border-radius:20px; text-align:center;">
                    <h3 style="margin-top:0;">SCEGLI UN COLORE</h3>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:20px;">
                        ${COLORS.map(c => `<div onclick="selectWildColor('${c}')" style="width:60px; height:60px; background:${getHex(c)}; border-radius:10px; cursor:pointer;"></div>`).join('')}
                    </div>
                </div>
            </div>

            <div id="rules-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; overflow-y:auto; padding:30px; backdrop-filter:blur(10px);">
                <button onclick="toggleRules()" style="position:fixed; top:20px; right:20px; background:rgba(255,68,68,0.1); border:1px solid #ff4444; color:#ff4444; padding:5px 10px; border-radius:5px; cursor:pointer;">X CHIUDI</button>
                <div style="max-width:600px; margin: 40px auto; line-height:1.6; color:rgba(255,255,255,0.8);">
                    <h1 style="color:var(--amethyst-bright); margin-top:0;">"SOLO - LA SFIDA"</h1>
                    <h3 style="color:#ff4444;">Lo Scopo del Gioco</h3>
                    <p>Rimanere senza carte in mano. Il primo a farlo vince la manche. La partita si gioca a 2 giocatori.</p>
                    
                    <h3 style="color:#ff4444;">Come Giocare</h3>
                    <p>Ad ogni turno, devi giocare una carta dalla tua mano che corrisponda per <strong>Colore</strong> o <strong>Numero/Simbolo</strong> alla carta in cima al mazzo degli scarti.</p>
                    <p>Se non hai carte giocabili, devi pescarne una dal mazzo centrale. Se la carta pescata è giocabile, puoi giocarla subito, altrimenti il turno passa.</p>

                    <h3 style="color:#ff4444;">Carte Speciali Colorate</h3>
                    <ul>
                        <li><strong>🔄 Cambio Giro/Skip:</strong> In 2 giocatori, impedisce all'avversario di giocare per un turno.</li>
                        <li><strong>🚫 Salta Turno:</strong> L'avversario salta il turno.</li>
                        <li><strong>+2 (Più Due):</strong> L'avversario pescherà 2 carte e salterà il turno.</li>
                    </ul>

                    <h3 style="color:#ff4444;">Carte Speciali Jolly (Nere)</h3>
                    <ul>
                        <li><strong>🎨 Cambio Colore:</strong> Può essere giocata su qualsiasi carta. Ti permette di scegliere il colore attivo.</li>
                        <li><strong>+4 (Più Quattro):</strong> Può essere giocata su qualsiasi carta. L'avversario pescherà 4 carte, salterà il turno, e tu sceglierai il colore attivo.</li>
                    </ul>

                    <h3 style="color:#ff4444;">La Regola del "SOLO"</h3>
                    <p style="background:rgba(157,78,221,0.1); padding:15px; border-radius:10px; border:1px solid var(--amethyst-glow);">
                        Quando giochi la tua penultima carta (e quindi ti rimane solo UNA carta in mano), devi premere il pulsante <strong>SOLO!</strong> PRIMA che la carta scartata tocchi il mazzo.<br><br>
                        Se non lo fai e l'avversario se ne accorge (nel gioco contro il bot è automatico), pescherai 2 carte di penalità.
                    </p>
                </div>
            </div>
        </div>
    `;
}

function renderGameView() {
    // Status
    document.getElementById('game-status').innerText = gameState.turn === 0 ? "⚠️ TUO TURNO" : "🤖 BOT STA GIOCANDO...";
    
    // Pile centrali
    const discardCard = gameState.discardPile[gameState.discardPile.length - 1];
    const discardDiv = document.getElementById('discard-card');
    discardDiv.style.background = getHex(discardCard.color);
    discardDiv.innerHTML = `<span style="font-size:4rem; font-weight:900; color:${discardCard.color === 'blu' || discardCard.color === 'rosso' ? 'white' : 'black'}">${getSymbol(discardCard.value)}</span>`;
    
    document.getElementById('current-color').innerText = gameState.currentColor.toUpperCase();
    document.getElementById('current-color').style.color = getHex(gameState.currentColor);
    document.getElementById('current-value').innerText = getSymbol(gameState.currentValue);

    // Mano Bot (Semplice conteggio)
    document.getElementById('bot-hand').innerHTML = gameState.players[1].map(() => `
        <div style="width:25px; height:40px; background:#1a0a2a; border-radius:4px; border:1px solid rgba(255,255,255,0.1);"></div>
    `).join('') + `<span style="opacity:0.5; font-size:12px; margin-left:5px;">${gameState.players[1].length}</span>`;

    // Mano Player
    const handDiv = document.getElementById('player-hand');
    handDiv.innerHTML = gameState.players[0].map((card, index) => {
        const playable = canPlay(card);
        const margin = gameState.players[0].length > 10 ? '-40px' : '-10px';
        return `
            <div onclick="playerPlayCard(${index})" style="
                width:80px; height:120px; background:${getHex(card.color)}; 
                border-radius:10px; margin-left:${margin}; cursor:pointer; 
                display:flex; align-items:center; justify-content:center; font-weight:900; 
                border: 2px solid ${playable ? 'var(--amethyst-bright)' : 'black'};
                box-shadow: ${playable ? '0 0 15px var(--amethyst-glow)' : 'none'};
                transition: transform 0.2s;
                transform: translateY(${playable ? '0px' : '30px'});
                opacity: ${playable || gameState.turn !== 0 ? '1' : '0.5'};
                position:relative;
            ">
                <span style="font-size:2rem; color:${card.color === 'blu' || card.color === 'rosso' || card.color === 'wild' ? 'white' : 'black'}">${getSymbol(card.value)}</span>
            </div>
        `;
    }).join('');
}

function showColorPicker() {
    gameState.forcedColorChange = true;
    document.getElementById('color-picker-modal').style.display = 'flex';
}

window.toggleRules = function() {
    const overlay = document.getElementById('rules-overlay');
    overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
}

// Helper Visivi

function getHex(color) {
    switch (color) {
        case 'rosso': return '#ff4444';
        case 'giallo': return '#ffcc00';
        case 'verde': return '#33cc33';
        case 'blu': return '#0066ff';
        case 'wild': return 'linear-gradient(135deg, #ff4444, #0066ff, #33cc33)';
        default: return '#333';
    }
}

function getSymbol(value) {
    switch (value) {
        case 'cambio_giro': return '🔄';
        case 'salta_turno': return '🚫';
        case 'piu_due': return '+2';
        case 'cambio_colore': return '🎨';
        case 'piu_quattro': return '+4';
        default: return value;
    }
}
