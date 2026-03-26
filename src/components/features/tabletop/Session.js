// CORRETTO: 3 livelli per uscire da tabletop -> features -> components
import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';
import { showTabletop } from './Map.js';

const tables = SUPABASE_CONFIG?.tables || { maps: 'maps', chat: 'chat' };

export async function showSession(container, sessionId) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        window.location.reload();
        return;
    }
    const currentUserName = user.user_metadata?.full_name || user.email.split('@')[0];

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

    container.innerHTML = `
        <div class="session-container" style="display: flex; height: 100vh; width: 100vw; overflow: hidden; background: #05020a; position: fixed; inset: 0;">
            <aside id="side-zaino" class="glass-box" style="width: 0; padding: 0; overflow: hidden; transition: 0.4s; border-radius: 0; position: relative; z-index: 100;">
                <div style="padding: 20px; width: 250px;">
                    <h2 style="font-size: 14px; margin-bottom: 20px; color: var(--amethyst-bright);">ZAINO RAPIDO</h2>
                    <div id="quick-assets" style="display: grid; gap: 10px;"></div>
                </div>
            </aside>

            <main style="flex-grow: 1; position: relative; overflow: hidden;">
                <div id="tabletop-container" style="width: 100%; height: 100%;"></div>
                
                <div style="position: absolute; top: 20px; left: 20px; right: 20px; display: flex; justify-content: space-between; align-items: center; z-index: 50; pointer-events: none;">
                    <button id="exitSession" class="sidebar-btn" style="pointer-events: auto; width: auto; background: rgba(15,6,23,0.8);">❮ ESCI</button>
                    <div class="glass-box" style="padding: 8px 20px; border-radius: 100px; pointer-events: auto;">
                        <span style="font-size: 12px; font-weight: 900; letter-spacing: 1px;">${sessionData.name}</span>
                    </div>
                    <button id="toggleZaino" class="sidebar-btn" style="pointer-events: auto; width: auto; background: rgba(15,6,23,0.8);">🎒</button>
                </div>

                <div class="dice-bar glass-box" style="position: absolute; bottom: 20px; left: 20px; display: flex; gap: 10px; padding: 10px; z-index: 50; pointer-events: auto;">
                    <button class="roll-btn" data-dice="20">d20</button>
                    <button class="roll-btn" data-dice="6">d6</button>
                    <button class="roll-btn" data-dice="100">d%</button>
                </div>
            </main>

            <section id="chat-section" class="glass-box" style="width: 300px; border-radius: 0; display: flex; flex-direction: column; background: rgba(5,2,10,0.6);">
                <div id="chat-msgs" style="flex-grow: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px;"></div>
                <div style="padding: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <input type="text" id="chat-input" placeholder="Scrivi un messaggio..." class="auth-input" style="width: 100%; font-size: 13px;">
                </div>
            </section>
        </div>
    `;

    const tabletopDiv = container.querySelector('#tabletop-container');
    showTabletop(tabletopDiv, sessionId);

    const chatMsgs = container.querySelector('#chat-msgs');
    const chatInput = container.querySelector('#chat-input');

    const sendMsg = async (text, isRoll = false) => {
        if (!text.trim()) return;
        await supabase.from(tables.chat).insert([{
            session_id: sessionId,
            sender_id: user.id,
            sender_name: currentUserName,
            message: text,
            is_roll: isRoll
        }]);
    };

    chatInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            sendMsg(chatInput.value);
            chatInput.value = '';
        }
    };

    container.querySelectorAll('.roll-btn').forEach(btn => {
        btn.onclick = () => {
            const faces = btn.getAttribute('data-dice');
            const result = Math.floor(Math.random() * faces) + 1;
            sendMsg(`Ha tirato un d${faces}: **${result}**`, true);
        };
    });

    function renderMessage(doc) {
        const div = document.createElement('div');
        div.style.background = doc.is_roll ? 'rgba(157, 78, 221, 0.2)' : 'rgba(255,255,255,0.05)';
        div.style.padding = '10px 12px'; 
        div.style.borderRadius = '12px'; 
        div.style.fontSize = '13px';
        div.innerHTML = `
            <strong style="color: ${doc.sender_name === currentUserName ? 'var(--amethyst-bright)' : '#fff'}; font-size:11px; text-transform:uppercase;">${doc.sender_name}</strong>
            <div style="margin-top:4px;">${doc.message}</div>
        `;
        chatMsgs.appendChild(div);
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
    }

    const { data: oldMsgs } = await supabase
        .from(tables.chat)
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(50);
    if (oldMsgs) oldMsgs.forEach(renderMessage);

    supabase.channel(`chat-${sessionId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: tables.chat, filter: `session_id=eq.${sessionId}` }, 
        payload => renderMessage(payload.new))
        .subscribe();

    const sideZaino = container.querySelector('#side-zaino');
    container.querySelector('#toggleZaino').onclick = () => {
        sideZaino.style.width = sideZaino.style.width === '0px' ? '250px' : '0px';
    };

    container.querySelector('#exitSession').onclick = () => window.location.reload();
}