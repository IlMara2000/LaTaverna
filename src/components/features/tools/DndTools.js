import './dndTools.css';
import {
    ABILITIES,
    CR_OPTIONS,
    STANDARD_ARRAY,
    abilityModifier,
    calculateChallengeRating,
    calculateEncounter,
    createStandardAbilitySet,
    formatEncounterSummary,
    formatLootSummary,
    formatModifier,
    formatNumber,
    generateLoot,
    pointBuyCost,
    rollAbility,
    rollAbilitySet,
    rollFormula
} from './dndToolEngine.js';

const STORAGE_KEY = 'taverna_dnd_tools_v1';
const INDEX_CACHE = new Map();

const MANUALS = {
    player: { id: 'player', title: 'Manuale del Giocatore', slug: 'Giocatore' },
    master: { id: 'master', title: 'Guida del Dungeon Master', slug: 'DM' },
    monsters: { id: 'monsters', title: 'Manuale dei Mostri', slug: 'Mostri' }
};

const TOOL_CARDS = [
    { id: 'reference', glyph: '⌕', eyebrow: 'Consultazione', title: 'Archivio rapido', description: 'Liste filtrate, ricerca e scheda dettaglio con fonte PDF.', tags: 'regole incantesimi classi creature oggetti condizioni ricerca' },
    { id: 'abilities', glyph: '✦', eyebrow: 'Personaggi', title: 'Caratteristiche', description: '4d6 scarta il minore, serie standard e point buy da 27 punti.', tags: 'stat generator punteggi personaggio dadi point buy' },
    { id: 'encounter', glyph: '⚔', eyebrow: 'Master', title: 'Costruttore incontri', description: 'Party, mostri, PE modificati e difficoltà calcolata in tempo reale.', tags: 'encounter builder combattimento mostri esperienza difficoltà' },
    { id: 'challenge', glyph: '⬡', eyebrow: 'Creature', title: 'Calcolatore GS', description: 'Stima GS difensivo e offensivo da PF, CA, danni e precisione.', tags: 'cr calculator grado sfida mostro statistiche' },
    { id: 'loot', glyph: '◆', eyebrow: 'Ricompense', title: 'Generatore bottino', description: 'Tesori rapidi per fascia di livello, ricchezza e rarità.', tags: 'loot tesoro monete oggetti ricompense' },
    { id: 'initiative', glyph: '➜', eyebrow: 'Combattimento', title: 'Iniziativa', description: 'Ordine dei turni, round, condizioni e punti ferita locali.', tags: 'initiative tracker turni round combattimento' },
    { id: 'screen', glyph: '▦', eyebrow: 'Master', title: 'Schermo del Master', description: 'Promemoria personalizzabili e riferimenti rapidi al tavolo.', tags: 'dm screen regole cd copertura concentrazione azioni' }
];

const REFERENCE_CATEGORIES = [
    { id: 'all', label: 'Tutto', ranges: [] },
    { id: 'classes', label: 'Classi', ranges: [['player', 45, 120]] },
    { id: 'species', label: 'Razze', ranges: [['player', 17, 43]] },
    { id: 'backgrounds', label: 'Background', ranges: [['player', 125, 142]] },
    { id: 'spells', label: 'Incantesimi', ranges: [['player', 201, 289]] },
    { id: 'items', label: 'Oggetti', ranges: [['player', 143, 171], ['master', 133, 232]] },
    { id: 'creatures', label: 'Creature', ranges: [['monsters', 1, 353]] },
    { id: 'rules', label: 'Regole', ranges: [['player', 173, 200], ['master', 235, 289]] },
    { id: 'conditions', label: 'Condizioni', ranges: [['player', 290, 292]] }
];

const DM_WIDGETS = [
    {
        id: 'difficulty',
        category: 'Regole',
        title: 'CD rapide',
        lead: 'Una scala pronta per improvvisare prove senza fermare la scena.',
        rows: [['Molto facile', '5'], ['Facile', '10'], ['Media', '15'], ['Difficile', '20'], ['Molto difficile', '25'], ['Quasi impossibile', '30']],
        source: ['master', 238]
    },
    {
        id: 'cover',
        category: 'Combattimento',
        title: 'Copertura',
        lead: 'La copertura modifica CA e tiri salvezza su Destrezza.',
        rows: [['Mezza', '+2'], ['Tre quarti', '+5'], ['Totale', 'Non bersagliabile direttamente']],
        source: ['player', 196]
    },
    {
        id: 'concentration',
        category: 'Magia',
        title: 'Concentrazione',
        lead: 'Dopo il danno: TS Costituzione con CD 10 o metà del danno, scegliendo il valore più alto.',
        rows: [['Incantesimi attivi', 'Uno alla volta'], ['Incapacitato', 'Termina'], ['Nuova concentrazione', 'Sostituisce la precedente']],
        source: ['player', 203]
    },
    {
        id: 'actions',
        category: 'Combattimento',
        title: 'Azioni del turno',
        lead: 'Le opzioni più comuni quando un giocatore non sa cosa fare.',
        tags: ['Attacco', 'Aiuto', 'Cercare', 'Disimpegno', 'Nascondersi', 'Prepararsi', 'Scatto', 'Schivata', 'Usare un oggetto'],
        source: ['player', 192]
    },
    {
        id: 'conditions',
        category: 'Regole',
        title: 'Condizioni',
        lead: 'Apri una condizione nell’Archivio rapido per trovare il testo completo.',
        tags: ['Accecato', 'Affascinato', 'Afferrato', 'Avvelenato', 'Incapacitato', 'Invisibile', 'Paralizzato', 'Prono', 'Spaventato', 'Stordito', 'Trattenuto'],
        source: ['player', 290],
        searchable: true
    },
    {
        id: 'rests',
        category: 'Avventura',
        title: 'Riposi',
        lead: 'Segna il passaggio del tempo e le risorse recuperate dalla compagnia.',
        rows: [['Riposo breve', 'Almeno 1 ora'], ['Riposo lungo', 'Almeno 8 ore'], ['Dadi Vita', 'Spendibili nel breve']],
        source: ['player', 186]
    },
    {
        id: 'death',
        category: 'Combattimento',
        title: 'Morte e stabilità',
        lead: 'A 0 PF si seguono i tiri salvezza contro morte finché il personaggio non si stabilizza.',
        rows: [['3 successi', 'Stabile'], ['3 fallimenti', 'Morte'], ['20 naturale', 'Recupera 1 PF'], ['1 naturale', 'Due fallimenti']],
        source: ['player', 197]
    },
    {
        id: 'travel',
        category: 'Avventura',
        title: 'Ritmo di viaggio',
        lead: 'Il ritmo cambia velocità, percezione e possibilità di furtività.',
        rows: [['Veloce', 'Più strada, meno attenzione'], ['Normale', 'Equilibrato'], ['Lento', 'Furtività possibile']],
        source: ['player', 182]
    }
];

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const normalizeText = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const loadSavedState = () => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch {
        return {};
    }
};

const manualPageUrl = (manualId, page) => {
    const manual = MANUALS[manualId] || MANUALS.player;
    return `/manuals/${manual.slug}/${manual.slug}-${Math.max(1, Number(page) || 1)}.pdf`;
};

const sourceLink = (manualId, page, label = 'Apri la fonte') => `
    <a class="dnd-tool-source" href="${manualPageUrl(manualId, page)}" target="_blank" rel="noreferrer">
        <span>${escapeHTML(label)}</span>
        <small>${escapeHTML(MANUALS[manualId]?.title || 'Manuale')} · pagina ${page}</small>
    </a>
`;

const copyText = async (value) => {
    try {
        await navigator.clipboard.writeText(String(value));
        return true;
    } catch {
        const area = document.createElement('textarea');
        area.value = String(value);
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const copied = document.execCommand('copy');
        area.remove();
        return copied;
    }
};

const getPageSnippet = (text, query) => {
    const compact = String(text || '').replace(/\s+/g, ' ').trim();
    if (!compact) return 'Testo non riconosciuto per questa pagina.';
    const normalized = normalizeText(compact);
    const tokens = normalizeText(query).split(' ').filter(token => token.length > 1);
    const positions = tokens.map(token => normalized.indexOf(token)).filter(index => index >= 0);
    const start = Math.max(0, (positions.length ? Math.min(...positions) : 0) - 130);
    const snippet = compact.slice(start, start + 620).trim();
    return `${start > 0 ? '…' : ''}${snippet}${start + 620 < compact.length ? '…' : ''}`;
};

const getPageTitle = (text, query, page) => {
    const tokens = normalizeText(query).split(' ').filter(token => token.length > 1);
    const lines = String(text || '').split(/\n+/).map(line => line.replace(/\s+/g, ' ').trim());
    const matching = lines.find(line => {
        const normalized = normalizeText(line);
        return line.length >= 4 && line.length <= 90 && tokens.some(token => normalized.includes(token));
    });
    return matching || `Riferimento a pagina ${page}`;
};

async function loadReferenceIndex(manualId) {
    if (INDEX_CACHE.has(manualId)) return INDEX_CACHE.get(manualId);
    const request = fetch(`/manual-index/dnd5e/${manualId}.json`)
        .then(async response => {
            if (!response.ok) throw new Error(`Indice ${MANUALS[manualId]?.title || manualId} non disponibile.`);
            const data = await response.json();
            return Array.isArray(data.pages) ? data.pages : [];
        })
        .catch(error => {
            INDEX_CACHE.delete(manualId);
            throw error;
        });
    INDEX_CACHE.set(manualId, request);
    return request;
}

const pageMatchesCategory = (page, category) => {
    if (!category || category.id === 'all') return true;
    return category.ranges.some(([manualId, start, end]) => page.manualId === manualId && page.page >= start && page.page <= end);
};

const searchReferencePages = (pages, query, category, manualId) => {
    const normalizedQuery = normalizeText(query);
    const tokens = normalizedQuery.split(' ').filter(token => token.length > 1);
    if (!tokens.length) return [];

    return pages
        .filter(page => (!manualId || manualId === 'all' || page.manualId === manualId) && pageMatchesCategory(page, category))
        .map(page => {
            const normalized = normalizeText(page.text);
            let score = normalized.includes(normalizedQuery) ? 180 : 0;
            let matched = 0;
            tokens.forEach(token => {
                const count = normalized.split(token).length - 1;
                if (count > 0) matched += 1;
                score += Math.min(count, 8) * (token.length >= 6 ? 10 : 6);
            });
            if (matched === tokens.length) score += 60;
            return { ...page, score };
        })
        .filter(page => page.score > 0)
        .sort((a, b) => b.score - a.score || a.page - b.page)
        .slice(0, 40)
        .map(page => ({
            ...page,
            title: getPageTitle(page.text, query, page.page),
            snippet: getPageSnippet(page.text, query)
        }));
};

const renderToolShell = ({ glyph, eyebrow, title, description, body, source = '' }) => `
    <section class="dnd-tool-view fade-in">
        <header class="dnd-tool-view-head">
            <button type="button" class="dnd-tool-back" data-tools-home aria-label="Torna agli strumenti">←</button>
            <span class="dnd-tool-view-glyph" aria-hidden="true">${glyph}</span>
            <div>
                <small>${escapeHTML(eyebrow)}</small>
                <h2>${escapeHTML(title)}</h2>
                <p>${escapeHTML(description)}</p>
            </div>
            ${source}
        </header>
        ${body}
    </section>
`;

export function renderDndTools({ container, onCreateCharacter, onPrepareSession } = {}) {
    if (!container) return;
    const saved = loadSavedState();
    let activeTool = 'hub';
    let abilityMode = saved.abilityMode || 'roll';
    let rolledAbilities = rollAbilitySet();
    let standardAbilities = { ...createStandardAbilitySet(), ...(saved.standardAbilities || {}) };
    let pointAbilities = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8, ...(saved.pointAbilities || {}) };
    let partyRows = Array.isArray(saved.partyRows) && saved.partyRows.length ? saved.partyRows : [{ level: 5, count: 4 }];
    let monsterRows = Array.isArray(saved.monsterRows) && saved.monsterRows.length
        ? saved.monsterRows
        : [{ id: crypto.randomUUID(), name: 'Creatura', cr: '2', count: 1 }];
    let lootResult = null;
    let referencePages = null;
    let referenceQuery = '';
    let referenceCategory = 'all';
    let referenceManual = 'all';
    let referenceResults = [];
    let selectedReference = null;
    let initiative = {
        round: 1,
        turn: 0,
        entries: [],
        ...(saved.initiative || {})
    };
    let pinnedWidgets = Array.isArray(saved.pinnedWidgets) && saved.pinnedWidgets.length
        ? saved.pinnedWidgets.filter(id => DM_WIDGETS.some(widget => widget.id === id))
        : DM_WIDGETS.slice(0, 5).map(widget => widget.id);

    const persist = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            abilityMode,
            standardAbilities,
            pointAbilities,
            partyRows,
            monsterRows,
            initiative,
            pinnedWidgets
        }));
    };

    container.innerHTML = '<div class="dnd-tools-root" id="dndToolsRoot"></div>';
    const root = container.querySelector('#dndToolsRoot');

    const setStatus = (message, tone = 'ok') => {
        const status = root.querySelector('[data-tool-status]');
        if (!status) return;
        status.textContent = message;
        status.dataset.tone = tone;
        window.clearTimeout(setStatus.timer);
        setStatus.timer = window.setTimeout(() => {
            if (status.isConnected) status.textContent = '';
        }, 2600);
    };

    const wireHomeButton = () => {
        root.querySelector('[data-tools-home]')?.addEventListener('click', renderHub);
    };

    const openTool = (toolId) => {
        activeTool = toolId;
        if (toolId === 'reference') renderReference();
        if (toolId === 'abilities') renderAbilities();
        if (toolId === 'encounter') renderEncounter();
        if (toolId === 'challenge') renderChallengeRating();
        if (toolId === 'loot') renderLoot();
        if (toolId === 'initiative') renderInitiative();
        if (toolId === 'screen') renderDmScreen();
        root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    function renderHub() {
        activeTool = 'hub';
        root.innerHTML = `
            <section class="dnd-tools-hub fade-in">
                <header class="dnd-tools-heading">
                    <div>
                        <span>Banco dell’avventuriero</span>
                        <h2>STRUMENTI DEL VIANDANTE</h2>
                        <p>Calcola, prepara e consulta senza lasciare il tavolo. Tutto funziona in italiano e resta separato dalla Biblioteca.</p>
                    </div>
                    <div class="dnd-tools-orb" aria-hidden="true"><strong>d20</strong><i></i></div>
                </header>

                <div class="dnd-tools-command-bar">
                    <label>
                        <span aria-hidden="true">⌕</span>
                        <input type="search" id="toolFinder" autocomplete="off" placeholder="Cerca uno strumento: incontro, bottino, iniziativa…">
                    </label>
                    <div class="dnd-tools-dice" aria-label="Dadi rapidi">
                        ${[4, 6, 8, 10, 12, 20, 100].map(faces => `<button type="button" data-quick-die="${faces}">d${faces === 100 ? '%' : faces}</button>`).join('')}
                    </div>
                    <output id="quickDieResult" aria-live="polite"><span>Tiro rapido</span><strong>—</strong></output>
                </div>

                <div class="dnd-tools-grid" id="dndToolsGrid">
                    ${TOOL_CARDS.map(tool => `
                        <button type="button" class="dnd-tool-card" data-open-tool="${tool.id}" data-tool-search="${escapeHTML(`${tool.title} ${tool.tags}`)}">
                            <span class="dnd-tool-card-glyph" aria-hidden="true">${tool.glyph}</span>
                            <small>${tool.eyebrow}</small>
                            <strong>${tool.title}</strong>
                            <p>${tool.description}</p>
                            <i>Apri strumento →</i>
                        </button>
                    `).join('')}
                </div>
                <p class="dnd-tools-no-results" id="toolFinderEmpty" hidden>Nessuno strumento corrisponde alla ricerca.</p>
                <p class="dnd-tool-toast" data-tool-status role="status" aria-live="polite"></p>
            </section>
        `;

        root.querySelectorAll('[data-open-tool]').forEach(button => {
            button.onclick = () => openTool(button.dataset.openTool);
        });
        root.querySelectorAll('[data-quick-die]').forEach(button => {
            button.onclick = () => {
                const faces = Number(button.dataset.quickDie);
                const result = rollFormula(`1d${faces}`);
                const output = root.querySelector('#quickDieResult');
                output.querySelector('span').textContent = `d${faces === 100 ? '%' : faces}`;
                output.querySelector('strong').textContent = result.total;
                output.classList.remove('is-rolling');
                requestAnimationFrame(() => output.classList.add('is-rolling'));
            };
        });
        root.querySelector('#toolFinder').oninput = event => {
            const query = normalizeText(event.currentTarget.value);
            let visible = 0;
            root.querySelectorAll('.dnd-tool-card').forEach(card => {
                const match = !query || normalizeText(card.dataset.toolSearch).includes(query);
                card.hidden = !match;
                if (match) visible += 1;
            });
            root.querySelector('#toolFinderEmpty').hidden = visible > 0;
        };
    }

    async function ensureReferencePages() {
        if (referencePages) return referencePages;
        const pageGroups = await Promise.all(Object.keys(MANUALS).map(loadReferenceIndex));
        referencePages = pageGroups.flat();
        return referencePages;
    }

    function renderReference() {
        const body = `
            <div class="dnd-reference-layout">
                <aside class="dnd-reference-controls">
                    <label class="dnd-tool-field">
                        <span>Cerca una regola o una voce</span>
                        <input id="referenceSearch" type="search" autocomplete="off" value="${escapeHTML(referenceQuery)}" placeholder="Es. palla di fuoco, attacco furtivo, troll…">
                    </label>
                    <label class="dnd-tool-field">
                        <span>Manuale</span>
                        <select id="referenceManual">
                            <option value="all">Tutti i manuali</option>
                            ${Object.values(MANUALS).map(manual => `<option value="${manual.id}" ${referenceManual === manual.id ? 'selected' : ''}>${manual.title}</option>`).join('')}
                        </select>
                    </label>
                    <div class="dnd-reference-filters" aria-label="Tipo di contenuto">
                        ${REFERENCE_CATEGORIES.map(category => `<button type="button" class="${referenceCategory === category.id ? 'active' : ''}" data-reference-category="${category.id}">${category.label}</button>`).join('')}
                    </div>
                    <div class="dnd-reference-suggestions">
                        <span>Prova subito</span>
                        ${['attacco di opportunità', 'concentrazione', 'drago rosso', 'cura ferite'].map(query => `<button type="button" data-reference-suggestion="${escapeHTML(query)}">${escapeHTML(query)}</button>`).join('')}
                    </div>
                    <p class="dnd-reference-note">L’Archivio rapido è uno strumento autonomo: legge gli indici locali e apre direttamente la pagina PDF.</p>
                </aside>
                <section class="dnd-reference-browser">
                    <div class="dnd-reference-list" id="referenceList">
                        <div class="dnd-tool-empty"><strong>Scrivi ciò che cerchi</strong><span>Non serve conoscere il nome esatto.</span></div>
                    </div>
                    <article class="dnd-reference-detail" id="referenceDetail">
                        <div class="dnd-tool-empty"><strong>Nessuna scheda selezionata</strong><span>I risultati compariranno qui con fonte e pagina.</span></div>
                    </article>
                </section>
            </div>
            <p class="dnd-tool-toast" data-tool-status role="status" aria-live="polite"></p>
        `;
        root.innerHTML = renderToolShell({
            glyph: '⌕',
            eyebrow: 'Consultazione autonoma',
            title: 'Archivio rapido',
            description: 'Ricerca filtrata e scheda dettaglio costruite sugli indici italiani già presenti nel sito.',
            body
        });
        wireHomeButton();

        const searchInput = root.querySelector('#referenceSearch');
        const runSearch = async () => {
            referenceQuery = searchInput.value.trim();
            const list = root.querySelector('#referenceList');
            if (referenceQuery.length < 2) {
                referenceResults = [];
                selectedReference = null;
                list.innerHTML = '<div class="dnd-tool-empty"><strong>Scrivi almeno due caratteri</strong><span>Puoi usare una descrizione naturale.</span></div>';
                renderReferenceDetail();
                return;
            }
            list.innerHTML = '<div class="dnd-tool-loading"><i></i><span>Consulto gli indici…</span></div>';
            try {
                const pages = await ensureReferencePages();
                const category = REFERENCE_CATEGORIES.find(item => item.id === referenceCategory) || REFERENCE_CATEGORIES[0];
                referenceResults = searchReferencePages(pages, referenceQuery, category, referenceManual);
                selectedReference = referenceResults[0] || null;
                renderReferenceList();
                renderReferenceDetail();
            } catch (error) {
                list.innerHTML = `<div class="dnd-tool-empty is-error"><strong>Indice non disponibile</strong><span>${escapeHTML(error.message)}</span></div>`;
            }
        };

        const renderReferenceList = () => {
            const list = root.querySelector('#referenceList');
            if (!referenceResults.length) {
                list.innerHTML = '<div class="dnd-tool-empty"><strong>Nessun risultato</strong><span>Prova una descrizione più generale o cambia filtro.</span></div>';
                return;
            }
            list.innerHTML = `
                <header><strong>${referenceResults.length} riferimenti</strong><span>ordinati per pertinenza</span></header>
                ${referenceResults.map((result, index) => `
                    <button type="button" class="${selectedReference === result ? 'active' : ''}" data-reference-index="${index}">
                        <small>${escapeHTML(MANUALS[result.manualId]?.title || result.manualId)} · p. ${result.page}</small>
                        <strong>${escapeHTML(result.title)}</strong>
                        <span>${escapeHTML(result.snippet.slice(0, 130))}</span>
                    </button>
                `).join('')}
            `;
            list.querySelectorAll('[data-reference-index]').forEach(button => {
                button.onclick = () => {
                    selectedReference = referenceResults[Number(button.dataset.referenceIndex)] || null;
                    renderReferenceList();
                    renderReferenceDetail();
                };
            });
        };

        const renderReferenceDetail = () => {
            const detail = root.querySelector('#referenceDetail');
            if (!selectedReference) {
                detail.innerHTML = '<div class="dnd-tool-empty"><strong>Nessuna scheda selezionata</strong><span>I risultati compariranno qui con fonte e pagina.</span></div>';
                return;
            }
            const manual = MANUALS[selectedReference.manualId] || MANUALS.player;
            detail.innerHTML = `
                <span class="dnd-reference-detail-kicker">${escapeHTML(manual.title)} · pagina ${selectedReference.page}</span>
                <h3>${escapeHTML(selectedReference.title)}</h3>
                <p>${escapeHTML(selectedReference.snippet)}</p>
                <div class="dnd-reference-detail-actions">
                    <a href="${manualPageUrl(selectedReference.manualId, selectedReference.page)}" target="_blank" rel="noreferrer">APRI LA PAGINA PDF</a>
                    <button type="button" id="copyReference">COPIA PASSAGGIO</button>
                </div>
            `;
            detail.querySelector('#copyReference').onclick = async () => {
                await copyText(`${selectedReference.title}\n${selectedReference.snippet}\n${manual.title}, pagina ${selectedReference.page}`);
                setStatus('Passaggio copiato.');
            };
        };

        let searchTimer = 0;
        searchInput.oninput = () => {
            window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(runSearch, 220);
        };
        root.querySelector('#referenceManual').onchange = event => {
            referenceManual = event.currentTarget.value;
            runSearch();
        };
        root.querySelectorAll('[data-reference-category]').forEach(button => {
            button.onclick = () => {
                referenceCategory = button.dataset.referenceCategory;
                root.querySelectorAll('[data-reference-category]').forEach(item => item.classList.toggle('active', item === button));
                runSearch();
            };
        });
        root.querySelectorAll('[data-reference-suggestion]').forEach(button => {
            button.onclick = () => {
                searchInput.value = button.dataset.referenceSuggestion;
                runSearch();
            };
        });
        if (referenceQuery) runSearch();
    }

    function getAbilityScores() {
        if (abilityMode === 'roll') {
            return Object.fromEntries(ABILITIES.map(ability => [ability.id, rolledAbilities[ability.id].total]));
        }
        return abilityMode === 'standard' ? { ...standardAbilities } : { ...pointAbilities };
    }

    function renderAbilities() {
        const scores = getAbilityScores();
        const spent = pointBuyCost(pointAbilities);
        const body = `
            <div class="dnd-ability-modes" role="tablist" aria-label="Metodo caratteristiche">
                <button type="button" class="${abilityMode === 'roll' ? 'active' : ''}" data-ability-mode="roll">4d6</button>
                <button type="button" class="${abilityMode === 'standard' ? 'active' : ''}" data-ability-mode="standard">Serie standard</button>
                <button type="button" class="${abilityMode === 'point' ? 'active' : ''}" data-ability-mode="point">Acquisto punti</button>
            </div>
            <section class="dnd-ability-workbench">
                <header>
                    <div>
                        <strong>${abilityMode === 'roll' ? 'Tira quattro d6 e scarta il più basso' : abilityMode === 'standard' ? 'Assegna 15, 14, 13, 12, 10 e 8' : 'Spendi fino a 27 punti'}</strong>
                        <span>${abilityMode === 'point' ? `${27 - spent} punti disponibili` : 'Modificatori calcolati automaticamente'}</span>
                    </div>
                    ${abilityMode === 'roll' ? '<button type="button" id="rollAllAbilities">RITIRA TUTTO</button>' : ''}
                </header>
                <div class="dnd-ability-grid">
                    ${ABILITIES.map(ability => {
                        const score = scores[ability.id];
                        const roll = rolledAbilities[ability.id];
                        return `
                            <article class="dnd-ability-card">
                                <small>${ability.short}</small>
                                <strong>${ability.label}</strong>
                                ${abilityMode === 'standard' ? `
                                    <select data-standard-ability="${ability.id}" aria-label="${ability.label}">
                                        ${STANDARD_ARRAY.map(value => `<option value="${value}" ${score === value ? 'selected' : ''}>${value}</option>`).join('')}
                                    </select>
                                ` : abilityMode === 'point' ? `
                                    <div class="dnd-ability-stepper">
                                        <button type="button" data-point-step="-1" data-ability="${ability.id}" ${score <= 8 ? 'disabled' : ''}>−</button>
                                        <b>${score}</b>
                                        <button type="button" data-point-step="1" data-ability="${ability.id}" ${score >= 15 ? 'disabled' : ''}>+</button>
                                    </div>
                                ` : `
                                    <b>${score}</b>
                                    <div class="dnd-ability-dice">${roll.rolls.map(value => `<i class="${value === roll.discarded && roll.rolls.filter(item => item === value).length === 1 ? 'discarded' : ''}">${value}</i>`).join('')}</div>
                                    <button type="button" class="dnd-ability-reroll" data-reroll-ability="${ability.id}">Ritira</button>
                                `}
                                <span>${formatModifier(abilityModifier(score))}</span>
                            </article>
                        `;
                    }).join('')}
                </div>
                ${abilityMode === 'point' ? `
                    <div class="dnd-point-budget ${spent > 27 ? 'is-over' : ''}">
                        <span>Budget speso</span><strong>${spent} / 27</strong><i style="--budget:${Math.min(100, (spent / 27) * 100)}%"></i>
                    </div>
                ` : ''}
                <footer class="dnd-tool-actions">
                    <button type="button" id="copyAbilities">COPIA PUNTEGGI</button>
                    <button type="button" class="primary" id="useAbilities" ${abilityMode === 'point' && spent > 27 ? 'disabled' : ''}>USA IN UNA NUOVA SCHEDA</button>
                </footer>
            </section>
            <p class="dnd-tool-toast" data-tool-status role="status" aria-live="polite"></p>
        `;
        root.innerHTML = renderToolShell({
            glyph: '✦',
            eyebrow: 'Generatore personaggio',
            title: 'Caratteristiche',
            description: 'Tre metodi completi, modificatori automatici e passaggio diretto alla scheda personaggio.',
            body,
            source: sourceLink('player', 13, 'Regola di riferimento')
        });
        wireHomeButton();
        root.querySelectorAll('[data-ability-mode]').forEach(button => {
            button.onclick = () => {
                abilityMode = button.dataset.abilityMode;
                persist();
                renderAbilities();
            };
        });
        root.querySelector('#rollAllAbilities')?.addEventListener('click', () => {
            rolledAbilities = rollAbilitySet();
            renderAbilities();
        });
        root.querySelectorAll('[data-reroll-ability]').forEach(button => {
            button.onclick = () => {
                rolledAbilities[button.dataset.rerollAbility] = rollAbility();
                renderAbilities();
            };
        });
        root.querySelectorAll('[data-standard-ability]').forEach(select => {
            select.onchange = () => {
                const abilityId = select.dataset.standardAbility;
                const previous = standardAbilities[abilityId];
                const next = Number(select.value);
                const swapId = ABILITIES.find(ability => ability.id !== abilityId && standardAbilities[ability.id] === next)?.id;
                standardAbilities[abilityId] = next;
                if (swapId) standardAbilities[swapId] = previous;
                persist();
                renderAbilities();
            };
        });
        root.querySelectorAll('[data-point-step]').forEach(button => {
            button.onclick = () => {
                const abilityId = button.dataset.ability;
                pointAbilities[abilityId] = Math.min(15, Math.max(8, pointAbilities[abilityId] + Number(button.dataset.pointStep)));
                persist();
                renderAbilities();
            };
        });
        root.querySelector('#copyAbilities').onclick = async () => {
            const current = getAbilityScores();
            const text = ABILITIES.map(ability => `${ability.short} ${current[ability.id]} (${formatModifier(abilityModifier(current[ability.id]))})`).join(' · ');
            await copyText(text);
            setStatus('Punteggi copiati.');
        };
        root.querySelector('#useAbilities').onclick = async () => {
            if (typeof onCreateCharacter !== 'function') return;
            persist();
            await onCreateCharacter(getAbilityScores());
        };
    }

    function renderEncounter() {
        const body = `
            <div class="dnd-encounter-layout">
                <section class="dnd-encounter-builder">
                    <div class="dnd-tool-block-head"><div><small>1</small><strong>Composizione del gruppo</strong></div><button type="button" id="addPartyRow">+ FASCIA</button></div>
                    <div class="dnd-builder-rows" id="partyRows">
                        ${partyRows.map((row, index) => `
                            <div class="dnd-builder-row" data-party-row="${index}">
                                <label><span>Livello</span><input type="number" min="1" max="20" value="${row.level}" data-party-field="level"></label>
                                <label><span>Personaggi</span><input type="number" min="1" max="20" value="${row.count}" data-party-field="count"></label>
                                <button type="button" data-remove-party="${index}" aria-label="Rimuovi fascia" ${partyRows.length === 1 ? 'disabled' : ''}>×</button>
                            </div>
                        `).join('')}
                    </div>

                    <div class="dnd-tool-block-head"><div><small>2</small><strong>Avversari</strong></div><button type="button" id="addMonsterRow">+ CREATURA</button></div>
                    <div class="dnd-builder-rows" id="monsterRows">
                        ${monsterRows.map((row, index) => `
                            <div class="dnd-builder-row monster" data-monster-row="${index}">
                                <label><span>Nome</span><input type="text" value="${escapeHTML(row.name)}" data-monster-field="name"></label>
                                <label><span>GS</span><select data-monster-field="cr">${CR_OPTIONS.map(option => `<option value="${option.value}" ${row.cr === option.value ? 'selected' : ''}>${option.value} · ${formatNumber(option.xp)} PE</option>`).join('')}</select></label>
                                <label><span>Numero</span><input type="number" min="1" max="50" value="${row.count}" data-monster-field="count"></label>
                                <button type="button" data-remove-monster="${index}" aria-label="Rimuovi creatura">×</button>
                            </div>
                        `).join('')}
                    </div>
                </section>
                <aside class="dnd-encounter-result" id="encounterResult" aria-live="polite"></aside>
            </div>
            <p class="dnd-tool-toast" data-tool-status role="status" aria-live="polite"></p>
        `;
        root.innerHTML = renderToolShell({
            glyph: '⚔',
            eyebrow: 'Preparazione del Master',
            title: 'Costruttore incontri',
            description: 'Combina livelli e GS: soglie, moltiplicatore numerico e difficoltà si aggiornano mentre scrivi.',
            body,
            source: sourceLink('master', 82, 'Regole degli incontri')
        });
        wireHomeButton();

        const readRows = () => {
            root.querySelectorAll('[data-party-row]').forEach(rowElement => {
                const index = Number(rowElement.dataset.partyRow);
                rowElement.querySelectorAll('[data-party-field]').forEach(input => {
                    partyRows[index][input.dataset.partyField] = Number(input.value);
                });
            });
            root.querySelectorAll('[data-monster-row]').forEach(rowElement => {
                const index = Number(rowElement.dataset.monsterRow);
                rowElement.querySelectorAll('[data-monster-field]').forEach(input => {
                    monsterRows[index][input.dataset.monsterField] = input.dataset.monsterField === 'count' ? Number(input.value) : input.value;
                });
            });
        };

        const updateResult = () => {
            readRows();
            persist();
            const result = calculateEncounter(partyRows, monsterRows);
            const summary = formatEncounterSummary(result);
            const difficultyClass = normalizeText(result.difficulty);
            root.querySelector('#encounterResult').innerHTML = `
                <span>Valutazione incontro</span>
                <strong class="dnd-difficulty ${difficultyClass}">${result.difficulty}</strong>
                <div class="dnd-encounter-metrics">
                    <div><small>PE base</small><b>${formatNumber(result.baseXp)}</b></div>
                    <div><small>Moltiplicatore</small><b>×${result.multiplier}</b></div>
                    <div><small>PE modificati</small><b>${formatNumber(result.adjustedXp)}</b></div>
                    <div><small>PE per PG</small><b>${formatNumber(result.xpPerCharacter)}</b></div>
                </div>
                <div class="dnd-threshold-track">
                    ${Object.entries(result.thresholds).map(([key, value]) => `<div><span>${({ easy: 'Facile', medium: 'Medio', hard: 'Difficile', deadly: 'Letale' })[key]}</span><strong>${formatNumber(value)}</strong></div>`).join('')}
                </div>
                <p>${escapeHTML(summary)}</p>
                <div class="dnd-tool-actions vertical">
                    <button type="button" id="copyEncounter">COPIA RIASSUNTO</button>
                    <button type="button" class="primary" id="prepareEncounter">PREPARA UNA SESSIONE</button>
                </div>
            `;
            root.querySelector('#copyEncounter').onclick = async () => {
                await copyText(summary);
                setStatus('Incontro copiato.');
            };
            root.querySelector('#prepareEncounter').onclick = async () => {
                if (typeof onPrepareSession !== 'function') return;
                const weightedLevel = result.partySize
                    ? Math.round(result.party.reduce((sum, row) => sum + row.level * row.count, 0) / result.partySize)
                    : 1;
                persist();
                await onPrepareSession({ party_level: weightedLevel, planned_encounters: summary });
            };
        };

        root.querySelectorAll('.dnd-builder-row input, .dnd-builder-row select').forEach(input => {
            input.addEventListener('input', updateResult);
            input.addEventListener('change', updateResult);
        });
        root.querySelector('#addPartyRow').onclick = () => {
            readRows();
            partyRows.push({ level: partyRows.at(-1)?.level || 1, count: 1 });
            persist();
            renderEncounter();
        };
        root.querySelectorAll('[data-remove-party]').forEach(button => {
            button.onclick = () => {
                readRows();
                partyRows.splice(Number(button.dataset.removeParty), 1);
                persist();
                renderEncounter();
            };
        });
        root.querySelector('#addMonsterRow').onclick = () => {
            readRows();
            monsterRows.push({ id: crypto.randomUUID(), name: 'Creatura', cr: '1', count: 1 });
            persist();
            renderEncounter();
        };
        root.querySelectorAll('[data-remove-monster]').forEach(button => {
            button.onclick = () => {
                readRows();
                monsterRows.splice(Number(button.dataset.removeMonster), 1);
                if (!monsterRows.length) monsterRows.push({ id: crypto.randomUUID(), name: 'Creatura', cr: '0', count: 1 });
                persist();
                renderEncounter();
            };
        });
        updateResult();
    }

    function renderChallengeRating() {
        const body = `
            <div class="dnd-cr-layout">
                <form class="dnd-cr-form" id="crForm">
                    <section>
                        <span>Difesa</span>
                        <label>PF medi<input name="hp" type="number" min="1" value="85"></label>
                        <label>Classe Armatura<input name="ac" type="number" min="1" value="14"></label>
                        <label>Resistenze / vulnerabilità<select name="hpMultiplier">
                            <option value="0.5">Vulnerabile ×0,5 PF</option>
                            <option value="1" selected>Nessun effetto ×1</option>
                            <option value="1.5">Resistente ×1,5 PF</option>
                            <option value="2">Molto resistente ×2 PF</option>
                            <option value="3">Eccezionale ×3 PF</option>
                        </select></label>
                        <label>Competenze nei TS<select name="saveProficiencies">
                            <option value="0">0–2</option>
                            <option value="3">3–4 (+2 CA effettiva)</option>
                            <option value="5">5–6 (+4 CA effettiva)</option>
                        </select></label>
                        <label class="dnd-tool-check"><input name="fliesAndRanged" type="checkbox"> Vola e attacca a distanza</label>
                    </section>
                    <section>
                        <span>Offesa</span>
                        <label>Danni medi per round<input name="dpr" type="number" min="0" value="24"></label>
                        <label>Bonus di attacco<input name="attack" type="number" value="5"></label>
                        <label>CD tiro salvezza<input name="saveDc" type="number" value="13"></label>
                        <label class="dnd-tool-check"><input name="useSaveDc" type="checkbox"> Usa la CD invece dell’attacco</label>
                        <p>Calcola i danni sulla media di tre round, includendo capacità ricaricabili e aree d’effetto.</p>
                    </section>
                </form>
                <aside class="dnd-cr-result" id="crResult" aria-live="polite"></aside>
            </div>
        `;
        root.innerHTML = renderToolShell({
            glyph: '⬡',
            eyebrow: 'Laboratorio delle creature',
            title: 'Calcolatore GS',
            description: 'Una stima trasparente: mostra separatamente GS difensivo, offensivo e risultato medio.',
            body,
            source: sourceLink('master', 273, 'Creazione di un mostro')
        });
        wireHomeButton();

        const form = root.querySelector('#crForm');
        const update = () => {
            const values = Object.fromEntries(new FormData(form));
            const result = calculateChallengeRating({
                hp: values.hp,
                ac: values.ac,
                dpr: values.dpr,
                attack: values.attack,
                saveDc: values.saveDc,
                hpMultiplier: values.hpMultiplier,
                saveProficiencies: values.saveProficiencies,
                useSaveDc: form.elements.useSaveDc.checked,
                fliesAndRanged: form.elements.fliesAndRanged.checked
            });
            root.querySelector('#crResult').innerHTML = `
                <span>Grado di sfida stimato</span>
                <strong>GS ${result.cr.cr}</strong>
                <small>${formatNumber(result.cr.xp)} PE · competenza +${result.cr.proficiency}</small>
                <div class="dnd-cr-split">
                    <div><span>Difensivo</span><b>GS ${result.defensiveCr.cr}</b><small>${formatNumber(result.effectiveHp)} PF eff. · CA ${result.effectiveAc}</small></div>
                    <div><span>Offensivo</span><b>GS ${result.offensiveCr.cr}</b><small>DPR ${form.elements.dpr.value || 0} · ${result.attackMetric}</small></div>
                </div>
                <p>Il risultato è una base di progettazione: privilegi speciali, controllo del campo e sinergie possono richiedere una correzione del Master.</p>
            `;
        };
        form.addEventListener('input', update);
        form.addEventListener('change', update);
        update();
    }

    function renderLoot() {
        const body = `
            <div class="dnd-loot-layout">
                <form class="dnd-loot-controls" id="lootForm">
                    <label><span>Fascia del gruppo</span><select name="tier">
                        <option value="1">Livelli 1–4</option>
                        <option value="2">Livelli 5–10</option>
                        <option value="3">Livelli 11–16</option>
                        <option value="4">Livelli 17–20</option>
                    </select></label>
                    <label><span>Ricchezza del ritrovamento</span><select name="wealth">
                        <option value="scarso">Scarso</option>
                        <option value="standard" selected>Standard</option>
                        <option value="ricco">Ricco</option>
                    </select></label>
                    <label class="dnd-tool-check"><input name="includeMagic" type="checkbox" checked> Può contenere ricompense magiche</label>
                    <button type="submit">GENERA BOTTINO</button>
                    <p>Il generatore produce una proposta rapida originale. Per le tabelle ufficiali complete usa il riferimento al manuale.</p>
                </form>
                <section class="dnd-loot-result" id="lootResult">
                    <div class="dnd-loot-chest" aria-hidden="true"><i></i><b>◆</b></div>
                    <div class="dnd-tool-empty"><strong>Il forziere è chiuso</strong><span>Scegli la fascia e genera il ritrovamento.</span></div>
                </section>
            </div>
            <p class="dnd-tool-toast" data-tool-status role="status" aria-live="polite"></p>
        `;
        root.innerHTML = renderToolShell({
            glyph: '◆',
            eyebrow: 'Ricompense',
            title: 'Generatore bottino',
            description: 'Monete, preziosi, rarità e uno spunto narrativo pronti da passare alla preparazione.',
            body,
            source: sourceLink('master', 133, 'Tabelle dei tesori')
        });
        wireHomeButton();

        const renderResult = () => {
            if (!lootResult) return;
            const summary = formatLootSummary(lootResult);
            root.querySelector('#lootResult').innerHTML = `
                <div class="dnd-loot-chest open" aria-hidden="true"><i></i><b>◆</b></div>
                <span>${escapeHTML(lootResult.tierLabel)} · ${escapeHTML(lootResult.wealth)}</span>
                <h3>Bottino generato</h3>
                <div class="dnd-loot-coins">${lootResult.coins.map(item => `<div><small>${item.currency.toUpperCase()}</small><strong>${formatNumber(item.total)}</strong><span>${item.formula}</span></div>`).join('')}</div>
                <p><strong>Preziosi:</strong> ${lootResult.valuables.count} ${escapeHTML(lootResult.valuables.label)}.</p>
                <p><strong>Magia:</strong> ${lootResult.magic ? `${lootResult.magic.count} ricompens${lootResult.magic.count === 1 ? 'a' : 'e'} ${escapeHTML(lootResult.magic.rarity)}` : 'nessuna ricompensa automatica'}.</p>
                <blockquote>${escapeHTML(lootResult.hook)}.</blockquote>
                <div class="dnd-tool-actions">
                    <button type="button" id="copyLoot">COPIA</button>
                    <button type="button" class="primary" id="prepareLoot">USA IN UNA SESSIONE</button>
                </div>
            `;
            root.querySelector('#copyLoot').onclick = async () => {
                await copyText(summary);
                setStatus('Bottino copiato.');
            };
            root.querySelector('#prepareLoot').onclick = async () => {
                if (typeof onPrepareSession === 'function') await onPrepareSession({ loot: summary });
            };
        };
        root.querySelector('#lootForm').onsubmit = event => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = Object.fromEntries(new FormData(form));
            lootResult = generateLoot({
                tier: Number(values.tier),
                wealth: values.wealth,
                includeMagic: form.elements.includeMagic.checked
            });
            renderResult();
        };
    }

    function renderInitiative() {
        const activeIndex = initiative.entries.length ? Math.min(initiative.turn, initiative.entries.length - 1) : 0;
        const body = `
            <div class="dnd-initiative-layout">
                <section class="dnd-initiative-board">
                    <header>
                        <div><span>Round</span><strong>${initiative.round}</strong></div>
                        <div><span>Turno</span><strong>${initiative.entries[activeIndex]?.name ? escapeHTML(initiative.entries[activeIndex].name) : 'Libero'}</strong></div>
                        <button type="button" id="sortStandaloneInitiative">ORDINA</button>
                    </header>
                    <div class="dnd-initiative-entries">
                        ${initiative.entries.length ? initiative.entries.map((entry, index) => `
                            <article class="${index === activeIndex ? 'active' : ''}">
                                <b>${entry.value}</b>
                                <div><strong>${escapeHTML(entry.name)}</strong><span>${entry.conditions ? escapeHTML(entry.conditions) : 'Nessuna condizione'}${Number.isFinite(Number(entry.hp)) && entry.hp !== '' ? ` · ${escapeHTML(entry.hp)} PF` : ''}</span></div>
                                <button type="button" data-remove-initiative-entry="${entry.id}" aria-label="Rimuovi ${escapeHTML(entry.name)}">×</button>
                            </article>
                        `).join('') : '<div class="dnd-tool-empty"><strong>Nessun partecipante</strong><span>Aggiungi personaggi e creature per iniziare.</span></div>'}
                    </div>
                    <footer>
                        <button type="button" id="previousStandaloneTurn" ${!initiative.entries.length ? 'disabled' : ''}>← PRECEDENTE</button>
                        <button type="button" class="primary" id="nextStandaloneTurn" ${!initiative.entries.length ? 'disabled' : ''}>PROSSIMO →</button>
                        <button type="button" id="clearStandaloneInitiative" ${!initiative.entries.length ? 'disabled' : ''}>SVUOTA</button>
                    </footer>
                </section>
                <form class="dnd-initiative-form" id="standaloneInitiativeForm">
                    <span>Nuovo partecipante</span>
                    <label>Nome<input name="name" required placeholder="Es. Aria o Goblin 1"></label>
                    <div>
                        <label>Iniziativa<input name="value" type="number" value="10"></label>
                        <label>PF opzionali<input name="hp" type="number" placeholder="—"></label>
                    </div>
                    <label>Condizioni<input name="conditions" placeholder="Es. prono, avvelenato"></label>
                    <button type="submit">AGGIUNGI</button>
                    <button type="button" id="rollStandaloneInitiative">TIRA 1d20 + VALORE</button>
                    <p>Il pulsante di tiro interpreta il campo iniziativa come modificatore e inserisce direttamente il risultato.</p>
                </form>
            </div>
        `;
        root.innerHTML = renderToolShell({
            glyph: '➜',
            eyebrow: 'Tracker locale',
            title: 'Iniziativa',
            description: 'Un tracker rapido fuori dalla sessione; round e partecipanti restano salvati su questo dispositivo.',
            body
        });
        wireHomeButton();

        const addEntry = (name, value, hp, conditions) => {
            initiative.entries.push({ id: crypto.randomUUID(), name, value: Number(value) || 0, hp, conditions });
            initiative.entries.sort((a, b) => b.value - a.value);
            initiative.turn = 0;
            persist();
            renderInitiative();
        };
        const form = root.querySelector('#standaloneInitiativeForm');
        form.onsubmit = event => {
            event.preventDefault();
            const values = Object.fromEntries(new FormData(form));
            addEntry(values.name.trim(), values.value, values.hp, values.conditions);
        };
        root.querySelector('#rollStandaloneInitiative').onclick = () => {
            if (!form.reportValidity()) return;
            const values = Object.fromEntries(new FormData(form));
            const roll = rollFormula(`1d20${Number(values.value) >= 0 ? '+' : ''}${Number(values.value) || 0}`);
            addEntry(values.name.trim(), roll.total, values.hp, values.conditions);
        };
        root.querySelector('#sortStandaloneInitiative').onclick = () => {
            initiative.entries.sort((a, b) => b.value - a.value);
            initiative.turn = 0;
            persist();
            renderInitiative();
        };
        root.querySelector('#nextStandaloneTurn').onclick = () => {
            if (!initiative.entries.length) return;
            initiative.turn += 1;
            if (initiative.turn >= initiative.entries.length) {
                initiative.turn = 0;
                initiative.round += 1;
            }
            persist();
            renderInitiative();
        };
        root.querySelector('#previousStandaloneTurn').onclick = () => {
            if (!initiative.entries.length) return;
            initiative.turn -= 1;
            if (initiative.turn < 0) {
                initiative.turn = initiative.entries.length - 1;
                initiative.round = Math.max(1, initiative.round - 1);
            }
            persist();
            renderInitiative();
        };
        root.querySelectorAll('[data-remove-initiative-entry]').forEach(button => {
            button.onclick = () => {
                initiative.entries = initiative.entries.filter(entry => entry.id !== button.dataset.removeInitiativeEntry);
                initiative.turn = Math.min(initiative.turn, Math.max(0, initiative.entries.length - 1));
                persist();
                renderInitiative();
            };
        });
        root.querySelector('#clearStandaloneInitiative').onclick = () => {
            if (!confirm('Svuotare il tracker iniziativa?')) return;
            initiative = { round: 1, turn: 0, entries: [] };
            persist();
            renderInitiative();
        };
    }

    function renderDmScreen() {
        const visibleWidgets = DM_WIDGETS.filter(widget => pinnedWidgets.includes(widget.id));
        const body = `
            <div class="dnd-dm-customizer">
                <span>Pannelli visibili</span>
                <div>${DM_WIDGETS.map(widget => `<button type="button" class="${pinnedWidgets.includes(widget.id) ? 'active' : ''}" data-toggle-widget="${widget.id}" aria-pressed="${pinnedWidgets.includes(widget.id)}">${widget.title}</button>`).join('')}</div>
            </div>
            <div class="dnd-dm-screen-grid">
                ${visibleWidgets.length ? visibleWidgets.map(widget => `
                    <article class="dnd-dm-widget">
                        <header><span>${escapeHTML(widget.category)}</span><button type="button" data-unpin-widget="${widget.id}" aria-label="Nascondi ${escapeHTML(widget.title)}">×</button></header>
                        <h3>${escapeHTML(widget.title)}</h3>
                        <p>${escapeHTML(widget.lead)}</p>
                        ${widget.rows ? `<div class="dnd-dm-widget-rows">${widget.rows.map(([label, value]) => `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join('')}</div>` : ''}
                        ${widget.tags ? `<div class="dnd-dm-widget-tags">${widget.tags.map(tag => `<button type="button" ${widget.searchable ? `data-open-reference="${escapeHTML(tag)}"` : 'disabled'}>${escapeHTML(tag)}</button>`).join('')}</div>` : ''}
                        ${sourceLink(widget.source[0], widget.source[1], 'Fonte')}
                    </article>
                `).join('') : '<div class="dnd-tool-empty"><strong>Schermo vuoto</strong><span>Seleziona almeno un pannello dal menu superiore.</span></div>'}
            </div>
        `;
        root.innerHTML = renderToolShell({
            glyph: '▦',
            eyebrow: 'Pannello personalizzabile',
            title: 'Schermo del Master',
            description: 'Scegli solo i promemoria che servono alla tua sessione; la configurazione resta sul dispositivo.',
            body
        });
        wireHomeButton();
        root.querySelectorAll('[data-toggle-widget]').forEach(button => {
            button.onclick = () => {
                const id = button.dataset.toggleWidget;
                if (pinnedWidgets.includes(id)) pinnedWidgets = pinnedWidgets.filter(item => item !== id);
                else pinnedWidgets.push(id);
                persist();
                renderDmScreen();
            };
        });
        root.querySelectorAll('[data-unpin-widget]').forEach(button => {
            button.onclick = () => {
                pinnedWidgets = pinnedWidgets.filter(id => id !== button.dataset.unpinWidget);
                persist();
                renderDmScreen();
            };
        });
        root.querySelectorAll('[data-open-reference]').forEach(button => {
            button.onclick = () => {
                referenceQuery = button.dataset.openReference;
                referenceCategory = 'conditions';
                referenceManual = 'player';
                openTool('reference');
            };
        });
    }

    renderHub();
}
