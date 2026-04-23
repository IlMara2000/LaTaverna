import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { getUnlockedLevel, unlockNextLevel, renderLevelLadder } from '../../services/levels.js';

/**
 * GIOCO: SOLO - MASTER EDITION (Responsive & Matte Black)
 * Integrazione Scala Livelli + Carte Premium + Regola "SOLO!"
 */

const COLORS = ['red', 'blue', 'green', 'yellow'];

// Colori vibranti per contrastare il Matte Black
const getHex = (color) => {
    const hex = { red: '#ff4444', blue: '#00d2ff', green: '#00ffa3', yellow: '#ffbd39', wild: '#ffffff' };
    return hex[color] || '#ffffff';
};

// Icone ed Emoji per le carte speciali
const getIcon = (val) => {
    const symbols = { 'SKIP': '🚫', 'REV': '🔄', '+2': '✌️', 'WILD': '🌈', '+4': '✨' };
    return symbols[val] || val;
};

export function initSoloGame(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    // BLOCCO SCROLL GLOBALE
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none'; 
    window.scrollTo(0, 0);
    
    let state = {
        deck: [], discardPile: [], players: [[], [], [], []], 
        turn: 0, direction: 1, currentColor: '', currentVal: '',
        gameActive: false, isAnimating: false,
        drawnCardThisTurn: false,
        currentLevel: 1,
        // Nuove variabili per la regola "SOLO!"
        playerSaidSolo: false,
        catchableBots: [] 
    };

    renderLayout(container, state);
}

const quitGame = async (container) => {
    document.body.style.touchAction = '';
    document.body.style.overflowY = 'auto';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) { window.location.reload(); }
};

// --- 1. LAYOUT PRINCIPALE ---
function renderLayout(container, state) {
    container.innerHTML = `
    <div class="game-master-wrapper fade-in">
        
        <div id="start-screen" class="game-master-wrapper" style="position: absolute; inset: 0; z-index: 10000; justify-content: center; background: #05010a;">
            <img src="/assets/logo.png" style="width: 100px; margin-bottom: 25px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 10px;">SOLO</h1>
            <p style="color: var(--amethyst-light); font-size: 11px; font-weight: 800; letter-spacing: 2px; margin-bottom: 30px;">SELEZIONA IL LIVELLO</p>
            
            <div id="levels-container" style="display: flex; flex-direction: column; width: 100%; max-width: 280px; max-height: 250px; overflow-y: auto; padding: 10px; margin-bottom: 20px;">
                </div>

            <button id="exit-btn" class="game-btn-action" style="background: transparent; border: none; margin-top: 15px; opacity: 0.6;">TORNA ALLA TAVERNA</button>
        </div>

        <header class="game-master-header">
            <button class="game-btn-action" id="btn-exit-ingame" style="padding: 10px 20px;">← ESCI</button>
            <div id="turn-indicator" class="game-turn-indicator white-turn" style="font-size: 13px; text-transform: uppercase;">CARICAMENTO...</div>
        </header>
        
        <div class="game-opponents-row" style="margin-top: 10px;">
            <div id="bot-1" class="game-bot-pill"><span>BOT 1</span><br><span class="game-bot-count" id="cnt-1">7</span><span style="font-size:9px; opacity:0.5;"> CARTE</span></div>
            <div id="bot-2" class="game-bot-pill"><span>BOT 2</span><br><span class="game-bot-count" id="cnt-2">7</span><span style="font-size:9px; opacity:0.5;"> CARTE</span></div>
            <div id="bot-3" class="game-bot-pill"><span>BOT 3</span><br><span class="game-bot-count" id="cnt-3">7</span><span style="font-size:9px; opacity:0.5;"> CARTE</span></div>
        </div>
        
        <main class="game-master-table">
            <div id="status-log" style="position: absolute; top: -10px; font-size: 11px; font-weight: 800; opacity: 0.7;">INIZIO PARTITA</div>
            
            <div class="game-card-center">
                <div id="deck-draw" class="game-card-unit back" style="cursor:pointer; box-shadow: 0 0 20px rgba(157,78,221,0.3) !important;">
                    <span style="font-size: 2rem;">🃏</span>
                </div>
                <div id="discard-pile"></div>
            </div>
            
            <div style="font-size: 10px; font-weight: 900; letter-spacing: 2px; margin-bottom: 5px; opacity: 0.6;">COLORE ATTUALE</div>
            <div id="color-indicator" class="game-color-line"></div>
        </main>
        
        <footer class="game-player-area" style="padding: 10px 0 0 0; background: transparent;">
            <div class="game-action-buttons">
                <button class="game-btn-action" id="btn-catch" style="display:none; background: #c77dff; border: none; padding: 12px 20px; color: black; box-shadow: 0 0 15px #c77dff;">SGAMA BOT!</button>
                <button class="game-btn-action" id="btn-solo" style="display:none; background: #ffbd39; border: none; padding: 12px 30px; color: black; box-shadow: 0 0 15px #ffbd39;">SOLO!</button>
                <button class="game-btn-action" id="btn-pass" style="display:none; background: #ff416c; border: none; padding: 12px 30px;">PASSA IL TURNO</button>
            </div>
            <div id="player-hand" class="game-player-hand" style="height: 175px; align-items: flex-end; padding-top: 30px; padding-bottom: 15px;"></div>
        </footer>
        
        <div id="picker-wild" class="game-color-picker">
            <div class="game-color-tile" data-color="red" style="background:#ff4444; box-shadow: 0 0 30px #ff4444;"></div>
            <div class="game-color-tile" data-color="blue" style="background:#00d2ff; box-shadow: 0 0 30px #00d2ff;"></div>
            <div class="game-color-tile" data-color="green" style="background:#00ffa3; box-shadow: 0 0 30px #00ffa3;"></div>
            <div class="game-color-tile" data-color="yellow" style="background:#ffbd39; box-shadow: 0 0 30px #ffbd39;"></div>
        </div>
    </div>
    `;

    renderLevelLadder('solo', container.querySelector('#levels-container'), (selectedLevel) => {
        state.currentLevel = selectedLevel;
        container.querySelector('#start-screen').remove();
        attachInitialListeners(container, state);
        startGame(state, container);
    });

    container.querySelector('#exit-btn').onclick = () => quitGame(container);
    container.querySelector('#btn-exit-ingame').onclick = () => quitGame(container);
}

// --- 2. CREAZIONE CARTE MATTE BLACK ---
function createCardElement(card, isBack = false) {
    const el = document.createElement('div');
    el.className = 'game-card-unit';
    
    if (isBack) {
        el.classList.add('back');
        return el;
    }

    const hex = getHex(card.color);
    const icon = getIcon(card.val);

    el.style.borderColor = hex;
    el.style.color = hex;
    el.style.boxShadow = `0 4px 15px ${hex}30`; 

    el.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="align-self: flex-start; font-size: 0.9rem; line-height: 1; text-shadow: 0 0 5px ${hex};">${icon}</div>
            <div style="align-self: center; font-size: 2.4rem; filter: drop-shadow(0 0 10px ${hex});">${icon}</div>
            <div style="align-self: flex-end; font-size: 0.9rem; line-height: 1; transform: rotate(180deg); text-shadow: 0 0 5px ${hex};">${icon}</div>
        </div>
    `;
    return el;
}

// --- 3. ANIMAZIONI FLUIDE ---
async function animateCardMove(startEl, targetEl, cardData, isBack = false) {
    return new Promise(resolve => {
        if (!startEl || !targetEl) return resolve();
        
        const startRect = startEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        
        const flyer = createCardElement(cardData, isBack);
        flyer.classList.add('flying-card');
        
        flyer.style.left = `${startRect.left}px`;
        flyer.style.top = `${startRect.top}px`;
        flyer.style.width = `${startRect.width}px`;
        flyer.style.height = `${startRect.height}px`;
        
        document.body.appendChild(flyer);
        
        requestAnimationFrame(() => {
            flyer.style.transition = 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
            flyer.style.left = `${targetRect.left}px`;
            flyer.style.top = `${targetRect.top}px`;
            flyer.style.transform = `scale(0.9) rotate(${Math.random() * 20 - 10}deg)`;
        });

        setTimeout(() => { flyer.remove(); resolve(); }, 400);
    });
}

// --- 4. MOTORE DEL GIOCO E REGOLE ---
function attachInitialListeners(container, state) {
    container.querySelector('#deck-draw').onclick = () => {
        if (state.turn === 0 && !state.isAnimating && !state.drawnCardThisTurn) {
            drawCard(0, state, container, true);
        }
    };

    container.querySelector('#btn-pass').onclick = () => {
        state.drawnCardThisTurn = false;
        endTurn(state, container);
    };

    // Bottone SOLO per il giocatore
    container.querySelector('#btn-solo').onclick = () => {
        state.playerSaidSolo = true;
        logStatus(container, "Hai gridato: SOLO!");
        updateUI(state, container);
    };

    // Bottone Sgama Bot
    container.querySelector('#btn-catch').onclick = async () => {
        if (state.catchableBots.length > 0) {
            const caughtBot = state.catchableBots.shift();
            logStatus(container, `Sgamato BOT ${caughtBot}! +2 Carte.`);
            await drawCard(caughtBot, state, container);
            await drawCard(caughtBot, state, container);
            updateUI(state, container);
        }
    };

    container.querySelectorAll('.game-color-tile').forEach(tile => {
        tile.onclick = () => {
            state.currentColor = tile.dataset.color;
            container.querySelector('#picker-wild').style.display = 'none';
            logStatus(container, `Hai scelto: ${state.currentColor.toUpperCase()}`);
            endTurn(state, container);
        };
    });
}

function startGame(state, container) {
    state.deck = [];
    COLORS.forEach(c => {
        for(let i=0; i<=9; i++) state.deck.push({color: c, val: i.toString()});
        ['SKIP', 'REV', '+2'].forEach(v => { state.deck.push({color: c, val: v}); state.deck.push({color: c, val: v}); });
    });
    for(let i=0; i<4; i++) { state.deck.push({color: 'wild', val: 'WILD'}); state.deck.push({color: 'wild', val: '+4'}); }
    state.deck.sort(() => Math.random() - 0.5);
    
    for(let p=0; p<4; p++) { 
        state.players[p] = []; 
        for(let i=0; i<7; i++) state.players[p].push(state.deck.pop()); 
    }

    let first = state.deck.pop();
    while(first.color === 'wild') { 
        state.deck.unshift(first);
        first = state.deck.pop();
    }
    
    state.currentColor = first.color;
    state.currentVal = first.val;
    state.discardPile.push(first);
    state.gameActive = true;
    updateUI(state, container);
}

function logStatus(container, msg) {
    const log = container.querySelector('#status-log');
    if(log) {
        log.innerText = msg;
        log.classList.remove('fade-in');
        void log.offsetWidth; 
        log.classList.add('fade-in');
    }
}

async function drawCard(pIdx, state, container, manual = false) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    if (state.deck.length === 0) {
        const top = state.discardPile.pop();
        state.deck = state.discardPile.sort(() => Math.random() - 0.5);
        state.discardPile = [top];
    }

    const card = state.deck.pop();
    const startEl = container.querySelector('#deck-draw');
    const targetEl = pIdx === 0 ? container.querySelector('#player-hand') : container.querySelector(`#bot-${pIdx}`);
    
    await animateCardMove(startEl, targetEl, card, pIdx !== 0);
    
    state.players[pIdx].push(card);
    
    // Se un bot era catchable e pesca, si "salva" (non è più a 1 carta)
    state.catchableBots = state.catchableBots.filter(b => b !== pIdx);

    // Se il giocatore pesca, resetta il suo "SOLO!" così deve ridirlo se scende di nuovo a 1
    if (pIdx === 0) {
        state.playerSaidSolo = false;
    }

    state.isAnimating = false;
    
    if (pIdx === 0 && manual) {
        state.drawnCardThisTurn = true;
        logStatus(container, "Hai pescato. Gioca o Passa.");
    } else if (pIdx !== 0 && !manual) { // Non logghiamo quando il bot pesca per penalità
        logStatus(container, `BOT ${pIdx} pesca.`);
    }
    
    updateUI(state, container);
}

async function playCard(pIdx, cardIdx, state, container) {
    if (state.isAnimating) return;
    const card = state.players[pIdx][cardIdx];

    if (card.color !== 'wild' && card.color !== state.currentColor && card.val !== state.currentVal) {
        if(pIdx === 0) logStatus(container, "Mossa non valida!");
        return;
    }

    state.isAnimating = true;
    const startEl = pIdx === 0 ? container.querySelector(`[data-idx="${cardIdx}"]`) : container.querySelector(`#bot-${pIdx}`);
    const targetEl = container.querySelector('#discard-pile');
    
    await animateCardMove(startEl, targetEl, card);

    state.players[pIdx].splice(cardIdx, 1);
    state.discardPile.push(card);
    state.currentVal = card.val;
    if (card.color !== 'wild') state.currentColor = card.color;

    // Se un bot gioca una carta, non è più catchable (o ha chiuso, o non ha 1 carta)
    state.catchableBots = state.catchableBots.filter(b => b !== pIdx);

    logStatus(container, pIdx === 0 ? `Hai giocato ${card.val}` : `BOT ${pIdx} gioca ${card.val}`);

    // LOGICA REGOLA "SOLO!"
    if (state.players[pIdx].length === 1) {
        if (pIdx === 0) {
            // Controllo se il giocatore ha chiamato SOLO!
            if (!state.playerSaidSolo) {
                logStatus(container, "Dimenticato SOLO! +2 Carte");
                await drawCard(0, state, container);
                await drawCard(0, state, container);
            }
        } else {
            // Controllo se il Bot si ricorda di chiamare SOLO!
            // Accuratezza: Livello 1 = 55%, Livello 10 = 100%
            const accuracy = Math.min(1.0, state.currentLevel * 0.05 + 0.5);
            if (Math.random() <= accuracy) {
                logStatus(container, `BOT ${pIdx} grida: SOLO!`);
            } else {
                state.catchableBots.push(pIdx); // Il giocatore può sgamarlo!
            }
        }
    }

    state.isAnimating = false;
    state.drawnCardThisTurn = false;

    // Regole Speciali
    if (card.val === 'REV') state.direction *= -1;
    let nextPlayer = (state.turn + state.direction + 4) % 4;

    if (card.val === 'SKIP') {
        logStatus(container, `Salto turno!`);
        state.turn = nextPlayer; 
    } else if (card.val === '+2') {
        logStatus(container, `+2 Carte!`);
        await drawCard(nextPlayer, state, container);
        await drawCard(nextPlayer, state, container);
        state.turn = nextPlayer; 
    } else if (card.val === '+4') {
        logStatus(container, `+4 Carte!`);
        for(let i=0; i<4; i++) await drawCard(nextPlayer, state, container);
        state.turn = nextPlayer;
    }

    if (card.color === 'wild' && pIdx === 0) {
        container.querySelector('#picker-wild').style.display = 'grid';
    } else {
        if (card.color === 'wild' && pIdx !== 0) {
            const colors = ['red', 'blue', 'green', 'yellow'];
            state.currentColor = colors[Math.floor(Math.random() * 4)];
            logStatus(container, `BOT ${pIdx} ha scelto il ${state.currentColor.toUpperCase()}`);
        }
        endTurn(state, container);
    }
}

function endTurn(state, container) {
    // Controllo Vittoria
    for(let i=0; i<4; i++) {
        if (state.players[i].length === 0) {
            if (i === 0) {
                alert(`🏆 VITTORIA!\nHai superato il Livello ${state.currentLevel}!`);
                unlockNextLevel('solo', state.currentLevel);
            } else {
                alert(`💀 SCONFITTA!\nIl Bot ${i} ha vinto.`);
            }
            return quitGame(container);
        }
    }
    
    state.turn = (state.turn + state.direction + 4) % 4;
    updateUI(state, container);
    
    if (state.turn !== 0) {
        setTimeout(() => botLogic(state, container), 1200);
    }
}

// --- 5. INTELLIGENZA ARTIFICIALE BOT ---
function botLogic(state, container) {
    const hand = state.players[state.turn];
    const validIdxs = [];
    
    hand.forEach((c, i) => {
        if (c.color === 'wild' || c.color === state.currentColor || c.val === state.currentVal) {
            validIdxs.push(i);
        }
    });

    const accuracy = Math.min(0.95, state.currentLevel * 0.025);
    const isSmart = Math.random() <= accuracy;

    if (validIdxs.length > 0) {
        let chosenIdx;
        if (isSmart) {
            const normalCards = validIdxs.filter(i => hand[i].color !== 'wild' && !['+2', 'SKIP', 'REV'].includes(hand[i].val));
            if (normalCards.length > 0) {
                chosenIdx = normalCards[Math.floor(Math.random() * normalCards.length)];
            } else {
                chosenIdx = validIdxs[Math.floor(Math.random() * validIdxs.length)];
            }
        } else {
            chosenIdx = validIdxs[Math.floor(Math.random() * validIdxs.length)];
        }
        playCard(state.turn, chosenIdx, state, container);
    } else {
        drawCard(state.turn, state, container).then(() => {
            setTimeout(() => endTurn(state, container), 600);
        });
    }
}

// --- 6. AGGIORNAMENTO INTERFACCIA ---
function updateUI(state, container) {
    const isPlayer = state.turn === 0;

    const tInd = container.querySelector('#turn-indicator');
    tInd.innerText = isPlayer ? "🏆 IL TUO TURNO" : `TURNO DI BOT ${state.turn}`;
    tInd.className = `game-turn-indicator ${isPlayer ? 'white-turn' : 'black-turn'}`;

    const top = state.discardPile[state.discardPile.length-1];
    const dp = container.querySelector('#discard-pile');
    dp.innerHTML = '';
    const dpCard = createCardElement(top);
    dpCard.style.transform = 'scale(1.1)'; 
    dp.appendChild(dpCard);
    
    const cLine = container.querySelector('#color-indicator');
    cLine.style.backgroundColor = getHex(state.currentColor);
    cLine.style.boxShadow = `0 0 20px ${getHex(state.currentColor)}`;

    // Aggiorna Bot (Evidenzia chi sta giocando)
    for(let i=1; i<=3; i++) {
        const botPill = container.querySelector(`#bot-${i}`);
        botPill.classList.toggle('active', state.turn === i);
        container.querySelector(`#cnt-${i}`).innerText = state.players[i].length;
    }

    // Gestione Bottoni Azione
    container.querySelector('#btn-pass').style.display = (isPlayer && state.drawnCardThisTurn) ? 'block' : 'none';
    
    const btnSolo = container.querySelector('#btn-solo');
    // Mostra il tasto SOLO se il giocatore ha 2 carte (prima di giocarne una) o 1 carta (se l'ha dimenticato e non l'ha ancora premuto)
    if (isPlayer && (state.players[0].length === 2 || state.players[0].length === 1) && !state.playerSaidSolo) {
        btnSolo.style.display = 'block';
    } else {
        btnSolo.style.display = 'none';
    }

    const btnCatch = container.querySelector('#btn-catch');
    // Mostra il tasto per beccare un bot se qualcuno si è scordato di dire SOLO
    if (state.catchableBots.length > 0) {
        btnCatch.style.display = 'block';
    } else {
        btnCatch.style.display = 'none';
    }

    // Aggiorna Mano Giocatore
    const pArea = container.querySelector('#player-hand');
    pArea.innerHTML = '';
    const overlap = state.players[0].length > 8 ? "-30px" : "-15px";

    state.players[0].forEach((c, i) => {
        const el = createCardElement(c);
        el.setAttribute('data-idx', i);
        el.style.marginRight = overlap;
        
        const canPlay = c.color === 'wild' || c.color === state.currentColor || c.val === state.currentVal;
        if (isPlayer && canPlay) {
            // FIX: Ora la traslazione in Y avviene in sicurezza grazie allo spazio extra nel container
            el.style.transform = 'translateY(-15px)';
            el.style.boxShadow = `0 10px 25px ${getHex(c.color)}80`;
        } else if (isPlayer) {
            el.style.opacity = '0.5'; 
        }

        el.onclick = () => { 
            if(isPlayer && !state.isAnimating) playCard(0, i, state, container); 
        };
        pArea.appendChild(el);
    });
}