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

  // Recupero sessioni uniche basate su session_id
  let sessions = [];
  try {
    const res = await databases.listDocuments(DB_ID, COL_ID);
    sessions = [...new Set(res.documents.map(d => d.session_id))].filter(Boolean);
  } catch (err) { console.error("Errore fetch sessioni:", err); }

  renderDashboard(container, user, sessions)
  attachEvents(container)
}

function renderDashboard(container, user, sessions) {
  container.innerHTML = `
    <button class="hamburger" id="hamburger">☰</button>
    
    <nav class="sidebar" id="sidebar">
        <h2 style="font-size: 1.2rem; color: #a953ec; margin-bottom: 20px;">MENU</h2>
        <button class="sidebar-btn" id="btnConnectDiscord">🎮 Collega Discord</button>
        <button class="sidebar-btn" id="btnSettings">⚙️ Impostazioni</button>
        <div style="flex-grow: 1;"></div>
        <button id="btnLogout" style="color: #ff4444; background: none; border: none; cursor: pointer; padding: 10px;">Esci dalla Taverna</button>
    </nav>

    <div class="dashboard-content">
        <div class="user-profile-header">
            <h2 style="margin: 0; font-size: 1.5rem;">Benvenuto, <span style="color: #a953ec;">${user.name || 'Viandante'}</span></h2>
            <p style="font-size: 11px; color: #888; margin-top: 5px;">ACCOUNT ID: ${user.$id}</p>
        </div>

        <div class="session-list">
            <h3 style="font-size: 0.9rem; letter-spacing: 2px; color: #aaa; margin-bottom: 10px; text-transform: uppercase;">Sessioni Attive</h3>
            
            ${sessions.length === 0 
                ? `<div class="glass-box" style="padding: 30px; text-align: center; max-width: 100%;">
                    <p style="color: #666; margin: 0;">Nessuna sessione attiva</p>
                   </div>`
                : sessions.map(sid => `
                    <div class="session-card" data-sid="${sid}">
                        <div class="map-preview"></div>
                        <div class="session-info">
                            <div>
                                <strong style="display: block; font-size: 14px;">TAVOLO: ${sid}</strong>
                                <span style="font-size: 11px; color: #a953ec;">Entra ora</span>
                            </div>
                            <span style="font-size: 1.5rem;">🏰</span>
                        </div>
                    </div>
                `).join('')
            }
        </div>
    </div>
  `
}

function attachEvents(container) {
    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');

    hamburger.onclick = () => sidebar.classList.toggle('active');

    // Clicca su una sessione
    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => showTabletop(container, card.dataset.sid);
    });

    // Logout
    container.querySelector('#btnLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };

    // Discord
    container.querySelector('#btnConnectDiscord').onclick = () => {
        const redirectUri = encodeURIComponent(window.location.origin);
        window.location.href = `https://discord.com/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20email`;
    };
}
