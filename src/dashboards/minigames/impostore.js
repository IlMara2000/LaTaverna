import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { showLobby } from '../../lobby.js';

let gameState = {
    playerName: '', roomCode: '', isHost: false,
    players: [], status: 'menu' 
};

export function initImpostore(container) {
    updateSidebarContext("minigames"); 
    renderMenu(container);
}

function renderMenu(container) {
    container.innerHTML = `
        <div style="width: 100%; min-height: 100dvh; padding: 40px 20px 120px 20px; display: flex; flex-direction: column; align-items: center;" class="fade-in">
            <div style="max-width: 400px; width: 100%; text-align: center; margin-top: 50px;">
                <h1 style="font-size: 3rem; font-weight: 900; color: #ff3366; text-shadow: 0 0 20px rgba(255, 51, 102, 0.5); margin-bottom: 10px;">IMPOSTORE</h1>
                <p style="opacity: 0.6; font-size: 14px; margin-bottom: 40px;">Di chi ti puoi fidare?</p>
                <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 30px; display: flex; flex-direction: column; gap: 20px;">
                    <div style="text-align: left;">
                        <label style="font-size: 11px; opacity: 0.6;">IL TUO NOME</label>
                        <input type="text" id="player-name" placeholder="Es. Shadow" style="width: 100%; padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.5); color: white; margin-top: 8px;">
                    </div>
                    <div style="text-align: left;">
                        <label style="font-size: 11px; opacity: 0.6;">CODICE STANZA</label>
                        <input type="text" id="room-code" placeholder="Vuoto per creare" style="width: 100%; padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.5); color: white; margin-top: 8px; text-transform: uppercase; text-align: center; font-weight: bold;">
                    </div>
                    <button id="btn-action" style="width: 100%; padding: 18px; border-radius: 12px; border: none; background: linear-gradient(135deg, #ff3366, #990033); color: white; font-weight: 900; cursor: pointer;">ENTRA NELLA LOBBY</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-action').onclick = () => {
        const name = document.getElementById('player-name').value.trim();
        const code = document.getElementById('room-code').value.trim().toUpperCase();
        if (!name) return alert("Metti un nome!");
        gameState.playerName = name;
        if (code === '') {
            gameState.roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
            gameState.isHost = true;
            gameState.players = [{ name: name, isHost: true }];
        } else {
            gameState.roomCode = code;
            gameState.players = [{ name: "HostPlayer", isHost: true }, { name: name, isHost: false }];
        }
        renderRoom(container);
    };
}

function renderRoom(container) {
    container.innerHTML = `
        <div style="width: 100%; min-height: 100dvh; padding: 40px 20px 120px 20px; display: flex; flex-direction: column; align-items: center;" class="fade-in">
            <div style="width: 100%; max-width: 600px; text-align: center;">
                <span style="font-size: 10px; opacity: 0.5; letter-spacing: 2px;">STANZA: ${gameState.roomCode}</span>
                <h2 style="margin: 20px 0;">Giocatori (<span id="p-count">${gameState.players.length}</span>/10)</h2>
                <div id="player-list" style="display: grid; gap: 10px; margin-bottom: 40px;">
                    ${gameState.players.map(p => `<div style="padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px; border-left: 4px solid ${p.isHost ? '#ff3366' : '#9d4ede'}; text-align: left;">${p.name} ${p.isHost ? '👑' : ''}</div>`).join('')}
                </div>
                ${gameState.isHost ? `<button id="start-game" style="width: 100%; padding: 18px; border-radius: 12px; background: white; color: black; font-weight: 900; border:none; cursor:pointer;">INIZIA PARTITA</button>` : `<p style="opacity:0.5;">In attesa dell'Host...</p>`}
            </div>
        </div>
    `;
    if (gameState.isHost) {
        document.getElementById('start-game').onclick = () => alert("Gioco in fase di sviluppo... (Syncing Multiplayer)");
    }
}