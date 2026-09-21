import { loadView } from './navigationLoading.js';

const LAST_DESTINATION_KEY = 'taverna_last_destination';

export const resetAppSurface = () => {
    window.__homeCleanup?.();
    window.__shopCleanup?.();
    window.__dndSessionCleanup?.();
    window.__minigameMultiplayerCleanup?.();
    window.__settingsCleanup?.();
    window.__readingCleanup?.();
    window.__homeCleanup = null;
    window.__shopCleanup = null;
    window.__settingsCleanup = null;
    window.__readingCleanup = null;
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    document.body.style.backgroundColor = '';
    document.getElementById('app')?.scrollTo(0, 0);
    document.body.classList.remove('dnd-session-active', 'dnd-session-tools-open', 'dnd-session-chat-open');
};

export const rememberDestination = (destination, options = {}) => {
    if (!destination || destination === 'home') return;
    try {
        localStorage.setItem(LAST_DESTINATION_KEY, JSON.stringify({
            destination,
            options,
            updatedAt: Date.now()
        }));
    } catch {
        // La navigazione funziona anche senza storage persistente.
    }
};

export const getLastDestination = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(LAST_DESTINATION_KEY) || 'null');
        return saved?.destination ? saved : null;
    } catch {
        return null;
    }
};

export async function navigateTo(destination, container = document.getElementById('app'), options = {}) {
    if (!container) return false;

    if (destination === 'dnd5e' || destination === 'pathfinder2e') {
        try {
            const guestUser = JSON.parse(localStorage.getItem('taverna_guest_user') || 'null');
            if (guestUser && !guestUser.isLocalDnd) {
                alert('Accedi per aprire i tavoli GDR.');
                return false;
            }
        } catch {
            // Se lo storage non e disponibile, lascia decidere al modulo GDR.
        }
    }

    const routes = {
        home: { label: 'la Taverna', load: () => import('../lobby.js'), render: (module) => module.showLobby(container) },
        minigames: { label: 'la sala giochi', load: () => import('../minigamelist.js'), render: (module) => module.showMinigamesList(container, options) },
        dnd5e: { label: 'D&D', load: () => import('../dashboards/dnd5e.js'), render: (module) => module.initDndDashboard(container) },
        pathfinder2e: { label: 'Pathfinder', load: () => import('../dashboards/pathfinder2e.js'), render: (module) => module.initPathfinderDashboard(container) },
        reading: { label: 'Lettura', load: () => import('../components/features/reading/Reading.js'), render: (module) => module.showReading(container) },
        shop: { label: 'la bottega', load: () => import('../dashboards/shop.js'), render: (module) => module.initShop(container) },
        profile: { label: 'il profilo', deferred: true, load: () => import('../components/features/user/Profile.js'), render: (module, context) => module.showProfile(container, options.user || null, context) },
        settings: { label: 'le impostazioni', deferred: true, load: () => import('../components/features/user/Settings.js'), render: (module, context) => module.showSettings(container, options.user || null, context) },
        music: { label: 'la libreria musicale', deferred: true, load: () => import('../components/ui/AudioManager.js'), render: (module, context) => module.AudioManager.showMusicCenter(container, context) }
    };
    const route = routes[destination];
    if (!route) return false;

    return loadView(container, async () => {
        const module = await route.load();
        return async context => {
            if (!route.deferred && !context.beforeRender()) return;
            await route.render(module, context);
            if (context.isCurrent() && ['minigames', 'dnd5e', 'pathfinder2e', 'reading', 'shop'].includes(destination)) {
                rememberDestination(destination, destination === 'minigames' ? options : {});
            }
        };
    }, { label: route.label, beforeRender: resetAppSurface });
}
