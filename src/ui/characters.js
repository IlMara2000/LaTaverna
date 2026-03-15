import { databases, account } from '../services/appwrite.js';

const DB_ID = '69a867cc0018c0a6d700';
const COL_CHAR = 'characters';

export async function showCharacters(container) {
    const user = await account.get();
    
    container.innerHTML = `
        <div class="dashboard-content" style="padding-top:40px;">
            <button id="charBack" class="sidebar-btn" style="width:auto; margin-bottom:20px;">⬅ TORNA</button>
            <h2 style="margin-bottom:20px; letter-spacing:2px;">I TUOI EROI</h2>
            
            <div id="char-list" class="sessions-grid" style="display:grid; gap:15px;">
                </div>

            <button id="openCreateChar" class="btn-primary" style="margin-top:30px;">+ NUOVO PERSONAGGIO</button>
        </div>

        <div id="char-overlay" class="overlay">
            <div class="glass-box">
                <h3 style="margin-bottom:20px; text-align:center;">NUOVA SCHEDA</h3>
                <input type="text" id="charName" placeholder="Nome Eroe" required />
                <input type="text" id="charClass" placeholder="Classe (es. Guerriero)" required />
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <input type="number" id="charHP" placeholder="HP Max" style="width:50%" />
                    <input type="number" id="charLevel" placeholder="Livello" style="width:50%" />
                </div>
                <button class="btn-primary" id="saveChar" style="margin-top:20px;">FORGIA PERSONAGGIO</button>
                <button class="sidebar-btn" id="closeChar" style="background:transparent; text-align:center;">ANNULLA</button>
            </div>
        </div>
    `;

    const charList = container.querySelector('#char-list');
    const overlay = container.querySelector('#char-overlay');

    // Funzione per caricare i personaggi dal DB
    const loadChars = async () => {
        try {
            const res = await databases.listDocuments(DB_ID, COL_CHAR, [
                `equal("user_id", "${user.$id}")`
            ]);
            
            if (res.documents.length === 0) {
                charList.innerHTML = `<p style="opacity:0.5; text-align:center;">Non hai ancora eroi. Forgiane uno!</p>`;
                return;
            }

            charList.innerHTML = res.documents.map(c => `
                <div class="glass-box" style="padding:15px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h4 style="color:var(--accent); font-weight:900;">${c.name.toUpperCase()}</h4>
                        <p style="font-size:12px; opacity:0.7;">${c.class} • Liv. ${c.level}</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:#00ff88; font-weight:bold;">${c.hp}/${c.hp_max} HP</span>
                    </div>
                </div>
            `).join('');
        } catch (err) { console.error(err); }
    };

    // Eventi
    container.querySelector('#charBack').onclick = async () => {
        const { showDashboard } = await import('./dashboard.js');
        showDashboard(container);
    };

    container.querySelector('#openCreateChar').onclick = () => overlay.style.display = 'flex';
    container.querySelector('#closeChar').onclick = () => overlay.style.display = 'none';

    container.querySelector('#saveChar').onclick = async () => {
        const name = document.getElementById('charName').value;
        const className = document.getElementById('charClass').value;
        const hp = parseInt(document.getElementById('charHP').value) || 10;
        const lvl = parseInt(document.getElementById('charLevel').value) || 1;

        if(!name || !className) return alert("Inserisci Nome e Classe!");

        try {
            await databases.createDocument(DB_ID, COL_CHAR, 'unique()', {
                name,
                class: className,
                hp: hp,
                hp_max: hp,
                level: lvl,
                user_id: user.$id
            });
            overlay.style.display = 'none';
            loadChars();
        } catch (err) { alert(err.message); }
    };

    loadChars();
}
