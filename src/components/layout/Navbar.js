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
            z-index: 9999; /* Sopra tutto */
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 4px;
            box-shadow: 0 4px 20px rgba(157, 78, 221, 0.6);
        ">
            <span style="width: 25px; height: 3px; background: white; border-radius: 2px;"></span>
            <span style="width: 25px; height: 3px; background: white; border-radius: 2px;"></span>
            <span style="width: 25px; height: 3px; background: white; border-radius: 2px;"></span>
        </button>
    `;

    document.getElementById('navbar-trigger').onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('toggleSidebar'));
    };
}