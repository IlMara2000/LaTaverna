import { supabase, SUPABASE_CONFIG } from './services/supabase.js';
import { showCharacters } from './features/characters/CharList.js';
import { showAssets } from './features/zaino/Assets.js';
import { showSession } from './features/tabletop/Session.js';
import { initSidebar } from './components/layout/Sidebar.js';

const { tables } = SUPABASE_CONFIG;

export async function showDashboard(container, user = null) {
    // --- 1. VERIFICA UTENTE ---
    if (!user) { 
        const { data: { user: sbUser }, error } = await supabase.auth.getUser();
        if (error || !sbUser) {
            window.location.reload();
            return;
        }
        user = sbUser;
    }

    const userName = user.user_metadata?.full_name || user.email.split('@')[0];
    let sessions = [];

    // --- 2. CARICAMENTO SESSIONI DAL DB ---
    try {
        const { data, error } = await supabase
            .from(tables.maps)
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        sessions = data || [];
    } catch (err) { 
        console.error("Errore caricamento sessioni:", err); 
    }

    // --- 3. RENDER UI PRINCIPALE ---
    container.innerHTML = `
        <div id="dashboard-wrapper">
            <div id="sidebar-container"></div>

            <main class="dashboard-content" id="main-content">
                <div style="max-width: 600px; margin: 0 auto; padding-bottom: 100px;">
                    
                    <header style="margin-bottom: 40px; margin-top: 20px;">
                        <h1 style="font-size: 2.2rem; font-weight: 900; letter-spacing: -1px;">BENTORNATO,<br>
                        <span style="color: var(--amethyst-bright); text-transform: uppercase;">${userName}</span></h1>
                        <p style="opacity: 0.5; font-size: 12px; margin-top: 10px; letter-spacing: 1px;">LE TUE CRONACHE ATTIVE</p>
                    </header>

                    <div id="session-list" style="display: flex; flex-direction: column; gap: 15px;">
                        ${sessions.map(s => `
                            <div class="glass-box session-card" data-id="${s.session_id}" style="cursor:pointer; transition: 0.3s; display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h3 style="margin:0; font-size: 1.1rem;">${s.name}</h3>
                                    <p style="margin:5px 0 0 0; font-size: 10px; opacity:0.4; text-transform:uppercase;">ID: ${s.session_id.slice(0,8)}...</p>
                                </div>
                                <span style="color: var(--amethyst-bright); font-size: 20px;">➔</span>
                            </div>
                        `).join('')}

                        <button class="btn-primary" id="createNew" style="margin-top: 20px; width: 100%;">
                            ✨ NUOVA CRONACA
                        </button>
                    </div>

                </div>
            </main>
        </div>

        <div id="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(10px); z-index:1000; align-items:center; justify-content:center; padding:20px;">
            <div class="glass-box" id="modal-content" style="width:100%; max-width:400px; text-align:center;">
                </div>
        </div>
    `;

    // --- 4. INIZIALIZZAZIONE SIDEBAR ---
    const sidebarContainer = container.querySelector('#sidebar-container');
    initSidebar(sidebarContainer, user, () => {
        supabase.auth.signOut().then(() => window.location.reload());
    });

    // --- 5. EVENTI ---
    
    // Click sulle sessioni esistenti
    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => {
            const sid = card.getAttribute('data-id');
            showSession(container, sid);
        };
    });

    // Creazione Nuova Sessione
    const overlay = container.querySelector('#modal-overlay');
    const modalBody = container.querySelector('#modal-content');

    container.querySelector('#createNew').onclick = () => {
        overlay.style.display = 'flex';
        modalBody.innerHTML = `
            <h2 style="margin-bottom:20px;">Nuovo Tavolo</h2>
            <input type="text" id="newSessName" placeholder="Nome dell'avventura..." class="auth-input" style="margin-bottom:20px; width:100%; border-radius:12px;">
            <button class="btn-primary" id="confCreate" style="width:100%; padding:15px;">Inizia Avventura</button>
            <button class="sidebar-btn" id="cancelCreate" style="margin-top:10px; width:100%; border:none; background:transparent; justify-content:center; opacity:0.6;">ANNULLA</button>
        `;

        modalBody.querySelector('#cancelCreate').onclick = () => overlay.style.display = 'none';
        
        modalBody.querySelector('#confCreate').onclick = async () => {
            const name = modalBody.querySelector('#newSessName').value.trim();
            if(!name) return alert("Dai un nome al tuo tavolo!");

            const sessionId = crypto.randomUUID(); 

            try {
                const { error } = await supabase
                    .from(tables.maps)
                    .insert([{
                        name: name,
                        session_id: sessionId
                    }]);

                if (error) throw error;

                overlay.style.display = 'none';
                showSession(container, sessionId);

            } catch (err) {
                alert("Errore creazione sessione: " + err.message);
            }
        };
    };
}