import { account, databases, storage } from '../services/appwrite.js';
import { showSession } from './session.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_SESSIONS = 'tokens'; 
const BUCKET_ASSETS = 'assets_bucket'; 

export async function showDashboard(container, user = null) {
  if (!user) {
    try { user = await account.get(); } 
    catch (err) { import('./login.js').then(m => m.showLogin(container)); return; }
  }

  let sessions = [];
  let allFiles = []; 

  try {
    const res = await databases.listDocuments(DB_ID, COL_SESSIONS);
    sessions = res.documents;
    
    // Fallback sicuro se il bucket non esiste ancora o è vuoto
    try {
        const fileRes = await storage.listFiles(BUCKET_ASSETS);
        allFiles = fileRes.files;
    } catch (e) { console.warn("Storage non pronto:", e); }
  } catch (err) { console.error("Errore dashboard:", err); }

  renderDashboard(container, user, sessions);
  attachEvents(container, user, sessions, allFiles);
}

function renderDashboard(container, user, sessions) {
  container.innerHTML = `
    <button class="hamburger" id="hamburger">☰</button>
    
    <nav class="sidebar" id="sidebar">
        <h2 class="sidebar-logo">LaTaverna</h2>
        <button class="sidebar-btn" id="btnNewSession">✨ Genera Sessione</button>
        <button class="sidebar-btn" id="btnAssets">📁 Assets & Docs</button>
        <button class="sidebar-btn" id="btnCharacter">🛡️ Crea Personaggio</button>
        <button class="sidebar-btn" id="btnAccount">👤 Account</button>
        <div style="flex-grow: 1;"></div>
        <button id="btnLogout" class="logout-btn">Esci</button>
    </nav>

    <div class="dashboard-content">
        <div class="user-profile-header">
            <h2>Benvenuto, <span id="display-name">${user.name}</span></h2>
        </div>

        <div class="session-list">
            <h3 class="section-title">Sessioni Attive</h3>
            ${sessions.length === 0 ? '<p class="empty-msg">Nessun tavolo attivo</p>' : sessions.map(s => `
                <div class="session-card" data-sid="${s.session_id}" data-id="${s.$id}">
                    <div class="map-preview"></div>
                    <div class="session-info">
                        <strong>${s.name || s.session_id}</strong>
                        <span>🏰</span>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>

    <div id="main-overlay" class="overlay">
        <div class="glass-box" id="overlay-content"></div>
    </div>
  `;
}

function attachEvents(container, user, sessions, allFiles) {
    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');
    const overlay = container.querySelector('#main-overlay');
    const content = container.querySelector('#overlay-content');

    const closeOverlay = () => { overlay.style.display = 'none'; };
    hamburger.onclick = () => sidebar.classList.toggle('active');

    // Generazione Sessione
    container.querySelector('#btnNewSession').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>✨ Nuova Sessione</h3>
            <div class="form-group">
                <label>NOME SESSIONE</label>
                <input type="text" id="newSessionName" placeholder="es. La Miniera Perduta">
            </div>
            <div class="form-group">
                <label>CARICA ALLEGATI</label>
                <input type="file" id="quickFileInput" multiple class="custom-file-input">
            </div>
            <button class="btn-primary" id="confirmCreate">CREA SESSIONE</button>
            <button class="btn-secondary" id="cancelCreate">Annulla</button>
        `;

        container.querySelector('#confirmCreate').onclick = async () => {
            const nameValue = container.querySelector('#newSessionName').value.trim() || "Nuova Sessione";
            const sid = "TAVOLO-" + Math.floor(1000 + Math.random() * 9000);
            const newFiles = container.querySelector('#quickFileInput').files;

            try {
                if (newFiles.length > 0) {
                    for (let file of newFiles) {
                        await storage.createFile(BUCKET_ASSETS, 'unique()', file);
                    }
                }

                // FIX: Invio attributo 'name' richiesto dal DB
                await databases.createDocument(DB_ID, COL_SESSIONS, 'unique()', {
                    name: nameValue,
                    session_id: sid,
                    user_id: user.$id
                });

                window.location.reload();
            } catch (err) { alert("Errore creazione: " + err.message); }
        };
        container.querySelector('#cancelCreate').onclick = closeOverlay;
    };

    // Logica Card
    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => showSession(container, card.dataset.sid);
    });

    // Logout
    container.querySelector('#btnLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };
}
