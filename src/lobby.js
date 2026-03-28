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
            background: var(--void-black); 
            scrollbar-width: thin; 
            scrollbar-color: var(--amethyst-bright) transparent;
        " class="fade-in">
            
            <div style="max-width: 1200px; margin: 0 auto; padding-bottom: 100px;">
                <header style="margin-bottom: 50px;">
                    <h1 style="font-size: 2.5rem; font-weight: 900; letter-spacing: -1px; margin: 0;">LA <span style="color:var(--amethyst-bright);">LIBRERIA</span></h1>
                    <p style="opacity:0.5; text-transform: uppercase; font-size: 12px; letter-spacing: 2px; margin-top: 5px;">Seleziona un sistema di gioco</p>
                </header>
                
                <section style="margin-bottom: 60px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 25px; border-bottom: 1px solid var(--glass-border); padding-bottom: 15px;">
                        <span style="font-size: 1.8rem;">🃏</span>
                        <h2 style="font-size: 1.1rem; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; margin: 0; color: var(--pure-white);">Giochi di Carte</h2>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px;">
                        
                        <div class="game-card" id="btn-solo" style="
                            background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.3)), 
                                        linear-gradient(135deg, #ff4444 0%, #0066ff 33%, #33cc33 66%, #ffcc00 100%);
                            height: 300px; border-radius: 20px; border: 1px solid var(--glass-border);
                            cursor: pointer; display: flex; align-items: flex-end; padding: 25px; transition: 0.4s;
                        ">
                            <div>
                                <div style="background: var(--amethyst-bright); color: black; font-size: 9px; font-weight: 900; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 10px; letter-spacing: 1px;">MINIGIOCO</div>
                                <h2 style="margin:0; font-size: 1.8rem; font-weight: 900;">SOLO</h2>
                                <p style="opacity:0.9; font-size: 13px;">La sfida all'ultima carta</p>
                            </div>
                        </div>

                        <div class="game-card" id="btn-briscola" style="
                            background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.4)), 
                                        linear-gradient(45deg, #2a0a4a 0%, #4a1a6a 100%);
                            height: 300px; border-radius: 20px; border: 1px solid var(--glass-border);
                            cursor: pointer; display: flex; align-items: flex-end; padding: 25px; transition: 0.4s;
                            position: relative; overflow: hidden;
                        ">
                            <div style="position: absolute; top: 15px; right: 15px; font-size: 35px; opacity: 0.1; transform: rotate(15deg);">🪵🏆💰⚔️</div>
                            <div style="z-index: 1;">
                                <div style="background: var(--amethyst); color: white; font-size: 9px; font-weight: 900; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 10px; letter-spacing: 1px;">CLASSICO</div>
                                <h2 style="margin:0; font-size: 1.8rem; font-weight: 900;">BRISCOLA</h2>
                                <p style="opacity:0.8; font-size: 13px;">Tradizione e strategia</p>
                            </div>
                        </div>

                        <div style="background: var(--glass-bg); border: 2px dashed var(--glass-border); height: 300px; border-radius: 20px; display: flex; align-items: center; justify-content: center; opacity: 0.5;">
                            <p style="letter-spacing: 2px; font-size: 10px; opacity: 0.5;">PROSSIMAMENTE...</p>
                        </div>

                    </div>
                </section>

                <section>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 25px; border-bottom: 1px solid var(--glass-border); padding-bottom: 15px;">
                        <span style="font-size: 1.8rem;">🎲</span>
                        <h2 style="font-size: 1.1rem; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; margin: 0; color: var(--pure-white);">Tavolo & GDR</h2>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 25px;">
                        
                        <div class="game-card" id="btn-dnd5e" style="
                            background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.1)), url('https://images.unsplash.com/photo-1519074063261-bb8207ce2433?q=80&w=800');
                            background-size: cover; background-position: center;
                            height: 380px; border-radius: 24px; border: 1px solid var(--amethyst-glow);
                            cursor: pointer; display: flex; align-items: flex-end; padding: 30px; transition: 0.4s;
                        ">
                            <div>
                                <div style="background: rgba(0,0,0,0.6); color: var(--amethyst-bright); border: 1px solid var(--amethyst-bright); font-size: 9px; font-weight: 900; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 10px; letter-spacing: 1px;">CAMPAGNA GDR</div>
                                <h2 style="margin:0; font-size: 2.2rem; font-weight: 900;">D&D 5E</h2>
                                <p style="opacity:0.7; font-size: 14px;">Dungeons & Dragons Fifth Edition</p>
                            </div>
                        </div>

                        <div style="background: var(--glass-bg); border: 2px dashed var(--glass-border); height: 380px; border-radius: 24px; display: flex; align-items: center; justify-content: center; opacity: 0.5;">
                            <p style="letter-spacing: 2px; font-size: 10px; opacity: 0.5;">NUOVO SISTEMA IN ARRIVO...</p>
                        </div>

                    </div>
                </section>

            </div>
        </div>
    `;

    // --- LOGICA DI NAVIGAZIONE (Import Dinamici) ---

    // D&D 5E
    const btnDnd = document.getElementById('btn-dnd5e');
    if (btnDnd) {
        btnDnd.onclick = async () => {
            try {
                const { initDndDashboard } = await import('./dashboards/dnd5e.js');
                initDndDashboard(container);
            } catch (err) {
                console.error("Errore caricamento D&D:", err);
            }
        };
    }

    // SOLO
    const btnSolo = document.getElementById('btn-solo');
    if (btnSolo) {
        btnSolo.onclick = async () => {
            try {
                const { initSoloGame } = await import('./dashboards/solo.js');
                initSoloGame(container);
            } catch (err) {
                console.error("Errore caricamento SOLO:", err);
            }
        };
    }

    // BRISCOLA
    const btnBriscola = document.getElementById('btn-briscola');
    if (btnBriscola) {
        btnBriscola.onclick = async () => {
            try {
                const { initBriscola } = await import('./dashboards/briscola.js');
                initBriscola(container);
            } catch (err) {
                console.error("Errore caricamento BRISCOLA:", err);
            }
        };
    }
}
