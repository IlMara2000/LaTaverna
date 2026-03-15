import { databases, account } from '../services/appwrite.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_CHAR = 'characters';

export async function showCharacters(container) {
    const user = await account.get();
    
    container.innerHTML = `
        <div class="dashboard-content" style="padding-top:40px;">
            <button id="charBack" class="sidebar-btn" style="width:auto; margin-bottom:20px;">⬅ TORNA</button>
            <h2 style="margin-bottom:20px; font-weight:900;">I TUOI EROI</h2>
            <div id="char-list" style="display:grid; gap:15px;"></div>
            <button id="openCreateChar" class="btn-primary" style="margin-top:30px;">+ NUOVO PERSONAGGIO</button>
        </div>
        <div id="char-overlay" class="overlay">
            <div class="glass-box" style="width:90%; max-width:400px;">
                <h3>NUOVA SCHEDA</h3>
                <input type="text" id="charName" placeholder="Nome Eroe" style="width:100%; margin-top:10px;">
                <input type="text" id="charClass" placeholder="Classe" style="width:100%; margin-top:10px;">
                <button class="btn-primary" id="saveChar" style="margin-top:20px;">SALVA</button>
                <button class="sidebar-btn" id="closeChar" style="background:transparent;">ANNULLA</button>
            </div>
        </div>
    `;

    const charList = container.querySelector('#char-list');
    const overlay = container.querySelector('#char-overlay');

    const loadChars = async () => {
        try {
            const res = await databases.listDocuments(DB_ID, COL_CHAR, [`equal("user_id", "${user.$id}")`]);
            charList.innerHTML = res.documents.map(c => `
                <div class="glass-box" style="padding:15px; display:flex; justify-content:space-between;">
                    <div><strong>${c.name}</strong><br><small>${c.class}</small></div>
                </div>
            `).join('');
        } catch (err) { console.error(err); }
    };

    container.querySelector('#charBack').onclick = () => window.location.reload();
    container.querySelector('#openCreateChar').onclick = () => overlay.style.display = 'flex';
    container.querySelector('#closeChar').onclick = () => overlay.style.display = 'none';

    container.querySelector('#saveChar').onclick = async () => {
        const name = document.getElementById('charName').value;
        const className = document.getElementById('charClass').value;
        try {
            await databases.createDocument(DB_ID, COL_CHAR, 'unique()', {
                name, class: className, user_id: user.$id, hp: 10, hp_max: 10, level: 1
            });
            overlay.style.display = 'none';
            loadChars();
        } catch (err) { alert(err.message); }
    };

    loadChars();
}
