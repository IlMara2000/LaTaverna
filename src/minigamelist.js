import { updateSidebarContext } from './components/layout/Sidebar.js';
import { showLobby } from './lobby.js';

export function showMinigamesList(container) {
    // Reset dello scroll per evitare blocchi
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    window.scrollTo(0, 0);

    if (typeof updateSidebarContext === 'function') {
        updateSidebarContext("minigames");
    }

    // LISTA GIOCHI (Scopa e Solitario rimossi)
    const games = [
        { id: 'briscola', name: 'BRISCOLA', color: 'linear-gradient(135deg, #2a0a4a, #4a1a6a)', icon: '⚔️', initFn: 'initBriscola' },
        { id: 'solo', name: 'SOLO', color: 'linear-gradient(135deg, #ff4444, #ffcc00)', icon: '🃏', initFn: 'initSoloGame' },
        { id: 'impostore', name: 'IMPOSTORE', color: 'linear-gradient(135deg, #ff3366, #330011)', icon: '🕵️‍♂️', initFn: 'initImpostore' },
        { id: 'burraco', name: 'BURRACO', color: 'linear-gradient(135deg, #004d40, #00241a)', icon: '♣️', initFn: 'initBurraco' },
        { id: 'scacchi', name: 'SCACCHI', color: 'linear-gradient(135deg, #333333, #000000)', icon: '♟️', initFn: 'initScacchi' },
        { id: 'numeri', name: 'NUMERI', color: 'linear-gradient(135deg, #0f766e, #134e4a)', icon: '🔢', initFn: 'initNumeri' }
    ];

    // RIMOSSA la classe .dashboard-container che creava il bordo invisibile!
    // Ora è un layout puro e piatto.
    container.innerHTML = `
        <div id="lobby-wrapper" class="fade-in" style="color: white; width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; padding-bottom: 140px; box-sizing: border-box;">
            
            <div style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 30px;">
                <button id="btn-back-main" class="btn-back-glass" style="width: auto; margin-bottom: 0;">
                    ← TORNA ALLA LIBRERIA
                </button>
            </div>
            
            <header style="margin: 10px 0 40px 0; text-align: center;">
                <p style="font-size: 0.8rem; letter-spacing: 3px; opacity: 0.6; margin-bottom: 5px; text-transform: uppercase;">Divertimento Veloce</p>
                <h1 class="main-title" style="margin: 0; font-size: 3rem; filter: drop-shadow(0 0 15px rgba(157,78,221,0.4));">MINI GIOCHI</h1>
            </header>

            <div class="grid-layout">
                ${games.map(game => `
                    <div class="game-card" id="btn-${game.id}" style="background: ${game.color}; min-height: 140px; justify-content: center; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 20px rgba(0,0,0,0.3);">
                        <div style="font-size: 2.8rem; margin-bottom: 10px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));">${game.icon}</div>
                        <h2 style="margin: 0; font-size: 0.9rem; font-weight: 900; color: white; letter-spacing: 1px;">${game.name}</h2>
                    </div>
                `).join('')}
            </div>
            
        </div>
    `;

    // Torna alla lobby principale
    document.getElementById('btn-back-main').onclick = () => showLobby(container);

    // Assegna il caricamento dinamico per ogni bottone
    games.forEach(game => {
        const btn = document.getElementById(`btn-${game.id}`);
        if (btn) {
            btn.onclick = async (e) => {
                e.preventDefault();
                try {
                    // Percorso relativo esatto per i minigiochi
                    const module = await import(`./dashboards/minigames/${game.id}.js`);
                    if (module && module[game.initFn]) {
                        module[game.initFn](container);
                    }
                } catch (err) {
                    console.error(`Errore nel caricamento del gioco ${game.id}:`, err);
                }
            };
        }
    });
}

export const showMinigamesLobby = showMinigamesList;
