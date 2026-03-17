export function initSidebar(container, user, onLogout) {
    const sidebarHtml = `
        <button class="hamburger-vercel" id="hamburger" aria-label="Menu">
            <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </button>

        <nav class="sidebar" id="sidebar">
            <div style="text-align:center; margin-bottom: 30px;">
                <img src="/assets/logo.png" style="width: 80px; filter: drop-shadow(0 0 10px var(--neon-glow));">
                <p style="font-size: 10px; margin-top: 10px; opacity: 0.6;">VIANDANTE: ${user.name}</p>
            </div>
            <div class="nav-links">
                <button class="sidebar-btn" id="navNewSession">✨ CRONACHE</button>
                <button class="sidebar-btn" id="navCharacters">🎭 PERSONAGGI</button>
                <button class="sidebar-btn" id="navAssets">🎒 LO ZAINO</button>
            </div>
            <div style="flex-grow:1;"></div>
            <button class="sidebar-btn" id="navLogout" style="color:#ff4444; border-color: rgba(255,68,68,0.3);">ESCI</button>
        </nav>
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;

    container.insertAdjacentHTML('afterbegin', sidebarHtml);

    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('sidebar-overlay');

    const toggleMenu = () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    };

    hamburger.onclick = toggleMenu;
    overlay.onclick = toggleMenu;

    document.getElementById('navLogout').onclick = onLogout;
}
