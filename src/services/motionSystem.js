import { animate, hover, inView, press, stagger } from 'motion';

const EASE_OUT = [0.16, 1, 0.3, 1];
const EASE_SPRING = { type: 'spring', stiffness: 420, damping: 30, mass: 0.78 };

const getRoot = () => document.documentElement;

export const prefersReducedMotion = () => {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
            || getRoot().classList.contains('app-reduced-motion');
    } catch {
        return false;
    }
};

const stopAll = (items = []) => {
    items.forEach(item => {
        try {
            if (typeof item === 'function') item();
            else item?.stop?.();
        } catch {
            // Motion cleanup must never block navigation.
        }
    });
};

const safeAnimate = (target, keyframes, options = {}) => {
    if (!target || prefersReducedMotion()) return null;
    try {
        return animate(target, keyframes, options);
    } catch (err) {
        console.warn('Motion non applicata:', err);
        return null;
    }
};

const waitForBootVisibility = () => new Promise(resolve => {
    const app = document.getElementById('app');
    if (!app?.classList.contains('app-preparing')) {
        requestAnimationFrame(resolve);
        return;
    }

    window.addEventListener('taverna:boot-visible', () => requestAnimationFrame(resolve), { once: true });
});

export async function playLoaderExit(loader, app = document.getElementById('app')) {
    const revealApp = () => {
        if (!app) return;
        app.classList.remove('app-preparing');
        window.dispatchEvent(new CustomEvent('taverna:boot-visible'));

        if (prefersReducedMotion()) {
            app.style.opacity = '';
            app.style.transform = '';
            app.style.filter = '';
            return;
        }

        safeAnimate(app, {
            opacity: [0, 1],
            y: [10, 0],
            scale: [0.995, 1],
            filter: ['blur(8px)', 'blur(0px)']
        }, { duration: 0.58, ease: EASE_OUT });
    };

    if (!loader) {
        revealApp();
        return;
    }

    if (prefersReducedMotion()) {
        loader.remove();
        revealApp();
        return;
    }

    const logo = loader.querySelector('.pulse-logo');
    const text = loader.querySelector('.loader-text');

    loader.style.pointerEvents = 'none';
    safeAnimate(logo, {
        opacity: [1, 0],
        scale: [1, 0.88],
        y: [0, -8],
        filter: [
            'drop-shadow(0 0 30px var(--amethyst-bright))',
            'drop-shadow(0 0 0 rgba(157, 78, 221, 0))'
        ]
    }, { duration: 0.32, ease: EASE_OUT });

    safeAnimate(text, {
        opacity: [0.42, 0],
        y: [0, 8],
        letterSpacing: ['4px', '8px']
    }, { duration: 0.3, ease: EASE_OUT });

    revealApp();

    const exit = safeAnimate(loader, {
        opacity: [1, 0],
        scale: [1, 1.018],
        filter: ['blur(0px)', 'blur(14px)']
    }, { duration: 0.52, delay: 0.08, ease: EASE_OUT });

    try {
        await exit?.finished;
    } catch {
        // Ignore interrupted boot animation.
    }

    loader.remove();
}

export async function playRouteExit(target, source = null) {
    if (!target || prefersReducedMotion()) return;

    if (source) {
        safeAnimate(source, {
            scale: [1, 0.96],
            filter: ['brightness(1)', 'brightness(1.45) saturate(1.25)']
        }, { duration: 0.18, ease: EASE_OUT });
    }

    const exit = safeAnimate(target, {
        opacity: [1, 0],
        y: [0, -12],
        scale: [1, 0.985],
        filter: ['blur(0px)', 'blur(10px)']
    }, { duration: 0.26, ease: EASE_OUT });

    try {
        await exit?.finished;
    } catch {
        // Ignore interrupted animations during fast navigation.
    }
}

export function enhancePortalMotion(container) {
    if (!container || prefersReducedMotion()) return () => {};

    const cleanups = [];
    const entry = container.querySelector('#entry-screen');
    const logo = container.querySelector('#main-logo');
    const subtitle = container.querySelector('.subtitle');

    cleanups.push(safeAnimate(entry, {
        opacity: [0, 1],
        scale: [0.965, 1],
        filter: ['blur(12px)', 'blur(0px)']
    }, { duration: 0.86, ease: EASE_OUT }));

    cleanups.push(safeAnimate(logo, {
        y: [18, 0],
        scale: [0.82, 1],
        rotateZ: [-6, 0]
    }, { ...EASE_SPRING, delay: 0.08 }));

    cleanups.push(safeAnimate(subtitle, {
        opacity: [0, 0.56],
        y: [16, 0],
        letterSpacing: ['9px', '4px']
    }, { duration: 0.76, delay: 0.24, ease: EASE_OUT }));

    if (entry) {
        cleanups.push(hover(entry, element => {
            safeAnimate(logo, {
                scale: 1.08,
                y: -8,
                filter: 'drop-shadow(0 0 34px rgba(199, 125, 255, 0.92))'
            }, EASE_SPRING);
            return () => safeAnimate(logo, {
                scale: 1,
                y: 0,
                filter: 'drop-shadow(0 0 20px var(--amethyst-glow))'
            }, EASE_SPRING);
        }));

        cleanups.push(press(entry, () => {
            safeAnimate(logo, { scale: 0.94 }, { duration: 0.12, ease: EASE_OUT });
            return () => safeAnimate(logo, { scale: 1.12, y: -10 }, { duration: 0.22, ease: EASE_OUT });
        }));
    }

    return () => stopAll(cleanups);
}

export async function playPortalOpen(entry, logo) {
    if (!entry || prefersReducedMotion()) return;

    safeAnimate(logo, {
        scale: [1, 1.18],
        y: [0, -16],
        rotateZ: [0, 4],
        filter: [
            'drop-shadow(0 0 20px var(--amethyst-glow))',
            'drop-shadow(0 0 52px rgba(199, 125, 255, 1))'
        ]
    }, { duration: 0.38, ease: EASE_OUT });

    const exit = safeAnimate(entry, {
        opacity: [1, 0],
        scale: [1, 1.04],
        filter: ['blur(0px)', 'blur(18px)']
    }, { duration: 0.42, ease: EASE_OUT });

    try {
        await exit?.finished;
    } catch {
        // Ignore interrupted tap.
    }
}

export function enhanceHomeMotion(container) {
    if (!container || prefersReducedMotion()) return () => {};

    const cleanups = [];
    let cancelled = false;
    const home = container.querySelector('.taverna-home');
    const header = container.querySelector('.taverna-home-header');
    const stage = container.querySelector('.taverna-scene-stage');
    const scenes = [...container.querySelectorAll('.taverna-scene')];
    const sceneImages = scenes.map(scene => scene.querySelector('img')).filter(Boolean);
    const sceneTitles = scenes.map(scene => scene.querySelector('.taverna-scene-title')).filter(Boolean);
    const dockButtons = [...container.querySelectorAll('.taverna-home-dock button')];

    const startHomeMotion = async () => {
        await waitForBootVisibility();
        if (cancelled) return;

    cleanups.push(safeAnimate(home, {
        '--aurora-x': ['16%', '84%', '50%', '16%'],
        '--aurora-y': ['-22%', '8%', '38%', '-22%'],
        '--aurora-alpha': ['0.16', '0.32', '0.22', '0.16']
    }, { duration: 14, repeat: Infinity, ease: 'easeInOut' }));

    cleanups.push(safeAnimate(header, {
        opacity: [0, 1],
        y: [-18, 0],
        filter: ['blur(10px)', 'blur(0px)']
    }, { duration: 0.7, ease: EASE_OUT }));

    cleanups.push(safeAnimate(stage, {
        opacity: [0, 1],
        y: [34, 0],
        scale: [0.965, 1],
        rotateX: [7, 0],
        filter: ['blur(12px)', 'blur(0px)']
    }, { duration: 0.92, ease: EASE_OUT }));

    cleanups.push(safeAnimate(scenes, {
        opacity: [0, 1],
        y: [38, 0],
        rotateX: [8, 0]
    }, { delay: stagger(0.08, { startDelay: 0.12 }), duration: 0.82, ease: EASE_OUT }));

    cleanups.push(safeAnimate(sceneTitles, {
        opacity: [0, 1],
        y: [26, 0],
        filter: ['blur(8px)', 'blur(0px)']
    }, { delay: stagger(0.08, { startDelay: 0.32 }), duration: 0.74, ease: EASE_OUT }));

    cleanups.push(safeAnimate(dockButtons, {
        opacity: [0, 1],
        y: [18, 0],
        scale: [0.96, 1]
    }, { delay: stagger(0.045, { startDelay: 0.46 }), duration: 0.56, ease: EASE_OUT }));

    sceneImages.forEach(image => {
        cleanups.push(safeAnimate(image, {
            scale: [1.12, 1.075],
            filter: ['saturate(0.86) contrast(0.95)', 'saturate(1.06) contrast(1.02)']
        }, { duration: 1.2, ease: EASE_OUT }));
    });

    scenes.forEach(scene => {
        const image = scene.querySelector('img');
        const title = scene.querySelector('.taverna-scene-title');

        cleanups.push(hover(scene, element => {
            safeAnimate(element, {
                y: -5,
                scale: 1.012,
                rotateX: -1.25
            }, EASE_SPRING);
            safeAnimate(image, {
                scale: 1.1,
                filter: 'saturate(1.22) contrast(1.07) brightness(1.06)'
            }, { duration: 0.52, ease: EASE_OUT });
            safeAnimate(title, {
                y: -7,
                letterSpacing: '0.035em'
            }, EASE_SPRING);

            return () => {
                safeAnimate(element, { y: 0, scale: 1, rotateX: 0 }, EASE_SPRING);
                safeAnimate(image, {
                    scale: 1.075,
                    filter: 'saturate(1.06) contrast(1.02) brightness(1)'
                }, { duration: 0.48, ease: EASE_OUT });
                safeAnimate(title, { y: 0, letterSpacing: '0em' }, EASE_SPRING);
            };
        }));

        cleanups.push(press(scene, element => {
            safeAnimate(element, { scale: 0.985, y: -2 }, { duration: 0.12, ease: EASE_OUT });
            return () => safeAnimate(element, { scale: 1.012, y: -4 }, { duration: 0.2, ease: EASE_OUT });
        }));
    });

    dockButtons.forEach(button => {
        cleanups.push(hover(button, element => {
            safeAnimate(element, {
                y: -4,
                scale: 1.025,
                filter: 'brightness(1.18)'
            }, EASE_SPRING);
            return () => safeAnimate(element, {
                y: 0,
                scale: 1,
                filter: 'brightness(1)'
            }, EASE_SPRING);
        }));
    });

    };

    startHomeMotion();

    return () => {
        cancelled = true;
        stopAll(cleanups);
    };
}

export function enhanceSurfaceMotion(container, options = {}) {
    if (!container || prefersReducedMotion()) return () => {};

    const cleanups = [];
    const revealSelector = options.selector || [
        '.minigame-multiplayer-panel',
        '.session-tool-switcher',
        '.lobby-section',
        '.game-card',
        '.action-card',
        '.glass-box',
        '.dnd-card',
        '.dnd-panel',
        '.manual-library-card'
    ].join(',');

    const elements = [...container.querySelectorAll(revealSelector)]
        .filter(element => !element.dataset.motionEnhanced);

    elements.forEach((element, index) => {
        element.dataset.motionEnhanced = 'true';
        element.style.opacity = '0';
        element.style.transform = 'translate3d(0, 24px, 0) scale(0.975)';
        element.style.filter = 'blur(10px)';

        const stop = inView(element, target => {
            target.classList.add('motion-visible');
            safeAnimate(target, {
                opacity: [0, 1],
                y: [24, 0],
                scale: [0.975, 1],
                filter: ['blur(10px)', 'blur(0px)']
            }, {
                duration: 0.62,
                delay: Math.min((index % 8) * 0.045, 0.26),
                ease: EASE_OUT
            });
        }, { amount: 0.16, margin: '0px 0px -8% 0px' });

        cleanups.push(stop);
    });

    const interactive = [...container.querySelectorAll(options.interactiveSelector || [
        'button:not([data-motion-skip])',
        'a[href]:not([data-motion-skip])',
        '.game-card',
        '.action-card'
    ].join(','))].filter(element => !element.dataset.motionInteractive);

    interactive.forEach(element => {
        element.dataset.motionInteractive = 'true';
        cleanups.push(hover(element, target => {
            safeAnimate(target, {
                scale: 1.018,
                y: -2
            }, EASE_SPRING);
            return () => safeAnimate(target, {
                scale: 1,
                y: 0
            }, EASE_SPRING);
        }));

        cleanups.push(press(element, target => {
            safeAnimate(target, { scale: 0.968, y: 0 }, { duration: 0.11, ease: EASE_OUT });
            return () => safeAnimate(target, { scale: 1, y: -1 }, { duration: 0.16, ease: EASE_OUT });
        }));
    });

    return () => stopAll(cleanups);
}
