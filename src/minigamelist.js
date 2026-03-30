import { updateSidebarContext } from './components/layout/sidebar.js';
import { showLobby } from './lobby.js';

export function showMinigamesLobby(container) {
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    updateSidebarContext("minigames");

    container.innerHTML = `
        <div id="lobby-wrapper" class="fade-in">
            <div class="dashboard-container">
                <button id="btn-back-main" class="btn-back-glass">← INDIETRO</button>
                <h1 class="main-title">MINI <span class="text-amethyst">GIOCHI</span></h1>
                <div class="grid-layout" id="minigames-grid">
                    <div class="game-card is-clickable" id="btn-scopa" style="background:linear-gradient(135deg, #825a2c, #05020a)">
                        <h2>SCOPA</h2>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.querySelector('#btn-back-main').onclick = () => showLobby(container);
    
    // Esempio per un gioco
    const btnScopa = container.querySelector('#btn-scopa');
    if(btnScopa) {
        btnScopa.onclick = async () => {
            const { initScopa } = await import('./dashboards/minigames/scopa.js');
            initScopa(container);
        };
    }
}
