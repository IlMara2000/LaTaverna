import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: IMPOSTORE (Local Party Mode)
// Versione 100% Build-Safe per Vercel
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
            .impostore-bg { width: 100%; min-height: 100dvh; background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%); color: white; font-family: 'Poppins', sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; }
            .setup-card { width: 100%; max-width: 400px; background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); padding: 30px; border-radius: 28px; border: 1px solid rgba(255,255,255,0.05); }
            .btn-main { background: linear-gradient(45deg, #ff416c, #ff4b2b); border: none; padding: 16px; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; transition: 0.3s; width: 100%; text-transform: uppercase; letter-spacing: 1px; }
            .btn-secondary { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 20px; border-radius: 12px; cursor: pointer; margin-bottom: 20px; font-size: 12px; align-self: flex-start; }
        </style>

        <div class="impostore-bg">
            <button id="btn-back-lobby" class="btn-secondary">← ESCI</button>
            <h1 style="font-size: 3rem; font-weight: 900; background: linear-gradient(to right, #ff416c, #ff4b2b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">IMPOSTORE</h1>
            <p style="opacity: 0.5; margin-bottom: 30px;">Party Game Locale</p>

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
        // Emette un evento che il tuo main.js o router può ascoltare per tornare alla lobby
        const event = new CustomEvent('navigate', { detail: 'lobby' });
        window.dispatchEvent(event);
        // Fallback: se usi gli hash per le rotte
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
        if (names.length < 3) return alert("Minimo 3 giocatori!");
        gameData.players = names;
        startNewRound(container);
    };

    container.addEventListener('click', (e) => {
        if (e.target.closest('.delete-player')) {
            const wrappers = container.querySelectorAll('.player-input-wrapper');
            if (wrappers.length > 3) {
                e.target.closest('.player-input-wrapper').remove();
            } else {
                e.target.closest('.player-input-wrapper').querySelector('input').value = "";
            }
        }
    });
}

function startNewRound(container) {
    gameData.word = WORDS_DATABASE[Math.floor(Math.random() * WORDS_DATABASE.length)];
    gameData.impostorIndex = Math.floor(Math.random() * gameData.players.length);
    gameData.currentIndex = 0;
    renderReveal(container);
}

function renderReveal(container) {
    const isImp = gameData.currentIndex === gameData.impostorIndex;
    const player = gameData.players[gameData.currentIndex];

    container.innerHTML = `
        <div class="impostore-bg" style="justify-content: center; text-align: center;">
            <p style="text-transform: uppercase; letter-spacing: 3px; opacity: 0.5;">Passa il telefono a</p>
            <h1 style="font-size: 3.5rem; font-weight: 900; color: #ff416c; margin-bottom: 40px;">${player}</h1>
            <div id="word-box" style="width: 100%; max-width: 320px; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 60px 20px; cursor: pointer; margin: 0 auto;">
                <p id="word-text" style="font-weight: 800; opacity: 0.6;">TOCCA PER SCOPRIRE</p>
            </div>
            <button id="next-player" class="btn-main" style="display: none; margin-top: 40px; max-width: 280px; margin-left: auto; margin-right: auto;">HO VISTO</button>
        </div>
    `;

    const box = container.querySelector('#word-box');
    box.onclick = () => {
        box.style.borderColor = isImp ? "#ff416c" : "#00d2ff";
        container.querySelector('#word-text').innerHTML = isImp ? 
            `<span style="color:#ff416c">SEI L'IMPOSTORE!</span>` : 
            `PAROLA: <span style="color:#00d2ff">${gameData.word.toUpperCase()}</span>`;
        container.querySelector('#next-player').style.display = "block";
        box.onclick = null;
    };

    container.querySelector('#next-player').onclick = () => {
        if (gameData.currentIndex < gameData.players.length - 1) {
            gameData.currentIndex++;
            renderReveal(container);
        } else {
            renderGameField(container);
        }
    };
}

function renderGameField(container) {
    container.innerHTML = `
        <div class="impostore-bg">
            <h1 style="font-size: 2.2rem; font-weight: 900; margin-bottom: 30px;">DISCUSSIONE</h1>
            <div style="width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 12px;">
                ${gameData.players.map((name, i) => `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 16px 20px; border-radius: 18px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700;">${name}</span>
                        <button class="vote-btn" data-index="${i}" style="background: #ff416c; border: none; color: white; padding: 10px 15px; border-radius: 10px; font-weight: 800; cursor: pointer;">VOTA</button>
                    </div>
                `).join('')}
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

function renderResult(container, isCorrect) {
    const impName = gameData.players[gameData.impostorIndex];
    container.innerHTML = `
        <div class="impostore-bg" style="justify-content: center; text-align: center;">
            <h1 style="font-size: 5rem; margin: 0;">${isCorrect ? '🏆' : '💀'}</h1>
            <h2 style="font-size: 2.5rem; font-weight: 900; color: ${isCorrect ? '#00ffa3' : '#ff416c'};">
                ${isCorrect ? 'PRESO!' : 'VINCE L\'IMPOSTORE!'}
            </h2>
            <p style="opacity: 0.6;">L'impostore era <b>${impName}</b></p>
            <p style="font-size: 1.5rem; font-weight: 800; color: #ff416c;">${gameData.word.toUpperCase()}</p>
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 300px; margin-top: 30px;">
                <button id="replay" class="btn-main" style="background: linear-gradient(45deg, #00ffa3, #00d2ff);">Rigioca</button>
                <button id="change" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 16px; border-radius: 14px; cursor: pointer; font-weight: 800;">Cambia Nomi</button>
            </div>
        </div>
    `;

    container.querySelector('#replay').onclick = () => startNewRound(container);
    container.querySelector('#change').onclick = () => renderSetup(container);
}