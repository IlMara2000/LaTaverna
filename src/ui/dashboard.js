import { account, databases } from '../services/appwrite.js';
import { showSession } from './session.js';
import { showCharacters } from './characters.js';
import { showAssets } from './assets.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_SESSIONS = 'tokens';

export async function showDashboard(container, user = null) {
    if (!user) {
        try { user = await account.get(); } 
        catch (err) { window.location.reload(); return; }
    }

    let sessions = [];
    try {
        const res = await databases.listDocuments(DB_ID, COL_SESSIONS);
        sessions = res.documents;
    } catch (err) { console.error("Errore sessioni:", err); }

    container.innerHTML = `
        <button class="hamburger" id="hamburger">☰</button>
        <nav class="sidebar glass-box" id="sidebar">
            <h2 style="color:#a953ec; text-align:center; margin-bottom:30px; font-weight:900;">TAVERNA</h2>
            <button class="sidebar-btn" id="navNewSession">✨ NUOVA SESSIONE</button>
            <button class="sidebar-btn" id="navCharacters">🎭 PERSONAGGI</button>
            <button class="sidebar-btn" id="navAssets">🎒 LO ZAINO</button>
            <div style="flex-grow:1;"></div>
            <button class="sidebar-btn" id="navLogout" style="color:#ff4444;">ESCI</button>
        </nav>
        <div class="dashboard-content">
            <header style="margin-bottom:30px; padding:0 15px;">
                <h1>Bentornato,</h1>
                <p style="color:#a953ec; font-weight:bold;">${user.name}</p>
            </header>
            <div class="sessions-grid" style="display:grid; gap:20px; padding:0 15px;">
                ${sessions.length === 0 ? '<p style="padding:20px; opacity:0.5;">Nessuna sessione attiva.</p>' : sessions.map(s => `
                    <div class="session-card glass-box" data-sid="${s.session_id}" style="cursor:pointer; padding:15px;">
                        <h4 style="font-weight:900;">${s.name}</h4>
                        <p style="font-size:10px; opacity:0.5;">ID: ${s.session_id}</p>
                    </div>
                `).join('')}
            </div>
        </div>
        <div id="overlay" class="overlay"><div class="glass-box" id="overlay-content" style="width:90%; max-width:400px;"></div></div>
    `;

    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');

    hamburger.onclick = () => sidebar.classList.toggle('active');

    container.querySelector('#navCharacters').onclick = () => {
        sidebar.classList.remove('active');
        showCharacters(container);
    };

    container.querySelector('#navAssets').onclick = () => {
        sidebar.classList.remove('active');
        showAssets(container);
    };

    container.querySelector('#navLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };

    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => showSession(container, card.dataset.sid);
    });

    container.querySelector('#navNewSession').onclick = () => {
        const overlay = container.querySelector('#overlay');
        const content = container.querySelector('#overlay-content');
        sidebar.classList.remove('active');
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h3>NUOVO TAVOLO</h3>
            <input type="text" id="newSessName" placeholder="Nome avventura..." style="width:100%; margin:15px 0; padding:10px; background:rgba(255,255,255,0.1); border:1px solid var(--accent); color:white; border-radius:10px;">
            <button class="btn-primary" id="confCreate">CREA</button>
            <button class="sidebar-btn" id="cancelCreate" style="background:transparent; margin-top:10px;">ANNULLA</button>
        `;
        content.querySelector('#cancelCreate').onclick = () => overlay.style.display = 'none';
        content.querySelector('#confCreate').onclick = async () => {
            const n = document.getElementById('newSessName').value || "Nuova Sessione";
            const sid = "TAVOLO-" + Math.floor(Math.random()*9999);
            try {
                await databases.createDocument(DB_ID, COL_SESSIONS, 'unique()', { name:n, session_id:sid, user_id:user.$id });
                window.location.reload();
            } catch(e) { alert(e.message); }
        };
    };
}
