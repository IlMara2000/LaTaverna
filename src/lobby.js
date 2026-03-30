import { updateSidebarContext } from './components/layout/Sidebar.js';

export function showLobby(container) {
    updateSidebarContext("home");

    const isGuest = localStorage.getItem('taverna_guest_user') !== null;
    
    // Gestione dinamica delle classi invece degli stili inline
    const lockClass = isGuest ? "is-locked" : "is-clickable";
    const statusText = isGuest ? '🔴 MODALITÀ OSPITE (LIMITATA)' : '🟢 ACCESSO COMPLETO';
    const badgeGuest = isGuest ? `<div class="badge-guest">SOLO ONLINE</div>` : "";

    container.innerHTML = `
        <div id="lobby-wrapper" class="fade-in">
            <div class="dashboard-container">
                
                <header class="lobby-header">
                    <h1>LA <span class="text-amethyst">LIBRERIA</span></h1>
                    <p class="status-indicator">${statusText}</p>
                </header>
                
                <div id="btn-portal-minigames" class="game-card portal-card">
                    <div class="card-content">
                        <div class="badge-new">COLLEZIONE AGGIORNATA</div>
                        <h2>MINI <span class="text-amethyst">GIOCHI</span></h2>
                        <p>Carte, Logica e Tradizione della Taverna</p>
                    </div>
                    <div class="card-icon">🎮</div>
                </div>

                <section class="lobby-section">
                    <div class="section-title">
                        <span>🎲</span>
                        <h2>Mondi & GDR</h2>
                    </div>

                    <div class="grid-layout">
                        <div class="game-card dnd-card ${lockClass}" id="btn-dnd5e">
                            ${badgeGuest}
                            <div class="card-footer">
                                <h2>D&D 5E</h2>
                                <p>Dashboard Personaggi Online</p>
                            </div>
                        </div>
                    </div>
                </section>
                
            </div>
        </div>
    `;

    // --- LOGICA DI NAVIGAZIONE ---
    document.getElementById('btn-portal-minigames').onclick = async () => {
        const { showMinigamesLobby } = await import('./minigamelist.js');
        showMinigamesLobby(container);
    };
    
    document.getElementById('btn-dnd5e').onclick = async () => {
        if (isGuest) {
            alert("Questa funzione richiede Discord!");
            return;
        }
        const { initDndDashboard } = await import('./dashboards/dnd5e.js');
        initDndDashboard(container);
    };
}
