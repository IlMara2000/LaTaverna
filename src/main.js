import './styles/global.css'; 
import { supabase } from './services/supabase.js';
import { initLogin } from './components/features/auth/Login.js';
import { initNavbar } from './components/layout/Navbar.js';
import { showLobby } from './lobby.js';
import { shouldShowPortalButton, updateLastAccess } from './components/ui/AuthInput.js';

// Importiamo la funzione per gestire il ritorno da Discord! (Fondamentale)
import { setupDiscordRedirect } from './components/features/auth/Discord.js';

const uiContainer = document.getElementById('ui');
const SERVER_INVITE = "https://discord.gg/9BqNgdqC";

async function initApp() {
    if (!uiContainer) return;

    const loader = document.getElementById('app-loader');
    
    // Funzione blindata per distruggere il loader fisicamente
    const destroyLoader = () => { 
        if (loader) {
            loader.style.opacity = '0';
            loader.style.visibility = 'hidden';
            setTimeout(() => {
                loader.remove(); // Lo elimina dal DOM così non blocca i tocchi
            }, 500);
        }
    };

    try {
        // 1. Gestisci PRIMA DI TUTTO l'eventuale ritorno da Discord
        // Se c'è un redirect in corso, mostrerà l'overlay "Sincro Discord" creato prima
        if (typeof setupDiscordRedirect === 'function') {
            await setupDiscordRedirect(uiContainer);
        }

        // 2. Recupera sessione Discord e sessione Guest
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) console.warn("Avviso Supabase:", error.message); // Non blocca l'app se fallisce

        const guestUser = JSON.parse(localStorage.getItem('taverna_guest_user'));
        
        // 3. LOGICA DI REDIRECT
        const isVerifiedDiscord = user && localStorage.getItem('taverna_member_verified') === 'true';
        
        if ((isVerifiedDiscord && !shouldShowPortalButton()) || guestUser) {
            renderDashboard(user || guestUser);
        } else {
            // Altrimenti mostra il Portale d'ingresso
            renderPortal(user);
        }

    } catch (err) {
        console.error("Errore critico di avvio:", err);
        // Fallback di sicurezza: se esplode tutto, mostra almeno il portale
        renderPortal(null);
    } finally {
        // GRAZIE AL FINALLY, IL LOADER VERRÀ RIMOSSO SEMPRE E COMUNQUE.
        destroyLoader();
    }
}

function renderPortal(user) {
    const appContainer = document.getElementById('app');
    
    appContainer.innerHTML = `
        <div class="entry-container" id="entry-screen" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100dvh; cursor: pointer; animation: fadeInUp 0.8s ease-out forwards;">
            <img src="/assets/logo.png" alt="La Taverna" id="main-logo" style="width: 140px; filter: drop-shadow(0 0 20px var(--amethyst-glow)); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <p class="subtitle" style="margin-top: 35px; opacity: 0.5; font-size: 11px; letter-spacing: 4px; text-transform: uppercase; font-family: 'Montserrat', sans-serif; font-weight: 800;">Tocca per Entrare</p>
        </div>
    `;

    const entryScreen = document.getElementById('entry-screen');
    const logo = document.getElementById('main-logo');

    entryScreen.onclick = () => {
        // Effetto "Click" sul logo
        logo.style.transform = 'scale(1.1) translateY(-10px)';
        entryScreen.style.opacity = '0';
        entryScreen.style.transition = 'opacity 0.4s ease';
        
        setTimeout(() => {
            if (user) {
                checkAccess(user, appContainer);
            } else {
                initLogin(appContainer);
            }
        }, 400);
    };
}

function checkAccess(user, container) {
    const isVerified = localStorage.getItem('taverna_member_verified') === 'true';
    if (isVerified) {
        updateLastAccess();
        renderDashboard(user);
    } else {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100dvh; text-align: center; padding: 30px; animation: fadeInUp 0.5s ease-out;">
                <h2 class="main-title" style="font-size: 2.2rem; margin-bottom: 5px;">QUASI CI SEI! ⚔️</h2>
                <p style="opacity: 0.6; font-size: 13px; margin-bottom: 40px; letter-spacing: 1px; line-height: 1.6;">
                    Unisciti al Server Discord per sbloccare l'accesso completo alla Taverna.
                </p>
                
                <a href="${SERVER_INVITE}" target="_blank" class="game-card" style="background: #5865F2; border: none; padding: 20px 40px; text-decoration: none; width: 100%; max-width: 300px; margin-bottom: 20px; box-shadow: 0 10px 25px rgba(88, 101, 242, 0.3);">
                    <span style="color: white; font-weight: 900; font-size: 1.1rem; font-family: 'Montserrat', sans-serif;">UNISCITI ORA</span>
                </a>
                
                <button id="verify-btn" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 15px 30px; border-radius: 16px; cursor:pointer; font-size: 11px; font-weight: 800; letter-spacing: 2px; transition: 0.3s;">
                    SONO GIÀ DENTRO
                </button>
            </div>
        `;
        
        document.getElementById('verify-btn').onclick = (e) => {
            e.target.style.background = 'var(--amethyst-bright)';
            e.target.style.borderColor = 'var(--amethyst-bright)';
            setTimeout(() => {
                localStorage.setItem('taverna_member_verified', 'true');
                window.location.reload();
            }, 300);
        };
    }
}

function renderDashboard(user) {
    const appContainer = document.getElementById('app');
    
    // 1. Inizializza la Navbar (Gestirà anche la Sidebar)
    initNavbar(user, async () => {
        const isGuest = user?.isGuest || localStorage.getItem('taverna_guest_user');
        if (isGuest) {
            localStorage.removeItem('taverna_guest_user');
        } else {
            await supabase.auth.signOut();
            localStorage.removeItem('taverna_member_verified');
        }
        window.location.reload();
    });

    // 2. Mostra la Lobby principale
    showLobby(appContainer);
}

// Lancia l'app in modo sicuro appena il DOM è pronto
document.addEventListener('DOMContentLoaded', initApp);
