import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';
import { supabase } from '../services/supabase.js';

const TABLES = {
    characters: 'characters',
    sessions: 'dnd_sessions'
};

const MANUALS = [
    {
        id: 'player',
        title: 'Manuale del Giocatore',
        tag: 'Creazione personaggi, classi, razze, regole base',
        file: '/assets/manuali/manuale-giocatore.pdf'
    },
    {
        id: 'master',
        title: 'Guida del Dungeon Master',
        tag: 'Sessioni, incontri, tesori, regole avanzate',
        file: '/assets/manuali/guida-dungeon-master.pdf'
    },
    {
        id: 'monsters',
        title: 'Manuale dei Mostri',
        tag: 'Creature, GS, statistiche e incontri',
        file: '/assets/manuali/manuale-mostri.pdf'
    }
];

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const guest = localStorage.getItem('taverna_guest_user');
    return user || (guest ? JSON.parse(guest) : null);
};

const getUserId = (user) => user?.id || 'guest';

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
                <button class="${activeView === 'manuals' ? 'active' : ''}" data-dnd-view="manuals">Manuali</button>
                <button class="${activeView === 'characters' ? 'active' : ''}" data-dnd-view="characters">Personaggi</button>
                <button class="${activeView === 'sessions' ? 'active' : ''}" data-dnd-view="sessions">Sessioni</button>
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
            <button class="dnd-panel" data-open="sessions">
                <span>Tavolo</span>
                <strong>Sessioni attive</strong>
                <p>Crea campagne, entra al tavolo, usa mappa, dadi, token e chat.</p>
            </button>
        </section>
    `;

    content.querySelector('[data-open="manuals"]').onclick = () => renderManuals(container);
    content.querySelector('[data-open="characters"]').onclick = () => renderCharacters(container);
    content.querySelector('[data-open="sessions"]').onclick = () => renderSessions(container);
}

function renderManuals(container) {
    renderShell(container, 'manuals');
    const content = container.querySelector('#dnd-content');
    content.innerHTML = `
        <section class="dnd-section-head">
            <h2>Biblioteca dei Manuali</h2>
            <p>Carica i PDF nella cartella pubblica indicata e saranno consultabili da qui.</p>
        </section>

        <div class="dnd-manual-layout">
            <aside class="dnd-manual-list">
                ${MANUALS.map((manual, index) => `
                    <button class="dnd-manual-card ${index === 0 ? 'active' : ''}" data-manual="${manual.id}">
                        <strong>${manual.title}</strong>
                        <span>${manual.tag}</span>
                    </button>
                `).join('')}
            </aside>
            <section class="dnd-manual-viewer glass-box">
                <div class="dnd-manual-toolbar">
                    <div>
                        <span>File</span>
                        <strong id="manualTitle">${MANUALS[0].title}</strong>
                    </div>
                    <a id="manualOpen" href="${MANUALS[0].file}" target="_blank" rel="noreferrer">APRILO</a>
                </div>
                <iframe id="manualFrame" title="${MANUALS[0].title}" src="${MANUALS[0].file}"></iframe>
            </section>
        </div>
    `;

    content.querySelectorAll('[data-manual]').forEach(btn => {
        btn.onclick = () => {
            const manual = MANUALS.find(item => item.id === btn.dataset.manual);
            content.querySelectorAll('[data-manual]').forEach(item => item.classList.remove('active'));
            btn.classList.add('active');
            content.querySelector('#manualTitle').textContent = manual.title;
            content.querySelector('#manualOpen').href = manual.file;
            const frame = content.querySelector('#manualFrame');
            frame.src = manual.file;
            frame.title = manual.title;
        };
    });
}

async function renderCharacters(container) {
    renderShell(container, 'characters');
    const content = container.querySelector('#dnd-content');
    const user = await getCurrentUser();
    const userId = getUserId(user);

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
            const { data, error } = await supabase
                .from(TABLES.characters)
                .select('*')
                .eq('user_id', userId)
                .eq('system_id', 'dnd5e')
                .order('created_at', { ascending: false });
            if (error) throw error;
            const chars = data || [];
            list.innerHTML = chars.length ? chars.map(renderCharacterCard).join('') : `
                <div class="dnd-empty glass-box">
                    <strong>Nessun personaggio creato.</strong>
                    <span>Crea la prima scheda completa per iniziare.</span>
                </div>
            `;
            list.querySelectorAll('[data-edit-character]').forEach(btn => {
                btn.onclick = () => {
                    const char = chars.find(item => String(item.id) === btn.dataset.editCharacter);
                    renderCharacterEditor(container, user, char);
                };
            });
        } catch (err) {
            list.innerHTML = `<p class="dnd-error">Errore caricamento personaggi: ${escapeHTML(err.message)}</p>`;
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
            <button class="btn-back-glass" data-edit-character="${char.id}">APRIMI</button>
        </article>
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
            const query = supabase.from(TABLES.characters);
            const { error } = char?.id
                ? await query.update(payload).eq('id', char.id)
                : await query.insert([payload]);
            if (error) throw error;
            renderCharacters(container);
        } catch (err) {
            alert(`Errore salvataggio personaggio: ${err.message}`);
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
                <h2>Sessioni Attive</h2>
                <p>Crea, modifica, entra e gestisci i tavoli D&D.</p>
            </div>
            <button id="newSession" class="btn-primary">NUOVA SESSIONE</button>
        </section>
        <div id="sessionList" class="dnd-card-list"><p class="dnd-muted">Caricamento sessioni...</p></div>
    `;

    const loadSessions = async () => {
        const list = content.querySelector('#sessionList');
        try {
            const { data, error } = await supabase
                .from(TABLES.sessions)
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            const sessions = data || [];
            list.innerHTML = sessions.length ? sessions.map(renderSessionCard).join('') : `
                <div class="dnd-empty glass-box">
                    <strong>Nessuna sessione attiva.</strong>
                    <span>Crea il primo tavolo per mappa, chat, token e dadi.</span>
                </div>
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
                    const { error } = await supabase.from(TABLES.sessions).delete().eq('id', btn.dataset.deleteSession);
                    if (error) alert(error.message);
                    else loadSessions();
                };
            });
        } catch (err) {
            list.innerHTML = `<p class="dnd-error">Errore caricamento sessioni: ${escapeHTML(err.message)}</p>`;
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
    const data = session?.data || {};

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
                <label>Nome sessione<input name="name" required value="${escapeHTML(session?.name || '')}"></label>
                <label>Stato<select name="status">
                    <option value="attiva" ${session?.status === 'attiva' ? 'selected' : ''}>Attiva</option>
                    <option value="preparazione" ${session?.status === 'preparazione' ? 'selected' : ''}>Preparazione</option>
                    <option value="archiviata" ${session?.status === 'archiviata' ? 'selected' : ''}>Archiviata</option>
                </select></label>
                <label>Livello party<input name="party_level" type="number" min="1" max="20" value="${escapeHTML(session?.party_level || 1)}"></label>
                <label>Prossima data<input name="next_date" type="text" placeholder="es. venerdi 21:30" value="${escapeHTML(session?.next_date || '')}"></label>
                <label>URL mappa<input name="map_url" placeholder="https://..." value="${escapeHTML(session?.map_url || data.mapUrl || '')}"></label>
            </section>

            <section class="dnd-textareas glass-box">
                <label>Descrizione<textarea name="description">${escapeHTML(session?.description || '')}</textarea></label>
                <label>Note master<textarea name="dm_notes">${escapeHTML(data.dm_notes || '')}</textarea></label>
                <label>Obiettivi sessione<textarea name="objectives">${escapeHTML(data.objectives || '')}</textarea></label>
            </section>
        </form>
    `;

    content.querySelector('#cancelSession').onclick = () => renderSessions(container);
    content.querySelector('#sessionForm').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const payload = {
            user_id: getUserId(user),
            name: form.get('name'),
            status: form.get('status'),
            party_level: Number(form.get('party_level') || 1),
            next_date: form.get('next_date') || '',
            map_url: form.get('map_url') || '',
            description: form.get('description') || '',
            data: {
                dm_notes: form.get('dm_notes') || '',
                objectives: form.get('objectives') || ''
            }
        };

        try {
            const query = supabase.from(TABLES.sessions);
            const { error } = session?.id
                ? await query.update(payload).eq('id', session.id)
                : await query.insert([payload]);
            if (error) throw error;
            renderSessions(container);
        } catch (err) {
            alert(`Errore salvataggio sessione: ${err.message}`);
        }
    };
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
