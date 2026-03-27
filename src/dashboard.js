import { supabase } from './services/supabase.js';
import { initNavbar } from './components/layout/Navbar.js';
import { initSidebar, updateSidebarContext } from './components/layout/Sidebar.js';

export async function showDashboard(container, user = null) {
    if (!user) {
        const { data: { user: sbUser } } = await supabase.auth.getUser();
        user = sbUser;
    }

    // --- VERIFICA DISCORD ---
    let isVerified = localStorage.getItem('taverna_member_verified') === 'true';
    if (user.app_metadata.provider === 'discord' && !isVerified) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.provider_token;
        if (token) {
            try {
                const res = await fetch('https://discord.com/api/users/@me/guilds', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const guilds = await res.json();
                const MY_SERVER_ID = '123456789012345678'; // <-- Sostituisci con il tuo ID
                if (guilds.some(g => g.id === MY_SERVER_ID)) {
                    localStorage.setItem('taverna_member_verified', 'true');
                    isVerified = true;
                }
            } catch (e) { console.error("Discord Error:", e); }
        }
    }

    const userName = user.user_metadata?.full_name || user.email.split('@')[0];
    const uiContainer = document.getElementById('ui') || container;

    // RENDER LAYOUT BASE
    uiContainer.innerHTML = `
        <div id="nav-container"></div>
        <div id="sidebar-container"></div>
        <main id="main-content" class="fade-in" style="padding: 20px; padding-bottom: 100px;"></main>
    `;

    // Inizializza componenti globali
    initNavbar(document.getElementById('nav-container'));
    initSidebar(document.getElementById('sidebar-container'), user, () => {
        supabase.auth.signOut().then(() => window.location.reload());
    }, "home");

    // Mostra la selezione del gioco
    renderGameSelector();
}

function renderGameSelector() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <header style="text-align:center; margin: 40px 0;">
            <h1 style="font-size: 2.5rem; letter-spacing: -1px;">Scegli il tuo <span style="color:var(--amethyst-bright);">Destino</span></h1>
            <p style="opacity:0.6;">Seleziona un sistema di gioco per accedere ai tuoi registri</p>
        </header>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; max-width: 1200px; margin: 0 auto;">
            
            <div class="game-card" data-system="dnd5e" style="
                background: linear-gradient(to top, rgba(5,2,10,1), rgba(5,2,10,0.2)), url('https://images.unsplash.com/photo-1519074063261-bb8207ce2433?auto=format&fit=crop&q=80&w=800');
                background-size: cover; height: 400px; border-radius: 24px; border: 1px solid rgba(157, 78, 221, 0.3);
                cursor: pointer; display: flex; flex-direction: column; justify-content: flex-end; padding: 30px; transition: 0.4s;
            ">
                <h2 style="margin:0; font-weight: 900; font-size: 2rem;">D&D 5E</h2>
                <p style="opacity:0.8; font-size: 14px; margin: 10px 0 20px 0;">Il Re dei Giochi di Ruolo. Crea eroi, lancia dadi, scrivi la storia.</p>
                <button class="btn-primary" style="width: fit-content; height: 45px; padding: 0 25px;">APRI GRIMORIO</button>
            </div>

            <div style="background: rgba(255,255,255,0.03); border: 2px dashed rgba(255,255,255,0.1); height: 400px; border-radius: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0.5;">
                <span style="font-size: 3rem; margin-bottom: 10px;">🎲</span>
                <p style="letter-spacing: 2px; font-size: 12px;">PROSSIMAMENTE</p>
            </div>
        </div>
    `;

    // Eventi sulle card
    mainContent.querySelectorAll('.game-card').forEach(card => {
        card.onclick = () => {
            const system = card.dataset.system;
            enterSystem(system);
        };
    });
}

function enterSystem(system) {
    const mainContent = document.getElementById('main-content');
    
    // 1. Aggiorna la Sidebar con i comandi del gioco scelto
    updateSidebarContext(system);

    // 2. Carica l'interfaccia specifica (Esempio D&D)
    mainContent.innerHTML = `
        <div class="fade-in">
            <button onclick="window.location.reload()" style="background:none; border:none; color:var(--amethyst-bright); cursor:pointer; margin-bottom: 20px;">← Torna alla Libreria</button>
            <h1 style="text-transform: uppercase;">Dashboard ${system}</h1>
            <div id="game-workspace" style="background: rgba(255,255,255,0.05); border-radius: 20px; padding: 40px; text-align: center; border: 1px solid var(--amethyst-glow);">
                <p>Caricamento sessioni di gioco in corso...</p>
            </div>
        </div>
    `;
}
