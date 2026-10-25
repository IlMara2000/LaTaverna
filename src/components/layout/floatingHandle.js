// Keep at least half of the control reachable, even after viewport changes.
export function constrainHandle(left, top, width, height, view) {
    const gripX = Math.min(28, width / 2);
    const gripY = Math.min(28, height / 2);
    const x = Math.max(view.left - width + gripX, Math.min(left, view.left + view.width - gripX));
    const y = Math.max(view.top - height + gripY, Math.min(top, view.top + view.height - gripY));
    const clipped = {
        left: Math.max(0, view.left - x), right: Math.max(0, x + width - view.left - view.width),
        top: Math.max(0, view.top - y), bottom: Math.max(0, y + height - view.top - view.height)
    };
    return { left: x, top: y, clipped };
}

export function usableHandleViewport(view, insets = {}) {
    const top = Math.max(0, insets.top || 0), bottom = Math.max(0, insets.bottom || 0);
    const left = Math.max(0, insets.left || 0), right = Math.max(0, insets.right || 0);
    return { left: view.left + left, top: view.top + top, width: Math.max(0, view.width - left - right), height: Math.max(0, view.height - top - bottom) };
}

export function initFloatingHandle(btn) {
    const positionKey = 'taverna.navbar-trigger.position.v1';
    const controller = new AbortController();
    const { signal } = controller;
    let drag = null;
    let suppressPointerClick = false;
    let positioned = false;
    const viewport = () => {
        const vv = window.visualViewport;
        const view = { left: vv?.offsetLeft || 0, top: vv?.offsetTop || 0, width: vv?.width || innerWidth, height: vv?.height || innerHeight };
        if (!document.documentElement.classList.contains('standalone-app')) return view;
        // Resolve env() as lengths, not the unevaluated custom-property string.
        const probe = document.createElement('div');
        probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
        document.body.append(probe);
        const css = getComputedStyle(probe);
        const insets = { top: parseFloat(css.paddingTop), right: parseFloat(css.paddingRight), bottom: parseFloat(css.paddingBottom), left: parseFloat(css.paddingLeft) };
        probe.remove();
        return usableHandleViewport(view, insets);
    };
    btn.classList.add('is-mobile-draggable');
    btn.title = 'Apri menu · trascina per spostare';
    const grip = document.createElement('span');
    grip.className = 'nav-edge-grip';
    grip.setAttribute('aria-hidden', 'true');
    btn.append(grip);
    const place = (left, top, persist = false) => {
        const { width, height } = btn.getBoundingClientRect();
        const view = viewport();
        if (document.documentElement.classList.contains('standalone-app')) {
            left = Math.max(view.left, Math.min(left, view.left + view.width - width));
            top = Math.max(view.top, Math.min(top, view.top + view.height - height));
        }
        const position = constrainHandle(left, top, width, height, view);
        btn.style.setProperty('left', `${position.left}px`, 'important');
        btn.style.setProperty('top', `${position.top}px`, 'important');
        btn.style.setProperty('right', 'auto', 'important');
        btn.style.setProperty('bottom', 'auto', 'important');
        positioned = true;
        const edges = Object.keys(position.clipped).filter(edge => position.clipped[edge] > 1);
        btn.classList.toggle('is-edge-handle', edges.length > 0);
        btn.dataset.edges = edges.join(' ');
        // Center the grip in the visible portion, including at corners.
        for (const [edge, value] of Object.entries(position.clipped)) {
            btn.style.setProperty(`--handle-clip-${edge}`, `${value}px`);
        }
        if (persist) {
            try { localStorage.setItem(positionKey, JSON.stringify({ left: position.left, top: position.top })); } catch { /* private storage */ }
        }
    };
    try {
        const saved = JSON.parse(localStorage.getItem(positionKey) || 'null');
        if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) place(saved.left, saved.top);
    } catch { /* stylesheet default */ }
    const refit = () => {
        if (!btn.isConnected) { controller.abort(); return; }
        if (!positioned || drag) return;
        const rect = btn.getBoundingClientRect();
        place(rect.left, rect.top);
    };
    window.addEventListener('resize', refit, { signal });
    window.visualViewport?.addEventListener('resize', refit, { signal });
    window.visualViewport?.addEventListener('scroll', refit, { signal });
    btn.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0 || drag) return;
        const rect = btn.getBoundingClientRect();
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top, moved: false };
        suppressPointerClick = false;
        btn.setPointerCapture(event.pointerId);
    }, { signal });
    btn.addEventListener('pointermove', event => {
        if (!drag || drag.id !== event.pointerId) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 7) return;
        drag.moved = true;
        event.preventDefault();
        btn.classList.add('is-dragging');
        place(drag.left + dx, drag.top + dy);
    }, { signal });
    const finish = event => {
        if (!drag || drag.id !== event.pointerId) return;
        if (drag.moved) {
            const rect = btn.getBoundingClientRect();
            place(rect.left, rect.top, true);
            suppressPointerClick = true;
        }
        drag = null;
        btn.classList.remove('is-dragging');
        if (btn.hasPointerCapture(event.pointerId)) btn.releasePointerCapture(event.pointerId);
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(type, finish, { signal });
    return { suppressClick: event => event.detail !== 0 && suppressPointerClick, destroy: () => controller.abort() };
}
