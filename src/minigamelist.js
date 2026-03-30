// Correzione percorsi: se questo file è in /src, deve puntare a ./components/...
import { updateSidebarContext } from './components/layout/Sidebar.js';
import { showLobby } from './lobby.js';

// ESPOSTA CON IL NOME CORRETTO CHE CERCA LA SIDEBAR
export function showMinigamesList(container) {
    // Reset scroll per Safari/iOS
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    window.scrollTo(0, 0);

    // Notifica alla sidebar che siamo nei minigiochi
    if (typeof updateSidebarContext === 'function') {
        updateSidebarContext("minigames");
    }

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
        <div id="lobby-wrapper" class="fade-in" style="padding: 20px; color: white; min-height: 100vh; background: #090a0f;">
            <div class="dashboard-container" style="max-width: 800px; margin: 0 auto;">
                <button id="btn-back-main" class="btn-primary" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); cursor: pointer; padding: 10px 20px; border-radius: 50px; color: white;">
                    ← TORNA ALLA LIBRERIA
                </button>
                
                <header style="margin: 30px 0; text-align: center;">
                    <p style="font-size: 0.8rem; letter-spacing: 3px; opacity: 0.6; margin-bottom: 5px;">DIVERTIMENTO VELOCE</p>
                    <h1 style="font-size: 2.5rem; font-weight: 900; margin: 0;">MINI <span style="color: #9d4ede;">GIOCHI</span></h1>
                </header>

                <div class="grid-layout" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px;">
                    ${games.map(game => `
                        <div class="game-card is-clickable" id="btn-${game.id}" 
                             style="background: ${game.color}; padding: 25px 15px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 140px; border-radius: 20px; cursor: pointer; transition: transform 0.2s;">
                            <div style="font-size: 2.5rem; margin-bottom: 10px;">${game.icon}</div>
                            <h2 style="margin: 0; font-size: 0.9rem; font-weight: 900; color: white; letter-spacing: 1px;">${game.name}</h2>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Listener per tornare indietro
    document.getElementById('btn-back-main').onclick = () => showLobby(container);

    // Assegnazione dinamica degli eventi click
    games.forEach(game => {
        const btn = document.getElementById(`btn-${game.id}`);
        if (btn) {
            btn.onclick = async () => {
                try {
                    // Import dinamico basato sull'ID del gioco
                    const module = await import(`./dashboards/minigames/${game.id}.js`);
                    if (module && module[game.initFn]) {
                        module[game.initFn](container);
                    }
                } catch (e) {
                    console.error(`Errore nel caricamento del gioco ${game.id}:`, e);
                    alert("Questo gioco è attualmente in manutenzione!");
                }
            };
        }
    });
}

// ALIAS PER COMPATIBILITÀ: Se qualche file lo chiama ancora showMinigamesLobby
export const showMinigamesLobby = showMinigamesList;