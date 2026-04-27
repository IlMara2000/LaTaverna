import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';
import { showTabletop } from './Map.js';

const TABLES = {
    sessions: 'dnd_sessions',
    legacySessions: SUPABASE_CONFIG?.tables?.sessions || 'session',
    chat: 'dnd_chat',
    legacyChat: SUPABASE_CONFIG?.tables?.chat || 'chat_messages'
};

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const rollDice = (faces, count = 1, mod = 0) => {
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
    return { rolls, total: rolls.reduce((sum, value) => sum + value, 0) + mod };
};

const isMissingTableError = (error) => {
    const message = String(error?.message || '');
    return error?.code === 'PGRST205'
        || message.includes('schema cache')
        || message.includes('Could not find the table');
};

async function runWithFallback(primaryTable, fallbackTable, buildQuery) {
    const primary = await buildQuery(primaryTable);
    if (!primary.error || !isMissingTableError(primary.error)) return primary;
    return buildQuery(fallbackTable);
}

const normalizeSession = (session = {}) => {
    const data = session.data || {};
    return {
        ...session,
        status: session.status || data.status || 'attiva',
        party_level: session.party_level || data.party_level || 1,
        next_date: session.next_date || data.next_date || '',
        map_url: session.map_url || data.map_url || data.mapUrl || '',
        description: session.description || data.description || '',
        data
    };
};

export async function showSession(container, sessionId) {
    const { data: { user } } = await supabase.auth.getUser();
    const guest = localStorage.getItem('taverna_guest_user');
    const currentUser = user || (guest ? JSON.parse(guest) : { id: 'guest', user_metadata: { full_name: 'Ospite' } });
    const currentUserName = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Viandante';

    let sessionData = { id: sessionId, name: 'Tavolo Live', data: {} };
    try {
        const { data } = await runWithFallback(TABLES.sessions, TABLES.legacySessions, (tableName) => supabase
            .from(tableName)
            .select('*')
            .eq('id', sessionId)
            .single());
        if (data) sessionData = normalizeSession(data);
    } catch (err) {
        console.warn('Sessione non recuperata:', err);
    }

    const sessionState = {
        initiative: sessionData.data?.initiative || [],
        fogEnabled: sessionData.data?.fogEnabled !== false
    };

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    container.innerHTML = `
        <div class="dnd-session fade-in">
            <aside class="dnd-session-panel dnd-left-panel">
                <header>
                    <span>Sessione</span>
                    <strong>${escapeHTML(sessionData.name || 'Tavolo Live')}</strong>
                </header>

                <section class="dnd-session-block">
                    <h3>Token</h3>
                    <input id="tokenName" type="text" placeholder="Nome token">
                    <input id="tokenImg" type="text" placeholder="URL immagine">
                    <button id="addToken" class="btn-primary">AGGIUNGI TOKEN</button>
                </section>

                <section class="dnd-session-block">
                    <h3>Iniziativa</h3>
                    <div id="initiativeList" class="initiative-list"></div>
                    <div class="initiative-form">
                        <input id="initiativeName" type="text" placeholder="Nome">
                        <input id="initiativeValue" type="number" placeholder="Init">
                    </div>
                    <button id="addInitiative" class="btn-back-glass">AGGIUNGI TURNO</button>
                    <button id="nextTurn" class="btn-primary">PROSSIMO TURNO</button>
                </section>
            </aside>

            <main class="dnd-table-area">
                <div id="tabletop-container"></div>
                <div class="dnd-table-topbar">
                    <button id="exitSession" class="btn-back-glass">ESCI</button>
                    <strong>${escapeHTML((sessionData.name || 'Tavolo Live').toUpperCase())}</strong>
                    <button id="toggleFog" class="btn-back-glass">${sessionState.fogEnabled ? 'FOG ON' : 'FOG OFF'}</button>
                </div>

                <div class="dnd-dice-bar">
                    ${[20, 12, 10, 8, 6, 4, 100].map(die => `<button class="roll-btn" data-dice="${die}">d${die === 100 ? '%' : die}</button>`).join('')}
                    <input id="rollMod" type="number" value="0" aria-label="Modificatore">
                </div>
            </main>

            <aside class="dnd-session-panel dnd-chat-panel">
                <header>
                    <span>Party</span>
                    <strong>Chat & Log</strong>
                </header>
                <div id="chat-msgs" class="dnd-chat-messages"></div>
                <form id="chatForm" class="dnd-chat-form">
                    <input id="chat-input" type="text" placeholder="Scrivi al party...">
                    <button class="btn-primary" type="submit">INVIA</button>
                </form>
            </aside>
        </div>
    `;

    const tabletopDiv = container.querySelector('#tabletop-container');
    showTabletop(tabletopDiv, sessionId, {
        mapUrl: sessionData.map_url || sessionData.data?.mapUrl || '',
        fogEnabled: sessionState.fogEnabled
    });

    const chatMsgs = container.querySelector('#chat-msgs');
    const renderMessage = (doc) => {
        const div = document.createElement('div');
        div.className = `dnd-chat-message ${doc.is_roll ? 'roll' : ''}`;
        div.innerHTML = `
            <strong>${escapeHTML(doc.sender_name || 'Sistema')}</strong>
            <p>${escapeHTML(doc.message || '')}</p>
        `;
        chatMsgs.appendChild(div);
        chatMsgs.scrollTo({ top: chatMsgs.scrollHeight, behavior: 'smooth' });
    };

    const sendMsg = async (message, isRoll = false) => {
        if (!String(message).trim()) return;
        try {
            const payload = {
                session_id: sessionId,
                sender_id: currentUser.id || 'guest',
                sender_name: currentUserName,
                message,
                is_roll: isRoll
            };
            const { data, error } = await runWithFallback(TABLES.chat, TABLES.legacyChat, (tableName) => supabase.from(tableName).insert([payload]).select('*').single());
            if (error) throw error;
            if (data) renderMessage(data);
        } catch (err) {
            console.error('Errore invio chat:', err);
        }
    };

    const loadMessages = async () => {
        try {
            const { data, error } = await runWithFallback(TABLES.chat, TABLES.legacyChat, (tableName) => supabase
                    .from(tableName)
                    .select('*')
                    .eq('session_id', sessionId)
                    .order('created_at', { ascending: true })
                    .limit(80));
            if (error) throw error;
            (data || []).forEach(renderMessage);
        } catch (err) {
            console.warn('Chat non caricata:', err);
        }
    };
    loadMessages();

    let chatSubscription = null;
    try {
        chatSubscription = supabase.channel(`dnd-chat-${sessionId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: TABLES.chat,
                filter: `session_id=eq.${sessionId}`
            }, payload => {
                if (payload.new?.sender_id !== (currentUser.id || 'guest')) renderMessage(payload.new);
            })
            .subscribe();
    } catch (err) {
        console.warn('Realtime chat non disponibile:', err);
    }

    const saveSessionData = async () => {
        try {
            const nextData = { ...(sessionData.data || {}), ...sessionState };
            await runWithFallback(TABLES.sessions, TABLES.legacySessions, (tableName) => supabase.from(tableName).update({ data: nextData }).eq('id', sessionId));
        } catch (err) {
            console.warn('Stato sessione non salvato:', err);
        }
    };

    const renderInitiative = () => {
        const list = container.querySelector('#initiativeList');
        list.innerHTML = sessionState.initiative.length ? sessionState.initiative.map((item, index) => `
            <div class="initiative-item ${index === 0 ? 'active' : ''}">
                <span>${escapeHTML(item.name)}</span>
                <strong>${escapeHTML(item.value)}</strong>
            </div>
        `).join('') : `<p class="dnd-muted">Nessun turno.</p>`;
    };
    renderInitiative();

    container.querySelector('#addToken').onclick = async () => {
        const name = container.querySelector('#tokenName').value.trim();
        const img = container.querySelector('#tokenImg').value.trim();
        if (!name) return;
        try {
            await window.__dndMapApi?.addToken({ name, img });
            container.querySelector('#tokenName').value = '';
            container.querySelector('#tokenImg').value = '';
        } catch (err) {
            alert(`Errore token: ${err.message}`);
        }
    };

    container.querySelector('#addInitiative').onclick = () => {
        const name = container.querySelector('#initiativeName').value.trim();
        const value = Number(container.querySelector('#initiativeValue').value || 0);
        if (!name) return;
        sessionState.initiative.push({ name, value });
        sessionState.initiative.sort((a, b) => b.value - a.value);
        container.querySelector('#initiativeName').value = '';
        container.querySelector('#initiativeValue').value = '';
        renderInitiative();
        saveSessionData();
    };

    container.querySelector('#nextTurn').onclick = () => {
        if (sessionState.initiative.length > 1) {
            sessionState.initiative.push(sessionState.initiative.shift());
            renderInitiative();
            saveSessionData();
        }
    };

    container.querySelector('#toggleFog').onclick = () => {
        sessionState.fogEnabled = window.__dndMapApi?.toggleFog() ?? !sessionState.fogEnabled;
        container.querySelector('#toggleFog').textContent = sessionState.fogEnabled ? 'FOG ON' : 'FOG OFF';
        saveSessionData();
    };

    container.querySelectorAll('.roll-btn').forEach(btn => {
        btn.onclick = () => {
            const faces = Number(btn.dataset.dice);
            const mod = Number(container.querySelector('#rollMod').value || 0);
            const result = rollDice(faces, 1, mod);
            sendMsg(`Tira d${faces === 100 ? '%' : faces}: ${result.total} (${result.rolls.join(', ')}${mod ? ` ${mod > 0 ? '+' : ''}${mod}` : ''})`, true);
        };
    });

    container.querySelector('#chatForm').onsubmit = (e) => {
        e.preventDefault();
        const input = container.querySelector('#chat-input');
        sendMsg(input.value);
        input.value = '';
    };

    container.querySelector('#exitSession').onclick = async () => {
        window.__dndMapApi?.cleanup();
        if (chatSubscription && supabase.removeChannel) supabase.removeChannel(chatSubscription);
        const { initDndDashboard } = await import('../../../dashboards/dnd5e.js');
        initDndDashboard(container);
    };
}
