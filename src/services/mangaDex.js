const MANGADEX_API_BASE = 'https://api.mangadex.org';
const COVER_BASE = 'https://uploads.mangadex.org/covers';
const LOCAL_API_ENDPOINT = '/api/manga/catalog';
const DIRECT_API_BASE = import.meta.env.DEV
    ? `${window.location.origin}/mangadex-api/`
    : `${MANGADEX_API_BASE}/`;

const preferredText = (localized = {}, fallback = '') => (
    localized?.it
    || localized?.en
    || localized?.['ja-ro']
    || localized?.ja
    || Object.values(localized || {}).find(Boolean)
    || fallback
);

const uniqueNames = (relationships = [], types = []) => {
    const names = relationships
        .filter(item => types.includes(item?.type))
        .map(item => item?.attributes?.name)
        .filter(Boolean);
    return [...new Set(names)];
};

const coverUrlFor = (manga) => {
    const cover = manga.relationships?.find(item => item?.type === 'cover_art');
    const filename = cover?.attributes?.fileName;
    return filename ? `${COVER_BASE}/${manga.id}/${filename}.512.jpg` : '';
};

const normalizeTag = (tag) => ({
    id: tag.id,
    name: preferredText(tag.attributes?.name, 'Senza nome'),
    description: preferredText(tag.attributes?.description),
    group: tag.attributes?.group || 'other'
});

const normalizeManga = (manga) => {
    const attributes = manga.attributes || {};
    const tags = (attributes.tags || []).map(normalizeTag);
    const authors = uniqueNames(manga.relationships, ['author']);
    const artists = uniqueNames(manga.relationships, ['artist']);

    return {
        id: manga.id,
        title: preferredText(attributes.title, 'Titolo non disponibile'),
        originalTitle: preferredText(attributes.title, ''),
        alternativeTitles: (attributes.altTitles || [])
            .map(title => preferredText(title))
            .filter(Boolean)
            .slice(0, 8),
        description: preferredText(attributes.description, 'Nessuna descrizione disponibile.').slice(0, 2400),
        coverUrl: coverUrlFor(manga),
        authors,
        artists,
        tags,
        year: attributes.year || null,
        status: attributes.status || 'unknown',
        originalLanguage: attributes.originalLanguage || '',
        publicationDemographic: attributes.publicationDemographic || '',
        contentRating: attributes.contentRating || 'safe',
        lastVolume: attributes.lastVolume || '',
        lastChapter: attributes.lastChapter || '',
        availableTranslatedLanguages: attributes.availableTranslatedLanguages || [],
        links: attributes.links || {},
        mangaDexUrl: `https://mangadex.org/title/${manga.id}`
    };
};

const assertMangaDexResponse = (response, payload) => {
    if (!response.ok || payload?.result === 'error') {
        const detail = payload?.errors?.[0]?.detail || 'Catalogo manga non disponibile.';
        const error = new Error(detail);
        error.status = response.status;
        throw error;
    }
    return payload;
};

const requestJson = async (url, signal) => {
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error('Endpoint catalogo locale non disponibile.');
    }
    const payload = await response.json();
    return assertMangaDexResponse(response, payload);
};

const buildProxyUrl = (params = {}) => {
    const url = new URL(LOCAL_API_ENDPOINT, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });
    return url;
};

const buildDirectUrl = (params = {}) => {
    if (params.action === 'genres') return new URL('manga/tag', DIRECT_API_BASE);

    const url = new URL('manga', DIRECT_API_BASE);
    const query = String(params.q || '').trim();
    const sort = params.sort === 'relevance' && !query ? 'followedCount' : (params.sort || 'followedCount');
    const genreIds = String(params.genres || '').split(',').filter(Boolean).slice(0, 8);

    url.searchParams.set('limit', String(params.limit || 18));
    url.searchParams.set('offset', String(params.offset || 0));
    url.searchParams.set('hasAvailableChapters', 'true');
    url.searchParams.set('includedTagsMode', 'AND');
    url.searchParams.set(`order[${sort}]`, 'desc');
    url.searchParams.append('contentRating[]', 'safe');
    url.searchParams.append('contentRating[]', 'suggestive');
    url.searchParams.append('includes[]', 'cover_art');
    url.searchParams.append('includes[]', 'author');
    url.searchParams.append('includes[]', 'artist');

    if (query) url.searchParams.set('title', query.slice(0, 120));
    genreIds.forEach(id => url.searchParams.append('includedTags[]', id));
    return url;
};

const requestMangaDex = async (params, signal) => {
    try {
        return await requestJson(buildProxyUrl(params), signal);
    } catch (proxyError) {
        if (signal?.aborted) throw proxyError;
        return requestJson(buildDirectUrl(params), signal);
    }
};

export const fetchMangaGenres = async ({ signal } = {}) => {
    const payload = await requestMangaDex({ action: 'genres' }, signal);
    return (payload.data || [])
        .map(normalizeTag)
        .filter(tag => tag.group === 'genre')
        .sort((left, right) => left.name.localeCompare(right.name, 'it'));
};

export const searchManga = async ({
    query = '',
    genreIds = [],
    sort = query ? 'relevance' : 'followedCount',
    offset = 0,
    limit = 18,
    signal
} = {}) => {
    const payload = await requestMangaDex({
        action: 'search',
        q: query,
        genres: genreIds.join(','),
        sort,
        offset,
        limit
    }, signal);

    return {
        items: (payload.data || []).map(normalizeManga),
        total: Number(payload.total || 0),
        offset: Number(payload.offset || offset),
        limit: Number(payload.limit || limit)
    };
};
