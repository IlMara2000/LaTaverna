import { supabase, SUPABASE_CONFIG } from '../../services/supabase.js';

const { tables } = SUPABASE_CONFIG;

export async function showCharacters(container) {
    // 1. RECUPERO UTENTE CORRENTE
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        console.error("Utente non autenticato");
        return;
    }

    // 2. RENDER STRUTTURA BASE
    container.innerHTML = `
        <div class="dashboard-content" style="display: flex; flex-direction: column; align-items: center; width: 100%; height: 100vh; overflow-y: auto; padding-top: 40px;">
            <div style="width: 100%; max-width: 400px; padding: 0 20px; display: flex; flex-direction: column; gap: 30px; padding-bottom: 80px;">
                
                <header style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h1 style="font-size: 1.8rem; font-weight: 900; margin:0;">I TUOI EROI 🎭</h1>
                        <p style="font-size: 10px; opacity: 0.5; margin:0; text-transform: uppercase; letter-spacing: 1px;">Gestione Personaggi</p>
                    </div>
                    <button id="charBack" class="sidebar-btn" style="width:auto; margin:0; padding:8px 15px; font-size:12px; border-radius:100px;">INDIETRO</button>
                </header>

                <div id="charList" style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                    </div>

                <button id="openCreateChar" class="btn-primary" style="width: 100%; margin-top: 10px;">
                    ✨ NUOVO EROE
                </button>
            </div>
        </div>

        <div id="char-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.85); backdrop-filter:blur(15px); z-index:2000; align-items:center; justify-content:center; padding:20px;">
            <div class="glass-box" style="width:100%; max-width:350px;">
                <h2 style="margin-bottom:20px; text-align:center;">Crea Eroe</h2>
                <form id="createCharForm">
                    <input type="text" id="charName" placeholder="Nome dell'Eroe" class="auth-input" required style="margin-bottom:15px; width:100%;">
                    <input type="text" id="charClass" placeholder="Classe (es. Guerriero)" class="auth-input" required style="margin-bottom:20px; width:100%;">
                    <button type="submit" class="btn-primary" style="width:100%;">EVOCA NELLA TAVERNA</button>
                    <button type="button" id="closeChar" class="sidebar-btn" style="margin-top:10px; width:100%; justify-content:center; border:none; background:transparent; opacity:0.6;">CHIUDI</button>
                </form>
            </div>
        </div>
    `;

    const charList = container.querySelector('#charList');
    const overlay = container.querySelector('#char-modal');
    const form = container.querySelector('#createCharForm');

    // 3. LOGICA CARICAMENTO
    const loadChars = async () => {
        charList.innerHTML = `<p style="text-align:center; opacity:0.5; font-size:12px;">Lettura delle pergamene...</p>`;
        
        try {
            const { data, error } = await supabase
                .from(tables.characters)
                .select('*')
                .eq('user_id', user.id) // Filtra solo i personaggi di questo utente
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                charList.innerHTML = `<p style="text-align:center; opacity:0.4; padding:20px; border:1px dashed var(--glass-border); border-radius:15px;">Nessun eroe ancora evocato. Creane uno!</p>`;
                return;
            }

            charList.innerHTML = data.map(c => `
                <div class="glass-box" style="padding: 15px; display: flex; align-items: center; gap: 15px; border-radius: 20px;">
                    <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--amethyst); display: flex; align-items: center; justify-content: center; font-size: 20px;">
                        ${c.class.includes('Mago') ? '🧙‍♂️' : '⚔️'}
                    </div>
                    <div style="flex-grow: 1;">
                        <h3 style="margin:0; font-size: 1rem;">${c.name}</h3>
                        <p style="margin:0; font-size: 10px; opacity: 0.5; text-transform: uppercase;">${c.class} • LV ${c.level || 1}</p>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 9px; opacity: 0.4; display:block;">Punti Vita</span>
                        <div style="font-weight:900; font-size:1.2rem;">${c.hp || 10}<span style="font-size:10px; opacity:0.4;">/${c.hp_max || 10}</span></div>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error("Errore loadChars:", err);
            charList.innerHTML = `<p style="color:var(--error-red); font-size:10px; text-align:center;">Errore nel rito di evocazione.</p>`;
        }
    };

    // 4. EVENTI
    loadChars();

    container.querySelector('#charBack').onclick = () => window.location.reload();
    container.querySelector('#openCreateChar').onclick = () => overlay.style.display = 'flex';
    container.querySelector('#closeChar').onclick = () => overlay.style.display = 'none';

    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = container.querySelector('#charName').value.trim();
        const className = container.querySelector('#charClass').value.trim();

        try {
            const { error } = await supabase
                .from(tables.characters)
                .insert([{ 
                    name, 
                    class: className, 
                    user_id: user.id,
                    hp: 10,
                    hp_max: 10,
                    level: 1
                }]);

            if (error) throw error;

            overlay.style.display = 'none';
            form.reset();
            loadChars();
        } catch (err) {
            alert("Errore creazione: " + err.message);
        }
    };
}