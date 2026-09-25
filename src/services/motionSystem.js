const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const activeAnimations = new Set();

export const prefersReducedMotion = () => {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
            || document.documentElement.classList.contains('app-reduced-motion');
    } catch {
        return false;
    }
};

// One owner for finite UI reveals. Native opacity/transform animations leave no
// inline styles behind, so CSS hover states and interrupted routes stay stable.
const reveal = (element, keyframes, options = {}) => {
    if (!element?.animate || prefersReducedMotion()) return null;
    const animation = element.animate(keyframes, {
        duration: 280, easing: EASE_OUT, ...options
    });
    activeAnimations.add(animation);
    animation.finished.then(
        () => activeAnimations.delete(animation),
        () => activeAnimations.delete(animation)
    );
    return animation;
};

const cancelAll = animations => animations.forEach(animation => {
    animation?.cancel();
    activeAnimations.delete(animation);
});

export function initMotionPreferences() {
    const visibility = () => document.documentElement.classList.toggle('app-backgrounded', document.hidden);
    document.addEventListener('visibilitychange', visibility);
    visibility();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
        if (!prefersReducedMotion()) return;
        const animations = new Set([...activeAnimations, ...document.getAnimations()]);
        animations.forEach(animation => {
            try {
                if (animation.effect?.getComputedTiming().iterations === Infinity) animation.cancel();
                else animation.finish();
            } catch {
                animation.cancel();
            }
        });
    };
    media.addEventListener('change', sync);
    window.addEventListener('appPreferencesChanged', sync);
    window.addEventListener('appPreferencesLoaded', sync);
    return () => {
        document.removeEventListener('visibilitychange', visibility);
        media.removeEventListener('change', sync);
        window.removeEventListener('appPreferencesChanged', sync);
        window.removeEventListener('appPreferencesLoaded', sync);
        cancelAll(activeAnimations);
    };
}

export async function playLoaderExit(loader, app = document.getElementById('app')) {
    app?.classList.remove('app-preparing');
    window.dispatchEvent(new CustomEvent('taverna:boot-visible'));
    if (!loader) return;
    loader.style.pointerEvents = 'none';
    try {
        await reveal(loader, { opacity: [1, 0] }, { duration: 240 })?.finished;
    } catch {
        // A preference change or interrupted animation must still unlock the app.
    } finally {
        loader.remove();
    }
}

export function enhancePortalMotion(container) {
    if (!container || prefersReducedMotion()) return () => {};
    const animations = [
        reveal(container.querySelector('#main-logo'), {
            opacity: [0.7, 1], transform: ['translateY(8px)', 'translateY(0)']
        }, { duration: 360 }),
        reveal(container.querySelector('.entry-cta'), {
            opacity: [0.6, 1], transform: ['translateY(5px)', 'translateY(0)']
        }, { duration: 320, delay: 60 })
    ];
    return () => cancelAll(animations);
}

export async function playPortalOpen(entry) {
    if (!entry) return;
    try {
        await reveal(entry, { opacity: [1, 0.35] }, { duration: 160 })?.finished;
    } catch {
        // Navigation continues if the user changes their motion preference.
    }
}

export function enhanceHomeMotion(container) {
    if (!container || prefersReducedMotion()) return () => {};
    const animations = [];
    const start = () => {
        if (!container.isConnected || prefersReducedMotion()) return;
        container.querySelectorAll('.taverna-scene').forEach((scene, index) => {
            animations.push(reveal(scene, {
                opacity: [0, 1], transform: ['translateY(12px) scale(.99)', 'translateY(0) scale(1)']
            }, { duration: 400, delay: index * 40 }));
        });
    };
    if (document.getElementById('app')?.classList.contains('app-preparing')) {
        window.addEventListener('taverna:boot-visible', start, { once: true });
    } else {
        start();
    }
    return () => {
        window.removeEventListener('taverna:boot-visible', start);
        cancelAll(animations);
    };
}

export function enhanceSurfaceMotion(container, options = {}) {
    if (!container || prefersReducedMotion() || !window.IntersectionObserver) return () => {};
    const animations = [];
    const selector = options.selector || '.game-card, .glass-box, .dnd-panel';
    const elements = [...container.querySelectorAll(selector)];
    // A group and its children must not fade/move simultaneously.
    const surfaces = elements.filter(element => !elements.some(parent => parent !== element && parent.contains(element)));
    const observer = new IntersectionObserver(entries => {
        entries.filter(entry => entry.isIntersecting).forEach((entry, index) => {
            observer.unobserve(entry.target);
            animations.push(reveal(entry.target, {
                opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)']
            }, { duration: 350, delay: Math.min(index * 40, 160) }));
        });
    }, { threshold: 0.05 });
    surfaces.forEach(element => observer.observe(element));
    return () => {
        observer.disconnect();
        cancelAll(animations);
    };
}
