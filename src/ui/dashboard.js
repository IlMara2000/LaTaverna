import { account, databases, storage } from '@services/appwrite.js'
import { showTabletop } from './tabletop.js'

// IDs necessari per le nuove funzioni
const DB_ID = '69a867cc0018c0a6d700';
const COL_SESSIONS = 'tokens'; 
const BUCKET_ASSETS = 'assets_bucket'; // Dovrai crearlo su Appwrite

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
        <button id="btnLogout" style="color: #ff4444; background: rgba(255,68,68,0.1); border: 1px solid #ff4444; border-radius: 8px; cursor: pointer; padding: 10px; margin-bottom:20px;">Esci</button>
    </nav>

    <div class="dashboard-content" style="width: 100%; max-width: 450px; margin: 0 auto; padding-top: 80px;">
        <div class="user-profile-header" style="text-align: center; margin-bottom: 40px;">
            <h2 style="margin: 0;">Benvenuto, <span style="color:#a953ec;">${user.name}</span></h2>
        </div>

        <div class="session-list">
            <h3 style="font-size: 0.7rem; letter-spacing: 2px; color: #555; text-transform: uppercase;">Sessioni Attive</h3>
            ${sessions.map(sid => `
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
        <div class="glass-box" id="overlay-content" style="max-width:500px; width:100%;">
            </div>
    </div>
  `;
}

function attachEvents(container, user, sessions) {
    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');
    const overlay = container.querySelector('#main-overlay');
    const content = container.querySelector('#overlay-content');

    hamburger.onclick = () => sidebar.classList.toggle('active');

    // --- LOGICA GENERAZIONE SESSIONE ---
    container.querySelector('#btnNewSession').onclick = () => {
        const newSid = "TAVOLO-" + Math.floor(Math.random() * 9000);
        alert("Generazione nuova sessione: " + newSid);
        // Qui andrà la chiamata databases.createDocument
    };

    // --- LOGICA ASSETS & DOCS ---
    container.querySelector('#btnAssets').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>Carica Assets</h3>
            <p style="font-size:12px; color:#888;">Carica PDF o Immagini per le tue sessioni</p>
            <input type="file" id="fileInput" style="margin:20px 0;">
            <select id="linkSession" style="width:100%; padding:10px; background:#111; color:white; border-radius:8px; margin-bottom:20px;">
                <option value="">Collega a sessione (Opzionale)</option>
                ${sessions.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <button class="btn-primary" id="uploadBtn">CARICA FILE</button>
            <button class="btn-close" onclick="this.closest('#main-overlay').style.display='none'">Chiudi</button>
        `;
    };

    // --- LOGICA CREA PERSONAGGIO ---
    container.querySelector('#btnCharacter').onclick = () => {
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>Nuovo Eroe</h3>
            <label style="font-size:12px; display:block; margin-bottom:5px;">Scegli il Sistema:</label>
            <select id="gameSystem" style="width:100%; padding:12px; background:#111; color:white; border:1px solid #333; border-radius:8px; margin-bottom:20px;">
                <option value="dnd5_2024">D&D 5.0 (Versione 2024/25)</option>
                <option value="custom">Usa Manuale Caricato (Analisi PDF...)</option>
            </select>
            <div id="char-steps">
                <input type="text" placeholder="Nome Personaggio" style="margin-bottom:10px;">
                <button class="btn-primary">INIZIA CONFIGURAZIONE 100%</button>
            </div>
            <button class="btn-close" style="margin-top:20px; display:block; width:100%; background:none; border:none; color:#555; cursor:pointer;" onclick="this.closest('#main-overlay').style.display='none'">Annulla</button>
        `;
    };

    // Account (già esistente)
    container.querySelector('#btnAccount').onclick = () => { /* logica account */ };

    // Logout
    container.querySelector('#btnLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };
}
