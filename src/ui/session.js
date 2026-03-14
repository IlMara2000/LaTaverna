// src/ui/session.js
export function showSession(container, sessionId) {
    document.title = `LaTaverna - Sessione ${sessionId}`;
    container.innerHTML = `
        <div class="session-view">
            <header style="display:flex; justify-content:space-between; align-items:center; padding:20px; background:rgba(0,0,0,0.4);">
                <button id="btnBack" class="sidebar-btn" style="width:auto; margin:0;">⬅ Torna alla Dashboard</button>
                <h2>TAVOLO: <span style="color:#a953ec;">${sessionId}</span></h2>
                <div id="session-status">🟢 Online</div>
            </header>
            
            <div id="game-canvas-container" style="width:100%; height:calc(100vh - 80px); position:relative; overflow:hidden;">
                <div class="grid-layer" style="width:2000px; height:2000px; background-image: radial-gradient(rgba(169, 83, 236, 0.2) 1px, transparent 1px); background-size: 40px 40px;"></div>
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); opacity:0.3;">
                    <h1>AREA DI GIOCO</h1>
                    <p>Trascina gli assets qui per iniziare</p>
                </div>
            </div>
        </div>
    `;

    container.querySelector('#btnBack').onclick = () => {
        window.location.reload(); // Semplice reset per tornare alla dashboard
    };
}
