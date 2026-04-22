import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: SOLO MASTER EDITION
// Versione 2.6 - Full Animated & Global CSS Control
// ==========================================

const COLORS = ['red', 'blue', 'green', 'yellow'];

const getHex = (color) => {
    const hex = { red: '#ff4b2b', blue: '#00d2ff', green: '#2ecc71', yellow: '#f1c40f', wild: '#1a1a1a' };
    return hex[color] || '#ffffff';
};

const getCardContent = (val) => {
    const symbols = { 'SKIP': '🚫', 'REV': '🔄', '+2': '+2', 'WILD': '🌈', '+4': '+4' };
    return symbols[val] || val;
};

export function initSoloGame(container) {
    if (!container) return;
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#05010a';
    window.scrollTo(0, 0);

    let state = {
        deck: [],
        discardPile: [],
        players: [[], [], [], []],
        turn: 0,
        direction: 1,
        currentColor: '',
        currentVal: '',
        gameActive: false,
        isAnimating: false,
        hasSaidSolo: false,
        pendingPenalty: false,
        stack: 0,
        canChain: false
    };

    renderLayout(container, state);
    attachInitialListeners(container, state);
}

const quitGame = async (container) => {
    document.body.style.touchAction = '';
    document.body.style.overflowY = 'auto';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        window.location.reload();
    }
};

function renderLayout(container, state) {
    container.innerHTML = `
        <div class="game-master-wrapper">
            <div id="start-overlay" class="game-setup-overlay">
                <img src="/assets/logo.png" class="game-setup-logo pulse-logo">
                <h1 class="main-title">SOLO</h1>
                <button class="btn-primary game-start-btn" id="btn-start">GIOCA ORA</button>
                <button class="btn-back-glass" id="btn-quit-start">← TORNA INDIETRO</button>
            </div>

            <button class="btn-back-glass game-exit-btn" id="btn-exit-ingame">← ESCI</button>

            <div class="game-opponents-row">
                <div class="game-bot-pill" id="bot-pill-1">
                    <span>BOT 1</span>
                    <div class="game-bot-count" id="cnt-1">7</div>
                </div>
                <div class="game-bot-pill" id="bot-pill-2">
                    <span>BOT 2</span>
                    <div class="game-bot-count" id="cnt-2">7</div>
                </div>
                <div class="game-bot-pill" id="bot-pill-3">
                    <span>BOT 3</span>
                    <div class="game-bot-count" id="cnt-3">7</div>
                </div>
            </div>

            <div class="game-master-table">
                <div id="stack-info" class="game-stack-indicator"></div>
                <div class="game-card-center">
                    <div class="game-card-unit back" id="deck-draw"></div>
                    <div class="game-card-unit" id="discard-pile"></div>
                </div>
                <div class="game-color-line" id="color-indicator"></div>
            </div>

            <div class="game-player-area">
                <div class="game-action-buttons">
                    <button class="game-btn-action" id="btn-pass" style="display:none;">PASSA</button>
                    <button class="game-btn-action" id="solo-alert" style="display:none;">SOLO!</button>
                </div>
                <div class="game-player-hand" id="player-hand"></div>
            </div>

            <div id="picker-wild" class="game-color-picker">
                ${COLORS.map(c => `<div class="game-color-tile" data-color="${c}" style="background:${getHex(c)};"></div>`).join('')}
            </div>
        </div>
    `;

    container.querySelector('#btn-quit-start').onclick = () => quitGame(container);
    container.querySelector('#btn-exit-ingame').onclick = () => quitGame(container);
}

async function animateCardMove(startEl, targetEl, cardData, isBack = false) {
    return new Promise(resolve => {
        const startRect = startEl.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();

        const flyer = document.createElement('div');
        flyer.className = `game-card-unit flying-card ${isBack ? 'back' : ''}`;

        if (!isBack) {
            flyer.style.backgroundColor = getHex(cardData.color);
            flyer.innerText = getCardContent(cardData.val);
            flyer.style.color = (cardData.color === 'yellow' || cardData.color === 'wild') ? 'black' : 'white';
        }

        flyer.style.left = `${startRect.left}px`;
        flyer.style.top = `${startRect.top}px`;
        flyer.style.width = `${startRect.width}px`;
        flyer.style.height = `${startRect.height}px`;
        flyer.style.position = 'fixed';
        flyer.style.zIndex = '9999';
        flyer.style.pointerEvents = 'none';
        flyer.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        document.body.appendChild(flyer);

        requestAnimationFrame(() => {
            flyer.style.left = `${targetRect.left}px`;
            flyer.style.top = `${targetRect.top}px`;
            flyer.style.transform = `rotate(${Math.random() * 40 - 20}deg)`;
        });

        setTimeout(() => {
            flyer.remove();
            resolve();
        }, 450);
    });
}

function attachInitialListeners(container, state) {
    container.querySelector('#btn-start').onclick = () => {
        container.querySelector('#start-overlay').style.display = 'none';
        startGame(state, container);
    };

    container.querySelector('#deck-draw').onclick = () => {
        if (state.turn === 0 && !state.isAnimating) drawCard(0, state, container, true);
    };

    container.querySelector('#btn-pass').onclick = () => endTurn(state, container);

    container.querySelectorAll('.game-color-tile').forEach(tile => {
        tile.onclick = () => {
            state.currentColor = tile.dataset.color;
            container.querySelector('#picker-wild').style.display = 'none';
            endTurn(state, container);
        };
    });
}

function startGame(state, container) {
    state.deck = [];

    COLORS.forEach(c => {
        for (let i = 0; i <= 9; i++) state.deck.push({ color: c, val: i.toString() });
        ['SKIP', 'REV', '+2'].forEach(v => {
            state.deck.push({ color: c, val: v });
            state.deck.push({ color: c, val: v });
        });
    });

    for (let i = 0; i < 4; i++) {
        state.deck.push({ color: 'wild', val: 'WILD' });
        state.deck.push({ color: 'wild', val: '+4' });
    }

    state.deck.sort(() => Math.random() - 0.5);

    for (let p = 0; p < 4; p++) {
        state.players[p] = [];
        for (let i = 0; i < 7; i++) state.players[p].push(state.deck.pop());
    }

    let first = state.deck.pop();
    state.currentColor = first.color === 'wild' ? 'red' : first.color;
    state.currentVal = first.val;
    state.discardPile.push(first);
    state.gameActive = true;
    updateUI(state, container);
}

async function drawCard(pIdx, state, container, manual = false) {
    if (state.isAnimating) return;
    state.isAnimating = true;

    const card = state.deck.pop();
    const startEl = container.querySelector('#deck-draw');
    const targetEl = pIdx === 0 ? container.querySelector('#player-hand') : container.querySelector(`#bot-pill-${pIdx}`);

    await animateCardMove(startEl, targetEl, card, pIdx !== 0);

    state.players[pIdx].push(card);
    state.isAnimating = false;

    if (pIdx === 0 && manual) {
        const canPlay = card.color === 'wild' || card.color === state.currentColor || card.val === state.currentVal;
        if (!canPlay) setTimeout(() => endTurn(state, container), 300);
    }
    updateUI(state, container);
}

async function playCard(pIdx, cardIdx, state, container) {
    if (state.isAnimating) return;
    const card = state.players[pIdx] [cardIdx];

    if (card.color !== 'wild' && card.color !== state.currentColor && card.val !== state.currentVal) return;

    state.isAnimating = true;
    const startEl = pIdx === 0 ? container.querySelector(`[data-idx="${cardIdx}"]`) : container.querySelector(`#bot-pill-${pIdx}`);
    const targetEl = container.querySelector('#discard-pile');

    await animateCardMove(startEl, targetEl, card);

    state.players[pIdx].splice(cardIdx, 1);
    state.discardPile.push(card);
    state.currentVal = card.val;
    if (card.color !== 'wild') state.currentColor = card.color;

    if (card.color === 'wild' && pIdx === 0) {
        container.querySelector('#picker-wild').style.display = 'grid';
    } else {
        if (card.color === 'wild' && pIdx !== 0) state.currentColor = COLORS[Math.floor(Math.random() * 4)];
        endTurn(state, container);
    }
    state.isAnimating = false;
}

function endTurn(state, container) {
    for (let i = 0; i < 4; i++) {
        if (state.players[i].length === 0) {
            alert(i === 0 ? "🏆 VITTORIA!" : "💀 HAI PERSO!");
            return quitGame(container);
        }
    }
    state.turn = (state.turn + 1) % 4;
    updateUI(state, container);
    if (state.turn !== 0) setTimeout(() => botLogic(state, container), 1000);
}

function botLogic(state, container) {
    const hand = state.players[state.turn];
    const idx = hand.findIndex(c => c.color === 'wild' || c.color === state.currentColor || c.val === state.currentVal);
    if (idx !== -1) playCard(state.turn, idx, state, container);
    else drawCard(state.turn, state, container);
}

function updateUI(state, container) {
    const top = state.discardPile[state.discardPile.length - 1];
    const dp = container.querySelector('#discard-pile');
    dp.style.backgroundColor = getHex(top.color);
    dp.style.color = (top.color === 'yellow' || top.color === 'wild') ? 'black' : 'white';
    dp.innerText = getCardContent(top.val);

    container.querySelector('#color-indicator').style.backgroundColor = getHex(state.currentColor);
    container.querySelector('#color-indicator').style.boxShadow = `0 0 20px ${getHex(state.currentColor)}`;

    const pArea = container.querySelector('#player-hand');
    pArea.innerHTML = state.players.map((c, i) => `
        <div class="game-card-unit" style="background:${getHex(c.color)}; color: ${(c.color === 'yellow' || c.color === 'wild') ? 'black' : 'white'};" data-idx="${i}">
            <div style="font-weight:900; font-size:1.2rem;">${getCardContent(c.val)}</div>
        </div>
    `).join('');

    pArea.querySelectorAll('.game-card-unit').forEach(el => {
        el.onclick = () => {
            if (state.turn === 0) playCard(0, parseInt(el.dataset.idx), state, container);
        };
    });

    for (let i = 1; i <= 3; i++) {
        container.querySelector(`#bot-pill-${i}`).classList.toggle('active', state.turn === i);
        container.querySelector(`#cnt-${i}`).innerText = state.players[i].length;
    }
}