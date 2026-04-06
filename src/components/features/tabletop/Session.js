// CORRETTO: 3 livelli per uscire da tabletop -> features -> components
import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';
import { showTabletop } from './Map.js';

const tables = SUPABASE_CONFIG?.tables || { maps: 'maps', chat: 'chat' };

export async function showSession(container, sessionId) {
    // 1. AUTENTICAZIONE
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        window.location.reload();
        return;
    }
    const currentUserName = user.user_metadata?.full_name || user.email.split('@')[0];

    // 2. RECUPERO DATI SESSIONE
    let sessionData = { name: "Tavolo Live" };
    try {
        const { data } = await supabase
            .from(tables.maps)
            .select('name')
            .eq('session_id', sessionId)
            .single();
        if (data) sessionData = data;
    } catch (e) { 
        console.log("Errore recupero titolo sessione."); 
    }

    // 3. RENDER STRUTTURA (Premium UI Amethyst)
    container.innerHTML = `
        <style>
            .session-wrapper {
                display: flex; height: 100vh; width: 100vw; overflow: hidden; 
                background: #05010a; position: fixed; inset: 0;
                font-family: 'Poppins', sans-serif; color: white;
            }
            
            .glass-panel {
                background: rgba(5, 2, 10, 0.7);
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                border: 1px solid rgba(255,255,255,0.05);
            }
            
            .sidebar-btn {
                background: var(--glass-surface); border: 1px solid var(--glass-border);
                color: white; padding: 10px 20px; border-radius: 100px; font-weight: 800; font-size: 11px;
                cursor: pointer; outline: none; transition: 0.2s; backdrop-filter: blur(10px);
            }
            .sidebar-btn:active { transform: scale(0.95); background: rgba(157, 78, 221, 0.2); border-color: var(--amethyst-bright); }
            
            .roll-btn {
                background: linear-gradient(135deg, #9d4ede, #c77dff);
                border: none; color: black; font-weight: 900; padding: 12px 16px; border-radius: 14px;
                cursor: pointer; transition: 0.2s; box-shadow: 0 4px 15px rgba(157,78,221,0.4); font-size: 13px;
            }
            .roll-btn:active { transform: scale(0.90); }
            
            /* Animazione e gestione Zaino Fluida */
            #side-zaino {
                width: 0; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow-x: hidden; white-space: nowrap;
                border-right: 1px solid rgba(157, 78, 221, 0.2);
            }
            #side-zaino.open { width: 280px; }
            
            .chat-message {
                padding: 12px; border-radius: 14px; font-size: 13px; line-height: 1.4;
                animation: fadeInUp 0.3s ease-out; margin-bottom: 10px; word-break: break-word;
            }
            .chat-message.roll { background: rgba(157, 78, 221, 0.15); border: 1px solid rgba(157, 78, 221, 0.3); }
            .chat-message.normal { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); }
            
            /* Custom Scrollbar per la chat */
            #chat-msgs::-webkit-scrollbar { width: 6px; }
            #chat-msgs::-webkit-scrollbar-thumb { background: rgba(157, 78, 221, 0.3); border-radius: 10px; }
        </style>

        <div class="session-wrapper fade-in">
            
            <aside id="side-zaino" class="glass-panel" style="position: relative; z-index: 100; display: flex; flex-direction: column;">
                <div style="padding: 25px; width: 280px; box-sizing: border-box;">
                    <h2 style="font-size: 16px; margin: 0 0 20px 0; color: var(--amethyst-bright); font-weight: 900; letter-spacing: 1px;">🎒 ZAINO RAPIDO</h2>
                    <div id="quick-assets" style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="padding: 15px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); text-align: center; font-size: 11px; opacity: 0.5;">
                            I tuoi token e strumenti appariranno qui...
                        </div>
                    </div>
                </div>
            </aside>

            <main style="flex-grow: 1; position: relative; overflow: hidden; display: flex; flex-direction: column;">
                
                <div id="tabletop-container" style="width: 100%; height: 100%; background: #0a0a0f;"></div>
                
                <div style="position: absolute; top: 20px; left: 20px; right: 20px; display: flex; justify-content: space-between; align-items: center; z-index: 50; pointer-events: none;">
                    <button id="exitSession" class="sidebar-btn" style="pointer-events: auto;">← ESCI</button>
                    
                    <div class="glass-panel" style="padding: 10px 25px; border-radius: 100px; pointer-events: auto; box-shadow: 0 5px 20px rgba(0,0,0,0.5);">
                        <span style="font-size: 13px; font-weight: 900; letter-spacing: 2px;">${sessionData.name.toUpperCase()}</span>
                    </div>
                    
                    <button id="toggleZaino" class="sidebar-btn" style="pointer-events: auto; font-size: 14px; padding: 10px 15px;">🎒</button>
                </div>

                <div class="glass-panel" style="position: absolute; bottom: 25px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; padding: 15px; z-index: 50; pointer-events: auto; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow-x: auto; max-width: 90vw;">
                    <button class="roll-btn" data-dice="20">d20</button>
                    <button class="roll-btn" data-dice="12">d12</button>
                    <button class="roll-btn" data-dice="10">d10</button>
                    <button class="roll-btn" data-dice="8">d8</button>
                    <button class="roll-btn" data-dice="6">d6</button>
                    <button class="roll-btn" data-dice="4">d4</button>
                    <button class="roll-btn" data-dice="100" style="background: linear-gradient(135deg, #00d2ff, #3a7bd5); color: white; box-shadow: 0 4px 15px rgba(0, 210, 255, 0.3);">d%</button>
                </div>
            </main>

            <section id="chat-section" class="glass-panel" style="width: 320px; min-width: 320px; border-left: 1px solid rgba(157, 78, 221, 0.2); display: flex; flex-direction: column; z-index: 100;">
                <div style="padding: 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 900; letter-spacing: 1px;">CHAT & LOG</h3>
                </div>
                
                <div id="chat-msgs" style="flex-grow: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column;"></div>
                
                <div style="padding: 20px; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
                    <input type="text" id="chat-input" placeholder="Scrivi al party..." style="width: 100%; padding: 15px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: white; outline: none; font-size: 13px; font-family: 'Poppins', sans-serif; box-sizing: border-box;">
                </div>
            </section>
        </div>
    `;

    // 4. INIZIALIZZAZIONE MAPPA
    const tabletopDiv = container.querySelector('#tabletop-container');
    if (typeof showTabletop === 'function') {
        showTabletop(tabletopDiv, sessionId);
    }

    // 5. LOGICA CHAT E DADI
    const chatMsgs = container.querySelector('#chat-msgs');
    const chatInput = container.querySelector('#chat-input');

    const sendMsg = async (text, isRoll = false) => {
        if (!text.trim()) return;
        try {
            await supabase.from(tables.chat).insert([{
                session_id: sessionId,
                sender_id: user.id,
                sender_name: currentUserName,
                message: text,
                is_roll: isRoll
            }]);
        } catch (err) {
            console.error("Errore invio messaggio:", err);
        }
    };

    // Invio con Invio
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMsg(chatInput.value);
            chatInput.value = '';
        }
    });

    // Gestione Lancio Dadi
    container.querySelectorAll('.roll-btn').forEach(btn => {
        btn.onclick = () => {
            const faces = parseInt(btn.getAttribute('data-dice'));
            const result = Math.floor(Math.random() * faces) + 1;
            // Uso <strong> per far risaltare il risultato in HTML
            sendMsg(`Ha tirato un d${faces}: <strong>${result}</strong>`, true);
        };
    });

    // Funzione renderizzazione visiva dei messaggi
    function renderMessage(doc) {
        const div = document.createElement('div');
        div.className = `chat-message ${doc.is_roll ? 'roll' : 'normal'}`;
        
        // Colore primario per l'utente, azzurro per gli altri
        const senderColor = doc.sender_name === currentUserName ? 'var(--amethyst-bright)' : '#00d2ff';
        
        div.innerHTML = `
            <strong style="color: ${senderColor}; font-size:11px; text-transform:uppercase; letter-spacing: 1px;">${doc.sender_name}</strong>
            <div style="margin-top:5px;">${doc.message}</div>
        `;
        chatMsgs.appendChild(div);
        
        // Auto-scroll intelligente verso il basso
        chatMsgs.scrollTo({ top: chatMsgs.scrollHeight, behavior: 'smooth' });
    }

    // Caricamento vecchi messaggi
    const loadMessages = async () => {
        try {
            const { data: oldMsgs } = await supabase
                .from(tables.chat)
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true })
                .limit(50);
            if (oldMsgs) oldMsgs.forEach(renderMessage);
        } catch (err) {
            console.error("Errore caricamento messaggi:", err);
        }
    };
    loadMessages();

    // Sottoscrizione Realtime
    const chatSubscription = supabase.channel(`chat-${sessionId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: tables.chat, filter: `session_id=eq.${sessionId}` }, 
        payload => {
            renderMessage(payload.new);
        })
        .subscribe();

    // 6. GESTIONE PULSANTI UI
    const sideZaino = container.querySelector('#side-zaino');
    
    container.querySelector('#toggleZaino').onclick = () => {
        sideZaino.classList.toggle('open');
    };

    // Pulizia e Uscita
    container.querySelector('#exitSession').onclick = () => {
        // Previene memory leaks rimuovendo il canale prima di uscire
        supabase.removeChannel(chatSubscription);
        window.location.reload();
    };
}
