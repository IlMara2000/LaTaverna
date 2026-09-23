const escapeAttribute = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

// Shared markup keeps the target, label and touch area consistent on every page.
export const renderHomeBackButton = ({ id = '', className = '', dataHome = false } = {}) => `
    <button type="button" ${id ? `id="${escapeAttribute(id)}"` : ''}
        class="app-back-button ${escapeAttribute(className)}" ${dataHome ? 'data-home' : ''}
        aria-label="Torna alla Taverna">
        <span class="app-back-arrow" aria-hidden="true">←</span>
        <span class="app-back-label">Torna alla Taverna</span>
    </button>
`;
