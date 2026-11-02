import { LEGAL, LEGAL_INCOMPLETE, LEGAL_PAGES } from '../../../data/legal.js';
import { navigateTo } from '../../../services/appNavigation.js';
import './legal.css';

// Avviso riservato allo sviluppo: i segnaposto del titolare non devono
// comparire ai visitatori. La build di produzione resta pulita.
const showSetupNotice = LEGAL_INCOMPLETE && import.meta.env?.DEV;

const links = [
    ['privacy', 'Privacy', '/privacy'],
    ['terms', 'Termini', '/termini'],
    ['cookies', 'Cookie e terzi', '/cookie'],
    ['community', 'Community', '/community'],
    ['seller', 'Condizioni Bottega', '/bottega/condizioni'],
    ['takedown', 'Segnala contenuto', '/segnala']
];

export function showLegal(container, page = 'privacy') {
    const selected = LEGAL_PAGES[page] || LEGAL_PAGES.privacy;
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';

    container.innerHTML = `
        <main class="legal-page entry-page">
            <header class="legal-topbar">
                <a class="legal-back" href="/">← Torna alla Taverna</a>
                <span>${LEGAL.serviceName}</span>
            </header>
            ${showSetupNotice ? `<p class="legal-warning" role="status"><strong>Configurazione da completare:</strong> i dati del titolare sono segnaposto. Sostituiscili in <code>src/data/legal.js</code> prima del lancio.</p>` : ''}
            <div class="legal-layout">
                <aside class="legal-sidebar" aria-label="Documenti legali">
                    ${links.map(([id, label, href]) => `<a href="${href}" class="${id === page ? 'is-active' : ''}"${id === page ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
                </aside>
                <article class="legal-article">
                    ${selected.html}
                    <footer class="legal-footer">
                        <p>Ultimo aggiornamento: ${LEGAL.updated}. Le presenti pagine sono informative operative e non sostituiscono una consulenza legale.</p>
                        <p><a href="mailto:${LEGAL.email}">${LEGAL.email}</a> · <a href="mailto:${LEGAL.abuse}">${LEGAL.abuse}</a></p>
                    </footer>
                </article>
            </div>
        </main>
    `;

    container.querySelectorAll('.legal-sidebar a').forEach(anchor => {
        anchor.addEventListener('click', event => {
            const destination = anchor.getAttribute('href').replace(/^\//, '');
            event.preventDefault();
            const map = { privacy: 'privacy', termini: 'terms', cookie: 'cookies', community: 'community', segnala: 'takedown', 'bottega/condizioni': 'seller' };
            const target = map[destination];
            if (target) void navigateTo(target, container);
        });
    });
    container.querySelector('.legal-topbar a')?.addEventListener('click', event => {
        event.preventDefault();
        void navigateTo('home', container);
    });
}
