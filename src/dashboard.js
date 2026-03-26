import { supabase, SUPABASE_CONFIG } from './services/supabase.js';
import { initNavbar } from './components/layout/Navbar.js';

const { tables } = SUPABASE_CONFIG;

export async function showDashboard(container, user = null) {
    // 1. Verifica Utente (se non passato, lo recupera da Supabase)
    if (!user) {
        const { data: { user: sbUser } } = await supabase.auth.getUser();
        if (!sbUser) { 
            window.location.reload(); 
            return; 
        }
        user = sbUser;
    }

    const userName = user.user_metadata?.full_name || user.email.split('@')[0];
    const uiContainer = document.getElementById('ui') || container;

    // 2. Setup Layout Base (Navbar superiore + Contenuto centrale + Bottone Floating)
    uiContainer.innerHTML = `
        <div id="nav-container"></div>
        
        <main class="dashboard-content">
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

        <button class="btn-primary floating-btn" id="createNewSession">✨ NUOVA CRONACA</button>
    `;

    // 3. Inizializzazione Navbar
    const navContainer = document.getElementById('nav-container');
    if (navContainer) {
        initNavbar(navContainer, user, async () => {
            await supabase.auth.signOut();
            localStorage.removeItem('taverna_member_verified');
            window.location.reload();
        });
    }

    const sessionList = document.getElementById('session-list');

    // 4. Caricamento Sessioni dal DB
    async function loadSessions() {
        try {
            const { data, error } = await supabase
                .from(tables.maps)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                sessionList.innerHTML = `
                    <div style="text-align:center; opacity:0.3; padding:50px; border:1px dashed var(--glass-border); border-radius:16px;">
                        <p style="font-size:12px;">Nessuna cronaca attiva.<br>Inizia la tua avventura!</p>
                    </div>
                `;
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

            // Evento Click su ogni sessione (Import dinamico)
            uiContainer.querySelectorAll('.session-card').forEach(card => {
                card.onclick = async () => {
                    const sId = card.dataset.id;
                    const { showSession } = await import('./components/features/tabletop/Session.js');
                    showSession(uiContainer, sId);
                };
            });

        } catch (err) {
            console.error("Errore sessioni:", err);
            sessionList.innerHTML = `<p style="color:red; text-align:center; font-size:12px;">Errore nel recupero delle cronache.</p>`;
        }
    }

    loadSessions();

    // 5. Logica Nuova Sessione
    document.getElementById('createNewSession').onclick = async () => {
        const name = prompt("Nome della nuova Cronaca:");
        if (!name || name.trim() === "") return;

        // Genera un ID pulito (o usa crypto.randomUUID() se preferisci)
        const sId = Math.random().toString(36).substring(2, 10);
        
        try {
            const { error } = await supabase.from(tables.maps).insert([
                { 
                    session_id: sId, 
                    name: name, 
                    created_by: user.id 
                }
            ]);

            if (error) throw error;
            
            // Invece di ricaricare la lista, entriamo direttamente nel tavolo
            const { showSession } = await import('./components/features/tabletop/Session.js');
            showSession(uiContainer, sId);

        } catch (err) {
            alert("Errore nella creazione: " + err.message);
        }
    };
}