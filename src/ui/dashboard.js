import { account, databases, APPWRITE_CONFIG, ID } from '../services/appwrite.js';
import { showSession } from './session.js';
import { showCharacters } from './characters.js';
import { showAssets } from './zaino.js';

const DB_ID = APPWRITE_CONFIG.dbId;
const COL_SESSIONS = APPWRITE_CONFIG.collections.maps; 

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
        <button class="hamburger-vercel" id="hamburger" aria-label="Menu">
            <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </button>

        <nav class="sidebar" id="sidebar">
            <div id="navHome" style="cursor:pointer; text-align:center; margin-top: 20px; margin-bottom:40px;">
                <img src="/assets/logo.png" alt="Logo" style="width:110px; height:auto; filter: drop-shadow(0 0 15px var(--accent));">
            </div>
            <div class="nav-links" style="display:flex; flex-direction:column; gap:10px;">
                <button class="sidebar-btn" id="navNewSession">✨ NUOVA SESSIONE</button>
                <button class="sidebar-btn" id="navCharacters">🎭 PERSONAGGI</button>
                <button class="sidebar-btn" id="navAssets">🎒 LO ZAINO</button>
            </div>
            <div style="flex-grow:1;"></div>
            <button class="sidebar-btn" id="navLogout" style="color:#ff4444; border-color: rgba(255,68,68,0.2); margin-bottom: 20px;">ESCI</button>
        </nav>

        <div class="dashboard-content">
            <header style="margin-bottom:30px;">
                <h1 style="font-size: 2.5rem; letter-spacing: -1px; margin:0; line-height:1.1;">Bentornato,</h1>
                <p style="color:var(--accent); font-weight:900; font-size: 1.6rem; text-transform: uppercase;">${user.name}</p>
            </header>
            
            <div class="sessions-grid" style="display:grid; gap:15px;">
                ${sessions.length === 0 ? `
                    <div class="glass-box" style="padding:40px; text-align:center; opacity:0.6;">
                        <p>Nessun tavolo attivo.<br>Crea la tua prima avventura!</p>
                    </div>
                ` : sessions.map(s => `
                    <div class="session-card glass-box" data-sid="${s.session_id}" style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h4 style="font-size:1.2rem; font-weight:900; margin:0;">${s.name}</h4>
                            <span style="font-size:10px; text-transform:uppercase; letter-spacing:1px; color:var(--accent); opacity:0.8;">ID: ${s.session_id}</span>
                        </div>
                        <span style="font-size:1.2rem; opacity:0.5;">➔</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div id="overlay" class="overlay">
            <div class="glass-box" id="overlay-content" style="width:90%; max-width:400px;"></div>
        </div>
    `;

    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');
    const overlay = container.querySelector('#overlay');

    const closeAll = () => {
        sidebar.classList.remove('active');
        hamburger.classList.remove('open');
        overlay.style.display = 'none';
    };

    hamburger.onclick = () => {
        sidebar.classList.toggle('active');
        hamburger.classList.toggle('open');
    };

    // Fix click per chiudere sidebar quando apri sezioni
    container.querySelector('#navCharacters').onclick = () => { closeAll(); showCharacters(container); };
    container.querySelector('#navAssets').onclick = () => { closeAll(); showAssets(container); };
    container.querySelector('#navLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };

    container.querySelectorAll('.session-card').forEach(card => {
        card.onclick = () => showSession(container, card.dataset.sid);
    });

    container.querySelector('#navNewSession').onclick = () => {
        const content = container.querySelector('#overlay-content');
        closeAll();
        overlay.style.display = 'flex';
        content.innerHTML = `
            <h2 style="margin-bottom:20px; font-weight:900; letter-spacing:-1px;">NUOVO TAVOLO</h2>
            <input type="text" id="newSessName" placeholder="Nome dell'avventura..." autocomplete="off">
            <button class="btn-primary" id="confCreate" style="margin-top:20px;">INIZIA AVVENTURA</button>
            <button class="sidebar-btn" id="cancelCreate" style="background:transparent; border:none; width:100%; margin-top:10px; text-align:center; opacity:0.6;">ANNULLA</button>
        `;

        content.querySelector('#cancelCreate').onclick = () => overlay.style.display = 'none';
        
        content.querySelector('#confCreate').onclick = async () => {
            const n = document.getElementById('newSessName').value || "Nuova Sessione";
            try {
                // Inclusione di tutti i campi obbligatori per evitare errori Appwrite
                await databases.createDocument(DB_ID, COL_SESSIONS, ID.unique(), { 
                    name: n, 
                    session_id: "TAVOLO-" + Math.floor(Math.random()*9999), 
                    user_id: user.$id, 
                    created_by: user.name, 
                    x: 0, 
                    y: 0, 
                    size: 1, 
                    hp: 10, 
                    max_hp: 10,
                    width: 1000, 
                    height: 1000 
                });
                window.location.reload();
            } catch(e) { 
                alert("Errore Database: " + e.message); 
            }
        };
    };
}