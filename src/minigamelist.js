import { updateSidebarContext } from './components/layout/Sidebar.js';
import { showLobby } from './lobby.js';

/**
 * LISTA MINIGIOCHI
 * Tema: Ametista Dark UI
 * File CSS: src/styles/global.css
 */
export function showMinigamesLobby(container) {
    // --- FIX SCROLL SAFARI ---
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    window.scrollTo(0, 0);

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
        <div id="lobby-wrapper" class="fade-in" style="-webkit-overflow-scrolling: touch;">
            <div class="dashboard-container">
                
                <button id="btn-back-main" class="btn-back-glass">
                    ← TORNA ALLA LIBRERIA
                </button>

                <header class="lobby-header" style="margin-top: 20px;">
                    <p class="subtitle">DIVERTIMENTO IN TAVERNA</p>
                    <h1 class="main-title">MINI <span class="text-amethyst">GIOCHI</span></h1>
                </header>

                <div class="grid-layout" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px;">
                    ${games.map(game => `
                        <div class="game-card minigame-item is-clickable" id="btn-${game.id}" 
                             style="background: ${game.color}; min-height: 140px; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 1px solid rgba(255,255,255,0.1);">
                            <div style="font-size: 2.5rem; margin-bottom: 10px;">${game.icon}</div>
                            <h2 style="margin: 0; font-size: 0.9rem; font-weight: 900; letter-spacing: 1px; color: white; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">${game.name}</h2>
                        </div>
                    `).join('')}
                </div>
                
            </div>
        </div>
    `;

    // --- GESTIONE CLICK ---
    
    // Torna alla Lobby principale
    const btnBack = container.querySelector('#btn-back-main');
    if (btnBack) {
        btnBack.onclick = () => showLobby(container);
    }

    // Listener dinamici per i giochi
    games.forEach(game => {
        const btn = container.querySelector(`#btn-${game.id}`);
        if (!btn) return;
        
        btn.onclick = async () => {
            try {
                // Mapping delle funzioni di init
                const initFunctions = {
                    solo: 'initSoloGame', impostore: 'initImpostore', briscola: 'initBriscola',
                    scopa: 'initScopa', burraco: 'initBurraco', scacchi: 'initScacchi',
                    solitario: 'initSolitario', numeri: 'initNumeri'
                };

                // Caricamento dinamico dal percorso corretto
                const module = await import(`./dashboards/minigames/${game.id}.js`);
                const fnName = initFunctions[game.id];

                if (module && module[fnName]) {
                    module[fnName](container);
                } else {
                    console.error(`Funzione ${fnName} non trovata nel modulo ${game.id}.js`);
                }
            } catch (e) { 
                console.warn(`Errore caricamento gioco ${game.id}:`, e);
                alert("Questo gioco è ancora in fase di sviluppo magico...");
            }
        };
    });
}
