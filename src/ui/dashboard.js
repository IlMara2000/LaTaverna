import { account, databases, storage } from '../services/appwrite.js';
import { showSession } from './session.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_SESSIONS = 'tokens'; 
const BUCKET_ASSETS = 'assets_bucket'; 

/**
 * Funzione principale per caricare e mostrare la Dashboard
 */
export async function showDashboard(container, user = null) {
  if (!user) {
    try { 
        user = await account.get(); 
    } catch (err) { 
        const { showLogin } = await import('./login.js');
        showLogin(container); 
        return; 
    }
  }

  let sessions = [];
  let allFiles = []; 

  try {
    // Recupero sessioni
    const res = await databases.listDocuments(DB_ID, COL_SESSIONS);
    sessions = res.documents;
    
    // Recupero file nello zaino (Assets)
    try {
        const fileRes = await storage.listFiles(BUCKET_ASSETS);
        allFiles = fileRes.files;
    } catch (e) { 
        console.warn("Storage non ancora configurato o vuoto."); 
    }
  } catch (err) { 
      console.error("Errore nel recupero dati Dashboard:", err); 
  }

  renderDashboard(container, user, sessions);
  attachDashboardEvents(container, user, sessions, allFiles);
}

/**
 * Rendering dell'interfaccia HTML
 */
function renderDashboard(container, user, sessions) {
  container.innerHTML = `
    <button class="hamburger" id="hamburger">☰</button>
    
    <nav class="sidebar glass-box" id="sidebar">
        <h2 style="color:var(--accent); margin-bottom:30px; letter-spacing:2px; font-weight:900;">TAVERNA</h2>
        <button class="sidebar-btn" id="btnNewSession">✨ NUOVA SESSIONE</button>
        <button class="sidebar-btn" id="btnAssets">🎒 LO ZAINO</button>
        <button class="sidebar-btn" id="btnCharacters">🎭 PERSONAGGI</button>
        <div style="flex-grow:1;"></div>
        <button class="sidebar-btn" id="btnLogout" style="background:rgba(255,68,68,0.2); color:#ff4444; border:1px solid #ff4444;">ESCI</button>
    </nav>

    <div class="dashboard-content">
        <header style="margin-bottom:30px; padding:0 10px;">
            <h1 style="font-size:1.8rem; font-weight:900;">Bentornato,</h1>
            <p style="color:var(--accent); font-weight:700; text-transform:uppercase; letter-spacing:1px;">${user.name}</p>
        </header>

        <section id="sessions-list">
            <h3 style="margin-bottom:20px; font-size:0.9rem; opacity:0.6; letter-spacing:2px; padding:0 10px;">SESSIONI ATTIVE</h3>
            <div class="sessions-grid" style="display:grid; gap:20px; padding:0 10px;">
                ${sessions.length === 0 ? `
                    <div class="glass-box" style="text-align:center; padding:40px;">
                        <p style="opacity:0.5;">Nessuna avventura iniziata...</p>
                    </div>
                ` : sessions.map(s => `
                    <div class="session-card glass-box" data-sid="${s.session_id}" style="cursor:pointer;">
                        <div class="map-preview" style="background-image:url('${s.map_url || ''}'); background-color:#1a0b2e;"></div>
                        <div style="padding:15px;">
                            <h4 style="font-weight:800; margin-bottom:5px;">${s.name}</h4>
                            <p style="font-size:12px; opacity:0.6;">ID: ${s.session_id}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    </div>

    <div id="overlay" class="overlay">
        <div class="glass-box" id="overlay-content"></div>
    </div>
  `;
}

/**
 * Gestione degli eventi (Click, Sidebar, Logout)
 */
function attachDashboardEvents(container, user, sessions, allFiles) {
    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');
    const overlay = container.querySelector('#overlay');
    const content = container.querySelector('#overlay-content');

    const closeOverlay = () => { overlay.style.display = 'none'; };

    // Toggle Sidebar
    hamburger.onclick = () => sidebar.classList.toggle('active');

    // Chiusura sidebar al click esterno (fondamentale su Mobile)
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && e.target !== hamburger && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    });

    // Creazione Nuova Sessione
    container.querySelector('#btnNewSession').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3 style="margin-bottom:20px; text-align:center;">✨ NUOVA AVVENTURA</h3>
            <input type="text" id="newSessionName" placeholder="Nome della sessione..." />
            <button class="btn-primary" id="confirmCreate" style="margin-top:20px;">CREA TAVOLO</button>
            <button class="sidebar-btn" id="cancelCreate" style="margin-top:10px; text-align:center; background:transparent;">ANNULLA</button>
        `;

        container.querySelector('#confirmCreate').onclick = async () => {
            const nameValue = container.querySelector('#newSessionName').value.trim() || "Nuova Sessione";
            const sid = "TAVOLO-" + Math.floor(1000 + Math.random() * 9000);
            try {
                await databases.createDocument(DB_ID, COL_SESSIONS, 'unique()', {
                    name: nameValue,
                    session_id: sid,
                    user_id: user.$id
                });
                window.location.reload();
            } catch (err) { alert("Errore: " + err.message); }
        };
        container.querySelector('#cancelCreate').onclick = closeOverlay;
    };

    // Apertura Sessione
    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => showSession(container, card.dataset.sid);
    });

    // Logout
    container.querySelector('#btnLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };
}
