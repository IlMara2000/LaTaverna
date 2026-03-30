import { updateSidebarContext } from './components/layout/Sidebar.js';

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
                    </div>
                </section>
            </div>
        </div>
    `;

    // Navigazione verso i minigiochi
    document.getElementById('btn-portal-minigames').onclick = async () => {
        const { showMinigamesLobby } = await import('./minigamelist.js');
        showMinigamesLobby(container);
    };
    
    document.getElementById('btn-dnd5e').onclick = async () => {
        if (isGuest) return alert("Questa funzione richiede Discord!");
        const { initDndDashboard } = await import('./dashboards/dnd5e.js');
        initDndDashboard(container);
    };
}