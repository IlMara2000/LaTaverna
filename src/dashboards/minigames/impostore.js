import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: IMPOSTORE (Local Party Mode)
// Versione Stabile 2.2 - Premium UI Borderless
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
    
    try { updateSidebarContext("minigames"); } catch(e) { console.log("Sidebar non pronta"); }
    
    // FIX: Configurazione Scroll Mobile
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto'; // Consente scroll verticale per gli input
    document.body.style.position = 'relative';
    document.body.style.touchAction = 'pan-y'; 
    document.body.style.overscrollBehavior = 'none';
    document.body.style.backgroundColor = '#05010a'; 
    window.scrollTo(0, 0);

    renderSetup(container);
}

const quitGame = async (container) => {
    document.body.style.touchAction = '';
    document.body.style.overflowX = '';
    document.body.style.overflowY = 'auto';
    document.body.style.overscrollBehavior = '';
    document.body.style.backgroundColor = '';
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) {
        window.location.reload(); 
    }
};

function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper fade-in" style="display: flex; gap: 8px; width: 100%; align-items: center; margin-bottom: 12px; animation-duration: 0.3s;">
            <input type="text" class="player-input" placeholder="Giocatore ${index + 1}" value="${value}" 
                   style="flex: 1; padding: 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; outline: none; font-size: 14px; font-family: 'Poppins', sans-serif;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.15); border: 1px solid rgba(255,65,108,0.3); color: #ff416c; width: 48px; height: 48px; border-radius: 14px; cursor: pointer; font-weight: bold; transition: 0.2s;">✕</button>
        </div>
    `;
}

function renderSetup(container) {
    const playersNames = gameData.players.length > 0 ? gameData.players.map(p => p.name) : ["", "", ""];

    container.innerHTML = `
        <style>
            .impostore-wrapper { 
                width: 100%; max-width: 500px; margin: 0 auto; color: white; font-family: 'Poppins', sans-serif;
                display: flex; flex-direction: column; padding: 20px; box-sizing: border-box;
                overflow-x: hidden; min-height: 80vh; justify-content: center;
            }
            .config-row { 
                display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; 
                background: rgba(255,255,255,0.02); padding: 12px 15px; border-radius: 16px; 
                border: 1px solid rgba(255,255,255,0.05); 
            }
            .config-row select { 
                width: 60px; padding: 5px; background: transparent; border: none; 
                color: var(--amethyst-bright); font-weight: 900; font-size: 1.1rem; text-align: right; 
                box-shadow: none; outline: none;
            }
            .config-row select:focus { background: transparent; box-shadow: none; border: none; }
        </style>

        <div class="impostore-wrapper fade-in">
            <h1 class="main-title" style="margin-bottom: 5px;">IMPOSTORE</h1>
            <p style="opacity: 0.5; text-align: center; font-size: 11px; margin-bottom: 30px; letter-spacing: 2px;">LOCAL PARTY MODE</p>

            <div style="width: 100%;">
                <div class="config-row">
                    <span style="font-weight: 600; font-size: 0.9rem;">🕵️ Impostori</span>
                    <select id="select-impostors"><option value="1">1</option><option value="2">2</option></select>
                </div>
                <div class="config-row">
                    <span style="font-weight: 600; font-size: 0.9rem;">🕶️ Undercover</span>
                    <select id="select-undercover"><option value="0">0</option><option value="1">1</option></select>
                </div>
                
                <div id="player-inputs-container" style="margin-top: 25px;">
                    ${playersNames.map((name, i) => createPlayerInputHTML(name, i)).join('')}
                </div>
                
                <button id="add-player" style="background: transparent; border: 1px dashed rgba(157, 78, 221, 0.4); color: var(--amethyst-light); padding: 14px; border-radius: 16px; cursor: pointer; width: 100%; margin: 10px 0 25px 0; font-size: 11px; font-weight: 800; letter-spacing: 1px; transition: 0.2s;">+ AGGIUNGI GIOCATORE</button>
                
                <button id="start-game" class="btn-primary" style="margin-bottom: 20px;">INIZIA PARTITA</button>
            </div>
            
            <button id="btn-quit-setup" class="btn-back-glass">← TORNA ALLA LIBRERIA</button>
        </div>
    `;

    container.querySelector('#btn-quit-setup').onclick = () => quitGame(container);

    container.querySelector('#player-inputs-container').onclick = (e) => {
        if (e.target.closest('.delete-player')) e.target.closest('.player-input-wrapper').remove();
    };

    container.querySelector('#add-player').onclick = () => {
        const cont = container.querySelector('#player-inputs-container');
        const div = document.createElement('div');
        div.innerHTML = createPlayerInputHTML("", cont.children.length);
        cont.appendChild(div.firstElementChild);
    };

    container.querySelector('#start-game').onclick = () => {
        const names = Array.from(container.querySelectorAll('.player-input')).map(i => i.value.trim()).filter(n => n !== "");
        const numImp = parseInt(container.querySelector('#select-impostors').value);
        const numUnd = parseInt(container.querySelector('#select-undercover').value);

        if (names.length < (numImp + numUnd + 1)) return alert(`Servono almeno ${numImp + numUnd + 1} giocatori!`);

        gameData.config.impostors = numImp;
        gameData.config.undercover = numUnd;
        setupRoles(names, numImp, numUnd);
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
        <div class="fade-in" style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 70vh;">
            <p style="text-transform: uppercase; letter-spacing: 2px; opacity: 0.5; font-size: 12px; margin-bottom: 5px;">Passa il telefono a</p>
            <h1 class="main-title" style="font-size: 3rem; margin-bottom: 40px; color: white; background: none; -webkit-text-fill-color: white; filter: none;">${currentPlayer.name}</h1>
            
            <div id="word-box" style="width: 100%; max-width: 350px; background: var(--glass-surface); border: 2px solid var(--glass-border); border-radius: 24px; padding: 60px 20px; cursor: pointer; transition: 0.3s; box-shadow: inset 0 0 20px rgba(0,0,0,0.3);">
                <p id="word-text" style="font-weight: 800; opacity: 0.4; font-size: 14px; letter-spacing: 2px;">TOCCA PER SCOPRIRE IL RUOLO</p>
            </div>
            
            <button id="next-player" class="btn-primary" style="display: none; margin-top: 30px; max-width: 350px;">HO VISTO</button>
        </div>
    `;

    container.querySelector('#word-box').onclick = function() {
        let content = ""; let color = "#00d2ff";
        if (currentPlayer.role === 'impostor') { 
            color = "#ff416c"; 
            content = `<span style="color:${color}; font-size: 24px; font-weight: 900;">SEI L'IMPOSTORE!</span>`; 
        }
        else if (currentPlayer.role === 'undercover') { 
            color = "#ffbd00"; 
            content = `<span style="opacity:0.6; font-size:12px; letter-spacing:1px;">SEI UNDERCOVER</span><br><span style="color:${color}; font-size: 24px; font-weight: 900;">${gameData.wordObj.alt.toUpperCase()}</span>`; 
        }
        else { 
            content = `<span style="opacity:0.6; font-size:12px; letter-spacing:1px;">SEI CIVILE</span><br><span style="color:${color}; font-size: 24px; font-weight: 900;">${gameData.wordObj.word.toUpperCase()}</span>`; 
        }
        
        this.style.borderColor = color;
        this.style.background = `${color}10`; // Leggero tint di colore
        this.style.boxShadow = `0 0 20px ${color}40, inset 0 0 20px ${color}20`;
        container.querySelector('#word-text').innerHTML = content;
        
        const nextBtn = container.querySelector('#next-player');
        nextBtn.style.display = "flex";
        
        this.onclick = null;
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
        <div class="fade-in" style="flex: 1; display: flex; flex-direction: column; justify-content: center; min-height: 70vh;">
            <h1 class="main-title" style="font-size: 2.2rem; margin-bottom: 5px;">DISCUSSIONE</h1>
            <p style="opacity: 0.5; text-align: center; margin-bottom: 30px; font-size: 13px;">Parlate e votate chi eliminare!</p>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${gameData.players.map((p, i) => `
                    <div style="background: var(--glass-surface); padding: 15px 20px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--glass-border); box-shadow: 0 4px 10px rgba(0,0,0,0.2);">
                        <span style="font-weight: 700; font-size: 1.1rem;">${p.name}</span>
                        <button class="vote-btn" data-index="${i}" style="background: var(--amethyst-bright); border: none; color: white; padding: 10px 18px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px var(--amethyst-glow);">RUOLO</button>
                    </div>
                `).join('')}
            </div>
            
            <button id="end-round" class="btn-primary" style="margin-top: 40px; background: var(--danger); border-color: var(--danger); border-left: 3px solid transparent; box-shadow: 0 4px 15px rgba(255, 68, 68, 0.4);">TERMINA PARTITA</button>
        </div>
    `;

    container.querySelectorAll('.vote-btn').forEach(btn => {
        btn.onclick = () => {
            const p = gameData.players[parseInt(btn.getAttribute('data-index'))];
            alert(`${p.name} era: ${p.role.toUpperCase()}`);
            btn.style.opacity = '0.3';
            btn.style.pointerEvents = 'none'; // Evita doppi tocchi
        };
    });
    
    container.querySelector('#end-round').onclick = () => renderResult(container);
}

function renderResult(container) {
    const summary = gameData.players.map(p => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px;">
            <span style="font-weight: 700;">${p.name}</span> 
            <b style="color:${p.role === 'civil' ? '#00d2ff' : (p.role === 'impostor' ? '#ff416c' : '#ffbd00')}">${p.role.toUpperCase()}</b>
        </div>
    `).join('');
    
    const wrapper = container.querySelector('.impostore-wrapper');
    wrapper.innerHTML = `
        <div class="fade-in" style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 80vh;">
            <h2 class="main-title" style="font-size: 2.8rem; margin-bottom: 30px;">RISULTATI</h2>
            
            <div style="background: var(--glass-surface); border: 1px solid var(--glass-border); border-radius: 20px; width:100%; text-align: left; padding: 25px; margin-bottom: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                ${summary}
                
                <div style="height: 1px; background: var(--glass-border); margin: 20px 0;"></div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="opacity: 0.6; font-size: 13px;">Parola Civili:</span>
                    <b style="color: #00d2ff;">${gameData.wordObj.word}</b>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="opacity: 0.6; font-size: 13px;">Parola Undercover:</span>
                    <b style="color: #ffbd00;">${gameData.wordObj.alt}</b>
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <button id="replay" class="btn-primary" style="background: linear-gradient(45deg, #00ffa3, #00d2ff); color: black; border: none;">NUOVO ROUND</button>
                <button id="btn-quit-end" class="btn-back-glass">← TORNA ALLA LIBRERIA</button>
            </div>
        </div>
    `;
    
    container.querySelector('#replay').onclick = () => { 
        setupRoles(gameData.players.map(p => p.name), gameData.config.impostors, gameData.config.undercover); 
        startNewRound(container); 
    };
    container.querySelector('#btn-quit-end').onclick = () => quitGame(container);
}
