import { updateSidebarContext } from '../components/layout/Sidebar.js';
import { showLobby } from '../lobby.js';
import { fetchMangaGenres, searchManga } from '../services/mangaDex.js';

const PAGE_SIZE = 18;

const GENRE_LABELS = {
    Action: 'Azione',
    Adventure: 'Avventura',
    "Boys' Love": "Boys' Love",
    Comedy: 'Commedia',
    Crime: 'Crime',
    Drama: 'Drammatico',
    Fantasy: 'Fantasy',
    "Girls' Love": "Girls' Love",
    Historical: 'Storico',
    Horror: 'Horror',
    Isekai: 'Isekai',
    'Magical Girls': 'Ragazze magiche',
    Mecha: 'Mecha',
    Medical: 'Medicina',
    Mystery: 'Mistero',
    Philosophical: 'Filosofico',
    Psychological: 'Psicologico',
    Romance: 'Romantico',
    'Sci-Fi': 'Fantascienza',
    'Slice of Life': 'Vita quotidiana',
    Sports: 'Sport',
    Superhero: 'Supereroi',
    Thriller: 'Thriller',
    Tragedy: 'Tragedia',
    Wuxia: 'Wuxia'
};

const STATUS_LABELS = {
    ongoing: 'In corso',
    completed: 'Completato',
    hiatus: 'In pausa',
    cancelled: 'Cancellato',
    unknown: 'Stato sconosciuto'
};

const LANGUAGE_LABELS = {
    it: 'Italiano',
    en: 'Inglese',
    ja: 'Giapponese',
    ko: 'Coreano',
    'zh-hk': 'Cinese tradizionale',
    zh: 'Cinese',
    es: 'Spagnolo',
    fr: 'Francese',
    de: 'Tedesco',
    pt: 'Portoghese',
    'pt-br': 'Portoghese BR',
    ru: 'Russo'
};

const DEMOGRAPHIC_LABELS = {
    shounen: 'Shōnen',
    shoujo: 'Shōjo',
    seinen: 'Seinen',
    josei: 'Josei',
    none: 'Generale'
};

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const genreLabel = (name = '') => GENRE_LABELS[name] || name;
const languageLabel = (code = '') => LANGUAGE_LABELS[code] || String(code).toUpperCase();

const resetMangaScroll = () => {
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = 'pan-y';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.backgroundColor = '#05010a';
    window.scrollTo(0, 0);
};

const cardSkeletons = () => Array.from({ length: 12 }, (_, index) => `
    <div class="manga-card manga-card-skeleton" aria-hidden="true" style="--skeleton-index:${index}">
        <span class="manga-skeleton-cover"></span>
        <span class="manga-skeleton-line"></span>
        <span class="manga-skeleton-line short"></span>
    </div>
`).join('');

const renderMangaCard = (manga) => {
    const authors = manga.authors.length ? manga.authors.join(', ') : 'Autore non indicato';
    const status = STATUS_LABELS[manga.status] || manga.status;
    const leadingTags = manga.tags.filter(tag => tag.group === 'genre').slice(0, 3);

    return `
        <article class="manga-card">
            <button class="manga-card-open" type="button" data-manga-id="${escapeHTML(manga.id)}" aria-label="Apri ${escapeHTML(manga.title)}">
                <span class="manga-cover ${manga.coverUrl ? '' : 'is-missing'}">
                    <span class="manga-cover-placeholder" aria-hidden="true">漫</span>
                    ${manga.coverUrl ? `
                        <img src="${escapeHTML(manga.coverUrl)}" alt="Copertina di ${escapeHTML(manga.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
                    ` : ''}
                    <span class="manga-cover-shine" aria-hidden="true"></span>
                    <span class="manga-card-status">${escapeHTML(status)}</span>
                </span>
                <span class="manga-card-copy">
                    <strong>${escapeHTML(manga.title)}</strong>
                    <span class="manga-card-author">${escapeHTML(authors)}</span>
                    <span class="manga-card-tags">
                        ${leadingTags.map(tag => `<small>${escapeHTML(genreLabel(tag.name))}</small>`).join('')}
                    </span>
                </span>
            </button>
        </article>
    `;
};

const renderShell = (container) => {
    container.innerHTML = `
        <div class="manga-app fade-in">
            <button id="manga-back-to-lobby" class="btn-back-glass manga-back" type="button">TORNA ALLA TAVERNA</button>

            <header class="manga-hero">
                <div class="manga-hero-orbit orbit-one" aria-hidden="true"></div>
                <div class="manga-hero-orbit orbit-two" aria-hidden="true"></div>
                <div class="manga-hero-copy">
                    <p class="manga-eyebrow">Archivio illustrato della Taverna</p>
                    <h1>MANGA</h1>
                    <p class="manga-hero-intro">Cerca una storia, scegli i generi e scopri nuove letture nel catalogo mondiale MangaDex.</p>
                </div>

                <section class="manga-search-panel" aria-label="Ricerca manga">
                    <form id="manga-search-form" class="manga-search-form" role="search">
                        <label for="manga-search-input">Cerca per titolo</label>
                        <div class="manga-search-control">
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"></path>
                            </svg>
                            <input id="manga-search-input" type="search" maxlength="120" autocomplete="off" placeholder="Es. Berserk, One Piece, Frieren...">
                            <button type="submit">CERCA</button>
                        </div>
                    </form>

                    <details class="manga-genre-filter" id="manga-genre-filter">
                        <summary>
                            <span class="manga-filter-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10m-7 6h4"></path></svg>
                            </span>
                            <span>
                                <strong>Filtra per genere</strong>
                                <small id="manga-genre-summary">Tutti i generi</small>
                            </span>
                            <span class="manga-filter-chevron" aria-hidden="true">⌄</span>
                        </summary>
                        <div class="manga-genre-panel">
                            <div class="manga-genre-panel-head">
                                <div>
                                    <strong>Scegli uno o più generi</strong>
                                    <span>I risultati devono includerli tutti.</span>
                                </div>
                                <button id="manga-clear-genres" type="button">AZZERA</button>
                            </div>
                            <div class="manga-genre-options" id="manga-genre-options" aria-live="polite">
                                <span class="manga-genre-loading">Sto preparando i generi...</span>
                            </div>
                        </div>
                    </details>

                    <div class="manga-active-filters" id="manga-active-filters" hidden></div>
                </section>
            </header>

            <main class="manga-catalog">
                <header class="manga-catalog-head">
                    <div>
                        <p class="manga-section-kicker">Selezione del giorno</p>
                        <h2 id="manga-results-title">I più amati dai lettori</h2>
                        <span id="manga-result-count">Caricamento del catalogo...</span>
                    </div>
                    <label class="manga-sort">
                        <span>Ordina</span>
                        <select id="manga-sort-select">
                            <option value="followedCount">Più seguiti</option>
                            <option value="rating">Più votati</option>
                            <option value="latestUploadedChapter">Ultimi capitoli</option>
                            <option value="updatedAt">Aggiornati di recente</option>
                            <option value="relevance">Rilevanza</option>
                        </select>
                    </label>
                </header>

                <div class="manga-grid" id="manga-results" aria-live="polite" aria-busy="true">
                    ${cardSkeletons()}
                </div>

                <div class="manga-catalog-footer">
                    <p id="manga-catalog-message" role="status"></p>
                    <button id="manga-load-more" class="manga-load-more" type="button" hidden>CARICA ALTRI MANGA</button>
                </div>
            </main>

            <footer class="manga-provider-note">
                <span aria-hidden="true"></span>
                Dati del catalogo forniti da MangaDex
            </footer>

            <div class="manga-detail-modal" id="manga-detail-modal" aria-hidden="true">
                <button class="manga-detail-backdrop" type="button" data-close-manga-detail aria-label="Chiudi dettagli"></button>
                <section class="manga-detail-panel" role="dialog" aria-modal="true" aria-labelledby="manga-detail-title" tabindex="-1">
                    <button class="manga-detail-close" type="button" data-close-manga-detail aria-label="Chiudi dettagli">×</button>
                    <div id="manga-detail-content"></div>
                </section>
            </div>
        </div>
    `;
};

export function initMangaDashboard(container) {
    if (!container) return;

    window.__mangaCleanup?.();
    try { updateSidebarContext('manga'); } catch { /* sidebar opzionale durante il boot */ }
    resetMangaScroll();
    renderShell(container);

    const state = {
        genres: [],
        selectedGenres: new Set(),
        query: '',
        sort: 'followedCount',
        items: [],
        total: 0,
        offset: 0,
        requestId: 0,
        searchController: null,
        genreController: new AbortController()
    };

    const elements = {
        app: container.querySelector('.manga-app'),
        form: container.querySelector('#manga-search-form'),
        searchInput: container.querySelector('#manga-search-input'),
        genreDetails: container.querySelector('#manga-genre-filter'),
        genreSummary: container.querySelector('#manga-genre-summary'),
        genreOptions: container.querySelector('#manga-genre-options'),
        clearGenres: container.querySelector('#manga-clear-genres'),
        activeFilters: container.querySelector('#manga-active-filters'),
        sort: container.querySelector('#manga-sort-select'),
        title: container.querySelector('#manga-results-title'),
        count: container.querySelector('#manga-result-count'),
        results: container.querySelector('#manga-results'),
        message: container.querySelector('#manga-catalog-message'),
        loadMore: container.querySelector('#manga-load-more'),
        modal: container.querySelector('#manga-detail-modal'),
        modalPanel: container.querySelector('.manga-detail-panel'),
        modalContent: container.querySelector('#manga-detail-content')
    };

    const selectedGenreObjects = () => state.genres.filter(genre => state.selectedGenres.has(genre.id));

    const updateGenreUI = () => {
        const selected = selectedGenreObjects();
        elements.genreSummary.textContent = selected.length
            ? `${selected.length} ${selected.length === 1 ? 'genere selezionato' : 'generi selezionati'}`
            : 'Tutti i generi';

        elements.genreOptions.querySelectorAll('[data-genre-id]').forEach(button => {
            const active = state.selectedGenres.has(button.dataset.genreId);
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });

        if (!selected.length && !state.query) {
            elements.activeFilters.hidden = true;
            elements.activeFilters.innerHTML = '';
            return;
        }

        elements.activeFilters.hidden = false;
        elements.activeFilters.innerHTML = `
            ${state.query ? `
                <button type="button" data-clear-query>
                    Ricerca: <strong>${escapeHTML(state.query)}</strong><span aria-hidden="true">×</span>
                </button>
            ` : ''}
            ${selected.map(genre => `
                <button type="button" data-remove-genre="${escapeHTML(genre.id)}">
                    ${escapeHTML(genreLabel(genre.name))}<span aria-hidden="true">×</span>
                </button>
            `).join('')}
        `;
    };

    const renderGenreOptions = () => {
        elements.genreOptions.innerHTML = state.genres.length
            ? state.genres.map(genre => `
                <button type="button" data-genre-id="${escapeHTML(genre.id)}" aria-pressed="false">
                    <span aria-hidden="true"></span>
                    ${escapeHTML(genreLabel(genre.name))}
                </button>
            `).join('')
            : '<span class="manga-genre-loading">Nessun genere disponibile.</span>';
        updateGenreUI();
    };

    const updateCatalogHeading = () => {
        if (state.query) {
            elements.title.textContent = `Risultati per “${state.query}”`;
            return;
        }
        if (state.selectedGenres.size) {
            elements.title.textContent = 'Scelti per i tuoi generi';
            return;
        }
        elements.title.textContent = 'I più amati dai lettori';
    };

    const renderResults = ({ append = false, newItems = state.items } = {}) => {
        const html = (append ? newItems : state.items).map(renderMangaCard).join('');
        if (!append) elements.results.innerHTML = html;
        else elements.results.insertAdjacentHTML('beforeend', html);

        elements.results.setAttribute('aria-busy', 'false');
        elements.count.textContent = state.total
            ? `${state.total.toLocaleString('it-IT')} titoli trovati`
            : 'Nessun titolo trovato';
        elements.loadMore.hidden = state.items.length >= state.total || !state.items.length;
        elements.loadMore.disabled = false;
        elements.loadMore.textContent = 'CARICA ALTRI MANGA';

        if (!state.items.length) {
            elements.results.innerHTML = `
                <section class="manga-empty">
                    <span aria-hidden="true">漫</span>
                    <h3>Nessun manga trovato</h3>
                    <p>Prova un titolo più breve oppure rimuovi uno dei generi selezionati.</p>
                    <button type="button" data-reset-catalog>TORNA AI PIÙ SEGUITI</button>
                </section>
            `;
        }
    };

    const loadCatalog = async ({ append = false } = {}) => {
        const requestId = ++state.requestId;
        state.searchController?.abort();
        state.searchController = new AbortController();

        if (!append) {
            state.offset = 0;
            state.items = [];
            elements.results.innerHTML = cardSkeletons();
            elements.results.setAttribute('aria-busy', 'true');
            elements.count.textContent = 'Sto cercando nel catalogo...';
        } else {
            elements.loadMore.disabled = true;
            elements.loadMore.textContent = 'CARICAMENTO...';
        }

        elements.message.textContent = '';
        updateCatalogHeading();

        try {
            const result = await searchManga({
                query: state.query,
                genreIds: [...state.selectedGenres],
                sort: state.sort,
                offset: state.offset,
                limit: PAGE_SIZE,
                signal: state.searchController.signal
            });

            if (requestId !== state.requestId) return;

            state.total = result.total;
            state.items = append ? [...state.items, ...result.items] : result.items;
            renderResults({ append, newItems: result.items });
        } catch (error) {
            if (error?.name === 'AbortError' || requestId !== state.requestId) return;
            elements.results.setAttribute('aria-busy', 'false');
            elements.results.innerHTML = `
                <section class="manga-empty manga-error">
                    <span aria-hidden="true">!</span>
                    <h3>Il catalogo non risponde</h3>
                    <p>${escapeHTML(error?.message || 'Riprova tra qualche istante.')}</p>
                    <button type="button" data-retry-catalog>RIPROVA</button>
                </section>
            `;
            elements.count.textContent = 'Connessione non disponibile';
            elements.loadMore.hidden = true;
        }
    };

    const closeModal = () => {
        elements.modal.classList.remove('active');
        elements.modal.setAttribute('aria-hidden', 'true');
        elements.app.classList.remove('has-detail-open');
        document.body.classList.remove('manga-detail-open');
    };

    const openModal = (mangaId) => {
        const manga = state.items.find(item => item.id === mangaId);
        if (!manga) return;

        const authors = manga.authors.length ? manga.authors.join(', ') : 'Non indicato';
        const artists = manga.artists.length ? manga.artists.join(', ') : authors;
        const translations = manga.availableTranslatedLanguages.slice(0, 10).map(languageLabel);
        const genres = manga.tags.filter(tag => tag.group === 'genre');

        elements.modalContent.innerHTML = `
            <div class="manga-detail-layout">
                <div class="manga-detail-cover ${manga.coverUrl ? '' : 'is-missing'}">
                    <span aria-hidden="true">漫</span>
                    ${manga.coverUrl ? `<img src="${escapeHTML(manga.coverUrl)}" alt="Copertina di ${escapeHTML(manga.title)}" decoding="async" referrerpolicy="no-referrer">` : ''}
                </div>
                <div class="manga-detail-copy">
                    <p class="manga-detail-eyebrow">${escapeHTML(STATUS_LABELS[manga.status] || manga.status)}${manga.year ? ` · ${escapeHTML(manga.year)}` : ''}</p>
                    <h2 id="manga-detail-title">${escapeHTML(manga.title)}</h2>
                    <p class="manga-detail-byline">di ${escapeHTML(authors)}</p>

                    <div class="manga-detail-tags">
                        ${genres.map(tag => `<span>${escapeHTML(genreLabel(tag.name))}</span>`).join('')}
                    </div>

                    <p class="manga-detail-description">${escapeHTML(manga.description)}</p>

                    <dl class="manga-detail-data">
                        <div><dt>Autore</dt><dd>${escapeHTML(authors)}</dd></div>
                        <div><dt>Disegni</dt><dd>${escapeHTML(artists)}</dd></div>
                        <div><dt>Lingua originale</dt><dd>${escapeHTML(languageLabel(manga.originalLanguage) || 'Non indicata')}</dd></div>
                        <div><dt>Pubblico</dt><dd>${escapeHTML(DEMOGRAPHIC_LABELS[manga.publicationDemographic] || manga.publicationDemographic || 'Generale')}</dd></div>
                        <div><dt>Ultimo volume</dt><dd>${escapeHTML(manga.lastVolume || '—')}</dd></div>
                        <div><dt>Ultimo capitolo</dt><dd>${escapeHTML(manga.lastChapter || '—')}</dd></div>
                    </dl>

                    ${translations.length ? `
                        <div class="manga-detail-translations">
                            <strong>Traduzioni disponibili</strong>
                            <p>${escapeHTML(translations.join(' · '))}${manga.availableTranslatedLanguages.length > translations.length ? ' · …' : ''}</p>
                        </div>
                    ` : ''}

                    <a class="manga-detail-link" href="${escapeHTML(manga.mangaDexUrl)}" target="_blank" rel="noopener noreferrer">
                        APRI SU MANGADEX
                        <span aria-hidden="true">↗</span>
                    </a>
                </div>
            </div>
        `;

        elements.modal.classList.add('active');
        elements.modal.setAttribute('aria-hidden', 'false');
        elements.app.classList.add('has-detail-open');
        document.body.classList.add('manga-detail-open');
        requestAnimationFrame(() => elements.modalPanel.focus({ preventScroll: true }));
    };

    const resetCatalog = () => {
        state.query = '';
        state.sort = 'followedCount';
        state.selectedGenres.clear();
        elements.searchInput.value = '';
        elements.sort.value = state.sort;
        updateGenreUI();
        loadCatalog();
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape' && elements.modal.classList.contains('active')) closeModal();
    };

    elements.form.addEventListener('submit', event => {
        event.preventDefault();
        state.query = elements.searchInput.value.trim();
        if (state.query) {
            state.sort = 'relevance';
            elements.sort.value = 'relevance';
        } else if (state.sort === 'relevance') {
            state.sort = 'followedCount';
            elements.sort.value = 'followedCount';
        }
        updateGenreUI();
        loadCatalog();
    });

    elements.sort.addEventListener('change', () => {
        state.sort = elements.sort.value;
        loadCatalog();
    });

    elements.genreOptions.addEventListener('click', event => {
        const button = event.target.closest('[data-genre-id]');
        if (!button) return;
        const genreId = button.dataset.genreId;
        if (state.selectedGenres.has(genreId)) state.selectedGenres.delete(genreId);
        else if (state.selectedGenres.size < 8) state.selectedGenres.add(genreId);
        else {
            elements.message.textContent = 'Puoi combinare fino a 8 generi.';
            return;
        }
        updateGenreUI();
        loadCatalog();
    });

    elements.clearGenres.addEventListener('click', () => {
        if (!state.selectedGenres.size) return;
        state.selectedGenres.clear();
        updateGenreUI();
        loadCatalog();
    });

    elements.activeFilters.addEventListener('click', event => {
        const genreButton = event.target.closest('[data-remove-genre]');
        if (genreButton) {
            state.selectedGenres.delete(genreButton.dataset.removeGenre);
            updateGenreUI();
            loadCatalog();
            return;
        }
        if (event.target.closest('[data-clear-query]')) {
            state.query = '';
            elements.searchInput.value = '';
            if (state.sort === 'relevance') {
                state.sort = 'followedCount';
                elements.sort.value = 'followedCount';
            }
            updateGenreUI();
            loadCatalog();
        }
    });

    elements.results.addEventListener('click', event => {
        const mangaButton = event.target.closest('[data-manga-id]');
        if (mangaButton) {
            openModal(mangaButton.dataset.mangaId);
            return;
        }
        if (event.target.closest('[data-reset-catalog]')) resetCatalog();
        if (event.target.closest('[data-retry-catalog]')) loadCatalog();
    });

    elements.results.addEventListener('error', event => {
        const image = event.target.closest('.manga-cover img');
        if (!image) return;
        image.hidden = true;
        image.closest('.manga-cover')?.classList.add('is-missing');
    }, true);

    elements.loadMore.addEventListener('click', () => {
        state.offset = state.items.length;
        loadCatalog({ append: true });
    });

    elements.modal.addEventListener('click', event => {
        if (event.target.closest('[data-close-manga-detail]')) closeModal();
    });

    container.querySelector('#manga-back-to-lobby').addEventListener('click', () => {
        window.__mangaCleanup?.();
        showLobby(container);
    });

    document.addEventListener('keydown', handleKeyDown);
    window.__mangaCleanup = () => {
        state.searchController?.abort();
        state.genreController.abort();
        document.removeEventListener('keydown', handleKeyDown);
        document.body.classList.remove('manga-detail-open');
        window.__mangaCleanup = null;
    };

    fetchMangaGenres({ signal: state.genreController.signal })
        .then(genres => {
            state.genres = genres;
            renderGenreOptions();
        })
        .catch(error => {
            if (error?.name === 'AbortError') return;
            elements.genreOptions.innerHTML = '<span class="manga-genre-loading">Generi temporaneamente non disponibili.</span>';
        });

    loadCatalog();
}
