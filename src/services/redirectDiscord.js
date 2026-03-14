// src/services/redirectDiscord.js
import { client } from './appwrite.js';

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

export async function setupDiscordRedirect(container) {
  const code = getQueryParam('code');
  if (!code) return;

  // Cerchiamo un elemento per i messaggi, altrimenti usiamo il container stesso
  const messageEl = container.querySelector('#message') || container;

  try {
    // Recuperiamo i dati dalle variabili d'ambiente di Vite o usiamo valori di fallback
    const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
    const project = import.meta.env.VITE_APPWRITE_PROJECT;
    const functionUrl = `${endpoint}/functions/verifyDiscord/executions`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': project
      },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discord OAuth fallito: ${text}`);
    }

    const result = await response.json();
    
    if (messageEl) {
        messageEl.textContent = `Login Discord avvenuto! ID: ${result.discord_id}`;
    }

    // Pulisce l'URL dal codice Discord dopo l'uso
    window.history.replaceState({}, document.title, window.location.pathname);

    // Se esiste una funzione di refresh nella dashboard, la chiamiamo
    if (typeof container.refreshDashboard === 'function') {
        container.refreshDashboard(result);
    }

  } catch (err) {
    console.error("Errore setupDiscordRedirect:", err);
    if (messageEl) {
        messageEl.textContent = `Errore login Discord: ${err.message}`;
    }
  }
}
