// src/services/redirectDiscord.js
import { CONFIG } from '@config/env.js';

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

export async function setupDiscordRedirect(container) {
  const code = getQueryParam('code');
  if (!code) return;

  const messageEl = container.querySelector('#message') || container;

  try {
    const functionUrl = `${CONFIG.APPWRITE_ENDPOINT}/functions/verifyDiscord/executions`;
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': CONFIG.APPWRITE_PROJECT
      },
      body: JSON.stringify({ code })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discord OAuth fallito: ${text}`);
    }

    const result = await response.json();
    messageEl.textContent = `Login Discord avvenuto! ID: ${result.discord_id}`;
    window.history.replaceState({}, document.title, window.location.pathname);

    if (typeof container.refreshDashboard === 'function') container.refreshDashboard(result);

  } catch (err) {
    console.error("Errore setupDiscordRedirect:", err);
    messageEl.textContent = `Errore login Discord: ${err.message}`;
  }
}
