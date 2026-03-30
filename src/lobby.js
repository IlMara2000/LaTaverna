import { updateSidebarContext } from './components/layout/Sidebar.js';

export function showLobby(container) {
    // --- FIX CRITICO SCROLL ---
    // Forza il ripristino dello scroll sui nodi radice che Safari tende a bloccare
    document.documentElement.style.overflow = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static'; 
    window.scrollTo(0, 0); // Riporta l'utente in alto
    
    updateSidebarContext("home");

    const isGuest = localStorage.getItem('taverna_guest_user') !== null;
    const lockClass = isGuest ? "is-locked" : "is-clickable";
    const statusText = isGuest ? '🔴 MODALITÀ OSPITE' : '🟢 ACCESSO COMPLETO';
    
    // Aggiunto stile inline protettivo per lo scroll su iOS nel wrapper
    container.innerHTML = `
        <div id="lobby-wrapper" class="fade-in" style="overflow-y: auto; -webkit-overflow-scrolling: touch; min-height: 100dvh;">
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
                    <div class="section-title">
                        <span>🎲</span>
                        <h2 class="subtitle">Mondi & GDR</h2>
                    </div>

                    <div class="grid-layout">
                        <div class="game-card ${lockClass}" id="btn-dnd5e">
                            ${isGuest ? '<div class="badge-guest">SOLO ONLINE</div>' : ''}
                            <div class="card-footer">
                                <h2 class="card-title-sm">D&D 5E</h2>
                                <p class="card-desc">Dashboard Personaggi</p>
                            </div>
                            <div class="card-icon-small">🐉</div>
                        </div>

                        <div class="game-card is-locked" style="opacity: 0.4;">
                            <div class="card-footer">
                                <h2 class="card-title-sm">CYBERPUNK</h2>
                                <p class="card-desc">In arrivo...</p>
                            </div>
                            <div class="card-icon-small">⚡</div>
                        </div>
                    </div>
                </section>

                <section class="lobby-section">
                    <div class="section-title">
                        <span>🛠️</span>
                        <h2 class="subtitle">Utility Taverna</h2>
                    </div>
                    <div class="game-card is-clickable" id="btn-dice-roller">
                        <div class="card-footer">
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
    const btnMinigames = container.querySelector('#btn-portal-minigames');
    const btnDnd = container.querySelector('#btn-dnd5e');
    const btnDice = container.querySelector('#btn-dice-roller');

    if (btnMinigames) {
        btnMinigames.onclick = async () => {
            try {
                const { showMinigamesLobby } = await import('./minigamelist.js');
                showMinigamesLobby(container);
            } catch (err) { console.error("Errore:", err); }
        };
    }
    
    if (btnDnd) {
        btnDnd.onclick = async () => {
            if (isGuest) return alert("Questa funzione richiede il login!");
            try {
                const { initDndDashboard } = await import('./dashboards/dnd5e.js');
                initDndDashboard(container);
            } catch (err) { console.error("Errore:", err); }
        };
    }

    if (btnDice) btnDice.onclick = () => alert("In arrivo...");
}
