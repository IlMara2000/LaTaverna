import { account, databases, storage } from '@services/appwrite.js'
import { showTabletop } from './tabletop.js'

// IDs necessari
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
    sessions = [...new Set(res.documents.map(d => d.session_id))].filter(Boolean);
  } catch (err) { console.error("Errore fetch sessioni:", err); }

  renderDashboard(container, user, sessions);
  attachEvents(container, user, sessions);
}

function renderDashboard(container, user, sessions) {
  container.innerHTML = `
    <button class="hamburger" id="hamburger">☰</button>
    
    <nav class="sidebar" id="sidebar">
        <h2 style="font-size: 1.2rem; color: #a953ec; margin-bottom: 25px; text-align:center;">TAVERNA</h2>
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
            ${sessions.length === 0 ? '<p style="text-align:center; color:#444;">Nessun tavolo attivo</p>' : sessions.map(sid => `
                <div class="session-card" data-sid="${sid}">
                    <div class="map-preview"></div>
                    <div class="session-info">
                        <strong>TAVOLO: ${sid}</strong>
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

    // --- GENERAZIONE SESSIONE ---
    container.querySelector('#btnNewSession').onclick = () => {
        const newSid = "TAVOLO-" + Math.floor(Math.random() * 9000);
        alert("Generata: " + newSid + ". Implementazione DB in arrivo.");
    };

    // --- ASSETS & DOCS (LOGICA ZAINO) ---
    container.querySelector('#btnAssets').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>🎒 Il Tuo Zaino</h3>
            <p style="font-size:12px; color:#888; margin-bottom:15px;">Carica file non collegati o seleziona una sessione attiva.</p>
            <div class="form-group">
                <input type="file" id="fileInput" class="custom-file-input">
            </div>
            <div style="text-align:left; margin-bottom:20px;">
                <p style="font-size:13px; color:#a953ec; font-weight:bold; margin-bottom:10px;">Collega a:</p>
                <div style="max-height:100px; overflow-y:auto; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
                    ${sessions.length > 0 ? sessions.map(sid => `
                        <label style="display:flex; align-items:center; gap:10px; margin-bottom:8px; font-size:14px;">
                            <input type="checkbox" name="link-session" value="${sid}"> ${sid}
                        </label>
                    `).join('') : '<p style="font-size:11px; color:#555;">Nessuna sessione attiva.</p>'}
                </div>
            </div>
            <button class="btn-primary" id="startUpload">CARICA FILE</button>
            <button class="sidebar-btn" style="margin-top:10px; text-align:center;" id="closeOv">Annulla</button>
        `;
        
        container.querySelector('#startUpload').onclick = async () => {
            const file = container.querySelector('#fileInput').files[0];
            if (!file) return alert("Seleziona un file!");
            // Qui andrà la logica storage.createFile + databases.createDocument per i link
            alert("File in caricamento nello zaino...");
            closeOverlay();
        };
        container.querySelector('#closeOv').onclick = closeOverlay;
    };

    // --- CREA PERSONAGGIO ---
    container.querySelector('#btnCharacter').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>🛡️ Nuovo Personaggio</h3>
            <select id="gameSystem" style="width:100%; padding:12px; background:#111; color:white; border-radius:8px; margin-bottom:20px;">
                <option value="dnd5_2024">D&D 5.0 (2024/25)</option>
                <option value="custom">Usa Manuale Caricato (PDF)</option>
            </select>
            <input type="text" id="charName" placeholder="Nome Personaggio" style="margin-bottom:20px;">
            <button class="btn-primary">INIZIA CONFIGURAZIONE</button>
            <button class="sidebar-btn" style="margin-top:10px; text-align:center;" id="closeOv">Annulla</button>
        `;
        container.querySelector('#closeOv').onclick = closeOverlay;
    };

    // --- ACCOUNT ---
    container.querySelector('#btnAccount').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>👤 Gestione Account</h3>
            <div id="acc-msg" style="font-size:12px; margin-bottom:10px;"></div>
            <input type="text" id="upd-name" placeholder="Nuovo Nome" value="${user.name}" style="margin-bottom:10px;">
            <input type="password" id="upd-pass" placeholder="Nuova Password" style="margin-bottom:20px;">
            <button class="btn-primary" id="saveAcc">SALVA MODIFICHE</button>
            <button class="sidebar-btn" style="margin-top:10px; text-align:center;" id="closeOv">Annulla</button>
        `;
        
        container.querySelector('#saveAcc').onclick = async () => {
            const n = container.querySelector('#upd-name').value;
            const p = container.querySelector('#upd-pass').value;
            try {
                if (n !== user.name) await account.updateName(n);
                if (p) await account.updatePassword(p);
                container.querySelector('#display-name').textContent = n;
                closeOverlay();
            } catch (err) { alert(err.message); }
        };
        container.querySelector('#closeOv').onclick = closeOverlay;
    };

    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => showTabletop(container, card.dataset.sid);
    });

    container.querySelector('#btnLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };
}
