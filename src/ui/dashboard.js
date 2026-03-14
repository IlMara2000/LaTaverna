import { account, databases, storage } from '@services/appwrite.js'
import { showSession } from './session.js' // Assicurati di creare questo file

const DB_ID = '69a867cc0018c0a6d700';
const COL_SESSIONS = 'tokens'; 
const BUCKET_ASSETS = 'assets_bucket'; 

export async function showDashboard(container, user = null) {
  if (!user) {
    try { user = await account.get() } 
    catch (err) { import('./login.js').then(m => m.showLogin(container)); return; }
  }

  let sessions = [];
  try {
    const res = await databases.listDocuments(DB_ID, COL_SESSIONS);
    sessions = res.documents; // Prendiamo i documenti interi per avere gli ID
  } catch (err) { console.error("Errore fetch sessioni:", err); }

  renderDashboard(container, user, sessions);
  attachEvents(container, user, sessions);
}

function renderDashboard(container, user, sessions) {
  container.innerHTML = `
    <button class="hamburger" id="hamburger">☰</button>
    
    <nav class="sidebar" id="sidebar">
        <h2 style="font-size: 1.2rem; color: #a953ec; margin-bottom: 25px; text-align:center;">LaTaverna</h2>
        <button class="sidebar-btn" id="btnNewSession">✨ Genera Sessione</button>
        <button class="sidebar-btn" id="btnAssets">📁 Assets & Docs</button>
        <button class="sidebar-btn" id="btnCharacter">🛡️ Crea Personaggio</button>
        <button class="sidebar-btn" id="btnAccount">👤 Account</button>
        <div style="flex-grow: 1;"></div>
        <button id="btnLogout" style="color: #ff4444; background: rgba(255,68,68,0.1); border: 1px solid #ff4444; border-radius: 8px; cursor: pointer; padding: 10px; margin: 0 20px 20px 20px;">Esci</button>
    </nav>

    <div class="dashboard-content" style="width: 100%; max-width: 450px; margin: 0 auto; padding-top: 80px;">
        <div class="user-profile-header" style="text-align: center; margin-bottom: 40px;">
            <h2 style="margin: 0;">Benvenuto, <span id="display-name" style="color:#a953ec;">${user.name}</span></h2>
        </div>

        <div class="session-list">
            <h3 style="font-size: 0.7rem; letter-spacing: 2px; color: #555; text-transform: uppercase;">Sessioni Attive</h3>
            ${sessions.length === 0 ? '<p style="text-align:center; color:#444;">Nessun tavolo attivo</p>' : sessions.map(s => `
                <div class="session-card" data-sid="${s.session_id}" data-id="${s.$id}">
                    <div class="map-preview"></div>
                    <div class="session-info">
                        <strong>TAVOLO: ${s.session_id}</strong>
                        <span>🏰</span>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>

    <div id="main-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:5000; align-items:center; justify-content:center; padding:20px; overflow-y:auto;">
        <div class="glass-box" id="overlay-content" style="max-width:500px; width:100%;"></div>
    </div>
  `;
}

function attachEvents(container, user, sessions) {
    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');
    const overlay = container.querySelector('#main-overlay');
    const content = container.querySelector('#overlay-content');

    const closeOverlay = () => { overlay.style.display = 'none'; };
    hamburger.onclick = () => sidebar.classList.toggle('active');

    // --- GENERAZIONE SESSIONE REALE ---
    container.querySelector('#btnNewSession').onclick = async () => {
        const sid = "TAVOLO-" + Math.floor(1000 + Math.random() * 9000);
        try {
            await databases.createDocument(DB_ID, COL_SESSIONS, 'unique()', {
                session_id: sid,
                user_id: user.$id // Assicurati che questo attributo esista su Appwrite
            });
            window.location.reload();
        } catch (err) { alert("Errore creazione: " + err.message); }
    };

    // --- CLICK E LONG PRESS ---
    container.querySelectorAll('.session-card').forEach(card => {
        let pressTimer;
        const sid = card.dataset.sid;

        const start = () => {
            pressTimer = setTimeout(() => openEdit(sid), 700);
        };
        const cancel = () => clearTimeout(pressTimer);

        card.onmousedown = start;
        card.ontouchstart = start;
        card.onmouseup = cancel;
        card.ontouchend = cancel;

        card.onclick = () => {
            if (pressTimer) showSession(container, sid);
        };
    });

    function openEdit(sid) {
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>⚙️ Modifica Sessione</h3>
            <p style="font-size:13px; color:#aaa; margin-bottom:20px;">Stai modificando: <b>${sid}</b></p>
            <button class="btn-primary">Allega Documenti dallo Zaino</button>
            <button class="sidebar-btn" style="margin-top:10px; color:#ff4444; border-color:#ff4444;" id="btnDelete">Elimina Sessione</button>
            <button class="sidebar-btn" style="margin-top:20px; text-align:center;" onclick="document.getElementById('main-overlay').style.display='none'">Chiudi</button>
        `;
    }

    // --- LOGICA ASSETS ---
    container.querySelector('#btnAssets').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>🎒 Il Tuo Zaino</h3>
            <div class="form-group"><input type="file" id="fileInput" class="custom-file-input"></div>
            <div style="text-align:left; margin-bottom:20px;">
                <p style="font-size:13px; color:#a953ec; font-weight:bold; margin-bottom:10px;">Collega a:</p>
                <div style="max-height:100px; overflow-y:auto; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                    ${sessions.map(s => `<label style="display:flex; align-items:center; gap:10px; margin-bottom:8px;"><input type="checkbox" name="link-session" value="${s.session_id}"> ${s.session_id}</label>`).join('')}
                </div>
            </div>
            <button class="btn-primary" id="startUpload">CARICA FILE</button>
            <button class="sidebar-btn" style="margin-top:10px; text-align:center;" id="closeOv">Annulla</button>
        `;
        container.querySelector('#closeOv').onclick = closeOverlay;
    };

    // --- ACCOUNT & LOGOUT (Mantieni esistenti) ---
    container.querySelector('#btnAccount').onclick = () => { /* ... logica account ... */ };
    container.querySelector('#btnLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };
}
