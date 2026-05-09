import { supabase, SUPABASE_CONFIG } from '../../../services/supabase.js';
import {
    dndLocalStore,
    getLocalDndUser,
    isLocalDndUser,
    isLocalDndUserId,
    pathfinderLocalStore,
    getLocalPathfinderUser,
    isLocalPathfinderUser,
    isLocalPathfinderUserId
} from '../../../services/dndLocalStore.js';
import { showTabletop } from './Map.js';

const TABLES = {
    sessions: SUPABASE_CONFIG?.tables?.sessions || 'dnd_sessions',
    chat: SUPABASE_CONFIG?.tables?.chat || 'dnd_chat',
    characters: SUPABASE_CONFIG?.tables?.characters || 'characters'
};

const SESSION_SYSTEMS = {
    dnd5e: {
        id: 'dnd5e',
        localStore: dndLocalStore,
        getLocalUser: getLocalDndUser,
        isLocalUser: isLocalDndUser,
        isLocalUserId: isLocalDndUserId,
        loadDashboard: async () => {
            const { initDndDashboard } = await import('../../../dashboards/dnd5e.js');
            return initDndDashboard;
        }
    },
    pathfinder2e: {
        id: 'pathfinder2e',
        localStore: pathfinderLocalStore,
        getLocalUser: getLocalPathfinderUser,
        isLocalUser: isLocalPathfinderUser,
        isLocalUserId: isLocalPathfinderUserId,
        loadDashboard: async () => {
            const { initPathfinderDashboard } = await import('../../../dashboards/pathfinder2e.js');
            return initPathfinderDashboard;
        }
    }
};

const getSessionSystem = (systemId = 'dnd5e') => SESSION_SYSTEMS[systemId] || SESSION_SYSTEMS.dnd5e;

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

const abilityMod = (score = 10) => Math.floor((Number(score || 10) - 10) / 2);

const formatMod = (value = 0) => `${value >= 0 ? '+' : ''}${value}`;

async function getSupabaseUser(systemId = 'dnd5e') {
    const system = getSessionSystem(systemId);
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

    return system.getLocalUser();
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

const isMissingColumnError = (error) => {
    const message = String(error?.message || '');
    return error?.code === '42703'
        || message.includes('does not exist')
        || message.includes('Could not find')
        || message.includes('schema cache');
};

async function loadSessionCharacters(userId, systemId = 'dnd5e') {
    const system = getSessionSystem(systemId);
    if (system.isLocalUserId(userId)) return system.localStore.characters.list(userId).data || [];

    const attempts = isUuid(userId) ? [
        (query) => query.eq('user_id', userId).eq('system_id', system.id),
        (query) => query.eq('user_id', userId),
        (query) => query.eq('system_id', system.id),
        (query) => query
    ] : [
        (query) => query.eq('system_id', system.id),
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
    session = session || {};
    const data = session.data || {};
    return {
        ...session,
        status: session.status || data.status || 'attiva',
        party_level: session.party_level || data.party_level || 1,
        next_date: session.next_date || data.next_date || '',
        map_url: session.map_url || data.map_url || data.mapUrl || '',
        description: session.description || data.description || '',
        party_name: data.party_name || '',
        location: data.location || '',
        data
    };
};

const renderPrepText = (label, value) => value ? `
    <div class="session-prep-item">
        <span>${label}</span>
        <p>${escapeHTML(value)}</p>
    </div>
` : '';

const toNumber = (value, fallback = 0) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
};

const clampNumber = (value, min, max) => Math.min(Math.max(toNumber(value, min), min), max);

const splitConditions = (value = '') => String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const joinConditions = (conditions = []) => Array.isArray(conditions) ? conditions.join(', ') : String(conditions || '');

const getCharacterName = (char = {}) => char.name || char.data?.name || 'Personaggio';

const getCharacterInitiativeMod = (char = {}) => {
    const explicit = Number(char.data?.initiative);
    if (Number.isFinite(explicit) && explicit !== 0) return explicit;
    return abilityMod(char.data?.stats?.dex || 10);
};

export async function showSession(container, sessionId, options = {}) {
    const requestedSystem = getSessionSystem(options.systemId || 'dnd5e');
    const currentUser = await getSupabaseUser(requestedSystem.id);
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
    const localMode = requestedSystem.isLocalUser(currentUser);

    let sessionData = { id: sessionId, name: 'Tavolo Live', data: {} };
    try {
        const { data } = localMode
            ? requestedSystem.localStore.sessions.get(sessionId)
            : await supabase
                .from(TABLES.sessions)
                .select('*')
                .eq('id', sessionId)
                .single();
        if (data) sessionData = normalizeSession(data);
    } catch (err) {
        console.warn('Sessione non recuperata:', err);
    }
    const sessionSystem = getSessionSystem(sessionData.system_id || sessionData.data?.system_id || requestedSystem.id);
    const localStore = sessionSystem.localStore;
    const characters = await loadSessionCharacters(currentUserId, sessionSystem.id);

    const sessionState = {
        initiative: sessionData.data?.initiative || [],
        round: Number(sessionData.data?.round || 1),
        turnCount: Number(sessionData.data?.turnCount || 0),
        fogEnabled: sessionData.data?.fogEnabled !== false,
        gridVisible: sessionData.data?.gridVisible !== false,
        map_grid_size: Number(sessionData.data?.map_grid_size || 50),
        live_notes: sessionData.data?.live_notes || '',
        scene: sessionData.data?.scene || '',
        public_summary: sessionData.data?.public_summary || '',
        objective_done: Boolean(sessionData.data?.objective_done),
        selectedTokenId: null
    };

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.classList.add('dnd-session-active');

    container.innerHTML = `
        <div class="dnd-session fade-in" data-left-open="false" data-chat-open="false">
            <div class="dnd-session-scrim" data-close-session-drawer aria-hidden="true"></div>

            <aside class="dnd-session-panel dnd-left-panel" id="sessionToolsPanel" aria-hidden="true" aria-label="Menu sessione">
                <header class="dnd-panel-head">
                    <div>
                        <span>Sessione</span>
                        <strong>${escapeHTML(sessionData.name || 'Tavolo Live')}</strong>
                        <small>${escapeHTML(sessionData.status || 'attiva')} • LV ${escapeHTML(sessionData.party_level || 1)}${sessionData.next_date ? ` • ${escapeHTML(sessionData.next_date)}` : ''}</small>
                    </div>
                    <button type="button" class="dnd-panel-close" id="closeSessionMenu" aria-label="Chiudi menu sessione">X</button>
                </header>

                <section class="dnd-session-block session-brief">
                    <h3>Brief</h3>
                    ${sessionData.party_name ? `<p><strong>Party:</strong> ${escapeHTML(sessionData.party_name)}</p>` : ''}
                    ${sessionData.location ? `<p><strong>Luogo:</strong> ${escapeHTML(sessionData.location)}</p>` : ''}
                    ${sessionData.description ? `<p>${escapeHTML(sessionData.description)}</p>` : '<p class="dnd-muted">Nessuna descrizione sessione.</p>'}
                </section>

                <section class="dnd-session-block">
                    <h3>Token</h3>
                    <select id="tokenCharacter">
                        <option value="">Token libero</option>
                        ${characters.map(char => `<option value="${escapeHTML(char.id)}">${escapeHTML(getCharacterName(char))}</option>`).join('')}
                    </select>
                    <input id="tokenName" type="text" placeholder="Nome token">
                    <input id="tokenImg" type="text" placeholder="URL immagine">
                    <div class="token-form-grid">
                        <input id="tokenColor" type="color" value="#c77dff" aria-label="Colore token">
                        <input id="tokenHp" type="number" placeholder="PF">
                        <input id="tokenHpMax" type="number" placeholder="PF max">
                        <input id="tokenAc" type="number" placeholder="CA">
                    </div>
                    <input id="tokenConditions" type="text" placeholder="Condizioni, separate da virgola">
                    <button id="addToken" class="btn-primary">AGGIUNGI TOKEN</button>
                    <div id="tokenList" class="token-list"></div>
                    <div id="tokenInspector" class="token-inspector"></div>
                </section>

                <section class="dnd-session-block">
                    <h3>Iniziativa</h3>
                    <div class="initiative-round">Round <strong id="roundValue">${sessionState.round}</strong></div>
                    <div id="initiativeList" class="initiative-list"></div>
                    <select id="initiativeCharacter">
                        <option value="">Personaggio</option>
                        ${characters.map(char => `<option value="${escapeHTML(char.id)}">${escapeHTML(getCharacterName(char))}</option>`).join('')}
                    </select>
                    <div class="initiative-form">
                        <input id="initiativeName" type="text" placeholder="Nome">
                        <input id="initiativeValue" type="number" placeholder="Init">
                    </div>
                    <div class="session-action-grid">
                        <button id="rollCharacterInitiative" class="btn-back-glass">TIRA PG</button>
                        <button id="addInitiative" class="btn-back-glass">AGGIUNGI</button>
                        <button id="sortInitiative" class="btn-back-glass">ORDINA</button>
                        <button id="prevTurn" class="btn-back-glass">INDIETRO</button>
                        <button id="nextTurn" class="btn-primary">PROSSIMO</button>
                        <button id="clearInitiative" class="btn-back-glass">SVUOTA</button>
                    </div>
                </section>

                <section class="dnd-session-block">
                    <h3>Note Live</h3>
                    <input id="sceneInput" type="text" placeholder="Scena corrente" value="${escapeHTML(sessionState.scene)}">
                    <textarea id="publicSummary" placeholder="Riepilogo condiviso">${escapeHTML(sessionState.public_summary)}</textarea>
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
                    <div class="dnd-session-primary-controls">
                        <button id="toggleSessionMenu" class="btn-back-glass dnd-panel-toggle" type="button" aria-controls="sessionToolsPanel" aria-expanded="false">MENU</button>
                        <button id="exitSession" class="btn-back-glass">ESCI</button>
                    </div>
                    <strong>${escapeHTML((sessionData.name || 'Tavolo Live').toUpperCase())}</strong>
                    <div class="map-control-row">
                        <button id="zoomOut" class="btn-back-glass">-</button>
                        <button id="resetMap" class="btn-back-glass">CENTRA</button>
                        <button id="zoomIn" class="btn-back-glass">+</button>
                        <button id="pingMap" class="btn-back-glass">PING</button>
                        <button id="toggleGrid" class="btn-back-glass">${sessionState.gridVisible ? 'GRID ON' : 'GRID OFF'}</button>
                        <button id="toggleFog" class="btn-back-glass">${sessionState.fogEnabled ? 'FOG ON' : 'FOG OFF'}</button>
                        <button id="toggleSessionChat" class="btn-back-glass dnd-panel-toggle" type="button" aria-controls="sessionChatPanel" aria-expanded="false">CHAT</button>
                    </div>
                </div>

                <div class="dnd-session-hud">
                    <span id="sessionHudRound">Round ${sessionState.round}</span>
                    <strong id="sessionHudTurn">Turno: libero</strong>
                    <small id="sessionHudScene">${escapeHTML(sessionState.scene || sessionData.data?.objectives || 'Nessuna scena attiva')}</small>
                </div>

                <div class="dnd-dice-bar">
                    <select id="rollMode" aria-label="Modalita tiro">
                        <option value="normal">Normale</option>
                        <option value="adv">Vantaggio</option>
                        <option value="dis">Svantaggio</option>
                    </select>
                    <input id="diceFormula" type="text" value="1d20" aria-label="Formula dado">
                    ${[20, 12, 10, 8, 6, 4, 100].map(die => `<button class="roll-btn" data-dice="${die}">d${die === 100 ? '%' : die}</button>`).join('')}
                    <input id="rollMod" type="number" value="0" aria-label="Modificatore">
                    <button id="rollFormula" class="roll-btn">TIRA</button>
                </div>
            </main>

            <aside class="dnd-session-panel dnd-chat-panel" id="sessionChatPanel" aria-hidden="true" aria-label="Chat sessione">
                <header class="dnd-panel-head">
                    <div>
                        <span>Party</span>
                        <strong>Chat & Log</strong>
                    </div>
                    <button type="button" class="dnd-panel-close" id="closeSessionChat" aria-label="Chiudi chat">X</button>
                </header>
                <section class="session-prep-log">
                    ${renderPrepText('Obiettivi', sessionData.data?.objectives)}
                    ${renderPrepText('Recap', sessionData.data?.recap)}
                    ${renderPrepText('Agganci', sessionData.data?.hooks)}
                    ${renderPrepText('PNG', sessionData.data?.npcs)}
                    ${renderPrepText('Tesori', sessionData.data?.loot)}
                </section>
                <div id="chat-msgs" class="dnd-chat-messages"></div>
                <form id="chatForm" class="dnd-chat-form">
                    <input id="chat-input" type="text" placeholder="Scrivi al party...">
                    <button id="chatSubmit" class="btn-primary" type="button">INVIA</button>
                </form>
            </aside>
        </div>
    `;

    const sessionShell = container.querySelector('.dnd-session');
    const sessionToolsPanel = container.querySelector('#sessionToolsPanel');
    const sessionChatPanel = container.querySelector('#sessionChatPanel');
    const sessionMenuToggle = container.querySelector('#toggleSessionMenu');
    const sessionChatToggle = container.querySelector('#toggleSessionChat');

    const setSessionDrawer = (drawer, open) => {
        if (!sessionShell) return;
        const openTools = drawer === 'tools' && open;
        const openChat = drawer === 'chat' && open;

        sessionShell.dataset.leftOpen = openTools ? 'true' : 'false';
        sessionShell.dataset.chatOpen = openChat ? 'true' : 'false';

        sessionToolsPanel?.setAttribute('aria-hidden', openTools ? 'false' : 'true');
        sessionChatPanel?.setAttribute('aria-hidden', openChat ? 'false' : 'true');
        sessionMenuToggle?.setAttribute('aria-expanded', openTools ? 'true' : 'false');
        sessionChatToggle?.setAttribute('aria-expanded', openChat ? 'true' : 'false');
        sessionMenuToggle?.classList.toggle('active', openTools);
        sessionChatToggle?.classList.toggle('active', openChat);
        document.body.classList.toggle('dnd-session-tools-open', openTools);
        document.body.classList.toggle('dnd-session-chat-open', openChat);
    };

    const closeSessionDrawers = () => setSessionDrawer('none', false);
    sessionMenuToggle.onclick = () => setSessionDrawer('tools', sessionShell?.dataset.leftOpen !== 'true');
    sessionChatToggle.onclick = () => setSessionDrawer('chat', sessionShell?.dataset.chatOpen !== 'true');
    container.querySelector('#closeSessionMenu').onclick = closeSessionDrawers;
    container.querySelector('#closeSessionChat').onclick = closeSessionDrawers;
    container.querySelector('[data-close-session-drawer]').onclick = closeSessionDrawers;
    const handleSessionEscape = (event) => {
        if (event.key === 'Escape') closeSessionDrawers();
    };
    window.addEventListener('keydown', handleSessionEscape);

    const tabletopDiv = container.querySelector('#tabletop-container');
    showTabletop(tabletopDiv, sessionId, {
        mapUrl: sessionData.map_url || sessionData.data?.mapUrl || '',
        fogEnabled: sessionState.fogEnabled,
        gridVisible: sessionState.gridVisible,
        gridSize: sessionState.map_grid_size,
        localMode,
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
            const { data, error } = localMode
                ? localStore.chat.insert(payload)
                : await supabase.from(TABLES.chat).insert([payload]).select('*').single();
            if (error) throw error;
            if (data) renderMessage(data);
        } catch (err) {
            console.error('Errore invio chat:', err);
        }
    };

    const loadMessages = async () => {
        try {
            const { data, error } = localMode
                ? localStore.chat.list(sessionId)
                : await supabase
                        .from(TABLES.chat)
                        .select('*')
                        .eq('session_id', sessionId)
                        .order('created_at', { ascending: true })
                        .limit(80);
            if (error) throw error;
            (data || []).forEach(renderMessage);
        } catch (err) {
            console.warn('Chat non caricata:', err);
        }
    };
    loadMessages();

    let chatSubscription = null;
    if (!localMode) {
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
    }

    const activeInitiativeName = () => sessionState.initiative[0]?.name || '';

    const updateSessionHud = () => {
        const round = container.querySelector('#sessionHudRound');
        const turn = container.querySelector('#sessionHudTurn');
        const scene = container.querySelector('#sessionHudScene');
        if (round) round.textContent = `Round ${sessionState.round}`;
        if (turn) turn.textContent = activeInitiativeName() ? `Turno: ${activeInitiativeName()}` : 'Turno: libero';
        if (scene) scene.textContent = sessionState.scene || sessionState.public_summary || sessionData.data?.objectives || 'Nessuna scena attiva';
    };

    const renderInitiative = () => {
        const list = container.querySelector('#initiativeList');
        container.querySelector('#roundValue').textContent = sessionState.round;
        list.innerHTML = sessionState.initiative.length ? sessionState.initiative.map((item, index) => `
            <div class="initiative-item ${index === 0 ? 'active' : ''}">
                <span>${escapeHTML(item.name)}${item.ac ? ` <small>CA ${escapeHTML(item.ac)}</small>` : ''}</span>
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
        updateSessionHud();
    };

    const syncSessionControls = () => {
        const activeId = document.activeElement?.id;
        const setField = (id, value) => {
            const el = container.querySelector(`#${id}`);
            if (el && activeId !== id) el.value = value || '';
        };
        setField('sceneInput', sessionState.scene);
        setField('publicSummary', sessionState.public_summary);
        setField('liveNotes', sessionState.live_notes);
        const objective = container.querySelector('#objectiveDone');
        if (objective && activeId !== 'objectiveDone') objective.checked = Boolean(sessionState.objective_done);
        const fogButton = container.querySelector('#toggleFog');
        const gridButton = container.querySelector('#toggleGrid');
        if (fogButton) fogButton.textContent = sessionState.fogEnabled ? 'FOG ON' : 'FOG OFF';
        if (gridButton) gridButton.textContent = sessionState.gridVisible ? 'GRID ON' : 'GRID OFF';
        window.__dndMapApi?.setFog?.(sessionState.fogEnabled);
        window.__dndMapApi?.setGridVisible?.(sessionState.gridVisible);
        window.__dndMapApi?.setGridSize?.(sessionState.map_grid_size);
        renderInitiative();
        updateSessionHud();
    };

    const getPersistentSessionState = () => ({
        initiative: sessionState.initiative,
        round: sessionState.round,
        turnCount: sessionState.turnCount,
        fogEnabled: sessionState.fogEnabled,
        gridVisible: sessionState.gridVisible,
        map_grid_size: sessionState.map_grid_size,
        live_notes: sessionState.live_notes,
        scene: sessionState.scene,
        public_summary: sessionState.public_summary,
        objective_done: sessionState.objective_done
    });

    const saveSessionData = async () => {
        try {
            const nextData = { ...(sessionData.data || {}), ...getPersistentSessionState() };
            sessionData.data = nextData;
            if (localMode) {
                localStore.sessions.updateData(sessionId, nextData);
                return;
            }
            await supabase.from(TABLES.sessions).update({ data: nextData }).eq('id', sessionId);
        } catch (err) {
            console.warn('Stato sessione non salvato:', err);
        }
    };

    let sessionSubscription = null;
    if (!localMode) {
        try {
            sessionSubscription = supabase.channel(`dnd-session-${sessionId}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: TABLES.sessions,
                    filter: `id=eq.${sessionId}`
                }, payload => {
                    const nextData = payload.new?.data || {};
                    sessionData.data = nextData;
                    sessionState.initiative = Array.isArray(nextData.initiative) ? nextData.initiative : [];
                    sessionState.round = Number(nextData.round || 1);
                    sessionState.turnCount = Number(nextData.turnCount || 0);
                    sessionState.fogEnabled = nextData.fogEnabled !== false;
                    sessionState.gridVisible = nextData.gridVisible !== false;
                    sessionState.map_grid_size = Number(nextData.map_grid_size || sessionState.map_grid_size || 50);
                    sessionState.live_notes = nextData.live_notes || '';
                    sessionState.scene = nextData.scene || '';
                    sessionState.public_summary = nextData.public_summary || '';
                    sessionState.objective_done = Boolean(nextData.objective_done);
                    syncSessionControls();
                })
                .subscribe();
        } catch (err) {
            console.warn('Realtime stato sessione non disponibile:', err);
        }
    }

    const cleanupSessionView = () => {
        window.__dndMapApi?.cleanup();
        if (chatSubscription && supabase.removeChannel) supabase.removeChannel(chatSubscription);
        if (sessionSubscription && supabase.removeChannel) supabase.removeChannel(sessionSubscription);
        window.removeEventListener('keydown', handleSessionEscape);
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.classList.remove('dnd-session-active', 'dnd-session-tools-open', 'dnd-session-chat-open');
        if (window.__dndSessionCleanup === cleanupSessionView) window.__dndSessionCleanup = null;
    };
    window.__dndSessionCleanup = cleanupSessionView;

    renderInitiative();
    updateSessionHud();

    function renderTokenList(tokens = []) {
        const list = container.querySelector('#tokenList');
        const inspector = container.querySelector('#tokenInspector');
        if (!list) return;
        if (!tokens.length) {
            sessionState.selectedTokenId = null;
        } else if (!sessionState.selectedTokenId || !tokens.some(token => String(token.id) === String(sessionState.selectedTokenId))) {
            sessionState.selectedTokenId = String(tokens[0].id);
        }
        const hpText = (token) => {
            const hp = token.data?.hp;
            const hpMax = token.data?.hp_max;
            if (hp === undefined && hpMax === undefined) return '';
            return `PF ${escapeHTML(hp ?? '?')}/${escapeHTML(hpMax ?? '?')}${token.data?.armorClass ? ` • CA ${escapeHTML(token.data.armorClass)}` : ''}`;
        };
        list.innerHTML = tokens.length ? tokens.map(token => `
            <div class="token-list-item ${String(token.id) === String(sessionState.selectedTokenId) ? 'active' : ''}" data-select-token="${escapeHTML(token.id)}">
                <span style="--token-color:${escapeHTML(token.color || '#c77dff')}">${escapeHTML(token.name || 'Token')} <small>${hpText(token)}</small></span>
                <div>
                    <button type="button" data-focus-token="${escapeHTML(token.id)}">FOCUS</button>
                    <button type="button" data-damage-token="${escapeHTML(token.id)}">-5</button>
                    <button type="button" data-heal-token="${escapeHTML(token.id)}">+5</button>
                    <button type="button" data-delete-token="${escapeHTML(token.id)}">X</button>
                </div>
            </div>
        `).join('') : `<p class="dnd-muted">Nessun token in mappa.</p>`;

        list.querySelectorAll('[data-select-token]').forEach(item => {
            item.onclick = () => {
                sessionState.selectedTokenId = item.dataset.selectToken;
                renderTokenList(window.__dndMapApi?.getTokens?.() || tokens);
            };
        });
        list.querySelectorAll('[data-focus-token]').forEach(btn => {
            btn.onclick = (event) => {
                event.stopPropagation();
                sessionState.selectedTokenId = btn.dataset.focusToken;
                window.__dndMapApi?.focusToken(btn.dataset.focusToken);
                renderTokenList(window.__dndMapApi?.getTokens?.() || tokens);
            };
        });
        const updateTokenHp = async (id, delta) => {
            const token = window.__dndMapApi?.getTokens().find(item => String(item.id) === String(id));
            if (!token) return;
            const currentHp = toNumber(token.data?.hp ?? token.data?.hp_max, 0);
            const maxHp = toNumber(token.data?.hp_max ?? currentHp, currentHp);
            const nextHp = Math.max(0, Math.min(maxHp || 999, currentHp + delta));
            await window.__dndMapApi?.updateToken(id, { data: { hp: nextHp, hp_max: maxHp } });
            sendMsg(`${token.name || 'Token'} ${delta < 0 ? 'subisce' : 'recupera'} ${Math.abs(delta)} PF (${nextHp}/${maxHp}).`);
        };
        list.querySelectorAll('[data-damage-token]').forEach(btn => {
            btn.onclick = (event) => {
                event.stopPropagation();
                updateTokenHp(btn.dataset.damageToken, -5);
            };
        });
        list.querySelectorAll('[data-heal-token]').forEach(btn => {
            btn.onclick = (event) => {
                event.stopPropagation();
                updateTokenHp(btn.dataset.healToken, 5);
            };
        });
        list.querySelectorAll('[data-delete-token]').forEach(btn => {
            btn.onclick = async (event) => {
                event.stopPropagation();
                try {
                    await window.__dndMapApi?.deleteToken(btn.dataset.deleteToken);
                } catch (err) {
                    alert(`Errore rimozione token: ${err.message}`);
                }
            };
        });

        if (!inspector) return;
        const selectedToken = tokens.find(token => String(token.id) === String(sessionState.selectedTokenId));
        if (!selectedToken) {
            inspector.innerHTML = `<p class="dnd-muted">Seleziona un token per modificare PF, CA, condizioni e note.</p>`;
            return;
        }
        const selectedConditions = joinConditions(selectedToken.data?.conditions || []);
        inspector.innerHTML = `
            <form id="tokenInspectorForm">
                <div class="token-inspector-head">
                    <strong>${escapeHTML(selectedToken.name || 'Token')}</strong>
                    <span>${selectedToken.data?.armorClass ? `CA ${escapeHTML(selectedToken.data.armorClass)}` : 'CA non impostata'}</span>
                </div>
                <label>Nome<input id="inspectTokenName" value="${escapeHTML(selectedToken.name || '')}"></label>
                <label>Immagine<input id="inspectTokenImg" value="${escapeHTML(selectedToken.img || '')}" placeholder="https://..."></label>
                <div class="token-inspector-grid">
                    <label>Colore<input id="inspectTokenColor" type="color" value="${escapeHTML(selectedToken.color || '#c77dff')}"></label>
                    <label>PF<input id="inspectTokenHp" type="number" value="${escapeHTML(selectedToken.data?.hp ?? '')}"></label>
                    <label>PF max<input id="inspectTokenHpMax" type="number" value="${escapeHTML(selectedToken.data?.hp_max ?? '')}"></label>
                    <label>CA<input id="inspectTokenAc" type="number" value="${escapeHTML(selectedToken.data?.armorClass ?? '')}"></label>
                </div>
                <label>Condizioni<input id="inspectTokenConditions" value="${escapeHTML(selectedConditions)}" placeholder="avvelenato, prono..."></label>
                <label>Note<textarea id="inspectTokenNotes" placeholder="Note rapide">${escapeHTML(selectedToken.data?.notes || '')}</textarea></label>
                <div class="token-inspector-damage">
                    <input id="inspectHpDelta" type="number" min="1" value="5" aria-label="Quantita PF">
                    <button type="button" id="inspectDamage">DANNO</button>
                    <button type="button" id="inspectHeal">CURA</button>
                </div>
                <div class="token-inspector-actions">
                    <button type="button" id="saveTokenInspector" class="btn-primary">SALVA TOKEN</button>
                    <button type="button" id="tokenToInitiative" class="btn-back-glass">INIZIATIVA</button>
                    <button type="button" id="duplicateToken" class="btn-back-glass">DUPLICA</button>
                </div>
            </form>
        `;

        inspector.querySelector('#tokenInspectorForm').onsubmit = event => event.preventDefault();
        inspector.querySelector('#saveTokenInspector').onclick = async () => {
            const hpMax = toNumber(inspector.querySelector('#inspectTokenHpMax').value, toNumber(selectedToken.data?.hp_max, 0));
            const hp = clampNumber(inspector.querySelector('#inspectTokenHp').value, 0, hpMax || 999);
            const armorClass = toNumber(inspector.querySelector('#inspectTokenAc').value, toNumber(selectedToken.data?.armorClass, 10));
            try {
                await window.__dndMapApi?.updateToken(selectedToken.id, {
                    name: inspector.querySelector('#inspectTokenName').value.trim() || 'Token',
                    img: inspector.querySelector('#inspectTokenImg').value.trim(),
                    color: inspector.querySelector('#inspectTokenColor').value || '#c77dff',
                    data: {
                        hp,
                        hp_max: hpMax,
                        armorClass,
                        conditions: splitConditions(inspector.querySelector('#inspectTokenConditions').value),
                        notes: inspector.querySelector('#inspectTokenNotes').value
                    }
                });
            } catch (err) {
                alert(`Errore salvataggio token: ${err.message}`);
            }
        };
        inspector.querySelector('#inspectDamage').onclick = () => {
            const delta = Math.max(1, toNumber(inspector.querySelector('#inspectHpDelta').value, 5));
            updateTokenHp(selectedToken.id, -delta);
        };
        inspector.querySelector('#inspectHeal').onclick = () => {
            const delta = Math.max(1, toNumber(inspector.querySelector('#inspectHpDelta').value, 5));
            updateTokenHp(selectedToken.id, delta);
        };
        inspector.querySelector('#tokenToInitiative').onclick = () => {
            const result = rollDice(20);
            addInitiativeEntry({
                token_id: selectedToken.id,
                name: selectedToken.name || 'Token',
                value: result.total,
                hp: selectedToken.data?.hp,
                hp_max: selectedToken.data?.hp_max,
                ac: selectedToken.data?.armorClass
            });
            sendMsg(`Iniziativa ${selectedToken.name || 'Token'}: ${result.total} (${result.rolls[0]})`, true);
        };
        inspector.querySelector('#duplicateToken').onclick = async () => {
            try {
                await window.__dndMapApi?.addToken({
                    name: `${selectedToken.name || 'Token'} copia`,
                    img: selectedToken.img || '',
                    color: selectedToken.color || '#c77dff',
                    character_id: selectedToken.character_id || null,
                    data: { ...(selectedToken.data || {}) }
                });
            } catch (err) {
                alert(`Errore duplicazione token: ${err.message}`);
            }
        };
    }

    container.querySelector('#addToken').onclick = async () => {
        const selectedCharacterId = container.querySelector('#tokenCharacter').value;
        const selectedCharacter = characters.find(char => String(char.id) === String(selectedCharacterId));
        const name = container.querySelector('#tokenName').value.trim() || (selectedCharacter ? getCharacterName(selectedCharacter) : '');
        const img = container.querySelector('#tokenImg').value.trim() || selectedCharacter?.data?.portrait || selectedCharacter?.avatar_url || '';
        const color = container.querySelector('#tokenColor').value || '#c77dff';
        const hp = toNumber(container.querySelector('#tokenHp').value || selectedCharacter?.hp, 10);
        const hpMax = toNumber(container.querySelector('#tokenHpMax').value || selectedCharacter?.hp_max, hp);
        const ac = toNumber(container.querySelector('#tokenAc').value || selectedCharacter?.data?.armorClass, 10);
        const conditions = splitConditions(container.querySelector('#tokenConditions').value);
        if (!name) return;
        try {
            await window.__dndMapApi?.addToken({
                name,
                img,
                color,
                character_id: selectedCharacterId || null,
                data: { hp, hp_max: hpMax, armorClass: ac, conditions, notes: '' }
            });
            container.querySelector('#tokenCharacter').value = '';
            container.querySelector('#tokenName').value = '';
            container.querySelector('#tokenImg').value = '';
            container.querySelector('#tokenHp').value = '';
            container.querySelector('#tokenHpMax').value = '';
            container.querySelector('#tokenAc').value = '';
            container.querySelector('#tokenConditions').value = '';
        } catch (err) {
            alert(`Errore token: ${err.message}`);
        }
    };

    container.querySelector('#tokenCharacter').onchange = (event) => {
        const selectedCharacter = characters.find(char => String(char.id) === String(event.target.value));
        if (!selectedCharacter) return;
        container.querySelector('#tokenName').value = getCharacterName(selectedCharacter);
        container.querySelector('#tokenImg').value = selectedCharacter.data?.portrait || selectedCharacter.avatar_url || '';
        container.querySelector('#tokenHp').value = selectedCharacter.hp || 10;
        container.querySelector('#tokenHpMax').value = selectedCharacter.hp_max || selectedCharacter.hp || 10;
        container.querySelector('#tokenAc').value = selectedCharacter.data?.armorClass || 10;
        container.querySelector('#initiativeCharacter').value = event.target.value;
    };

    container.querySelector('#initiativeCharacter').onchange = (event) => {
        const selectedCharacter = characters.find(char => String(char.id) === String(event.target.value));
        if (!selectedCharacter) return;
        container.querySelector('#initiativeName').value = getCharacterName(selectedCharacter);
        container.querySelector('#initiativeValue').value = '';
    };

    const addInitiativeEntry = (entry) => {
        sessionState.initiative.push(entry);
        sessionState.initiative.sort((a, b) => b.value - a.value);
        renderInitiative();
        saveSessionData();
    };

    container.querySelector('#addInitiative').onclick = () => {
        const name = container.querySelector('#initiativeName').value.trim();
        const value = Number(container.querySelector('#initiativeValue').value || 0);
        if (!name) return;
        addInitiativeEntry({ name, value });
        container.querySelector('#initiativeName').value = '';
        container.querySelector('#initiativeValue').value = '';
    };

    container.querySelector('#rollCharacterInitiative').onclick = () => {
        const selectedCharacterId = container.querySelector('#initiativeCharacter').value;
        const selectedCharacter = characters.find(char => String(char.id) === String(selectedCharacterId));
        if (!selectedCharacter) return;
        const initiativeMod = getCharacterInitiativeMod(selectedCharacter);
        const result = rollDice(20, 1, initiativeMod);
        addInitiativeEntry({
            id: selectedCharacter.id,
            name: getCharacterName(selectedCharacter),
            value: result.total,
            hp: selectedCharacter.hp,
            hp_max: selectedCharacter.hp_max,
            ac: selectedCharacter.data?.armorClass
        });
        sendMsg(`Iniziativa ${getCharacterName(selectedCharacter)}: ${result.total} (${result.rolls[0]} ${formatMod(initiativeMod)})`, true);
        renderInitiative();
    };

    container.querySelector('#sortInitiative').onclick = () => {
        sessionState.initiative.sort((a, b) => b.value - a.value);
        renderInitiative();
        saveSessionData();
    };

    container.querySelector('#nextTurn').onclick = () => {
        if (sessionState.initiative.length > 1) {
            sessionState.initiative.push(sessionState.initiative.shift());
            sessionState.turnCount += 1;
            sessionState.round = Math.floor(sessionState.turnCount / sessionState.initiative.length) + 1;
            renderInitiative();
            saveSessionData();
            sendMsg(`Turno: ${activeInitiativeName()} (round ${sessionState.round}).`, true);
        }
    };

    container.querySelector('#prevTurn').onclick = () => {
        if (sessionState.initiative.length > 1) {
            sessionState.initiative.unshift(sessionState.initiative.pop());
            sessionState.turnCount = Math.max(0, sessionState.turnCount - 1);
            sessionState.round = Math.floor(sessionState.turnCount / sessionState.initiative.length) + 1;
            renderInitiative();
            saveSessionData();
            sendMsg(`Turno precedente: ${activeInitiativeName()} (round ${sessionState.round}).`, true);
        }
    };

    container.querySelector('#clearInitiative').onclick = () => {
        if (!sessionState.initiative.length) return;
        if (!confirm('Svuotare tutta la lista iniziativa?')) return;
        sessionState.initiative = [];
        sessionState.round = 1;
        sessionState.turnCount = 0;
        renderInitiative();
        saveSessionData();
    };

    container.querySelector('#saveLiveNotes').onclick = () => {
        sessionState.scene = container.querySelector('#sceneInput').value.trim();
        sessionState.public_summary = container.querySelector('#publicSummary').value;
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
    container.querySelector('#toggleGrid').onclick = () => {
        sessionState.gridVisible = window.__dndMapApi?.toggleGrid() ?? !sessionState.gridVisible;
        container.querySelector('#toggleGrid').textContent = sessionState.gridVisible ? 'GRID ON' : 'GRID OFF';
        saveSessionData();
    };
    container.querySelector('#zoomIn').onclick = () => window.__dndMapApi?.zoomIn();
    container.querySelector('#zoomOut').onclick = () => window.__dndMapApi?.zoomOut();
    container.querySelector('#resetMap').onclick = () => window.__dndMapApi?.resetView();
    container.querySelector('#pingMap').onclick = () => {
        window.__dndMapApi?.pingCenter();
        sendMsg(`${currentUserName} segnala un punto sulla mappa.`);
    };

    const rollAndLog = (faces, count = 1, mod = 0, label = '') => {
        const mode = container.querySelector('#rollMode')?.value || 'normal';
        let result = rollDice(faces, count, mod);
        let prefix = label || `Tira ${count}d${faces === 100 ? '%' : faces}`;
        if (mode !== 'normal' && faces === 20 && count === 1) {
            const first = rollDice(20, 1, 0).rolls[0];
            const second = rollDice(20, 1, 0).rolls[0];
            const chosen = mode === 'adv' ? Math.max(first, second) : Math.min(first, second);
            result = { rolls: [first, second], total: chosen + mod };
            prefix = `${prefix} ${mode === 'adv' ? 'con vantaggio' : 'con svantaggio'}`;
        }
        sendMsg(`${prefix}: ${result.total} (${result.rolls.join(', ')}${mod ? ` ${formatMod(mod)}` : ''})`, true);
    };

    container.querySelectorAll('.roll-btn').forEach(btn => {
        btn.onclick = () => {
            if (btn.id === 'rollFormula') return;
            const faces = Number(btn.dataset.dice);
            const mod = Number(container.querySelector('#rollMod').value || 0);
            rollAndLog(faces, 1, mod, `Tira d${faces === 100 ? '%' : faces}`);
        };
    });

    container.querySelector('#rollFormula').onclick = () => {
        const formula = container.querySelector('#diceFormula').value;
        const parsed = parseDiceFormula(formula);
        if (!parsed) {
            alert('Formula non valida. Usa esempi come 1d20, 2d6+3, d%.');
            return;
        }
        rollAndLog(
            parsed.faces,
            parsed.count,
            parsed.mod,
            `Tira ${parsed.count}d${parsed.faces === 100 ? '%' : parsed.faces}${parsed.mod ? formatMod(parsed.mod) : ''}`
        );
    };

    const submitChatMessage = () => {
        const input = container.querySelector('#chat-input');
        sendMsg(input.value);
        input.value = '';
    };

    container.querySelector('#chatSubmit').onclick = submitChatMessage;
    container.querySelector('#chatForm').onsubmit = (e) => {
        e.preventDefault();
        submitChatMessage();
    };
    container.querySelector('#chat-input').onkeydown = (e) => {
        if (e.key !== 'Enter' || e.shiftKey) return;
        e.preventDefault();
        submitChatMessage();
    };

    container.querySelector('#exitSession').onclick = async () => {
        cleanupSessionView();
        const initDashboard = await sessionSystem.loadDashboard();
        initDashboard(container);
    };
}
