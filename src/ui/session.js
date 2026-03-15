import { databases } from '../services/appwrite.js';
import { showTabletop } from './tabletop.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_SESSIONS = 'tokens'; 

/**
 * Carica e visualizza l'interfaccia della sessione
 * @param {HTMLElement} container - Il contenitore UI
 * @param {string} sessionId - L'ID univoco della sessione (session_id)
 */
export async function showSession(container, sessionId) {
    document.title = `LaTaverna - Sessione ${sessionId}`;
    
    // Mostriamo un caricamento immediato (Glass Effect)
    container.innerHTML = `
        <div class="glass-box" style="margin: 20px auto; text-align:center;">
            <p style="color:var(--accent); font-weight:bold;">Entrando nel tavolo...</p>
        </div>
    `;

    try {
        // Recuperiamo i dettagli della sessione per avere il nome corretto
        const res = await databases.listDocuments(DB_ID, COL_SESSIONS, [
            // Cerchiamo il documento che ha il session_id corrispondente
            // Nota: Assicurati che l'attributo session_id sia indicizzato su Appwrite
            `equal("session_id", "${sessionId}")`
        ]);

        const sessionData = res.documents[0] || { name: "Tavolo Ignoto" };

        // Rendering dell'interfaccia della sessione
        container.innerHTML = `
            <div class="session-view" style="width:100%; height:100vh; display:flex; flex-direction:column;">
                <header style="display:flex; justify-content:space-between; align-items:center; padding:15px 20px; background:rgba(15, 6, 23, 0.8); backdrop-filter:blur(10px); border-bottom:1px solid var(--glass-border); z-index:100;">
                    <button id="btnBack" class="sidebar-btn" style="width:auto; margin:0; padding:10px 15px; font-size:14px;">⬅ ESCI</button>
                    <div style="text-align:right;">
                        <h2 style="font-size:1.1rem; font-weight:900; color:white;">${sessionData.name}</h2>
                        <span style="font-size:10px; color:var(--accent); letter-spacing:1px;">ID: ${sessionId}</span>
                    </div>
                </header>
                
                <div id="tabletop-container" style="flex-grow:1; position:relative; overflow:hidden; background:#050208;">
                    <div id="game-ui-overlay" style="position:absolute; top:20px; right:20px; z-index:50; pointer-events:none;">
                        <div class="glass-box" style="padding:10px 15px; font-size:12px; pointer-events:auto;">
                            🟢 ONLINE
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Gestione tasto indietro
        container.querySelector('#btnBack').onclick = async () => {
            const { showDashboard } = await import('./dashboard.js');
            showDashboard(container);
        };

        // Inizializziamo il Tabletop nel suo contenitore dedicato
        const tabletopContainer = container.querySelector('#tabletop-container');
        showTabletop(tabletopContainer, sessionId);

    } catch (err) {
        console.error("Errore caricamento sessione:", err);
        container.innerHTML = `
            <div class="glass-box" style="margin:20px; text-align:center;">
                <h3 style="color:#ff4444;">Errore di Connessione</h3>
                <p>Non riesco a trovare il tavolo. Forse è svanito nel nulla?</p>
                <button class="btn-primary" onclick="window.location.reload()">RIPROVA</button>
            </div>
        `;
    }
}
