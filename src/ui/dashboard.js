import { account, databases, storage } from '../services/appwrite.js';
import { showSession } from './session.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_SESSIONS = 'tokens'; 
const BUCKET_ASSETS = 'vtt_assets'; 

/**
 * Inizializzazione Dashboard: Recupera i dati e renderizza l'interfaccia
 */
export async function showDashboard(container, user = null) {
  // Controllo sessione utente se non passato
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
    // Recupero delle sessioni dal database
    const res = await databases.listDocuments(DB_ID, COL_SESSIONS);
    sessions = res.documents;
  } catch (err) { 
      console.error("Errore nel recupero delle sessioni:", err); 
  }

  // 1. Renderizziamo la struttura HTML
  renderDashboard(container, user, sessions);
  
  // 2. Colleghiamo tutti gli eventi (Sidebar, Bottoni, Click)
  attachDashboardEvents(container, user, sessions);
}

/**
 * Renderizza l'HTML della Dashboard
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
                    <div class="glass-box" style="text-align:center; padding:50px 20px; border: 1px dashed rgba(169, 83, 236, 0.4);">
                        <p style="opacity:0.6; font-style:italic;">Nessuna saga iniziata... Crea il tuo primo tavolo!</p>
                    </div>
                ` : sessions.map(s => `
                    <div class="session-card glass-box" data-sid="${s.session_id}" style="cursor:pointer;">
                        <div class="map-preview" style="background-image:url('${s.map_url || ''}'); background-color:#1a0b2e; height:100px;"></div>
                        <div style="padding:15px;">
                            <h4 style="font-weight:800; text-transform:uppercase; margin-bottom:4px; font-size:14px;">${s.name}</h4>
                            <p style="font-size:10px; opacity:0.5; letter-spacing:1px;">ID: ${s.session_id}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    </div>

    <div id="overlay" class="overlay">
        <div class="glass-box" id="overlay-content" style="max-width:380px; width:90%;"></div>
    </div>
  `;
}

/**
 * Gestione degli eventi interattivi
 */
function attachDashboardEvents(container, user, sessions) {
    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');
    const overlay = container.querySelector('#overlay');
    const content = container.querySelector('#overlay-content');

    const closeOverlay = () => { overlay.style.display = 'none'; };

    // --- SIDEBAR LOGIC ---
    hamburger.onclick = () => sidebar.classList.toggle('active');

    // Chiusura sidebar cliccando fuori (fondamentale per Safari/iOS)
    document.addEventListener('pointerdown', (e) => {
        if (sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== hamburger) {
            sidebar.classList.remove('active');
        }
    });

    // --- NAVIGAZIONE: PERSONAGGI ---
    container.querySelector('#btnCharacters').onclick = async () => {
        sidebar.classList.remove('active');
        const { showCharacters } = await import('./characters.js');
        showCharacters(container);
    };

    // --- NAVIGAZIONE: LO ZAINO (ASSETS) ---
    container.querySelector('#btnAssets').onclick = async () => {
        sidebar.classList.remove('active');
        const { showAssets } = await import('./assets.js');
        showAssets(container);
    };

    // --- NAVIGAZIONE: NUOVA SESSIONE ---
    container.querySelector('#btnNewSession').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3 style="margin-bottom:20px; text-align:center; letter-spacing:1px; font-weight:900;">✨ NUOVO TAVOLO</h3>
            <div class="form-group">
                <input type="text" id="newSessionName" placeholder="Nome dell'avventura..." style="width:100%;" />
            </div>
            <button class="btn-primary" id="confirmCreate" style="margin-top:15px;">INIZIA LA SAGA</button>
            <button class="sidebar-btn" id="cancelCreate" style="background:transparent; text-align:center; margin-top:10px; border:none; color:rgba(255,255,255,0.5);">ANNULLA</button>
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
            } catch (err) { 
                alert("Errore nella creazione: " + err.message); 
            }
        };
        container.querySelector('#cancelCreate').onclick = closeOverlay;
    };

    // --- APERTURA TAVOLO DA GIOCO ---
    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => showSession(container, card.dataset.sid);
    });

    // --- LOGOUT ---
    container.querySelector('#btnLogout').onclick = async () => {
        try {
            await account.deleteSession('current');
            window.location.reload();
        } catch (err) {
            window.location.reload();
        }
    };
}
