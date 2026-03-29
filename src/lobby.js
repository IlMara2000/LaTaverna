import { updateSidebarContext } from './components/layout/Sidebar.js';

// ==========================================
// LOBBY PRINCIPALE (GDR + Accesso Carte)
// ==========================================
export function showLobby(container) {
    updateSidebarContext("home");

    // Controllo se l'utente è un Ospite
    const isGuest = localStorage.getItem('taverna_guest_user') !== null;
    
    // Stili dinamici per funzioni bloccate
    const lockStyle = isGuest ? "opacity: 0.4; cursor: not-allowed; filter: grayscale(0.8);" : "cursor: pointer;";
    const badgeGuest = isGuest ? `<div style="background: #ff4444; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; position: absolute; top: 20px; right: 20px; letter-spacing: 1px;">SOLO ONLINE</div>` : "";

    container.innerHTML = `
        <div id="lobby-wrapper" style="
            min-height: 100dvh; 
            box-sizing: border-box; 
            padding: 40px 20px 80px 20px; 
            background: #05020a; 
        " class="fade-in">
            
            <div style="max-width: 1200px; margin: 0 auto; padding-bottom: 20px;">
                <header style="margin-bottom: 40px;">
                    <h1 style="font-size: 2.5rem; font-weight: 900; letter-spacing: -1px; margin: 0; color: white;">LA <span style="color:var(--amethyst-bright);">LIBRERIA</span></h1>
                    <p style="opacity:0.5; text-transform: uppercase; font-size: 12px; letter-spacing: 2px; margin-top: 5px; color: white;">
                        ${isGuest ? '🔴 MODALITÀ OSPITE (LIMITATA)' : '🟢 ACCESSO COMPLETO'}
                    </p>
                </header>
                
                <div id="btn-portal-carte" style="
                    background: linear-gradient(135deg, rgba(157, 78, 221, 0.15) 0%, rgba(5, 2, 10, 1) 100%);
                    border: 1px solid rgba(157, 78, 221, 0.4);
                    border-radius: 24px;
                    padding: 30px;
                    margin-bottom: 50px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    transition: all 0.3s ease;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    position: relative;
                    overflow: hidden;
                " class="game-card">
                    <div style="z-index: 1;">
                        <div style="background: var(--amethyst-bright); color: black; font-size: 9px; font-weight: 900; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 12px; letter-spacing: 1px;">DISPONIBILE</div>
                        <h2 style="margin:0; font-size: 1.8rem; font-weight: 900; color: white;">GIOCHI DI <span style="color:var(--amethyst-bright);">CARTE</span></h2>
                        <p style="opacity:0.6; font-size: 14px; margin-top: 5px; color: white;">Minigiochi e classici della Taverna (Offline)</p>
                    </div>
                    <div style="font-size: 3rem; opacity: 0.8; z-index: 1;">🃏</div>
                </div>

                <section>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 25px;">
                        <span style="font-size: 1.5rem;">🎲</span>
                        <h2 style="font-size: 1.1rem; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; margin: 0; color: white;">Tavolo & GDR</h2>
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

                        <div class="game-card" id="btn-impostore" style="
                            background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.4)), 
                                        linear-gradient(135deg, #ff3366 0%, #330011 100%);
                            height: 350px; border-radius: 24px; border: 1px solid rgba(255, 51, 102, 0.4);
                            display: flex; align-items: flex-end; padding: 30px; transition: 0.4s; position: relative;
                            ${lockStyle}
                        ">
                            ${badgeGuest}
                            <div>
                                <h2 style="margin:0; font-size: 2rem; font-weight: 900; color: white;">IMPOSTORE</h2>
                                <p style="opacity:0.7; font-size: 14px; color: white;">Ruoli Nascosti Multiplayer</p>
                            </div>
                        </div>

                        <div style="background: rgba(255,255,255,0.02); border: 2px dashed rgba(255,255,255,0.05); height: 350px; border-radius: 24px; display: flex; align-items: center; justify-content: center; opacity: 0.3;">
                            <p style="letter-spacing: 2px; font-size: 10px; color: white;">PROSSIMAMENTE...</p>
                        </div>

                    </div>
                </section>
            </div>
        </div>
    `;

    // --- LOGICA EVENTI ---
    document.getElementById('btn-portal-carte').onclick = () => showCardGamesLobby(container);
    
    document.getElementById('btn-dnd5e').onclick = async () => {
        if (isGuest) return alert("Questa funzione richiede l'accesso con Discord!");
        try {
            const { initDndDashboard } = await import('./dashboards/dnd5e.js');
            initDndDashboard(container);
        } catch (err) { console.error("Errore caricamento D&D:", err); }
    };

    document.getElementById('btn-impostore').onclick = async () => {
        if (isGuest) return alert("Il gioco 'Impostore' è solo Multiplayer. Accedi con Discord!");
        try {
            // PERCORSO AGGIORNATO: dashboards/minigames/
            const { initImpostore } = await import('./dashboards/minigames/impostore.js');
            initImpostore(container);
        } catch (err) { console.error("Errore caricamento Impostore:", err); }
    };
}

// ==========================================
// SOTTO-LOBBY: GIOCHI DI CARTE
// ==========================================
export function showCardGamesLobby(container) {
    container.innerHTML = `
        <div id="lobby-wrapper" style="min-height: 100dvh; box-sizing: border-box; padding: 40px 20px 80px 20px; background: #05020a;" class="fade-in">
            <button id="btn-back-main" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 20px; border-radius: 12px; font-size: 12px; font-weight: 800; cursor: pointer; margin-bottom: 30px;">← TORNA ALLA LIBRERIA</button>
            <div style="max-width: 1200px; margin: 0 auto;">
                <h1 style="font-size: 2.5rem; font-weight: 900; margin-bottom: 40px; color: white;">I TUOI <span style="color:var(--amethyst-bright);">MAZZI</span></h1>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                    <div class="game-card" id="btn-solo" style="background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.3)), linear-gradient(135deg, #ff4444 0%, #0066ff 33%, #33cc33 66%, #ffcc00 100%); height: 300px; border-radius: 24px; border: 1px solid rgba(157, 78, 221, 0.3); cursor: pointer; display: flex; align-items: flex-end; padding: 25px; transition: 0.4s;"><h2 style="margin:0; font-size: 2rem; font-weight: 900; color: white;">SOLO</h2></div>
                    <div class="game-card" id="btn-briscola" style="background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.4)), linear-gradient(45deg, #2a0a4a 0%, #4a1a6a 100%); height: 300px; border-radius: 24px; border: 1px solid rgba(157, 78, 221, 0.4); cursor: pointer; display: flex; align-items: flex-end; padding: 25px; transition: 0.4s;"><h2 style="margin:0; font-size: 2rem; font-weight: 900; color: white;">BRISCOLA</h2></div>
                    <div class="game-card" id="btn-scopa" style="background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.4)), linear-gradient(135deg, #825a2c 0%, #05020a 100%); height: 300px; border-radius: 24px; border: 1px solid rgba(157, 78, 221, 0.4); cursor: pointer; display: flex; align-items: flex-end; padding: 25px; transition: 0.4s;"><h2 style="margin:0; font-size: 2rem; font-weight: 900; color: white;">SCOPA</h2></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-back-main').onclick = () => showLobby(container);

    // PERCORSI AGGIORNATI: dashboards/minigames/
    document.getElementById('btn-solo').onclick = async () => { 
        try {
            const { initSoloGame } = await import('./dashboards/minigames/solo.js'); 
            initSoloGame(container); 
        } catch (e) { console.error(e); }
    };
    
    document.getElementById('btn-briscola').onclick = async () => { 
        try {
            const { initBriscola } = await import('./dashboards/minigames/briscola.js'); 
            initBriscola(container); 
        } catch (e) { console.error(e); }
    };
    
    document.getElementById('btn-scopa').onclick = async () => { 
        try {
            const { initScopa } = await import('./dashboards/minigames/scopa.js'); 
            initScopa(container); 
        } catch (e) { console.error(e); }
    };
}