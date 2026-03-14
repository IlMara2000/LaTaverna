import { account, databases, storage } from '../services/appwrite.js';
import { showSession } from './session.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_SESSIONS = 'tokens'; 
const COL_CHARACTERS = 'characters'; // Nuova collezione
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
    try {
        const fileRes = await storage.listFiles(BUCKET_ASSETS);
        allFiles = fileRes.files;
    } catch (e) { console.warn("Storage non pronto"); }
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
                <div class="session-card" data-sid="${s.session_id}">
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

    // --- CREA PERSONAGGIO ---
    container.querySelector('#btnCharacter').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>🛡️ Nuovo Eroe</h3>
            <div class="form-group">
                <label>NOME PERSONAGGIO</label>
                <input type="text" id="charName" placeholder="es. Valerius lo Stregone">
            </div>
            <div class="form-group">
                <label>RAZZA</label>
                <select id="charRace">
                    <option value="Umano">Umano</option>
                    <option value="Elfo">Elfo</option>
                    <option value="Nano">Nano</option>
                    <option value="Mezzelfo">Mezzelfo</option>
                    <option value="Tiefling">Tiefling</option>
                </select>
            </div>
            <div class="form-group">
                <label>CLASSE</label>
                <select id="charClass">
                    <option value="Guerriero">Guerriero</option>
                    <option value="Mago">Mago</option>
                    <option value="Ladro">Ladro</option>
                    <option value="Chierico">Chierico</option>
                    <option value="Paladino">Paladino</option>
                </select>
            </div>
            <button class="btn-primary" id="saveChar">FORGIA EROE</button>
            <button class="btn-secondary" id="closeChar">Annulla</button>
        `;

        container.querySelector('#saveChar').onclick = async () => {
            const charData = {
                name: container.querySelector('#charName').value.trim() || "Senza Nome",
                race: container.querySelector('#charRace').value,
                class: container.querySelector('#charClass').value,
                user_id: user.$id
            };

            try {
                await databases.createDocument(DB_ID, COL_CHARACTERS, 'unique()', charData);
                alert(`${charData.name} è pronto all'avventura!`);
                closeOverlay();
            } catch (err) { alert("Errore: " + err.message); }
        };
        container.querySelector('#closeChar').onclick = closeOverlay;
    };

    // --- NUOVA SESSIONE ---
    container.querySelector('#btnNewSession').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>✨ Nuova Sessione</h3>
            <div class="form-group">
                <label>NOME SESSIONE</label>
                <input type="text" id="newSessionName" placeholder="es. La Miniera Perduta">
            </div>
            <button class="btn-primary" id="confirmCreate">CREA SESSIONE</button>
            <button class="btn-secondary" id="cancelCreate">Annulla</button>
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

    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => showSession(container, card.dataset.sid);
    });

    container.querySelector('#btnLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };
}
