import { showLobby } from '../lobby.js';

// Costanti necessarie per il rendering
const COLORS = ['red', 'blue', 'green', 'yellow'];
const getHex = (color) => {
    const hex = { red: '#ff4444', blue: '#0066ff', green: '#33cc33', yellow: '#ffcc00' };
    return hex[color] || '#ffffff';
};

export function initSoloGame(container) {
    // Nascondiamo l'hamburger menu se presente per massimizzare lo spazio
    const menuTrigger = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
    if (menuTrigger) menuTrigger.style.display = 'none';

    renderLayout(container);
    attachEventListeners(container);
}

function renderLayout(container) {
    container.innerHTML = `
    <style>
        /* MANTENGO LE TUE ANIMAZIONI E STILI ESATTAMENTE COME RICHIESTO */
        @keyframes floatLogo {
            0% { transform: translateY(0px); filter: drop-shadow(0 0 10px #9d4ede66); }
            50% { transform: translateY(-15px); filter: drop-shadow(0 0 30px #9d4edeaa); }
            100% { transform: translateY(0px); filter: drop-shadow(0 0 10px #9d4ede66); }
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .game-bg { width:100%; height:100dvh; background: radial-gradient(circle at center, #1a0a2a 0%, #05020a 100%); position:relative; overflow:hidden; color:white; font-family: 'Inter', sans-serif; }
        .intro-logo { font-size: 5rem; font-weight: 900; color: #9d4ede; animation: floatLogo 3s ease-in-out infinite; margin-bottom: 40px; text-transform: uppercase; letter-spacing: -3px; }
        .btn-group-intro { animation: fadeInUp 0.8s ease-out forwards; animation-delay: 0.4s; opacity: 0; width: 100%; max-width: 280px; }
        .card { width: 65px; height: 95px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 1.2rem; cursor: pointer; transition: 0.3s; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 5px 15px rgba(0,0,0,0.6); }
        .card-back { background: linear-gradient(135deg, #2a0a4a, #05020a); border: 1.5px solid #9d4ede; color: #9d4ede; font-size: 0.7rem; }
        .btn-purple { background: #9d4ede; color: black; padding: 18px 40px; border-radius: 50px; font-weight: 900; border: none; cursor: pointer; width: 100%; margin-bottom: 15px; transition: 0.2s; text-align: center; }
        .btn-outline { background: rgba(255,255,255,0.05); color: white; padding: 15px 40px; border-radius: 50px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; width: 100%; transition: 0.2s; text-align: center; }
        .exit-btn { position: absolute; top: 20px; left: 20px; background: rgba(255,68,68,0.15); border: 1px solid #ff4444; color: white; padding: 8px 15px; border-radius: 10px; font-size: 11px; font-weight: 800; cursor: pointer; z-index: 100; }
        .bot-area { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 8px; transition: 0.5s; padding: 12px; border-radius: 20px; }
    </style>

    <div class="game-bg">
        <button class="exit-btn" id="btn-exit">ESCI</button>

        <div id="start-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:5000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
            <div style="text-align:center; display: flex; flex-direction: column; align-items: center;">
                <h1 class="intro-logo">SOLO</h1>
                <div class="btn-group-intro">
                    <button class="btn-purple" id="mode-single">VS BOT</button>
                    <button class="btn-outline" id="mode-multi">MULTIPLAYER</button>
                </div>
            </div>
        </div>

        <div id="bot-1" class="bot-area" style="top:70px; left:50%; transform:translateX(-50%);"><span>BOT 1</span><div class="hand"></div></div>
        <div id="bot-2" class="bot-area" style="top:50%; left:20px; transform:translateY(-50%);"><span>BOT 2</span><div class="hand"></div></div>
        <div id="bot-3" class="bot-area" style="top:50%; right:20px; transform:translateY(-50%);"><span>BOT 3</span><div class="hand"></div></div>

        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
            <div id="dir-icon" style="font-size:30px; margin-bottom:10px; color:#9d4ede;">↻</div>
            <div style="display:flex; gap:30px; align-items:center;">
                <div id="deck-draw" class="card card-back">MAZZO</div>
                <div id="discard-pile" class="card" style="width:85px; height:120px; cursor:default;"></div>
            </div>
            <div id="color-info" style="margin-top:20px; font-size:10px; letter-spacing:2px; background:rgba(0,0,0,0.3); padding:5px 15px; border-radius:20px;">
                COLORE: <span id="cur-color" style="font-weight:900;">TUTTI</span>
            </div>
        </div>

        <div id="player-area" style="position:absolute; bottom:110px; width:100%; display:flex; justify-content:center; gap:5px; padding:0 20px;"></div>
        
        <div style="position:absolute; bottom:30px; width:100%; text-align:center;">
            <button class="btn-purple" style="width:auto; padding: 12px 50px; background:#ff4444; color:white;">SOLO!</button>
        </div>

        <div id="picker" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:6000; align-items:center; justify-content:center; gap:25px;">
            ${COLORS.map(c => `<div class="color-option" data-color="${c}" style="width:80px; height:80px; background:${getHex(c)}; border-radius:20px; cursor:pointer;"></div>`).join('')}
        </div>
    </div>
    `;
}

function attachEventListeners(container) {
    // Gestione Esci
    document.getElementById('btn-exit').onclick = () => {
        const menuTrigger = document.querySelector('.sidebar-trigger') || document.getElementById('hamburger-menu');
        if (menuTrigger) menuTrigger.style.display = 'flex';
        showLobby(container);
    };

    // Gestione Modalità (Start Game)
    const overlay = document.getElementById('start-overlay');
    document.getElementById('mode-single').onclick = () => {
        overlay.style.display = 'none';
        console.log("Inizia partita Single Player");
        // Qui chiameresti la tua funzione startGame('single')
    };

    document.getElementById('mode-multi').onclick = () => {
        alert("Multiplayer in arrivo...");
    };

    // Gestione Mazzo
    document.getElementById('deck-draw').onclick = () => {
        console.log("Hai pescato una carta");
        // Qui playerDraw();
    };

    // Gestione Picker Colore
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(opt => {
        opt.onclick = () => {
            const selected = opt.getAttribute('data-color');
            document.getElementById('cur-color').innerText = selected.toUpperCase();
            document.getElementById('cur-color').style.color = getHex(selected);
            document.getElementById('picker').style.display = 'none';
        };
    });
}
