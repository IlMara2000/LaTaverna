import { updateSidebarContext } from './components/layout/Sidebar.js';

export function showLobby(container) {
    // SBLOCCO SCROLL
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
    window.scrollTo(0, 0);
    
    updateSidebarContext("home");

    const isGuest = localStorage.getItem('taverna_guest_user') !== null;
    const lockClass = isGuest ? "is-locked" : "is-clickable";
    const statusText = isGuest ? '🔴 OSPITE' : '🟢 ONLINE';
    
    container.innerHTML = `
        <div id="lobby-wrapper" class="fade-in" style="-webkit-overflow-scrolling: touch;">
            <div class="dashboard-container">
                
                <header class="lobby-header">
                    <p class="subtitle">${statusText}</p>
                    <h1 class="main-title">LA <span class="text-amethyst">LIBRERIA</span></h1>
                </header>
                
                <div id="btn-portal-minigames" class="game-card portal-card is-clickable">
                    <div class="card-content">
                        <p class="subtitle" style="color: #c77dff;">COLLEZIONE AGGIORNATA</p>
                        <h2 class="card-title">MINI <span class="text-amethyst">GIOCHI</span></h2>
                        <p class="card-desc">Carte, Logica e Tradizione della Taverna</p>
                    </div>
                    <div class="card-icon-large">🎮</div>
                </div>

                <section class="lobby-section">
                    <h2 class="subtitle" style="margin: 30px 0 15px 5px;">🎲 MONDI & GDR</h2>
                    <div class="grid-layout" style="display: grid; gap: 15px;">
                        <div class="game-card ${lockClass}" id="btn-dnd5e">
                            <div class="card-content">
                                <h2 class="card-title-sm">D&D 5E</h2>
                                <p class="card-desc">Dashboard Personaggi</p>
                            </div>
                            <div class="card-icon-small">🐉</div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    `;

    container.querySelector('#btn-portal-minigames').onclick = async () => {
        const { showMinigamesLobby } = await import('./minigamelist.js');
        showMinigamesLobby(container);
    };

    const btnDnd = container.querySelector('#btn-dnd5e');
    if (btnDnd) {
        btnDnd.onclick = async () => {
            if (isGuest) return alert("Questa funzione richiede Discord!");
            const { initDndDashboard } = await import('./dashboards/dnd5e.js');
            initDndDashboard(container);
        };
    }
}
