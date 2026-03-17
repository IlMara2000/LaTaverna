export async function showDashboard(container, user) {
    container.innerHTML = `
        <button class="hamburger-vercel" id="hamburger">
            <span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </button>

        <nav class="sidebar" id="sidebar">
            <div style="padding:20px;">
                <h2 class="auth-title" style="font-size:1.2rem;">MENU</h2>
                <div style="margin-top:30px; display:flex; flex-direction:column; gap:10px;">
                    <button class="sidebar-btn">CRONACHE</button>
                    <button class="sidebar-btn">PERSONAGGI</button>
                    <button id="logout-btn" class="sidebar-btn" style="color:#ff4444;">LOGOUT</button>
                </div>
            </div>
        </nav>

        <div class="dashboard-content" style="padding: 40px 20px;">
            <header style="text-align:left;">
                <h1 style="font-size: 1.8rem; opacity:0.8;">BENTORNATO,</h1>
                <p class="auth-title" style="font-size: 2.2rem; line-height:1;">${user.name.toUpperCase()}</p>
            </header>
            
            <div id="session-list" style="margin-top:30px;">
                <div class="auth-card" style="width:100%; padding:20px; opacity:0.8;">
                    <p style="font-size:14px;">Caricamento cronache...</p>
                </div>
            </div>
        </div>
        <div id="sidebar-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); display:none; z-index:1400;"></div>
    `;

    const side = document.getElementById('sidebar');
    const over = document.getElementById('sidebar-overlay');
    
    document.getElementById('hamburger').onclick = () => {
        side.classList.toggle('active');
        over.style.display = side.classList.contains('active') ? 'block' : 'none';
    };
}
