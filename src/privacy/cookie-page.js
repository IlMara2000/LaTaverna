import { getConsent, openPreferences, revokeConsent } from './consent.js';

const ROWS = [
  {
    name: 'taverna-consent',
    category: 'Necessari',
    purpose: 'Memorizza la tua scelta sui cookie.',
    duration: 'Fino a revoca',
  },
  {
    name: 'Sessione del tavolo',
    category: 'Necessari',
    purpose: 'Tiene insieme la partita e il tuo posto al tavolo.',
    duration: 'Sessione',
  },
  {
    name: 'Preferenze di gioco',
    category: 'Necessari',
    purpose: 'Ricorda impostazioni scelte da te (per esempio il mazzo).',
    duration: 'Fino a cancellazione',
  },
  {
    name: 'Misurazione',
    category: 'Analytics',
    purpose: 'Conteggi anonimi di visite e partite. Parte solo con il tuo permesso.',
    duration: 'Secondo lo strumento, max 14 mesi',
  },
  {
    name: 'Marketing',
    category: 'Marketing',
    purpose: 'Non attivo oggi. Se attivato, solo con il tuo permesso.',
    duration: '—',
  },
];

const ACTIONS = { prefs: openPreferences, revoke: revokeConsent };
const boundRoots = new WeakSet();

export function mountCookiePage(root) {
  if (!root) return;

  const render = () => {
    const consent = getConsent();
    /* `getConsent()` restituisce solo consensi con `ts` valido: qui c'è sempre una data. */
    const choice = consent
      ? `Salvata il ${new Date(consent.ts).toLocaleString('it-IT')} — misurazione: ${consent.analytics ? 'attiva' : 'spenta'}, marketing: ${consent.marketing ? 'attivo' : 'spento'}.`
      : 'Nessuna scelta salvata: al momento è tutto spento tranne ciò che serve al funzionamento.';
    const rows = ROWS.map((row) => `
    <tr>
      <td>${row.name}</td>
      <td>${row.category}</td>
      <td>${row.purpose}</td>
      <td>${row.duration}</td>
    </tr>`).join('');

    root.innerHTML = `
    <h1>Cookie</h1>
    <p>
      Il tavolo usa il minimo indispensabile per funzionare. Tutto il resto resta spento
      finché non lo accendi tu, e puoi cambiare idea in qualsiasi momento.
    </p>
    <table class="cookie-table">
      <thead>
        <tr><th>Nome</th><th>Categoria</th><th>Scopo</th><th>Durata</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>La tua scelta</h2>
    <p>${choice}</p>
    <div class="cookie-actions">
      <button type="button" class="tv-btn tv-btn--ghost" data-cookie="prefs">Preferenze cookie</button>
      <button type="button" class="tv-btn tv-btn--ghost" data-cookie="revoke">Revoca il consenso</button>
    </div>`;
  };

  if (!boundRoots.has(root)) {
    boundRoots.add(root);
    root.addEventListener('click', (event) => {
      const action = event.target?.closest?.('[data-cookie]');
      if (action) ACTIONS[action.dataset.cookie]?.();
    });
    window.addEventListener('taverna:consent-changed', render);
  }

  render();
}
