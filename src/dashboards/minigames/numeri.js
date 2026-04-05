import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: NUMERI (Local Party Mode)
// Versione Stabile 2.0 - Anti-Crash & Vertical Scroll
// ==========================================

let gameData = {
    players: [], 
    playerNumbers: [],
    round: 1,
    currentIndex: 0
};

export function initNumeri(container) {
    if (!container) return;
    
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }
    
    // Reset configurazione Scroll Mobile (Solo verticale)
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.position = 'relative';
    document.body.style.touchAction = 'pan-y'; 
    window.scrollTo(0, 0);

    gameData.round = 1; 
    renderSetup(container);
}

const quitGame = async (container) => {
    document.body.style.touchAction = '';
    document.body.style.overflowX = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        window.location.reload(); 
    }
};

function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper" style="display: flex; gap: 8px; width: 100%; align-items: center; margin-bottom: 8px;">
            <input type="text" class="player-input" placeholder="Giocatore ${index + 1}" value="${value}" 
                   style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; outline: none; font-size: 16px;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.2); border: none; color: #ff416c; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; font-weight: bold;">✕</button>
        </div>
    `;
}

function renderSetup(container) {
    const initialPlayers = gameData.players.length > 0 ? gameData.players : ["", "", ""];

    container.innerHTML = `
        <style>
            @keyframes fadeInUpOnly {
                from { opacity: 0; transform: translateY(30px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .numeri-wrapper { 
                width: 100%; max-width: 600px; margin: 0 auto; color: white; font-family: 'Poppins', sans-serif;
                display: flex; flex-direction: column; padding: 20px; box-sizing: border-box;
                animation: fadeInUpOnly 0.6s ease-out forwards;
                overflow-x: hidden;
            }
            .setup-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(12px); padding: 25px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px; }
            .btn-main { background: linear-gradient(45deg, #9d4ede, #c77dff); border: none; padding: 16px; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; width: 100%; text-transform: uppercase; font-size: 14px; box-shadow: 0 4px 15px rgba(157, 78, 221, 0.3); }
            .number-display { font-size: 2.5rem; font-weight: 900; color: #9d4ede; text-shadow: 0 0 15px rgba(157,78,221,0.5); margin: 10px 0; word-break: break-all; }
            .sortable-list { width:100%; list-style:none; padding:0; margin:20px 0; }
            .sortable-item { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); margin-bottom: 8px; padding: 12px 15px; border-radius: 12px; cursor: grab; display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 14px; touch-action: none; }
            .sortable-item.dragging { opacity: 0.5; border: 1px dashed #9d4ede; background: rgba(157, 78, 221, 0.2); }
            .btn-exit-simple { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 15px; border-radius: 14px; cursor: pointer; width: 100%; font-size: 12px; font-weight: 700; margin-top: 10px; }
        </style>

        <div class="numeri-wrapper">
            <h1 style="text-align: center; margin-bottom: 5px; font-weight: 900; font-family: 'Montserrat';">NUMERI</h1>
            <p style="opacity: 0.5; text-align: center; font-size: 11px; margin-bottom: 25px;">MEMORIZZA E ORDINA</p>

            <div class="setup-card">
                <div id="player-inputs-container">
                    ${initialPlayers.map((name, i) => createPlayerInputHTML(name, i)).join('')}
                </div>
                <button id="add-player" style="background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: white; opacity: 0.6; padding: 10px; border-radius: 10px; cursor: pointer; width: 100%; margin: 10px 0; font-size: 11px;">+ AGGIUNGI GIOCATORE</button>
                <button id="start-game" class="btn-main">INIZIA PARTITA</button>
            </div>
            <button id="btn-quit" class="btn-exit-simple">← ESCI DAL GIOCO</button>
        </div>
    `;

    container.querySelector('#btn-quit').onclick = () => quitGame(container);

    container.querySelector('#add-player').onclick = () => {
        const cont = container.querySelector('#player-inputs-container');
        const div = document.createElement('div');
        div.innerHTML = createPlayerInputHTML("", cont.children.length);
        cont.appendChild(div.firstElementChild);
    };

    container.querySelector('#start-game').onclick = () => {
        const names = Array.from(container.querySelectorAll('.player-input')).map(i => i.value.trim()).filter(n => n !== "");
        if (names.length < 2) return alert("Minimo 2 giocatori!");
        gameData.players = names;
        startNewRound(container);
    };

    container.querySelector('#player-inputs-container').onclick = (e) => {
        if (e.target.closest('.delete-player')) {
            const wrappers = container.querySelectorAll('.player-input-wrapper');
            if (wrappers.length > 2) e.target.closest('.player-input-wrapper').remove();
            else e.target.closest('.player-input-wrapper').querySelector('input').value = "";
        }
    };
}

function startNewRound(container) {
    const totalNumbersNeeded = gameData.players.length * gameData.round;
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
    window.scrollTo(0, 0);
    renderReveal(container);
}

function renderReveal(container) {
    const playerData = gameData.playerNumbers[gameData.currentIndex];
    const wrapper = container.querySelector('.numeri-wrapper');
    wrapper.innerHTML = `
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; min-height: 70vh;">
            <div style="background: rgba(157, 78, 221, 0.2); border: 1px solid #9d4ede; padding: 4px 12px; border-radius: 20px; font-size: 11px; margin-bottom: 20px; font-weight: 800; color: #c77dff;">ROUND ${gameData.round}</div>
            <p style="text-transform: uppercase; letter-spacing: 2px; opacity: 0.5; font-size: 13px;">Passa il telefono a</p>
            <h1 style="font-size: 2.8rem; font-weight: 900; color: #c77dff; margin-bottom: 30px; font-family:'Montserrat';">${playerData.name}</h1>
            <div id="number-box" style="width: 100%; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 50px 20px; cursor: pointer; user-select: none;">
                <p id="number-text" style="font-weight: 800; opacity: 0.6; font-size: 14px;">TOCCA PER SCOPRIRE</p>
            </div>
            <button id="next-player" class="btn-main" style="display: none; margin-top: 30px; background: #9d4ede;">HO MEMORIZZATO</button>
        </div>
    `;
    const box = container.querySelector('#number-box');
    box.onclick = function() {
        container.querySelector('#number-text').innerHTML = `<div class="number-display">${playerData.numbers.join(' • ')}</div>`;
        container.querySelector('#next-player').style.display = "block";
        this.onclick = null;
    };
    container.querySelector('#next-player').onclick = () => {
        if (gameData.currentIndex < gameData.players.length - 1) { gameData.currentIndex++; renderReveal(container); }
        else renderOrdering(container);
    };
}

function renderOrdering(container) {
    const wrapper = container.querySelector('.numeri-wrapper');
    wrapper.innerHTML = `
        <div style="display:flex; flex-direction:column; height:100%; min-height: 70vh;">
            <h1 style="font-size: 1.8rem; font-weight: 900; text-align: center; margin-top: 10px;">ORDINA I NOMI</h1>
            <p style="opacity: 0.5; font-size: 11px; text-align: center; margin-bottom: 10px;">Dal numero più piccolo al più grande.</p>
            <ul class="sortable-list" id="sortable-container">
                ${gameData.players.map(name => `<li class="sortable-item" draggable="true" data-name="${name}"><span>☰</span><span>${name}</span></li>`).join('')}
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
    list.addEventListener('dragstart', (e) => { draggingItem = e.target; e.target.classList.add('dragging'); });
    list.addEventListener('dragend', (e) => e.target.classList.remove('dragging'));
    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(list, e.clientY);
        if (afterElement == null) list.appendChild(draggingItem); else list.insertBefore(draggingItem, afterElement);
    });
    let touchDraggingItem = null;
    list.addEventListener('touchstart', (e) => { const item = e.target.closest('.sortable-item'); if (item) { touchDraggingItem = item; item.classList.add('dragging'); } }, { passive: false });
    list.addEventListener('touchmove', (e) => { if (!touchDraggingItem) return; e.preventDefault(); const afterElement = getDragAfterElement(list, e.touches[0].clientY); if (afterElement == null) list.appendChild(touchDraggingItem); else list.insertBefore(touchDraggingItem, afterElement); }, { passive: false });
    list.addEventListener('touchend', () => { if (touchDraggingItem) { touchDraggingItem.classList.remove('dragging'); touchDraggingItem = null; } });
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
        <div style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; min-height: 70vh;">
            <h1 style="font-size: 3.5rem; margin: 0;">${isCorrect ? '🏆' : '💀'}</h1>
            <h2 style="font-size: 2rem; font-weight: 900; color: ${isCorrect ? '#00ffa3' : '#ff416c'}; margin-bottom: 20px;">${isCorrect ? 'VITTORIA!' : 'SBAGLIATO!'}</h2>
            <div class="setup-card" style="width:100%; text-align: left;">
                ${playerAverages.map(p => `<div style="margin-bottom: 8px; display: flex; justify-content: space-between; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;"><span style="color: #c77dff; font-weight: 800;">${p.name}</span><span>${p.nums.join(', ')}</span></div>`).join('')}
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                <button id="next-round" class="btn-main" style="background: linear-gradient(45deg, #00ffa3, #00d2ff);">PROSSIMO ROUND</button>
                <button id="change-players" class="btn-exit-simple" style="margin-bottom: 0;">RIAVVIA PARTITA</button>
                <button id="btn-quit-end" class="btn-exit-simple" style="border-color: rgba(255,68,68,0.3); color: #ff6b6b; margin-top: 10px;">← ESCI DAL GIOCO</button>
            </div>
        </div>
    `;
    container.querySelector('#next-round').onclick = () => { gameData.round++; startNewRound(container); };
    container.querySelector('#change-players').onclick = () => initNumeri(container);
    container.querySelector('#btn-quit-end').onclick = (e) => { e.preventDefault(); quitGame(container); };
}