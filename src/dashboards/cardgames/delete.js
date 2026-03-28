// ==========================================
// GIOCO: IMPOSTORE (Multiplayer)
// ==========================================

// Stato locale (In futuro questo arriverà dal tuo server/database)
let gameState = {
    playerName: '',
    roomCode: '',
    isHost: false,
    players: [],
    status: 'menu' // 'menu', 'lobby', 'playing'
};

export function initImpostore(container) {
    renderMenu(container);
}

// ------------------------------------------
// 1. SCHERMATA INIZIALE (Crea o Partecipa)
// ------------------------------------------
function renderMenu(container) {
    container.innerHTML = `
        <div style="
            width: 100%;
            min-height: 100dvh;
            padding: 40px 20px 120px 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        " class="fade-in">
            
            <div style="width: 100%; max-width: 600px; margin-bottom: 30px;">
                <button id="btn-back" style="
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
                    color: white; padding: 10px 20px; border-radius: 12px; 
                    font-size: 12px; font-weight: 800; cursor: pointer;
                ">← TORNA ALLA LIBRERIA</button>
            </div>

            <div style="max-width: 400px; width: 100%; text-align: center;">
                <h1 style="font-size: 3rem; font-weight: 900; color: #ff3366; text-shadow: 0 0 20px rgba(255, 51, 102, 0.5); margin-bottom: 10px;">IMPOSTORE</h1>
                <p style="opacity: 0.6; font-size: 14px; margin-bottom: 40px;">Di chi ti puoi fidare?</p>

                <div class="session-card" style="flex-direction: column; gap: 20px; padding: 30px;">
                    
                    <div style="width: 100%; text-align: left;">
                        <label style="font-size: 11px; opacity: 0.6; letter-spacing: 1px;">IL TUO NOME</label>
                        <input type="text" id="player-name" placeholder="Es. ShadowNinja" style="
                            width: 100%; padding: 15px; border-radius: 12px; border: 1px solid var(--glass-border);
                            background: rgba(0,0,0,0.5); color: white; font-size: 16px; margin-top: 8px; outline: none;
                        ">
                    </div>

                    <div style="width: 100%; text-align: left;">
                        <label style="font-size: 11px; opacity: 0.6; letter-spacing: 1px;">CODICE STANZA</label>
                        <input type="text" id="room-code" placeholder="Lascia vuoto per creare" style="
                            width: 100%; padding: 15px; border-radius: 12px; border: 1px solid var(--glass-border);
                            background: rgba(0,0,0,0.5); color: white; font-size: 16px; margin-top: 8px; outline: none;
                            text-transform: uppercase; text-align: center; letter-spacing: 3px; font-weight: bold;
                        ">
                    </div>

                    <button id="btn-action" class="btn-primary" style="width: 100%; margin-top: 10px; background: linear-gradient(135deg, #ff3366, #990033); box-shadow: 0 8px 20px rgba(255, 51, 102, 0.3);">
                        ENTRA NELLA LOBBY
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-back').onclick = async () => {
        // Presumo che torni alla lobby principale
        const { showLobby } = await import('../lobby.js'); 
        showLobby(container);
    };

    document.getElementById('btn-action').onclick = () => {
        const name = document.getElementById('player-name').value.trim();
        const code = document.getElementById('room-code').value.trim().toUpperCase();

        if (!name) {
            alert("Devi inserire un nome bro!");
            return;
        }

        gameState.playerName = name;
        
        if (code === '') {
            // Crea nuova stanza
            gameState.roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
            gameState.isHost = true;
            gameState.players = [{ name: name, isHost: true }];
        } else {
            // Unisciti a stanza esistente
            gameState.roomCode = code;
            gameState.isHost = false;
            // Simuliamo l'ingresso in una stanza con altri giocatori
            gameState.players = [
                { name: "HostPlayer", isHost: true },
                { name: name, isHost: false }
            ];
        }

        renderRoom(container);
    };
}

// ------------------------------------------
// 2. LOBBY DELLA STANZA (Attesa giocatori)
// ------------------------------------------
function renderRoom(container) {
    container.innerHTML = `
        <div style="
            width: 100%; min-height: 100dvh; padding: 40px 20px 120px 20px;
            display: flex; flex-direction: column; align-items: center;
        " class="fade-in">
            
            <div style="width: 100%; max-width: 600px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <button id="btn-leave" style="
                    background: transparent; border: 1px solid rgba(255,255,255,0.2); 
                    color: white; padding: 8px 15px; border-radius: 8px; font-size: 12px; cursor: pointer;
                ">ABBANDONA</button>
                
                <div style="text-align: right;">
                    <span style="font-size: 10px; opacity: 0.5; letter-spacing: 2px;">CODICE STANZA</span><br>
                    <span style="font-size: 1.5rem; font-weight: 900; color: #ff3366; letter-spacing: 4px;">${gameState.roomCode}</span>
                </div>
            </div>

            <div style="max-width: 600px; width: 100%;">
                <h2 style="font-size: 1.5rem; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                    👥 Giocatori (${gameState.players.length}/10)
                </h2>
                
                <div id="players-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 40px;">
                    ${gameState.players.map(p => `
                        <div style="
                            background: var(--glass-bg); border: 1px solid var(--glass-border);
                            padding: 15px 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;
                        ">
                            <span style="font-weight: bold; font-size: 1.1rem; color: ${p.name === gameState.playerName ? '#ff3366' : 'white'}">${p.name}</span>
                            ${p.isHost ? '<span style="font-size: 10px; background: rgba(255,255,255,0.1); padding: 3px 8px; border-radius: 4px;">👑 HOST</span>' : ''}
                        </div>
                    `).join('')}
                </div>

                ${gameState.isHost ? `
                    <button id="btn-start" class="btn-primary" style="width: 100%; background: linear-gradient(135deg, #ff3366, #990033);">
                        INIZIA PARTITA
                    </button>
                ` : `
                    <div style="text-align: center; opacity: 0.5; font-size: 12px; letter-spacing: 1px; animation: pulse 2s infinite;">
                        In attesa che l'Host avvii la partita...
                    </div>
                `}
            </div>
        </div>
    `;

    document.getElementById('btn-leave').onclick = () => {
        gameState.players = [];
        renderMenu(container);
    };

    if (gameState.isHost) {
        document.getElementById('btn-start').onclick = () => {
            alert("Il backend non è ancora collegato! Ma la UI è pronta 🔥");
            // Qui in futuro chiamerai renderGame(container)
        };
    }
}
