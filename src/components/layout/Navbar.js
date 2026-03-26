export function initNavbar(container, user) {
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Viandante";

    container.innerHTML = `
        <header class="main-navbar" style="position: fixed; top: 0; left: 0; width: 100%; height: 60px; background: rgba(5, 2, 10, 0.8); backdrop-filter: blur(10px); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; z-index: 1000; border-bottom: 1px solid var(--glass-border);">
            <div style="display: flex; align-items: center; gap: 15px;">
                <button id="open-sidebar-trigger" style="background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 4px; padding: 10px;">
                    <span style="width: 20px; height: 2px; background: white;"></span>
                    <span style="width: 20px; height: 2px; background: white;"></span>
                    <span style="width: 20px; height: 2px; background: white;"></span>
                </button>
                <span style="font-weight: 900; letter-spacing: 2px; font-size: 14px; color: var(--amethyst-bright);">LA TAVERNA</span>
            </div>
            <div style="font-size: 10px; opacity: 0.6; text-transform: uppercase; letter-spacing: 1px;">${userName}</div>
        </header>
    `;

    // Quando clicco il tasto nella Navbar, invio un evento personalizzato
    document.getElementById('open-sidebar-trigger').onclick = () => {
        const event = new CustomEvent('toggleSidebar');
        window.dispatchEvent(event);
    };
}