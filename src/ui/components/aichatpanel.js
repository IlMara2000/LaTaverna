// src/ui/components/aichatpanel.js

export function renderAIChat(container, t) {
    container.innerHTML = `
        <div class="pt-card ai-panel">
            <div class="ai-header">
                <span class="ai-badge">✨ T.AIverna</span>
                <h3>${t('aiTitle')}</h3>
            </div>
            <div id="ai-response-area" class="ai-body">
                <p class="ai-placeholder">${t('aiPlaceholder')}</p>
            </div>
            <div class="ai-input-group">
                <input type="text" id="ai-input" placeholder="${t('aiInput')}...">
                <button id="send-ai" class="icon-btn">➔</button>
            </div>
        </div>
    `;
    // ... resto della logica invio ...
}
