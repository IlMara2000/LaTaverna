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
        <div id="lobby-wrapper" style="min-height: 100dvh; box-sizing: border-box; padding: 40px 20px 80px 20px; background: #05020a;" class="fade-in">
            <div style="max-width: 1200px; margin: 0 auto;">
                <button id="btn-back-main" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 12px 24px; border-radius: 14px; font-size: 12px; font-weight: 800; cursor: pointer; margin-bottom: 30px; letter-spacing: 1px;">← TORNA ALLA LIBRERIA</button>
                <h1 style="font-size: 2.5rem; font-weight: 900; margin-bottom: 40px; color: white;">MINI <span style="color:var(--amethyst-bright);">GIOCHI</span></h1>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                    ${games.map(game => `
                        <div class="game-card" id="btn-${game.id}" style="
                            background: linear-gradient(to top, rgba(5,2,10,0.9), rgba(5,2,10,0.2)), ${game.color};
                            height: 220px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);
                            cursor: pointer; display: flex; flex-direction: column; justify-content: flex-end;
                            padding: 25px; transition: 0.3s ease; position: relative; overflow: hidden;
                        ">
                            <div style="position: absolute; top: 20px; right: 20px; font-size: 2rem; opacity: 0.3;">${game.icon}</div>
                            <h2 style="margin:0; font-size: 1.5rem; font-weight: 900; color: white;">${game.name}</h2>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

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
                if (module && module[fnName]) {
                    module[fnName](container);
                }
            } catch (e) {
                console.warn("Errore caricamento minigioco:", e);
            }
        };
    });
}