export function initNavbar(container) {
    container.innerHTML = `
        <button id="navbar-trigger" style="
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 65px;
            height: 65px;
            border-radius: 50%;
            background: var(--amethyst-bright);
            border: none;
            cursor: pointer;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 5px;
            box-shadow: 0 4px 25px var(--amethyst-glow);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        ">
            <span id="bar1" style="width: 25px; height: 3px; background: white; border-radius: 2px; transition: 0.3s;"></span>
            <span id="bar2" style="width: 25px; height: 3px; background: white; border-radius: 2px; transition: 0.3s;"></span>
            <span id="bar3" style="width: 25px; height: 3px; background: white; border-radius: 2px; transition: 0.3s;"></span>
        </button>
    `;

    const btn = document.getElementById('navbar-trigger');
    const b1 = document.getElementById('bar1');
    const b2 = document.getElementById('bar2');
    const b3 = document.getElementById('bar3');

    // Gestione click: apre/chiude la sidebar
    btn.onclick = (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggleSidebar'));
    };

    // LOGICA TRASFORMAZIONE IN X
    window.addEventListener('sidebarState', (e) => {
        const isOpen = e.detail.isOpen;
        
        if (isOpen) {
            btn.style.background = '#ff4444'; // Diventa rosso quando è aperto
            b1.style.transform = 'translateY(8px) rotate(45deg)';
            b2.style.opacity = '0';
            b3.style.transform = 'translateY(-8px) rotate(-45deg)';
        } else {
            btn.style.background = 'var(--amethyst-bright)';
            b1.style.transform = 'translateY(0) rotate(0)';
            b2.style.opacity = '1';
            b3.style.transform = 'translateY(0) rotate(0)';
        }
    });
}