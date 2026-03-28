// ==========================================
// GIOCO: IMPOSTORE (Local Party Mode)
// ==========================================

let gameData = {
    players: [],
    word: '',
    impostorIndex: null,
    currentIndex: 0,
    isWordRevealed: false
};

const WORDS_DATABASE = [
    "Pizza", "Colosseo", "Calcio", "Taverna", "Astronauta", "Chitarra", 
    "Smartphone", "Sushi", "Venezia", "Leone", "Internet", "Cinema", 
    "Harry Potter", "Ferrari", "Montagna", "Caffè", "Vino", "Giungla"
];

export function initImpostore(container) {
    renderSetup(container);
}

// --- 1. SETUP: Numero Giocatori e Nomi ---
function renderSetup(container) {
    container.innerHTML = `
        <div style="width: 100%; min-height: 100dvh; padding: 40px 20px; display: flex; flex-direction: column; align-items: center;" class="fade-in">
            <button id="btn-back" style="align-self: flex-start; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 20px; border-radius: 12px; font-size: 12px; cursor: pointer; margin-bottom: 30px;">← ESCI</button>
            
            <h1 style="font-size: 2.5rem; font-weight: 900; color: #ff3366; margin-bottom: 10px;">IMPOSTORE</h1>
            <p style="opacity: 0.5; margin-bottom: 30px; text-align: center;">Inserisci i nomi dei partecipanti (Min. 3)</p>

            <div class="session-card" style="width: 100%; max-width: 400px; flex-direction: column; gap: 15px;">
                <div id="player-inputs-container" style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
                    <input type="text" class="player-input" placeholder="Giocatore 1" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.3); color: white;">
                    <input type="text" class="player-input" placeholder="Giocatore 2" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.3); color: white;">
                    <input type="text" class="player-input" placeholder="Giocatore 3" style="width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.3); color: white;">
                </div>
                <button id="add-player" style="background: transparent; border: 1px dashed #ff3366; color: #ff3366; padding: 10px; border-radius: 10px; cursor: pointer; font-size: 12px; font-weight: 800;">+ AGGIUNGI GIOCATORE</button>
                <button id="start-game" class="btn-primary" style="width: 100%; background: linear-gradient(135deg, #ff3366, #990033);">INIZIA PARTITA</button>
            </div>
        </div>
    `;

    document.getElementById('btn-back').onclick = async () => {
        const { showLobby } = await import('../lobby.js');
        showLobby(container);
    };

    document.getElementById('add-player').onclick = () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'player-input';
        input.placeholder = `Giocatore ${document.querySelectorAll('.player-input').length + 1}`;
        input.style = "width: 100%; padding: 12px; border-radius: 10px; border: 1px solid var(--glass-border); background: rgba(0,0,0,0.3); color: white;";
        document.getElementById('player-inputs-container').appendChild(input);
    };

    document.getElementById('start-game').onclick = () => {
        const inputs = document.querySelectorAll('.player-input');
        const names = Array.from(inputs).map(i => i.value.trim()).filter(n => n !== "");
        
        if (names.length < 3) {
            alert("Servono almeno 3 giocatori!");
            return;
        }

        gameData.players = names;
        gameData.word = WORDS_DATABASE[Math.floor(Math.random() * WORDS_DATABASE.length)];
        gameData.impostorIndex = Math.floor(Math.random() * names.length);
        gameData.currentIndex = 0;
        
        renderReveal(container);
    };
}

// --- 2. REVEAL: Passa il telefono ---
function renderReveal(container) {
    const isImpostor = gameData.currentIndex === gameData.impostorIndex;
    const currentPlayer = gameData.players[gameData.currentIndex];

    container.innerHTML = `
        <div style="width: 100%; min-height: 100dvh; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center;" class="fade-in">
            <h2 style="font-size: 1.2rem; opacity: 0.6; letter-spacing: 2px;">TOCCA A:</h2>
            <h1 style="font-size: 3rem; font-weight: 900; margin-bottom: 40px; color: #ff3366;">${currentPlayer}</h1>
            
            <div id="word-box" style="width: 100%; max-width: 350px; background: var(--glass-bg); border: 2px solid var(--glass-border); border-radius: 30px; padding: 50px 20px; text-align: center; cursor: pointer; transition: 0.3s;">
                <p id="word-text" style="font-size: 1.5rem; font-weight: 800; letter-spacing: 2px;">CLICCA PER VEDERE LA PAROLA</p>
            </div>

            <p style="margin-top: 30px; font-size: 12px; opacity: 0.4; text-align: center;">Assicurati che gli altri non guardino!</p>
            
            <button id="next-player" style="display: none; margin-top: 40px; width: 100%; max-width: 300px;" class="btn-primary">HO VISTO, PASSA AL PROSSIMO</button>
        </div>
    `;

    const wordBox = document.getElementById('word-box');
    const wordText = document.getElementById('word-text');
    const nextBtn = document.getElementById('next-player');

    wordBox.onclick = () => {
        wordBox.style.borderColor = "#ff3366";
        wordBox.style.background = "rgba(255, 51, 102, 0.1)";
        wordText.innerText = isImpostor ? "SEI L'IMPOSTORE!" : `PAROLA: ${gameData.word.toUpperCase()}`;
        if (isImpostor) wordText.style.color = "#ff3366";
        nextBtn.style.display = "block";
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

// --- 3. GAME FIELD: Discussione e Votazione ---
function renderGameField(container) {
    container.innerHTML = `
        <div style="width: 100%; min-height: 100dvh; padding: 40px 20px; display: flex; flex-direction: column; align-items: center;" class="fade-in">
            <h1 style="font-size: 2rem; font-weight: 900; color: #ff3366; margin-bottom: 30px;">DISCUSSIONE</h1>
            
            <div style="width: 100%; max-width: 500px; display: grid; gap: 15px;">
                ${gameData.players.map((name, i) => `
                    <div style="background: var(--glass-bg); border: 1px solid var(--glass-border); padding: 20px; border-radius: 15px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 800;">${name}</span>
                        <button onclick="window.votaImpostore(${i})" style="background: #ff3366; border: none; color: white; padding: 8px 15px; border-radius: 8px; font-size: 10px; font-weight: 900; cursor: pointer;">VOTA</button>
                    </div>
                `).join('')}
            </div>

            <div style="margin-top: 40px; padding: 20px; border-radius: 15px; background: rgba(255,255,255,0.03); text-align: center; max-width: 400px;">
                <p style="font-size: 14px; opacity: 0.7;">A turno, dite una sola parola che descriva la parola segreta. Poi votate chi secondo voi sta mentendo!</p>
            </div>
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
        <div style="width: 100%; min-height: 100dvh; padding: 40px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center;" class="fade-in">
            <h1 style="font-size: 4rem; margin-bottom: 10px;">${isCorrect ? '🎉' : '💀'}</h1>
            <h2 style="font-size: 2.5rem; font-weight: 900; color: ${isCorrect ? '#00ff88' : '#ff3366'}; text-align: center;">
                ${isCorrect ? 'IMPOSTORE TROVATO!' : 'AVETE SBAGLIATO!'}
            </h2>
            <p style="font-size: 1.2rem; margin-top: 20px; opacity: 0.8;">L'impostore era: <b>${impostorName}</b></p>
            <p style="font-size: 1rem; opacity: 0.5;">La parola era: ${gameData.word}</p>

            <button id="restart-impostore" class="btn-primary" style="margin-top: 50px; width: 100%; max-width: 300px;">GIOCA ANCORA</button>
        </div>
    `;

    document.getElementById('restart-impostore').onclick = () => renderSetup(container);
}
