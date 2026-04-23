import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { getUnlockedLevel, unlockNextLevel, renderLevelLadder } from '../../services/levels.js';

/**
 * GIOCO: BURRACO - MASTER EDITION
 * Integrazione UI Matte Black + Scala Livelli Infiniti
 */

export function initBurraco(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }
    
    // BLOCCO SCROLL PER ESPERIENZA APP-LIKE
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none'; 
    window.scrollTo(0, 0);

    let state = {
        mode: 2, deck: [],
        hands: { player: [], bot1: [] },
        tables: { team1: [], team2: [] },
        discardPile: [], turn: 'player', phase: 'draw',
        selectedIndices: [], tutorMsg: "Tocca il mazzo per pescare.",
        isAnimating: false,
        currentLevel: 1
    };

    renderLayout(container, state);
}

const quitGame = async (container) => {
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) { window.location.reload(); }
};

// --- 1. LAYOUT GIOCO ---
function renderLayout(container, state) {
    container.innerHTML = `
    <div class="game-master-wrapper fade-in">
        
        <div id="start-screen" class="game-master-wrapper" style="position: absolute; inset: 0; z-index: 10000; justify-content: center; background: #05010a;">
            <img src="/assets/logo.png" style="width: 100px; margin-bottom: 25px;" class="pulse-logo">
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 10px;">BURRACO</h1>
            <p style="color: var(--amethyst-light); font-size: 11px; font-weight: 800; letter-spacing: 2px; margin-bottom: 30px;">SELEZIONA IL LIVELLO</p>
            
            <div id="levels-container" style="display: flex; flex-direction: column; width: 100%; max-width: 280px; max-height: 250px; overflow-y: auto; padding: 10px; margin-bottom: 20px;">
                </div>

            <button id="exit-btn" class="game-btn-action" style="background: transparent; border: none; opacity: 0.6;">TORNA ALLA TAVERNA</button>
        </div>

        <header class="game-master-header">
            <button class="game-btn-action" id="btn-exit-ingame" style="padding: 10px 20px;">← ESCI</button>
            <div class="game-score-widget">
                <span id="turn-display" style="color: #00ffa3; font-weight: 900;">TUO TURNO</span>
            </div>
        </header>
        
        <div id="tutor-container" style="position: absolute; top: 65px; left: 50%; transform: translateX(-50%); background: rgba(157, 78, 221, 0.2); border: 1px solid var(--amethyst-bright); padding: 8px 20px; border-radius: 50px; font-size: 11px; z-index: 10; backdrop-filter: blur(10px); pointer-events: none; white-space: nowrap; font-weight: 800; color: #fff;">
            <span id="tutor-text"></span>
        </div>
        
        <div style="flex: 1; display: flex; flex-direction: column; gap: 15px; width: 100%; max-width: 500px; padding: 15px 0; box-sizing: border-box; overflow: hidden; margin-top: 30px;">
            <div id="bot-table" style="flex: 1; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: 20px; padding: 15px; position: relative; display: flex; gap: 12px; overflow-x: auto; overflow-y: hidden; box-shadow: inset 0 0 30px rgba(0,0,0,0.3); -webkit-overflow-scrolling: touch;"></div>
            <div id="player-table" style="flex: 1; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); border-radius: 20px; padding: 15px; position: relative; display: flex; gap: 12px; overflow-x: auto; overflow-y: hidden; box-shadow: inset 0 0 30px rgba(0,0,0,0.3); -webkit-overflow-scrolling: touch;"></div>
        </div>
        
        <div style="display: flex; justify-content: center; align-items: center; gap: 50px; padding: 15px; background: rgba(0,0,0,0.3); border-top: 1px solid var(--glass-border); border-bottom: 1px solid var(--glass-border); width: 100%;">
            <div id="main-deck" class="game-card-unit back" style="width: clamp(60px, 15vw, 85px); height: clamp(90px, 22vw, 125px); cursor: pointer;"></div>
            <div id="discard-pile-ui" style="display:flex; min-width:60px; min-height:90px; position:relative;"></div>
        </div>
        
        <div style="width:100%; max-width: 500px; display:flex; flex-direction:column; align-items:center; margin-top: 15px;">
            <div style="display:flex; gap:15px; width:100%; padding: 0 15px; box-sizing: border-box;">
                <button class="game-btn-action" id="btn-meld" style="flex:1; background: #00ffa3; color: #000; border: none;">CALA COMBO</button>
                <button class="game-btn-action" id="btn-discard" style="flex:1; background: #ff416c; border: none;">SCARTA</button>
            </div>
            <div id="player-hand" class="game-player-hand" style="overflow-x: auto; padding-bottom: 5px; height: 125px; align-items: flex-end;"></div>
        </div>
    </div>
    `;

    // Render della Scala
    renderLevelLadder('burraco', container.querySelector('#levels-container'), (selectedLevel) => {
        state.currentLevel = selectedLevel;
        container.querySelector('#start-screen').remove();
        initLogic(state, container);
    });

    container.querySelector('#exit-btn').onclick = (e) => { e.preventDefault(); quitGame(container); };
    container.querySelector('#btn-exit-ingame').onclick = (e) => { e.preventDefault(); quitGame(container); };
}

// --- 2. LOGICA E AGGIORNAMENTO UI ---
function initLogic(state, container) {
    state.deck = createBurracoDeck();
    shuffle(state.deck);
    state.hands.player = state.deck.splice(0, 11);
    state.hands.bot1 = state.deck.splice(0, 11);
    state.discardPile.push(state.deck.pop());
    state.container = container; 
    updateUI(state);
}

function updateUI(state) {
    if (state.isAnimating) return;
    const isPlayer = state.turn === 'player';
    const selectedCards = state.selectedIndices.map(i => state.hands.player[i]);
    const targetPilaIndex = findTargetPila(selectedCards, state.tables.team1);
    const isNewCombo = validateCombo(selectedCards);
    const canMeld = (isNewCombo || (selectedCards.length > 0 && targetPilaIndex !== -1));

    if (isPlayer && state.phase === 'play') {
        if (isNewCombo) state.tutorMsg = "Combo valida! Cala sul tavolo.";
        else if (targetPilaIndex !== -1) state.tutorMsg = "Puoi attaccare queste carte.";
        else if (state.selectedIndices.length > 0) state.tutorMsg = "Seleziona altre carte...";
        else state.tutorMsg = "Scegli una carta da scartare o una combo.";
    }

    const tutorEl = document.getElementById('tutor-text');
    const turnDisplay = document.getElementById('turn-display');
    
    if(tutorEl) tutorEl.innerText = state.tutorMsg;
    if(turnDisplay) {
        turnDisplay.innerText = isPlayer ? "TUO TURNO" : `BOT LV.${state.currentLevel} PENSANDO...`;
        turnDisplay.style.color = isPlayer ? "#00ffa3" : "#ff416c";
    }

    const btnDiscard = document.getElementById('btn-discard');
    const btnMeld = document.getElementById('btn-meld');
    
    if(btnDiscard) {
        btnDiscard.disabled = !isPlayer || state.selectedIndices.length !== 1 || state.phase !== 'play';
        btnDiscard.style.opacity = btnDiscard.disabled ? "0.3" : "1";
    }
    if(btnMeld) {
        btnMeld.disabled = !isPlayer || !canMeld || state.phase !== 'play';
        btnMeld.style.opacity = btnMeld.disabled ? "0.3" : "1";
    }
    
    renderHand(state);
    renderTables(state);
    renderDiscard(state);

    const deckEl = document.getElementById('main-deck');
    if(deckEl) deckEl.onclick = (e) => { if(isPlayer && state.phase === 'draw') handlePlayerDraw(state); };
    if(btnDiscard) btnDiscard.onclick = (e) => { handlePlayerDiscard(state); };
    if(btnMeld) btnMeld.onclick = (e) => { handleMeld(state, targetPilaIndex); };
}

// --- 3. RENDERING CARTE (MATTE BLACK) ---
function createCardElement(card) {
    const el = document.createElement('div');
    el.className = `game-card-unit`;
    const icon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[card.suit];
    const isRed = (card.suit === 'hearts' || card.suit === 'diamonds');
    
    let faceEmoji = '';
    if (card.val === 'K') faceEmoji = '👑';
    else if (card.val === 'Q') faceEmoji = '👸';
    else if (card.val === 'J') faceEmoji = '💂';
    
    const centerIcon = faceEmoji ? faceEmoji : icon;

    if (isRed) el.style.color = '#ff416c';
    
    el.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="align-self: flex-start; display: flex; align-items: center; gap: 2px; font-size: 0.9rem; line-height: 1;">
                <span>${card.val}</span><span style="font-size: 0.7rem;">${icon}</span>
            </div>
            <div style="align-self: center; font-size: 1.8rem; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
                ${centerIcon}
            </div>
            <div style="align-self: flex-end; display: flex; align-items: center; gap: 2px; font-size: 0.9rem; line-height: 1; transform: rotate(180deg);">
                <span>${card.val}</span><span style="font-size: 0.7rem;">${icon}</span>
            </div>
        </div>
    `;
    return el;
}

function renderHand(state) {
    const container = document.getElementById('player-hand');
    if(!container) return;
    container.innerHTML = '';
    
    const overlap = state.hands.player.length > 10 ? "-35px" : "-20px";
    
    state.hands.player.forEach((card, i) => {
        const el = createCardElement(card);
        el.setAttribute('data-hand-idx', i);
        
        if (state.selectedIndices.includes(i)) {
            el.style.transform = 'translateY(-20px)';
            el.style.borderColor = 'var(--amethyst-bright)';
            el.style.boxShadow = '0 0 20px var(--amethyst-glow)';
            el.style.zIndex = '100';
        }
        
        el.style.marginRight = overlap; 
        
        el.onclick = () => {
            if (state.turn !== 'player' || state.phase === 'draw' || state.isAnimating) return;
            const pos = state.selectedIndices.indexOf(i);
            if (pos > -1) state.selectedIndices.splice(pos, 1);
            else state.selectedIndices.push(i);
            updateUI(state);
        };
        container.appendChild(el);
    });
}

function renderTables(state) {
    const drawTable = (id, data, label) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.innerHTML = `<span style="font-size:10px; opacity:0.5; position:absolute; top:5px; left:10px; font-weight:900; font-family:'Montserrat', sans-serif;">${label}</span>`;
        data.forEach(group => {
            const gDiv = document.createElement('div');
            gDiv.style.display = "flex";
            gDiv.style.flexDirection = "column";
            gDiv.style.marginTop = "20px";
            group.forEach((card, i) => {
                const c = createCardElement(card);
                c.style.marginTop = i === 0 ? '0' : '-65px';
                c.style.transform = 'scale(0.85)';
                gDiv.appendChild(c);
            });
            el.appendChild(gDiv);
        });
    };
    drawTable('player-table', state.tables.team1, "IL TUO TAVOLO");
    drawTable('bot-table', state.tables.team2, "AVVERSARIO");
}

function renderDiscard(state) {
    const el = document.getElementById('discard-pile-ui');
    if(!el) return;
    el.innerHTML = '';
    state.discardPile.slice(-3).forEach((card, i) => {
        const c = createCardElement(card);
        c.style.position = "absolute";
        c.style.left = `${i * 15}px`;
        c.onclick = () => { if(state.turn === 'player' && state.phase === 'draw') handlePlayerPickDiscard(state); };
        el.appendChild(c);
    });
}

// --- 4. ANIMAZIONI VISUALI ---
async function animateCardMove(startEl, targetEl, cardData, isBack = false) {
    return new Promise(resolve => {
        if (!startEl || !targetEl) return resolve();
        const startRect = startEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        
        const flyer = document.createElement('div');
        flyer.className = `game-card-unit flying-card ${isBack ? 'back' : ''}`;
        
        if (!isBack && cardData.suit) {
            const icon = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[cardData.suit];
            const isRed = (cardData.suit === 'hearts' || cardData.suit === 'diamonds');
            if (isRed) flyer.style.color = '#ff416c';
            
            let faceEmoji = '';
            if (cardData.val === 'K') faceEmoji = '👑';
            else if (cardData.val === 'Q') faceEmoji = '👸';
            else if (cardData.val === 'J') faceEmoji = '💂';
            
            const centerIcon = faceEmoji ? faceEmoji : icon;

            flyer.innerHTML = `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between;">
                    <div style="align-self: flex-start; display: flex; align-items: center; gap: 2px; font-size: 0.9rem; line-height: 1;">
                        <span>${cardData.val}</span><span style="font-size: 0.7rem;">${icon}</span>
                    </div>
                    <div style="align-self: center; font-size: 1.8rem; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));">
                        ${centerIcon}
                    </div>
                    <div style="align-self: flex-end; display: flex; align-items: center; gap: 2px; font-size: 0.9rem; line-height: 1; transform: rotate(180deg);">
                        <span>${cardData.val}</span><span style="font-size: 0.7rem;">${icon}</span>
                    </div>
                </div>
            `;
        }

        flyer.style.left = `${startRect.left}px`;
        flyer.style.top = `${startRect.top}px`;
        flyer.style.width = `${startRect.width}px`;
        flyer.style.height = `${startRect.height}px`;
        document.body.appendChild(flyer);

        requestAnimationFrame(() => {
            flyer.style.left = `${targetRect.left}px`;
            flyer.style.top = `${targetRect.top}px`;
            flyer.style.transform = `scale(0.85) rotate(${Math.random() * 20 - 10}deg)`;
        });

        setTimeout(() => { flyer.remove(); resolve(); }, 400);
    });
}

// --- 5. LOGICA AZIONI ---
async function handlePlayerDraw(state) {
    state.isAnimating = true;
    const startEl = document.getElementById('main-deck');
    const targetEl = document.getElementById('player-hand');
    const card = state.deck.pop();
    await animateCardMove(startEl, targetEl, card, true);
    state.hands.player.push(card);
    state.phase = 'play';
    state.isAnimating = false;
    updateUI(state);
}

async function handlePlayerPickDiscard(state) {
    if (state.turn !== 'player' || state.phase !== 'draw') return;
    state.isAnimating = true;
    const startEl = document.getElementById('discard-pile-ui');
    const targetEl = document.getElementById('player-hand');
    await animateCardMove(startEl, targetEl, {}, true);
    state.hands.player.push(...state.discardPile);
    state.discardPile = [];
    state.phase = 'play';
    state.isAnimating = false;
    updateUI(state);
}

async function handlePlayerDiscard(state) {
    state.isAnimating = true;
    const idx = state.selectedIndices[0];
    const card = state.hands.player[idx];
    const startEl = document.querySelector(`[data-hand-idx="${idx}"]`);
    const targetEl = document.getElementById('discard-pile-ui');
    
    await animateCardMove(startEl, targetEl, card);
    
    state.hands.player.splice(idx, 1);
    state.discardPile.push(card);
    state.selectedIndices = [];
    
    if (state.hands.player.length === 0) {
        alert(`🏆 VITTORIA!\nHai chiuso e superato il Livello ${state.currentLevel}!`);
        unlockNextLevel('burraco', state.currentLevel);
        quitGame(state.container);
        return;
    }

    state.turn = 'bot';
    state.phase = 'draw';
    state.tutorMsg = "Il Bot sta pensando...";
    state.isAnimating = false;
    updateUI(state);
    
    setTimeout(() => { botAction(state); }, 1000);
}

function handleMeld(state, targetPilaIndex) {
    const cards = state.selectedIndices.sort((a,b)=>b-a).map(i => state.hands.player.splice(i,1)[0]);
    if (targetPilaIndex !== -1) {
        state.tables.team1[targetPilaIndex].push(...cards);
        state.tables.team1[targetPilaIndex].sort((a, b) => getCardValue(a) - getCardValue(b));
    } else {
        cards.sort((a, b) => getCardValue(a) - getCardValue(b));
        state.tables.team1.push(cards);
    }
    state.selectedIndices = [];
    updateUI(state);
}

// --- BOT E IA PROGRESSIVA ---
function botAction(state) {
    if (state.turn !== 'bot') return;
    state.isAnimating = true;

    // IA Accurancy (max 95%) basata sul livello
    const accuracy = Math.min(0.95, state.currentLevel * 0.025);
    const isSmart = Math.random() <= accuracy;

    setTimeout(async () => {
        // 1. Pesca
        const card = state.deck.pop();
        const startEl = document.getElementById('main-deck');
        const targetEl = document.getElementById('bot-table');
        await animateCardMove(startEl, targetEl, card, true);
        state.hands.bot1.push(card);

        // 2. Tenta di Calare se è "Smart"
        if (isSmart) {
            let valCounts = {};
            state.hands.bot1.forEach(c => valCounts[c.val] = (valCounts[c.val] || 0) + 1);
            for (let v in valCounts) {
                if (valCounts[v] >= 3) {
                    const meld = state.hands.bot1.filter(c => c.val === v);
                    state.hands.bot1 = state.hands.bot1.filter(c => c.val !== v);
                    state.tables.team2.push(meld);
                    state.tutorMsg = `Il Bot ha calato un tris di ${v}!`;
                    break; 
                }
            }
        }

        // 3. Scarta
        setTimeout(async () => {
            let discardIdx = 0;
            if (isSmart) {
                let valCounts = {};
                state.hands.bot1.forEach(c => valCounts[c.val] = (valCounts[c.val] || 0) + 1);
                discardIdx = state.hands.bot1.findIndex(c => valCounts[c.val] === 1);
                if(discardIdx === -1) discardIdx = 0;
            } else {
                discardIdx = Math.floor(Math.random() * state.hands.bot1.length);
            }

            const dCard = state.hands.bot1.splice(discardIdx, 1)[0];
            const dTarget = document.getElementById('discard-pile-ui');
            await animateCardMove(document.getElementById('bot-table'), dTarget, dCard, false);
            state.discardPile.push(dCard);

            if (state.hands.bot1.length === 0) {
                alert(`💀 SCONFITTA!\nIl Bot di Livello ${state.currentLevel} ha chiuso!`);
                return quitGame(state.container);
            }

            state.turn = 'player';
            state.phase = 'draw';
            state.tutorMsg = "Tocca il mazzo per pescare.";
            state.isAnimating = false;
            updateUI(state);
        }, 800);
    }, 800);
}

function findTargetPila(selectedCards, table) {
    if (selectedCards.length === 0) return -1;
    for (let i = 0; i < table.length; i++) {
        let potentialGroup = [...table[i], ...selectedCards];
        if (validateCombo(potentialGroup)) return i;
    }
    return -1;
}

function validateCombo(cards) {
    if (cards.length < 3) return false;
    const firstVal = cards[0].val;
    return cards.every(c => c.val === firstVal);
}

function getCardValue(card) {
    const mapping = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
    return mapping[card.val] || 0;
}

function createBurracoDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'], values = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    let deck = [];
    suits.forEach(s => values.forEach(v => deck.push({suit:s, val:v})));
    suits.forEach(s => values.forEach(v => deck.push({suit:s, val:v})));
    return deck;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }