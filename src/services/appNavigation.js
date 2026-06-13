const LAST_DESTINATION_KEY = 'taverna_last_destination';

export const resetAppSurface = () => {
    window.__homeCleanup?.();
    window.__dndSessionCleanup?.();
    window.__minigameMultiplayerCleanup?.();
    window.__homeCleanup = null;
    document.documentElement.style.overflow = '';
    document.documentElement.style.overscrollBehavior = '';
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    document.body.style.backgroundColor = '';
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

    resetAppSurface();
    container.innerHTML = '';

    if (destination === 'home') {
        const { showLobby } = await import('../lobby.js');
        showLobby(container);
        return true;
    }

    if (destination === 'minigames') {
        rememberDestination(destination, options);
        const { showMinigamesList } = await import('../minigamelist.js');
        showMinigamesList(container, options);
        return true;
    }

    if (destination === 'dnd5e') {
        rememberDestination(destination);
        const { initDndDashboard } = await import('../dashboards/dnd5e.js');
        initDndDashboard(container);
        return true;
    }

    if (destination === 'pathfinder2e') {
        rememberDestination(destination);
        const { initPathfinderDashboard } = await import('../dashboards/pathfinder2e.js');
        initPathfinderDashboard(container);
        return true;
    }

    if (destination === 'profile') {
        const { showProfile } = await import('../components/features/user/Profile.js');
        showProfile(container, options.user || null);
        return true;
    }

    if (destination === 'settings') {
        const { showSettings } = await import('../components/features/user/Settings.js');
        showSettings(container, options.user || null);
        return true;
    }

    if (destination === 'music') {
        const { AudioManager } = await import('../components/ui/AudioManager.js');
        AudioManager.showMusicCenter(container);
        return true;
    }

    return false;
}
