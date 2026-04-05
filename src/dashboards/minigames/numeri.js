import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: NUMERI (Local Party Mode)
// Versione Stabile 2.2 - Premium UI Borderless
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
    
    // Reset configurazione Scroll Mobile (Solo verticale per far scorrere i nomi)
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.position = 'relative';
    document.body.style.touchAction = 'pan-y'; 
    document.body.style.backgroundColor = '#05010a'; 
    window.scrollTo(0, 0);

    gameData.round = 1; 
    renderSetup(container);
}

const quitGame = async (container) => {
    document.body.style.touchAction = '';
    document.body.style.overflowX = '';
    document.body.style.backgroundColor = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        window.location.reload(); 
    }
};

function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper fade-in" style="display: flex; gap: 8px; width: 100%; align-items: center; margin-bottom: 12px; animation-duration: 0.3s;">
            <input type="text" class="player-input" placeholder="Giocatore ${index + 1}" value="${value}" 
                   style="flex: 1; padding: 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; outline: none; font-size: 14px; font-family: 'Poppins', sans-serif;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.15); border: 1px solid rgba(255,65,108,0.3); color: #ff416c; width: 48px; height: 48px; border-radius: 14px; cursor: pointer; font-weight: bold; transition: 0.2s;">✕</button>
        </div>
    `;
}

function renderSetup(container) {
    const initialPlayers = gameData.players.length > 0 ? gameData.players : ["", "", ""];

    container.innerHTML = `
        <style>
            .numeri-wrapper { 
                width: 100%; max-width: 500px; margin: 0 auto; color: white; font-family: 'Poppins', sans-serif;
                display: flex; flex-direction: column; padding: 20px; box-sizing: border-box;
                overflow-x: hidden; min-height: 80vh; justify-content: center;
            }
            .number-display { font-size: 3rem; font-weight: 900; color: #c77dff; text-shadow: 0 0 20px rgba(157,78,221,0.6); margin: 15px 0; word-break: break-all; line-height: 1.2; font-family: 'Montserrat', sans-serif; }
            
            .sortable-list { width:100%; list-style:none; padding:0; margin:20px 0; }
            .sortable-item { 
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
                margin-bottom: 10px; padding: 15px 20px; border-radius: 16px; cursor: grab; 
                display: flex; justify-content: space-between; align-items: center; 
                font-weight: 800; font-size: 15px; touch-action: none; transition: transform 0.2s;
            }
            .sortable-item.dragging { 
                opacity: 0.8; border: 2px dashed #9d4ede; background: rgba(157, 78, 221, 0.2); 
                transform: scale(1.02); box-shadow: 0 5px 15px rgba(157, 78, 221, 0.3);
            }
        </style>

        <div class="numeri-wrapper fade-in">
            <h1 class="main-title" style="margin-bottom: 5px;">NUMERI</h1>
            <p style="opacity: 0.5; text-align: center; font-size: 11px; margin-bottom: 30px; letter-spacing: 2px;">MEMORIZZA E ORDINA</p>

            <div style="width: 100%;">
                <div id="player-inputs-container">
                    ${initialPlayers.map((name, i) => createPlayerInputHTML(name, i)).join('')}
                </div>
                
                <button id="add-player" style="background: transparent; border: 1px dashed rgba(157, 78, 221, 0.4); color: var(--amethyst-light); padding: 14px; border-radius: 16px; cursor: pointer; width: 100%; margin: 10px 0 25px 0; font-size: 11px; font-weight: 800; letter-spacing: 1px; transition: 0.2s;">+ AGGIUNGI GIOCATORE</button>
                
                <button id="start-game" class="btn-primary" style="background: linear-gradient(45deg, #9d4ede, #c77dff); border: none; margin-bottom: 20px;">INIZIA PARTITA</button>
            </div>
            
            <button id="btn-quit" class="btn-back-glass">← TORNA ALLA LIBRERIA</button>
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
        <div class="fade-in" style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; min-height: 70vh;">
            <div style="background: rgba(157, 78, 221, 0.2); border: 1px solid #9d4ede; padding: 6px 16px; border-radius: 20px; font-size: 11px; margin-bottom: 25px; font-weight: 800; color: #c77dff; letter-spacing: 2px;">ROUND ${gameData.round}</div>
            
            <p style="text-transform: uppercase; letter-spacing: 2px; opacity: 0.5; font-size: 12px; margin-bottom: 5px;">Passa il telefono a</p>
            <h1 class="main-title" style="font-size: 3rem; margin-bottom: 40px; color: white; background: none; -webkit-text-fill-color: white;">${playerData.name}</h1>
            
            <div id="number-box" style="width: 100%; max-width: 350px; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 60px 20px; cursor: pointer; user-select: none; transition: 0.3s; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
                <p id="number-text" style="font-weight: 800; opacity: 0.4; font-size: 14px; letter-spacing: 2px;">TOCCA PER SCOPRIRE</p>
            </div>
            
            <button id="next-player" class="btn-primary" style="display: none; margin-top: 30px; background: #9d4ede; border: none; max-width: 350px;">HO MEMORIZZATO</button>
        </div>
    `;
    
    const box = container.querySelector('#number-box');
    box.onclick = function() {
        this.style.borderColor = 'var(--amethyst-bright)';
        this.style.background = 'rgba(157, 78, 221, 0.05)';
        container.querySelector('#number-text').innerHTML = `<div class="number-display fade-in">${playerData.numbers.join(' <span style="opacity:0.3">•</span> ')}</div>`;
        container.querySelector('#next-player').style.display = "block";
        this.onclick = null;
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
        <div class="fade-in" style="display:flex; flex-direction:column; height:100%; min-height: 80vh;">
            <h1 class="main-title" style="font-size: 2rem; margin-top: 20px; margin-bottom: 5px;">ORDINA I NOMI</h1>
            <p style="opacity: 0.5; font-size: 12px; text-align: center; margin-bottom: 20px;">Dal numero più piccolo al più grande.</p>
            
            <ul class="sortable-list" id="sortable-container">
                ${gameData.players.map(name => `
                    <li class="sortable-item" draggable="true" data-name="${name}">
                        <span style="opacity: 0.4;">☰</span>
                        <span style="font-size: 16px;">${name}</span>
                        <span style="opacity: 0.4;">↕</span>
                    </li>
                `).join('')}
            </ul>
            
            <div style="margin-top: auto; padding-top: 20px;">
                <button id="check-result" class="btn-primary" style="background: linear-gradient(45deg, #00ffa3, #00d2ff); border: none; color: black; margin-bottom: 0;">CONFERMA ORDINE</button>
            </div>
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
    list.addEventListener('touchstart', (e) => { 
        const item = e.target.closest('.sortable-item'); 
        if (item) { touchDraggingItem = item; item.classList.add('dragging'); } 
    }, { passive: false });
    
    list.addEventListener('touchmove', (e) => { 
        if (!touchDraggingItem) return; 
        e.preventDefault(); 
        const afterElement = getDragAfterElement(list, e.touches[0].clientY); 
        if (afterElement == null) list.appendChild(touchDraggingItem); 
        else list.insertBefore(touchDraggingItem, afterElement); 
    }, { passive: false });
    
    list.addEventListener('touchend', () => { 
        if (touchDraggingItem) { touchDraggingItem.classList.remove('dragging'); touchDraggingItem = null; } 
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
        <div class="fade-in" style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; min-height: 80vh;">
            <h1 style="font-size: 4rem; margin: 0; filter: drop-shadow(0 0 20px rgba(255,255,255,0.2));">${isCorrect ? '🏆' : '💀'}</h1>
            <h2 class="main-title" style="font-size: 2.5rem; color: ${isCorrect ? '#00ffa3' : '#ff416c'}; margin-bottom: 30px; background: none; -webkit-text-fill-color: ${isCorrect ? '#00ffa3' : '#ff416c'}; filter: none;">
                ${isCorrect ? 'VITTORIA!' : 'SBAGLIATO!'}
            </h2>
            
            <div style="width:100%; text-align: left; padding: 10px;">
                <p style="font-size: 10px; opacity: 0.5; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px;">Ordine Corretto:</p>
                ${playerAverages.map(p => `
                    <div style="margin-bottom: 12px; display: flex; justify-content: space-between; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
                        <span style="color: #c77dff; font-weight: 800;">${p.name}</span>
                        <span style="opacity: 0.8; font-family: monospace;">${p.nums.join(', ')}</span>
                    </div>
                `).join('')}
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; margin-top: 30px;">
                <button id="next-round" class="btn-primary" style="background: linear-gradient(45deg, #00ffa3, #00d2ff); border: none; color: black;">PROSSIMO ROUND</button>
                <button id="change-players" class="btn-back-glass">RIAVVIA PARTITA</button>
                <button id="btn-quit-end" class="btn-back-glass" style="border-color: rgba(255,68,68,0.3); color: #ff4444;">← ESCI DAL GIOCO</button>
            </div>
        </div>
    `;
    
    container.querySelector('#next-round').onclick = () => { gameData.round++; startNewRound(container); };
    container.querySelector('#change-players').onclick = () => initNumeri(container);
    container.querySelector('#btn-quit-end').onclick = (e) => { e.preventDefault(); quitGame(container); };
}
