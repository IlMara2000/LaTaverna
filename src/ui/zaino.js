import { storage, APPWRITE_CONFIG, ID } from '../services/appwrite.js';

const BUCKET_ID = APPWRITE_CONFIG.bucketId;

export async function showAssets(container) {
    let files = [];
    let errorMsg = '';

    // Verifica configurazione
    if (!BUCKET_ID || BUCKET_ID === '' || BUCKET_ID === 'vtt_assets') {
        errorMsg = "ID dello Storage (Bucket) mancante in appwrite.js";
    } else {
        try {
            const response = await storage.listFiles(BUCKET_ID);
            files = response.files;
        } catch (err) {
            console.error("Errore caricamento Zaino:", err);
            errorMsg = "Impossibile connettersi allo Storage. Verifica i permessi su Appwrite.";
        }
    }

    container.innerHTML = `
        <div class="dashboard-content" style="padding-top: 20px;">
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
                <h1 style="font-size: 1.8rem; font-weight: 900;">LO ZAINO 🎒</h1>
                <button class="sidebar-btn" id="backDash" style="padding:8px 15px; margin:0; width:auto; font-size:12px;">⬅ TAVERNA</button>
            </header>

            <div class="glass-box" style="text-align:center; padding:25px; border:2px dashed var(--accent); margin-bottom:25px; border-radius: 20px;">
                <h3 style="margin-bottom:5px; font-size: 1rem;">CARICA UN OGGETTO</h3>
                <p style="opacity:0.6; font-size:11px; margin-bottom:15px;">(Immagini, Token o Mappe)</p>
                
                <input type="file" id="fileInput" accept="image/*" style="display:none;" />
                <button class="btn-primary" id="btnUpload" style="width:100%; max-width:200px; padding: 12px;">SCEGLI FILE</button>
                <div id="uploadMsg" style="margin-top:12px; font-size: 12px; font-weight:bold;"></div>
            </div>

            ${errorMsg ? `
                <div id="errorDisplay" style="background: rgba(255, 68, 68, 0.1); border: 1px solid #ff4444; color:#ff4444; text-align:center; padding: 15px; border-radius: 12px; margin-bottom:20px; font-size: 13px;">
                    <strong>⚠️ Attenzione:</strong><br>${errorMsg}
                </div>
            ` : ''}
            
            <div class="assets-grid" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
                ${files.length === 0 && !errorMsg ? 
                    '<p style="opacity:0.5; grid-column: 1 / -1; text-align:center; padding: 20px;">Il tuo zaino è vuoto, viandante.</p>' 
                    : files.map(f => {
                        const imgUrl = storage.getFilePreview(BUCKET_ID, f.$id).href;
                        return `
                        <div class="session-card glass-box" style="padding:8px; text-align:center; border-radius: 15px;">
                            <div style="width:100%; height:110px; border-radius:10px; overflow:hidden; background:#111; margin-bottom:8px;">
                                <img src="${imgUrl}" alt="${f.name}" style="width:100%; height:100%; object-fit:cover;" />
                            </div>
                            <p style="font-size:9px; word-break:break-all; opacity:0.7; height: 24px; overflow: hidden;">${f.name}</p>
                        </div>
                    `}).join('')}
            </div>
        </div>
    `;

    // Torna alla Dashboard (Evitiamo il reload totale per velocità)
    container.querySelector('#backDash').onclick = () => {
        window.location.reload(); 
    };

    const fileInput = container.querySelector('#fileInput');
    const btnUpload = container.querySelector('#btnUpload');
    const uploadMsg = container.querySelector('#uploadMsg');

    if (btnUpload) {
        btnUpload.onclick = () => fileInput.click();
    }

    if (fileInput) {
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            uploadMsg.style.color = "var(--accent)";
            uploadMsg.textContent = "Incantando l'oggetto... ⏳";
            btnUpload.disabled = true;

            try {
                await storage.createFile(BUCKET_ID, ID.unique(), file);
                uploadMsg.style.color = "#00ff00";
                uploadMsg.textContent = "Oggetto riposto nello zaino! ✅";
                
                setTimeout(() => showAssets(container), 1500);
            } catch (err) {
                console.error("Errore upload:", err);
                uploadMsg.style.color = "#ff4444";
                uploadMsg.textContent = "Errore: " + err.message;
                btnUpload.disabled = false;
            }
        };
    }
}