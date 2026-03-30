import { updateSidebarContext } from './components/layout/Sidebar.js';

export function showLobby(container) {
    updateSidebarContext("home");

    const isGuest = localStorage.getItem('taverna_guest_user') !== null;
    const lockClass = isGuest ? "is-locked" : "is-clickable";
    const statusText = isGuest ? '🔴 MODALITÀ OSPITE (LIMITATA)' : '🟢 ACCESSO COMPLETO';
    const badgeGuest = isGuest ? `<div class="badge-guest">SOLO ONLINE</div>` : "";

    container.innerHTML = `
        <div id="lobby-wrapper" class="fade-in">
            <div class="dashboard-container">
                
                <header class="lobby-header">
                    <h1 class="main-title">LA <span class="text-amethyst">LIBRERIA</span></h1>
                    <p class="status-indicator">${statusText}</p>
                </header>
                
                <div id="btn-portal-minigames" class="game-card portal-card clickable-effect">
                    <div class="card-content">
                        <div class="badge-new">COLLEZIONE AGGIORNATA</div>
                        <h2 class="card-main-title">MINI <span class="text-amethyst">GIOCHI</span></h2>
                        <p class="card-subtitle">Carte, Logica e Tradizione della Taverna</p>
                    </div>
                    <div class="card-icon-large">🎮</div>
                </div>

                <section class="lobby-section">
                    <div class="section-title">
                        <span class="icon-bg">🎲</span>
                        <h2 class="subtitle">Mondi & GDR</h2>
                    </div>

                    <div class="grid-layout">
                        <div class="game-card dnd-card ${lockClass}" id="btn-dnd5e">
                            ${badgeGuest}
                            <div class="card-footer">
                                <h2 class="card-title-small">D&D 5E</h2>
                                <p class="card-desc">Dashboard Personaggi Online</p>
                            </div>
                            <div class="card-icon-small">🐉</div>
                        </div>

                        <div class="game-card is-locked">
                            <div class="card-footer">
                                <h2 class="card-title-small">CYBERPUNK</h2>
                                <p class="card-desc">Coming Soon</p>
                            </div>
                            <div class="card-icon-small">⚡</div>
                        </div>
                    </div>
                </section>

                <section class="lobby-section">
                    <div class="section-title">
                        <span class="icon-bg">🛠️</span>
                        <h2 class="subtitle">Utility Taverna</h2>
                    </div>
                    <div class="grid-layout">
                        <div class="game-card is-clickable" id="btn-dice-roller">
                            <div class="card-footer">
                                <h2 class="card-title-small">LANCIA DADI</h2>
                                <p class="card-desc">3D Physics Roller</p>
                            </div>
                            <div class="card-icon-small">🎲</div>
                        </div>
                    </div>
                </section>
                
            </div>
        </div>
    `;

    // --- LOGICA DI NAVIGAZIONE ---

    // Portale Minigiochi
    document.getElementById('btn-portal-minigames').onclick = async () => {
        const { showMinigamesLobby } = await import('./minigamelist.js');
        showMinigamesLobby(container);
    };
    
    // D&D 5E
    document.getElementById('btn-dnd5e').onclick = async () => {
        if (isGuest) {
            alert("Questa funzione richiede Discord!");
            return;
        }
        const { initDndDashboard } = await import('./dashboards/dnd5e.js');
        initDndDashboard(container);
    };

    // Altre utility (Esempio Dice Roller)
    const btnDice = document.getElementById('btn-dice-roller');
    if(btnDice) {
        btnDice.onclick = () => {
            alert("Il set di dadi incantati sta arrivando...");
        };
    }
}
