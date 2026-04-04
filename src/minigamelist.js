import { updateSidebarContext } from './components/layout/Sidebar.js';
import { showLobby } from './lobby.js';

export function showMinigamesList(container) {
    // FIX: Niente reset dell'overscroll-behavior
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    window.scrollTo(0, 0);

    if (typeof updateSidebarContext === 'function') {
        updateSidebarContext("minigames");
    }

    // FIX: Aggiunta la proprietà 'file' con l'esatta sintassi Maiuscola/Minuscola per Vercel
    const games = [
        { id: 'scopa', file: 'Scopa', name: 'SCOPA', color: 'linear-gradient(135deg, #825a2c, #05020a)', icon: '🧹', initFn: 'initScopa' },
        { id: 'briscola', file: 'Briscola', name: 'BRISCOLA', color: 'linear-gradient(135deg, #2a0a4a, #4a1a6a)', icon: '⚔️', initFn: 'initBriscola' },
        { id: 'solo', file: 'Solo', name: 'SOLO', color: 'linear-gradient(135deg, #ff4444, #ffcc00)', icon: '🃏', initFn: 'initSoloGame' },
        { id: 'impostore', file: 'Impostore', name: 'IMPOSTORE', color: 'linear-gradient(135deg, #ff3366, #330011)', icon: '🕵️‍♂️', initFn: 'initImpostore' },
        { id: 'burraco', file: 'Burraco', name: 'BURRACO', color: 'linear-gradient(135deg, #004d40, #00241a)', icon: '♣️', initFn: 'initBurraco' },
        { id: 'scacchi', file: 'Scacchi', name: 'SCACCHI', color: 'linear-gradient(135deg, #333333, #000000)', icon: '♟️', initFn: 'initScacchi' },
        { id: 'solitario', file: 'Solitario', name: 'SOLITARIO', color: 'linear-gradient(135deg, #1e3a8a, #1e1b4b)', icon: '🧘', initFn: 'initSolitario' },
        { id: 'numeri', file: 'Numeri', name: 'NUMERI', color: 'linear-gradient(135deg, #0f766e, #134e4a)', icon: '🔢', initFn: 'initNumeri' }
    ];

    container.innerHTML = `
        <div id="lobby-wrapper" style="color: white; width: 100%; animation: cardEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;">
            <div class="dashboard-container" style="max-width: 800px; margin: 0 auto; padding-bottom: calc(120px + env(safe-area-inset-bottom));">
                
                <div style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 20px; padding-right: 60px;">
                    <button id="btn-back-main" class="btn-primary" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); cursor: pointer; padding: 10px 20px; border-radius: 50px; color: white; outline: none; -webkit-tap-highlight-color: transparent;">
                        ← TORNA ALLA LIBRERIA
                    </button>
                </div>
                
                <header style="margin: 10px 0 30px 0; text-align: center;">
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

    document.getElementById('btn-back-main').onclick = () => showLobby(container);

    games.forEach(game => {
        const btn = document.getElementById(`btn-${game.id}`);
        if (btn) {
            btn.onclick = async () => {
                try {
                    // FIX: Uso game.file per rispettare il Case-Sensitive su Vercel
                    const module = await import(`./dashboards/minigames/${game.file}.js`);
                    if (module && module[game.initFn]) {
                        module[game.initFn](container);
                    }
                } catch (e) {
                    console.error(`Errore nel caricamento del gioco ${game.file}:`, e);
                    alert("Questo gioco è attualmente in manutenzione!");
                }
            };
        }
    });
}

export const showMinigamesLobby = showMinigamesList;
