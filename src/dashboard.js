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

    const userName = user.user_metadata?.full_name || user.email.split('@')[0];
    const uiContainer = document.getElementById('ui') || container;

    uiContainer.innerHTML = `
        <div id="nav-container"></div>
        <div id="sidebar-container"></div>
        
        <main class="dashboard-content" id="main-content">
            <div class="dashboard-container">
                <header class="dashboard-header">
                    <h1>Bentornato,<br>
                    <span style="color:var(--amethyst-bright); text-transform:uppercase;">${userName}</span></h1>
                    <p class="subtitle">Le tue cronache attive</p>
                </header>

                <div id="session-list" class="session-list">
                    <p style="text-align:center; opacity:0.5; padding:20px;">Consultando i registri...📜</p>
                </div>
            </div>
        </main>
    `;

    // 3. Inizializzazione Componenti di Navigazione
    initNavbar(document.getElementById('nav-container'));
    initSidebar(document.getElementById('sidebar-container'), user, async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('taverna_member_verified');
        window.location.reload();
    });

    // 4. Caricamento Sessioni
    const sessionList = document.getElementById('session-list');
    async function loadSessions() {
        try {
            const { data, error } = await supabase
                .from(tables.maps)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!data || data.length === 0) {
                sessionList.innerHTML = `<p style="text-align:center; opacity:0.3; padding:50px;">Nessuna cronaca attiva.</p>`;
                return;
            }

            sessionList.innerHTML = data.map(s => `
                <div class="session-card" data-id="${s.session_id}">
                    <div>
                        <h3>${s.name}</h3>
                        <p>ID: ${s.session_id.slice(0, 8)}...</p>
                    </div>
                    <span class="arrow">➔</span>
                </div>
            `).join('');

            uiContainer.querySelectorAll('.session-card').forEach(card => {
                card.onclick = async () => {
                    const sId = card.dataset.id;
                    const { showSession } = await import('./components/features/tabletop/Session.js');
                    showSession(uiContainer, sId);
                };
            });
        } catch (err) { console.error(err); }
    }
    loadSessions();
}