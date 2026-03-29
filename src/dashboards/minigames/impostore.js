import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: IMPOSTORE (Local Party Mode)
// Versione Ottimizzata per Build Vercel
// ==========================================

let gameData = {
    players: [], 
    word: '',
    impostorIndex: null,
    currentIndex: 0
};

const WORDS_DATABASE = [
    "Pizza", "Colosseo", "Calcio", "Taverna", "Astronauta", "Chitarra", 
    "Smartphone", "Sushi", "Venezia", "Leone", "Internet", "Cinema", 
    "Harry Potter", "Ferrari", "Montagna", "Caffè", "Vino", "Giungla",
    "Gatto", "Orologio", "Aeroplano", "Spiaggia", "Zaino", "Toscana"
];

export function initImpostore(container) {
    updateSidebarContext("minigames");
    renderSetup(container);
}

// Helper per l'input dei giocatori
function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper" style="display: flex; gap: 10px; width: 100%; align-items: center; margin-bottom: 10px;">
            <input type="text" class="player-input" placeholder="Giocatore ${index + 1}" value="${value}" 
                   style="flex: 1; padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white; outline: none; font-family: inherit;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.1); border: 1px solid rgba(255, 65, 108, 0.3); color: #ff416c; width: 45px; height: 45px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.3s;">
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
            .impostore-bg { width: 100%; min-height: 100dvh; background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%); color: white; font-family: 'Poppins', sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; }
            .setup-card { width: 100%; max-width: 400px; background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); padding: 30px; border-radius: 28px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
            .btn-main { background: linear-gradient(45deg, #ff416c, #ff4b2b); border: none; padding: 16px; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; transition: 0.3s; width: 100%; text-transform: uppercase; letter-spacing: 1px; }
            .btn-main:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(255, 65, 108, 0.4); }
            .btn-secondary { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 20px; border-radius: 12px; cursor: pointer; margin-bottom: 20px; font-size: 12px; align-self: flex-start; }
        </style>

        <div class="impostore-bg">
            <button id="btn-back-lobby" class="btn-secondary">← ESCI</button>
            
            <h1 style="font-size: 3rem; font-weight: 900; background: linear-gradient(to right, #ff416c, #ff4b2b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 5px;">IMPOSTORE</h1>
            <p style="opacity: 0.5; margin-bottom: 35px;">Party Game Locale</p>

            <div class="setup-card">
                <div id="player-inputs-container">
                    ${initialPlayers.map((name, i) => createPlayerInputHTML(name, i)).join('')}
                </div>
                
                <button id="add-player" style="background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: white; opacity: 0.6; padding: 12px; border-radius: 12px; cursor: pointer; width: 100%; margin: 15px 0; font-weight: 600;">+ AGGIUNGI GIOCATORE</button>
                
                <button id="start-game" class="btn-main">Inizia Partita</button>
            </div>
        </div>
    `;

    // Listeners
    container.querySelector('#btn-back-lobby').onclick = async () => {
        // Usiamo import dinamico per evitare cicli di dipendenze che bloccano il build
        const { showLobby } = await import('../lobby.js');
        showLobby(container);
    };

    container.addEventListener('click', (e) => {
        if (e.target.closest('.delete-player')) {
            const wrappers = document.querySelectorAll('.player-input-wrapper');
            if (wrappers.length > 3) {
                e.target.closest('.player-input-wrapper').remove();
            } else {
                e.target.closest('.player-input-wrapper').querySelector('input').value = "";
            }
        }
    });

    document.getElementById('add-player').onclick = () => {
        const cont = document.getElementById('player-inputs-container');
        const idx = document.querySelectorAll('.player-input').length;
        const div = document.createElement('div');
        div.innerHTML = createPlayerInputHTML("", idx);
        cont.appendChild(div.firstElementChild);
    };

    document.getElementById('start-game').onclick = () => {
        const names = Array.from(document.querySelectorAll('.player-input')).map(i => i.value.trim()).filter(n => n !== "");
        if (names.length < 3) { return alert("Minimo 3 giocatori!"); }
        gameData.players = names;
        startNewRound(container);
    };
}

function startNewRound(container) {
    gameData.word = WORDS_DATABASE[Math.floor(Math.random() * WORDS_DATABASE.length)];
    gameData.impostorIndex = Math.floor(Math.random() * gameData.players.length);
    gameData.currentIndex = 0;
    renderReveal(container);
}

// --- 2. REVEAL ---
function renderReveal(container) {
    const isImp = gameData.currentIndex === gameData.impostorIndex;
    const player = gameData.players[gameData.currentIndex];

    container.innerHTML = `
        <div class="impostore-bg" style="justify-content: center; text-align: center;">
            <p style="text-transform: uppercase; letter-spacing: 3px; opacity: 0.5; margin-bottom: 10px;">Passa il telefono a</p>
            <h1 style="font-size: 3.5rem; font-weight: 900; color: #ff416c; margin-bottom: 40px;">${player}</h1>
            
            <div id="word-box" style="width: 100%; max-width: 320px; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 60px 20px; cursor: pointer; transition: 0.3s;">
                <p id="word-text" style="font-weight: 800; opacity: 0.6;">TOCCA PER SCOPRIRE</p>
            </div>

            <button id="next-player" class="btn-main" style="display: none; margin-top: 40px; max-width: 280px;">HO VISTO</button>
        </div>
    `;

    const box = document.getElementById('word-box');
    const text = document.getElementById('word-text');
    const btn = document.getElementById('next-player');

    box.onclick = () => {
        box.style.background = "rgba(255,255,255,0.07)";
        box.style.borderColor = isImp ? "#ff416c" : "#00d2ff";
        text.innerHTML = isImp ? 
            `<span style="color:#ff416c; font-size:1.4rem">SEI L'IMPOSTORE!</span>` : 
            `PAROLA:<br><span style="color:#00d2ff; font-size:1.8rem">${gameData.word.toUpperCase()}</span>`;
        text.style.opacity = "1";
        btn.style.display = "block";
        box.onclick = null;
    };

    btn.onclick = () => {
        if (gameData.currentIndex < gameData.players.length - 1) {
            gameData.currentIndex++;
            renderReveal(container);
        } else {
            renderGameField(container);
        }
    };
}

// --- 3. DISCUSSIONE ---
function renderGameField(container) {
    container.innerHTML = `
        <div class="impostore-bg">
            <h1 style="font-size: 2.2rem; font-weight: 900; margin-bottom: 30px;">DISCUSSIONE</h1>
            
            <div style="width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 12px;">
                ${gameData.players.map((name, i) => `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 16px 20px; border-radius: 18px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; font-size: 1.1rem;">${name}</span>
                        <button class="vote-btn" data-index="${i}" style="background: #ff416c; border: none; color: white; padding: 10px 15px; border-radius: 10px; font-weight: 800; cursor: pointer;">VOTA</button>
                    </div>
                `).join('')}
            </div>

            <div style="margin-top: 40px; background: rgba(0,210,255,0.1); padding: 20px; border-radius: 15px; border: 1px solid rgba(0,210,255,0.2); max-width: 320px; text-align: center;">
                <p style="font-size: 0.9rem; line-height: 1.4;">Dite una sola parola a testa per descrivere l'oggetto. L'impostore deve bluffare!</p>
            </div>
        </div>
    `;

    container.querySelectorAll('.vote-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            renderResult(container, idx === gameData.impostorIndex);
        };
    });
}

// --- 4. RISULTATO ---
function renderResult(container, isCorrect) {
    const impName = gameData.players[gameData.impostorIndex];
    
    container.innerHTML = `
        <div class="impostore-bg" style="justify-content: center; text-align: center;">
            <h1 style="font-size: 6rem; margin: 0;">${isCorrect ? '🏆' : '💀'}</h1>
            <h2 style="font-size: 2.5rem; font-weight: 900; color: ${isCorrect ? '#00ffa3' : '#ff416c'}; line-height: 1;">
                ${isCorrect ? 'IMPOSTORE<br>PRESO!' : 'L\'IMPOSTORE<br>HA VINTO!'}
            </h2>
            
            <div style="margin: 30px 0; padding: 25px; background: rgba(255,255,255,0.03); border-radius: 20px; width: 100%; max-width: 300px; border: 1px solid rgba(255,255,255,0.05);">
                <p style="opacity: 0.5; margin-bottom: 5px;">L'impostore era <b>${impName}</b></p>
                <p style="font-size: 1.4rem; font-weight: 800; color: #ff416c;">${gameData.word.toUpperCase()}</p>
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 300px;">
                <button id="replay" class="btn-main" style="background: linear-gradient(45deg, #00ffa3, #00d2ff);">Rigioca</button>
                <button id="change" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 16px; border-radius: 14px; font-weight: 800; cursor: pointer;">Cambia Giocatori</button>
            </div>
        </div>
    `;

    document.getElementById('replay').onclick = () => startNewRound(container);
    document.getElementById('change').onclick = () => renderSetup(container);
}