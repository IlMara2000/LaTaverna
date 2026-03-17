import { account, databases, APPWRITE_CONFIG, ID } from '../services/appwrite.js';
import { showCharacters } from './characters.js';
import { showAssets } from './zaino.js';

export async function showDashboard(container, user) {
    if (!user) {
        try { user = await account.get(); } 
        catch { window.location.reload(); return; }
    }

    // Costruiamo la Dashboard con Sidebar integrata
    container.innerHTML = `
        <button class="hamburger-vercel" id="hamburger">
            <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </button>

        <nav class="sidebar" id="sidebar">
            <div style="text-align:center; margin-bottom: 40px;">
                <img src="/assets/logo.png" style="width:110px; filter: drop-shadow(0 0 10px var(--neon-glow));">
            </div>
            <div class="nav-links">
                <button class="sidebar-btn" id="navHome">🏠 HOME</button>
                <button class="sidebar-btn" id="navNewSession">✨ NUOVA SESSIONE</button>
                <button class="sidebar-btn" id="navCharacters">🎭 PERSONAGGI</button>
                <button class="sidebar-btn" id="navAssets">🎒 LO ZAINO</button>
            </div>
            <div style="flex-grow:1;"></div>
            <button class="sidebar-btn" id="navLogout" style="border-color:#ff4444; color:#ff4444; opacity:0.8;">ESCI</button>
        </nav>

        <div class="dashboard-content" id="main-content">
            <header>
                <h1 style="font-size: 2.5rem; line-height:1;">Bentornato,</h1>
                <p class="auth-title" style="font-size: 1.8rem; margin-top: 5px;">${user.name}</p>
            </header>
            
            <div id="sessions-list" style="margin-top: 40px; display: grid; gap: 15px;">
                <div class="auth-card" style="width:100%; opacity:0.6; padding: 20px;">
                    <p style="font-size: 14px;">Caricamento cronache in corso...</p>
                </div>
            </div>
        </div>

        <div id="sidebar-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:none; z-index:1500;"></div>
    `;

    // --- LOGICA UI ---
    const sidebar = container.querySelector('#sidebar');
    const hamburger = container.querySelector('#hamburger');
    const overlay = container.querySelector('#sidebar-overlay');
    const content = container.querySelector('#main-content');

    const toggleMenu = () => {
        sidebar.classList.toggle('active');
        overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
    };

    hamburger.onclick = toggleMenu;
    overlay.onclick = toggleMenu;

    // --- NAVIGAZIONE ---
    container.querySelector('#navHome').onclick = () => showDashboard(container, user);
    
    container.querySelector('#navCharacters').onclick = () => {
        toggleMenu();
        showCharacters(content);
    };

    container.querySelector('#navAssets').onclick = () => {
        toggleMenu();
        showAssets(content);
    };

    container.querySelector('#navLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };

    // --- CARICAMENTO DATI REAL-TIME ---
    try {
        const res = await databases.listDocuments(APPWRITE_CONFIG.dbId, APPWRITE_CONFIG.collections.maps);
        const list = container.querySelector('#sessions-list');
        
        if (res.documents.length === 0) {
            list.innerHTML = `<div class="auth-card" style="width:100%; opacity:0.5;"><p>Nessun tavolo attivo al momento.</p></div>`;
        } else {
            list.innerHTML = res.documents.map(s => `
                <div class="auth-card" style="width:100%; flex-direction:row; justify-content:space-between; align-items:center; padding: 25px; cursor:pointer;">
                    <div style="text-align:left;">
                        <h4 style="margin:0; font-size:1.2rem;">${s.name}</h4>
                        <span style="font-size:10px; opacity:0.5; text-transform:uppercase;">ID: ${s.session_id}</span>
                    </div>
                    <span style="font-size:1.5rem; opacity:0.3;">➔</span>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Errore fetch sessioni:", err);
    }
}
