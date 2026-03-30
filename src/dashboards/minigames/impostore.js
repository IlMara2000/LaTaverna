import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: IMPOSTORE (Local Party Mode)
// Versione Avanzata: Impostori + Undercover
// ==========================================

let gameData = {
    players: [], 
    wordObj: { word: '', alt: '' },
    roles: [], // Array di oggetti { name, role: 'civil' | 'impostor' | 'undercover' }
    currentIndex: 0
};

// Database con coppie di parole simili per Undercover
const WORDS_DATABASE = [
    { word: "Pizza", alt: "Focaccia" },
    { word: "Colosseo", alt: "Arena" },
    { word: "Calcio", alt: "Calcetto" },
    { word: "Smartphone", alt: "Tablet" },
    { word: "Venezia", alt: "Amsterdam" },
    { word: "Leone", alt: "Tigre" },
    { word: "Cinema", alt: "Teatro" },
    { word: "Ferrari", alt: "Lamborghini" },
    { word: "Montagna", alt: "Collina" },
    { word: "Caffè", alt: "Tè" },
    { word: "Vino", alt: "Birra" },
    { word: "Gatto", alt: "Tigre" },
    { word: "Aeroplano", alt: "Elicottero" },
    { word: "Spiaggia", alt: "Scogliera" },
    { word: "Zaino", alt: "Borsa" }
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
    const initialPlayers = gameData.players.length > 0 ? gameData.players.map(p => p.name) : ["", "", ""];

    container.innerHTML = `
        <style>
            .impostore-bg { width: 100%; min-height: 100dvh; background: radial-gradient(circle at center, #1b2735 0%, #090a0f 100%); color: white; font-family: 'Poppins', sans-serif; display: flex; flex-direction: column; align-items: center; padding: 40px 20px; padding-bottom: calc(40px + env(safe-area-inset-bottom)); }
            .setup-card { width: 100%; max-width: 400px; background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); padding: 25px; border-radius: 28px; border: 1px solid rgba(255,255,255,0.05); }
            .btn-main { background: linear-gradient(45deg, #ff416c, #ff4b2b); border: none; padding: 16px; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; transition: 0.3s; width: 100%; text-transform: uppercase; letter-spacing: 1px; }
            .config-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; background: rgba(255,255,255,0.05); padding: 12px 18px; border-radius: 15px; }
            .config-row span { font-size: 14px; font-weight: 600; opacity: 0.8; }
            .config-row select { background: transparent; color: white; border: none; font-weight: 800; font-family: inherit; font-size: 16px; outline: none; cursor: pointer; }
        </style>

        <div class="impostore-bg">
            <h1 style="font-size: 2.5rem; font-weight: 900; background: linear-gradient(to right, #ff416c, #ff4b2b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 0;">IMPOSTORE</h1>
            <p style="opacity: 0.5; margin-bottom: 25px;">Settings Partita</p>

            <div class="setup-card">
                <div class="config-row">
                    <span>🕵️ Impostori</span>
                    <select id="select-impostors">
                        <option value="1">1</option><option value="2">2</option><option value="3">3</option>
                    </select>
                </div>
                <div class="config-row">
                    <span>🕶️ Undercover</span>
                    <select id="select-undercover">
                        <option value="0">0</option><option value="1">1</option><option value="2">2</option>
                    </select>
                </div>

                <div id="player-inputs-container" style="margin-top: 20px;">
                    ${initialPlayers.map((name, i) => createPlayerInputHTML(name, i)).join('')}
                </div>
                <button id="add-player" style="background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: white; opacity: 0.6; padding: 12px; border-radius: 12px; cursor: pointer; width: 100%; margin: 15px 0;">+ AGGIUNGI GIOCATORE</button>
                <button id="start-game" class="btn-main">Inizia Partita</button>
            </div>
        </div>
    `;

    container.querySelector('#add-player').onclick = () => {
        const cont = container.querySelector('#player-inputs-container');
        const idx = container.querySelectorAll('.player-input').length;
        const div = document.createElement('div');
        div.innerHTML = createPlayerInputHTML("", idx);
        cont.appendChild(div.firstElementChild);
    };

    container.querySelector('#start-game').onclick = () => {
        const names = Array.from(container.querySelectorAll('.player-input')).map(i => i.value.trim()).filter(n => n !== "");
        const numImp = parseInt(container.querySelector('#select-impostors').value);
        const numUnd = parseInt(container.querySelector('#select-undercover').value);

        if (names.length < (numImp + numUnd + 1)) {
            return alert(`Con questi ruoli servono almeno ${numImp + numUnd + 1} giocatori!`);
        }

        setupRoles(names, numImp, numUnd);
        startNewRound(container);
    };
}

function setupRoles(names, numImp, numUnd) {
    gameData.players = names.map(name => ({ name, role: 'civil' }));
    
    // Mescola indici
    let indices = [...Array(names.length).keys()].sort(() => Math.random() - 0.5);
    
    // Assegna Impostori
    for(let i=0; i<numImp; i++) gameData.players[indices.pop()].role = 'impostor';
    // Assegna Undercover
    for(let i=0; i<numUnd; i++) gameData.players[indices.pop()].role = 'undercover';
    
    // Scegli parola
    gameData.wordObj = WORDS_DATABASE[Math.floor(Math.random() * WORDS_DATABASE.length)];
}

function startNewRound(container) {
    gameData.currentIndex = 0;
    renderReveal(container);
}

function renderReveal(container) {
    const currentPlayer = gameData.players[gameData.currentIndex];

    container.innerHTML = `
        <div class="impostore-bg" style="justify-content: center; text-align: center;">
            <p style="text-transform: uppercase; letter-spacing: 3px; opacity: 0.5;">Passa il telefono a</p>
            <h1 style="font-size: 3rem; font-weight: 900; color: #ff416c; margin-bottom: 40px;">${currentPlayer.name}</h1>
            <div id="word-box" style="width: 100%; max-width: 320px; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 60px 20px; cursor: pointer; margin: 0 auto;">
                <p id="word-text" style="font-weight: 800; opacity: 0.6;">TOCCA PER SCOPRIRE IL RUOLO</p>
            </div>
            <button id="next-player" class="btn-main" style="display: none; margin-top: 40px; max-width: 280px; margin-left: auto; margin-right: auto;">HO VISTO</button>
        </div>
    `;

    const box = container.querySelector('#word-box');
    box.onclick = () => {
        let content = "";
        let color = "#00d2ff";

        if (currentPlayer.role === 'impostor') {
            color = "#ff416c";
            content = `<span style="color:${color}">SEI L'IMPOSTORE!</span><br><small style="opacity:0.5; font-size:12px;">Non hai nessuna parola.</small>`;
        } else if (currentPlayer.role === 'undercover') {
            color = "#ffbd00";
            content = `SEI UNDERCOVER<br>PAROLA: <span style="color:${color}">${gameData.wordObj.alt.toUpperCase()}</span>`;
        } else {
            content = `SEI CIVILE<br>PAROLA: <span style="color:${color}">${gameData.wordObj.word.toUpperCase()}</span>`;
        }

        box.style.borderColor = color;
        container.querySelector('#word-text').innerHTML = content;
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
            <h1 style="font-size: 2.2rem; font-weight: 900; margin-bottom: 10px;">DISCUSSIONE</h1>
            <p style="opacity:0.6; margin-bottom:30px;">Trovate chi non ha la parola giusta!</p>
            <div style="width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 12px;">
                ${gameData.players.map((p, i) => `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); padding: 16px 20px; border-radius: 18px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700;">${p.name}</span>
                        <button class="vote-btn" data-index="${i}" style="background: #ff416c; border: none; color: white; padding: 10px 15px; border-radius: 10px; font-weight: 800; cursor: pointer;">SVELA RUOLO</button>
                    </div>
                `).join('')}
            </div>
            <button id="end-round" class="btn-main" style="margin-top:30px; background: rgba(255,255,255,0.1);">Termina Partita</button>
        </div>
    `;

    container.querySelectorAll('.vote-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            const p = gameData.players[idx];
            alert(`${p.name} era: ${p.role.toUpperCase()}`);
        };
    });

    container.querySelector('#end-round').onclick = () => renderResult(container);
}

function renderResult(container) {
    const summary = gameData.players.map(p => 
        `<div style="margin-bottom:8px; font-size:14px;">${p.name}: <b style="color:${p.role === 'civil' ? '#00d2ff' : '#ff416c'}">${p.role.toUpperCase()}</b></div>`
    ).join('');

    container.innerHTML = `
        <div class="impostore-bg" style="justify-content: center; text-align: center;">
            <h2 style="font-size: 2rem; font-weight: 900; margin-bottom: 20px;">PARTITA CONCLUSA</h2>
            <div style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: 20px; width:100%; max-width:320px; margin-bottom:30px;">
                <p style="opacity:0.5; font-size:12px; margin-bottom:10px;">RUOLI ASSEGNATI:</p>
                ${summary}
                <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">
                <p style="color:#00d2ff">Civili: ${gameData.wordObj.word}</p>
                <p style="color:#ffbd00">Undercover: ${gameData.wordObj.alt}</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 300px;">
                <button id="replay" class="btn-main" style="background: linear-gradient(45deg, #00ffa3, #00d2ff);">Nuovo Round</button>
                <button id="change" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 16px; border-radius: 14px; cursor: pointer; font-weight: 800;">Modifica Impostazioni</button>
            </div>
        </div>
    `;

    container.querySelector('#replay').onclick = () => {
        setupRoles(gameData.players.map(p => p.name), 1, 0); // Default o prendi i vecchi valori
        startNewRound(container);
    };
    container.querySelector('#change').onclick = () => renderSetup(container);
}
