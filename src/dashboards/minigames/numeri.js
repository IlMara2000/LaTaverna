import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: NUMERI MASTER (Unified UI)
// Versione 2.3 - Fluid & Coherent
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
    
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = 'pan-y'; 
    window.scrollTo(0, 0);

    gameData.round = 1; 
    renderSetup(container);
}

const quitGame = async (container) => {
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) { window.location.reload(); }
};

function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper fade-in" style="display: flex; gap: 10px; width: 100%; align-items: center; margin-bottom: 12px;">
            <input type="text" class="player-input" placeholder="Nome Giocatore" value="${value}" 
                   style="flex: 1; padding: 15px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; outline: none; font-size: 16px;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.15); border: none; color: #ff416c; width: 48px; height: 48px; border-radius: 14px; cursor: pointer; font-weight: bold;">✕</button>
        </div>
    `;
}

function renderSetup(container) {
    const initialPlayers = gameData.players.length > 0 ? gameData.players : ["", "", ""];

    container.innerHTML = `
        <style>
            .master-wrapper { width: 100%; max-width: 500px; margin: 0 auto; color: white; display: flex; flex-direction: column; padding: 20px; box-sizing: border-box; animation: fadeInUp 0.6s ease-out; }
            .config-card { background: rgba(255,255,255,0.03); border-radius: 24px; padding: 25px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 20px; }
            .sortable-item { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); margin-bottom: 10px; padding: 15px 20px; border-radius: 18px; cursor: grab; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: 16px; touch-action: none; transition: 0.2s; }
            .sortable-item.dragging { opacity: 0.7; transform: scale(1.03); border-color: #9d4ede; }
        </style>

        <div class="master-wrapper">
            <h1 class="main-title" style="font-size: 3rem; margin-bottom: 5px;">NUMERI</h1>
            <p style="opacity: 0.5; text-align: center; font-size: 11px; margin-bottom: 30px; letter-spacing: 2px;">MEMORIZZA E ORDINA</p>

            <div class="config-card">
                <div id="inputs-area">${initialPlayers.map((n, i) => createPlayerInputHTML(n, i)).join('')}</div>
                <button id="add-p" style="background: transparent; border: 1px dashed rgba(157,78,221,0.4); color: #c77dff; padding: 15px; border-radius: 16px; width: 100%; margin: 15px 0; font-weight: 800; cursor:pointer;">+ AGGIUNGI GIOCATORE</button>
                <button id="start-btn" class="btn-primary" style="background: linear-gradient(45deg, #9d4ede, #c77dff); color: #000;">INIZIA PARTITA</button>
            </div>
            <button id="quit-btn" class="btn-back-glass">← TORNA ALLA LIBRERIA</button>
        </div>
    `;

    container.querySelector('#quit-btn').onclick = () => quitGame(container);
    container.querySelector('#add-p').onclick = () => {
        const area = container.querySelector('#inputs-area');
        area.insertAdjacentHTML('beforeend', createPlayerInputHTML("", area.children.length));
    };
    container.querySelector('#inputs-area').onclick = (e) => {
        if (e.target.closest('.delete-player')) e.target.closest('.player-input-wrapper').remove();
    };

    container.querySelector('#start-btn').onclick = () => {
        const names = Array.from(container.querySelectorAll('.player-input')).map(i => i.value.trim()).filter(n => n !== "");
        if (names.length < 2) return alert("Minimo 2 giocatori!");
        gameData.players = names;
        startNewRound(container);
    };
}

function startNewRound(container) {
    const pool = Array.from({length: 100}, (_, i) => i + 1);
    const selected = [];
    for(let i = 0; i < gameData.players.length * gameData.round; i++) {
        selected.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    gameData.playerNumbers = gameData.players.map((name, i) => ({
        name: name,
        numbers: selected.slice(i * gameData.round, (i + 1) * gameData.round).sort((a,b) => a - b)
    }));
    gameData.currentIndex = 0;
    renderReveal(container);
}

function renderReveal(container) {
    const p = gameData.playerNumbers[gameData.currentIndex];
    container.innerHTML = `
        <div class="master-wrapper" style="min-height: 80vh; justify-content: center; align-items: center; text-align: center;">
            <div style="background: rgba(157, 78, 221, 0.2); border: 1px solid #9d4ede; padding: 6px 16px; border-radius: 50px; font-size: 11px; font-weight: 800; color: #c77dff; letter-spacing: 2px; margin-bottom: 20px;">ROUND ${gameData.round}</div>
            <p style="opacity: 0.5; font-size: 12px; letter-spacing: 2px;">PASSA IL TELEFONO A</p>
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 40px; color: white; background: none; -webkit-text-fill-color: white;">${p.name}</h1>
            
            <div id="reveal-box" style="width: 100%; max-width: 350px; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.1); border-radius: 28px; padding: 60px 20px; cursor: pointer; transition: 0.3s; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
                <p id="reveal-text" style="font-weight: 800; opacity: 0.4; letter-spacing: 2px;">TOCCA PER SCOPRIRE</p>
            </div>
            
            <button id="next-btn" class="btn-primary" style="display: none; margin-top: 30px; max-width: 350px; background: #9d4ede; border: none;">HO MEMORIZZATO</button>
        </div>
    `;
    
    container.querySelector('#reveal-box').onclick = function() {
        this.style.borderColor = '#9d4ede';
        this.style.boxShadow = `0 0 30px rgba(157,78,221,0.3), inset 0 0 20px rgba(157,78,221,0.2)`;
        container.querySelector('#reveal-text').innerHTML = `<div style="font-size: 3rem; font-weight: 900; color: #c77dff; font-family: 'Montserrat';">${p.numbers.join(' <span style="opacity:0.2">•</span> ')}</div>`;
        container.querySelector('#next-btn').style.display = "block";
        this.onclick = null;
    };
    
    container.querySelector('#next-btn').onclick = () => {
        if (gameData.currentIndex < gameData.players.length - 1) { gameData.currentIndex++; renderReveal(container); }
        else renderOrdering(container);
    };
}

function renderOrdering(container) {
    container.innerHTML = `
        <div class="master-wrapper" style="min-height: 80vh; justify-content: center;">
            <h1 class="main-title" style="font-size: 2rem; margin-bottom: 5px;">ORDINA I NOMI</h1>
            <p style="opacity: 0.5; font-size: 12px; text-align: center; margin-bottom: 30px;">Trascina dal più piccolo al più grande.</p>
            
            <ul id="sort-list" style="list-style:none; padding:0; margin:0;">
                ${gameData.players.map(name => `<li class="sortable-item" draggable="true" data-name="${name}"><span>☰</span><span>${name}</span><span>↕</span></li>`).join('')}
            </ul>
            
            <button id="check-btn" class="btn-primary" style="background: linear-gradient(45deg, #00ffa3, #00d2ff); color: #000; border: none; margin-top: 40px;">CONFERMA ORDINE</button>
        </div>
    `;
    
    initSortable(container.querySelector('#sort-list'));
    container.querySelector('#check-btn').onclick = () => renderResult(container);
}

function initSortable(list) {
    let dragItem = null;
    const getTarget = (y) => {
        const els = [...list.querySelectorAll('.sortable-item:not(.dragging)')];
        return els.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset, element: child };
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    list.addEventListener('dragstart', (e) => { dragItem = e.target; dragItem.classList.add('dragging'); });
    list.addEventListener('dragend', () => dragItem.classList.remove('dragging'));
    list.addEventListener('dragover', (e) => { e.preventDefault(); const after = getTarget(e.clientY); if (!after) list.appendChild(dragItem); else list.insertBefore(dragItem, after); });

    // Mobile Touch Fix
    list.addEventListener('touchstart', (e) => { dragItem = e.target.closest('.sortable-item'); dragItem.classList.add('dragging'); }, {passive: false});
    list.addEventListener('touchmove', (e) => { e.preventDefault(); const after = getTarget(e.touches[0].clientY); if (!after) list.appendChild(dragItem); else list.insertBefore(dragItem, after); }, {passive: false});
    list.addEventListener('touchend', () => dragItem.classList.remove('dragging'));
}

function renderResult(container) {
    const userOrder = [...container.querySelectorAll('.sortable-item')].map(i => i.dataset.name);
    const sorted = gameData.playerNumbers.map(p => ({name: p.name, val: p.numbers.reduce((a,b)=>a+b,0)/p.numbers.length, nums: p.numbers})).sort((a,b) => a.val - b.val);
    const isCorrect = JSON.stringify(userOrder) === JSON.stringify(sorted.map(p=>p.name));
    
    container.innerHTML = `
        <div class="master-wrapper" style="min-height: 80vh; justify-content: center; align-items: center; text-align: center;">
            <h1 style="font-size: 4rem; margin:0;">${isCorrect ? '🏆' : '💀'}</h1>
            <h2 class="main-title" style="font-size: 2.2rem; color:${isCorrect?'#00ffa3':'#ff416c'}; background:none; -webkit-text-fill-color:${isCorrect?'#00ffa3':'#ff416c'};">${isCorrect ? 'VITTORIA!' : 'ERRORE!'}</h2>
            <div class="config-card" style="width:100%; text-align: left; margin-top: 20px;">
                ${sorted.map(p => `<div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:14px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:5px;"><span style="color:#c77dff; font-weight:800;">${p.name}</span><span style="opacity:0.8;">${p.nums.join(', ')}</span></div>`).join('')}
            </div>
            <button id="next-r" class="btn-primary" style="background: linear-gradient(45deg, #00ffa3, #00d2ff); color:#000;">PROSSIMO ROUND</button>
            <button id="quit" class="btn-back-glass" style="width:100%; margin-top:10px;">ESCI</button>
        </div>
    `;
    container.querySelector('#next-r').onclick = () => { gameData.round++; startNewRound(container); };
    container.querySelector('#quit').onclick = () => quitGame(container);
}