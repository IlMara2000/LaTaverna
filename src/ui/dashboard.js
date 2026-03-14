import { account, databases } from '@services/appwrite.js'
import { showTabletop } from './tabletop.js'

const DB_ID = '69a867cc0018c0a6d700';
const COL_ID = 'tokens';

export async function showDashboard(container, user = null) {
  document.title = "LaTaverna - Dashboard"
  
  if (!user) {
    try { user = await account.get() } 
    catch (err) { import('./login.js').then(m => m.showLogin(container)); return; }
  }

  let sessions = [];
  try {
    const res = await databases.listDocuments(DB_ID, COL_ID);
    sessions = [...new Set(res.documents.map(d => d.session_id))].filter(Boolean);
  } catch (err) { console.error("Errore fetch sessioni:", err); }

  renderDashboard(container, user, sessions)
  attachEvents(container, user) // Passiamo user per la gestione account
}

function renderDashboard(container, user, sessions) {
  container.style.overflowY = "auto";
  container.style.alignItems = "flex-start";
  container.style.paddingTop = "80px";

  container.innerHTML = `
    <button class="hamburger" id="hamburger">☰</button>
    
    <nav class="sidebar" id="sidebar">
        <h2 style="font-size: 1.2rem; color: #a953ec; margin-bottom: 30px; text-align:center;">MENU</h2>
        <button class="sidebar-btn" id="btnAccount">👤 Account</button>
        <div style="margin-top: 40px; text-align: center;">
            <button id="btnLogout" style="color: #ff4444; background: rgba(255,68,68,0.1); border: 1px solid #ff4444; border-radius: 8px; cursor: pointer; padding: 10px 20px; width: 100%;">Esci dalla Taverna</button>
        </div>
    </nav>

    <div class="dashboard-content" style="width: 100%; max-width: 400px; margin: 0 auto;">
        <div class="user-profile-header" style="margin-bottom: 40px; text-align: center;">
            <h2 style="margin: 0; font-size: 1.8rem;">Benvenuto, <br><span id="display-name" style="color: #a953ec;">${user.name || 'Viandante'}</span></h2>
            <p style="font-size: 10px; color: #555; margin-top: 10px; letter-spacing: 1px;">ID: ${user.$id}</p>
        </div>

        <div class="session-list">
            <h3 style="font-size: 0.8rem; letter-spacing: 2px; color: #777; margin-bottom: 20px; text-transform: uppercase; text-align: center;">Le Tue Sessioni</h3>
            ${sessions.length === 0 
                ? `<div class="glass-box" style="padding: 40px 20px; border-style: dashed; opacity: 0.6;">
                    <p style="color: #888; margin: 0; font-size: 14px;">Nessun tavolo trovato...</p>
                   </div>`
                : sessions.map(sid => `
                    <div class="session-card" data-sid="${sid}" style="margin-bottom: 15px;">
                        <div class="map-preview"></div>
                        <div class="session-info">
                            <div>
                                <strong style="display: block; font-size: 14px; color: #fff;">TAVOLO: ${sid}</strong>
                                <span style="font-size: 11px; color: #a953ec; font-weight: bold;">ENTRA NEL TAVOLO</span>
                            </div>
                            <span style="font-size: 1.5rem;">🏰</span>
                        </div>
                    </div>
                `).join('')
            }
        </div>
    </div>

    <div id="account-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:4000; align-items:center; justify-content:center; padding:20px;">
        <div class="glass-box" style="max-width:340px;">
            <h3>Gestisci Account</h3>
            <div id="acc-msg" style="font-size:12px; margin-bottom:10px;"></div>
            <input type="text" id="new-name" placeholder="Nuovo Nome" value="${user.name}" style="margin-bottom:10px;">
            <input type="password" id="new-pass" placeholder="Nuova Password (opzionale)" style="margin-bottom:20px;">
            <button class="btn-primary" id="saveAccount">SALVA</button>
            <button id="closeAccount" style="background:none; border:none; color:#888; margin-top:15px; cursor:pointer;">Annulla</button>
        </div>
    </div>
  `
}

function attachEvents(container, user) {
    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');
    const modal = container.querySelector('#account-modal');

    // Toggle Sidebar
    hamburger.onclick = () => sidebar.classList.toggle('active');

    // Apertura Account
    container.querySelector('#btnAccount').onclick = () => {
        modal.style.display = 'flex';
        sidebar.classList.remove('active');
    };

    // Chiusura Account
    container.querySelector('#closeAccount').onclick = () => modal.style.display = 'none';

    // Salvataggio Dati
    container.querySelector('#saveAccount').onclick = async () => {
        const name = container.querySelector('#new-name').value;
        const pass = container.querySelector('#new-pass').value;
        const msg = container.querySelector('#acc-msg');

        try {
            if (name !== user.name) await account.updateName(name);
            if (pass) await account.updatePassword(pass);
            
            msg.style.color = "#00ff88";
            msg.textContent = "Dati aggiornati correttamente!";
            container.querySelector('#display-name').textContent = name;
            
            setTimeout(() => modal.style.display = 'none', 1000);
        } catch (err) {
            msg.style.color = "#ff4444";
            msg.textContent = "Errore: " + err.message;
        }
    };

    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => showTabletop(container, card.dataset.sid);
    });

    container.querySelector('#btnLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };
}
