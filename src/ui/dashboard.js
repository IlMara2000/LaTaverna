import { initSidebar } from './sidebar.js';
import { account } from '../services/appwrite.js';

export async function showDashboard(container, user) {
    container.innerHTML = `
        <div class="dashboard-content" style="width:100%; padding: 40px 20px;">
            <header style="text-align:left; margin-top: 20px;">
                <h1 style="font-size: 1.5rem; opacity:0.8;">BENTORNATO,</h1>
                <p class="auth-title" style="font-size: 2rem; line-height:1; text-align:left;">${user.name.toUpperCase()}</p>
            </header>
            
            <div id="session-list" style="margin-top:30px;">
                <div class="auth-card" style="width:100%; opacity:0.8;">
                    <p style="font-size:14px; text-align:center;">Nessuna cronaca attiva nel tomo...</p>
                </div>
            </div>
        </div>
    `;

    const handleLogout = async () => {
        await account.deleteSession('current');
        window.location.reload();
    };

    initSidebar(container, user, handleLogout);
}
