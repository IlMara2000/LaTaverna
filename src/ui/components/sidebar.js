// src/ui/components/sidebar.js

export function renderSidebar(container, user, t, onNavClick, currentLang, setLanguage) {
    container.innerHTML = `
        <aside class="pt-aside" id="sidebar">
            <div class="pt-card" style="display:flex; gap:12px; align-items:center; background:rgba(255,255,255,0.05);">
                <div style="width:45px; height:45px; background:var(--accent-purple); border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:800;">
                    ${user.username ? user.username[0] : 'V'}
                </div>
                <div>
                    <div style="font-weight:700; font-size:14px;">${user.username}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${user.email}</div>
                </div>
            </div>
            <nav style="margin-top:20px;">
                <button class="tab-btn active" data-target="dash">🏠 ${t('dash')}</button>
                <button class="tab-btn" data-target="notes">📝 ${t('notes')}</button>
                <button class="tab-btn" data-target="npc">👥 ${t('npc')}</button>
                <button class="tab-btn" data-target="settings">⚙️ ${t('settings')}</button>
            </nav>
            <div class="lang-selector">
                <button class="lang-btn ${currentLang==='it'?'active':''}" id="btn-it">IT</button>
                <button class="lang-btn ${currentLang==='en'?'active':''}" id="btn-en">EN</button>
            </div>
        </aside>
    `;

    // Gestione click navigazione
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            onNavClick(btn.dataset.target);
            // Rimuovi active da tutti e aggiungi a questo
            container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    // Gestione cambio lingua
    document.getElementById('btn-it').onclick = () => setLanguage('it');
    document.getElementById('btn-en').onclick = () => setLanguage('en');
}
