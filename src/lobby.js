import { updateSidebarContext } from './components/layout/sidebar.js';

export function showLobby(container) {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    window.scrollTo(0, 0);
    
    updateSidebarContext("home");

    const isGuest = localStorage.getItem('taverna_guest_user') !== null;
    
    container.innerHTML = `
        <div id="lobby-wrapper" class="fade-in">
            <div class="dashboard-container">
                <header class="lobby-header">
                    <p class="subtitle">${isGuest ? '🔴 OSPITE' : '🟢 ONLINE'}</p>
                    <h1 class="main-title">LA <span class="text-amethyst">LIBRERIA</span></h1>
                </header>
                <div id="btn-portal-minigames" class="game-card portal-card is-clickable">
                    <div class="card-content">
                        <h2 class="card-title">MINI <span class="text-amethyst">GIOCHI</span></h2>
                    </div>
                    <div class="card-icon-large">🎮</div>
                </div>
                <section class="lobby-section">
                    <h2 class="subtitle">🎲 GDR</h2>
                    <div class="game-card is-clickable" id="btn-dnd5e">
                        <h2 class="card-title-sm">D&D 5E</h2>
                        <div class="card-icon-small">🐉</div>
                    </div>
                </section>
            </div>
        </div>
    `;

    container.querySelector('#btn-portal-minigames').onclick = async () => {
        const { showMinigamesLobby } = await import('./minigamelist.js');
        showMinigamesLobby(container);
    };

    container.querySelector('#btn-dnd5e').onclick = async () => {
        if (isGuest) return alert("Login richiesto!");
        const { initDndDashboard } = await import('./dashboards/dnd5e.js');
        initDndDashboard(container);
    };
}
