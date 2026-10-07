export const PUBLIC_ROUTES = Object.freeze({
    minigames: '/minigames',
    dnd5e: '/dnd',
    shop: '/shop',
    reading: '/library',
    magic: '/magic',
    artisanShop: '/bottega/artigiano-rituale'
});
const LEGACY_ROUTES = Object.freeze({ '/bottega': 'shop' });
export function destinationFromPath(pathname) {
    const path = pathname.toLocaleLowerCase().replace(/\/+$/, '') || '/';
    return Object.entries(PUBLIC_ROUTES).find(([, value]) => value === path)?.[0]
        || LEGACY_ROUTES[path]
        || null;
}
export function syncDestinationPath(destination, options = {}) {
    if (options.fromHistory) return;
    const path = PUBLIC_ROUTES[destination] || '/';
    if (!PUBLIC_ROUTES[destination] && !destinationFromPath(location.pathname)) return;
    const state = { tavernaDestination: destination };
    if (location.pathname === path) history.replaceState(state, '', path);
    else history.pushState(state, '', path);
}
