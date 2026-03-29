import { updateSidebarContext } from './components/layout/Sidebar.js';

// ==========================================
// LOBBY PRINCIPALE (GDR + Accesso Mini Giochi)
// ==========================================
export function showLobby(container) {
    updateSidebarContext("home");

    const isGuest = localStorage.getItem('taverna_guest_user') !== null;
    const lockStyle = isGuest ? "opacity: 0.4; cursor: not-allowed; filter: grayscale(0.8);" : "cursor: pointer;";
    const badgeGuest = isGuest ? `<div style="background: #ff4444; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; position: absolute; top: 20px; right: 20px; letter-spacing: 1px;">SOLO ONLINE</div>` : "";

    container.innerHTML = `
        <div id="lobby-wrapper" style="min-height: 100dvh; box-sizing: border-box; padding: 40px 20px 80px 20px; background: #05020a;" class="fade-in">
            <div style="max-width: 1200px; margin: 0 auto; padding-bottom: 20px;">
                <header style="margin-bottom: 40px;">
                    <h1 style="font-size: 2.5rem; font-weight: 900; letter-spacing: -1px; margin: 0; color: white;">LA <span style="color:var(--amethyst-bright);">LIBRERIA</span></h1>
                    <p style="opacity:0.5; text-transform: uppercase; font-size: 12px; letter-spacing: 2px; margin-top: 5px; color: white;">
                        ${isGuest ? '🔴 MODALITÀ OSPITE (LIMITATA)' : '🟢 ACCESSO COMPLETO'}
                    </p>
                </header>
                
                <div id="btn-portal-minigames" style="
                    background: linear-gradient(135deg, rgba(157, 78, 221, 0.2) 0%, rgba(5, 2, 10, 1) 100%);
                    border: 1px solid rgba(157, 78, 221, 0.5);
                    border-radius: 24px; padding: 35px; margin-bottom: 50px; cursor: pointer;
                    display: flex; align-items: center; justify-content: space-between;
                    transition: all 0.3s ease; box-shadow: 0 10px 40px rgba(0,0,0,0.6);
                " class="game-card">
                    <div>
                        <div style="background: var(--amethyst-bright); color: black; font-size: 9px; font-weight: 900; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 12px; letter-spacing: 1px;">COLLEZIONE AGGIORNATA</div>
                        <h2 style="margin:0; font-size: 2.2rem; font-weight: 900; color: white;">MINI <span style="color:var(--amethyst-bright);">GIOCHI</span></h2>
                        <p style="opacity:0.6; font-size: 14px; margin-top: 5px; color: white;">Carte, Logica e Tradizione della Taverna</p>
                    </div>
                    <div style="font-size: 4rem; filter: drop-shadow(0 0 15px var(--amethyst-bright));">🎮</div>
                </div>

                <section>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 25px;">
                        <span style="font-size: 1.5rem;">🎲</span>
                        <h2 style="font-size: 1.1rem; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; margin: 0; color: white;">Mondi & GDR</h2>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px;">
                        <div class="game-card" id="btn-dnd5e" style="
                            background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.2)), url('https://images.unsplash.com/photo-1519074063261-bb8207ce2433?q=80&w=800');
                            background-size: cover; background-position: center;
                            height: 350px; border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.05);
                            display: flex; align-items: flex-end; padding: 30px; transition: 0.4s; position: relative;
                            ${lockStyle}
                        ">
                            ${badgeGuest}
                            <div>
                                <h2 style="margin:0; font-size: 2rem; font-weight: 900; color: white;">D&D 5E</h2>
                                <p style="opacity:0.7; font-size: 14px; color: white;">Dashboard Personaggi Online</p>
                            </div>
                        </div>

                        <div style="background: rgba(255,255,255,0.02); border: 2px dashed rgba(255,255,255,0.05); height: 350px; border-radius: 24px; display: flex; align-items: center; justify-content: center; opacity: 0.3;">
                            <p style="letter-spacing: 2px; font-size: 10px; color: white;">NUOVI MONDI IN ARRIVO...</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    `;

    document.getElementById('btn-portal-minigames').onclick = () => showMinigamesLobby(container);
    
    document.getElementById('btn-dnd5e').onclick = async () => {
        if (isGuest) return alert("Questa funzione richiede Discord!");
        try {
            const { initDndDashboard } = await import('./dashboards/dnd5e.js');
            initDndDashboard(container);
        } catch (err) { console.error(err); }
    };
}

// ==========================================
// SOTTO-LOBBY: TUTTI I MINI GIOCHI
// ==========================================
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

    // LOGICA DI CARICAMENTO DINAMICO
    games.forEach(game => {
        document.getElementById(`btn-${game.id}`).onclick = async () => {
            try {
                // Carica dinamicamente il file basandosi sull'id (che corrisponde al nome file nella foto)
                const module = await import(`./dashboards/minigames/${game.id}.js`);
                
                // Cerca la funzione di init (es: initSoloGame, initBriscola, ecc)
                // Se i file hanno nomi funzioni standard tipo "init", usiamo quello, 
                // altrimenti mappiamo i nomi specifici:
                const initFunctions = {
                    solo: 'initSoloGame',
                    impostore: 'initImpostore',
                    briscola: 'initBriscola',
                    scopa: 'initScopa',
                    burraco: 'initBurraco',
                    scacchi: 'initScacchi',
                    solitario: 'initSolitario',
                    numeri: 'initNumeri'
                };

                const fnName = initFunctions[game.id];
                if (module[fnName]) {
                    module[fnName](container);
                } else {
                    console.error(`Funzione ${fnName} non trovata in ${game.id}.js`);
                }
            } catch (e) {
                console.error(e);
                alert(`Errore: Impossibile caricare dashboards/minigames/${game.id}.js`);
            }
        };
    });
}
