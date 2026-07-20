import { methodNotAllowed, sendJson } from '../_lib/http.js';

const MANGADEX_API_BASE = 'https://api.mangadex.org';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_SORTS = new Set([
    'relevance',
    'followedCount',
    'rating',
    'updatedAt',
    'latestUploadedChapter',
    'year',
    'title'
]);

const queryValue = (request, key, fallback = '') => {
    const value = request.query?.[key];
    if (Array.isArray(value)) return String(value[0] ?? fallback);
    return String(value ?? fallback);
};

const clampNumber = (value, min, max, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const splitUuidList = (value = '') => String(value)
    .split(',')
    .map(item => item.trim())
    .filter(item => UUID_PATTERN.test(item))
    .slice(0, 8);

const fetchMangaDex = async (url) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    try {
        const upstream = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'LaTaverna/1.1 (https://www.lataverna.xyz)'
            },
            signal: controller.signal
        });

        const payload = await upstream.json().catch(() => ({
            result: 'error',
            errors: [{ detail: 'Risposta MangaDex non valida.' }]
        }));

        return { upstream, payload };
    } finally {
        clearTimeout(timeout);
    }
};

export default async function handler(request, response) {
    if (request.method !== 'GET') return methodNotAllowed(response, ['GET']);

    try {
        const action = queryValue(request, 'action', 'search');
        let upstreamUrl;

        if (action === 'genres') {
            upstreamUrl = new URL('/manga/tag', MANGADEX_API_BASE);
            response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        } else {
            const query = queryValue(request, 'q').trim().slice(0, 120);
            const genreIds = splitUuidList(queryValue(request, 'genres'));
            const limit = clampNumber(queryValue(request, 'limit'), 1, 24, 18);
            const offset = clampNumber(queryValue(request, 'offset'), 0, 10000, 0);
            const requestedSort = queryValue(request, 'sort', query ? 'relevance' : 'followedCount');
            const sort = ALLOWED_SORTS.has(requestedSort)
                ? requestedSort
                : (query ? 'relevance' : 'followedCount');

            upstreamUrl = new URL('/manga', MANGADEX_API_BASE);
            upstreamUrl.searchParams.set('limit', String(limit));
            upstreamUrl.searchParams.set('offset', String(offset));
            upstreamUrl.searchParams.set('hasAvailableChapters', 'true');
            upstreamUrl.searchParams.set('includedTagsMode', 'AND');
            upstreamUrl.searchParams.set(`order[${sort === 'relevance' && !query ? 'followedCount' : sort}]`, 'desc');
            upstreamUrl.searchParams.append('contentRating[]', 'safe');
            upstreamUrl.searchParams.append('contentRating[]', 'suggestive');
            upstreamUrl.searchParams.append('includes[]', 'cover_art');
            upstreamUrl.searchParams.append('includes[]', 'author');
            upstreamUrl.searchParams.append('includes[]', 'artist');

            if (query) upstreamUrl.searchParams.set('title', query);
            genreIds.forEach(id => upstreamUrl.searchParams.append('includedTags[]', id));

            response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
        }

        const { upstream, payload } = await fetchMangaDex(upstreamUrl);
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('X-Manga-Provider', 'MangaDex');

        if (!upstream.ok) {
            return sendJson(response, upstream.status, {
                result: 'error',
                errors: payload?.errors || [{ detail: 'MangaDex non è disponibile in questo momento.' }]
            });
        }

        return sendJson(response, 200, payload);
    } catch (error) {
        const timedOut = error?.name === 'AbortError';
        return sendJson(response, timedOut ? 504 : 502, {
            result: 'error',
            errors: [{
                detail: timedOut
                    ? 'MangaDex ha impiegato troppo tempo a rispondere.'
                    : 'Impossibile contattare MangaDex.'
            }]
        });
    }
}
