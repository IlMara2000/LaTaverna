import { account, databases, storage } from '../services/appwrite.js' // Import relativo più sicuro per il build
import { showSession } from './session.js'

const DB_ID = '69a867cc0018c0a6d700';
const COL_SESSIONS = 'tokens'; 
const BUCKET_ASSETS = 'assets_bucket'; 

export async function showDashboard(container, user = null) {
  if (!user) {
    try { user = await account.get() } 
    catch (err) { import('./login.js').then(m => m.showLogin(container)); return; }
  }

  let sessions = [];
  let allFiles = []; 

  try {
    const res = await databases.listDocuments(DB_ID, COL_SESSIONS);
    sessions = res.documents;
    
    // Recupero file con catch specifico per evitare crash totali
    try {
        const fileRes = await storage.listFiles(BUCKET_ASSETS);
        allFiles = fileRes.files;
    } catch (e) { console.warn("Storage non accessibile:", e); }

  } catch (err) { console.error("Errore fetch dati dashboard:", err); }

  renderDashboard(container, user, sessions);
  attachEvents(container, user, sessions, allFiles);
}

function renderDashboard(container, user, sessions) {
  container.innerHTML = `
    <button class="hamburger" id="hamburger">☰</button>
    
    <nav class="sidebar" id="sidebar">
        <h2 style="font-size: 1.2rem; color: #a953ec; margin-bottom: 25px; text-align:center; letter-spacing: 2px;">LaTaverna</h2>
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
            ${sessions.length === 0 ? '<p style="text-align:center; color:#444; margin-top:20px;">Nessun tavolo attivo</p>' : sessions.map(s => `
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

    <div id="main-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:5000; align-items:center; justify-content:center; padding:20px; overflow-y:auto;">
        <div class="glass-box" id="overlay-content" style="max-width:500px; width:100%;"></div>
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

    container.querySelector('#btnNewSession').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>✨ Nuova Sessione</h3>
            <div class="form-group">
                <label style="font-size:11px; color:#a953ec; font-weight:bold;">NOME SESSIONE</label>
                <input type="text" id="newSessionName" placeholder="es. La Miniera Perduta" style="margin-top:5px; width:100%;">
            </div>

            <div style="text-align:left; margin-bottom:20px;">
                <p style="font-size:11px; color:#a953ec; font-weight:bold; margin-bottom:10px;">ALLEGA FILE DALLO ZAINO</p>
                <div style="max-height:100px; overflow-y:auto; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; border: 1px solid rgba(255,255,255,0.1);">
                    ${allFiles.length > 0 ? allFiles.map(file => `
                        <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; font-size:13px;">
                            <input type="checkbox" class="file-link-checkbox" value="${file.$id}"> ${file.name}
                        </label>
                    `).join('') : '<p style="font-size:11px; color:#555;">Zaino vuoto.</p>'}
                </div>
            </div>

            <div class="form-group">
                <p style="font-size:11px; color:#a953ec; font-weight:bold; margin-bottom:10px;">O CARICA NUOVI FILE ORA</p>
                <input type="file" id="quickFileInput" multiple class="custom-file-input" style="font-size:12px; width:100%;">
            </div>

            <button class="btn-primary" id="confirmCreate" style="width:100%;">CREA SESSIONE</button>
            <button class="sidebar-btn" style="margin-top:10px; text-align:center; width:100%;" id="cancelCreate">Annulla</button>
        `;

        container.querySelector('#confirmCreate').onclick = async () => {
            const name = container.querySelector('#newSessionName').value || "Nuova Sessione";
            const sid = "TAVOLO-" + Math.floor(1000 + Math.random() * 9000);
            const newFiles = container.querySelector('#quickFileInput').files;

            try {
                if (newFiles.length > 0) {
                    for (let file of newFiles) {
                        await storage.createFile(BUCKET_ASSETS, 'unique()', file);
                    }
                }

                await databases.createDocument(DB_ID, COL_SESSIONS, 'unique()', {
                    name: name,
                    session_id: sid,
                    user_id: user.$id
                });

                alert(`Sessione "${name}" creata!`);
                window.location.reload();
            } catch (err) { alert("Errore creazione: " + err.message); }
        };
        container.querySelector('#cancelCreate').onclick = closeOverlay;
    };

    container.querySelector('#btnCharacter').onclick = () => {
        alert("Work in progress: Qui metteremo la scheda personaggio!");
        sidebar.classList.remove('active');
    };

    container.querySelector('#btnAccount').onclick = () => {
        alert("Work in progress: Qui metteremo le impostazioni account!");
        sidebar.classList.remove('active');
    };

    container.querySelectorAll('.session-card').forEach(card => {
        let pressTimer;
        const sid = card.dataset.sid;

        const start = () => {
            pressTimer = setTimeout(() => {
                pressTimer = null;
                openEdit(sid);
            }, 700);
        };
        const cancel = () => { if(pressTimer) clearTimeout(pressTimer); };

        card.onmousedown = start; card.ontouchstart = start;
        card.onmouseup = cancel; card.ontouchend = cancel;

        card.onclick = () => {
            if (pressTimer) {
                clearTimeout(pressTimer);
                showSession(container, sid);
            }
        };
    });

    function openEdit(sid) {
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>⚙️ Modifica Sessione</h3>
            <p style="font-size:13px; color:#aaa; margin-bottom:20px;">Stai modificando: <b>${sid}</b></p>
            <button class="btn-primary" style="width:100%;">Gestisci Allegati</button>
            <button class="sidebar-btn" style="margin-top:10px; color:#ff4444; border-color:#ff4444; width:100%;" id="btnDelete">Elimina Sessione</button>
            <button class="sidebar-btn" style="margin-top:20px; text-align:center; width:100%;" id="closeEdit">Chiudi</button>
        `;
        container.querySelector('#closeEdit').onclick = closeOverlay;
    }

    container.querySelector('#btnAssets').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>🎒 Il Tuo Zaino</h3>
            <div class="form-group"><input type="file" id="fileInput" class="custom-file-input" style="width:100%;"></div>
            <button class="btn-primary" id="startUpload" style="width:100%;">CARICA NEL DATABASE</button>
            <button class="sidebar-btn" style="margin-top:10px; text-align:center; width:100%;" id="closeOv">Chiudi</button>
        `;
        container.querySelector('#closeOv').onclick = closeOverlay;
    };

    container.querySelector('#btnLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };
}
