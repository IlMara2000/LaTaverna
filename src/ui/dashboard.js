import { account, databases, storage } from '@services/appwrite.js'
import { showTabletop } from './tabletop.js'

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
        <button id="btnLogout" style="color: #ff4444; background: rgba(255,68,68,0.1); border: 1px solid #ff4444; border-radius: 8px; cursor: pointer; padding: 10px; margin-bottom:20px; width:100%;">Esci</button>
    </nav>

    <div class="dashboard-content" style="width: 100%; max-width: 450px; margin: 0 auto; padding-top: 80px;">
        <div class="user-profile-header" style="text-align: center; margin-bottom: 40px;">
            <h2 style="margin: 0;">Benvenuto, <span style="color:#a953ec;">${user.name}</span></h2>
        </div>
        <div class="session-list">
            <h3 style="font-size: 0.7rem; letter-spacing: 2px; color: #555; text-transform: uppercase;">Sessioni Attive</h3>
            ${sessions.length > 0 ? sessions.map(sid => `
                <div class="session-card" data-sid="${sid}">
                    <div class="map-preview"></div>
                    <div class="session-info">
                        <strong>TAVOLO: ${sid}</strong>
                        <span>🏰</span>
                    </div>
                </div>
            `).join('') : '<p style="text-align:center; color:#444;">Nessun tavolo attivo</p>'}
        </div>
    </div>

    <div id="main-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:5000; align-items:center; justify-content:center; padding:20px; overflow-
