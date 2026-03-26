/**
 * NAVBAR (Il Pulsante Fluttuante in basso a destra)
 */
export function initNavbar(container) {
    // Il container sarà lo spazio per il bottone
    container.innerHTML = `
        <button id="navbar-trigger" class="floating-btn" style="
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: var(--amethyst-bright);
            border: none;
            cursor: pointer;
            z-index: 3000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 4px;
            box-shadow: 0 0 20px var(--amethyst-glow);
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        ">
            <span class="bar" style="width: 25px; height: 3px; background: white; border-radius: 2px;"></span>
            <span class="bar" style="width: 25px; height: 3px; background: white; border-radius: 2px;"></span>
            <span class="bar" style="width: 25px; height: 3px; background: white; border-radius: 2px;"></span>
        </button>
    `;

    const btn = document.getElementById('navbar-trigger');
    
    btn.onclick = () => {
        btn.style.transform = 'scale(0.9) rotate(90deg)';
        setTimeout(() => btn.style.transform = 'scale(1) rotate(0deg)', 200);
        
        // Comunica alla Sidebar di aprirsi
        window.dispatchEvent(new CustomEvent('toggleSidebar'));
    };
}