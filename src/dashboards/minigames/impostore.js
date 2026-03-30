import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: IMPOSTORE (Local Party Mode)
// Versione Avanzata: Impostori + Undercover
// ==========================================

let gameData = {
    players: [], 
    wordObj: { word: '', alt: '' },
    roles: [],
    currentIndex: 0,
    config: { impostors: 1, undercover: 0 }
};

const WORDS_DATABASE = [
    { word: "Pizza", alt: "Focaccia" }, { word: "Colosseo", alt: "Arena" },
    { word: "Calcio", alt: "Calcetto" }, { word: "Smartphone", alt: "Tablet" },
    { word: "Venezia", alt: "Amsterdam" }, { word: "Leone", alt: "Tigre" },
    { word: "Cinema", alt: "Teatro" }, { word: "Ferrari", alt: "Lamborghini" },
    { word: "Montagna", alt: "Collina" }, { word: "Caffè", alt: "Tè" },
    { word: "Vino", alt: "Birra" }, { word: "Aeroplano", alt: "Elicottero" },
    { word: "Spiaggia", alt: "Scogliera" }, { word: "Zaino", alt: "Borsa" }
];

export function initImpostore(container) {
    updateSidebarContext("minigames");
    
    // Blocco Scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    renderSetup(container);
}

function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper" style="display: flex; gap: 8px; width: 100%; align-items: center; margin-bottom: 8px;">
            <input type="text" class="player-input" placeholder="Giocatore ${index + 1}" value="${value}" 
                   style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; outline: none; font-size: 14px;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.1); border: none; color: #ff416c; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; font-weight: bold;">✕</button>
        </div>
    `;
}

// --- 1. SETUP (OTTIMIZZATO MOBILE) ---
function renderSetup(container) {
    const initialPlayers = gameData.players.length > 0 ? gameData.players.map(p => p.name) : ["", "", ""];

    container.innerHTML = `
        <style>
            .mobile-emulator { width: 100%; height: 100dvh; background: #05010a; display: flex; justify-content: center; align-items: center; }
            .impostore-wrapper { 
                width: 100%; max-width: 430px; height: 100%; max-height: 932px; 
                background: radial-gradient(circle at top, #1b2735 0%, #090a0f 100%); 
                color: white; font-family: 'Poppins', sans-serif; display: flex; flex-direction: column; padding: 20px; overflow-y: auto;
            }
            .setup-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(15px); padding: 20px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 80px; }
            .btn-main { background: linear-gradient(45deg, #9d4ede, #ff416c); border: none; padding: 16px; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; width: 100%; text-transform: uppercase; font-size: 14px; box-shadow: 0 4px 15px rgba(157, 78, 221, 0.3); }
            .config-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: rgba(255,255,255,0.05); padding: 10px 15px; border-radius: 12px; }
            .config-row select { background: transparent; color: #9d4ede; border: none; font-weight: 900; font-size: 16px; outline: none; }
            .main-title { font-family: 'Montserrat'; font-weight: 900; background: linear-gradient(to right, #9d4ede, #ff416c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-align: center; font-size: 2.2rem; margin-top: 20px; margin-bottom: 5px; }
        </style>

        <div class="mobile-emulator">
            <div class="impostore-wrapper">
                <h1 class="main-title">IMPOSTORE</h1>
                <p style="opacity: 0.5; text-align: center; font-size: 12px; margin-bottom: 25px;">LOCAL PARTY MODE</p>

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

                    <div id="player-inputs-container" style="margin-top: 15px;">
                        ${initialPlayers.map((name, i) => createPlayerInputHTML(name, i)).join('')}
                    </div>
                    <button id="add-player" style="background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: white; opacity: 0.6; padding: 10px; border-radius: 10px; cursor: pointer; width: 100%; margin: 10px 0; font-size: 11px;">+ AGGIUNGI GIOCATORE</button>
                    <button id="start-game" class="btn-main">Inizia Partita</button>
                </div>
            </div>
        </div>
    `;

    // Event Delegation per cancellazione
    container.querySelector('#player-inputs-container').onclick = (e) => {
        if (e.target.classList.contains('delete-player')) {
            e.target.closest('.player-input-wrapper').remove();
        }
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
        gameData.config.impostors = parseInt(container.querySelector('#select-impostors').value);
        gameData.config.undercover = parseInt(container.querySelector('#select-undercover').value);

        if (names.length < (gameData.config.impostors + gameData.config.undercover + 1)) {
            return alert(`Servono più giocatori per questi ruoli!`);
        }

        setupRoles(names, gameData.config.impostors, gameData.config.undercover);
        startNewRound(container);
    };
}

function setupRoles(names, numImp, numUnd) {
    gameData.players = names.map(name => ({ name, role: 'civil' }));
    let indices = [...Array(names.length).keys()].sort(() => Math.random() - 0.5);
    for(let i=0; i<numImp; i++) gameData.players[indices.pop()].role = 'impostor';
    for(let i=0; i<numUnd; i++) gameData.players[indices.pop()].role = 'undercover';
    gameData.wordObj = WORDS_DATABASE[Math.floor(Math.random() * WORDS_DATABASE.length)];
}

function startNewRound(container) {
    gameData.currentIndex = 0;
    renderReveal(container);
}

function renderReveal(container) {
    const currentPlayer = gameData.players[gameData.currentIndex];

    container.querySelector('.impostore-wrapper').innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; animation: fadeIn 0.5s;">
            <p style="text-transform: uppercase; letter-spacing: 2px; opacity: 0.5; font-size: 13px;">Passa il telefono a</p>
            <h1 style="font-size: 2.8rem; font-weight: 900; color: #9d4ede; margin-bottom: 30px; font-family:'Montserrat';">${currentPlayer.name}</h1>
            
            <div id="word-box" style="width: 100%; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 50px 20px; cursor: pointer; transition: 0.3s;">
                <p id="word-text" style="font-weight: 800; opacity: 0.7; font-size: 14px;">TOCCA PER SCOPRIRE IL RUOLO</p>
            </div>

            <button id="next-player" class="btn-main" style="display: none; margin-top: 30px; background: #9d4ede;">HO VISTO</button>
        </div>
    `;

    const box = container.querySelector('#word-box');
    box.onclick = () => {
        let content = "";
        let color = "#00d2ff";

        if (currentPlayer.role === 'impostor') {
            color = "#ff416c";
            content = `<span style="color:${color}; font-size: 24px;">SEI L'IMPOSTORE!</span><br><small style="opacity:0.5;">Fingi di avere la parola!</small>`;
        } else if (currentPlayer.role === 'undercover') {
            color = "#ffbd00";
            content = `SEI UNDERCOVER<br>PAROLA: <span style="color:${color}; font-size: 24px;">${gameData.wordObj.alt.toUpperCase()}</span>`;
        } else {
            content = `SEI CIVILE<br>PAROLA: <span style="color:${color}; font-size: 24px;">${gameData.wordObj.word.toUpperCase()}</span>`;
        }

        box.style.borderColor = color;
        box.style.background = "rgba(0,0,0,0.4)";
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
    container.querySelector('.impostore-wrapper').innerHTML = `
        <div style="animation: fadeIn 0.5s;">
            <h1 class="main-title" style="font-size: 1.8rem;">DISCUSSIONE</h1>
            <p style="opacity:0.6; text-align: center; margin-bottom:20px; font-size: 12px;">Descrivete la parola senza svelarla!</p>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${gameData.players.map((p, i) => `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px 15px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; font-size: 15px;">${p.name}</span>
                        <button class="vote-btn" data-index="${i}" style="background: #9d4ede; border: none; color: white; padding: 8px 12px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 11px;">RUOLO</button>
                    </div>
                `).join('')}
            </div>

            <button id="end-round" class="btn-main" style="margin-top:20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">Termina Partita</button>
        </div>
    `;

    container.querySelectorAll('.vote-btn').forEach(btn => {
        btn.onclick = () => {
            const p = gameData.players[parseInt(btn.getAttribute('data-index'))];
            alert(`${p.name} era: ${p.role.toUpperCase()}`);
        };
    });

    container.querySelector('#end-round').onclick = () => renderResult(container);
}

function renderResult(container) {
    const summary = gameData.players.map(p => 
        `<div style="margin-bottom:6px; font-size:13px;">${p.name}: <b style="color:${p.role === 'civil' ? '#00d2ff' : (p.role === 'impostor' ? '#ff416c' : '#ffbd00')}">${p.role.toUpperCase()}</b></div>`
    ).join('');

    container.querySelector('.impostore-wrapper').innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; animation: fadeIn 0.5s;">
            <h2 class="main-title" style="font-size: 1.8rem; margin-bottom: 20px;">RISULTATI</h2>
            <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 20px; width:100%; border: 1px solid rgba(255,255,255,0.08); margin-bottom:20px;">
                ${summary}
                <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">
                <p style="color:#00d2ff; font-size: 14px;">Civili: <b>${gameData.wordObj.word}</b></p>
                <p style="color:#ffbd00; font-size: 14px;">Undercover: <b>${gameData.wordObj.alt}</b></p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                <button id="replay" class="btn-main">Nuovo Round</button>
                <button id="change" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px; border-radius: 12px; font-weight: 800; font-size: 12px;">IMPOSTAZIONI</button>
            </div>
        </div>
    `;

    container.querySelector('#replay').onclick = () => {
        setupRoles(gameData.players.map(p => p.name), gameData.config.impostors, gameData.config.undercover);
        startNewRound(container);
    };
    container.querySelector('#change').onclick = () => renderSetup(container);
}
