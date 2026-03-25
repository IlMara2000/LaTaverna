/**
 * Genera un input stilizzato in linea con il design della Taverna
 * @param {Object} props - Proprietà dell'input
 * @returns {string} - Stringa HTML dell'input
 */
export function createAuthInput({ 
    id, 
    type = 'text', 
    placeholder, 
    required = true, 
    icon = '', 
    value = '',
    autocomplete = '' 
}) {
    return `
        <div class="input-group" style="position: relative; width: 100%; margin-bottom: 15px;">
            ${icon ? `<span style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); opacity: 0.5; font-size: 16px;">${icon}</span>` : ''}
            <input 
                type="${type}" 
                id="${id}" 
                placeholder="${placeholder}" 
                ${required ? 'required' : ''} 
                ${autocomplete ? `autocomplete="${autocomplete}"` : ''}
                value="${value}"
                class="auth-input" 
                style="width: 100%; padding: 15px 15px 15px ${icon ? '45px' : '15px'}; 
                       background: rgba(255, 255, 255, 0.03); 
                       border: 1px solid var(--glass-border); 
                       border-radius: 12px; 
                       color: white; 
                       font-size: 14px; 
                       outline: none; 
                       transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);"
            >
        </div>
    `;
}

/**
 * Aggiunge gli effetti di focus dinamici agli input generati
 * @param {HTMLElement} container - Il contenitore dove sono stati iniettati gli input
 */
export function initInputEffects(container) {
    const inputs = container.querySelectorAll('.auth-input');
    
    inputs.forEach(input => {
        // Effetto Glow al Focus
        input.onfocus = () => {
            input.style.borderColor = 'var(--amethyst-bright)';
            input.style.background = 'rgba(157, 78, 221, 0.08)';
            input.style.boxShadow = '0 0 15px rgba(157, 78, 221, 0.2)';
        };

        // Ritorno allo stato normale
        input.onblur = () => {
            input.style.borderColor = 'var(--glass-border)';
            input.style.background = 'rgba(255, 255, 255, 0.03)';
            input.style.boxShadow = 'none';
        };
    });
}