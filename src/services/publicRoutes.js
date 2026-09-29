export const PUBLIC_ROUTES = Object.freeze({
    shop: '/bottega',
    artisanShop: '/bottega/artigiano-rituale'
});
export function destinationFromPath(pathname) {
    const path = pathname.replace(/\/+$/, '') || '/';
    return Object.entries(PUBLIC_ROUTES).find(([, value]) => value === path)?.[0] || null;
}
export function syncDestinationPath(destination, options = {}) {
    if (options.fromHistory) return;
    const path = PUBLIC_ROUTES[destination] || '/';
    // Only introduce URLs for the public shop; other app destinations keep /.
    if (!PUBLIC_ROUTES[destination] && !destinationFromPath(location.pathname)) return;
    const state = { tavernaDestination: destination };
    if (location.pathname === path) history.replaceState(state, '', path);
    else history.pushState(state, '', path);
}
