import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

const COLORS = ['red', 'blue', 'green', 'yellow'];
const getHex = (color) => {
    const hex = { red: '#ff4444', blue: '#0066ff', green: '#33cc33', yellow: '#ffcc00' };
    return hex[color] || '#ffffff';
};

export function initSoloGame(container) {
    updateSidebarContext("minigames");
    
    let state = {
        deck: [], discardPile: [], players: [[], [], [], []], // 0 è l'umano
        turn: 0, direction: 1, currentColor: '', currentVal: '',
        gameActive: false, isAnimating: false
    };

    renderLayout(container);
    attachInitialListeners(container, state);
}

function renderLayout(container) {
    container.innerHTML = `
    <style>
        @keyframes floatLogo {
            0% { transform: translateY(0px); filter: drop-shadow(0 0 10px #9d4ede66); }
            50% { transform: translateY(-15px); filter: drop-shadow(0 0 30px #9d4edeaa); }
            100% { transform: translateY(0px); filter: drop-shadow(0 0 10px #9d4ede66); }
        }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .game-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white; font-family: 'Inter', sans-serif; }
        .intro-logo { font-size: 5rem; font-weight: 900; color: #9d4ede; animation: floatLogo 3s ease-in-out infinite; margin-bottom: 40px; text-transform: uppercase; letter-spacing: -3px; }
        .card { width: 65px; height: 95px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2rem; cursor: pointer; transition: 0.3s; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 5px 15px rgba(0,0,0,0.6); background: white; color: black; position: relative; }
        .card-back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1.5px solid #9d4ede; color: #9d4ede; font-size: 0.7rem; }
        .btn-purple { background: #9d4ede; color: black; padding: 18px 40px; border-radius: 50px; font-weight: 900; border: none; cursor: pointer; width: 100%; margin-bottom: 15px; transition: 0.2s; text-align: center; }
        .bot-area { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: 0.5s; padding: 12px; border-radius: 20px; font-size: 10px; opacity: 0.6; }
        .active-player { opacity: 1; background: rgba(157, 78, 221, 0.1); box-shadow: 0 0 20px rgba(157, 78, 221, 0.2); }
    </style>

    <div class="game-bg">
        <div id="start-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:5000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
            <div style="text-align:center; display: flex; flex-direction: column; align-items: center;">
                <h1 class="intro-logo">SOLO</h1>
                <div class="btn-group-intro" style="width: 280px;">
                    <button class="btn-purple" id="mode-single">VS BOT</button>
                </div>
            </div>
        </div>

        <div id="bot-1" class="bot-area" style="top:70px; left:50%; transform:translateX(-50%);"><span>BOT 1</span><div class="hand" style="display:flex; gap:2px;"></div></div>
        <div id="bot-2" class="bot-area" style="top:50%; left:20px; transform:translateY(-50%);"><span>BOT 2</span><div class="hand" style="display:flex; flex-direction:column; gap:2px;"></div></div>
        <div id="bot-3" class="bot-area" style="top:50%; right:20px; transform:translateY(-50%);"><span>BOT 3</span><div class="hand" style="display:flex; flex-direction:column; gap:2px;"></div></div>

        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
            <div id="dir-icon" style="font-size:30px; margin-bottom:10px; color:#9d4ede; transition: 0.5s;">↻</div>
            <div style="display:flex; gap:30px; align-items:center;">
                <div id="deck-draw" class="card card-back">MAZZO</div>
                <div id="discard-pile" class="card" style="width:85px; height:120px; cursor:default;"></div>
            </div>
            <div id="color-info" style="margin-top:20px; font-size:10px; letter-spacing:2px; background:rgba(0,0,0,0.3); padding:5px 15px; border-radius:20px;">
                COLORE: <span id="cur-color" style="font-weight:900;">-</span>
            </div>
        </div>

        <div id="player-area" style="position:absolute; bottom:110px; width:100%; display:flex; justify-content:center; gap:5px; padding:0 20px; flex-wrap: wrap;"></div>
        
        <div id="picker" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:6000; align-items:center; justify-content:center; gap:25px;">
            ${COLORS.map(c => `<div class="color-option" data-color="${c}" style="width:80px; height:80px; background:${getHex(c)}; border-radius:20px; cursor:pointer;"></div>`).join('')}
        </div>
    </div>
    `;
}

function attachInitialListeners(container, state) {
    document.getElementById('mode-single').onclick = () => {
        document.getElementById('start-overlay').style.display = 'none';
        startGame(state);
    };

    document.getElementById('deck-draw').onclick = () => {
        if (state.turn === 0 && !state.isAnimating) drawCard(0, state);
    };

    document.querySelectorAll('.color-option').forEach(opt => {
        opt.onclick = () => {
            state.currentColor = opt.dataset.color;
            updateUI(state);
            document.getElementById('picker').style.display = 'none';
            endTurn(state);
        };
    });
}

function startGame(state) {
    // Crea mazzo
    state.deck = [];
    COLORS.forEach(c => {
        for(let i=0; i<=9; i++) state.deck.push({color: c, val: i.toString()});
        ['+2', 'REV', 'SKIP'].forEach(special => state.deck.push({color: c, val: special}));
    });
    for(let i=0; i<4; i++) state.deck.push({color: 'wild', val: 'WILD'});
    
    // Shuffle
    state.deck.sort(() => Math.random() - 0.5);

    // Distribuisci 7 carte
    for(let p=0; p<4; p++) {
        for(let i=0; i<7; i++) state.players[p].push(state.deck.pop());
    }

    // Prima carta
    let first = state.deck.pop();
    state.currentColor = first.color === 'wild' ? 'red' : first.color;
    state.currentVal = first.val;
    state.discardPile.push(first);
    
    state.gameActive = true;
    updateUI(state);
}

function drawCard(pIdx, state) {
    if (state.deck.length === 0) return;
    state.players[pIdx].push(state.deck.pop());
    updateUI(state);
    if (pIdx !== 0) return; // Bot pesca e passa auto
    endTurn(state);
}

function playCard(pIdx, cardIdx, state) {
    const card = state.players[pIdx][cardIdx];
    // Validazione
    if (card.color !== 'wild' && card.color !== state.currentColor && card.val !== state.currentVal) return;

    state.players[pIdx].splice(cardIdx, 1);
    state.discardPile.push(card);
    state.currentVal = card.val;
    if (card.color !== 'wild') state.currentColor = card.color;

    // Effetti speciali
    if (card.val === 'REV') state.direction *= -1;
    if (card.val === 'SKIP') nextTurn(state);
    
    if (card.color === 'wild' && pIdx === 0) {
        document.getElementById('picker').style.display = 'flex';
    } else if (card.color === 'wild' && pIdx !== 0) {
        state.currentColor = COLORS[Math.floor(Math.random()*4)];
        endTurn(state);
    } else {
        endTurn(state);
    }
}

function nextTurn(state) {
    state.turn = (state.turn + state.direction + 4) % 4;
}

function endTurn(state) {
    updateUI(state);
    if (checkWin(state)) return;
    nextTurn(state);
    updateUI(state);
    if (state.turn !== 0) setTimeout(() => botLogic(state.turn, state), 1200);
}

function botLogic(pIdx, state) {
    const hand = state.players[pIdx];
    const playableIdx = hand.findIndex(c => c.color === 'wild' || c.color === state.currentColor || c.val === state.currentVal);
    
    if (playableIdx !== -1) playCard(pIdx, playableIdx, state);
    else drawCard(pIdx, state);
}

function checkWin(state) {
    for(let i=0; i<4; i++) {
        if (state.players[i].length === 0) {
            alert(i === 0 ? "HAI VINTO!" : `HA VINTO IL BOT ${i}`);
            location.reload();
            return true;
        }
    }
    return false;
}

function updateUI(state) {
    // Update Discard
    const top = state.discardPile[state.discardPile.length-1];
    const dp = document.getElementById('discard-pile');
    dp.style.backgroundColor = getHex(top.color === 'wild' ? state.currentColor : top.color);
    dp.innerText = top.val;
    
    document.getElementById('cur-color').innerText = state.currentColor.toUpperCase();
    document.getElementById('cur-color').style.color = getHex(state.currentColor);
    document.getElementById('dir-icon').style.transform = state.direction === 1 ? 'rotate(0deg)' : 'rotate(180deg)';

    // Update Player Hand
    const pArea = document.getElementById('player-area');
    pArea.innerHTML = state.players[0].map((c, i) => `
        <div class="card" style="background:${getHex(c.color)}; color:white;" data-idx="${i}">${c.val}</div>
    `).join('');
    
    pArea.querySelectorAll('.card').forEach(el => {
        el.onclick = () => { if(state.turn === 0) playCard(0, parseInt(el.dataset.idx), state); };
    });

    // Update Bots
    for(let i=1; i<=3; i++) {
        const bArea = document.getElementById(`bot-${i}`);
        bArea.classList.toggle('active-player', state.turn === i);
        bArea.querySelector('.hand').innerHTML = state.players[i].map(() => `<div class="card card-back" style="width:15px; height:25px; font-size:4px;"></div>`).join('');
    }
}