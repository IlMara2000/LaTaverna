import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';

export function initDndDashboard(container) {
    // Aggiorna la Sidebar con i menu di D&D (Personaggi, Incantesimi, etc.)
    updateSidebarContext("dnd5e");

    container.innerHTML = `
        <div style="padding: 30px 20px; max-width: 1000px; margin: 0 auto;" class="fade-in">
            
            <button id="back-to-lobby" style="
                display: flex; align-items: center; gap: 10px;
                background: rgba(157, 78, 221, 0.1); 
                border: 1px solid rgba(157, 78, 221, 0.4);
                color: var(--amethyst-bright); 
                padding: 12px 20px; border-radius: 14px;
                cursor: pointer; font-size: 11px; font-weight: 800; 
                letter-spacing: 1.5px; margin-bottom: 30px; 
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            ">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                TORNA ALLA HOME
            </button>

            <header style="margin-bottom: 30px;">
                <h1 style="font-size: 2.5rem; font-weight: 900; text-transform: uppercase; margin: 0;">
                    DASHBOARD <span style="color:var(--amethyst-bright);">D&D</span>
                </h1>
                <div style="width: 60px; height: 4px; background: var(--amethyst-bright); border-radius: 2px; margin-top: 10px;"></div>
            </header>

            <div id="dnd-content">
                <div style="
                    background: rgba(157, 78, 221, 0.05); 
                    border: 1px solid rgba(157, 78, 221, 0.2); 
                    border-radius: 24px; 
                    padding: 80px 20px; 
                    text-align: center;
                    backdrop-filter: blur(5px);
                ">
                    <p style="opacity: 0.5; font-style: italic; font-size: 14px;">
                        Caricamento sessioni di gioco in corso...
                    </p>
                </div>
            </div>
        </div>
    `;

    // Torna alla Lobby cliccando il tasto
    document.getElementById('back-to-lobby').onclick = () => {
        showLobby(container);
    };

    // Qui sotto caricherai le sessioni specifiche da Supabase filtrando per 'dnd5e'
    // loadDndSessions(); 
}
