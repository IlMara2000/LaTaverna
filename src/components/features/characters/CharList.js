// CORREZIONE CRITICA: 3 livelli di risalita per trovare services/
import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';

const { tables } = SUPABASE_CONFIG;

export async function initCharacters(container) {
    // 1. RECUPERO UTENTE CORRENTE
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Assicuriamoci che lo scroll sia sbloccato per scorrere la lista degli eroi
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto'; 
    document.body.style.touchAction = 'pan-y';
    document.body.style.backgroundColor = '#05010a';
    window.scrollTo(0, 0);
    
    if (authError || !user) {
        console.error("Utente non autenticato");
        container.innerHTML = `
            <div class="fade-in" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; padding: 20px; text-align: center;">
                <h1 style="font-size: 3rem; filter: drop-shadow(0 0 20px rgba(255,65,108,0.5)); margin-bottom: 10px;">💀</h1>
                <h2 class="main-title" style="font-size: 1.8rem; background: none; -webkit-text-fill-color: #ff416c;">ACCESSO NEGATO</h2>
                <p style="opacity:0.5; font-size: 13px; margin-bottom: 30px;">Sessione magica scaduta. Effettua di nuovo l'accesso alla Taverna.</p>
                <button class="btn-back-glass" onclick="location.reload()">RITORNA ALLA RECEPTION</button>
            </div>`;
        return;
    }

    // 2. RENDER STRUTTURA BASE (PREMIUM UI)
    container.innerHTML = `
        <div class="fade-in" style="display: flex; flex-direction: column; align-items: center; width: 100%; min-height: 100vh; padding-top: 40px; box-sizing: border-box; font-family: 'Poppins', sans-serif; color: white;">
            <div style="width: 100%; max-width: 500px; padding: 0 20px; display: flex; flex-direction: column; gap: 25px; padding-bottom: 80px; box-sizing: border-box;">
                
                <header style="display:flex; justify-content:space-between; align-items:center; background: var(--glass-surface); padding: 20px; border-radius: 20px; border: 1px solid var(--glass-border); box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                    <div>
                        <h1 class="main-title" style="font-size: 1.8rem; margin:0; line-height:1; text-align: left;">I TUOI EROI</h1>
                        <p style="font-size: 11px; opacity: 0.5; margin:5px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Gestione Personaggi</p>
                    </div>
                    <button id="charBack" class="btn-back-glass" style="width:auto; margin:0; padding:10px 15px; font-size:11px; border-left:none;">← INDIETRO</button>
                </header>

                <div id="charList" style="display: grid; grid-template-columns: 1fr; gap: 15px;">
                    </div>

                <button id="openCreateChar" class="btn-primary" style="width: 100%; padding: 18px; border-radius: 16px; font-weight:800; font-size: 1.1rem; box-shadow: 0 5px 20px rgba(157, 78, 221, 0.4);">
                    ✨ NUOVO EROE
                </button>
            </div>
        </div>

        <div id="char-modal" style="display:none; position:fixed; inset:0; background:rgba(5,2,10,0.85); backdrop-filter:blur(15px); z-index:2000; align-items:center; justify-content:center; padding:20px; box-sizing: border-box;">
            <div style="width:100%; max-width:380px; background: var(--glass-surface); border: 1px solid var(--glass-border); padding:30px; border-radius:24px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: fadeInUp 0.3s ease-out;">
                <h2 class="main-title" style="margin-bottom:5px; text-align:center; font-size: 2rem;">CREA EROE</h2>
                <p style="text-align:center; opacity:0.6; font-size:12px; margin-bottom:25px; letter-spacing: 1px;">Evoca un nuovo compagno d'avventure.</p>
                
                <form id="createCharForm" style="display: flex; flex-direction: column; gap: 15px;">
                    <input type="text" id="charName" placeholder="Nome dell'Eroe" required style="width:100%; padding:15px; border-radius:14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.5); color: white; outline: none; font-size: 14px; font-family: 'Poppins', sans-serif; box-sizing: border-box;">
                    <input type="text" id="charClass" placeholder="Classe (es. Guerriero, Mago...)" required style="width:100%; padding:15px; border-radius:14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.5); color: white; outline: none; font-size: 14px; font-family: 'Poppins', sans-serif; box-sizing: border-box;">
                    
                    <button type="submit" id="submitCharBtn" class="btn-primary" style="width:100%; padding:16px; border-radius:14px; font-size: 1rem; margin-top: 10px; margin-bottom: 0;">EVOCA NELLA TAVERNA</button>
                    <button type="button" id="closeChar" class="btn-back-glass" style="width:100%; border: none; background: transparent; box-shadow: none; color: rgba(255,255,255,0.5); padding: 10px;">ANNULLA</button>
                </form>
            </div>
        </div>
    `;

    const charList = container.querySelector('#charList');
    const overlay = container.querySelector('#char-modal');
    const form = container.querySelector('#createCharForm');
    const submitBtn = container.querySelector('#submitCharBtn');

    // 3. LOGICA CARICAMENTO
    const loadChars = async () => {
        charList.innerHTML = `<p style="text-align:center; opacity:0.5; font-size:12px; padding:30px; animation: pulse 1.5s infinite alternate;">Consultando i registri degli eroi... 📜</p>`;
        
        try {
            const { data, error } = await supabase
                .from(tables.characters)
                .select('*')
                .eq('user_id', user.id) 
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                charList.innerHTML = `
                    <div style="text-align:center; opacity:0.6; padding:40px 20px; border: 1px dashed rgba(157,78,221,0.3); border-radius:20px; background: rgba(157,78,221,0.05);">
                        <p style="font-size:14px; margin:0; font-weight: 700; color: var(--amethyst-bright);">Nessun eroe evocato.</p>
                        <p style="font-size:12px; margin:5px 0 0 0;">Il tuo cammino inizia qui, premi il bottone in basso.</p>
                    </div>`;
                return;
            }

            charList.innerHTML = data.map(c => {
                // Logica visiva basata sulla classe
                const isMagic = c.class.toLowerCase().includes('mago') || c.class.toLowerCase().includes('stregone') || c.class.toLowerCase().includes('chierico') || c.class.toLowerCase().includes('druido');
                const icon = isMagic ? '🧙‍♂️' : '⚔️';
                const colorTheme = isMagic ? 'var(--amethyst-bright)' : '#ff416c';
                
                return `
                    <div style="background: var(--glass-surface); padding: 20px; display: flex; align-items: center; gap: 15px; border-radius: 20px; border: 1px solid var(--glass-border); box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: 0.2s; cursor: pointer;">
                        <div style="width: 55px; height: 55px; border-radius: 16px; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 26px; border: 1px solid ${colorTheme}; box-shadow: inset 0 0 15px ${colorTheme}30;">
                            ${icon}
                        </div>
                        <div style="flex-grow: 1;">
                            <h3 style="margin:0; font-size: 1.2rem; font-weight:800; color: white;">${c.name}</h3>
                            <p style="margin:4px 0 0 0; font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing:1px; color: ${colorTheme}; font-weight: 700;">${c.class} • LV ${c.level || 1}</p>
                        </div>
                        <div style="text-align: right; background: rgba(255,65,108,0.1); padding: 8px 12px; border-radius: 12px; border: 1px solid rgba(255,65,108,0.2);">
                            <span style="font-size: 9px; color: #ff416c; display:block; text-transform:uppercase; font-weight: 900; letter-spacing: 1px;">HP</span>
                            <div style="font-weight:900; font-size:1.1rem; color: white;">${c.hp || 10}<span style="font-size:11px; opacity:0.5;">/${c.hp_max || 10}</span></div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error("Errore loadChars:", err);
            charList.innerHTML = `<p style="color:var(--danger); font-size:13px; font-weight: 800; text-align:center; padding: 20px;">Il rito di evocazione è fallito. Riprova più tardi.</p>`;
        }
    };

    // 4. EVENTI
    loadChars();

    // Ricaricando la pagina si torna in automatico alla lobby/dashboard base
    container.querySelector('#charBack').onclick = () => window.location.reload();
    
    container.querySelector('#openCreateChar').onclick = () => { overlay.style.display = 'flex'; };
    container.querySelector('#closeChar').onclick = () => { overlay.style.display = 'none'; };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = container.querySelector('#charName').value.trim();
        const className = container.querySelector('#charClass').value.trim();

        if (!name || !className) return;
        
        // UX: Disabilita il bottone durante il caricamento
        submitBtn.disabled = true;
        submitBtn.innerHTML = "EVOCAZIONE IN CORSO... ⏳";
        submitBtn.style.opacity = "0.7";

        try {
            // FIX: Inseriamo SOLO i campi che siamo sicuri esistano nel DB attuale per evitare crash!
            const { error } = await supabase
                .from(tables.characters)
                .insert([{ 
                    name: name, 
                    class: className, 
                    user_id: user.id
                }]);

            if (error) throw error;

            overlay.style.display = 'none';
            form.reset();
            loadChars();
        } catch (err) {
            alert("Errore durante l'evocazione: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "EVOCA NELLA TAVERNA";
            submitBtn.style.opacity = "1";
        }
    };
}
