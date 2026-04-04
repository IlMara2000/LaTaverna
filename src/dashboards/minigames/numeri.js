import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: NUMERI (Local Party Mode)
// Versione Mobile-First per PC/Smartphone
// ==========================================

let gameData = {
    players: [], 
    playerNumbers: [],
    round: 1,
    currentIndex: 0
};

export function initNumeri(container) {
    updateSidebarContext("minigames");
    
    // FIX: Sblocco totale dello scroll, niente position fixed che rompe il layout.
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'auto';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    document.body.style.backgroundColor = '';
    window.scrollTo(0, 0);

    gameData.round = 1; 
    renderSetup(container);
}

// --- Funzione centralizzata per uscire in sicurezza ---
const quitGame = async (container) => {
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.backgroundColor = '';
    
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        window.location.hash = "lobby"; 
    }
};

function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper" style="display: flex; gap: 8px; width: 100%; align-items: center; margin-bottom: 8px;">
            <input type="text" class="player-input" placeholder="Giocatore ${index + 1}" value="${value}" 
                   style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; outline: none; font-size: 16px;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.1); border: none; color: #ff416c; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; font-weight: bold; -webkit-tap-highlight-color: transparent; outline: none;">✕</button>
        </div>
    `;
}

// --- 1. SETUP ---
function renderSetup(container) {
    const initialPlayers = gameData.players.length > 0 ? gameData.players : ["", "", ""];

    container.innerHTML = `
        <style>
            /* Wrapper INVISIBILE: si appoggia al CSS globale */
            .numeri-wrapper { 
                width: 100%; 
                max-width: 600px; 
                margin: 0 auto;
                color: white; 
                font-family: 'Poppins', sans-serif; 
                display: flex; 
                flex-direction: column; 
                justify-content: center;
                min-height: 75vh;
                padding-bottom: calc(120px + env(safe-area-inset-bottom)); /* Aria in basso per Hamburger */
                animation: cardEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
            }

            .setup-card { 
                background: var(--glass-surface, rgba(255,255,255,0.03)); 
                backdrop-filter: blur(12px); 
                padding: 28px 20px; 
                border-radius: 28px; 
                border: 1px solid var(--glass-border, rgba(255,255,255,0.1)); 
                margin-bottom: 20px; 
            }
            .btn-main { background: linear-gradient(45deg, #9d4ede, #c77dff); border: none; padding: 16px; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; width: 100%; text-transform: uppercase; font-size: 14px; -webkit-tap-highlight-color: transparent; outline: none; box-shadow: 0 4px 15px rgba(157, 78, 221, 0.3); }
            .btn-main:active { transform: scale(0.95); }
            .number-display { font-size: 2.5rem; font-weight: 900; color: #9d4ede; text-shadow: 0 0 15px rgba(157,78,221,0.5); margin: 10px 0; word-break: break-all; }
            
            .sortable-list { width:100%; list-style:none; padding:0; margin:20px 0; }
            .sortable-item { 
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                margin-bottom: 8px; padding: 12px 15px; border-radius: 12px; cursor: grab;
                display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 14px; touch-action: none;
            }
            .sortable-item.dragging { opacity: 0.5; border: 1px dashed #9d4ede; background: rgba(157, 78, 221, 0.2); }
            .main-title { font-family: 'Montserrat'; font-weight: 900; background: linear-gradient(to right, #9d4ede, #c77dff); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-align: center; font-size: 2.5rem; margin-top: 10px; }
            
            @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        </style>

        <div class="numeri-wrapper">
            <h1 class="main-title">NUMERI</h1>
            <p style="opacity: 0.5; text-align: center; font-size: 12px; margin-bottom: 25px;">MEMORIZZA E ORDINA</p>

            <div class="setup-card">
                <div id="player-inputs-container">
                    ${initialPlayers.map((name, i) => createPlayerInputHTML(name, i)).join('')}
                </div>
                <button id="add-player" style="background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: white; opacity: 0.6; padding: 10px; border-radius: 10px; cursor: pointer; width: 100%; margin: 10px 0; font-size: 11px; -webkit-tap-highlight-color: transparent; outline: none;">+ AGGIUNGI GIOCATORE</button>
                <button id="start-game" class="btn-main" style="margin-top: 10px;">INIZIA PARTITA</button>
            </div>

            <button id="btn-quit" class="btn-back-glass" style="width: 100%; padding: 15px; font-size: 12px;">← ESCI DAL GIOCO</button>
        </div>
    `;

    // FIX: Sostituito window.location.hash
    container.querySelector('#btn-quit').onclick = (e) => {
        e.preventDefault();
        quitGame(container);
    };

    container.querySelector('#add-player').onclick = () => {
        const cont = container.querySelector('#player-inputs-container');
        const idx = container.querySelectorAll('.player-input').length;
        const div = document.createElement('div');
        div.innerHTML = createPlayerInputHTML("", idx);
        cont.appendChild(div.firstElementChild);
    };

    container.querySelector('#start-game').onclick = () => {
        const names = Array.from(container.querySelectorAll('.player-input')).map(i => i.value.trim()).filter(n => n !== "");
        if (names.length < 2) return alert("Minimo 2 giocatori!");
        gameData.players = names;
        startNewRound(container);
    };

    container.querySelector('#player-inputs-container').onclick = (e) => {
        if (e.target.classList.contains('delete-player')) {
            const wrappers = container.querySelectorAll('.player-input-wrapper');
            if (wrappers.length > 2) {
                e.target.closest('.player-input-wrapper').remove();
            } else {
                e.target.closest('.player-input-wrapper').querySelector('input').value = "";
            }
        }
    };
}

function startNewRound(container) {
    const totalNumbersNeeded = gameData.players.length * gameData.round;
    if (totalNumbersNeeded > 100) {
        alert("Limite raggiunto!");
        return renderSetup(container);
    }

    const pool = Array.from({length: 100}, (_, i) => i + 1);
    const selected = [];
    for(let i = 0; i < totalNumbersNeeded; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(idx, 1)[0]);
    }

    gameData.playerNumbers = gameData.players.map((name, i) => ({
        name: name,
        numbers: selected.slice(i * gameData.round, (i + 1) * gameData.round).sort((a,b) => a - b)
    }));

    gameData.currentIndex = 0;
    window.scrollTo(0, 0); // Scorre in cima quando ricarica
    renderReveal(container);
}

function renderReveal(container) {
    const playerData = gameData.playerNumbers[gameData.currentIndex];
    const wrapper = container.querySelector('.numeri-wrapper');

    wrapper.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; animation: fadeIn 0.4s ease-out;">
            <div style="background: rgba(157, 78, 221, 0.2); border: 1px solid #9d4ede; padding: 4px 12px; border-radius: 20px; font-size: 11px; margin-bottom: 20px; font-weight: 800; color: #c77dff;">ROUND ${gameData.round}</div>
            <p style="text-transform: uppercase; letter-spacing: 2px; opacity: 0.5; font-size: 13px;">Passa il telefono a</p>
            <h1 style="font-size: 2.8rem; font-weight: 900; color: #c77dff; margin-bottom: 30px; font-family:'Montserrat';">${playerData.name}</h1>
            
            <div id="number-box" style="width: 100%; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 50px 20px; cursor: pointer; transition: 0.3s; -webkit-tap-highlight-color: transparent; outline: none; user-select: none;">
                <p id="number-text" style="font-weight: 800; opacity: 0.6; font-size: 14px;">TOCCA PER SCOPRIRE</p>
            </div>
            
            <button id="next-player" class="btn-main" style="display: none; margin-top: 30px; background: #9d4ede;">HO MEMORIZZATO</button>
        </div>
    `;

    const box = container.querySelector('#number-box');
    box.onclick = () => {
        box.style.borderColor = "#9d4ede";
        box.style.background = "rgba(0,0,0,0.3)";
        container.querySelector('#number-text').innerHTML = `<div class="number-display">${playerData.numbers.join(' • ')}</div>`;
        container.querySelector('#next-player').style.display = "block";
        box.onclick = null;
    };

    container.querySelector('#next-player').onclick = () => {
        if (gameData.currentIndex < gameData.players.length - 1) {
            gameData.currentIndex++;
            renderReveal(container);
        } else {
            renderOrdering(container);
        }
    };
}

function renderOrdering(container) {
    const wrapper = container.querySelector('.numeri-wrapper');
    wrapper.innerHTML = `
        <div style="display:flex; flex-direction:column; height:100%; animation: fadeIn 0.4s ease-out;">
            <h1 style="font-size: 1.8rem; font-weight: 900; text-align: center; margin-top: 10px;">ORDINA I NOMI</h1>
            <p style="opacity: 0.5; font-size: 11px; text-align: center; margin-bottom: 10px;">Dal numero più piccolo (sopra) al più grande (sotto).</p>
            
            <ul class="sortable-list" id="sortable-container">
                ${gameData.players.map(name => `
                    <li class="sortable-item" draggable="true" data-name="${name}">
                        <span>☰</span>
                        <span>${name}</span>
                    </li>
                `).join('')}
            </ul>
            
            <button id="check-result" class="btn-main" style="margin-top: auto; margin-bottom: 20px;">CONFERMA ORDINE</button>
        </div>
    `;

    initSortable(container);
    container.querySelector('#check-result').onclick = () => renderResult(container);
}

function initSortable(container) {
    const list = container.querySelector('#sortable-container');
    let draggingItem = null;

    list.addEventListener('dragstart', (e) => {
        draggingItem = e.target;
        e.target.classList.add('dragging');
    });

    list.addEventListener('dragend', (e) => e.target.classList.remove('dragging'));

    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
        if (afterElement == null) list.appendChild(draggingItem);
        else list.insertBefore(draggingItem, afterElement);
    });

    // Supporto Touch per Mobile
    let touchDraggingItem = null;
    list.addEventListener('touchstart', (e) => {
        const item = e.target.closest('.sortable-item');
        if (item) {
            touchDraggingItem = item;
            item.classList.add('dragging');
        }
    }, { passive: false });

    list.addEventListener('touchmove', (e) => {
        if (!touchDraggingItem) return;
        e.preventDefault();
        const touch = e.touches[0];
        const afterElement = getDragAfterElement(list, touch.clientY);
        if (afterElement == null) list.appendChild(touchDraggingItem);
        else list.insertBefore(touchDraggingItem, afterElement);
    }, { passive: false });

    list.addEventListener('touchend', (e) => {
        if (touchDraggingItem) {
            touchDraggingItem.classList.remove('dragging');
            touchDraggingItem = null;
        }
    });
}

function getDragAfterElement(containerList, y) {
    const draggableElements = [...containerList.querySelectorAll('.sortable-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function renderResult(container) {
    const items = [...container.querySelectorAll('.sortable-item')];
    const userOrder = items.map(item => item.dataset.name);
    
    const playerAverages = gameData.playerNumbers.map(p => ({
        name: p.name,
        avg: p.numbers.reduce((a,b) => a+b, 0) / p.numbers.length,
        nums: p.numbers
    })).sort((a,b) => a.avg - b.avg);

    const correctNames = playerAverages.map(p => p.name);
    const isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctNames);

    const wrapper = container.querySelector('.numeri-wrapper');
    wrapper.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; animation: fadeIn 0.4s ease-out;">
            <h1 style="font-size: 3.5rem; margin: 0;">${isCorrect ? '🏆' : '💀'}</h1>
            <h2 style="font-size: 2rem; font-weight: 900; color: ${isCorrect ? '#00ffa3' : '#ff416c'}; margin-bottom: 20px;">
                ${isCorrect ? 'VITTORIA!' : 'SBAGLIATO!'}
            </h2>
            
            <div class="setup-card" style="width:100%; text-align: left;">
                <p style="font-size: 10px; opacity: 0.5; margin-bottom: 10px; text-transform: uppercase;">Soluzione:</p>
                ${playerAverages.map(p => `
                    <div style="margin-bottom: 8px; display: flex; justify-content: space-between; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">
                        <span style="color: #c77dff; font-weight: 800;">${p.name}</span> 
                        <span>${p.nums.join(', ')}</span>
                    </div>
                `).join('')}
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                <button id="next-round" class="btn-main" style="background: linear-gradient(45deg, #00ffa3, #00d2ff);">PROSSIMO ROUND</button>
                <button id="change-players" class="btn-back-glass" style="width: 100%; padding: 15px; font-size: 12px; margin-bottom: 0;">RIAVVIA NUOVA PARTITA</button>
                <button id="btn-quit-end" class="btn-back-glass" style="width: 100%; padding: 15px; font-size: 12px; border-color: rgba(255,68,68,0.3); color: #ff6b6b; margin-top: 10px;">← ESCI DAL GIOCO</button>
            </div>
        </div>
    `;

    container.querySelector('#next-round').onclick = () => {
        gameData.round++;
        startNewRound(container);
    };
    container.querySelector('#change-players').onclick = () => initNumeri(container);
    container.querySelector('#btn-quit-end').onclick = (e) => { e.preventDefault(); quitGame(container); };
}
