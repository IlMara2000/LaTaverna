// src/ui/zaino.js
import { storage, account } from '../services/appwrite.js';

const BUCKET_ID = 'assets_bucket'; 

/**
 * Visualizza la sezione Zaino (Assets)
 * @param {HTMLElement} container - Il contenitore UI principale
 */
export async function showAssets(container) {
    // Feedback immediato per l'utente
    container.innerHTML = `
        <div class="dashboard-content" style="padding-top:40px;">
            <div class="glass-box" style="text-align:center; padding:20px;">
                <p style="color:var(--accent); font-weight:bold; letter-spacing:1px;">APRENDO LO ZAINO...</p>
            </div>
        </div>
    `;
    
    try {
        const user = await account.get();
        
        container.innerHTML = `
            <div class="dashboard-content" style="padding-top:40px;">
                <button id="assetsBack" class="sidebar-btn" style="width:auto; margin-bottom:20px;">⬅ TORNA ALLA TAVERNA</button>
                
                <header style="margin-bottom:25px;">
                    <h2 style="margin-bottom:5px; letter-spacing:2px; font-weight:900; text-transform:uppercase;">Lo Zaino</h2>
                    <p style="font-size:12px; opacity:0.6; letter-spacing:1px;">CARICA E GESTISCI I TUOI ASSETS</p>
                </header>

                <div class="glass-box" id="drop-zone" style="border: 2px dashed #a953ec; text-align:center; padding:40px; margin-bottom:30px; cursor:pointer; background:rgba(169, 83, 236, 0.05); transition: 0.3s;">
                    <div style="font-size:3rem; margin-bottom:10px;">🎒</div>
                    <p style="font-weight:bold; margin:0;">CLICCA PER AGGIUNGERE UN OGGETTO</p>
                    <p style="font-size:11px; opacity:0.5; margin-top:5px;">(Immagini, Token o Mappe)</p>
                    <input type="file" id="fileInput" hidden accept="image/*" />
                </div>

                <div id="assets-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap:15px; padding-bottom:50px;">
                    </div>
            </div>
        `;

        const assetsGrid = container.querySelector('#assets-grid');
        const fileInput = container.querySelector('#fileInput');
        const dropZone = container.querySelector('#drop-zone');

        /**
         * Carica la lista dei file dal Bucket di Appwrite
         */
        const loadFiles = async () => {
            try {
                const res = await storage.listFiles(BUCKET_ID);
                
                if (res.files.length === 0) {
                    assetsGrid.innerHTML = `
                        <div style="grid-column: 1/-1; text-align:center; padding:40px; opacity:0.4;">
                            <p>Il tuo zaino è vuoto. Carica qualcosa per iniziare!</p>
                        </div>
                    `;
                    return;
                }

                assetsGrid.innerHTML = res.files.map(file => {
                    // Genera anteprima ottimizzata
                    const url = storage.getFilePreview(BUCKET_ID, file.$id, 300, 300);
                    return `
                        <div class="glass-box" style="padding:6px; position:relative; aspect-ratio:1/1; animation: fadeIn 0.5s ease-out;">
                            <img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;" alt="Asset" />
                            <button class="delete-file" data-id="${file.$id}" style="position:absolute; top:8px; right:8px; background:#ff4444; border:none; color:white; border-radius:50%; width:24px; height:24px; cursor:pointer; font-weight:bold; font-size:12px; display:flex; align-items:center; justify-content:center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">✕</button>
                        </div>
                    `;
                }).join('');

                // Listener per eliminazione
                container.querySelectorAll('.delete-file').forEach(btn => {
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        if (confirm("Vuoi rimuovere permanentemente questo asset dallo zaino?")) {
                            await storage.deleteFile(BUCKET_ID, btn.dataset.id);
                            loadFiles();
                        }
                    };
                });

            } catch (err) {
                console.error("Errore recupero file:", err);
                assetsGrid.innerHTML = `<p style="color:#ff4444; text-align:center;">Errore di connessione allo Storage.</p>`;
            }
        };

        // Gestione Upload
        dropZone.onclick = () => fileInput.click();
        
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                dropZone.innerHTML = `<p style="color:var(--accent); font-weight:bold;">INCANTANDO IL FILE...</p>`;
                await storage.createFile(BUCKET_ID, 'unique()', file);
                
                // Reset grafico dell'area upload
                dropZone.innerHTML = `
                    <div style="font-size:3rem; margin-bottom:10px;">✅</div>
                    <p style="font-weight:bold; color:#00ff88;">OGGETTO AGGIUNTO!</p>
                `;
                
                setTimeout(() => {
                    dropZone.innerHTML = `
                        <div style="font-size:3rem; margin-bottom:10px;">🎒</div>
                        <p style="font-weight:bold; margin:0;">CLICCA PER AGGIUNGERE ALTRO</p>
                    `;
                }, 2000);

                loadFiles();
            } catch (err) {
                console.error("Errore upload:", err);
                alert("Errore durante il caricamento: " + err.message);
                dropZone.innerHTML = `<p style="color:#ff4444;">ERRORE CARICAMENTO</p>`;
            }
        };

        // Torna alla Dashboard (Ricarica per sicurezza)
        container.querySelector('#assetsBack').onclick = () => {
            window.location.reload();
        };

        // Caricamento iniziale
        loadFiles();

    } catch (err) {
        console.error("Errore sessione utente:", err);
        window.location.reload();
    }
}
