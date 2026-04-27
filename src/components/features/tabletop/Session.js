import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';
import { showTabletop } from './Map.js';

const TABLES = {
    sessions: 'dnd_sessions',
    legacySessions: SUPABASE_CONFIG?.tables?.sessions || 'session',
    chat: 'dnd_chat',
    legacyChat: SUPABASE_CONFIG?.tables?.chat || 'chat_messages',
    characters: 'characters'
};

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

const rollDice = (faces, count = 1, mod = 0) => {
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * faces) + 1);
    return { rolls, total: rolls.reduce((sum, value) => sum + value, 0) + mod };
};

async function getSupabaseUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id && isUuid(user.id)) return user;

    try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error && data?.user?.id) {
            localStorage.removeItem('taverna_guest_user');
            return data.user;
        }
    } catch (err) {
        console.warn('Login anonimo Supabase non disponibile:', err);
    }

    return null;
}

const parseDiceFormula = (formula = '') => {
    const clean = String(formula).replace(/\s+/g, '').toLowerCase();
    const match = clean.match(/^(\d*)d(\d+|%)([+-]\d+)?$/);
    if (!match) return null;
    const count = Math.min(Math.max(Number(match[1] || 1), 1), 20);
    const faces = match[2] === '%' ? 100 : Number(match[2]);
    const mod = Number(match[3] || 0);
    if (!Number.isFinite(faces) || faces < 2 || faces > 1000) return null;
    return { count, faces, mod };
};

const isMissingTableError = (error) => {
    const message = String(error?.message || '');
    return error?.code === 'PGRST205'
        || message.includes('schema cache')
        || message.includes('Could not find the table');
};

const isMissingColumnError = (error) => {
    const message = String(error?.message || '');
    return error?.code === '42703'
        || message.includes('does not exist')
        || message.includes('Could not find')
        || message.includes('schema cache');
};

async function runWithFallback(primaryTable, fallbackTable, buildQuery) {
    const primary = await buildQuery(primaryTable);
    if (!primary.error || !isMissingTableError(primary.error)) return primary;
    return buildQuery(fallbackTable);
}

async function loadSessionCharacters(userId) {
    const attempts = isUuid(userId) ? [
        (query) => query.eq('user_id', userId).eq('system_id', 'dnd5e'),
        (query) => query.eq('user_id', userId),
        (query) => query.eq('system_id', 'dnd5e'),
        (query) => query
    ] : [
        (query) => query.eq('system_id', 'dnd5e'),
        (query) => query
    ];

    for (const applyFilters of attempts) {
        const result = await applyFilters(supabase.from(TABLES.characters).select('*')).limit(80);
        if (!result.error) return result.data || [];
        if (!isMissingColumnError(result.error)) break;
    }
    return [];
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
    const currentUser = await getSupabaseUser();
    if (!currentUser?.id) {
        container.innerHTML = `
            <div class="dnd-empty glass-box dnd-schema-error">
                <strong>Supabase non collegato.</strong>
                <span>Non riesco ad aprire la sessione senza un utente Supabase valido.</span>
            </div>
        `;
        return;
    }
    const currentUserId = currentUser.id;
    const dbUserId = currentUserId;
    const currentUserName = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Viandante';
    const characters = await loadSessionCharacters(currentUserId);

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
        fogEnabled: sessionData.data?.fogEnabled !== false,
        live_notes: sessionData.data?.live_notes || '',
        scene: sessionData.data?.scene || '',
        objective_done: Boolean(sessionData.data?.objective_done)
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
                    <select id="tokenCharacter">
                        <option value="">Token libero</option>
                        ${characters.map(char => `<option value="${escapeHTML(char.id)}">${escapeHTML(char.name || char.data?.name || 'Personaggio')}</option>`).join('')}
                    </select>
                    <input id="tokenName" type="text" placeholder="Nome token">
                    <input id="tokenImg" type="text" placeholder="URL immagine">
                    <input id="tokenColor" type="color" value="#c77dff" aria-label="Colore token">
                    <button id="addToken" class="btn-primary">AGGIUNGI TOKEN</button>
                    <div id="tokenList" class="token-list"></div>
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
                    <button id="clearInitiative" class="btn-back-glass">SVUOTA INIZIATIVA</button>
                </section>

                <section class="dnd-session-block">
                    <h3>Note Live</h3>
                    <input id="sceneInput" type="text" placeholder="Scena corrente" value="${escapeHTML(sessionState.scene)}">
                    <textarea id="liveNotes" placeholder="Appunti rapidi master">${escapeHTML(sessionState.live_notes)}</textarea>
                    <label class="session-check">
                        <input id="objectiveDone" type="checkbox" ${sessionState.objective_done ? 'checked' : ''}>
                        Obiettivo sessione completato
                    </label>
                    <button id="saveLiveNotes" class="btn-back-glass">SALVA NOTE</button>
                </section>
            </aside>

            <main class="dnd-table-area">
                <div id="tabletop-container"></div>
                <div class="dnd-table-topbar">
                    <button id="exitSession" class="btn-back-glass">ESCI</button>
                    <strong>${escapeHTML((sessionData.name || 'Tavolo Live').toUpperCase())}</strong>
                    <div class="map-control-row">
                        <button id="zoomOut" class="btn-back-glass">-</button>
                        <button id="resetMap" class="btn-back-glass">CENTRA</button>
                        <button id="zoomIn" class="btn-back-glass">+</button>
                        <button id="toggleFog" class="btn-back-glass">${sessionState.fogEnabled ? 'FOG ON' : 'FOG OFF'}</button>
                    </div>
                </div>

                <div class="dnd-dice-bar">
                    <input id="diceFormula" type="text" value="1d20" aria-label="Formula dado">
                    ${[20, 12, 10, 8, 6, 4, 100].map(die => `<button class="roll-btn" data-dice="${die}">d${die === 100 ? '%' : die}</button>`).join('')}
                    <input id="rollMod" type="number" value="0" aria-label="Modificatore">
                    <button id="rollFormula" class="roll-btn">TIRA</button>
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
        fogEnabled: sessionState.fogEnabled,
        onTokensChange: (tokens) => renderTokenList(tokens)
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
                sender_id: dbUserId,
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
                if (payload.new?.sender_id !== dbUserId) renderMessage(payload.new);
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
                <div>
                    <strong>${escapeHTML(item.value)}</strong>
                    <button type="button" data-remove-initiative="${index}" aria-label="Rimuovi turno">x</button>
                </div>
            </div>
        `).join('') : `<p class="dnd-muted">Nessun turno.</p>`;
        list.querySelectorAll('[data-remove-initiative]').forEach(btn => {
            btn.onclick = () => {
                sessionState.initiative.splice(Number(btn.dataset.removeInitiative), 1);
                renderInitiative();
                saveSessionData();
            };
        });
    };
    renderInitiative();

    function renderTokenList(tokens = []) {
        const list = container.querySelector('#tokenList');
        if (!list) return;
        list.innerHTML = tokens.length ? tokens.map(token => `
            <div class="token-list-item">
                <span style="--token-color:${escapeHTML(token.color || '#c77dff')}">${escapeHTML(token.name || 'Token')}</span>
                <button type="button" data-delete-token="${escapeHTML(token.id)}">RIMUOVI</button>
            </div>
        `).join('') : `<p class="dnd-muted">Nessun token in mappa.</p>`;
        list.querySelectorAll('[data-delete-token]').forEach(btn => {
            btn.onclick = async () => {
                try {
                    await window.__dndMapApi?.deleteToken(btn.dataset.deleteToken);
                } catch (err) {
                    alert(`Errore rimozione token: ${err.message}`);
                }
            };
        });
    }

    container.querySelector('#addToken').onclick = async () => {
        const selectedCharacterId = container.querySelector('#tokenCharacter').value;
        const selectedCharacter = characters.find(char => String(char.id) === String(selectedCharacterId));
        const name = container.querySelector('#tokenName').value.trim() || selectedCharacter?.name || selectedCharacter?.data?.name || '';
        const img = container.querySelector('#tokenImg').value.trim() || selectedCharacter?.data?.portrait || selectedCharacter?.avatar_url || '';
        const color = container.querySelector('#tokenColor').value || '#c77dff';
        if (!name) return;
        try {
            await window.__dndMapApi?.addToken({
                name,
                img,
                color,
                character_id: selectedCharacterId || null,
                data: selectedCharacter ? {
                    hp: selectedCharacter.hp,
                    hp_max: selectedCharacter.hp_max,
                    armorClass: selectedCharacter.data?.armorClass
                } : {}
            });
            container.querySelector('#tokenCharacter').value = '';
            container.querySelector('#tokenName').value = '';
            container.querySelector('#tokenImg').value = '';
        } catch (err) {
            alert(`Errore token: ${err.message}`);
        }
    };

    container.querySelector('#tokenCharacter').onchange = (event) => {
        const selectedCharacter = characters.find(char => String(char.id) === String(event.target.value));
        if (!selectedCharacter) return;
        container.querySelector('#tokenName').value = selectedCharacter.name || selectedCharacter.data?.name || '';
        container.querySelector('#tokenImg').value = selectedCharacter.data?.portrait || selectedCharacter.avatar_url || '';
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

    container.querySelector('#clearInitiative').onclick = () => {
        if (!sessionState.initiative.length) return;
        if (!confirm('Svuotare tutta la lista iniziativa?')) return;
        sessionState.initiative = [];
        renderInitiative();
        saveSessionData();
    };

    container.querySelector('#saveLiveNotes').onclick = () => {
        sessionState.scene = container.querySelector('#sceneInput').value.trim();
        sessionState.live_notes = container.querySelector('#liveNotes').value;
        sessionState.objective_done = container.querySelector('#objectiveDone').checked;
        saveSessionData();
        sendMsg(`Aggiornamento sessione: ${sessionState.scene || 'note live salvate'}`);
    };

    container.querySelector('#toggleFog').onclick = () => {
        sessionState.fogEnabled = window.__dndMapApi?.toggleFog() ?? !sessionState.fogEnabled;
        container.querySelector('#toggleFog').textContent = sessionState.fogEnabled ? 'FOG ON' : 'FOG OFF';
        saveSessionData();
    };
    container.querySelector('#zoomIn').onclick = () => window.__dndMapApi?.zoomIn();
    container.querySelector('#zoomOut').onclick = () => window.__dndMapApi?.zoomOut();
    container.querySelector('#resetMap').onclick = () => window.__dndMapApi?.resetView();

    container.querySelectorAll('.roll-btn').forEach(btn => {
        btn.onclick = () => {
            if (btn.id === 'rollFormula') return;
            const faces = Number(btn.dataset.dice);
            const mod = Number(container.querySelector('#rollMod').value || 0);
            const result = rollDice(faces, 1, mod);
            sendMsg(`Tira d${faces === 100 ? '%' : faces}: ${result.total} (${result.rolls.join(', ')}${mod ? ` ${mod > 0 ? '+' : ''}${mod}` : ''})`, true);
        };
    });

    container.querySelector('#rollFormula').onclick = () => {
        const formula = container.querySelector('#diceFormula').value;
        const parsed = parseDiceFormula(formula);
        if (!parsed) {
            alert('Formula non valida. Usa esempi come 1d20, 2d6+3, d%.');
            return;
        }
        const result = rollDice(parsed.faces, parsed.count, parsed.mod);
        sendMsg(`Tira ${parsed.count}d${parsed.faces === 100 ? '%' : parsed.faces}${parsed.mod ? `${parsed.mod > 0 ? '+' : ''}${parsed.mod}` : ''}: ${result.total} (${result.rolls.join(', ')})`, true);
    };

    container.querySelector('#chatForm').onsubmit = (e) => {
        e.preventDefault();
        const input = container.querySelector('#chat-input');
        sendMsg(input.value);
        input.value = '';
    };

    container.querySelector('#exitSession').onclick = async () => {
        window.__dndMapApi?.cleanup();
        if (chatSubscription && supabase.removeChannel) supabase.removeChannel(chatSubscription);
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        const { initDndDashboard } = await import('../../../dashboards/dnd5e.js');
        initDndDashboard(container);
    };
}
