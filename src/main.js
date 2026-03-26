import './styles/global.css'; 
import { supabase } from './services/supabase.js';
import { initLogin } from './components/features/auth/Login.js';
import { initNavbar } from './components/layout/Navbar.js';
import { showDashboard } from './dashboard.js'; 

const uiContainer = document.getElementById('ui');
const SERVER_INVITE = "https://discord.gg/9BqNgdqC";

async function initApp() {
    if (!uiContainer) return;

    // 1. Recupera la sessione utente da Supabase
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Schermata Iniziale (La Coppa)
    uiContainer.innerHTML = `
        <div class="entry-container" id="entry-screen" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; cursor: pointer;">
            <img src="/assets/logo.png" alt="La Taverna" id="main-logo" style="width: 120px; filter: drop-shadow(0 0 15px #9d4ede);" onerror="this.src='https://placehold.co/100x100?text=Taverna'">
            <p class="tap-instruction" style="margin-top: 20px; opacity: 0.5; letter-spacing: 2px; font-size: 12px; text-transform: uppercase;">Tocca la Coppa per Entrare</p>
        </div>
        <div id="content-area" style="display:none; width:100%; height:100%;"></div>
    `;

    const entryScreen = document.getElementById('entry-screen');
    const contentArea = document.getElementById('content-area');

    entryScreen.onclick = () => {
        entryScreen.style.transition = 'opacity 0.4s ease';
        entryScreen.style.opacity = '0';
        
        setTimeout(async () => {
            entryScreen.style.display = 'none';
            contentArea.style.display = 'block';

            if (user) {
                // --- UTENTE LOGGATO: CONTROLLO APPARTENENZA SERVER ---
                const hasJoinedServer = localStorage.getItem('taverna_member_verified');

                if (hasJoinedServer === 'true') {
                    // UTENTE VERIFICATO: Mostra Navbar + Dashboard
                    contentArea.innerHTML = `
                        <div id="nav-container"></div>
                        <main id="main-content"></main>
                    `;
                    
                    const navDiv = document.getElementById('nav-container');
                    const mainDiv = document.getElementById('main-content');

                    // Inizializza Navbar con funzione di logout
                    initNavbar(navDiv, user, async () => {
                        await supabase.auth.signOut();
                        localStorage.removeItem('taverna_member_verified');
                        window.location.reload();
                    });

                    // Carica la Dashboard
                    showDashboard(mainDiv, user);

                } else {
                    // UTENTE LOGGATO MA NON VERIFICATO: Obbligo Discord Server
                    contentArea.innerHTML = `
                        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; padding: 20px; background: #05020a;">
                            <h2 style="color: #5865F2; font-weight: 900; letter-spacing: -1px;">QUASI CI SEI! ⚔️</h2>
                            <p style="max-width:320px; margin: 20px 0; opacity: 0.7; line-height: 1.5; font-size: 14px;">
                                Per sbloccare il portale e iniziare la tua cronaca devi unirti al nostro Server Discord ufficiale.
                            </p>
                            
                            <a href="${SERVER_INVITE}" target="_blank" id="join-link" style="background: #5865F2; color: white; padding: 18px 40px; border-radius: 14px; text-decoration: none; font-weight: 800; display: inline-block; transition: 0.3s; box-shadow: 0 10px 20px rgba(88, 101, 242, 0.3);">
                                UNISCITI AL SERVER
                            </a>
                            
                            <button id="verify-btn" style="margin-top: 30px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px;">
                                SONO GIÀ DENTRO, FAMMI ENTRARE
                            </button>
                        </div>
                    `;

                    document.getElementById('verify-btn').onclick = () => {
                        localStorage.setItem('taverna_member_verified', 'true');
                        window.location.reload();
                    };
                }
            } else {
                // --- UTENTE NON LOGGATO: Mostra Schermata Login/Discord ---
                initLogin(contentArea);
            }
        }, 400);
    };
}

// Avvio del rito d'apertura
document.addEventListener('DOMContentLoaded', initApp);