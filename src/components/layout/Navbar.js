import { initSidebar } from './Sidebar.js'; 

export function initNavbar(user, onLogout) {
    const navbarContainer = document.getElementById('navbar-container');
    const sidebarContainer = document.getElementById('sidebar-container');

    if (!navbarContainer) {
        console.error("ERRORE: Manca #navbar-container nell'HTML");
        return;
    }

    navbarContainer.innerHTML = `
        <div style="position: fixed; top: 20px; left: 20px; z-index: 9998;">
            <img src="/assets/logo.png" alt="Taverna" id="nav-home-btn" 
                 style="width: 45px; cursor: pointer; filter: drop-shadow(0 0 10px rgba(157, 78, 222, 0.3));">
        </div>

        <button id="navbar-trigger" class="floating-trigger" style="
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 70px;
            height: 70px;
            border-radius: 20px;
            background: #9d4ede; /* Ametista */
            border: none;
            cursor: pointer;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 6px;
            box-shadow: 0 10px 30px rgba(157, 78, 221, 0.5);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        ">
            <span id="bar1" style="width: 28px; height: 3px; background: white; border-radius: 4px; transition: 0.3s;"></span>
            <span id="bar2" style="width: 28px; height: 3px; background: white; border-radius: 4px; transition: 0.3s;"></span>
            <span id="bar3" style="width: 28px; height: 3px; background: white; border-radius: 4px; transition: 0.3s;"></span>
        </button>
    `;

    initSidebar(sidebarContainer, user, onLogout);

    const btn = document.getElementById('navbar-trigger');
    const b1 = document.getElementById('bar1');
    const b2 = document.getElementById('bar2');
    const b3 = document.getElementById('bar3');

    btn.onclick = (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggleSidebar'));
    };

    // Gestione trasformazione in X
    window.addEventListener('sidebarState', (e) => {
        const isOpen = e.detail.isOpen;
        if (isOpen) {
            btn.style.background = '#ff4444'; // Diventa rosso
            b1.style.transform = 'translateY(9px) rotate(45deg)';
            b2.style.opacity = '0';
            b3.style.transform = 'translateY(-9px) rotate(-45deg)';
        } else {
            btn.style.background = '#9d4ede'; // Torna ametista
            b1.style.transform = 'translateY(0) rotate(0)';
            b2.style.opacity = '1';
            b3.style.transform = 'translateY(0) rotate(0)';
        }
    });

    document.getElementById('nav-home-btn').onclick = () => window.location.reload();
}
