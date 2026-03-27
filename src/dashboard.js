function enterSystem(system) {
    const mainContent = document.getElementById('main-content');
    
    // 1. Aggiorna la Sidebar
    updateSidebarContext(system);

    // 2. Render UI con tasto "Torna" stilizzato
    mainContent.innerHTML = `
        <div class="fade-in">
            <button onclick="window.location.reload()" class="btn-back" style="
                display: flex;
                align-items: center;
                gap: 8px;
                background: rgba(157, 78, 221, 0.1);
                border: 1px solid rgba(157, 78, 221, 0.3);
                color: var(--amethyst-bright);
                padding: 10px 18px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 30px;
                transition: all 0.3s ease;
            ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                TORNA ALLA LIBRERIA
            </button>

            <h1 style="text-transform: uppercase; font-weight: 900; letter-spacing: -1px; margin-bottom: 5px;">
                Dashboard <span style="color:var(--amethyst-bright);">${system}</span>
            </h1>
            <div style="width: 40px; height: 4px; background: var(--amethyst); border-radius: 2px; margin-bottom: 30px;"></div>

            <div id="game-workspace" style="
                background: rgba(255, 255, 255, 0.03); 
                border-radius: 24px; 
                padding: 60px 20px; 
                text-align: center; 
                border: 1px solid rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(10px);
            ">
                <p style="opacity: 0.5; font-style: italic;">Consultando i registri del sistema...</p>
            </div>
        </div>
    `;

    // Aggiungiamo un piccolo effetto hover via JS se non vuoi usare il CSS esterno
    const btnBack = mainContent.querySelector('.btn-back');
    btnBack.onmouseenter = () => {
        btnBack.style.background = 'rgba(157, 78, 221, 0.2)';
        btnBack.style.transform = 'translateX(-5px)';
    };
    btnBack.onmouseleave = () => {
        btnBack.style.background = 'rgba(157, 78, 221, 0.1)';
        btnBack.style.transform = 'translateX(0)';
    };
}
