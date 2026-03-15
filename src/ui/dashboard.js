import { account, databases, storage } from '../services/appwrite.js';
import { showSession } from './session.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_SESSIONS = 'tokens'; 
const BUCKET_ASSETS = 'assets_bucket'; 

/**
 * Funzione principale Dashboard
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

  try {
    // Recupero sessioni esistenti
    const res = await databases.listDocuments(DB_ID, COL_SESSIONS);
    sessions = res.documents;
  } catch (err) { 
      console.error("Errore recupero sessioni:", err); 
  }

  renderDashboard(container, user, sessions);
  attachDashboardEvents(container, user, sessions);
}

/**
 * Rendering Grafico
 */
function renderDashboard(container, user, sessions) {
  container.innerHTML = `
    <button class="hamburger" id="hamburger">☰</button>
    
    <nav class="sidebar glass-box" id="sidebar">
        <h2 style="color:var(--accent); margin-bottom:30px; letter-spacing:2px; font-weight:900; text-align:center;">TAVERNA</h2>
        <button class="sidebar-btn" id="btnNewSession">✨ NUOVA SESSIONE</button>
        <button class="sidebar-btn" id="btnCharacters">🎭 PERSONAGGI</button>
        <button class="sidebar-btn" id="btnAssets">🎒 LO ZAINO</button>
        <div style="flex-grow:1;"></div>
        <button class="sidebar-btn" id="btnLogout" style="background:rgba(255,68,68,0.2); color:#ff4444; border:1px solid #ff4444;">ESCI</button>
    </nav>

    <div class="dashboard-content">
        <header style="margin-bottom:35px; padding:0 15px;">
            <h1 style="font-size:1.6rem; font-weight:900; opacity:0.9;">Bentornato,</h1>
            <p style="color:var(--accent); font-weight:800; text-transform:uppercase; letter-spacing:2px; font-size:1.2rem;">${user.name}</p>
        </header>

        <section id="sessions-list">
            <h3 style="margin-bottom:20px; font-size:0.8rem; opacity:0.5; letter-spacing:3px; padding:0 15px; text-transform:uppercase;">Le tue avventure</h3>
            <div class="sessions-grid" style="display:grid; gap:20px; padding:0 15px;">
                ${sessions.length === 0 ? `
                    <div class="glass-box" style="text-align:center; padding:50px 20px; border-style: dashed;">
                        <p style="opacity:0.6; font-style:italic;">Il tavolo è vuoto... Inizia una nuova saga!</p>
                    </div>
                ` : sessions.map(s => `
                    <div class="session-card glass-box" data-sid="${s.session_id}" style="cursor:pointer;">
                        <div class="map-preview" style="background-image:url('${s.map_url || ''}'); background-color:#1a0b2e; height:100px;"></div>
                        <div style="padding:15px;">
                            <h4 style="font-weight:800; text-transform:uppercase; margin-bottom:4px;">${s.name}</h4>
                            <p style="font-size:10px; opacity:0.5; letter-spacing:1px;">ID: ${s.session_id}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    </div>

    <div id="overlay" class="overlay">
        <div class="glass-box" id="overlay-content" style="max-width:350px;"></div>
    </div>
  `;
}

/**
 * Gestione Eventi e Navigazione
 */
function attachDashboardEvents(container, user, sessions) {
    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');
    const overlay = container.querySelector('#overlay');
    const content = container.querySelector('#overlay-content');

    const closeOverlay = () => { overlay.style.display = 'none'; };

    // Toggle Sidebar
    hamburger.onclick = () => sidebar.classList.toggle('active');

    // Chiudi sidebar cliccando fuori (Mobile fix)
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== hamburger) {
            sidebar.classList.remove('active');
        }
    });

    // --- NAVIGAZIONE: PERSONAGGI ---
    container.querySelector('#btnCharacters').onclick = async () => {
        sidebar.classList.remove('active');
        // Import dinamico del file che abbiamo creato prima
        const { showCharacters } = await import('./characters.js');
        showCharacters(container);
    };

    // --- NAVIGAZIONE: NUOVA SESSIONE ---
    container.querySelector('#btnNewSession').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3 style="margin-bottom:20px; text-align:center; letter-spacing:1px;">✨ NUOVO TAVOLO</h3>
            <input type="text" id="newSessionName" placeholder="Nome dell'avventura..." style="margin-bottom:15px;" />
            <button class="btn-primary" id="confirmCreate">INIZIA</button>
            <button class="sidebar-btn" id="cancelCreate" style="background:transparent; text-align:center; margin-top:10px;">ANNULLA</button>
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

    // --- APERTURA SESSIONE ---
    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => showSession(container, card.dataset.sid);
    });

    // --- LOGOUT ---
    container.querySelector('#btnLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };

    // --- LO ZAINO (Placeholder per ora) ---
    container.querySelector('#btnAssets').onclick = () => {
        alert("Lo Zaino degli Assets sarà disponibile a breve!");
        sidebar.classList.remove('active');
    };
}
