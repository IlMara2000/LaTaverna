import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: IMPOSTORE (Local Party Mode)
// Versione Blindata anti-crash
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
    if (!container) return;
    updateSidebarContext("minigames");
    
    // Reset dello scroll
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.position = '';
    document.body.style.touchAction = '';
    document.body.style.backgroundColor = '#090a0f'; 
    window.scrollTo(0, 0);

    renderSetup(container);
}

const quitGame = async (container) => {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.position = '';
    
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        console.error("Navigazione fallita:", e);
        window.location.reload(); 
    }
};

function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper" style="display: flex; gap: 8px; width: 100%; align-items: center; margin-bottom: 8px;">
            <input type="text" class="player-input" placeholder="Giocatore ${index + 1}" value="${value}" 
                   style="flex: 1; padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; outline: none; font-size: 16px;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.2); border: none; color: #ff416c; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; font-weight: bold;">✕</button>
        </div>
    `;
}

function renderSetup(container) {
    const initialPlayers = gameData.players && gameData.players.length > 0 ? gameData.players.map(p => p.name) : ["", "", ""];

    container.innerHTML = `
        <style>
            @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
            .impostore-wrapper { width: 100%; max-width: 600px; margin: 0 auto; color: white; font-family: sans-serif; display: flex; flex-direction: column; padding: 20px; padding-bottom: 100px; animation: slideUp 0.6s ease-out forwards; }
            .setup-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(12px); padding: 25px; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px; }
            .btn-main { background: linear-gradient(45deg, #9d4ede, #ff416c); border: none; padding: 16px; border-radius: 14px; color: white; font-weight: 800; cursor: pointer; width: 100%; text-transform: uppercase; }
            .config-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 12px; }
            .config-row select { background: transparent; color: #9d4ede; border: none; font-weight: 900; font-size: 16px; outline: none; }
            .btn-exit-simple { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 15px; border-radius: 14px; cursor: pointer; width: 100%; font-size: 12px; font-weight: 700; margin-top: 10px; }
        </style>

        <div class="impostore-wrapper">
            <h1 style="text-align: center; margin-bottom: 5px; font-size: 2.5rem; font-weight: 900;">IMPOSTORE</h1>
            <p style="opacity: 0.5; text-align: center; font-size: 12px; margin-bottom: 25px; letter-spacing: 2px;">LOCAL PARTY MODE</p>

            <div class="setup-card">
                <div class="config-row">
                    <span>🕵️ Impostori</span>
                    <select id="select-impostors"><option value="1">1</option><option value="2">2</option></select>
                </div>
                <div class="config-row">
                    <span>🕶️ Undercover</span>
                    <select id="select-undercover"><option value="0">0</option><option value="1">1</option></select>
                </div>
                <div id="player-inputs-container" style="margin-top: 15px;">
                    ${initialPlayers.map((name, i) => createPlayerInputHTML(name, i)).join('')}
                </div>
                <button id="add-player" style="background: transparent; border: 1px dashed rgba(255,255,255,0.2); color: white; opacity: 0.6; padding: 10px; border-radius: 10px; cursor: pointer; width: 100%; margin: 10px 0; font-size: 11px;">+ AGGIUNGI GIOCATORE</button>
                <button id="start-game" class="btn-main">INIZIA PARTITA</button>
            </div>
            <button id="btn-quit-setup" class="btn-exit-simple">← ESCI DAL GIOCO</button>
        </div>
    `;

    container.querySelector('#btn-quit-setup').onclick = () => quitGame(container);

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
        const inputs = Array.from(container.querySelectorAll('.player-input'));
        const names = inputs.map(i => i.value.trim()).filter(n => n !== "");
        gameData.config.impostors = parseInt(container.querySelector('#select-impostors').value);
        gameData.config.undercover = parseInt(container.querySelector('#select-undercover').value);

        if (names.length < (gameData.config.impostors + gameData.config.undercover + 1)) {
            return alert(`Servono almeno ${gameData.config.impostors + gameData.config.undercover + 1} giocatori!`);
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
    if (!wrapper) return;

    wrapper.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 60vh;">
            <p style="text-transform: uppercase; letter-spacing: 2px; opacity: 0.5; font-size: 13px;">Passa il telefono a</p>
            <h1 style="font-size: 2.8rem; font-weight: 900; color: #9d4ede; margin-bottom: 30px;">${currentPlayer.name}</h1>
            <div id="word-box" style="width: 100%; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.08); border-radius: 24px; padding: 50px 20px; cursor: pointer;">
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
            content = `<span style="color:${color}; font-size: 24px;">SEI L'IMPOSTORE!</span>`;
        } else if (currentPlayer.role === 'undercover') {
            color = "#ffbd00";
            content = `SEI UNDERCOVER<br><span style="color:${color}; font-size: 24px;">${gameData.wordObj.alt.toUpperCase()}</span>`;
        } else {
            content = `SEI CIVILE<br><span style="color:${color}; font-size: 24px;">${gameData.wordObj.word.toUpperCase()}</span>`;
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
    const wrapper = container.querySelector('.impostore-wrapper');
    wrapper.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
            <h1 style="font-size: 2.2rem; text-align: center; font-weight: 900;">DISCUSSIONE</h1>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
                ${gameData.players.map((p, i) => `
                    <div style="background: rgba(255,255,255,0.03); padding: 15px 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700;">${p.name}</span>
                        <button class="vote-btn" data-index="${i}" style="background: #9d4ede; border: none; color: white; padding: 8px 12px; border-radius: 8px; font-weight: 800; cursor: pointer;">RUOLO</button>
                    </div>
                `).join('')}
            </div>
            <button id="end-round" class="btn-main" style="margin-top: 30px; background: rgba(255,255,255,0.1);">Termina Partita</button>
        </div>
    `;

    container.querySelectorAll('.vote-btn').forEach(btn => {
        btn.onclick = () => {
            const p = gameData.players[parseInt(btn.getAttribute('data-index'))];
            alert(`${p.name} era: ${p.role.toUpperCase()}`);
            btn.style.opacity = '0.4';
        };
    });
    container.querySelector('#end-round').onclick = () => renderResult(container);
}

function renderResult(container) {
    const summary = gameData.players.map(p => `<div>${p.name}: <b style="color:${p.role === 'civil' ? '#00d2ff' : (p.role === 'impostor' ? '#ff416c' : '#ffbd00')}">${p.role.toUpperCase()}</b></div>`).join('');
    const wrapper = container.querySelector('.impostore-wrapper');
    wrapper.innerHTML = `
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
            <h2 style="font-size: 2.2rem; font-weight: 900;">RISULTATI</h2>
            <div class="setup-card" style="width:100%; margin-top: 20px;">
                ${summary}
                <hr style="border:none; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">
                <p>Civili: <b>${gameData.wordObj.word}</b></p>
                <p>Undercover: <b>${gameData.wordObj.alt}</b></p>
            </div>
            <button id="replay" class="btn-main" style="margin-top: 10px;">NUOVO ROUND</button>
            <button id="btn-quit-end" class="btn-exit-simple">← ESCI AL MENU</button>
        </div>
    `;
    container.querySelector('#replay').onclick = () => { 
        setupRoles(gameData.players.map(p => p.name), gameData.config.impostors, gameData.config.undercover); 
        startNewRound(container); 
    };
    container.querySelector('#btn-quit-end').onclick = () => quitGame(container);
}
