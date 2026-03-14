// src/main.js
import { showLogin } from '@ui/login.js';
import { showDashboard } from '@ui/dashboard.js';
import { setupDiscordRedirect } from '@services/redirectDiscord.js';
import { account } from '@services/appwrite.js';

const uiContainer = document.getElementById('ui');
const mainTitle = document.getElementById('main-title');

/**
 * Funzione per pulire la schermata iniziale e mostrare l'interfaccia
 */
function displayApp() {
    if (mainTitle) mainTitle.classList.add('hidden');
    if (uiContainer) uiContainer.style.display = 'block';
}

async function initApp() {
    console.log("Inizializzazione La Taverna...");
    
    let user = null;
    try {
        // Controlliamo se esiste una sessione Appwrite attiva
        user = await account.get(); 
        console.log("Utente autenticato:", user.name);
    } catch (err) {
        console.log("Nessun utente loggato.");
    }

    if (user && user.$id) {
        // Se loggato, mostra la dashboard
        showDashboard(uiContainer, user);
    } else {
        // Altrimenti mostra il form di login
        showLogin(uiContainer);
    }

    // Gestisce eventuali redirect da Discord (OAuth2)
    setupDiscordRedirect(uiContainer);

    // Nascondiamo il titolo "Loading" e mostriamo l'UI
    displayApp();
}

// Avvio
initApp().catch(err => {
    console.error("Errore critico all'avvio:", err);
    // In caso di errore critico mostriamo comunque il login per sicurezza
    showLogin(uiContainer);
    displayApp();
});
