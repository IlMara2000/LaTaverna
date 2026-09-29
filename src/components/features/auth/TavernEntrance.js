import { prefersReducedMotion } from '../../../services/motionSystem.js';

// The door is a real DOM layer: logo, plaque and handle move with the hinges.
export function renderTavernEntrance(container, onEnter) {
    container.scrollTop = 0;
    container.innerHTML = `
        <section class="tavern-entrance" id="entry-screen" aria-label="La porta della Taverna">
            <div class="tavern-entrance-stage">
                <div class="tavern-doorway">
                    <img class="tavern-door-interior" src="/assets/entrance/interior.webp" alt="" aria-hidden="true" decoding="async">
                    <div class="tavern-door-leaf">
                        <div class="tavern-door-window">
                            <img src="/assets/logo.png" alt="La Taverna" class="tavern-glass-logo" width="512" height="512" fetchpriority="high">
                        </div>
                        <span class="tavern-door-hinge hinge-top" aria-hidden="true"></span>
                        <span class="tavern-door-hinge hinge-bottom" aria-hidden="true"></span>
                        <p class="tavern-door-plaque">Ogni grande storia<br>comincia insieme.</p>
                        <button class="tavern-door-handle" type="button" aria-label="Entra nella Taverna" aria-describedby="door-invitation">
                            <span class="tavern-handle-plate" aria-hidden="true"><span class="tavern-handle-lever"></span><span class="tavern-keyhole"></span></span>
                        </button>
                        <span class="tavern-door-invitation" id="door-invitation">Entra nella Taverna
                            <svg viewBox="0 0 110 55" aria-hidden="true"><path d="M5 8 Q53 2 88 38 M69 35 Q82 38 96 44 L94 24"/></svg>
                        </span>
                    </div>
                </div>
            </div>
            <p class="tavern-door-status" role="status" aria-live="polite"></p>
        </section>`;
    const scene = container.querySelector('.tavern-entrance');
    const door = scene.querySelector('.tavern-door-leaf');
    const handle = scene.querySelector('.tavern-door-handle');
    const animate = async (element, frames, options) => {
        if (!element.animate) return;
        try { await element.animate(frames, { ...options, fill: 'forwards' }).finished; }
        catch { /* Preference changes or cancellation must never trap the user. */ }
    };
    handle.addEventListener('click', async () => {
        if (handle.disabled) return;
        handle.disabled = true;
        scene.setAttribute('aria-busy', 'true');
        scene.querySelector('.tavern-door-status').textContent = 'La porta si apre…';
        scene.classList.add('is-opening');
        if (!prefersReducedMotion()) {
            await animate(door, [
                { transform: 'rotateY(0deg)' },
                { transform: 'rotateY(-102deg)' }
            ], { duration: 900, easing: 'cubic-bezier(.35,0,.2,1)' });
            if (!scene.isConnected) return;
            // A brief forward rush, not a continuous animated blur.
            if (!prefersReducedMotion()) await animate(scene, [
                { transform: 'scale(1)', filter: 'blur(0)', opacity: 1 },
                { transform: 'scale(1.32)', filter: 'blur(10px)', opacity: 0 }
            ], { duration: 360, easing: 'cubic-bezier(.55,0,1,.7)' });
        }
        if (!scene.isConnected) return;
        onEnter();
        container.querySelector('.auth-panel')?.focus({ preventScroll: true });
    });
}
