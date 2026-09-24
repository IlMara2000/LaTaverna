const prefix = 'taverna_reading_position_v1:';
const keyFor = (userId, bookId) => `${prefix}${encodeURIComponent(userId || 'guest')}:${encodeURIComponent(bookId)}`;

export function normalizeReadingPosition(value) {
    if (!value || !Number.isInteger(value.page) || value.page < 1) return null;
    const zoom = value.zoom;
    if (!(typeof zoom === 'number' && Number.isFinite(zoom) && zoom >= .1 && zoom <= 10)
        && !['page-width', 'page-fit', 'auto'].includes(zoom)) return null;
    if (![value.left, value.top].every(Number.isFinite)) return null;
    return { page: value.page, left: value.left, top: value.top, zoom,
        fingerprint: typeof value.fingerprint === 'string' ? value.fingerprint : '',
        updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : 0 };
}

export function getReadingPosition(userId, bookId, storage) {
    try { return normalizeReadingPosition(JSON.parse((storage || globalThis.localStorage).getItem(keyFor(userId, bookId)))); }
    catch { return null; }
}

export function saveReadingPosition(userId, bookId, position, storage) {
    const clean = normalizeReadingPosition({ ...position, updatedAt: Date.now() });
    if (!clean) return false;
    try { (storage || globalThis.localStorage).setItem(keyFor(userId, bookId), JSON.stringify(clean)); return true; }
    catch { return false; }
}

const preferencesKey = userId => `taverna_reader_preferences:${encodeURIComponent(userId || 'guest')}`;
export function getReaderPreferences(userId, storage) {
    try {
        const value = JSON.parse((storage || globalThis.localStorage).getItem(preferencesKey(userId))) || {};
        return { theme: ['paper', 'sepia', 'night'].includes(value.theme) ? value.theme : 'paper',
            mode: value.mode === 'page' ? 'page' : 'continuous' };
    } catch { return { theme: 'paper', mode: 'continuous' }; }
}
export function saveReaderPreferences(userId, value, storage) {
    try { (storage || globalThis.localStorage).setItem(preferencesKey(userId), JSON.stringify(value)); }
    catch { /* Reading remains available when browser storage is disabled. */ }
}
