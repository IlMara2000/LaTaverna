import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

let gameState = {
    players: ["Tu", "Marco", "Sofia", "Andrea"], // Esempio: in futuro arriveranno dalla lobby
    playerNumbers: [],
    round: 1,
    status: 'setup' // 'setup', 'reveal', 'ordering', 'result'
};

export function initNumeri(container) {
    updateSidebarContext("minigames");
    startNewGame();
    render(container);
}

function startNewGame() {
    // Genera numeri casuali univoci basati sul round
    // Esempio Round 1: 1 numero a testa. Round 2: 2 numeri a testa.
    const totalNumbersNeeded = gameState.players.length * gameState.round;
    const pool = Array.from({length: 100}, (_, i) => i + 1);
    const selected = [];
    
    for(let i=0; i<totalNumbersNeeded; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(idx, 1)[0]);
    }

    // Assegna i numeri ai giocatori
    gameState.playerNumbers = gameState.players.map((name, i) => {
        return {
            name: name,
            numbers: selected.slice(i * gameState.round, (i + 1) * gameState.round).sort((a,b) => a - b)
        };
    });

    gameState.status = 'reveal';
}

function render(container) {
    container.innerHTML = `
    <style>
        .num-bg { width:100%; min-height:100dvh; background:#05020a; color:white; font-family:'Inter',sans-serif; padding:40px 20px; display:flex; flex-direction:column; align-items:center; }
        .num-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:30px; width:100%; max-width:400px; text-align:center; }
        .number-display { font-size: 4rem; font-weight: 900; color: #9d4ede; text-shadow: 0 0 20px rgba(157,78,221,0.5); margin: 20px 0; }
        
        /* Lista Ordinabile */
        .sortable-list { width:100%; max-width:400px; list-style:none; padding:0; margin:20px 0; }
        .sortable-item { 
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            margin-bottom: 10px; padding: 15px; border-radius: 12px; cursor: grab;
            display: flex; justify-content: space-between; align-items: center; transition: 0.2s;
        }
        .sortable-item:active { cursor: grabbing; background: rgba(157, 78, 221, 0.2); }
        .sortable-item.dragging { opacity: 0.5; }

        .btn-game { width:100%; padding:15px; border-radius:12px; border:none; font-weight:800; cursor:pointer; transition:0.2s; }
        .btn-next { background: #9d4ede; color:white; }
        .btn-modify { background: rgba(255,255,255,0.1); color:white; margin-top:10px; font-size:13px; }
        .btn-exit { background: transparent; border: 1px solid #ff4444; color:#ff4444; margin-top:10px; font-size:11px; }
        
        .badge-round { background: #9d4ede; padding: 4px 12px; border-radius: 20px; font-size: 10px; margin-bottom: 10px; }
    </style>
    <div class="num-bg fade-in" id="game-content"></div>
    `;

    updateView(container);
}

function updateView(container) {
    const content = document.getElementById('game-content');

    if (gameState.status === 'reveal') {
        const myData = gameState.playerNumbers[0]; // "Tu"
        content.innerHTML = `
            <div class="badge-round">ROUND ${gameState.round}</div>
            <h1 style="font-weight:900;">IL TUO NUMERO</h1>
            <p style="opacity:0.5;">Memorizzalo e non dirlo a nessuno!</p>
            <div class="num-card">
                <div class="number-display">${myData.numbers.join(' • ')}</div>
                <button class="btn-game btn-next" id="go-to-ordering">HO MEMORIZZATO</button>
            </div>
        `;
        document.getElementById('go-to-ordering').onclick = () => {
            gameState.status = 'ordering';
            updateView(container);
        };
    } 

    else if (gameState.status === 'ordering') {
        content.innerHTML = `
            <h2 style="font-weight:900;">ORDINA I GIOCATORI</h2>
            <p style="opacity:0.5; font-size:13px;">Trascina i nomi dal numero più piccolo (sopra) al più grande (sotto).</p>
            <ul class="sortable-list" id="sortable">
                ${gameState.players.map(name => `
                    <li class="sortable-item" draggable="true" data-name="${name}">
                        <span>☰ ${name}</span>
                    </li>
                `).join('')}
            </ul>
            <button class="btn-game btn-next" id="check-result" style="max-width:400px;">CONFERMA ORDINE</button>
        `;
        initSortable();
        document.getElementById('check-result').onclick = () => checkLogic(container);
    }

    else if (gameState.status === 'result') {
        const isCorrect = checkVictory();
        content.innerHTML = `
            <h1 style="font-weight:900; color:${isCorrect ? '#33cc33' : '#ff4444'}">${isCorrect ? 'VITTORIA!' : 'AVETE SBAGLIATO'}</h1>
            <div class="num-card" style="margin-bottom:20px;">
                <p style="font-size:13px; opacity:0.7;">L'ordine corretto era:</p>
                <div style="text-align:left; margin-top:10px;">
                    ${getCorrectOrder().map(p => `<div><strong>${p.name}:</strong> ${p.numbers.join(', ')}</div>`).join('')}
                </div>
            </div>

            <div style="width:100%; max-width:400px; display:flex; flex-direction:column;">
                <button class="btn-game btn-next" id="btn-next-round">INIZIA ALTRA PARTITA (Round ${gameState.round + 1})</button>
                <button class="btn-game btn-modify" id="btn-mod-players">MODIFICA GIOCATORI</button>
                <button class="btn-game btn-exit" id="btn-back-lobby">ESCI E TORNA ALLA LIBRERIA</button>
            </div>
        `;

        document.getElementById('btn-next-round').onclick = () => {
            gameState.round++;
            startNewGame();
            updateView(container);
        };
        document.getElementById('btn-mod-players').onclick = () => initNumeri(container);
        document.getElementById('btn-back-lobby').onclick = () => showLobby(container);
    }
}

// --- LOGICA DRAG & DROP (Ordinamento) ---
function initSortable() {
    const list = document.getElementById('sortable');
    let draggingItem = null;

    list.addEventListener('dragstart', (e) => {
        draggingItem = e.target;
        e.target.classList.add('dragging');
    });

    list.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
    });

    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
        if (afterElement == null) {
            list.appendChild(draggingItem);
        } else {
            list.insertBefore(draggingItem, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.sortable-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// --- LOGICA VITTORIA ---
function getCorrectOrder() {
    // Appiattisce tutti i numeri associandoli al nome, poi ordina
    const allPairs = [];
    gameState.playerNumbers.forEach(p => {
        p.numbers.forEach(n => allPairs.push({name: p.name, num: n}));
    });
    return allPairs.sort((a,b) => a.num - b.num);
}

function checkVictory() {
    const items = [...document.querySelectorAll('.sortable-item')];
    const userOrder = items.map(item => item.dataset.name);
    
    // Per semplicità nel multiplayer locale: 
    // l'ordine è corretto se la media dei numeri dei giocatori è crescente
    const playerAverages = gameState.playerNumbers.map(p => ({
        name: p.name,
        avg: p.numbers.reduce((a,b) => a+b, 0) / p.numbers.length
    })).sort((a,b) => a.avg - b.avg);

    const correctNames = playerAverages.map(p => p.name);
    return JSON.stringify(userOrder) === JSON.stringify(correctNames);
}

function checkLogic(container) {
    gameState.status = 'result';
    updateView(container);
}