import { updateSidebarContext } from './components/layout/Sidebar.js';

export function showLobby(container) {
    // Reset della Sidebar allo stato "Home"
    updateSidebarContext("home");

    // Puliamo il container e aggiungiamo il wrapper con SCROLL ATTIVO
    container.innerHTML = `
        <div id="lobby-wrapper" style="
            height: 100vh; 
            overflow-y: auto; 
            padding: 40px 20px; 
            background: #05020a; 
            scrollbar-width: thin; 
            scrollbar-color: var(--amethyst-bright) transparent;
        " class="fade-in">
            
            <div style="max-width: 1200px; margin: 0 auto; padding-bottom: 100px;">
                <header style="margin-bottom: 40px;">
                    <h1 style="font-size: 2.5rem; font-weight: 900; letter-spacing: -1px; margin: 0;">LA <span style="color:var(--amethyst-bright);">LIBRERIA</span></h1>
                    <p style="opacity:0.5; text-transform: uppercase; font-size: 12px; letter-spacing: 2px; margin-top: 5px;">Seleziona un sistema di gioco</p>
                </header>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px;">
                    
                    <div class="game-card" id="btn-dnd5e" style="
                        background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.1)), url('https://images.unsplash.com/photo-1519074063261-bb8207ce2433?q=80&w=800');
                        background-size: cover; background-position: center;
                        height: 350px; border-radius: 24px; border: 1px solid rgba(157, 78, 221, 0.2);
                        cursor: pointer; display: flex; align-items: flex-end; padding: 30px; transition: 0.4s;
                    ">
                        <div>
                            <h2 style="margin:0; font-size: 2rem; font-weight: 900;">D&D 5E</h2>
                            <p style="opacity:0.7; font-size: 14px;">Dungeons & Dragons Fifth Edition</p>
                        </div>
                    </div>

                    <div class="game-card" id="btn-solo" style="
                        background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.3)), 
                                    linear-gradient(135deg, #ff4444 0%, #0066ff 33%, #33cc33 66%, #ffcc00 100%);
                        height: 350px; border-radius: 24px; border: 1px solid rgba(157, 78, 221, 0.3);
                        cursor: pointer; display: flex; align-items: flex-end; padding: 30px; transition: 0.4s;
                    ">
                        <div>
                            <div style="background: var(--amethyst-bright); color: black; font-size: 9px; font-weight: 900; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 10px; letter-spacing: 1px;">MINIGIOCO</div>
                            <h2 style="margin:0; font-size: 2rem; font-weight: 900;">SOLO</h2>
                            <p style="opacity:0.9; font-size: 14px;">La sfida all'ultima carta</p>
                        </div>
                    </div>

                    <div style="background: rgba(255,255,255,0.01); border: 2px dashed rgba(255,255,255,0.05); height: 350px; border-radius: 24px; display: flex; align-items: center; justify-content: center; opacity: 0.3;">
                        <p style="letter-spacing: 2px; font-size: 10px;">PROSSIMAMENTE...</p>
                    </div>

                    <div style="background: rgba(255,255,255,0.01); border: 2px dashed rgba(255,255,255,0.05); height: 350px; border-radius: 24px; display: flex; align-items: center; justify-content: center; opacity: 0.3;">
                        <p style="letter-spacing: 2px; font-size: 10px;">PROSSIMAMENTE...</p>
                    </div>

                </div>
            </div>
        </div>
    `;

    // --- LOGICA CLICK ---

    document.getElementById('btn-dnd5e').onclick = async () => {
        try {
            const { initDndDashboard } = await import('./dashboards/dnd5e.js');
            initDndDashboard(container);
        } catch (err) {
            console.error("Errore caricamento D&D:", err);
        }
    };

    document.getElementById('btn-solo').onclick = async () => {
        try {
            const { initSoloGame } = await import('./dashboards/solo.js');
            initSoloGame(container);
        } catch (err) {
            console.error("Errore caricamento SOLO:", err);
        }
    };
}
