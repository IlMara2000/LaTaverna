// src/ui/components/layout.js

export function renderLayout(container, user, t, onLogout) {
    container.innerHTML = `
        <header class="pt-header">
            <button class="icon-btn" id="open-menu">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
            <div style="display:flex; gap:12px;">
                <button class="icon-btn">🔔</button>
                <button id="logout-btn" class="btn-primary" style="width:auto; padding:10px 20px; font-size:14px;">${t('exit')}</button>
            </div>
        </header>

        <main id="main-content">
            </main>
    `;

    document.getElementById('logout-btn').onclick = onLogout;
}
