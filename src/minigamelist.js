import { updateSidebarContext } from './components/layout/Sidebar.js';
import { showLobby } from './lobby.js';

export function showMinigamesLobby(container) {
    // Reset scroll per Safari/iOS
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    window.scrollTo(0, 0);

    updateSidebarContext("minigames");

    // Definizione dei giochi con i relativi metadati
    const games = [
        { id: 'scopa', name: 'SCOPA', color: 'linear-gradient(135deg, #825a2c, #05020a)', icon: '🧹', initFn: 'initScopa' },
        { id: 'briscola', name: 'BRISCOLA', color: 'linear-gradient(135deg, #2a0a4a, #4a1a6a)', icon: '⚔️', initFn: 'initBriscola' },
        { id: 'solo', name: 'SOLO', color: 'linear-gradient(135deg, #ff4444, #ffcc00)', icon: '🃏', initFn: 'initSoloGame' },
        { id: 'impostore', name: 'IMPOSTORE', color: 'linear-gradient(135deg, #ff3366, #330011)', icon: '🕵️‍♂️', initFn: 'initImpostore' },
        { id: 'burraco', name: 'BURRACO', color: 'linear-gradient(135deg, #004d40, #00241a)', icon: '♣️', initFn: 'initBurraco' },
        { id: 'scacchi', name: 'SCACCHI', color: 'linear-gradient(135deg, #333333, #000000)', icon: '♟️', initFn: 'initScacchi' },
        { id: 'solitario', name: 'SOLITARIO', color: 'linear-gradient(135deg, #1e3a8a, #1e1b4b)', icon: '🧘', initFn: 'initSolitario' },
        { id: 'numeri', name: 'NUMERI', color: 'linear-gradient(135deg, #0f766e, #134e4a)', icon: '🔢', initFn: 'initNumeri' }
    ];

    container.innerHTML = `
        <div id="lobby-wrapper" class="fade-in">
            <div class="dashboard-container">
                <button id="btn-back-main" class="btn-back-glass">← TORNA ALLA LIBRERIA</button>
                
                <header style="margin: 30px 0;">
                    <p class="subtitle">DIVERTIMENTO VELOCE</p>
                    <h1 class="main-title">MINI <span class="text-amethyst">GIOCHI</span></h1>
                </header>

                <div class="grid-layout" style="
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 15px;
                ">
                    ${games.map(game => `
                        <div class="game-card is-clickable minigame-item" id="btn-${game.id}" 
                             style="background: ${game.color}; padding: 25px 15px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 140px; margin-bottom: 0;">
                            <div style="font-size: 2.5rem; margin-bottom: 10px;">${game.icon}</div>
                            <h2 style="margin: 0; font-size: 0.9rem; font-weight: 900; color: white; letter-spacing: 1px;">${game.name}</h2>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Listener per tornare indietro
    container.querySelector('#btn-back-main').onclick = () => showLobby(container);

    // Assegnazione dinamica degli eventi click
    games.forEach(game => {
        const btn = container.querySelector(`#btn-${game.id}`);
        if (btn) {
            btn.onclick = async () => {
                try {
                    // Import dinamico basato sull'ID del gioco
                    const module = await import(`./dashboards/minigames/${game.id}.js`);
                    if (module && module[game.initFn]) {
                        module[game.initFn](container);
                    } else {
                        console.error(`Funzione ${game.initFn} non trovata nel modulo ${game.id}.js`);
                    }
                } catch (e) {
                    console.error(`Errore nel caricamento del gioco ${game.id}:`, e);
                    alert("Questo gioco è attualmente in manutenzione nella Taverna!");
                }
            };
        }
    });
}
