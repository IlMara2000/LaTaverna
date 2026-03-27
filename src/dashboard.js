import { supabase, SUPABASE_CONFIG } from './services/supabase.js';
import { initNavbar } from './components/layout/Navbar.js';
import { initSidebar } from './components/layout/Sidebar.js';

const { tables } = SUPABASE_CONFIG;

export async function showDashboard(container, user = null) {
    if (!user) {
        const { data: { user: sbUser } } = await supabase.auth.getUser();
        if (!sbUser) { window.location.reload(); return; }
        user = sbUser;
    }

    // 1. LOGICA DI VERIFICA AUTOMATICA DISCORD
    const isDiscordUser = user.app_metadata.provider === 'discord';
    let isVerified = localStorage.getItem('taverna_member_verified') === 'true';

    if (isDiscordUser && !isVerified) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.provider_token;

        if (token) {
            try {
                const res = await fetch('https://discord.com/api/users/@me/guilds', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const guilds = await res.json();
                
                // --- INSERISCI QUI L'ID DEL TUO SERVER DISCORD ---
                const MY_DISCORD_SERVER_ID = '123456789012345678'; 
                
                const found = guilds.some(g => g.id === MY_DISCORD_SERVER_ID);
                if (found) {
                    localStorage.setItem('taverna_member_verified', 'true');
                    isVerified = true;
                }
            } catch (e) { console.error("Discord Auth Error:", e); }
        }
    }

    // 2. SOVRASCRITTURA DATI (Usa Discord se presente, altrimenti dati Supabase)
    const displayAvatar = user.user_metadata?.avatar_url || '';
    const userName = user.user_metadata?.full_name || user.user_metadata?.custom_claims?.global_name || user.email.split('@')[0];

    const uiContainer = document.getElementById('ui') || container;

    // 3. RENDER UI
    uiContainer.innerHTML = `
        <div id="nav-container"></div>
        <div id="sidebar-container"></div>
        
        <main class="dashboard-content" id="main-content">
            <div class="dashboard-container">
                <header class="dashboard-header">
                    <div style="display:flex; align-items:center; gap:15px; margin-bottom:10px;">
                        ${displayAvatar ? `<img src="${displayAvatar}" style="width:50px; border-radius:50%; border:2px solid var(--amethyst);">` : ''}
                        <h1>Bentornato,<br>
                        <span style="color:var(--amethyst-bright); text-transform:uppercase;">${userName}</span></h1>
                    </div>
                    <p class="subtitle">${isVerified ? '🛡️ MEMBRO DELLA TAVERNA' : '📜 LE TUE CRONACHE'}</p>
                </header>

                <div id="session-list" class="session-list">
                    <p style="text-align:center; opacity:0.5; padding:20px;">Consultando i registri...📜</p>
                </div>
            </div>
        </main>
    `;

    // 4. INIZIALIZZAZIONE NAVBAR E SIDEBAR
    initNavbar(document.getElementById('nav-container'));
    initSidebar(document.getElementById('sidebar-container'), user, async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('taverna_member_verified');
        window.location.reload();
    });

    // 5. CARICAMENTO SESSIONI (Invariato)
    loadSessions();
}

async function loadSessions() {
    const sessionList = document.getElementById('session-list');
    const { data, error } = await supabase.from(tables.maps).select('*').order('created_at', { ascending: false });
    
    if (error || !data || data.length === 0) {
        sessionList.innerHTML = `<p style="text-align:center; opacity:0.3; padding:50px;">Nessuna cronaca attiva.</p>`;
        return;
    }

    sessionList.innerHTML = data.map(s => `
        <div class="session-card" data-id="${s.session_id}">
            <div><h3>${s.name}</h3><p>ID: ${s.session_id.slice(0, 8)}...</p></div>
            <span class="arrow">➔</span>
        </div>
    `).join('');

    document.querySelectorAll('.session-card').forEach(card => {
        card.onclick = async () => {
            const { showSession } = await import('./components/features/tabletop/Session.js');
            showSession(document.getElementById('ui'), card.dataset.id);
        };
    });
}