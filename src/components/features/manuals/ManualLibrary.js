import { getAIResponse } from '../../../services/ai.js';
import {
    getManualSectionGroups,
    getSectionById,
    getSectionForPage
} from './manualSections.js';

const SEARCH_RESULT_LIMIT = 24;
const AI_SOURCE_LIMIT = 6;
const INDEX_CACHE = new Map();

const STOP_WORDS = new Set([
    'a', 'ad', 'al', 'alla', 'alle', 'anche', 'che', 'chi', 'come', 'con', 'da', 'dal', 'dalla',
    'delle', 'di', 'e', 'ed', 'gli', 'il', 'in', 'la', 'le', 'lo', 'ma', 'nel', 'nella', 'o',
    'per', 'piu', 'quale', 'quali', 'se', 'su', 'tra', 'un', 'una', 'uno'
]);

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const normalizeSearchText = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getSearchTokens = (query) => {
    const normalized = normalizeSearchText(query);
    const tokens = normalized
        .split(' ')
        .filter(token => token.length > 1 && !STOP_WORDS.has(token));
    return {
        raw: String(query || '').trim(),
        normalized,
        tokens: [...new Set(tokens)]
    };
};

const countOccurrences = (haystack, needle) => {
    if (!needle) return 0;
    let count = 0;
    let index = 0;
    while ((index = haystack.indexOf(needle, index)) !== -1) {
        count += 1;
        index += needle.length;
    }
    return count;
};

const getManualPageUrl = (manual, page) => `/manuals/${manual.slug}/${manual.slug}-${page}.pdf`;
const getManualEmbedUrl = (manual, page) => `${getManualPageUrl(manual, page)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
const getManualFullUrl = (manual) => `/manuals/${manual.slug}/${manual.slug}.pdf`;
const formatPageRange = (startPage, endPage) =>
    startPage === endPage ? `Pagina ${startPage}` : `Pagine ${startPage}–${endPage}`;

const icon = (name) => {
    const paths = {
        search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path>',
        book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"></path><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"></path>',
        spark: '<path d="m12 3 1.1 3.4L16.5 7.5l-3.4 1.1L12 12l-1.1-3.4-3.4-1.1 3.4-1.1z"></path><path d="m18 13 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8z"></path>',
        arrow: '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
        chevronLeft: '<path d="m15 18-6-6 6-6"></path>',
        chevronRight: '<path d="m9 18 6-6-6-6"></path>',
        close: '<path d="m6 6 12 12M18 6 6 18"></path>'
    };
    return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
};

const getSuggestions = (systemId) => systemId === 'pathfinder2e'
    ? ['azioni in combattimento', 'gradi di successo', 'condizione morente', 'creature e pericoli']
    : ['attacco di opportunità', 'tiro salvezza concentrazione', 'classe armatura', 'draghi adulti'];

async function loadManualIndex(systemId, manual) {
    const key = `${systemId}:${manual.id}`;
    if (INDEX_CACHE.has(key)) return INDEX_CACHE.get(key);

    const request = fetch(`/manual-index/${systemId}/${manual.id}.json`)
        .then(async response => {
            if (!response.ok) throw new Error(`Indice ${manual.title} non disponibile.`);
            const data = await response.json();
            return Array.isArray(data.pages) ? data.pages : [];
        })
        .catch(error => {
            INDEX_CACHE.delete(key);
            throw error;
        });

    INDEX_CACHE.set(key, request);
    return request;
}

const scorePage = (page, queryData) => {
    const normalizedText = normalizeSearchText(page.text);
    if (!normalizedText) return 0;

    let score = 0;
    if (queryData.normalized && normalizedText.includes(queryData.normalized)) {
        score += 240;
    }

    let matchedTokens = 0;
    queryData.tokens.forEach(token => {
        const occurrences = countOccurrences(normalizedText, token);
        if (!occurrences) return;
        matchedTokens += 1;
        score += Math.min(occurrences, 8) * (token.length >= 7 ? 10 : 6);
        if (normalizedText.startsWith(token)) score += 6;
    });

    if (queryData.tokens.length && matchedTokens === queryData.tokens.length) score += 50;
    return score;
};

const findSnippet = (text, queryData) => {
    const lines = String(text || '')
        .split(/\n+/)
        .map(line => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    if (!lines.length) return 'Questa pagina non contiene testo riconosciuto.';

    const windows = lines.map((_, index) => lines.slice(Math.max(0, index - 1), index + 3).join(' '));
    let bestWindow = windows[0];
    let bestScore = -1;

    windows.forEach(windowText => {
        const normalized = normalizeSearchText(windowText);
        let score = normalized.includes(queryData.normalized) ? 160 : 0;
        queryData.tokens.forEach(token => {
            score += Math.min(5, countOccurrences(normalized, token)) * (token.length >= 7 ? 12 : 7);
        });
        if (score > bestScore) {
            bestScore = score;
            bestWindow = windowText;
        }
    });

    const compact = bestWindow.replace(/\s+/g, ' ').trim();
    return compact.length > 430 ? `${compact.slice(0, 427).trim()}…` : compact;
};

const getResultTitle = (text, manual, page, queryData) => {
    const lines = String(text || '')
        .split(/\n+/)
        .map(line => line.trim())
        .filter(line => line.length >= 4 && line.length <= 110);
    const manualName = normalizeSearchText(manual.title);
    const preferred = lines.find(line => {
        const normalized = normalizeSearchText(line);
        return normalized !== manualName
            && !/^pagina \d+$/i.test(line)
            && queryData.tokens.every(token => normalized.includes(token))
            && line.split(/\s+/).length <= 14;
    });
    if (preferred) return preferred;
    if (normalizeSearchText(text).includes(queryData.normalized)) {
        return queryData.raw.charAt(0).toUpperCase() + queryData.raw.slice(1);
    }
    return `Riferimento a pagina ${page}`;
};

const highlightSnippet = (snippet, tokens) => {
    let html = escapeHTML(snippet);
    const usefulTokens = tokens.filter(token => token.length >= 3).sort((a, b) => b.length - a.length);
    usefulTokens.forEach(token => {
        const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        html = html.replace(new RegExp(`(${escapedToken})`, 'giu'), '<mark>$1</mark>');
    });
    return html;
};

const buildSearchResults = (systemId, manuals, pagesByManual, query, activeSection = null) => {
    const queryData = getSearchTokens(query);
    if (!queryData.normalized || !queryData.tokens.length) return [];

    const manualMap = new Map(manuals.map(manual => [manual.id, manual]));
    const results = [];

    pagesByManual.forEach(pages => {
        pages.forEach(page => {
            const manual = manualMap.get(page.manualId);
            if (!manual) return;
            if (activeSection && (
                page.manualId !== activeSection.manualId
                || page.page < activeSection.startPage
                || page.page > activeSection.endPage
            )) return;
            const score = scorePage(page, queryData);
            if (!score) return;
            results.push({
                ...page,
                manual,
                score,
                section: getSectionForPage(systemId, manual.id, page.page),
                title: getResultTitle(page.text, manual, page.page, queryData),
                snippet: findSnippet(page.text, queryData),
                queryData
            });
        });
    });

    return results
        .sort((a, b) => b.score - a.score || a.page - b.page)
        .slice(0, SEARCH_RESULT_LIMIT);
};

const renderResult = (result, maxScore) => {
    const relevance = Math.max(38, Math.min(99, Math.round((result.score / maxScore) * 99)));
    return `
        <article class="manual-search-result">
            <div class="manual-result-meta">
                <span>${escapeHTML(result.manual.title)}</span>
                ${result.section ? `<span>${escapeHTML(result.section.title)}</span>` : ''}
                <span>Pagina ${result.page}</span>
                <span>${relevance}% rilevanza</span>
            </div>
            <h3>${escapeHTML(result.title)}</h3>
            <p>${highlightSnippet(result.snippet, result.queryData.tokens)}</p>
            <button type="button" data-open-result="${escapeHTML(result.manual.id)}" data-result-page="${result.page}">
                Leggi la pagina citata ${icon('arrow')}
            </button>
        </article>
    `;
};

const renderInitialState = (systemId) => `
    <div class="manual-library-empty">
        <div class="manual-library-empty-icon">${icon('book')}</div>
        <h3>Cerca dentro ogni pagina</h3>
        <p>L'indice legge il testo dei manuali e restituisce i passaggi più pertinenti con fonte e numero di pagina.</p>
        <div class="manual-library-suggestions">
            ${getSuggestions(systemId).map(item => `<button type="button" data-suggest-query="${escapeHTML(item)}">${escapeHTML(item)}</button>`).join('')}
        </div>
    </div>
`;

const renderSectionLanding = (manual, activeSection) => `
    <div class="manual-section-landing">
        <span>${escapeHTML(manual.title)} · ${formatPageRange(activeSection.startPage, activeSection.endPage)}</span>
        <h3>${escapeHTML(activeSection.title)}</h3>
        <p>${escapeHTML(activeSection.description)}</p>
        <div>
            <button type="button" data-focus-section-search>Cerca in questa sezione</button>
            <button type="button" data-open-section-page="${activeSection.startPage}" data-open-section-manual="${escapeHTML(manual.id)}">
                Apri dal capitolo ${icon('arrow')}
            </button>
        </div>
    </div>
`;

export function renderManualLibrary({ container, manuals, systemId }) {
    let activeManualIds = new Set(manuals.map(manual => manual.id));
    let currentQuery = '';
    let searchRun = 0;
    let readerManual = manuals[0];
    let readerPage = 1;
    let sectionBrowseManual = manuals[0];
    let activeSection = null;
    let sectionDiscoveryQuery = '';

    document.querySelectorAll('body > .manual-page-modal').forEach(modal => modal.remove());

    container.innerHTML = `
        <section class="manual-library">
            <header class="manual-library-heading">
                <h2>BIBLIOTECA DEI MANUALI</h2>
                <p>Cerca regole, creature, classi, incantesimi o interi paragrafi. Ogni risposta rimanda alla pagina originale.</p>
            </header>

            <div class="manual-library-layout">
                <aside class="manual-library-filters" aria-label="Filtri manuali">
                    <div class="manual-filter-heading">
                        <strong>Cerca in</strong>
                        <span>Seleziona uno o più manuali</span>
                    </div>
                    ${manuals.map(manual => `
                        <button type="button" class="manual-filter-button active" data-manual-filter="${escapeHTML(manual.id)}" aria-pressed="true">
                            <span class="manual-filter-check" aria-hidden="true">✓</span>
                            <span>
                                <strong>${escapeHTML(manual.title)}</strong>
                                <small>${manual.pages} pagine indicizzate</small>
                            </span>
                        </button>
                    `).join('')}
                    <button type="button" class="manual-complete-button" id="openCompleteManuals">
                        ${icon('book')}
                        <span>
                            <strong>CONSULTA I MANUALI COMPLETI</strong>
                            <small>Lettore pagina per pagina</small>
                        </span>
                        ${icon('arrow')}
                    </button>
                </aside>

                <section class="manual-knowledge-panel" id="manualKnowledgePanel">
                    <form class="manual-search-form" id="manualSearchForm">
                        <label for="manualSearchInput">Cosa vuoi trovare?</label>
                        <div class="manual-search-control">
                            ${icon('search')}
                            <input id="manualSearchInput" type="search" autocomplete="off" placeholder="Es. Come funziona un attacco di opportunità?">
                            <button type="submit">CERCA</button>
                        </div>
                        <span id="manualSearchScope">Ricerca attiva in ${manuals.length} manuali</span>
                    </form>

                    <section class="manual-section-browser" aria-labelledby="manualSectionBrowserTitle">
                        <header>
                            <div>
                                <h3 id="manualSectionBrowserTitle">Esplora le sezioni</h3>
                                <p>Non serve conoscere il nome esatto: descrivi ciò che vuoi fare oppure sfoglia parti e capitoli.</p>
                            </div>
                            <button type="button" id="clearSectionFilter" hidden>Rimuovi filtro</button>
                        </header>
                        <div class="manual-section-manuals" role="tablist" aria-label="Manuale da esplorare">
                            ${manuals.map((manual, index) => `
                                <button type="button" class="${index === 0 ? 'active' : ''}" data-section-manual="${escapeHTML(manual.id)}" role="tab" aria-selected="${index === 0}">
                                    ${escapeHTML(manual.title)}
                                </button>
                            `).join('')}
                        </div>
                        <label class="manual-section-discovery" for="manualSectionDiscovery">
                            ${icon('search')}
                            <input id="manualSectionDiscovery" type="search" autocomplete="off" placeholder="Es. creare un eroe, gestire tesori, trovare creature volanti…">
                        </label>
                        <div class="manual-section-active-scope" id="manualSectionActiveScope" hidden></div>
                        <div class="manual-section-groups" id="manualSectionGroups"></div>
                    </section>

                    <div class="manual-ai-answer" id="manualAiAnswer" hidden></div>
                    <div class="manual-search-results" id="manualSearchResults">
                        ${renderInitialState(systemId)}
                    </div>
                </section>

                <section class="manual-complete-section" id="manualCompleteSection" hidden>
                    <header class="manual-complete-heading">
                        <button type="button" id="backToManualSearch">${icon('chevronLeft')} Torna alla ricerca</button>
                        <div>
                            <h3>Manuali completi</h3>
                            <p>Scegli un volume e consulta una pagina alla volta.</p>
                        </div>
                    </header>

                    <div class="manual-complete-tabs" role="tablist" aria-label="Manuali completi">
                        ${manuals.map((manual, index) => `
                            <button type="button" class="${index === 0 ? 'active' : ''}" data-reader-manual="${escapeHTML(manual.id)}" role="tab" aria-selected="${index === 0}">
                                <strong>${escapeHTML(manual.title)}</strong>
                                <span>${manual.pages} pagine</span>
                            </button>
                        `).join('')}
                    </div>

                    <div class="manual-book-reader">
                        <div class="manual-reader-toolbar">
                            <div>
                                <span>Volume selezionato</span>
                                <strong id="readerManualTitle">${escapeHTML(readerManual.title)}</strong>
                            </div>
                            <div class="manual-reader-actions">
                                <label for="readerPageInput">Pagina</label>
                                <input id="readerPageInput" type="number" min="1" max="${readerManual.pages}" value="1">
                                <span id="readerPageTotal">di ${readerManual.pages}</span>
                                <button type="button" id="readerGoPage">VAI</button>
                                <a id="readerFullPdf" href="${getManualFullUrl(readerManual)}" target="_blank" rel="noreferrer">Apri PDF completo</a>
                            </div>
                        </div>
                        <div class="manual-reader-progress"><span id="readerProgressBar"></span></div>
                        <div class="manual-reader-stage">
                            <button type="button" id="readerPrevious" aria-label="Pagina precedente">${icon('chevronLeft')}</button>
                            <div class="manual-reader-paper">
                                <div class="manual-reader-page-label" id="readerPageLabel">${escapeHTML(readerManual.title)} · Pagina 1</div>
                                <iframe id="readerFrame" title="${escapeHTML(readerManual.title)} - pagina 1" src="${getManualEmbedUrl(readerManual, 1)}"></iframe>
                            </div>
                            <button type="button" id="readerNext" aria-label="Pagina successiva">${icon('chevronRight')}</button>
                        </div>
                        <nav class="manual-reader-page-strip" id="readerPageStrip" aria-label="Pagine vicine"></nav>
                    </div>
                </section>
            </div>
        </section>

        <div class="manual-page-modal" id="manualPageModal" aria-hidden="true">
            <button type="button" class="manual-page-modal-backdrop" data-close-page aria-label="Chiudi pagina"></button>
            <section class="manual-page-modal-panel" role="dialog" aria-modal="true" aria-labelledby="manualPageModalTitle">
                <header>
                    <strong id="manualPageModalTitle"></strong>
                    <div>
                        <a id="manualPageModalOpen" target="_blank" rel="noreferrer">Apri PDF</a>
                        <button type="button" data-close-page>${icon('close')} Chiudi</button>
                    </div>
                </header>
                <iframe id="manualPageModalFrame" title="" src=""></iframe>
            </section>
        </div>
    `;

    const modalRoot = container.querySelector('#manualPageModal');
    if (modalRoot) document.body.appendChild(modalRoot);

    const knowledgePanel = container.querySelector('#manualKnowledgePanel');
    const completeSection = container.querySelector('#manualCompleteSection');
    const resultsRoot = container.querySelector('#manualSearchResults');
    const answerRoot = container.querySelector('#manualAiAnswer');
    const searchInput = container.querySelector('#manualSearchInput');
    const scopeLabel = container.querySelector('#manualSearchScope');
    const sectionGroupsRoot = container.querySelector('#manualSectionGroups');
    const sectionActiveScope = container.querySelector('#manualSectionActiveScope');
    const sectionDiscoveryInput = container.querySelector('#manualSectionDiscovery');
    const clearSectionFilter = container.querySelector('#clearSectionFilter');

    const updateFilterState = () => {
        container.querySelectorAll('[data-manual-filter]').forEach(button => {
            const active = activeManualIds.has(button.dataset.manualFilter);
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
            button.querySelector('.manual-filter-check').textContent = active ? '✓' : '';
        });
        if (activeSection) {
            const manual = manuals.find(item => item.id === activeSection.manualId);
            scopeLabel.textContent = `Ricerca in ${manual?.title || 'manuale'} · ${activeSection.title} · ${formatPageRange(activeSection.startPage, activeSection.endPage)}`;
        } else {
            scopeLabel.textContent = `Ricerca attiva in ${activeManualIds.size} ${activeManualIds.size === 1 ? 'manuale' : 'manuali'}`;
        }
    };

    const closePageModal = () => {
        const modal = document.querySelector('#manualPageModal');
        const frame = document.querySelector('#manualPageModalFrame');
        modal?.classList.remove('active');
        modal?.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('manual-page-modal-open');
        if (frame) frame.src = '';
    };

    const openPageModal = (manualId, page) => {
        const manual = manuals.find(item => item.id === manualId);
        if (!manual) return;
        const safePage = Math.max(1, Math.min(manual.pages, Number(page) || 1));
        const modal = document.querySelector('#manualPageModal');
        const frame = document.querySelector('#manualPageModalFrame');
        const title = document.querySelector('#manualPageModalTitle');
        const openLink = document.querySelector('#manualPageModalOpen');
        if (!modal || !frame || !title || !openLink) return;
        title.textContent = `${manual.title} · Pagina ${safePage}`;
        frame.title = `${manual.title} - pagina ${safePage}`;
        frame.src = getManualEmbedUrl(manual, safePage);
        openLink.href = getManualPageUrl(manual, safePage);
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('manual-page-modal-open');
    };

    const wireResultButtons = () => {
        resultsRoot.querySelectorAll('[data-open-result]').forEach(button => {
            button.onclick = () => openPageModal(button.dataset.openResult, button.dataset.resultPage);
        });
    };

    const wireSectionLanding = () => {
        resultsRoot.querySelector('[data-focus-section-search]')?.addEventListener('click', () => {
            searchInput.focus();
            searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        resultsRoot.querySelector('[data-open-section-page]')?.addEventListener('click', button => {
            const target = button.currentTarget;
            const manual = manuals.find(item => item.id === target.dataset.openSectionManual);
            if (manual) showCompleteManuals(manual, Number(target.dataset.openSectionPage));
        });
    };

    const showRestingState = () => {
        answerRoot.hidden = true;
        if (activeSection) {
            const manual = manuals.find(item => item.id === activeSection.manualId);
            resultsRoot.innerHTML = renderSectionLanding(manual, activeSection);
            wireSectionLanding();
            return;
        }
        resultsRoot.innerHTML = renderInitialState(systemId);
        wireSuggestionButtons();
    };

    const sectionMatchesDiscovery = item => {
        const tokens = getSearchTokens(sectionDiscoveryQuery).tokens;
        if (!tokens.length) return true;
        const haystack = normalizeSearchText([
            item.title,
            item.description,
            ...(item.keywords || [])
        ].join(' '));
        const matches = tokens.filter(token => haystack.includes(token)).length;
        return matches >= Math.max(1, Math.ceil(tokens.length * 0.5));
    };

    const renderSectionBrowser = () => {
        container.querySelectorAll('[data-section-manual]').forEach(button => {
            const selected = button.dataset.sectionManual === sectionBrowseManual.id;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-selected', String(selected));
        });

        clearSectionFilter.hidden = !activeSection;
        if (activeSection) {
            const activeManual = manuals.find(item => item.id === activeSection.manualId);
            sectionActiveScope.hidden = false;
            sectionActiveScope.innerHTML = `
                <span>Filtro attivo</span>
                <strong>${escapeHTML(activeSection.title)}</strong>
                <small>${escapeHTML(activeManual?.title || '')} · ${formatPageRange(activeSection.startPage, activeSection.endPage)}</small>
            `;
        } else {
            sectionActiveScope.hidden = true;
            sectionActiveScope.innerHTML = '';
        }

        const groups = getManualSectionGroups(systemId, sectionBrowseManual.id)
            .map(group => ({
                ...group,
                sections: group.sections.filter(sectionMatchesDiscovery)
            }))
            .filter(group => group.sections.length);

        if (!groups.length) {
            sectionGroupsRoot.innerHTML = `
                <div class="manual-section-no-results">
                    <strong>Nessuna sezione corrisponde alla descrizione.</strong>
                    <span>Prova con parole più generiche, come “combattere”, “creare” o “viaggiare”.</span>
                </div>
            `;
            return;
        }

        sectionGroupsRoot.innerHTML = groups.map((group, groupIndex) => {
            const containsActive = group.sections.some(item =>
                activeSection?.manualId === sectionBrowseManual.id && activeSection?.id === item.id
            );
            const shouldOpen = Boolean(sectionDiscoveryQuery) || containsActive || groupIndex === 0;
            return `
                <details class="manual-section-group" ${shouldOpen ? 'open' : ''}>
                    <summary>
                        <span>
                            <strong>${escapeHTML(group.title)}</strong>
                            <small>${escapeHTML(group.description)}</small>
                        </span>
                        <span>${group.sections.length} sezioni ${icon('chevronRight')}</span>
                    </summary>
                    <div>
                        ${group.sections.map(item => {
                            const isActive = activeSection?.manualId === sectionBrowseManual.id && activeSection?.id === item.id;
                            return `
                                <article class="manual-section-row ${isActive ? 'active' : ''}">
                                    <div>
                                        <span>${formatPageRange(item.startPage, item.endPage)}</span>
                                        <h4>${escapeHTML(item.title)}</h4>
                                        <p>${escapeHTML(item.description)}</p>
                                    </div>
                                    <div>
                                        <button type="button" data-section-filter="${escapeHTML(item.id)}">${isActive ? 'Filtro attivo' : 'Filtra la ricerca'}</button>
                                        <button type="button" data-section-open="${escapeHTML(item.id)}">Apri dal capitolo ${icon('arrow')}</button>
                                    </div>
                                </article>
                            `;
                        }).join('')}
                    </div>
                </details>
            `;
        }).join('');

        sectionGroupsRoot.querySelectorAll('[data-section-filter]').forEach(button => {
            button.onclick = () => {
                const selected = getSectionById(systemId, sectionBrowseManual.id, button.dataset.sectionFilter);
                if (!selected) return;
                activeSection = { ...selected, manualId: sectionBrowseManual.id };
                activeManualIds = new Set([sectionBrowseManual.id]);
                updateFilterState();
                renderSectionBrowser();
                if (currentQuery) runSearch(currentQuery);
                else showRestingState();
            };
        });
        sectionGroupsRoot.querySelectorAll('[data-section-open]').forEach(button => {
            button.onclick = () => {
                const selected = getSectionById(systemId, sectionBrowseManual.id, button.dataset.sectionOpen);
                if (selected) showCompleteManuals(sectionBrowseManual, selected.startPage);
            };
        });
    };

    const renderAIAnswer = async (query, results, runId) => {
        if (!results.length) {
            answerRoot.hidden = true;
            return;
        }

        answerRoot.hidden = false;
        answerRoot.innerHTML = `
            <div class="manual-ai-answer-heading">${icon('spark')} <strong>Sintesi dai manuali</strong></div>
            <p class="manual-ai-loading">Sto confrontando i passaggi trovati…</p>
        `;

        const passages = results.slice(0, AI_SOURCE_LIMIT).map(result => ({
            manuale: result.manual.title,
            pagina: result.page,
            testo: result.snippet
        }));
        const reply = await getAIResponse(
            `Rispondi alla domanda "${query}" usando esclusivamente i passaggi forniti. Cita le fonti nel formato [Manuale, pagina X]. Se i passaggi non bastano, dichiaralo chiaramente.`,
            {
                mode: 'rules',
                systemId,
                context: {
                    tipo: 'ricerca_biblioteca',
                    domanda: query,
                    passaggi: passages
                }
            }
        );

        if (runId !== searchRun) return;
        if (String(reply).startsWith('AI non disponibile:')) {
            answerRoot.innerHTML = `
                <div class="manual-ai-answer-heading">${icon('spark')} <strong>Risultati verificati</strong></div>
                <p>La sintesi AI non è disponibile in questo momento. I riferimenti qui sotto provengono comunque dall'indice OCR dei manuali.</p>
            `;
            return;
        }

        answerRoot.innerHTML = `
            <div class="manual-ai-answer-heading">${icon('spark')} <strong>Sintesi dai manuali</strong></div>
            <p>${escapeHTML(reply).replaceAll('\n', '<br>')}</p>
        `;
    };

    const runSearch = async (query) => {
        const trimmedQuery = String(query || '').trim();
        currentQuery = trimmedQuery;
        if (trimmedQuery.length < 2) {
            showRestingState();
            return;
        }

        const runId = ++searchRun;
        resultsRoot.innerHTML = `
            <div class="manual-search-loading">
                <span></span>
                <strong>Consulto gli indici selezionati…</strong>
            </div>
        `;
        answerRoot.hidden = true;

        const selectedManuals = manuals.filter(manual => activeManualIds.has(manual.id));
        try {
            const pagesByManual = await Promise.all(selectedManuals.map(manual => loadManualIndex(systemId, manual)));
            if (runId !== searchRun) return;
            const results = buildSearchResults(systemId, selectedManuals, pagesByManual, trimmedQuery, activeSection);

            if (!results.length) {
                resultsRoot.innerHTML = `
                    <div class="manual-library-empty compact">
                        <h3>Nessun passaggio trovato</h3>
                        <p>Prova con un termine più breve, un sinonimo oppure rimuovi il filtro di sezione.</p>
                    </div>
                `;
                answerRoot.hidden = true;
                return;
            }

            const maxScore = results[0].score || 1;
            resultsRoot.innerHTML = `
                <div class="manual-result-count">
                    <strong>${results.length} riferimenti</strong>
                    <span>ordinati per pertinenza</span>
                </div>
                ${results.map(result => renderResult(result, maxScore)).join('')}
            `;
            wireResultButtons();
            renderAIAnswer(trimmedQuery, results, runId);
        } catch (error) {
            if (runId !== searchRun) return;
            resultsRoot.innerHTML = `
                <div class="manual-library-empty compact">
                    <h3>Indice non disponibile</h3>
                    <p>${escapeHTML(error.message || 'Non è stato possibile caricare i dati di ricerca.')}</p>
                </div>
            `;
        }
    };

    const wireSuggestionButtons = () => {
        resultsRoot.querySelectorAll('[data-suggest-query]').forEach(button => {
            button.onclick = () => {
                searchInput.value = button.dataset.suggestQuery;
                runSearch(searchInput.value);
            };
        });
    };

    const readerPageWindow = () => {
        const start = Math.max(1, Math.min(readerManual.pages - 6, readerPage - 3));
        const end = Math.min(readerManual.pages, start + 6);
        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    };

    const syncReader = () => {
        readerPage = Math.max(1, Math.min(readerManual.pages, Number(readerPage) || 1));
        container.querySelector('#readerManualTitle').textContent = readerManual.title;
        container.querySelector('#readerPageInput').value = readerPage;
        container.querySelector('#readerPageInput').max = readerManual.pages;
        container.querySelector('#readerPageTotal').textContent = `di ${readerManual.pages}`;
        container.querySelector('#readerFullPdf').href = getManualFullUrl(readerManual);
        container.querySelector('#readerPageLabel').textContent = `${readerManual.title} · Pagina ${readerPage}`;
        const frame = container.querySelector('#readerFrame');
        frame.title = `${readerManual.title} - pagina ${readerPage}`;
        frame.src = getManualEmbedUrl(readerManual, readerPage);
        container.querySelector('#readerProgressBar').style.width = `${(readerPage / readerManual.pages) * 100}%`;
        container.querySelector('#readerPrevious').disabled = readerPage <= 1;
        container.querySelector('#readerNext').disabled = readerPage >= readerManual.pages;

        const strip = container.querySelector('#readerPageStrip');
        strip.innerHTML = readerPageWindow().map(page => `
            <button type="button" class="${page === readerPage ? 'active' : ''}" data-reader-page="${page}" aria-label="Vai a pagina ${page}">${page}</button>
        `).join('');
        strip.querySelectorAll('[data-reader-page]').forEach(button => {
            button.onclick = () => {
                readerPage = Number(button.dataset.readerPage);
                syncReader();
            };
        });
    };

    const showCompleteManuals = (manual = readerManual, page = 1) => {
        readerManual = manual;
        readerPage = page;
        knowledgePanel.hidden = true;
        completeSection.hidden = false;
        container.querySelectorAll('[data-reader-manual]').forEach(button => {
            const active = button.dataset.readerManual === readerManual.id;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
        });
        syncReader();
        completeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    container.querySelectorAll('[data-manual-filter]').forEach(button => {
        button.onclick = () => {
            const manualId = button.dataset.manualFilter;
            if (activeManualIds.has(manualId) && activeManualIds.size === 1) return;
            activeSection = null;
            if (activeManualIds.has(manualId)) activeManualIds.delete(manualId);
            else {
                activeManualIds.add(manualId);
                sectionBrowseManual = manuals.find(item => item.id === manualId) || sectionBrowseManual;
            }
            updateFilterState();
            renderSectionBrowser();
            if (currentQuery) runSearch(currentQuery);
            else showRestingState();
        };
    });

    container.querySelectorAll('[data-section-manual]').forEach(button => {
        button.onclick = () => {
            sectionBrowseManual = manuals.find(item => item.id === button.dataset.sectionManual) || sectionBrowseManual;
            sectionDiscoveryQuery = '';
            sectionDiscoveryInput.value = '';
            renderSectionBrowser();
        };
    });
    sectionDiscoveryInput.oninput = event => {
        sectionDiscoveryQuery = event.currentTarget.value;
        renderSectionBrowser();
    };
    clearSectionFilter.onclick = () => {
        activeSection = null;
        updateFilterState();
        renderSectionBrowser();
        if (currentQuery) runSearch(currentQuery);
        else showRestingState();
    };

    container.querySelector('#manualSearchForm').onsubmit = event => {
        event.preventDefault();
        runSearch(searchInput.value);
    };
    container.querySelector('#openCompleteManuals').onclick = () => showCompleteManuals();
    container.querySelector('#backToManualSearch').onclick = () => {
        completeSection.hidden = true;
        knowledgePanel.hidden = false;
    };
    container.querySelectorAll('[data-reader-manual]').forEach(button => {
        button.onclick = () => {
            const manual = manuals.find(item => item.id === button.dataset.readerManual);
            if (manual) showCompleteManuals(manual, 1);
        };
    });
    container.querySelector('#readerPrevious').onclick = () => {
        readerPage -= 1;
        syncReader();
    };
    container.querySelector('#readerNext').onclick = () => {
        readerPage += 1;
        syncReader();
    };
    container.querySelector('#readerGoPage').onclick = () => {
        readerPage = container.querySelector('#readerPageInput').value;
        syncReader();
    };
    container.querySelector('#readerPageInput').onkeydown = event => {
        if (event.key === 'Enter') {
            readerPage = event.currentTarget.value;
            syncReader();
        }
    };
    document.querySelectorAll('#manualPageModal [data-close-page]').forEach(button => {
        button.onclick = closePageModal;
    });
    if (window.__manualLibraryEscapeHandler) {
        document.removeEventListener('keydown', window.__manualLibraryEscapeHandler);
    }
    window.__manualLibraryEscapeHandler = event => {
        if (event.key === 'Escape') closePageModal();
    };
    document.addEventListener('keydown', window.__manualLibraryEscapeHandler);

    wireSuggestionButtons();
    updateFilterState();
    renderSectionBrowser();
    syncReader();
}
