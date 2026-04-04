import { updateSidebarContext } from './components/layout/Sidebar.js';

export function showLobby(container) {
    // FIX: Pulizia TOTALE di qualsiasi blocco lasciato dai minigiochi
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    document.body.style.backgroundColor = ''; // Ripristina il background trasparente globale
    window.scrollTo(0, 0);
    
    updateSidebarContext("home");

    const isGuest = localStorage.getItem('taverna_guest_user') !== null;
    
    container.innerHTML = `
        <div id="lobby-wrapper" style="width: 100%; animation: cardEntrance 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;">
            
            <div class="dashboard-container" style="padding-bottom: calc(120px + env(safe-area-inset-bottom));">
                
                <header class="lobby-header" style="margin-bottom: 30px;">
                    <p class="subtitle" style="opacity: 0.6; font-size: 0.8rem; letter-spacing: 2px;">${isGuest ? '🔴 OSPITE' : '🟢 ONLINE'}</p>
                    <h1 class="main-title">LA <span class="text-amethyst">LIBRERIA</span></h1>
                </header>
                
                <div id="btn-portal-minigames" class="game-card portal-card is-clickable" style="outline: none; -webkit-tap-highlight-color: transparent;">
                    <div class="card-content">
                        <h2 class="card-title">🎮 MINI <span class="text-amethyst">GIOCHI</span></h2>
                    </div>
                </div>
                
                <section class="lobby-section" style="margin-top: 30px;">
                    <h2 class="subtitle" style="opacity: 0.6; font-size: 0.9rem; letter-spacing: 2px; margin-bottom: 10px;">🎲 GDR</h2>
                    <div class="game-card is-clickable" id="btn-dnd5e" style="outline: none; -webkit-tap-highlight-color: transparent;">
                        <h2 class="card-title-sm">🐉 D&D 5E</h2>
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
