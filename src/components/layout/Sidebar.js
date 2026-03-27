export function initSidebar(container, user, onLogout) {
    const userName = user?.user_metadata?.full_name || "Viandante";
    
    container.innerHTML = `
        <nav id="sidebar-menu" style="
            position: fixed; 
            right: -100%; 
            top: 0; 
            width: 100%; 
            height: 100%; 
            background: rgba(5, 2, 10, 0.98); 
            backdrop-filter: blur(20px); 
            z-index: 9000; 
            transition: 0.5s cubic-bezier(0.4, 0, 0.2, 1); 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center;
        ">
            <div style="text-align: center; margin-bottom: 50px;">
                <h2 style="color: var(--amethyst-bright); font-weight: 900; letter-spacing: 2px;">
                    ${userName.toUpperCase()}
                </h2>
                <div style="width: 50px; height: 2px; background: var(--amethyst); margin: 15px auto;"></div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 20px; width: 80%; max-width: 300px;">
                <button class="btn-primary" id="sideCronache">CRONACHE</button>
                <button class="btn-primary" id="sideLogout" style="background: rgba(255, 68, 68, 0.1); border: 1px solid #ff4444; color: #ff4444; box-shadow: none;">
                    ESCI DALLA TAVERNA
                </button>
            </div>
        </nav>
    `;

    const sidebar = document.getElementById('sidebar-menu');

    const toggle = () => {
        const currentlyOpen = sidebar.style.right === '0px';
        const newState = !currentlyOpen;
        
        sidebar.style.right = newState ? '0px' : '-100%';

        // Notifica alla Navbar di cambiare l'icona
        window.dispatchEvent(new CustomEvent('sidebarState', { 
            detail: { isOpen: newState } 
        }));
    };

    window.addEventListener('toggleSidebar', toggle);
    
    // Logica Logout
    document.getElementById('sideLogout').onclick = () => {
        if(confirm("Vuoi davvero lasciare la sessione?")) onLogout();
    };

    // Chiudi la sidebar se clicchi su Cronache
    document.getElementById('sideCronache').onclick = () => {
        toggle();
        // Eventuale logica per tornare alla lista sessioni
    };
}