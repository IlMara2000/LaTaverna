import { account, databases, APPWRITE_CONFIG, ID } from '../services/appwrite.js';

export async function showDashboard(container, user) {
    container.innerHTML = `
        <button class="hamburger-vercel" id="hamburger">
            <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </button>

        <nav class="sidebar" id="sidebar">
            <img src="/assets/logo.png" style="width:100px; margin: 20px auto;">
            <div class="nav-links">
                <button class="sidebar-btn" id="navNewSession">✨ NUOVA SESSIONE</button>
                <button class="sidebar-btn" id="navCharacters">🎭 PERSONAGGI</button>
                <button class="sidebar-btn" id="navAssets">🎒 LO ZAINO</button>
            </div>
            <div style="flex-grow:1"></div>
            <button class="sidebar-btn" id="navLogout" style="color:#ff4444">ESCI</button>
        </nav>

        <div class="dashboard-content">
            <header>
                <h1>Bentornato,</h1>
                <p class="auth-title" style="font-size:1.5rem">${user.name}</p>
            </header>
            <div id="session-list" class="sessions-grid" style="margin-top:30px">
                </div>
        </div>
    `;

    // Logic for Sidebar
    const hb = container.querySelector('#hamburger');
    const sb = container.querySelector('#sidebar');
    hb.onclick = () => { sb.classList.toggle('active'); };

    container.querySelector('#navLogout').onclick = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };
}
