import { updateSidebarContext } from './components/layout/Sidebar.js';

export function showLobby(container) {
    updateSidebarContext("home");

    const isGuest = localStorage.getItem('taverna_guest_user') !== null;
    const lockClass = isGuest ? "is-locked" : "is-clickable";
    const statusText = isGuest ? '🔴 MODALITÀ OSPITE (LIMITATA)' : '🟢 ACCESSO COMPLETO';
    const badgeGuest = isGuest ? `<div class="badge-guest" style="background: #ff4444; color: white; font-size: 8px; padding: 2px 6px; border-radius: 4px; position: absolute; top: 15px; left: 15px;">SOLO ONLINE</div>` : "";

    container.innerHTML = `
        <div id="lobby-wrapper" class="fade-in" style="background: transparent;">
            <div class="dashboard-container">
                
                <header class="lobby-header">
                    <h1 class="main-title">LA <span class="text-amethyst">LIBRERIA</span></h1>
                    <p class="status-indicator">${statusText}</p>
                </header>
                
                <div id="btn-portal-minigames" class="game-card portal-card">
                    <div class="card-content">
                        <div style="font-size: 9px; font-weight: 900; color: #c77dff; letter-spacing: 1px; margin-bottom: 5px;">COLLEZIONE AGGIORNATA</div>
                        <h2 style="margin: 0; font-weight: 900; font-size: 1.8rem; color: white;">MINI <span class="text-amethyst">GIOCHI</span></h2>
                        <p style="opacity: 0.6; font-size: 13px; color: white; margin-top: 5px;">Carte, Logica e Tradizione della Taverna</p>
                    </div>
                    <div class="card-icon-large">🎮</div>
                </div>

                <section class="lobby-section">
                    <div style="display: flex; align-items: center; gap: 10px; margin: 25px 0 15px 5px;">
                        <span>🎲</span>
                        <h2 class="subtitle" style="margin: 0;">Mondi & GDR</h2>
                    </div>

                    <div class="grid-layout">
                        <div class="game-card dnd-card ${lockClass}" id="btn-dnd5e">
                            ${badgeGuest}
                            <div style="margin-top: auto;">
                                <h2 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: white;">D&D 5E</h2>
                                <p style="opacity: 0.6; font-size: 12px; color: white;">Dashboard Personaggi Online</p>
                            </div>
                            <div class="card-icon-small">🐉</div>
                        </div>

                        <div class="game-card is-locked" style="opacity: 0.5;">
                            <div style="margin-top: auto;">
                                <h2 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: white;">CYBERPUNK</h2>
                                <p style="opacity: 0.6; font-size: 12px; color: white;">Coming Soon</p>
                            </div>
                            <div class="card-icon-small">⚡</div>
                        </div>
                    </div>
                </section>

                <section class="lobby-section">
                    <div style="display: flex; align-items: center; gap: 10px; margin: 25px 0 15px 5px;">
                        <span>🛠️</span>
                        <h2 class="subtitle" style="margin: 0;">Utility Taverna</h2>
                    </div>
                    <div class="grid-layout">
                        <div class="game-card is-clickable" id="btn-dice-roller">
                            <div style="margin-top: auto;">
                                <h2 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: white;">LANCIA DADI</h2>
                                <p style="opacity: 0.6; font-size: 12px; color: white;">3D Physics Roller</p>
                            </div>
                            <div class="card-icon-small">🎲</div>
                        </div>
                    </div>
                </section>
                
            </div>
        </div>
    `;

    // Navigazione
    document.getElementById('btn-portal-minigames').onclick = async () => {
        const { showMinigamesLobby } = await import('./minigamelist.js');
        showMinigamesLobby(container);
    };
    
    document.getElementById('btn-dnd5e').onclick = async () => {
        if (isGuest) return alert("Questa funzione richiede Discord!");
        const { initDndDashboard } = await import('./dashboards/dnd5e.js');
        initDndDashboard(container);
    };

    const btnDice = document.getElementById('btn-dice-roller');
    if(btnDice) btnDice.onclick = () => alert("Il set di dadi incantati sta arrivando...");
}
