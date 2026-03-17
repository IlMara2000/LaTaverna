
import { databases, account, APPWRITE_CONFIG, ID } from '../services/appwrite.js';

const DB_ID = APPWRITE_CONFIG.dbId;
const COL_CHAR = APPWRITE_CONFIG.collections.characters; // Assicurati che sia definita nel tuo config

export async function showCharacters(container) {
    let user;
    try {
        user = await account.get();
    } catch (err) {
        window.location.reload();
        return;
    }
    
    container.innerHTML = `
        <div class="dashboard-content" style="padding-top:20px;">
            <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
                <h1 style="font-size: 1.8rem; font-weight: 900;">I TUOI EROI 🎭</h1>
                <button id="charBack" class="sidebar-btn" style="width:auto; margin:0; padding:8px 15px; font-size:12px;">⬅ TAVERNA</button>
            </header>

            <div id="char-list" style="display:grid; gap:12px;">
                <p style="text-align:center; opacity:0.5;">Cercando i tuoi compagni nelle ombre...</p>
            </div>

            <button id="openCreateChar" class="btn-primary" style="margin-top:25px; box-shadow: 0 0 20px rgba(169, 83, 236, 0.3);">
                + NUOVO PERSONAGGIO
            </button>
        </div>

        <div id="char-overlay" class="overlay" style="display:none; align-items:center; justify-content:center;">
            <div class="glass-box" style="width:90%; max-width:350px; padding:25px;">
                <h3 style="margin-bottom:20px; font-weight:900;">NUOVA SCHEDA</h3>
                <div style="display:flex; flex-direction:column; gap:15px;">
                    <input type="text" id="charName" placeholder="Nome dell'Eroe" class="auth-input">
                    <input type="text" id="charClass" placeholder="Classe (Guerriero, Mago...)" class="auth-input">
                    
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        <button class="btn-primary" id="saveChar" style="flex:2;">SALVA</button>
                        <button class="sidebar-btn" id="closeChar" style="flex:1; background:rgba(255,255,255,0.1); margin:0;">X</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const charList = container.querySelector('#char-list');
    const overlay = container.querySelector('#char-overlay');

    const loadChars = async () => {
        try {
            // Se non hai ancora impostato gli indici su Appwrite, listDocuments potrebbe dare errore con le query.
            // Per ora prendiamo tutto e filtriamo in locale per sicurezza, o usiamo la query se gli indici sono pronti.
            const res = await databases.listDocuments(DB_ID, COL_CHAR);
            const myChars = res.documents.filter(c => c.user_id === user.$id);

            if (myChars.length === 0) {
                charList.innerHTML = `
                    <div class="glass-box" style="padding:30px; text-align:center; opacity:0.6;">
                        <p>Nessun eroe ha ancora risposto alla tua chiamata.</p>
                    </div>`;
                return;
            }

            charList.innerHTML = myChars.map(c => `
                <div class="glass-box" style="padding:15px; display:flex; justify-content:space-between; align-items:center; border-left: 4px solid var(--accent);">
                    <div>
                        <div style="font-weight:900; font-size:1.1rem; color:var(--accent);">${c.name.toUpperCase()}</div>
                        <div style="font-size:12px; opacity:0.7; letter-spacing:1px;">Lvl ${c.level || 1} - ${c.class}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:10px; opacity:0.5;">HP</div>
                        <div style="font-weight:bold;">${c.hp}/${c.hp_max}</div>
                    </div>
                </div>
            `).join('');
        } catch (err) { 
            console.error("Errore caricamento personaggi:", err);
            charList.innerHTML = `<p style="color:#ff4444; text-align:center;">Errore nel recupero degli eroi.</p>`;
        }
    };

    // Eventi
    container.querySelector('#charBack').onclick = () => window.location.reload();
    container.querySelector('#openCreateChar').onclick = () => overlay.style.display = 'flex';
    container.querySelector('#closeChar').onclick = () => overlay.style.display = 'none';

    container.querySelector('#saveChar').onclick = async () => {
        const name = document.getElementById('charName').value.trim();
        const className = document.getElementById('charClass').value.trim();

        if (!name || !className) {
            alert("Ogni eroe ha bisogno di un nome e di una classe!");
            return;
        }

        try {
            await databases.createDocument(DB_ID, COL_CHAR, ID.unique(), {
                name: name,
                class: className,
                user_id: user.$id,
                hp: 10,
                hp_max: 10,
                level: 1
            });
            overlay.style.display = 'none';
            // Pulisce i campi
            document.getElementById('charName').value = '';
            document.getElementById('charClass').value = '';
            loadChars();
        } catch (err) { 
            alert("Errore durante la creazione: " + err.message); 
        }
    };

    loadChars();
}
