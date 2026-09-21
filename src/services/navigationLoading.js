const pending = new WeakMap();

// Keep the current page usable while imports/data arrive. Only the latest
// request may replace it, even when an older request finishes out of order.
export async function loadView(container, prepare, { label = 'la pagina', beforeRender = () => {} } = {}) {
    if (!container) return false;
    pending.get(container)?.cancel();
    document.dispatchEvent(new Event('taverna:navigation-start'));
    const controller = new AbortController();
    const previousRoot = container.firstElementChild;
    const previousBusy = container.getAttribute('aria-busy');
    let committed = false;
    let notice;
    let timer;
    const request = {
        cancel() {
            controller.abort();
            clearTimeout(timer);
            notice?.remove();
            if (pending.get(container) === request) {
                pending.delete(container);
                if (previousBusy === null) container.removeAttribute('aria-busy');
                else container.setAttribute('aria-busy', previousBusy);
            }
        }
    };
    pending.set(container, request);
    const isCurrent = () => !controller.signal.aborted && pending.get(container) === request
        && (committed || container.firstElementChild === previousRoot);
    const context = {
        signal: controller.signal,
        isCurrent,
        beforeRender() {
            if (!isCurrent()) return false;
            if (committed) return true;
            beforeRender();
            committed = true;
            clearTimeout(timer);
            notice?.remove();
            return true;
        }
    };
    container.setAttribute('aria-busy', 'true');
    timer = setTimeout(() => {
        if (!isCurrent() || committed) return;
        notice = document.createElement('div');
        notice.className = 'route-status';
        notice.setAttribute('role', 'status');
        const indicator = document.createElement('span');
        indicator.className = 'route-status-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        const message = document.createElement('span');
        message.textContent = `Apro ${label}…`;
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Annulla';
        cancel.onclick = () => request.cancel();
        notice.append(indicator, message, cancel);
        document.body.append(notice);
    }, 160);

    try {
        const cancelled = new Promise(resolve => {
            controller.signal.addEventListener('abort', () => resolve(false), { once: true });
        });
        const opening = (async () => {
            const render = await prepare();
            if (!isCurrent()) return false;
            await render(context);
            return isCurrent();
        })();
        return await Promise.race([opening, cancelled]);
    } catch (error) {
        if (!isCurrent()) return false;
        console.warn(`Apertura di ${label} non riuscita:`, error);
        clearTimeout(timer);
        notice?.remove();
        notice = document.createElement('div');
        notice.className = 'route-status is-error';
        notice.setAttribute('role', 'alert');
        const message = document.createElement('span');
        message.textContent = `Non riesco ad aprire ${label}. Riprova tra poco.`;
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Chiudi';
        notice.append(message, close);
        document.body.append(notice);
        // The next navigation also dismisses a previous error.
        const errorNotice = notice;
        notice = null;
        const dismiss = () => errorNotice.remove();
        document.addEventListener('taverna:navigation-start', dismiss, { once: true });
        close.onclick = () => {
            dismiss();
            document.removeEventListener('taverna:navigation-start', dismiss);
        };
        return false;
    } finally {
        request.cancel();
    }
}
