// ==========================================
// SOTTO-LOBBY: GIOCHI DI CARTE
// ==========================================
export function showCardGamesLobby(container) {
    container.innerHTML = `
        <div id="lobby-wrapper" style="
            height: 100vh; overflow-y: auto; padding: 40px 20px; background: #05020a;
        " class="fade-in">
            
            <button id="btn-back-main" style="
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); 
                color: white; padding: 10px 20px; border-radius: 12px; 
                font-size: 12px; font-weight: 800; cursor: pointer; margin-bottom: 30px;
            ">← TORNA ALLA LIBRERIA</button>

            <div style="max-width: 1200px; margin: 0 auto; padding-bottom: 100px;">
                <h1 style="font-size: 2.5rem; font-weight: 900; margin-bottom: 40px;">I TUOI <span style="color:var(--amethyst-bright);">MAZZI</span></h1>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                    
                    <div class="game-card" id="btn-solo" style="
                        background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.3)), 
                                    linear-gradient(135deg, #ff4444 0%, #0066ff 33%, #33cc33 66%, #ffcc00 100%);
                        height: 300px; border-radius: 24px; border: 1px solid rgba(157, 78, 221, 0.3);
                        cursor: pointer; display: flex; align-items: flex-end; padding: 25px; transition: 0.4s;
                    ">
                        <h2 style="margin:0; font-size: 2rem; font-weight: 900;">SOLO</h2>
                    </div>

                    <div class="game-card" id="btn-briscola" style="
                        background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.4)), 
                                    linear-gradient(45deg, #2a0a4a 0%, #4a1a6a 100%);
                        height: 300px; border-radius: 24px; border: 1px solid rgba(157, 78, 221, 0.4);
                        cursor: pointer; display: flex; align-items: flex-end; padding: 25px; transition: 0.4s;
                    ">
                        <h2 style="margin:0; font-size: 2rem; font-weight: 900;">BRISCOLA</h2>
                    </div>

                    <div class="game-card" id="btn-scopa" style="
                        background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.4)), 
                                    linear-gradient(135deg, #825a2c 0%, #05020a 100%);
                        height: 300px; border-radius: 24px; border: 1px solid rgba(157, 78, 221, 0.4);
                        cursor: pointer; display: flex; align-items: flex-end; padding: 25px; transition: 0.4s;
                    ">
                        <h2 style="margin:0; font-size: 2rem; font-weight: 900;">SCOPA</h2>
                    </div>

                </div>
            </div>
        </div>
    `;

    // --- LOGICA CLICK ---
    document.getElementById('btn-back-main').onclick = () => showLobby(container);

    document.getElementById('btn-solo').onclick = async () => {
        const { initSoloGame } = await import('./dashboards/solo.js');
        initSoloGame(container);
    };

    document.getElementById('btn-briscola').onclick = async () => {
        const { initBriscola } = await import('./dashboards/briscola.js');
        initBriscola(container);
    };

    // Event Listener per la Scopa
    document.getElementById('btn-scopa').onclick = async () => {
        try {
            const { initScopa } = await import('./dashboards/scopa.js');
            initScopa(container);
        } catch (err) {
            console.error("Errore nel caricamento di Scopa:", err);
        }
    };
}
