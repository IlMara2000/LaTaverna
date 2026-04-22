import { updateSidebarContext } from '../../components/layout/Sidebar.js';

// ==========================================
// GIOCO: IMPOSTORE MASTER (Unified UI)
// Versione 2.6 - Fluid & Proportional
// ==========================================

let gameData = {
    players: [], 
    wordObj: { word: '', alt: '' },
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
    
    // Reset Scroll e Viewport
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = 'pan-y'; 
    window.scrollTo(0, 0);

    renderSetup(container);
}

const quitGame = async (container) => {
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch (e) { window.location.reload(); }
};

function createPlayerInputHTML(value = "", index) {
    return `
        <div class="player-input-wrapper fade-in" style="display: flex; gap: 10px; width: 100%; align-items: center; margin-bottom: 12px;">
            <input type="text" class="player-input" placeholder="Nome Giocatore" value="${value}" 
                   style="flex: 1; padding: 15px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; outline: none; font-size: 16px;">
            <button class="delete-player" style="background: rgba(255, 65, 108, 0.15); border: none; color: #ff416c; width: 48px; height: 48px; border-radius: 14px; cursor: pointer; font-weight: bold;">✕</button>
        </div>
    `;
}

function renderSetup(container) {
    const playersNames = gameData.players.length > 0 ? gameData.players.map(p => p.name) : ["", "", ""];

    container.innerHTML = `
        <style>
            .master-wrapper { width: 100%; max-width: 500px; margin: 0 auto; color: white; display: flex; flex-direction: column; padding: 20px; box-sizing: border-box; animation: fadeInUp 0.6s ease-out; }
            .config-card { background: rgba(255,255,255,0.03); border-radius: 24px; padding: 20px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 20px; }
            .row-val { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
            .row-val input { width: 50px; background: transparent; border: none; color: #9d4ede; font-weight: 900; font-size: 1.2rem; text-align: right; outline: none; }
        </style>

        <div class="master-wrapper">
            <h1 class="main-title" style="font-size: 3rem; margin-bottom: 5px;">IMPOSTORE</h1>
            <p style="opacity: 0.5; text-align: center; font-size: 11px; margin-bottom: 30px; letter-spacing: 2px;">LOCAL PARTY MODE</p>

            <div class="config-card">
                <div class="row-val"><span>🕵️ Impostori</span><input type="number" id="num-imp" value="${gameData.config.impostors}" min="1"></div>
                <div class="row-val"><span>🕶️ Undercover</span><input type="number" id="num-und" value="${gameData.config.undercover}" min="0"></div>
                <div id="inputs-area" style="margin-top: 20px;">${playersNames.map((n, i) => createPlayerInputHTML(n, i)).join('')}</div>
                <button id="add-p" style="background: transparent; border: 1px dashed rgba(157,78,221,0.4); color: #c77dff; padding: 15px; border-radius: 16px; width: 100%; margin: 15px 0; font-weight: 800; cursor:pointer;">+ AGGIUNGI GIOCATORE</button>
                <button id="start-btn" class="btn-primary">INIZIA PARTITA</button>
            </div>
            <button id="quit-btn" class="btn-back-glass">← TORNA ALLA LIBRERIA</button>
        </div>
    `;

    container.querySelector('#quit-btn').onclick = () => quitGame(container);
    container.querySelector('#add-p').onclick = () => {
        const area = container.querySelector('#inputs-area');
        area.insertAdjacentHTML('beforeend', createPlayerInputHTML("", area.children.length));
    };
    container.querySelector('#inputs-area').onclick = (e) => {
        if (e.target.closest('.delete-player')) e.target.closest('.player-input-wrapper').remove();
    };

    container.querySelector('#start-btn').onclick = () => {
        const names = Array.from(container.querySelectorAll('.player-input')).map(i => i.value.trim()).filter(n => n !== "");
        if (names.length < 3) return alert("Servono almeno 3 giocatori!");

        let nImp = parseInt(container.querySelector('#num-imp').value) || 1;
        let nUnd = parseInt(container.querySelector('#num-und').value) || 0;
        const maxSpecial = names.length - 1;

        if ((nImp + nUnd) > maxSpecial) {
            nImp = 1; nUnd = Math.max(0, maxSpecial - 1);
            alert(`Auto-bilanciamento: 🕵️ ${nImp} | 🕶️ ${nUnd}`);
        }

        gameData.config.impostors = nImp;
        gameData.config.undercover = nUnd;
        setupRoles(names, nImp, nUnd);
        startNewRound(container);
    };
}

function setupRoles(names, nImp, nUnd) {
    gameData.players = names.map(name => ({ name, role: 'civil' }));
    let idxs = [...Array(names.length).keys()].sort(() => Math.random() - 0.5);
    for(let i=0; i<nImp; i++) gameData.players[idxs.pop()].role = 'impostor';
    for(let i=0; i<nUnd; i++) gameData.players[idxs.pop()].role = 'undercover';
    gameData.wordObj = WORDS_DATABASE[Math.floor(Math.random() * WORDS_DATABASE.length)];
}

function startNewRound(container) {
    gameData.currentIndex = 0;
    renderReveal(container);
}

function renderReveal(container) {
    const p = gameData.players[gameData.currentIndex];
    container.innerHTML = `
        <div class="master-wrapper" style="min-height: 80vh; justify-content: center; align-items: center; text-align: center;">
            <p style="opacity: 0.5; font-size: 12px; letter-spacing: 2px;">PASSA IL TELEFONO A</p>
            <h1 class="main-title" style="font-size: 3.5rem; margin-bottom: 40px; color: white; background: none; -webkit-text-fill-color: white;">${p.name}</h1>
            
            <div id="reveal-box" style="width: 100%; max-width: 350px; background: rgba(255,255,255,0.03); border: 2px solid rgba(255,255,255,0.1); border-radius: 28px; padding: 60px 20px; cursor: pointer; transition: 0.3s; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
                <p id="reveal-text" style="font-weight: 800; opacity: 0.4; letter-spacing: 2px;">TOCCA PER SCOPRIRE</p>
            </div>
            
            <button id="next-btn" class="btn-primary" style="display: none; margin-top: 30px; max-width: 350px;">HO VISTO</button>
        </div>
    `;

    container.querySelector('#reveal-box').onclick = function() {
        let content = ""; let color = "#00d2ff";
        if (p.role === 'impostor') { color = "#ff416c"; content = `<span style="color:${color}; font-size: 24px; font-weight: 900;">SEI L'IMPOSTORE!</span>`; }
        else if (p.role === 'undercover') { color = "#ffbd00"; content = `<span style="opacity:0.6; font-size:12px;">SEI UNDERCOVER</span><br><span style="color:${color}; font-size: 26px; font-weight: 900;">${gameData.wordObj.alt.toUpperCase()}</span>`; }
        else { content = `<span style="opacity:0.6; font-size:12px;">SEI CIVILE</span><br><span style="color:${color}; font-size: 26px; font-weight: 900;">${gameData.wordObj.word.toUpperCase()}</span>`; }
        
        this.style.borderColor = color;
        this.style.boxShadow = `0 0 30px ${color}30, inset 0 0 20px ${color}20`;
        container.querySelector('#reveal-text').innerHTML = content;
        container.querySelector('#next-btn').style.display = "block";
        this.onclick = null;
    };

    container.querySelector('#next-btn').onclick = () => {
        if (gameData.currentIndex < gameData.players.length - 1) { gameData.currentIndex++; renderReveal(container); }
        else renderGameField(container);
    };
}

function renderGameField(container) {
    container.innerHTML = `
        <div class="master-wrapper" style="min-height: 80vh; justify-content: center;">
            <h1 class="main-title" style="font-size: 2.5rem; margin-bottom: 5px;">DISCUSSIONE</h1>
            <p style="opacity: 0.5; text-align: center; margin-bottom: 30px;">Trovate l'impostore!</p>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                ${gameData.players.map((p, i) => `
                    <div style="background: rgba(255,255,255,0.03); padding: 15px 20px; border-radius: 18px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                        <span style="font-weight: 700; font-size: 1.1rem;">${p.name}</span>
                        <button class="vote-btn" data-idx="${i}" style="background: #9d4ede; border: none; color: white; padding: 10px 20px; border-radius: 12px; font-weight: 800; cursor: pointer;">SVELA</button>
                    </div>
                `).join('')}
            </div>
            
            <div id="guess-panel" style="display: none; flex-direction: column; gap: 10px; margin-top: 25px; background: rgba(255, 65, 108, 0.1); border: 1px solid rgba(255, 65, 108, 0.3); padding: 20px; border-radius: 20px;">
                <p style="text-align: center; font-weight: 800; color: #ff416c;">L'IMPOSTORE HA UNA CHANCE!</p>
                <input type="text" id="guess-input" placeholder="Qual era la parola?" style="width: 100%; padding: 15px; border-radius: 14px; background: #000; border: 1px solid #ff416c; color: #fff;">
                <button id="guess-btn" class="btn-primary" style="background: #ff416c;">CONFERMA</button>
            </div>
            
            <button id="end-btn" class="btn-primary" style="margin-top: 40px; background: #555; border: none;">RISULTATI FINALI</button>
        </div>
    `;

    container.querySelectorAll('.vote-btn').forEach(btn => {
        btn.onclick = () => {
            const p = gameData.players[btn.dataset.idx];
            btn.parentElement.innerHTML = `<span style="font-weight:700;">${p.name}</span><b style="color:${p.role === 'impostor' ? '#ff416c' : '#00ffa3'}">${p.role.toUpperCase()}</b>`;
            if (p.role === 'impostor') {
                container.querySelector('#guess-panel').style.display = 'flex';
                container.querySelector('#end-btn').style.display = 'none';
            }
        };
    });

    container.querySelector('#guess-btn').onclick = () => {
        const win = container.querySelector('#guess-input').value.trim().toLowerCase() === gameData.wordObj.word.toLowerCase();
        renderResult(container, win);
    };
    container.querySelector('#end-btn').onclick = () => renderResult(container, null);
}

function renderResult(container, impostorWon) {
    const summary = gameData.players.map(p => `<div style="display:flex; justify-content:space-between; margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:5px;"><span>${p.name}</span><b style="color:${p.role==='civil'?'#00d2ff':'#ff416c'}">${p.role.toUpperCase()}</b></div>`).join('');
    
    container.innerHTML = `
        <div class="master-wrapper" style="min-height: 80vh; justify-content: center; align-items: center; text-align: center;">
            <h1 style="font-size: 4rem; margin-bottom: 0;">${impostorWon === true ? '💀' : '🏆'}</h1>
            <h2 class="main-title" style="font-size: 2.2rem; color:${impostorWon?'#ff416c':'#00ffa3'}; background:none; -webkit-text-fill-color:${impostorWon?'#ff416c':'#00ffa3'};">${impostorWon ? 'L\'IMPOSTORE VINCE!' : 'CIVILI VITTORIOSI!'}</h2>
            <div class="config-card" style="width: 100%; text-align: left; margin-top: 20px;">
                ${summary}
                <div style="margin-top: 20px; font-size: 14px;">Parola Segreta: <b style="color:#00ffa3;">${gameData.wordObj.word}</b></div>
            </div>
            <button id="replay" class="btn-primary" style="background: var(--accent-gradient);">NUOVO ROUND</button>
            <button id="quit" class="btn-back-glass" style="width:100%; margin-top: 10px;">ESCI</button>
        </div>
    `;
    container.querySelector('#replay').onclick = () => { setupRoles(gameData.players.map(p=>p.name), gameData.config.impostors, gameData.config.undercover); startNewRound(container); };
    container.querySelector('#quit').onclick = () => quitGame(container);
}