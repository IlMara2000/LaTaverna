import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';
import { supabase, SUPABASE_CONFIG } from '../services/supabase.js';

const TABLES = {
    characters: 'characters',
    sessions: 'dnd_sessions',
    legacySessions: SUPABASE_CONFIG?.tables?.sessions || 'session'
};
const STORAGE = {
    maps: SUPABASE_CONFIG?.buckets?.zaino || 'vtt_assets'
};

const MANUALS = [
    {
        id: 'player',
        title: 'Manuale del Giocatore',
        tag: 'Creazione personaggi, classi, razze, regole base',
        slug: 'Giocatore',
        pages: 321
    },
    {
        id: 'master',
        title: 'Guida del Dungeon Master',
        tag: 'Sessioni, incontri, tesori, regole avanzate',
        slug: 'DM',
        pages: 320
    },
    {
        id: 'monsters',
        title: 'Manuale dei Mostri',
        tag: 'Creature, GS, statistiche e incontri',
        slug: 'Mostri',
        pages: 353
    }
];

const getManualPageUrl = (manual, page = 1) => `/manuals/${manual.slug}/${manual.slug}-${page}.pdf`;

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const isUuid = (value = '') => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

const getCurrentUser = async () => {
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
};

const getUserId = (user) => user?.id || null;

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

async function runSessionQuery(buildQuery) {
    const primary = await buildQuery(TABLES.sessions);
    if (!primary.error || !isMissingTableError(primary.error)) return primary;
    const legacy = await buildQuery(TABLES.legacySessions);
    return {
        ...legacy,
        tableName: legacy.error ? TABLES.sessions : TABLES.legacySessions,
        usedFallback: !legacy.error
    };
}

async function loadCharacterRows(userId) {
    const preferred = await supabase
        .from(TABLES.characters)
        .select('*')
        .eq('user_id', userId)
        .eq('system_id', 'dnd5e')
        .order('created_at', { ascending: false });
    if (!preferred.error) return preferred;
    if (!isMissingColumnError(preferred.error)) return preferred;

    const userOnly = await supabase
        .from(TABLES.characters)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (!userOnly.error) return { ...userOnly, limitedSchema: true };
    if (!isMissingColumnError(userOnly.error)) return userOnly;

    const allRows = await supabase
        .from(TABLES.characters)
        .select('*');
    if (!allRows.error) return { ...allRows, limitedSchema: true };
    return allRows;
}

async function saveCharacterRow(char, fullPayload) {
    const attempts = [
        fullPayload,
        omitKeys(fullPayload, ['user_id', 'system_id']),
        omitKeys(fullPayload, ['user_id', 'system_id', 'data']),
        {
            name: fullPayload.name,
            class: fullPayload.class,
            level: fullPayload.level
        },
        {
            name: fullPayload.name,
            class: fullPayload.class
        }
    ];

    let lastError = null;
    for (const payload of attempts) {
        const query = supabase.from(TABLES.characters);
        const result = char?.id
            ? await query.update(payload).eq('id', char.id)
            : await query.insert([payload]);
        if (!result.error) return { ...result, limitedSchema: payload !== fullPayload };
        lastError = result.error;
        if (!isMissingColumnError(result.error)) {
            break;
        }
    }
    return { data: null, error: lastError };
}

async function deleteCharacterRow(id) {
    return supabase.from(TABLES.characters).delete().eq('id', id);
}

function omitKeys(source, keys) {
    return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));
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

const buildSessionPayload = (form, user, compact = false, mapUrlOverride = null) => {
    const mapUrl = mapUrlOverride ?? form.get('map_url') ?? '';
    const details = {
        status: form.get('status'),
        party_level: Number(form.get('party_level') || 1),
        next_date: form.get('next_date') || '',
        map_url: mapUrl,
        description: form.get('description') || '',
        dm_notes: form.get('dm_notes') || '',
        objectives: form.get('objectives') || ''
    };
    const userId = getUserId(user);

    if (compact) {
        return {
            user_id: userId,
            name: form.get('name'),
            data: details
        };
    }

    return {
        user_id: userId,
        name: form.get('name'),
        status: details.status,
        party_level: details.party_level,
        next_date: details.next_date,
        map_url: mapUrl,
        description: details.description,
        data: {
            dm_notes: details.dm_notes,
            objectives: details.objectives
        }
    };
};

async function uploadSessionMapFile(form, user) {
    const file = form.get('map_file');
    if (!(file instanceof File) || !file.name || file.size === 0) return null;

    const safeName = file.name
        .normalize('NFKD')
        .replace(/[^\w.\-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'mappa';
    const filePath = `dnd-maps/${getUserId(user)}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage
        .from(STORAGE.maps)
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || undefined
        });

    if (error) throw error;
    return supabase.storage.from(STORAGE.maps).getPublicUrl(filePath).data.publicUrl;
}

async function loadSessionRows(user) {
    const userId = getUserId(user);

    const result = await runSessionQuery((tableName) => supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }));
    return result;
}

async function saveSessionRow(session, form, user, uploadedMapUrl) {
    return runSessionQuery((tableName) => {
        const payload = buildSessionPayload(form, user, tableName === TABLES.legacySessions, uploadedMapUrl);
        const query = supabase.from(tableName);
        return session?.id
            ? query.update(payload).eq('id', session.id)
            : query.insert([payload]);
    });
}

async function deleteSessionRow(id, user) {
    return runSessionQuery((tableName) => supabase.from(tableName).delete().eq('id', id));
}

const getCharacterData = (char = {}) => ({
    race: '',
    background: '',
    alignment: '',
    xp: 0,
    armorClass: 10,
    initiative: 0,
    speed: 9,
    proficiency: 2,
    hitDice: '',
    deathSaves: { success: 0, fail: 0 },
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saves: [],
    skills: [],
    attacks: [],
    spells: [],
    equipment: '',
    features: '',
    notes: '',
    ...(char.data || {})
});

function resetDndScroll() {
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = 'pan-y';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.backgroundColor = '#05010a';
    window.scrollTo(0, 0);
}

export function initDndDashboard(container) {
    if (!container) return;
    try { updateSidebarContext('dnd5e'); } catch { /* sidebar can be unavailable during boot */ }
    resetDndScroll();
    renderDashboard(container);
}

function renderShell(container, activeView = 'overview') {
    container.innerHTML = `
        <div class="dnd-app fade-in">
            <button id="back-to-lobby" class="btn-back-glass dnd-back">TORNA ALLA LIBRERIA</button>

            <header class="dnd-hero">
                <div>
                    <p class="dnd-kicker">Sistema D&D 5e</p>
                    <h1>DUNGEONS <span>& DRAGONS</span></h1>
                    <p>Manuali, personaggi completi, sessioni attive, mappa, dadi e chat di gioco.</p>
                </div>
                <div class="dnd-hero-die">20</div>
            </header>

            <nav class="dnd-tabs" aria-label="Sezioni D&D">
                <button class="${activeView === 'overview' ? 'active' : ''}" data-dnd-view="overview">Dashboard</button>
                <button class="${activeView === 'sessions' ? 'active' : ''}" data-dnd-view="sessions">Sessioni</button>
                <button class="${activeView === 'manuals' ? 'active' : ''}" data-dnd-view="manuals">Manuali</button>
                <button class="${activeView === 'characters' ? 'active' : ''}" data-dnd-view="characters">Personaggi</button>
            </nav>

            <main id="dnd-content"></main>
        </div>
    `;

    container.querySelector('#back-to-lobby').onclick = () => showLobby(container);
    container.querySelectorAll('[data-dnd-view]').forEach(btn => {
        btn.onclick = () => {
            const view = btn.dataset.dndView;
            if (view === 'overview') renderDashboard(container);
            if (view === 'manuals') renderManuals(container);
            if (view === 'characters') renderCharacters(container);
            if (view === 'sessions') renderSessions(container);
        };
    });
}

function renderDashboard(container) {
    renderShell(container, 'overview');
    const content = container.querySelector('#dnd-content');
    content.innerHTML = `
        <section class="dnd-grid">
            <button class="dnd-panel" data-open="sessions">
                <span>Tavolo</span>
                <strong>Sessioni</strong>
                <p>Crea campagne, entra al tavolo, usa mappa, dadi, token e chat.</p>
            </button>
            <button class="dnd-panel" data-open="manuals">
                <span>Biblioteca</span>
                <strong>Manuali PDF</strong>
                <p>I tre manuali principali in formato consultabile.</p>
            </button>
            <button class="dnd-panel" data-open="characters">
                <span>Schede</span>
                <strong>Personaggi completi</strong>
                <p>Statistiche, abilita, tiri salvezza, incantesimi, inventario e note.</p>
            </button>
        </section>
    `;

    content.querySelector('[data-open="sessions"]').onclick = () => renderSessions(container);
    content.querySelector('[data-open="manuals"]').onclick = () => renderManuals(container);
    content.querySelector('[data-open="characters"]').onclick = () => renderCharacters(container);
}

function renderManuals(container) {
    renderShell(container, 'manuals');
    const content = container.querySelector('#dnd-content');
    let selectedManual = MANUALS[0];
    let selectedPage = 1;
    const selectedManualUrl = () => getManualPageUrl(selectedManual, selectedPage);

    content.innerHTML = `
        <section class="dnd-section-head">
            <h2>Biblioteca dei Manuali</h2>
            <p>I manuali sono caricati a pagine separate dalla cartella pubblica.</p>
        </section>

        <div class="dnd-manual-layout">
            <aside class="dnd-manual-list">
                ${MANUALS.map((manual, index) => `
                    <button class="dnd-manual-card ${index === 0 ? 'active' : ''}" data-manual="${manual.id}">
                        <strong>${manual.title}</strong>
                        <span>${manual.tag}</span>
                        <small>${manual.pages} pagine</small>
                    </button>
                `).join('')}
            </aside>
            <section class="dnd-manual-viewer glass-box">
                <div class="dnd-manual-toolbar">
                    <div>
                        <span>Manuale</span>
                        <strong id="manualTitle">${selectedManual.title}</strong>
                    </div>
                    <div class="dnd-manual-controls">
                        <button type="button" id="manualPrev">INDIETRO</button>
                        <label>
                            <span>Pagina</span>
                            <input id="manualPage" type="number" min="1" max="${selectedManual.pages}" value="${selectedPage}">
                        </label>
                        <span id="manualTotal">di ${selectedManual.pages}</span>
                        <button type="button" id="manualNext">AVANTI</button>
                        <a id="manualOpen" href="${selectedManualUrl()}" target="_blank" rel="noreferrer">APRILA</a>
                    </div>
                </div>
                <iframe id="manualFrame" title="${selectedManual.title}" src="${selectedManualUrl()}"></iframe>
            </section>
        </div>
    `;

    const syncManualViewer = () => {
        const pageInput = content.querySelector('#manualPage');
        content.querySelector('#manualTitle').textContent = selectedManual.title;
        content.querySelector('#manualTotal').textContent = `di ${selectedManual.pages}`;
        pageInput.max = selectedManual.pages;
        pageInput.value = selectedPage;
        content.querySelector('#manualOpen').href = selectedManualUrl();
        const frame = content.querySelector('#manualFrame');
        frame.src = selectedManualUrl();
        frame.title = `${selectedManual.title} - pagina ${selectedPage}`;
    };

    const setManualPage = (page) => {
        selectedPage = Math.min(selectedManual.pages, Math.max(1, Number(page) || 1));
        syncManualViewer();
    };

    content.querySelectorAll('[data-manual]').forEach(btn => {
        btn.onclick = () => {
            const manual = MANUALS.find(item => item.id === btn.dataset.manual);
            selectedManual = manual;
            selectedPage = 1;
            content.querySelectorAll('[data-manual]').forEach(item => item.classList.remove('active'));
            btn.classList.add('active');
            syncManualViewer();
        };
    });

    content.querySelector('#manualPrev').onclick = () => setManualPage(selectedPage - 1);
    content.querySelector('#manualNext').onclick = () => setManualPage(selectedPage + 1);
    content.querySelector('#manualPage').onchange = event => setManualPage(event.target.value);
}

async function renderCharacters(container) {
    renderShell(container, 'characters');
    const content = container.querySelector('#dnd-content');
    const user = await getCurrentUser();
    if (!getUserId(user)) {
        content.innerHTML = renderSupabaseAuthError();
        return;
    }
    if (!userId) {
        content.innerHTML = renderSupabaseAuthError();
        return;
    }

    content.innerHTML = `
        <section class="dnd-section-head dnd-section-actions">
            <div>
                <h2>Personaggi</h2>
                <p>Schede complete D&D 5e con salvataggio Supabase.</p>
            </div>
            <button id="newCharacter" class="btn-primary">NUOVO PERSONAGGIO</button>
        </section>
        <div id="characterList" class="dnd-card-list">
            <p class="dnd-muted">Caricamento personaggi...</p>
        </div>
    `;

    const loadCharacters = async () => {
        const list = content.querySelector('#characterList');
        try {
            const { data, error, limitedSchema } = await loadCharacterRows(userId);
            if (error) throw error;
            const chars = data || [];
            list.innerHTML = `
                ${limitedSchema ? renderCharacterSchemaNotice() : ''}
                ${chars.length ? chars.map(renderCharacterCard).join('') : `
                <div class="dnd-empty glass-box">
                    <strong>Nessun personaggio creato.</strong>
                    <span>Crea la prima scheda completa per iniziare.</span>
                </div>`}
            `;
            list.querySelectorAll('[data-edit-character]').forEach(btn => {
                btn.onclick = () => {
                    const char = chars.find(item => String(item.id) === btn.dataset.editCharacter);
                    renderCharacterEditor(container, user, char);
                };
            });
            list.querySelectorAll('[data-delete-character]').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Eliminare questo personaggio?')) return;
                    const { error: deleteError } = await deleteCharacterRow(btn.dataset.deleteCharacter);
                    if (deleteError) alert(deleteError.message);
                    else loadCharacters();
                };
            });
        } catch (err) {
            list.innerHTML = renderCharacterSchemaError(err);
        }
    };

    content.querySelector('#newCharacter').onclick = () => renderCharacterEditor(container, user, null);
    loadCharacters();
}

function renderCharacterCard(char) {
    const data = getCharacterData(char);
    return `
        <article class="dnd-list-card glass-box">
            <div>
                <span>${escapeHTML(data.race || 'Razza non impostata')} • LV ${escapeHTML(char.level || 1)}</span>
                <strong>${escapeHTML(char.name || 'Senza nome')}</strong>
                <p>${escapeHTML(char.class || 'Classe non impostata')} • CA ${escapeHTML(data.armorClass)} • PF ${escapeHTML(char.hp || 10)}/${escapeHTML(char.hp_max || 10)}</p>
            </div>
            <div class="dnd-inline-actions">
                <button class="btn-back-glass" data-edit-character="${char.id}">APRIMI</button>
                <button class="btn-back-glass" data-delete-character="${char.id}">ELIMINA</button>
            </div>
        </article>
    `;
}

function renderCharacterSchemaNotice() {
    return `
        <div class="dnd-empty glass-box dnd-schema-error">
            <strong>Schema personaggi limitato.</strong>
            <span>La tabella Supabase non espone ancora tutte le colonne D&D. Puoi vedere e creare personaggi base, ma per salvare la scheda completa serve aggiornare lo schema.</span>
        </div>
    `;
}

function renderCharacterSchemaError(err) {
    return `
        <div class="dnd-empty glass-box dnd-schema-error">
            <strong>Database personaggi non pronto.</strong>
            <span>${escapeHTML(err.message || 'Tabella personaggi non leggibile.')}</span>
            <p>Esegui lo script <code>supabase/dnd5e_schema.sql</code> nel SQL editor Supabase per abilitare salvataggio completo, ownership utente, HP, sistema e dati JSON della scheda.</p>
        </div>
    `;
}

function renderSupabaseAuthError() {
    return `
        <div class="dnd-empty glass-box dnd-schema-error">
            <strong>Supabase non collegato.</strong>
            <span>Non riesco a creare un utente Supabase valido per salvare online.</span>
            <p>Configura <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code> e abilita Anonymous Sign-Ins oppure fai accedere l'utente prima di creare personaggi e sessioni.</p>
        </div>
    `;
}

function renderCharacterEditor(container, user, char) {
    renderShell(container, 'characters');
    const content = container.querySelector('#dnd-content');
    const data = getCharacterData(char);
    const stats = data.stats;
    const statFields = [
        ['str', 'Forza'], ['dex', 'Destrezza'], ['con', 'Costituzione'],
        ['int', 'Intelligenza'], ['wis', 'Saggezza'], ['cha', 'Carisma']
    ];
    const skillList = [
        'Acrobazia', 'Addestrare Animali', 'Arcano', 'Atletica', 'Furtivita', 'Indagare',
        'Inganno', 'Intimidire', 'Intrattenere', 'Intuizione', 'Medicina', 'Natura',
        'Percezione', 'Persuasione', 'Rapidita di Mano', 'Religione', 'Sopravvivenza', 'Storia'
    ];
    const saveList = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

    content.innerHTML = `
        <form id="characterForm" class="dnd-sheet">
            <section class="dnd-section-head dnd-section-actions">
                <div>
                    <h2>${char ? 'Modifica Personaggio' : 'Nuovo Personaggio'}</h2>
                    <p>Scheda completa D&D 5e.</p>
                </div>
                <div class="dnd-inline-actions">
                    <button type="button" id="cancelCharacter" class="btn-back-glass">ANNULLA</button>
                    <button type="submit" class="btn-primary">SALVA</button>
                </div>
            </section>

            <section class="dnd-sheet-grid glass-box">
                <label>Nome<input name="name" required value="${escapeHTML(char?.name || '')}"></label>
                <label>Classe<input name="class" required value="${escapeHTML(char?.class || '')}"></label>
                <label>Livello<input name="level" type="number" min="1" max="20" value="${escapeHTML(char?.level || 1)}"></label>
                <label>Razza<input name="race" value="${escapeHTML(data.race)}"></label>
                <label>Background<input name="background" value="${escapeHTML(data.background)}"></label>
                <label>Allineamento<input name="alignment" value="${escapeHTML(data.alignment)}"></label>
                <label>XP<input name="xp" type="number" min="0" value="${escapeHTML(data.xp)}"></label>
                <label>PF attuali<input name="hp" type="number" value="${escapeHTML(char?.hp || 10)}"></label>
                <label>PF max<input name="hp_max" type="number" value="${escapeHTML(char?.hp_max || 10)}"></label>
                <label>CA<input name="armorClass" type="number" value="${escapeHTML(data.armorClass)}"></label>
                <label>Iniziativa<input name="initiative" type="number" value="${escapeHTML(data.initiative)}"></label>
                <label>Velocita<input name="speed" type="number" value="${escapeHTML(data.speed)}"></label>
                <label>Competenza<input name="proficiency" type="number" value="${escapeHTML(data.proficiency)}"></label>
                <label>Dadi Vita<input name="hitDice" value="${escapeHTML(data.hitDice)}"></label>
            </section>

            <section class="dnd-stat-grid">
                ${statFields.map(([key, label]) => `
                    <label class="dnd-stat glass-box">
                        <span>${label}</span>
                        <input name="stat_${key}" type="number" value="${escapeHTML(stats[key])}">
                    </label>
                `).join('')}
            </section>

            <section class="dnd-two-col">
                <div class="glass-box dnd-checks">
                    <h3>Tiri Salvezza</h3>
                    ${saveList.map(save => `
                        <label><input type="checkbox" name="save_${save}" ${data.saves.includes(save) ? 'checked' : ''}> ${save.toUpperCase()}</label>
                    `).join('')}
                </div>
                <div class="glass-box dnd-checks">
                    <h3>Abilita</h3>
                    ${skillList.map(skill => `
                        <label><input type="checkbox" name="skill" value="${escapeHTML(skill)}" ${data.skills.includes(skill) ? 'checked' : ''}> ${skill}</label>
                    `).join('')}
                </div>
            </section>

            <section class="dnd-textareas glass-box">
                <label>Attacchi e azioni<textarea name="attacks">${escapeHTML(formatRows(data.attacks))}</textarea></label>
                <label>Incantesimi<textarea name="spells">${escapeHTML(formatRows(data.spells))}</textarea></label>
                <label>Equipaggiamento<textarea name="equipment">${escapeHTML(data.equipment)}</textarea></label>
                <label>Privilegi e tratti<textarea name="features">${escapeHTML(data.features)}</textarea></label>
                <label>Note<textarea name="notes">${escapeHTML(data.notes)}</textarea></label>
            </section>
        </form>
    `;

    content.querySelector('#cancelCharacter').onclick = () => renderCharacters(container);
    content.querySelector('#characterForm').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const nextData = {
            race: form.get('race') || '',
            background: form.get('background') || '',
            alignment: form.get('alignment') || '',
            xp: Number(form.get('xp') || 0),
            armorClass: Number(form.get('armorClass') || 10),
            initiative: Number(form.get('initiative') || 0),
            speed: Number(form.get('speed') || 9),
            proficiency: Number(form.get('proficiency') || 2),
            hitDice: form.get('hitDice') || '',
            stats: Object.fromEntries(statFields.map(([key]) => [key, Number(form.get(`stat_${key}`) || 10)])),
            saves: saveList.filter(save => form.get(`save_${save}`) === 'on'),
            skills: form.getAll('skill'),
            attacks: parseRows(form.get('attacks')),
            spells: parseRows(form.get('spells')),
            equipment: form.get('equipment') || '',
            features: form.get('features') || '',
            notes: form.get('notes') || ''
        };
        const payload = {
            user_id: getUserId(user),
            system_id: 'dnd5e',
            name: form.get('name'),
            class: form.get('class'),
            level: Number(form.get('level') || 1),
            hp: Number(form.get('hp') || 10),
            hp_max: Number(form.get('hp_max') || 10),
            data: nextData
        };

        try {
            const { error, limitedSchema } = await saveCharacterRow(char, payload);
            if (error) throw error;
            if (limitedSchema) {
                content.querySelector('#characterForm').insertAdjacentHTML('afterbegin', renderCharacterSchemaNotice());
                setTimeout(() => renderCharacters(container), 1200);
                return;
            }
            renderCharacters(container);
        } catch (err) {
            content.querySelector('#characterForm').insertAdjacentHTML('afterbegin', renderCharacterSchemaError(err));
        }
    };
}

async function renderSessions(container) {
    renderShell(container, 'sessions');
    const content = container.querySelector('#dnd-content');
    const user = await getCurrentUser();
    const userId = getUserId(user);

    content.innerHTML = `
        <section class="dnd-section-head dnd-section-actions">
            <div>
                <h2>Sessioni</h2>
                <p>Crea, modifica, entra e gestisci i tavoli D&D.</p>
            </div>
            <button id="newSession" class="btn-primary">NUOVA SESSIONE</button>
        </section>
        <div id="sessionList" class="dnd-card-list"><p class="dnd-muted">Caricamento sessioni...</p></div>
    `;

    const loadSessions = async () => {
        const list = content.querySelector('#sessionList');
        try {
            const { data, error } = await loadSessionRows(user);
            if (error) throw error;
            const sessions = (data || []).map(normalizeSession);
            list.innerHTML = `
                ${sessions.length ? sessions.map(renderSessionCard).join('') : `
                <div class="dnd-empty glass-box">
                    <strong>Nessuna sessione attiva.</strong>
                    <span>Crea il primo tavolo per mappa, chat, token e dadi.</span>
                </div>`}
            `;
            list.querySelectorAll('[data-open-session]').forEach(btn => {
                btn.onclick = async () => {
                    const { showSession } = await import('../components/features/tabletop/Session.js');
                    showSession(container, btn.dataset.openSession);
                };
            });
            list.querySelectorAll('[data-edit-session]').forEach(btn => {
                btn.onclick = () => renderSessionEditor(container, user, sessions.find(item => String(item.id) === btn.dataset.editSession));
            });
            list.querySelectorAll('[data-delete-session]').forEach(btn => {
                btn.onclick = async () => {
                    if (!confirm('Eliminare questa sessione?')) return;
                    const { error } = await deleteSessionRow(btn.dataset.deleteSession, user);
                    if (error) alert(error.message);
                    else loadSessions();
                };
            });
        } catch (err) {
            list.innerHTML = renderSessionSchemaError(err);
        }
    };

    content.querySelector('#newSession').onclick = () => renderSessionEditor(container, user, null);
    loadSessions();
}

function renderSessionCard(session) {
    return `
        <article class="dnd-list-card glass-box">
            <div>
                <span>${escapeHTML(session.status || 'attiva')} • LV party ${escapeHTML(session.party_level || 1)}</span>
                <strong>${escapeHTML(session.name || 'Sessione senza nome')}</strong>
                <p>${escapeHTML(session.description || 'Nessuna descrizione')}</p>
            </div>
            <div class="dnd-inline-actions">
                <button class="btn-primary" data-open-session="${session.id}">ENTRA</button>
                <button class="btn-back-glass" data-edit-session="${session.id}">MODIFICA</button>
                <button class="btn-back-glass" data-delete-session="${session.id}">ELIMINA</button>
            </div>
        </article>
    `;
}

function renderSessionEditor(container, user, session) {
    renderShell(container, 'sessions');
    const content = container.querySelector('#dnd-content');
    const normalizedSession = normalizeSession(session);
    const data = normalizedSession?.data || {};

    content.innerHTML = `
        <form id="sessionForm" class="dnd-sheet">
            <section class="dnd-section-head dnd-section-actions">
                <div>
                    <h2>${session ? 'Modifica Sessione' : 'Nuova Sessione'}</h2>
                    <p>Configurazione tavolo, mappa e note master.</p>
                </div>
                <div class="dnd-inline-actions">
                    <button type="button" id="cancelSession" class="btn-back-glass">ANNULLA</button>
                    <button type="submit" class="btn-primary">SALVA</button>
                </div>
            </section>

            <section class="dnd-sheet-grid glass-box">
                <label>Nome sessione<input name="name" required value="${escapeHTML(normalizedSession?.name || '')}"></label>
                <label>Stato<select name="status">
                    <option value="attiva" ${normalizedSession?.status === 'attiva' ? 'selected' : ''}>Attiva</option>
                    <option value="preparazione" ${normalizedSession?.status === 'preparazione' ? 'selected' : ''}>Preparazione</option>
                    <option value="archiviata" ${normalizedSession?.status === 'archiviata' ? 'selected' : ''}>Archiviata</option>
                </select></label>
                <label>Livello party<input name="party_level" type="number" min="1" max="20" value="${escapeHTML(normalizedSession?.party_level || 1)}"></label>
                <label>Prossima data<input name="next_date" type="text" placeholder="es. venerdi 21:30" value="${escapeHTML(normalizedSession?.next_date || '')}"></label>
                <label>URL mappa<input name="map_url" placeholder="https://..." value="${escapeHTML(normalizedSession?.map_url || '')}"></label>
                <label class="dnd-map-upload">
                    File mappa opzionale
                    <input name="map_file" type="file" accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp,.gif">
                    <span>Puoi caricare PDF, JPG, PNG, WEBP o GIF. Se carichi un file, sostituisce l'URL mappa.</span>
                </label>
            </section>

            <section class="dnd-textareas glass-box">
                <label>Descrizione<textarea name="description">${escapeHTML(normalizedSession?.description || '')}</textarea></label>
                <label>Note master<textarea name="dm_notes">${escapeHTML(data.dm_notes || '')}</textarea></label>
                <label>Obiettivi sessione<textarea name="objectives">${escapeHTML(data.objectives || '')}</textarea></label>
            </section>
        </form>
    `;

    content.querySelector('#cancelSession').onclick = () => renderSessions(container);
    content.querySelector('#sessionForm').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);

        try {
            let uploadedMapUrl = null;
            try {
                uploadedMapUrl = await uploadSessionMapFile(form, user);
            } catch (uploadErr) {
                console.warn('Upload mappa non riuscito, salvo comunque la sessione:', uploadErr);
            }
            const result = await saveSessionRow(session, form, user, uploadedMapUrl);
            if (result.error) throw result.error;
            renderSessions(container);
        } catch (err) {
            content.querySelector('#sessionForm').insertAdjacentHTML('afterbegin', renderSessionSchemaError(err));
        }
    };
}

function renderSessionSchemaError(err) {
    return `
        <div class="dnd-empty glass-box dnd-schema-error">
            <strong>Database sessioni non pronto.</strong>
            <span>${escapeHTML(err.message || 'Tabella sessioni non trovata in Supabase.')}</span>
            <p>Per usare la sezione D&D completa devi eseguire lo script <code>supabase/dnd5e_schema.sql</code> nel SQL editor di Supabase, oppure avere una tabella <code>session</code> compatibile con almeno <code>user_id</code>, <code>name</code> e <code>data</code>.</p>
        </div>
    `;
}

function formatRows(rows = []) {
    if (typeof rows === 'string') return rows;
    return rows.map(row => Object.values(row).filter(Boolean).join(' | ')).join('\n');
}

function parseRows(value = '') {
    return String(value)
        .split('\n')
        .map(row => row.trim())
        .filter(Boolean)
        .map(row => ({ text: row }));
}
