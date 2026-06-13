import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';
import { supabase, SUPABASE_CONFIG } from '../services/supabase.js';
import { pathfinderLocalStore, getLocalPathfinderUser, isLocalPathfinderUser, isLocalPathfinderUserId } from '../services/dndLocalStore.js';

const TABLES = {
    characters: 'characters',
    sessions: SUPABASE_CONFIG?.tables?.sessions || 'dnd_sessions'
};
const STORAGE = {
    maps: SUPABASE_CONFIG?.buckets?.zaino || 'vtt_assets'
};

const MANUALS = [
    {
        id: 'base',
        title: 'Manuale Base Pathfinder',
        tag: 'Creazione personaggi, prove, combattimento e progressione',
        slug: 'PathfinderBase',
        pages: 10,
        filePageOffset: 0
    },
    {
        id: 'gm',
        title: 'Guida del Game Master',
        tag: 'Sessioni, difficolta, ricompense, esplorazione e gestione tavolo',
        slug: 'PathfinderGM',
        pages: 10,
        filePageOffset: 0
    },
    {
        id: 'bestiary',
        title: 'Bestiario Pathfinder',
        tag: 'Creature, pericoli, incontri e note rapide per i token',
        slug: 'PathfinderBestiario',
        pages: 10,
        filePageOffset: 0
    }
];

const MANUAL_PAGE_WINDOW_SIZE = 10;
const getManualIndexedPages = (manual) => Math.max(1, manual.indexedPages || (manual.pages - Math.max(0, manual.filePageOffset || 0)));
const clampManualPage = (manual, page = 1) => Math.min(getManualIndexedPages(manual), Math.max(1, Number(page) || 1));
const getManualFilePage = (manual, page = 1) => Math.min(manual.pages, Math.max(1, clampManualPage(manual, page) + (manual.filePageOffset || 0)));
const getManualPageUrl = (manual, page = 1) => `/manuals/${manual.slug}/${manual.slug}-${getManualFilePage(manual, page)}.pdf`;
const getManualEmbedUrl = (manual, page = 1) => `${getManualPageUrl(manual, page)}#toolbar=0&navpanes=0&scrollbar=0&view=Fit&zoom=page-fit`;
const getManualFullUrl = (manual) => `/manuals/${manual.slug}/${manual.slug}.pdf`;
const getManualIndexNote = (manual, page = 1) => {
    const manualPage = clampManualPage(manual, page);
    const filePage = getManualFilePage(manual, manualPage);
    return filePage === manualPage ? 'Numerazione allineata al manuale' : `Pagina manuale ${manualPage} -> PDF ${filePage}`;
};

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

    return getLocalPathfinderUser();
};

const getUserId = (user) => user?.id || null;

const isMissingColumnError = (error) => {
    const message = String(error?.message || '');
    return error?.code === '42703'
        || message.includes('does not exist')
        || message.includes('Could not find')
        || message.includes('schema cache');
};

async function loadCharacterRows(userId) {
    if (isLocalPathfinderUserId(userId)) return pathfinderLocalStore.characters.list(userId);

    const preferred = await supabase
        .from(TABLES.characters)
        .select('*')
        .eq('user_id', userId)
        .eq('system_id', 'pathfinder2e')
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
    if (isLocalPathfinderUserId(fullPayload.user_id)) return pathfinderLocalStore.characters.save(char, fullPayload);

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
    const localRows = pathfinderLocalStore.characters.list(localStorage.getItem('taverna_pathfinder2e_local_user_id')).data || [];
    if (localRows.some(item => String(item.id) === String(id))) return pathfinderLocalStore.characters.delete(id);
    return supabase.from(TABLES.characters).delete().eq('id', id);
}

function omitKeys(source, keys) {
    return Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));
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
        scene: data.scene || '',
        data
    };
};

const buildSessionPayload = (form, user, mapUrlOverride = null) => {
    const mapUrl = mapUrlOverride ?? form.get('map_url') ?? '';
    const details = {
        status: form.get('status'),
        party_level: Number(form.get('party_level') || 1),
        next_date: form.get('next_date') || '',
        map_url: mapUrl,
        description: form.get('description') || '',
        party_name: form.get('party_name') || '',
        location: form.get('location') || '',
        visibility: form.get('visibility') || 'privata',
        scene: form.get('scene') || '',
        map_grid_size: Number(form.get('map_grid_size') || 50),
        fogEnabled: form.get('fogEnabled') === 'on',
        gridVisible: form.get('gridVisible') === 'on',
        dm_notes: form.get('dm_notes') || '',
        objectives: form.get('objectives') || '',
        recap: form.get('recap') || '',
        hooks: form.get('hooks') || '',
        planned_encounters: form.get('planned_encounters') || '',
        loot: form.get('loot') || '',
        npcs: form.get('npcs') || '',
        map_notes: form.get('map_notes') || '',
        safety_tools: form.get('safety_tools') || ''
    };
    const userId = getUserId(user);

    return {
        user_id: userId,
        system_id: 'pathfinder2e',
        name: form.get('name'),
        status: details.status,
        party_level: details.party_level,
        next_date: details.next_date,
        map_url: mapUrl,
        description: details.description,
        data: {
            party_name: details.party_name,
            location: details.location,
            visibility: details.visibility,
            scene: details.scene,
            map_grid_size: details.map_grid_size,
            fogEnabled: details.fogEnabled,
            gridVisible: details.gridVisible,
            dm_notes: details.dm_notes,
            objectives: details.objectives,
            recap: details.recap,
            hooks: details.hooks,
            planned_encounters: details.planned_encounters,
            loot: details.loot,
            npcs: details.npcs,
            map_notes: details.map_notes,
            safety_tools: details.safety_tools
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
    const filePath = `pathfinder-maps/${getUserId(user)}/${Date.now()}_${safeName}`;
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
    if (isLocalPathfinderUser(user)) return pathfinderLocalStore.sessions.list(userId);

    const result = await supabase
        .from(TABLES.sessions)
        .select('*')
        .eq('user_id', userId)
        .eq('system_id', 'pathfinder2e')
        .order('created_at', { ascending: false });
    if (!result.error || !isMissingColumnError(result.error)) return result;

    const userOnly = await supabase
        .from(TABLES.sessions)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    return userOnly.error ? userOnly : { ...userOnly, limitedSchema: true };
}

async function saveSessionRow(session, form, user, uploadedMapUrl) {
    const payload = buildSessionPayload(form, user, uploadedMapUrl);
    if (isLocalPathfinderUser(user)) return pathfinderLocalStore.sessions.save(session, payload);
    const query = supabase.from(TABLES.sessions);
    const result = await (session?.id
        ? query.update(payload).eq('id', session.id)
        : query.insert([payload]));
    if (!result.error || !isMissingColumnError(result.error)) return result;

    const fallbackPayload = omitKeys(payload, ['system_id']);
    const fallbackQuery = supabase.from(TABLES.sessions);
    return session?.id
        ? fallbackQuery.update(fallbackPayload).eq('id', session.id)
        : fallbackQuery.insert([fallbackPayload]);
}

async function deleteSessionRow(id, user) {
    if (isLocalPathfinderUser(user)) return pathfinderLocalStore.sessions.delete(id);
    return supabase.from(TABLES.sessions).delete().eq('id', id);
}

const getCharacterData = (char = {}) => {
    char = char || {};
    const defaults = {
        playerName: '',
        subclass: '',
        race: '',
        background: '',
        alignment: '',
        portrait: '',
        age: '',
        deity: '',
        xp: 0,
        tempHp: 0,
        armorClass: 10,
        initiative: 0,
        speed: 9,
        proficiency: 2,
        hitDice: '',
        inspiration: false,
        passivePerception: 10,
        senses: '',
        languages: '',
        currency: '',
        deathSaves: { success: 0, fail: 0 },
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        saves: [],
        skills: [],
        attacks: [],
        spells: [],
        spellcastingAbility: '',
        spellSaveDc: '',
        spellAttackBonus: '',
        spellSlots: '',
        equipment: '',
        features: '',
        personality: '',
        ideals: '',
        bonds: '',
        flaws: '',
        allies: '',
        notes: ''
    };
    const data = char.data || {};
    return {
        ...defaults,
        ...data,
        stats: { ...defaults.stats, ...(data.stats || {}) },
        deathSaves: { ...defaults.deathSaves, ...(data.deathSaves || {}) },
        saves: Array.isArray(data.saves) ? data.saves : [],
        skills: Array.isArray(data.skills) ? data.skills : [],
        attacks: data.attacks || [],
        spells: data.spells || []
    };
};

function resetDndScroll() {
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = 'pan-y';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.backgroundColor = '#05010a';
    window.scrollTo(0, 0);
}

export function initPathfinderDashboard(container) {
    if (!container) return;
    try { updateSidebarContext('pathfinder2e'); } catch { /* sidebar can be unavailable during boot */ }
    resetDndScroll();
    renderDashboard(container);
}

function renderShell(container, activeView = 'overview') {
    container.innerHTML = `
        <div class="dnd-app fade-in">
            <button id="back-to-lobby" class="btn-back-glass dnd-back">TORNA ALLA TAVERNA</button>

            <header class="dnd-hero">
                <div>
                    <p class="dnd-kicker">Sistema Pathfinder 2e</p>
                    <h1>PATHFINDER <span>2E</span></h1>
                    <p>Manuali, personaggi completi, sessioni attive, mappa, dadi e chat di gioco.</p>
                </div>
                <div class="dnd-hero-die">20</div>
            </header>

            <nav class="dnd-tabs" aria-label="Sezioni Pathfinder">
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
                <p>I riferimenti Pathfinder in formato consultabile.</p>
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
    const pageWindowSize = MANUAL_PAGE_WINDOW_SIZE;
    let windowStart = 1;
    const clampPage = (page, manual = selectedManual) => clampManualPage(manual, page);
    const manualPageTotal = () => getManualIndexedPages(selectedManual);
    const maxWindowStart = () => Math.max(1, manualPageTotal() - pageWindowSize + 1);
    const pageWindowEnd = () => Math.min(manualPageTotal(), windowStart + pageWindowSize - 1);
    const visiblePages = () => Array.from(
        { length: pageWindowEnd() - windowStart + 1 },
        (_, index) => windowStart + index
    );

    content.innerHTML = `
        <section class="dnd-section-head">
            <h2>Biblioteca dei Manuali</h2>
            <p>Sfoglia il manuale come un libro: i numeri qui sotto corrispondono alle pagine reali del manuale e ogni blocco mostra massimo ${pageWindowSize} pagine.</p>
        </section>

        <div class="dnd-manual-layout">
            <aside class="dnd-manual-list">
                ${MANUALS.map((manual, index) => `
                    <button class="dnd-manual-card ${index === 0 ? 'active' : ''}" data-manual="${manual.id}">
                        <strong>${manual.title}</strong>
                        <span>${manual.tag}</span>
                        <small>${getManualIndexedPages(manual)} pagine</small>
                    </button>
                `).join('')}
            </aside>
            <section class="dnd-manual-viewer glass-box">
                <div class="dnd-manual-toolbar">
                    <div class="dnd-manual-title">
                        <span>Manuale</span>
                        <strong id="manualTitle">${selectedManual.title}</strong>
                        <small id="manualRange">Pagine reali 1-${pageWindowEnd()} di ${manualPageTotal()}</small>
                        <small id="manualIndexNote" class="dnd-manual-index-note" hidden>${getManualIndexNote(selectedManual, selectedPage)}</small>
                    </div>
                    <div class="dnd-manual-controls">
                        <button type="button" id="manualPrevBlock">Indietro ${pageWindowSize}</button>
                        <label>
                            <span>Vai a pagina</span>
                            <input id="manualPage" type="number" min="1" max="${manualPageTotal()}" value="${selectedPage}">
                        </label>
                        <span id="manualTotal">di ${manualPageTotal()}</span>
                        <button type="button" id="manualGoPage">VAI</button>
                        <button type="button" id="manualNextBlock">Avanti ${pageWindowSize}</button>
                        <a id="manualOpen" href="${getManualPageUrl(selectedManual, selectedPage)}" target="_blank" rel="noreferrer">APRILA PAGINA</a>
                        <a id="manualOpenFull" href="${getManualFullUrl(selectedManual)}" target="_blank" rel="noreferrer">PDF COMPLETO</a>
                    </div>
                </div>
                <div class="dnd-manual-page-strip" id="manualPageStrip" aria-label="Indice pagine visibili"></div>
                <div class="dnd-manual-reader" id="manualReader"></div>
            </section>
        </div>
        <div class="dnd-manual-modal" id="manualPageModal" aria-hidden="true">
            <button type="button" class="dnd-manual-modal-backdrop" data-close-manual-page aria-label="Chiudi pagina"></button>
            <section class="dnd-manual-modal-panel" role="dialog" aria-modal="true" aria-labelledby="manualModalTitle">
                <header>
                    <strong id="manualModalTitle">${selectedManual.title} - Pagina ${selectedPage}</strong>
                    <div>
                        <a id="manualModalOpen" href="${getManualPageUrl(selectedManual, selectedPage)}" target="_blank" rel="noreferrer">Apri PDF</a>
                        <button type="button" data-close-manual-page>Chiudi</button>
                    </div>
                </header>
                <iframe id="manualModalFrame" title="${escapeHTML(selectedManual.title)} - pagina ${selectedPage}" src=""></iframe>
            </section>
        </div>
    `;

    document.querySelectorAll('body > .dnd-manual-modal').forEach(modal => modal.remove());
    const manualModalRoot = content.querySelector('#manualPageModal');
    if (manualModalRoot) document.body.appendChild(manualModalRoot);

    const renderPageFrame = (page) => {
        const pageUrl = getManualPageUrl(selectedManual, page);
        return `
        <a class="dnd-manual-page ${page === selectedPage ? 'active' : ''}" data-page-card="${page}" href="${escapeHTML(pageUrl)}" target="_blank" rel="noreferrer" aria-label="Apri pagina ${page} di ${escapeHTML(selectedManual.title)}">
            <span class="dnd-manual-card-head">
                <span>
                    <span class="dnd-manual-card-kicker">Pagina reale</span>
                    <strong>Pagina ${page}</strong>
                </span>
                <span class="dnd-manual-open-badge">Leggi</span>
            </span>
            <span class="dnd-manual-preview">
                <span class="dnd-manual-preview-fallback">Pagina ${page}</span>
                <iframe class="dnd-manual-preview-frame" width="100%" height="420" title="${escapeHTML(selectedManual.title)} - anteprima pagina ${page}" src="${escapeHTML(getManualEmbedUrl(selectedManual, page))}"></iframe>
            </span>
        </a>
    `;
    };

    const closeManualPageModal = () => {
        const modal = document.querySelector('#manualPageModal');
        const frame = document.querySelector('#manualModalFrame');
        modal?.classList.remove('active');
        modal?.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('dnd-manual-modal-open');
        if (frame) frame.src = '';
    };

    const openManualPageModal = (page) => {
        selectedPage = clampPage(page);
        syncSelectedManualPage();
        const modal = document.querySelector('#manualPageModal');
        const frame = document.querySelector('#manualModalFrame');
        const title = document.querySelector('#manualModalTitle');
        const openLink = document.querySelector('#manualModalOpen');
        const pageUrl = getManualPageUrl(selectedManual, selectedPage);
        if (!modal || !frame || !title || !openLink) return;
        title.textContent = `${selectedManual.title} - Pagina ${selectedPage}`;
        frame.title = `${selectedManual.title} - pagina ${selectedPage}`;
        frame.src = getManualEmbedUrl(selectedManual, selectedPage);
        openLink.href = pageUrl;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('dnd-manual-modal-open');
    };

    const animateReaderTurn = () => {
        const reader = content.querySelector('#manualReader');
        if (!reader) return;
        reader.classList.remove('is-turning');
        void reader.offsetWidth;
        reader.classList.add('is-turning');
        window.setTimeout(() => reader.classList.remove('is-turning'), 520);
    };

    const syncSelectedManualPage = (scrollToCard = false) => {
        const pageInput = content.querySelector('#manualPage');
        const reader = content.querySelector('#manualReader');
        const strip = content.querySelector('#manualPageStrip');
        if (!pageInput || !reader || !strip) return;
        pageInput.value = selectedPage;
        content.querySelector('#manualOpen').href = getManualPageUrl(selectedManual, selectedPage);
        content.querySelector('#manualIndexNote').textContent = getManualIndexNote(selectedManual, selectedPage);
        reader.querySelectorAll('[data-page-card]').forEach(item => {
            item.classList.toggle('active', Number(item.dataset.pageCard) === selectedPage);
        });
        strip.querySelectorAll('[data-page-chip]').forEach(item => {
            item.classList.toggle('active', Number(item.dataset.pageChip) === selectedPage);
        });
        if (scrollToCard) {
            reader.querySelector(`[data-page-card="${selectedPage}"]`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
            animateReaderTurn();
        }
    };

    const syncManualViewer = (resetScroll = false) => {
        const pageInput = content.querySelector('#manualPage');
        const pageTotal = manualPageTotal();
        content.querySelector('#manualTitle').textContent = selectedManual.title;
        content.querySelector('#manualTotal').textContent = `di ${pageTotal}`;
        content.querySelector('#manualRange').textContent = `Pagine reali ${windowStart}-${pageWindowEnd()} di ${pageTotal}`;
        content.querySelector('#manualIndexNote').textContent = getManualIndexNote(selectedManual, selectedPage);
        pageInput.max = pageTotal;
        pageInput.value = selectedPage;
        content.querySelector('#manualOpen').href = getManualPageUrl(selectedManual, selectedPage);
        content.querySelector('#manualOpenFull').href = getManualFullUrl(selectedManual);
        const strip = content.querySelector('#manualPageStrip');
        strip.innerHTML = visiblePages().map(page => `
            <button type="button" class="dnd-manual-page-chip ${page === selectedPage ? 'active' : ''}" data-page-chip="${page}">
                ${page}
            </button>
        `).join('');
        strip.querySelectorAll('[data-page-chip]').forEach(chip => {
            chip.onclick = () => {
                selectedPage = clampPage(chip.dataset.pageChip);
                syncSelectedManualPage(true);
            };
        });
        const reader = content.querySelector('#manualReader');
        reader.innerHTML = visiblePages().map(page => renderPageFrame(page)).join('');
        if (resetScroll) {
            reader.scrollTop = 0;
            reader.scrollLeft = 0;
        } else {
            requestAnimationFrame(() => {
                reader.querySelector(`[data-page-card="${selectedPage}"]`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            });
        }
        reader.querySelectorAll('[data-page-card]').forEach(card => {
            card.onclick = event => {
                event.preventDefault();
                openManualPageModal(card.dataset.pageCard);
            };
        });
        animateReaderTurn();
    };

    const setManualPage = (page, centerWindow = true) => {
        selectedPage = clampPage(page);
        if (centerWindow || selectedPage < windowStart || selectedPage > pageWindowEnd()) {
            windowStart = Math.min(
                Math.max(1, selectedPage - Math.floor(pageWindowSize / 2)),
                maxWindowStart()
            );
        }
        syncManualViewer(centerWindow);
    };

    content.querySelectorAll('[data-manual]').forEach(btn => {
        btn.onclick = () => {
            const manual = MANUALS.find(item => item.id === btn.dataset.manual);
            selectedManual = manual;
            selectedPage = 1;
            windowStart = 1;
            content.querySelectorAll('[data-manual]').forEach(item => item.classList.remove('active'));
            btn.classList.add('active');
            syncManualViewer(true);
        };
    });

    content.querySelector('#manualPrevBlock').onclick = () => {
        windowStart = Math.max(1, windowStart - pageWindowSize);
        selectedPage = windowStart;
        syncManualViewer(true);
    };
    content.querySelector('#manualNextBlock').onclick = () => {
        windowStart = Math.min(maxWindowStart(), windowStart + pageWindowSize);
        selectedPage = windowStart;
        syncManualViewer(true);
    };
    content.querySelector('#manualPage').onchange = event => setManualPage(event.target.value);
    content.querySelector('#manualPage').onkeydown = event => {
        if (event.key === 'Enter') setManualPage(event.target.value);
    };
    content.querySelector('#manualGoPage').onclick = () => setManualPage(content.querySelector('#manualPage').value);
    document.querySelectorAll('#manualPageModal [data-close-manual-page]').forEach(button => {
        button.onclick = closeManualPageModal;
    });
    syncManualViewer();
}

async function renderCharacters(container) {
    renderShell(container, 'characters');
    const content = container.querySelector('#dnd-content');
    const user = await getCurrentUser();
    const userId = getUserId(user);
    if (!userId) {
        content.innerHTML = renderSupabaseAuthError();
        return;
    }

    content.innerHTML = `
        <section class="dnd-section-head dnd-section-actions">
            <div>
                <h2>Personaggi</h2>
                <p>Schede complete Pathfinder 2e con salvataggio Supabase.</p>
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
            <div class="dnd-character-card-media">
                ${data.portrait
                    ? `<img src="${escapeHTML(data.portrait)}" alt="">`
                    : `<span>${escapeHTML((char.name || '?').charAt(0).toUpperCase())}</span>`}
            </div>
            <div>
                <span>${escapeHTML(data.race || 'Stirpe non impostata')} • LV ${escapeHTML(char.level || 1)}${data.subclass ? ` • ${escapeHTML(data.subclass)}` : ''}</span>
                <strong>${escapeHTML(char.name || 'Senza nome')}</strong>
                <p>${escapeHTML(char.class || 'Classe non impostata')} • CA ${escapeHTML(data.armorClass)} • PF ${escapeHTML(char.hp || 10)}/${escapeHTML(char.hp_max || 10)} • Passiva ${escapeHTML(data.passivePerception)}</p>
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
            <span>La tabella Supabase non espone ancora tutte le colonne Pathfinder. Puoi vedere e creare personaggi base, ma per salvare la scheda completa serve aggiornare lo schema.</span>
        </div>
    `;
}

function renderCharacterSchemaError(err) {
    return `
        <div class="dnd-empty glass-box dnd-schema-error">
            <strong>Database personaggi non pronto.</strong>
            <span>${escapeHTML(err.message || 'Tabella personaggi non leggibile.')}</span>
            <p>Esegui lo script <code>supabase/dnd5e_schema.sql</code> nel SQL editor Supabase per abilitare salvataggio completo, ownership utente, PF, sistema e dati JSON della scheda.</p>
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
                    <p>Scheda completa Pathfinder 2e.</p>
                </div>
                <div class="dnd-inline-actions">
                    <button type="button" id="cancelCharacter" class="btn-back-glass">ANNULLA</button>
                    <button type="submit" class="btn-primary">SALVA</button>
                </div>
            </section>

            <section class="dnd-form-section glass-box">
                <h3>Identita</h3>
                <div class="dnd-sheet-grid">
                <label>Nome<input name="name" required value="${escapeHTML(char?.name || '')}"></label>
                <label>Giocatore<input name="playerName" value="${escapeHTML(data.playerName)}"></label>
                <label>Classe<input name="class" required value="${escapeHTML(char?.class || '')}"></label>
                <label>Archetipo<input name="subclass" value="${escapeHTML(data.subclass)}"></label>
                <label>Livello<input name="level" type="number" min="1" max="20" value="${escapeHTML(char?.level || 1)}"></label>
                <label>Stirpe<input name="race" value="${escapeHTML(data.race)}"></label>
                <label>Background<input name="background" value="${escapeHTML(data.background)}"></label>
                <label>Allineamento<input name="alignment" value="${escapeHTML(data.alignment)}"></label>
                <label>XP<input name="xp" type="number" min="0" value="${escapeHTML(data.xp)}"></label>
                <label>Ritratto URL<input name="portrait" value="${escapeHTML(data.portrait)}" placeholder="https://..."></label>
                <label>Eta<input name="age" value="${escapeHTML(data.age)}"></label>
                <label>Divinita / credo<input name="deity" value="${escapeHTML(data.deity)}"></label>
                </div>
            </section>

            <section class="dnd-form-section glass-box">
                <h3>Combattimento</h3>
                <div class="dnd-sheet-grid">
                <label>PF attuali<input name="hp" type="number" value="${escapeHTML(char?.hp || 10)}"></label>
                <label>PF max<input name="hp_max" type="number" value="${escapeHTML(char?.hp_max || 10)}"></label>
                <label>PF temporanei<input name="tempHp" type="number" min="0" value="${escapeHTML(data.tempHp)}"></label>
                <label>CA<input name="armorClass" type="number" value="${escapeHTML(data.armorClass)}"></label>
                <label>Iniziativa<input name="initiative" type="number" value="${escapeHTML(data.initiative)}"></label>
                <label>Velocita<input name="speed" type="number" value="${escapeHTML(data.speed)}"></label>
                <label>Bonus competenza<input name="proficiency" type="number" value="${escapeHTML(data.proficiency)}"></label>
                <label>Dadi vita / recupero<input name="hitDice" value="${escapeHTML(data.hitDice)}"></label>
                <label>Percezione passiva<input name="passivePerception" type="number" value="${escapeHTML(data.passivePerception)}"></label>
                <label>Tiri morte ok<input name="deathSuccess" type="number" min="0" max="3" value="${escapeHTML(data.deathSaves.success)}"></label>
                <label>Tiri morte fail<input name="deathFail" type="number" min="0" max="3" value="${escapeHTML(data.deathSaves.fail)}"></label>
                <label class="dnd-check-inline">Punto Eroe<input name="inspiration" type="checkbox" ${data.inspiration ? 'checked' : ''}></label>
                <label>Sensi<input name="senses" value="${escapeHTML(data.senses)}"></label>
                <label>Linguaggi<input name="languages" value="${escapeHTML(data.languages)}"></label>
                <label>Valute<input name="currency" value="${escapeHTML(data.currency)}"></label>
                </div>
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

            <section class="dnd-form-section glass-box">
                <h3>Magia</h3>
                <div class="dnd-sheet-grid">
                    <label>Caratteristica<input name="spellcastingAbility" value="${escapeHTML(data.spellcastingAbility)}" placeholder="es. Saggezza"></label>
                    <label>CD incantesimi<input name="spellSaveDc" type="number" value="${escapeHTML(data.spellSaveDc)}"></label>
                    <label>Bonus attacco<input name="spellAttackBonus" value="${escapeHTML(data.spellAttackBonus)}" placeholder="+5"></label>
                    <label>Slot<input name="spellSlots" value="${escapeHTML(data.spellSlots)}" placeholder="1:4, 2:3, 3:2"></label>
                </div>
            </section>

            <section class="dnd-textareas glass-box">
                <label>Attacchi e azioni<textarea name="attacks">${escapeHTML(formatRows(data.attacks))}</textarea></label>
                <label>Incantesimi<textarea name="spells">${escapeHTML(formatRows(data.spells))}</textarea></label>
                <label>Equipaggiamento<textarea name="equipment">${escapeHTML(data.equipment)}</textarea></label>
                <label>Privilegi e tratti<textarea name="features">${escapeHTML(data.features)}</textarea></label>
                <label>Personalita<textarea name="personality">${escapeHTML(data.personality)}</textarea></label>
                <label>Ideali<textarea name="ideals">${escapeHTML(data.ideals)}</textarea></label>
                <label>Legami<textarea name="bonds">${escapeHTML(data.bonds)}</textarea></label>
                <label>Difetti<textarea name="flaws">${escapeHTML(data.flaws)}</textarea></label>
                <label>Alleati e organizzazioni<textarea name="allies">${escapeHTML(data.allies)}</textarea></label>
                <label>Note<textarea name="notes">${escapeHTML(data.notes)}</textarea></label>
            </section>
        </form>
    `;

    content.querySelector('#cancelCharacter').onclick = () => renderCharacters(container);
    content.querySelector('#characterForm').onsubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const nextData = {
            playerName: form.get('playerName') || '',
            subclass: form.get('subclass') || '',
            race: form.get('race') || '',
            background: form.get('background') || '',
            alignment: form.get('alignment') || '',
            portrait: form.get('portrait') || '',
            age: form.get('age') || '',
            deity: form.get('deity') || '',
            xp: Number(form.get('xp') || 0),
            tempHp: Number(form.get('tempHp') || 0),
            armorClass: Number(form.get('armorClass') || 10),
            initiative: Number(form.get('initiative') || 0),
            speed: Number(form.get('speed') || 9),
            proficiency: Number(form.get('proficiency') || 2),
            hitDice: form.get('hitDice') || '',
            inspiration: form.get('inspiration') === 'on',
            passivePerception: Number(form.get('passivePerception') || 10),
            senses: form.get('senses') || '',
            languages: form.get('languages') || '',
            currency: form.get('currency') || '',
            deathSaves: {
                success: Number(form.get('deathSuccess') || 0),
                fail: Number(form.get('deathFail') || 0)
            },
            stats: Object.fromEntries(statFields.map(([key]) => [key, Number(form.get(`stat_${key}`) || 10)])),
            saves: saveList.filter(save => form.get(`save_${save}`) === 'on'),
            skills: form.getAll('skill'),
            attacks: parseRows(form.get('attacks')),
            spells: parseRows(form.get('spells')),
            spellcastingAbility: form.get('spellcastingAbility') || '',
            spellSaveDc: form.get('spellSaveDc') || '',
            spellAttackBonus: form.get('spellAttackBonus') || '',
            spellSlots: form.get('spellSlots') || '',
            equipment: form.get('equipment') || '',
            features: form.get('features') || '',
            personality: form.get('personality') || '',
            ideals: form.get('ideals') || '',
            bonds: form.get('bonds') || '',
            flaws: form.get('flaws') || '',
            allies: form.get('allies') || '',
            notes: form.get('notes') || ''
        };
        const payload = {
            user_id: getUserId(user),
            system_id: 'pathfinder2e',
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
    if (!userId) {
        content.innerHTML = renderSupabaseAuthError();
        return;
    }

    content.innerHTML = `
        <section class="dnd-section-head dnd-section-actions">
            <div>
                <h2>Sessioni</h2>
                <p>Crea, modifica, entra e gestisci i tavoli Pathfinder.</p>
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
                    showSession(container, btn.dataset.openSession, { systemId: 'pathfinder2e' });
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
    const data = session.data || {};
    return `
        <article class="dnd-list-card glass-box">
            <div>
                <span>${escapeHTML(session.status || 'attiva')} • LV party ${escapeHTML(session.party_level || 1)}${session.next_date ? ` • ${escapeHTML(session.next_date)}` : ''}</span>
                <strong>${escapeHTML(session.name || 'Sessione senza nome')}</strong>
                <p>${escapeHTML(session.description || data.scene || 'Nessuna descrizione')}${data.location ? ` • ${escapeHTML(data.location)}` : ''}</p>
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

            <section class="dnd-form-section glass-box">
                <h3>Base sessione</h3>
                <div class="dnd-sheet-grid">
                <label>Nome sessione<input name="name" required value="${escapeHTML(normalizedSession?.name || '')}"></label>
                <label>Stato<select name="status">
                    <option value="attiva" ${normalizedSession?.status === 'attiva' ? 'selected' : ''}>Attiva</option>
                    <option value="preparazione" ${normalizedSession?.status === 'preparazione' ? 'selected' : ''}>Preparazione</option>
                    <option value="archiviata" ${normalizedSession?.status === 'archiviata' ? 'selected' : ''}>Archiviata</option>
                </select></label>
                <label>Livello party<input name="party_level" type="number" min="1" max="20" value="${escapeHTML(normalizedSession?.party_level || 1)}"></label>
                <label>Prossima data<input name="next_date" type="text" placeholder="es. venerdi 21:30" value="${escapeHTML(normalizedSession?.next_date || '')}"></label>
                <label>Nome party<input name="party_name" value="${escapeHTML(data.party_name || '')}"></label>
                <label>Luogo corrente<input name="location" value="${escapeHTML(data.location || '')}"></label>
                <label>Visibilita<select name="visibility">
                    <option value="privata" ${(data.visibility || 'privata') === 'privata' ? 'selected' : ''}>Privata master</option>
                    <option value="party" ${data.visibility === 'party' ? 'selected' : ''}>Condivisa party</option>
                </select></label>
                <label>Scena iniziale<input name="scene" value="${escapeHTML(data.scene || '')}"></label>
                </div>
            </section>

            <section class="dnd-form-section glass-box">
                <h3>Mappa</h3>
                <div class="dnd-sheet-grid">
                <label>URL mappa<input name="map_url" placeholder="https://..." value="${escapeHTML(normalizedSession?.map_url || '')}"></label>
                <label>Griglia px<input name="map_grid_size" type="number" min="20" max="200" value="${escapeHTML(data.map_grid_size || 50)}"></label>
                <label class="dnd-check-inline">Nebbia attiva<input name="fogEnabled" type="checkbox" ${data.fogEnabled === true ? 'checked' : ''}></label>
                <label class="dnd-check-inline">Griglia visibile<input name="gridVisible" type="checkbox" ${data.gridVisible !== false ? 'checked' : ''}></label>
                <label class="dnd-map-upload">
                    File mappa opzionale
                    <input name="map_file" type="file" accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg,.webp,.gif">
                    <span>Puoi caricare PDF, JPG, PNG, WEBP o GIF. Se carichi un file, sostituisce l'URL mappa.</span>
                </label>
                </div>
            </section>

            <section class="dnd-textareas glass-box">
                <label>Descrizione<textarea name="description">${escapeHTML(normalizedSession?.description || '')}</textarea></label>
                <label>Recap precedente<textarea name="recap">${escapeHTML(data.recap || '')}</textarea></label>
                <label>Note master<textarea name="dm_notes">${escapeHTML(data.dm_notes || '')}</textarea></label>
                <label>Obiettivi sessione<textarea name="objectives">${escapeHTML(data.objectives || '')}</textarea></label>
                <label>Agganci e indizi<textarea name="hooks">${escapeHTML(data.hooks || '')}</textarea></label>
                <label>Incontri preparati<textarea name="planned_encounters">${escapeHTML(data.planned_encounters || '')}</textarea></label>
                <label>PNG importanti<textarea name="npcs">${escapeHTML(data.npcs || '')}</textarea></label>
                <label>Tesori e ricompense<textarea name="loot">${escapeHTML(data.loot || '')}</textarea></label>
                <label>Note mappa<textarea name="map_notes">${escapeHTML(data.map_notes || '')}</textarea></label>
                <label>Linee e veli<textarea name="safety_tools">${escapeHTML(data.safety_tools || '')}</textarea></label>
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
            <p>Per usare la sezione Pathfinder completa devi eseguire lo script <code>supabase/dnd5e_schema.sql</code> nel SQL editor di Supabase. La tabella condivisa richiesta e <code>dnd_sessions</code>.</p>
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
