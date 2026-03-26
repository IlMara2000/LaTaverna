// CORREZIONE CRITICA: 3 livelli di risalita per trovare services/
import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';

const { tables } = SUPABASE_CONFIG;

export async function showCharacters(container) {
    // 1. RECUPERO UTENTE CORRENTE
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        console.error("Utente non autenticato");
        // Invece di reload, mostriamo un messaggio amichevole nel container
        container.innerHTML = `<p style="text-align:center; padding:50px; opacity:0.5;">Sessione scaduta. Effettua di nuovo l'accesso.</p>`;
        return;
    }

    // 2. RENDER STRUTTURA BASE
    container.innerHTML = `
        <div class="dashboard-content" style="display: flex; flex-direction: column; align-items: center; width: 100%; height: 100vh; overflow-y: auto; padding-top: 60px;">
            <div style="width: 100%; max-width: 400px; padding: 0 20px; display: flex; flex-direction: column; gap: 30px; padding-bottom: 80px;">
                
                <header style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h1 style="font-size: 1.8rem; font-weight: 900; margin:0; line-height:1;">I TUOI EROI 🎭</h1>
                        <p style="font-size: 10px; opacity: 0.5; margin:5px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Gestione Personaggi</p>
                    </div>
                    <button id="charBack" class="sidebar-btn" style="width:auto; margin:0; padding:8px 15px; font-size:12px; border-radius:100px;">INDIETRO</button>
                </header>

                <div id="charList" style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                    </div>

                <button id="openCreateChar" class="btn-primary" style="width: 100%; margin-top: 10px; padding: 18px; border-radius: 14px; font-weight:800;">
                    ✨ NUOVO EROE
                </button>
            </div>
        </div>

        <div id="char-modal" style="display:none; position:fixed; inset:0; background:rgba(5,2,10,0.85); backdrop-filter:blur(15px); z-index:2000; align-items:center; justify-content:center; padding:20px;">
            <div class="glass-box" style="width:100%; max-width:350px; padding:30px; border-radius:24px;">
                <h2 style="margin-bottom:10px; text-align:center; font-weight:900;">CREA EROE</h2>
                <p style="text-align:center; opacity:0.6; font-size:12px; margin-bottom:20px;">Evoca un nuovo compagno d'avventure.</p>
                <form id="createCharForm">
                    <input type="text" id="charName" placeholder="Nome dell'Eroe" class="auth-input" required style="margin-bottom:15px; width:100%; padding:15px; border-radius:12px;">
                    <input type="text" id="charClass" placeholder="Classe (es. Guerriero, Mago...)" class="auth-input" required style="margin-bottom:20px; width:100%; padding:15px; border-radius:12px;">
                    <button type="submit" class="btn-primary" style="width:100%; padding:15px; border-radius:12px;">EVOCA NELLA TAVERNA</button>
                    <button type="button" id="closeChar" style="margin-top:15px; width:100%; background:transparent; border:none; color:white; opacity:0.5; cursor:pointer; font-size:12px;">ANNULLA</button>
                </form>
            </div>
        </div>
    `;

    const charList = container.querySelector('#charList');
    const overlay = container.querySelector('#char-modal');
    const form = container.querySelector('#createCharForm');

    // 3. LOGICA CARICAMENTO
    const loadChars = async () => {
        charList.innerHTML = `<p style="text-align:center; opacity:0.5; font-size:12px; padding:20px;">Consultando i registri degli eroi... 📜</p>`;
        
        try {
            const { data, error } = await supabase
                .from(tables.characters)
                .select('*')
                .eq('user_id', user.id) 
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                charList.innerHTML = `
                    <div style="text-align:center; opacity:0.4; padding:40px; border:1px dashed rgba(255,255,255,0.2); border-radius:20px;">
                        <p style="font-size:12px; margin:0;">Nessun eroe ancora evocato.<br>Il tuo cammino inizia qui.</p>
                    </div>`;
                return;
            }

            charList.innerHTML = data.map(c => {
                // Semplice logica per l'icona basata sulla classe
                const icon = c.class.toLowerCase().includes('mago') || c.class.toLowerCase().includes('stregone') ? '🧙‍♂️' : '⚔️';
                
                return `
                    <div class="glass-box" style="padding: 18px; display: flex; align-items: center; gap: 15px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="width: 50px; height: 50px; border-radius: 15px; background: rgba(157, 78, 221, 0.2); display: flex; align-items: center; justify-content: center; font-size: 24px; border: 1px solid var(--amethyst-bright);">
                            ${icon}
                        </div>
                        <div style="flex-grow: 1;">
                            <h3 style="margin:0; font-size: 1.1rem; font-weight:700;">${c.name}</h3>
                            <p style="margin:2px 0 0 0; font-size: 10px; opacity: 0.5; text-transform: uppercase; letter-spacing:1px;">${c.class} • LV ${c.level || 1}</p>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 9px; opacity: 0.4; display:block; text-transform:uppercase;">Salute</span>
                            <div style="font-weight:900; font-size:1.2rem; color: #ff4d4d;">${c.hp || 10}<span style="font-size:10px; opacity:0.4; color:white;">/${c.hp_max || 10}</span></div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error("Errore loadChars:", err);
            charList.innerHTML = `<p style="color:var(--error-red); font-size:12px; text-align:center;">Il rito di evocazione è fallito. Riprova.</p>`;
        }
    };

    // 4. EVENTI
    loadChars();

    container.querySelector('#charBack').onclick = () => window.location.reload();
    container.querySelector('#openCreateChar').onclick = () => { overlay.style.display = 'flex'; };
    container.querySelector('#closeChar').onclick = () => { overlay.style.display = 'none'; };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = container.querySelector('#charName').value.trim();
        const className = container.querySelector('#charClass').value.trim();

        if (!name || !className) return;

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