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
                <header style="margin-bottom: 50px;">
                    <h1 style="font-size: 2.5rem; font-weight: 900; letter-spacing: -1px; margin: 0;">LA <span style="color:var(--amethyst-bright);">LIBRERIA</span></h1>
                    <p style="opacity:0.5; text-transform: uppercase; font-size: 12px; letter-spacing: 2px; margin-top: 5px;">Seleziona un sistema di gioco</p>
                </header>
                
                <div style="background: rgba(157, 78, 221, 0.05); border: 1px solid var(--glass-border); border-radius: 20px; padding: 15px; margin-bottom: 50px; box-shadow: 0 0 20px var(--amethyst-glow); backdrop-filter: blur(10px);">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px; text-align: left;">
                         <div style="display: flex; align-items: center; gap: 15px;">
                            <span style="font-size: 1.8rem;">🃏</span>
                            <div>
                                <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; text-transform: uppercase; letter-spacing: 3px; color: var(--pure-white);">Giochi di Carte</h3>
                                <p style="margin: 0; font-size: 11px; opacity: 0.5;">Solo, Briscola e classici della Taverna</p>
                            </div>
                        </div>
                        <button id="btn-portal-carte" class="btn-primary" style="padding: 12px 25px; font-size: 12px; font-weight: 900;">ACCEDI</button>
                    </div>
                </div>

                <section>
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 25px;">
                        <span style="font-size: 1.8rem;">🎲</span>
                        <h2 style="font-size: 1.1rem; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; margin: 0; color: var(--pure-white);">Tavolo & GDR</h2>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 25px;">
                        
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

                        <div style="background: rgba(255,255,255,0.01); border: 2px dashed rgba(255,255,255,0.05); height: 350px; border-radius: 24px; display: flex; align-items: center; justify-content: center; opacity: 0.3;">
                            <p style="letter-spacing: 2px; font-size: 10px;">PROSSIMAMENTE...</p>
                        </div>

                    </div>
                </section>
            </div>
        </div>
    `;

    // --- LOGICA CLICK LOBBY PRINCIPALE ---
    
    // Clicca Accedi Carte
    document.getElementById('btn-portal-carte').onclick = () => {
        // Apriamo la sottosezione
        const { showCardGamesLobby } = import('./lobby.js');
        showCardGamesLobby(container);
    };

    // Clicca D&D 5E
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
}
