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
            <div style="display:flex; gap:12px; align-items:center;">
                <div class="vox-chat-wrapper">
                    <button class="icon-btn" id="btn-vox-chat">🎧</button>
                    <span class="vox-chat-tooltip">${t('voxChat')}</span>
                </div>
                
                <button id="logout-btn" class="icon-btn" style="border-color:rgba(255,0,0,0.2); color:#ff5555;">${t('exit')}</button>
            </div>
        </header>

        <main id="main-content">
            </main>
    `;

    document.getElementById('logout-btn').onclick = onLogout;
    document.getElementById('open-menu').onclick = () => document.getElementById('sidebar').classList.toggle('open');
}
