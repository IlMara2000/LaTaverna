import { initSidebar } from './sidebar.js';
import { account } from '../services/appwrite.js';

export async function showDashboard(container, user) {
    // Struttura a due colonne: Sidebar a sinistra, Contenuto a destra
    container.innerHTML = `
        <div class="dashboard-layout">
            <div id="sidebar-container"></div>
            
            <main class="dashboard-main">
                <header class="dashboard-header">
                    <h2 class="welcome-text">BENTORNATO,</h2>
                    <h1 class="user-name-title">${user.name.toUpperCase()}</h1>
                </header>
                
                <section class="session-container">
                    <div class="empty-state-card">
                        <span class="icon">📜</span>
                        <p>Nessuna cronaca attiva nel tomo...</p>
                        <button class="btn-primary" style="margin-top: 20px; width: auto; padding: 12px 30px;">INIZIA NUOVA AVVENTURA</button>
                    </div>
                </section>
            </main>
        </div>
    `;

    const handleLogout = async () => {
        try {
            await account.deleteSession('current');
            window.location.reload();
        } catch (err) {
            console.error("Errore logout:", err);
        }
    };

    // Inizializza la sidebar nel suo container dedicato
    const sidebarSlot = container.querySelector('#sidebar-container');
    initSidebar(sidebarSlot, user, handleLogout);
}
