/**
 * Genera un contenitore Glass-morphism riutilizzabile
 * @param {Object} props - Proprietà della card
 * @returns {string} - Stringa HTML della card
 */
export function createGlassCard({ 
    id = '', 
    content = '', 
    padding = '20px', 
    borderRadius = '24px',
    onClick = null,
    style = '' 
}) {
    const clickableStyle = onClick ? 'cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);' : '';
    const idAttr = id ? `id="${id}"` : '';

    return `
        <div ${idAttr} class="glass-box" style="
            background: linear-gradient(135deg, rgba(26, 8, 51, 0.4), rgba(5, 2, 10, 0.8));
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            border: 1px solid var(--glass-border);
            border-radius: ${borderRadius};
            padding: ${padding};
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            position: relative;
            overflow: hidden;
            ${clickableStyle}
            ${style}
        ">
            <div style="
                position: absolute; 
                top: 0; left: 0; right: 0; 
                height: 100%; 
                background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 100%);
                pointer-events: none;
            "></div>
            
            <div style="position: relative; z-index: 1;">
                ${content}
            </div>
        </div>
    `;
}

/**
 * Inizializza gli effetti hover per le card cliccabili
 * @param {HTMLElement} container - Il contenitore delle card
 */
export function initCardEffects(container) {
    const cards = container.querySelectorAll('.glass-box');
    
    cards.forEach(card => {
        if (card.style.cursor === 'pointer') {
            card.onmouseenter = () => {
                card.style.transform = 'translateY(-5px)';
                card.style.borderColor = 'var(--amethyst-bright)';
                card.style.boxShadow = '0 12px 40px rgba(157, 78, 221, 0.2)';
            };

            card.onmouseleave = () => {
                card.style.transform = 'translateY(0)';
                card.style.borderColor = 'var(--glass-border)';
                card.style.boxShadow = '0 8px 32px 0 rgba(0, 0, 0, 0.37)';
            };

            card.onmousedown = () => {
                card.style.transform = 'scale(0.98)';
            };

            card.onmouseup = () => {
                card.style.transform = 'translateY(-5px) scale(1)';
            };
        }
    });
}