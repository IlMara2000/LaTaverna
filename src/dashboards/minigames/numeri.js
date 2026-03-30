import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: NUMERI (Local Party Mode)
// Versione 100% Build-Safe per Vercel
// ==========================================

let gameData = {
    players: [], 
    playerNumbers: [],
    round: 1,
    currentIndex: 0
};

export function initNumeri(container) {
    updateSidebarContext("minigames");
    // Reset round ogni volta che si torna al setup
    gameData.round = 1; 
    renderSetup(container);
}

// --- UTILS UI ---
function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper" style="display: flex; gap: 10px; width: 100%; align-items: center; margin-bottom: 10px;">
            <input type="text" class="player-input" placeholder="Giocatore ${index + 1}" value="${value}" 
                   style="flex: 1; padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white; outline: none; font-family: inherit;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.1); border: 1px solid rgba(255, 65, 108, 0.3); color: #ff416c; width: 45px; height: 45px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 18px;">✕</span>
            </button>
        </div>
    `;
}

// --- 1. SETUP ---
function renderSetup(container) {
    const initialPlayers = gameData.players.length > 0 ? gameData.players : ["", "", ""];

    container.innerHTML = `
        <style>
            .num-bg { width: 100%; min-height: 100dvh; background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%); color: white; font-family: 'Poppins', sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; }
            .setup-card { width: 100%; max-width: 400px; background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); padding: 30px; border-radius: 28px; border: 1px solid rgba(255,255,255,0.05); text-align: center; }
            .btn-main { background: linear-gradient(45deg, #9d4ede, #c77dff); border: none; padding: 16px; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; transition: 0.3s; width: 100%; text-transform: uppercase; letter-spacing: 1px; }
            .btn-secondary { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 20px; border-radius: 12px; cursor: pointer; margin-bottom: 20px; font-size: 12px; align-self: flex-start; }
            .number-display { font-size: 3rem; font-weight: 900; color: #9d4ede; text-shadow: 0 0 20px rgba(157,78,221,0.5); margin: 20px 0; }
            
            /* Drag & Drop Styles */
            .sortable-list { width:100%; max-width:400px; list-style:none; padding:0; margin:20px 0; text-align: left; }
            .sortable-item { 
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                margin-bottom: 10px; padding: 15px; border-radius: 12px; cursor: grab;
                display: flex; justify-content: space-between; align-items: center; transition: 0.2s; font-weight: 700;
            }
            .sortable-item:active { cursor: grabbing; background: rgba(157, 78, 221, 0.2); }
            .sortable-item.dragging { opacity: 0.5; border: 1px dashed #9d4ede; }
        </style>

        <div class="num-bg">
            <h1 style="font-size: 3rem; font-weight: 900; background: linear-gradient(to right, #9d4ede, #c77dff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">NUMERI</h1>
            <p style="opacity: 0.5; margin-bottom: 30px;">Memorizza e Ordina</p>

            <div class="setup-card">
                <div id="player-inputs-container">
                    ${initialPlayers.map((name, i) => createPlayerInputHTML(name, i)).join('')}
                </div>
                <button id="add-player" style="background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: white; opacity: 0.6; padding: 12px; border-radius: 12px; cursor: pointer; width: 100%; margin: 15px 0;">+ AGGIUNGI GIOCATORE</button>
                <button id="start-game" class="btn-main">Inizia Partita</button>
            </div>
        </div>
    `;

    // USCITA DALLA PARTITA (SENZA IMPORT)
    container.querySelector('#btn-back-lobby').onclick = () => {
        window.location.hash = "lobby";
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

    container.addEventListener('click', (e) => {
        if (e.target.closest('.delete-player')) {
            const wrappers = container.querySelectorAll('.player-input-wrapper');
            if (wrappers.length > 2) {
                e.target.closest('.player-input-wrapper').remove();
            } else {
                e.target.closest('.player-input-wrapper').querySelector('input').value = "";
            }
        }
    });
}

// --- 2. LOGICA PARTITA E GENERAZIONE NUMERI ---
function startNewRound(container) {
    const totalNumbersNeeded = gameData.players.length * gameData.round;
    
    // Se sforiamo i 100 numeri disponibili, capiamo il round per evitare loop infiniti o crash
    if (totalNumbersNeeded > 100) {
        alert("Avete raggiunto il limite massimo di 100 numeri totali! La partita finirà qui.");
        return renderSetup(container); // Torna alla lobby/setup
    }

    const pool = Array.from({length: 100}, (_, i) => i + 1);
    const selected = [];
    
    for(let i = 0; i < totalNumbersNeeded; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        selected.push(pool.splice(idx, 1)[0]);
    }

    // Assegna i numeri e ordina internamente l'array del singolo giocatore per facilitare la lettura
    gameData.playerNumbers = gameData.players.map((name, i) => {
        return {
            name: name,
            numbers: selected.slice(i * gameData.round, (i + 1) * gameData.round).sort((a,b) => a - b)
        };
    });

    gameData.currentIndex = 0;
    renderReveal(container);
}

// --- 3. FASE REVEAL (PASSA IL TELEFONO) ---
function renderReveal(container) {
    const playerData = gameData.playerNumbers[gameData.currentIndex];

    container.innerHTML = `
        <div class="num-bg" style="justify-content: center; text-align: center;">
            <div style="background: rgba(157, 78, 221, 0.2); border: 1px solid #9d4ede; padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 20px; font-weight: 800; color: #c77dff;">ROUND ${gameData.round}</div>
            <p style="text-transform: uppercase; letter-spacing: 3px; opacity: 0.5;">Passa il telefono a</p>
            <h1 style="font-size: 3.5rem; font-weight: 900; color: #c77dff; margin-bottom: 40px;">${playerData.name}</h1>
            
            <div id="number-box" style="width: 100%; max-width: 320px; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 60px 20px; cursor: pointer; margin: 0 auto; transition: 0.3s;">
                <p id="number-text" style="font-weight: 800; opacity: 0.6;">TOCCA PER SCOPRIRE</p>
            </div>
            
            <button id="next-player" class="btn-main" style="display: none; margin-top: 40px; max-width: 280px; margin-left: auto; margin-right: auto;">HO MEMORIZZATO</button>
        </div>
    `;

    const box = container.querySelector('#number-box');
    box.onclick = () => {
        box.style.borderColor = "#9d4ede";
        // Uniamo i numeri con un pallino per la visualizzazione
        container.querySelector('#number-text').innerHTML = `<div class="number-display" style="margin:0;">${playerData.numbers.join(' • ')}</div>`;
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

// --- 4. FASE ORDINAMENTO (DRAG & DROP) ---
function renderOrdering(container) {
    container.innerHTML = `
        <div class="num-bg">
            <h1 style="font-size: 2.2rem; font-weight: 900; text-align: center; margin-bottom: 10px;">ORDINA I GIOCATORI</h1>
            <p style="opacity: 0.5; font-size: 13px; text-align: center; max-width: 300px;">Trascina i nomi dal numero più piccolo (sopra) al più grande (sotto).</p>
            
            <ul class="sortable-list" id="sortable-container">
                ${gameData.players.map(name => `
                    <li class="sortable-item" draggable="true" data-name="${name}">
                        <span>☰</span>
                        <span>${name}</span>
                    </li>
                `).join('')}
            </ul>
            
            <button id="check-result" class="btn-main" style="max-width:400px; margin-top: 20px;">CONFERMA ORDINE</button>
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

function getDragAfterElement(containerList, y) {
    const draggableElements = [...containerList.querySelectorAll('.sortable-item:not(.dragging)')];
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

// --- 5. FASE RISULTATO ---
function renderResult(container) {
    // Calcolo Media crescente per la Vittoria
    const items = [...container.querySelectorAll('.sortable-item')];
    const userOrder = items.map(item => item.dataset.name);
    
    const playerAverages = gameData.playerNumbers.map(p => ({
        name: p.name,
        avg: p.numbers.reduce((a,b) => a+b, 0) / p.numbers.length,
        nums: p.numbers
    })).sort((a,b) => a.avg - b.avg);

    const correctNames = playerAverages.map(p => p.name);
    const isCorrect = JSON.stringify(userOrder) === JSON.stringify(correctNames);

    container.innerHTML = `
        <div class="num-bg" style="justify-content: center; text-align: center;">
            <h1 style="font-size: 4rem; margin: 0;">${isCorrect ? '🏆' : '💀'}</h1>
            <h2 style="font-size: 2.5rem; font-weight: 900; color: ${isCorrect ? '#00ffa3' : '#ff416c'}; margin-bottom: 20px;">
                ${isCorrect ? 'VITTORIA!' : 'AVETE SBAGLIATO!'}
            </h2>
            
            <div class="setup-card" style="margin-bottom: 30px; text-align: left; background: rgba(0,0,0,0.4);">
                <p style="font-size: 12px; opacity: 0.5; margin-bottom: 15px; text-transform: uppercase;">Ordine esatto (in base alla media):</p>
                ${playerAverages.map(p => `
                    <div style="margin-bottom: 10px; display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 5px;">
                        <strong style="color: #c77dff;">${p.name}</strong> 
                        <span>${p.nums.join(', ')}</span>
                    </div>
                `).join('')}
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 300px;">
                <button id="next-round" class="btn-main" style="background: linear-gradient(45deg, #00ffa3, #00d2ff);">INIZIA ROUND ${gameData.round + 1}</button>
                <button id="change-players" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 16px; border-radius: 14px; cursor: pointer; font-weight: 800;">Cambia Nomi / Riavvia</button>
            </div>
        </div>
    `;

    container.querySelector('#next-round').onclick = () => {
        gameData.round++;
        startNewRound(container);
    };
    
    container.querySelector('#change-players').onclick = () => {
        initNumeri(container); // Riparte da round 1
    };
}