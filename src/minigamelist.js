import { updateSidebarContext } from './components/layout/Sidebar.js';
import { showLobby } from './lobby.js';

export function showMinigamesLobby(container) {
    updateSidebarContext("minigames");

    const games = [
        { id: 'solo', name: 'SOLO', color: 'linear-gradient(135deg, #ff4444, #ffcc00)', icon: '🃏' },
        { id: 'impostore', name: 'IMPOSTORE', color: 'linear-gradient(135deg, #ff3366, #330011)', icon: '🕵️‍♂️' },
        { id: 'briscola', name: 'BRISCOLA', color: 'linear-gradient(135deg, #2a0a4a, #4a1a6a)', icon: '⚔️' },
        { id: 'scopa', name: 'SCOPA', color: 'linear-gradient(135deg, #825a2c, #05020a)', icon: '🧹' },
        { id: 'burraco', name: 'BURRACO', color: 'linear-gradient(135deg, #004d40, #00241a)', icon: '🃏' },
        { id: 'scacchi', name: 'SCACCHI', color: 'linear-gradient(135deg, #333, #000)', icon: '♟️' },
        { id: 'solitario', name: 'SOLITARIO', color: 'linear-gradient(135deg, #1e3a8a, #1e1b4b)', icon: '🧘' },
        { id: 'numeri', name: 'NUMERI', color: 'linear-gradient(135deg, #0f766e, #134e4a)', icon: '🔢' }
    ];

    container.innerHTML = `
        <div id="lobby-wrapper" class="fade-in">
            <div class="dashboard-container">
                
                <button id="btn-back-main" class="btn-back-glass">
                    ← TORNA ALLA LIBRERIA
                </button>

                <header class="lobby-header">
                    <h1>MINI <span class="text-amethyst">GIOCHI</span></h1>
                </header>

                <div class="grid-layout minigames-grid">
                    ${games.map(game => `
                        <div class="game-card minigame-item" id="btn-${game.id}" 
                             style="background: linear-gradient(to top, rgba(5,2,10,0.9), rgba(5,2,10,0.2)), ${game.color};">
                            <div class="game-card-icon">${game.icon}</div>
                            <h2 class="game-card-title">${game.name}</h2>
                        </div>
                    `).join('')}
                </div>
                
            </div>
        </div>
    `;

    // --- GESTIONE CLICK ---
    document.getElementById('btn-back-main').onclick = () => showLobby(container);

    games.forEach(game => {
        const btn = document.getElementById(`btn-${game.id}`);
        if (!btn) return;
        btn.onclick = async () => {
            try {
                const module = await import(`./dashboards/minigames/${game.id}.js`);
                const initFunctions = {
                    solo: 'initSoloGame', impostore: 'initImpostore', briscola: 'initBriscola',
                    scopa: 'initScopa', burraco: 'initBurraco', scacchi: 'initScacchi',
                    solitario: 'initSolitario', numeri: 'initNumeri'
                };
                const fnName = initFunctions[game.id];
                if (module && module[fnName]) module[fnName](container);
            } catch (e) { 
                console.warn("Errore caricamento gioco:", e); 
            }
        };
    });
}
