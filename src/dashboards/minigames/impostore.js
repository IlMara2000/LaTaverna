import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: IMPOSTORE (Local Party Mode)
// ==========================================

let gameData = {
    players: [], // Nomi salvati
    word: '',
    impostorIndex: null,
    currentIndex: 0
};

const WORDS_DATABASE = [
    "Pizza", "Colosseo", "Calcio", "Taverna", "Astronauta", "Chitarra", 
    "Smartphone", "Sushi", "Venezia", "Leone", "Internet", "Cinema", 
    "Harry Potter", "Ferrari", "Montagna", "Caffè", "Vino", "Giungla",
    "Gatto", "Orologio", "Aeroplano", "Spiaggia", "Pizza", "Zaino"
];

export function initImpostore(container) {
    renderSetup(container);
}

// Helper per generare l'input del giocatore con il cestino
function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper" style="display: flex; gap: 10px; width: 100%; align-items: center;">
            <input type="text" class="player-input" placeholder="Giocatore ${index + 1}" value="${value}" style="flex: 1; padding: 12px; border-radius: 10px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.3); color: white; outline: none;">
            <button class="delete-player" style="background: rgba(255, 51, 102, 0.1); border: 1px solid rgba(255, 51, 102, 0.3); color: #ff3366; padding: 10px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 16px;">🗑️</span>
            </button>
        </div>
    `;
}

// --- 1. SETUP: Nomi e Gestione Giocatori ---
function renderSetup(container) {
    // Se non ci sono giocatori, ne mettiamo 3 vuoti di base
    const initialPlayers = gameData.players.length > 0 ? gameData.players : ["", "", ""];

    container.innerHTML = `
        <div style="width: 100%; min-height: 100dvh; padding: 40px 20px 100px 20px; display: flex; flex-direction: column; align-items: center;" class="fade-in">
            <button id="btn-back-lobby" style="align-self: flex-start; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 20px; border-radius: 12px; font-size: 12px; cursor: pointer; margin-bottom: 30px;">← ESCI</button>
            
            <h1 style="font-size: 2.5rem; font-weight: 900; color: #ff3366; margin-bottom: 10px;">IMPOSTORE</h1>
            <p style="opacity: 0.5; margin-bottom: 30px; text-align: center;">Chi siede al tavolo?</p>

            <div class="session-card" style="width: 100%; max-width: 400px; flex-direction: column; gap: 15px; background: var(--glass-bg); padding: 25px; border-radius: 24px;">
                <div id="player-inputs-container" style="width: 100%; display: flex; flex-direction: column; gap: 12px;">
                    ${initialPlayers.map((name, i) => createPlayerInputHTML(name, i)).join('')}
                </div>
                
                <button id="add-player" style="background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: white; opacity: 0.6; padding: 12px; border-radius: 10px; cursor: pointer; font-size: 11px; font-weight: 800; margin-top: 10px;">+ AGGIUNGI GIOCATORE</button>
                
                <button id="start-game" class="btn-primary" style="width: 100%; background: linear-gradient(135deg, #ff3366, #990033); margin-top: 10px;">INIZIA PARTITA</button>
            </div>
        </div>
    `;

    // Listener Cestini
    container.addEventListener('click', (e) => {
        if (e.target.closest('.delete-player')) {
            const wrapper = e.target.closest('.player-input-wrapper');
            if (document.querySelectorAll('.player-input-wrapper').length > 3) {
                wrapper.remove();
            } else {
                wrapper.querySelector('input').value = ""; // Svuota se sono solo 3
            }
        }
    });

    document.getElementById('btn-back-lobby').onclick = async () => {
        const { showLobby } = await import('../lobby.js');
        showLobby(container);
    };

    document.getElementById('add-player').onclick = () => {
        const containerInputs = document.getElementById('player-inputs-container');
        const index = document.querySelectorAll('.player-input').length;
        const div = document.createElement('div');
        div.innerHTML = createPlayerInputHTML("", index);
        containerInputs.appendChild(div.firstElementChild);
    };

    document.getElementById('start-game').onclick = () => {
        const inputs = document.querySelectorAll('.player-input');
        const names = Array.from(inputs).map(i => i.value.trim()).filter(n => n !== "");
        
        if (names.length < 3) {
            alert("Minimo 3 giocatori per giocare, oste!");
            return;
        }

        gameData.players = names; // Salva i nomi per la prossima volta
        startNewRound(container);
    };
}

// Funzione per resettare i dati del round e partire
function startNewRound(container) {
    gameData.word = WORDS_DATABASE[Math.floor(Math.random() * WORDS_DATABASE.length)];
    gameData.impostorIndex = Math.floor(Math.random() * gameData.players.length);
    gameData.currentIndex = 0;
    renderReveal(container);
}

// --- 2. REVEAL: Passa il telefono ---
function renderReveal(container) {
    const isImpostor = gameData.currentIndex === gameData.impostorIndex;
    const currentPlayer = gameData.players[gameData.currentIndex];

    container.innerHTML = `
        <div style="width: 100%; min-height: 100dvh; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center;" class="fade-in">
            <h2 style="font-size: 1.2rem; opacity: 0.6; letter-spacing: 2px; text-transform: uppercase;">Passa a</h2>
            <h1 style="font-size: 3.5rem; font-weight: 900; margin-bottom: 40px; color: #ff3366;">${currentPlayer}</h1>
            
            <div id="word-box" style="width: 100%; max-width: 350px; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.1); border-radius: 30px; padding: 60px 20px; text-align: center; cursor: pointer;">
                <p id="word-text" style="font-size: 1.2rem; font-weight: 800; letter-spacing: 1px; opacity: 0.7;">TOCCA PER SCOPRIRE IL RUOLO</p>
            </div>

            <button id="next-player" style="display: none; margin-top: 40px; width: 100%; max-width: 300px;" class="btn-primary">HO VISTO</button>
        </div>
    `;

    const wordBox = document.getElementById('word-box');
    const wordText = document.getElementById('word-text');
    const nextBtn = document.getElementById('next-player');

    wordBox.onclick = () => {
        wordBox.style.borderColor = "#ff3366";
        wordText.innerText = isImpostor ? "SEI L'IMPOSTORE!" : `PAROLA: ${gameData.word.toUpperCase()}`;
        wordText.style.opacity = "1";
        if (isImpostor) wordText.style.color = "#ff3366";
        nextBtn.style.display = "block";
        wordBox.onclick = null; // Impedisce doppi click
    };

    nextBtn.onclick = () => {
        if (gameData.currentIndex < gameData.players.length - 1) {
            gameData.currentIndex++;
            renderReveal(container);
        } else {
            renderGameField(container);
        }
    };
}

// --- 3. GAME FIELD ---
function renderGameField(container) {
    container.innerHTML = `
        <div style="width: 100%; min-height: 100dvh; padding: 40px 20px; display: flex; flex-direction: column; align-items: center;" class="fade-in">
            <h1 style="font-size: 2rem; font-weight: 900; color: #ff3366; margin-bottom: 30px;">DISCUSSIONE</h1>
            
            <div style="width: 100%; max-width: 500px; display: grid; gap: 12px; width: 100%;">
                ${gameData.players.map((name, i) => `
                    <div style="background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 18px; border-radius: 18px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 800; font-size: 1.1rem;">${name}</span>
                        <button onclick="window.votaImpostore(${i})" style="background: #ff3366; border: none; color: white; padding: 10px 18px; border-radius: 10px; font-size: 11px; font-weight: 900; cursor: pointer; letter-spacing: 1px;">VOTA</button>
                    </div>
                `).join('')}
            </div>

            <p style="margin-top: 40px; padding: 20px; opacity: 0.5; text-align: center; font-size: 13px; max-width: 300px;">
                Descrivete la parola con un solo termine a testa. Se votate l'impostore, vincono i civili!
            </p>
        </div>
    `;

    window.votaImpostore = (index) => {
        const isCorrect = index === gameData.impostorIndex;
        renderResult(container, isCorrect);
    };
}

// --- 4. RESULT: Vittoria o Sconfitta ---
function renderResult(container, isCorrect) {
    const impostorName = gameData.players[gameData.impostorIndex];
    
    container.innerHTML = `
        <div style="width: 100%; min-height: 100dvh; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;" class="fade-in">
            <h1 style="font-size: 5rem; margin-bottom: 10px;">${isCorrect ? '🏆' : '💀'}</h1>
            <h2 style="font-size: 2rem; font-weight: 900; color: ${isCorrect ? '#00ff88' : '#ff3366'}; line-height: 1.1;">
                ${isCorrect ? 'IMPOSTORE<br>SMASCHERATO!' : 'L\'IMPOSTORE<br>HA VINTO!'}
            </h2>
            
            <div style="margin-top: 30px; padding: 20px; background: rgba(255,255,255,0.03); border-radius: 20px; width: 100%; max-width: 300px;">
                <p style="font-size: 1rem; opacity: 0.6;">L'impostore era <b>${impostorName}</b></p>
                <p style="font-size: 1.2rem; font-weight: 800; color: #ff3366; margin-top: 5px;">${gameData.word.toUpperCase()}</p>
            </div>

            <div style="display: flex; flex-direction: column; gap: 15px; width: 100%; max-width: 300px; margin-top: 40px;">
                <button id="replay-same" class="btn-primary" style="background: linear-gradient(135deg, #00ff88, #009955); box-shadow: 0 8px 20px rgba(0, 255, 136, 0.2);">STESSI GIOCATORI</button>
                <button id="change-names" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 15px; border-radius: 16px; font-weight: 800; cursor: pointer;">MODIFICA GIOCATORI</button>
                <button id="exit-game" style="background: transparent; color: white; opacity: 0.4; font-size: 12px; cursor: pointer; border: none; text-decoration: underline;">Torna alla Libreria</button>
            </div>
        </div>
    `;

    // Rigioca subito (Stessa lista nomi, parola nuova)
    document.getElementById('replay-same').onclick = () => startNewRound(container);

    // Torna al setup (nomi salvati negli input)
    document.getElementById('change-names').onclick = () => renderSetup(container);

    // Torna alla lobby
    document.getElementById('exit-game').onclick = async () => {
        const { showLobby } = await import('../lobby.js');
        showLobby(container);
    };
}