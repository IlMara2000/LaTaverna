import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';

export function initDndDashboard(container) {
    updateSidebarContext("dnd5e");

    // FIX: Allineamento con il sistema di scroll globale
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = 'pan-y'; // Permette lo scroll verticale nativo
    window.scrollTo(0, 0);

    container.innerHTML = `
        <style>
            .dnd-hero {
                background: linear-gradient(135deg, rgba(40, 10, 60, 0.8) 0%, rgba(10, 5, 20, 0.9) 100%),
                            url('https://www.transparenttextures.com/patterns/dark-matter.png');
                border: 1px solid rgba(157, 78, 221, 0.3);
                border-radius: 30px;
                padding: 40px;
                position: relative;
                overflow: hidden;
                box-shadow: 0 20px 50px rgba(0,0,0,0.5), inset 0 0 30px rgba(157, 78, 221, 0.1);
                margin-bottom: 30px;
                animation: fadeInUp 0.6s ease-out backwards;
            }

            .dnd-title {
                font-family: 'Montserrat', sans-serif;
                font-size: 3.5rem; 
                font-weight: 900; 
                margin: 0; 
                line-height: 1;
            }

            @media (max-width: 768px) {
                .dnd-title {
                    font-size: 2.2rem; /* Ridotto per non rompere il layout mobile */
                }
                .dnd-hero {
                    padding: 25px;
                }
            }

            /* Dado gigante sfumato sullo sfondo */
            .dnd-hero::before {
                content: '20';
                position: absolute;
                right: -20px;
                bottom: -30px;
                font-size: 250px;
                font-weight: 900;
                color: rgba(157, 78, 221, 0.03);
                font-family: 'Montserrat', sans-serif; /* Usiamo il font corretto per il numero */
                transform: rotate(-15deg);
                pointer-events: none;
            }

            .dnd-badge {
                background: var(--amethyst-bright);
                color: black;
                padding: 6px 15px;
                border-radius: 50px;
                font-size: 10px;
                font-weight: 900;
                letter-spacing: 2px;
                display: inline-block;
                margin-bottom: 15px;
                box-shadow: 0 0 15px var(--amethyst-glow);
            }

            .action-card {
                background: rgba(255, 255, 255, 0.03);
                border: 1px solid rgba(255, 255, 255, 0.08);
                padding: 25px;
                border-radius: 20px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                cursor: pointer;
                text-align: left;
                -webkit-tap-highlight-color: transparent;
                outline: none;
            }

            .action-card:active {
                background: rgba(157, 78, 221, 0.1);
                border-color: var(--amethyst-bright);
                transform: scale(0.96);
            }

            @media (hover: hover) {
                .action-card:hover {
                    background: rgba(157, 78, 221, 0.1);
                    border-color: var(--amethyst-bright);
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px rgba(157, 78, 221, 0.2);
                }
            }

            .icon-circle {
                width: 50px;
                height: 50px;
                background: rgba(157, 78, 221, 0.1);
                border-radius: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 20px;
                color: var(--amethyst-bright);
                box-shadow: inset 0 0 10px rgba(157, 78, 221, 0.2);
            }
        </style>

        <div style="padding: 20px; max-width: 1100px; margin: 0 auto; box-sizing: border-box;" class="fade-in">
            
            <button id="back-to-lobby" class="btn-back-glass" style="width: auto; padding: 12px 20px; margin-bottom: 30px; display: inline-flex;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                TORNA ALLA LIBRERIA
            </button>

            <div class="dnd-hero">
                <div class="dnd-badge">SISTEMA UFFICIALE</div>
                <h1 class="dnd-title">
                    DUNGEONS <br> & <span style="color:var(--amethyst-bright); text-shadow: 0 0 20px var(--amethyst-glow);">DRAGONS</span>
                </h1>
                <p style="opacity: 0.6; margin-top: 20px; max-width: 500px; font-size: 14px; line-height: 1.6;">
                    Benvenuto, Avventuriero. Gestisci le tue campagne, consulta il grimorio degli incantesimi e forgia il destino dei tuoi eroi.
                </p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                
                <div class="action-card" style="animation: fadeInUp 0.6s 0.1s backwards;">
                    <div class="icon-circle">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 800;">Gestione Personaggi</h3>
                    <p style="margin: 0; font-size: 12px; opacity: 0.5;">Crea, livella e modifica le tue schede eroe.</p>
                </div>

                <div class="action-card" style="animation: fadeInUp 0.6s 0.2s backwards;">
                    <div class="icon-circle">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    </div>
                    <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 800;">Grimorio Incantesimi</h3>
                    <p style="margin: 0; font-size: 12px; opacity: 0.5;">Cerca tra centinaia di magie e filtri per livello.</p>
                </div>

                <div class="action-card" style="animation: fadeInUp 0.6s 0.3s backwards;">
                    <div class="icon-circle">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </div>
                    <h3 style="margin: 0 0 10px 0; font-size: 18px; font-weight: 800;">Sessioni Attive</h3>
                    <p style="margin: 0; font-size: 12px; opacity: 0.5;">Unisciti al tuo party e lancia i dadi in tempo reale.</p>
                </div>

            </div>

            <div style="margin-top: 50px; padding: 40px; border-top: 1px solid rgba(157, 78, 221, 0.1); text-align: center;">
                 <p style="opacity: 0.3; font-size: 12px; letter-spacing: 1px;">DUNGEONS & DRAGONS 5TH EDITION SYSTEM</p>
            </div>
        </div>
    `;

    document.getElementById('back-to-lobby').onclick = () => {
        showLobby(container);
    };
}
