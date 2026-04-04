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
    
    // FIX: Rimossi position: fixed e touch-action: none per bug iOS.
    // Aggiunto background match per evitare il bug dei "due sfondi" visibili
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.backgroundColor = '#090a0f'; // Uniforma lo sfondo base al gioco

    renderSetup(container);
}

function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper" style="display: flex; gap: 8px; width: 100%; align-items: center; margin-bottom: 8px;">
            <input type="text" class="player-input" placeholder="Giocatore ${index + 1}" value="${value}" 
                   style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; outline: none; font-size: 16px;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.1); border: none; color: #ff416c; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; font-weight: bold; -webkit-tap-highlight-color: transparent; outline: none;">✕</button>
        </div>
    `;
}

// --- 1. SETUP (OTTIMIZZATO MOBILE E PC) ---
function renderSetup(container) {
    const initialPlayers = gameData.players.length > 0 ? gameData.players.map(p => p.name) : ["", "", ""];

    container.innerHTML = `
        <style>
            .impostore-wrapper { 
                width: 100%; max-width: 430px; height: 100dvh; margin: 0 auto;
                background: radial-gradient(circle at top, rgba(27,39,53,0.8) 0%, rgba(9,10,15,0.9) 100%); 
                color: white; font-family: 'Poppins', sans-serif; 
                display: flex; flex-direction: column; 
                padding: calc(20px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom)) 20px; 
                overflow-y: auto; -webkit-overflow-scrolling: touch;
                animation: cardEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
                box-sizing: border-box;
            }

            @media (min-width: 431px) {
                .impostore-wrapper { border-radius: 30px; border: 1px solid rgba(255,255,255,0.1); height: 90dvh; margin-top: 5vh; }
            }

            .setup-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(15px); padding: 20px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 20px; }
            .btn-main { background: linear-gradient(45deg, #9d4ede, #ff416c); border: none; padding: 16px; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; width: 100%; text-transform: uppercase; font-size: 14px; box-shadow: 0 4px 15px rgba(157, 78, 221, 0.3); -webkit-tap-highlight-color: transparent; outline: none; }
            .config-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: rgba(255,255,255,0.05); padding: 10px 15px; border-radius: 12px; }
            .config-row select { background: transparent; color: #9d4ede; border: none; font-weight: 900; font-size: 16px; outline: none; }
            .main-title { font-family: 'Montserrat'; font-weight: 900; background: linear-gradient(to right, #9d4ede, #ff416c); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-align: center; font-size: 2.2rem; margin-top: 10px; margin-bottom: 5px; }
            
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            
            .impostore-wrapper::-webkit-scrollbar { display: none; }
        </style>

        <div class="impostore-wrapper">
            <div style="flex-shrink: 0;">
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
                    <button id="add-player" style="background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: white; opacity: 0.6; padding: 10px; border-radius: 10px; cursor: pointer; width: 100%; margin: 10px 0; font-size: 11px; -webkit-tap-highlight-color: transparent; outline: none;">+ AGGIUNGI GIOCATORE</button>
                    <button id="start-game" class="btn-main" style="margin-top: 10px;">INIZIA PARTITA</button>
                </div>
                
                <button id="btn-quit" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px; border-radius: 14px; font-weight: 800; width: 100%; font-size: 12px; -webkit-tap-highlight-color: transparent; outline: none;">← ESCI DAL GIOCO</button>
            </div>
        </div>
    `;

    container.querySelector('#btn-quit').onclick = () => {
        document.documentElement.style.overflow = '';
        document.documentElement.style.overscrollBehavior = '';
        document.body.style.overflow = '';
        document.body.style.overscrollBehavior = '';
        document.body.style.backgroundColor = ''; // Ripristina lo sfondo base
        window.location.hash = "lobby";
    };

    container.querySelector('#player-inputs-container').onclick = (e) => {
        const deleteBtn = e.target.closest('.delete-player');
        if (deleteBtn) {
            deleteBtn.closest('.player-input-wrapper').remove();
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
        const inputs = Array.from(container.querySelectorAll('.player-input'));
        const names = inputs.map(i => i.value.trim()).filter(n => n !== "");
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
    const wrapper = container.querySelector('.impostore-wrapper');

    wrapper.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; animation: fadeIn 0.4s ease-out;">
            <p style="text-transform: uppercase; letter-spacing: 2px; opacity: 0.5; font-size: 13px;">Passa il telefono a</p>
            <h1 style="font-size: 2.8rem; font-weight: 900; color: #9d4ede; margin-bottom: 30px; font-family:'Montserrat';">${currentPlayer.name}</h1>
            
            <div id="word-box" style="width: 100%; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 50px 20px; cursor: pointer; transition: 0.3s; -webkit-tap-highlight-color: transparent;">
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
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; animation: fadeIn 0.4s ease-out;">
            <h1 class="main-title" style="font-size: 1.8rem;">DISCUSSIONE</h1>
            <p style="opacity:0.6; text-align: center; margin-bottom:20px; font-size: 12px;">Descrivete la parola senza svelarla!</p>
            
            <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px;">
                ${gameData.players.map((p, i) => `
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px 15px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; font-size: 15px;">${p.name}</span>
                        <button class="vote-btn" data-index="${i}" style="background: #9d4ede; border: none; color: white; padding: 8px 12px; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 11px; -webkit-tap-highlight-color: transparent; outline: none;">RUOLO</button>
                    </div>
                `).join('')}
            </div>

            <button id="end-round" class="btn-main" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; box-shadow: none;">Termina Partita</button>
        </div>
    `;

    container.querySelectorAll('.vote-btn').forEach(btn => {
        btn.onclick = () => {
            const p = gameData.players[parseInt(btn.getAttribute('data-index'))];
            alert(`${p.name} era: ${p.role.toUpperCase()}`);
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        };
    });

    container.querySelector('#end-round').onclick = () => renderResult(container);
}

function renderResult(container) {
    const summary = gameData.players.map(p => 
        `<div style="margin-bottom:6px; font-size:13px;">${p.name}: <b style="color:${p.role === 'civil' ? '#00d2ff' : (p.role === 'impostor' ? '#ff416c' : '#ffbd00')}">${p.role.toUpperCase()}</b></div>`
    ).join('');

    container.querySelector('.impostore-wrapper').innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; animation: fadeIn 0.4s ease-out;">
            <h2 class="main-title" style="font-size: 1.8rem; margin-bottom: 20px;">RISULTATI</h2>
            <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 20px; width:100%; border: 1px solid rgba(255,255,255,0.08); margin-bottom:30px;">
                ${summary}
                <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">
                <p style="color:#00d2ff; font-size: 14px;">Civili: <b>${gameData.wordObj.word}</b></p>
                <p style="color:#ffbd00; font-size: 14px;">Undercover: <b>${gameData.wordObj.alt}</b></p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
                <button id="replay" class="btn-main">NUOVO ROUND</button>
                <button id="change" style="background: transparent; border: 1px solid rgba(255,255,255,0.1); color: white; padding: 14px; border-radius: 14px; font-weight: 800; font-size: 12px; -webkit-tap-highlight-color: transparent; outline: none;">IMPOSTAZIONI</button>
            </div>
        </div>
    `;

    container.querySelector('#replay').onclick = () => {
        setupRoles(gameData.players.map(p => p.name), gameData.config.impostors, gameData.config.undercover);
        startNewRound(container);
    };
    container.querySelector('#change').onclick = () => renderSetup(container);
}
