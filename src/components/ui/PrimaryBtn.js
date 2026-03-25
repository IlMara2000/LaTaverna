/**
 * Crea un bottone primario in stile Taverna (Ametista Glow)
 * @param {Object} props - Proprietà del bottone
 * @returns {string} - Stringa HTML del bottone
 */
export function createPrimaryBtn({ 
    id, 
    text, 
    icon = '', 
    fullWidth = true, 
    style = '',
    disabled = false 
}) {
    const widthStyle = fullWidth ? 'width: 100%;' : 'padding: 12px 30px;';
    const disabledAttr = disabled ? 'disabled' : '';
    const opacityStyle = disabled ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor: pointer;';

    return `
        <button id="${id}" ${disabledAttr} class="btn-primary" style="
            position: relative;
            background: linear-gradient(135deg, var(--amethyst-bright), var(--amethyst));
            border: none;
            color: white;
            border-radius: 16px;
            font-weight: 800;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 2px;
            box-shadow: 0 8px 25px var(--amethyst-glow);
            transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            height: 55px;
            overflow: hidden;
            ${widthStyle}
            ${opacityStyle}
            ${style}
        ">
            <div class="btn-glint" style="
                position: absolute;
                top: 0; left: -100%;
                width: 50%; height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                transform: skewX(-25deg);
                transition: 0.5s;
            "></div>

            <span class="btn-icon">${icon}</span>
            <span class="btn-text">${text}</span>
        </button>
    `;
}

/**
 * Inizializza le animazioni e i feedback per i bottoni
 * @param {HTMLElement} container - Il contenitore dei bottoni
 */
export function initBtnEffects(container) {
    const btns = container.querySelectorAll('.btn-primary');
    
    btns.forEach(btn => {
        if (btn.disabled) return;

        // Effetto Hover & Glint
        btn.onmouseenter = () => {
            btn.style.transform = 'translateY(-3px) scale(1.02)';
            btn.style.boxShadow = '0 12px 35px var(--amethyst-glow)';
            const glint = btn.querySelector('.btn-glint');
            if (glint) glint.style.left = '150%';
        };

        btn.onmouseleave = () => {
            btn.style.transform = 'translateY(0) scale(1)';
            btn.style.boxShadow = '0 8px 25px var(--amethyst-glow)';
            const glint = btn.querySelector('.btn-glint');
            if (glint) glint.style.left = '-100%';
        };

        // Feedback Tattile (Click)
        btn.onmousedown = () => {
            btn.style.transform = 'translateY(1px) scale(0.97)';
        };

        btn.onmouseup = () => {
            btn.style.transform = 'translateY(-3px) scale(1.02)';
        };
    });
}

/**
 * Cambia lo stato del bottone in "Caricamento"
 */
export function setBtnLoading(btnElement, isLoading, originalText = "ENTRA") {
    const textSpan = btnElement.querySelector('.btn-text');
    const iconSpan = btnElement.querySelector('.btn-icon');

    if (isLoading) {
        btnElement.disabled = true;
        btnElement.style.opacity = "0.7";
        if (textSpan) textSpan.textContent = "INCANTANDO...";
        if (iconSpan) iconSpan.innerHTML = "🔮";
        btnElement.style.filter = "grayscale(0.5)";
    } else {
        btnElement.disabled = false;
        btnElement.style.opacity = "1";
        if (textSpan) textSpan.textContent = originalText;
        if (iconSpan) iconSpan.innerHTML = ""; // O l'icona originale
        btnElement.style.filter = "none";
    }
}