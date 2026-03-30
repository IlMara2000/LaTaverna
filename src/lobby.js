import { updateSidebarContext } from './components/layout/Sidebar.js';

/**
 * DASHBOARD LIBRERIA (LOBBY)
 * Tema: Ametista Dark UI
 * File CSS di riferimento: src/styles/global.css
 */
export function showLobby(container) {
    // --- SBLOCCO GLOBALE SCROLL ---
    // Questi comandi resettano i blocchi che Safari/iOS applicano a volte durante le transizioni
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static'; 
    window.scrollTo(0, 0); 
    
    updateSidebarContext("home");

    const isGuest = localStorage.getItem('taverna_guest_user') !== null;
    const lockClass = isGuest ? "is-locked" : "is-clickable";
    const statusText = isGuest ? '🔴 MODALITÀ OSPITE' : '🟢 ACCESSO COMPLETO';
    
    // Struttura HTML pulita: le classi richiamano direttamente global.css
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
                    <div class="section-title" style="display: flex; align-items: center; gap: 10px; margin: 30px 0 15px 5px;">
                        <h2 class="subtitle">🎲 Mondi & GDR</h2>
                    </div>

                    <div class="grid-layout" style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                        <div class="game-card ${lockClass}" id="btn-dnd5e">
                            ${isGuest ? '<div class="badge-guest">SOLO ONLINE</div>' : ''}
                            <div class="card-footer" style="margin-top: 40px;">
                                <h2 class="card-title-sm">D&D 5E</h2>
                                <p class="card-desc">Dashboard Personaggi</p>
                            </div>
                            <div class="card-icon-small">🐉</div>
                        </div>

                        <div class="game-card is-locked" style="opacity: 0.4;">
                            <div class="card-footer" style="margin-top: 40px;">
                                <h2 class="card-title-sm">CYBERPUNK</h2>
                                <p class="card-desc">In arrivo...</p>
                            </div>
                            <div class="card-icon-small">⚡</div>
                        </div>
                    </div>
                </section>

                <section class="lobby-section">
                    <div class="section-title" style="display: flex; align-items: center; gap: 10px; margin: 30px 0 15px 5px;">
                        <h2 class="subtitle">🛠️ Utility Taverna</h2>
                    </div>
                    <div class="game-card is-clickable" id="btn-dice-roller">
                        <div class="card-footer" style="margin-top: 20px;">
                            <h2 class="card-title-sm">LANCIA DADI</h2>
                            <p class="card-desc">3D Physics Roller</p>
                        </div>
                        <div class="card-icon-small">🎲</div>
                    </div>
                </section>
                
            </div>
        </div>
    `;

    // --- LOGICA DI NAVIGAZIONE ---
    
    // Portal Minigames
    const btnMinigames = container.querySelector('#btn-portal-minigames');
    if (btnMinigames) {
        btnMinigames.onclick = async () => {
            try {
                const { showMinigamesLobby } = await import('./minigamelist.js');
                showMinigamesLobby(container);
            } catch (err) {
                console.error("Errore caricamento minigamelist:", err);
            }
        };
    }
    
    // D&D 5E
    const btnDnd = container.querySelector('#btn-dnd5e');
    if (btnDnd) {
        btnDnd.onclick = async () => {
            if (isGuest) return alert("Questa funzione richiede il login con Discord!");
            try {
                const { initDndDashboard } = await import('./dashboards/dnd5e.js');
                initDndDashboard(container);
            } catch (err) {
                console.error("Errore caricamento D&D:", err);
            }
        };
    }

    // Dice Roller
    const btnDice = container.querySelector('#btn-dice-roller');
    if (btnDice) {
        btnDice.onclick = () => alert("Il set di dadi incantati sta arrivando...");
    }
}
