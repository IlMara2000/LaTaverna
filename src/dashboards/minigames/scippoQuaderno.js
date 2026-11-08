/**
 * IL QUADERNO DEGLI SBAGLI e il tavolo 0.
 *
 * Solo markup: lo stato arriva da `scippoSecret.js`, i gesti tornano su
 * `data-action` e li gestisce `scippo.js`. Nessun timer, nessun audio qui.
 */

import './scippoQuaderno.css';
import {
    CANTINA_COPY,
    FRAGMENTS,
    SALE_CARD,
    SECRET_LINE,
    quadernoProgress,
    transcriptionFor
} from '../../services/scippoSecret.js';

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const ashMarkup = () => '<span class="scq-ash" aria-hidden="true"></span>';

/**
 * Il retro bruciato. Volutamente senza <defs id="...">: il componente compare
 * più volte nella pagina e gli id duplicati sono un bug servito.
 */
const burntBack = () => `
    <svg class="scq-card-art" viewBox="0 0 160 224" aria-hidden="true" focusable="false">
        <rect x="2" y="2" width="156" height="220" rx="13" fill="#120d0c" stroke="#4a3324" stroke-width="3"/>
        <path d="M2 34 L18 26 L27 44 L42 30 L52 46 L62 28 L74 40 L86 22 L98 38 L110 24 L122 40 L134 26 L148 42 L158 30"
              fill="none" stroke="#7a4a26" stroke-width="3" stroke-linejoin="round" opacity="0.75"/>
        <path d="M158 96 L144 104 L152 118 L138 128 L146 142 L132 150 L140 166 L126 174 L134 190 L120 198 L128 214 L116 220 L158 220 Z"
              fill="#070506"/>
        <path d="M158 96 L144 104 L152 118 L138 128 L146 142 L132 150 L140 166 L126 174 L134 190 L120 198 L128 214 L116 220"
              fill="none" stroke="#c2601f" stroke-width="2.5" opacity="0.9"/>
        <g fill="#3d2a1d">
            <circle cx="34" cy="74" r="4"/><circle cx="52" cy="74" r="4"/><circle cx="70" cy="74" r="4"/><circle cx="88" cy="74" r="4"/>
            <circle cx="34" cy="92" r="4"/><circle cx="52" cy="92" r="4"/><circle cx="70" cy="92" r="4"/>
        </g>
        <circle cx="88" cy="92" r="4.6" fill="#c2601f"/>
        <text x="80" y="158" text-anchor="middle" font-family="Bangers, Impact, sans-serif" font-size="38" fill="#2c1e15" letter-spacing="2">SC!</text>
        <text x="80" y="186" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-size="9" fill="#4a3324" letter-spacing="3">OTTAVA RIGA</text>
    </svg>
`;

const cardFront = (quaderno, { plain = false } = {}) => `
    <div class="scq-sale-card${plain ? ' is-plain' : ''}" data-face="${plain ? 'plain' : 'front'}">
        <div class="scq-sale-top">
            <span class="scq-sale-icon" aria-hidden="true">${SALE_CARD.icon}</span>
            <strong class="scq-sale-name">${SALE_CARD.label}</strong>
        </div>
        <p class="scq-sale-rule" aria-hidden="true">${escapeHTML(SALE_CARD.rule)}</p>
        <p class="scq-line scq-line--front" aria-hidden="true">${escapeHTML(SECRET_LINE)}</p>
        <p class="scq-sale-slot">OTTAVA RIGA · ${SECRET_LINE.length} CARATTERI</p>
    </div>
`;

const cardBackReadable = (quaderno, { plain = false } = {}) => {
    const written = quaderno.cantina === 'transcribed';
    const text = written ? transcriptionFor(quaderno.transcriptions).text : SECRET_LINE;
    return `
        <div class="scq-sale-card scq-sale-card--back${plain ? ' is-plain' : ''}" data-face="${plain ? 'plain' : 'back'}">
            <p class="scq-line scq-line--back">${escapeHTML(text)}</p>
            ${written ? `<p class="scq-sale-slot scq-sale-slot--wrong">${CANTINA_COPY.written}</p>` : ''}
        </div>
    `;
};

/** La riga del Quaderno: trovata, oppure cenere. */
const rowMarkup = fragment => {
    if (!fragment.found) {
        return `
            <li class="scq-row is-lost" aria-label="${escapeHTML(fragment.label)}: riga non ancora trovata">
                <span class="scq-row-label">${escapeHTML(fragment.label)}</span>
                ${ashMarkup()}
            </li>
        `;
    }
    return `
        <li class="scq-row is-found">
            <span class="scq-row-label">${escapeHTML(fragment.label)}</span>
            <p class="scq-row-text">${escapeHTML(fragment.text)}</p>
        </li>
    `;
};

/** La voce discreta in home: il Quaderno non chiede attenzione, la concede. */
export function renderQuadernoEntry(quaderno) {
    const progress = quadernoProgress(quaderno);
    return `
        <button type="button" class="scq-entry" data-action="quaderno">
            <span class="scq-entry-mark" aria-hidden="true">✎</span>
            <span class="scq-entry-copy">
                <strong>IL QUADERNO DEGLI SBAGLI</strong>
                <small>${progress.found}/8 righe · ${progress.complete ? 'la pagina non ha un retro' : 'una riga resta coperta'}</small>
            </span>
            <b aria-hidden="true">↗</b>
        </button>
    `;
}

export function renderQuaderno({ quaderno, plain = false, canPersist = true }) {
    const progress = quadernoProgress(quaderno);
    const readable = quaderno.cantina !== 'locked';
    const doorway = !progress.complete
        ? `<p class="scq-door-note">${CANTINA_COPY.refusal}</p>`
        : quaderno.cantina === 'locked'
            ? `<p class="scq-door-note is-ready">${CANTINA_COPY.door}</p>
               <button type="button" class="scq-door-button" data-action="cantina-sit">${CANTINA_COPY.sit}</button>`
            : `<button type="button" class="scq-door-button" data-action="cantina-sit">TORNA AL TAVOLO 0</button>
               ${quaderno.cantina === 'transcribed' ? `<p class="scq-door-note">${CANTINA_COPY.writtenNote}</p>` : ''}
               ${quaderno.cantina === 'kept' ? `<p class="scq-door-note is-ready">${CANTINA_COPY.kept}</p>` : ''}`;

    const eighth = readable
        ? cardBackReadable(quaderno, { plain })
        : `<button type="button" class="scq-covered" data-action="quaderno-card" aria-label="Ottava riga: carta coperta, illeggibile">
                ${burntBack()}
           </button>`;

    return `
        <div class="sc-quaderno" data-screen="quaderno">
            <header class="scq-head">
                <button type="button" class="scq-back" data-action="quaderno-close">
                    <span aria-hidden="true">←</span> INDIETRO
                </button>
                <div class="scq-head-copy">
                    <span class="scq-kicker">S.C.I.P.P.O. · v0.9.7-beta-cotto</span>
                    <h2>IL QUADERNO DEGLI SBAGLI</h2>
                    <p class="scq-count">${progress.found}/${progress.total} · 1 riga ${progress.complete ? 'illeggibile' : 'coperta'}</p>
                </div>
                <button type="button" class="scq-plain" data-action="quaderno-plain" aria-pressed="${plain}">
                    ${plain ? 'NASCONDI' : 'LEGGI IN CHIARO'}
                </button>
            </header>

            ${canPersist ? '' : `<p class="scq-warning" role="status">${CANTINA_COPY.noStorage}</p>`}

            <ol class="scq-rows">
                ${FRAGMENTS.slice(0, 7).map(fragment => rowMarkup({ ...fragment, found: quaderno.eggs.includes(fragment.id) })).join('')}
                <li class="scq-row scq-row--card ${readable ? 'is-found' : 'is-lost'}">
                    <span class="scq-row-label">${escapeHTML(FRAGMENTS[7].label)}</span>
                    ${eighth}
                </li>
            </ol>

            <footer class="scq-door">
                ${doorway}
                <p class="scq-fineprint">Questa pagina non ha un retro. Ha un tavolo.</p>
            </footer>
        </div>
    `;
}

export function renderCantina({ quaderno, stage = 'table', plain = false }) {
    if (stage === 'table') {
        return `
            <div class="sc-cantina" data-screen="cantina" data-stage="table">
                <div class="scq-candle" aria-hidden="true"></div>
                <header class="scq-head scq-head--dark">
                    <button type="button" class="scq-back" data-action="cantina-back">
                        <span aria-hidden="true">←</span> LASCIA IL TAVOLO
                    </button>
                    <div class="scq-head-copy">
                        <span class="scq-kicker">TAVOLO 0 · BOTTINO 0</span>
                        <h2>IL NONO</h2>
                    </div>
                </header>

                <p class="scq-stake">${CANTINA_COPY.stake}</p>

                <div class="scq-table" role="group" aria-label="Tavolo zero">
                    <div class="scq-seat is-dealer">
                        <div class="scq-cover">${burntBack()}</div>
                        <span class="scq-seat-label">IL BANCO</span>
                    </div>
                    <span class="scq-vs" aria-hidden="true">VS</span>
                    <div class="scq-seat is-player">
                        ${cardFront(quaderno)}
                        <!-- mai "plain" qui: il fronte resta bruciato finché il turno non si gioca -->
                        <span class="scq-seat-label">TU</span>
                    </div>
                </div>

                <button type="button" class="scq-door-button scq-door-button--big" data-action="cantina-play">
                    ${CANTINA_COPY.play}
                </button>
                <p class="scq-fineprint">Un turno solo. Non c’è un secondo.</p>
            </div>
        `;
    }

    const written = quaderno.cantina === 'transcribed';
    const kept = quaderno.cantina === 'kept';
    const decided = written || kept;

    return `
        <div class="sc-cantina is-revealed" data-screen="cantina" data-stage="reveal">
            <header class="scq-head scq-head--dark">
                <button type="button" class="scq-back" data-action="cantina-back">
                    <span aria-hidden="true">←</span> TORNA AL QUADERNO
                </button>
                <div class="scq-head-copy">
                    <span class="scq-kicker">RIVELAZIONE · TAVOLO 0</span>
                    <h2>JOLLY.</h2>
                </div>
            </header>

            <div class="scq-dealer-says" role="status">
                <p>${CANTINA_COPY.win}</p>
                <p>${CANTINA_COPY.winAfter}</p>
            </div>

            ${cardBackReadable(quaderno, { plain })}

            <div class="scq-choice">
                ${decided
                    ? `<p class="scq-door-note is-ready">${written ? CANTINA_COPY.writtenNote : CANTINA_COPY.kept}</p>`
                    : `<button type="button" class="scq-door-button" data-action="cantina-choose" data-mode="write">${CANTINA_COPY.write}</button>
                       <button type="button" class="scq-door-button scq-door-button--quiet" data-action="cantina-choose" data-mode="keep">${CANTINA_COPY.keep}</button>`}
            </div>
            <p class="scq-fineprint">Non si perde niente. La cantina resta aperta.</p>
        </div>
    `;
}
