// src/ui/sidebar.js
export function initSidebar(container, user) {
    const sidebarHtml = `
        <button class="hamburger-vercel" id="hamburger" aria-label="Menu">
            <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </button>

        <nav class="sidebar" id="sidebar">
            <div class="sidebar-logo">
                <img src="/assets/logo.png" alt="Logo">
            </div>
            <div class="nav-links">
                <button class="sidebar-btn" id="navNewSession">✨ NUOVA SESSIONE</button>
                <button class="sidebar-btn" id="navCharacters">🎭 PERSONAGGI</button>
                <button class="sidebar-btn" id="navAssets">🎒 LO ZAINO</button>
            </div>
            <div style="flex-grow:1;"></div>
            <button class="sidebar-btn logout-btn" id="navLogout">ESCI</button>
        </nav>
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
    `;

    container.insertAdjacentHTML('afterbegin', sidebarHtml);

    const sidebar = document.getElementById('sidebar');
    const hamburger = document.getElementById('hamburger');
    const overlay = document.getElementById('sidebar-overlay');

    const toggleMenu = () => {
        sidebar.classList.toggle('active');
        hamburger.classList.toggle('open');
        overlay.classList.toggle('active');
    };

    hamburger.onclick = toggleMenu;
    overlay.onclick = toggleMenu;

    // Chiudi menu al click sui link (opzionale)
    sidebar.querySelectorAll('.sidebar-btn').forEach(btn => {
        if(btn.id !== 'navLogout') btn.addEventListener('click', toggleMenu);
    });
}
