import './scippo.css';
import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { setExperienceTheme } from '../../services/experienceTheme.js';
import { createScippoAudio } from '../../services/scippoAudio.js';
import {
    CARD_IDS,
    CARD_TYPES,
    DEFAULT_DECK_COMPOSITION,
    deckCompositionLabel,
    deckTotal,
    createMatch,
    createRng,
    advanceMatch,
    outcomeForSeat,
    pickTaunt,
    playCard,
    validateDeckComposition,
    REGULATION_TURNS
} from '../../services/scippoEngine.js';
import { SCIPPO_BOT_LEVELS, chooseBotCard, isBotDifficulty } from '../../services/scippoBot.js';
import {
    MAX_DECKS,
    dailyChallengeKey,
    deckSummary,
    deleteDeck,
    getActiveComposition,
    getActiveDeck,
    getDailyChallenge,
    loadScippoProfile,
    recordChallengeResult,
    recordDailyResult,
    recordScippoMatch,
    resetScippoStats,
    saveDeck,
    scippoBadges,
    setActiveDeck,
    syncDaily,
    updateScippoSettings,
    winRate
} from '../../services/scippoProfile.js';

const CHOICE_SECONDS = 20;
const CHOICE_MS = CHOICE_SECONDS * 1000;
const CARD_ORDER = ['botta', 'scudo', 'finta', 'jolly'];

const escapeHTML = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const cardFace = (cardId, className = '') => {
    const card = CARD_TYPES[cardId];
    if (!card) return '';
    return `
        <div class="sc-card sc-card--${card.id} ${className}">
            <span class="sc-card-icon" aria-hidden="true">${card.icon}</span>
            <strong class="sc-card-name">${card.label}</strong>
            <span class="sc-card-rule">${card.rule}</span>
        </div>
    `;
};

const cardBack = (className = '') => `
    <div class="sc-card sc-card-back ${className}" aria-hidden="true">
        <span class="sc-card-back-mark">SC<span>!</span></span>
    </div>
`;

const levelName = difficulty => (SCIPPO_BOT_LEVELS[difficulty] || SCIPPO_BOT_LEVELS.normale).label;

function challengeFromUrl() {
    try {
        const raw = new URLSearchParams(location.search).get('sfida') || '';
        const match = /^(facile|normale|difficile)-([0-9a-z]+)$/i.exec(raw);
        if (!match) return null;
        const seed = Number.parseInt(match[2], 36);
        if (!Number.isFinite(seed)) return null;
        return { code: raw, difficulty: match[1].toLowerCase(), seed: seed >>> 0 };
    } catch {
        return null;
    }
}

function profileRank(profile) {
    const wins = profile?.stats?.wins || 0;
    if (wins >= 40) return 'Leggenda del banco';
    if (wins >= 20) return 'Baro di quartiere';
    if (wins >= 8) return 'Scaltro';
    if (wins >= 3) return 'Svezzato';
    return 'Novizio';
}

export function initScippo(container) {
    if (!container) return;
    window.__scippoCleanup?.();

    try { updateSidebarContext('minigames'); } catch { /* sidebar non pronta */ }
    setExperienceTheme('scippo', 'experience');

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.backgroundColor = '#08070b';

    const view = {
        screen: 'home',
        profile: syncDaily(loadScippoProfile()),
        difficulty: 'normale',
        match: null,
        mode: 'bot',
        matchDeck: { ...DEFAULT_DECK_COMPOSITION },
        draft: { composition: getActiveComposition(syncDaily(loadScippoProfile())), name: '' },
        challenge: challengeFromUrl(),
        shareSeed: Math.floor(Math.random() * 0xffffffff) >>> 0,
        deadline: 0,
        choiceInterval: null,
        timers: new Set(),
        botBusy: false,
        resultRecorded: false,
        disposed: false,
        toastTimer: null
    };
    view.draft.composition = getActiveComposition(view.profile);

    const audio = createScippoAudio({ enabled: () => view.profile.settings.sound !== false });
    audio.setMuted(!view.profile.settings.sound);

    const later = (fn, delay) => {
        const id = setTimeout(() => {
            view.timers.delete(id);
            if (!view.disposed) fn();
        }, delay);
        view.timers.add(id);
        return id;
    };

    const clearTimers = () => {
        view.timers.forEach(clearTimeout);
        view.timers.clear();
        view.botBusy = false;
    };

    const clearChoiceTimer = () => {
        if (view.choiceInterval) clearInterval(view.choiceInterval);
        view.choiceInterval = null;
    };

    const showToast = message => {
        container.querySelector('.sc-toast')?.remove();
        const toast = document.createElement('p');
        toast.className = 'sc-toast';
        toast.setAttribute('role', 'status');
        toast.textContent = message;
        container.querySelector('.scippo-app')?.appendChild(toast);
        clearTimeout(view.toastTimer);
        view.toastTimer = setTimeout(() => toast.remove(), 2400);
    };

    const rerender = (options = {}) => {
        const scrollTop = container.scrollTop;
        container.innerHTML = renderScript();
        if (options.keepScroll) container.scrollTop = scrollTop;
        else container.scrollTop = 0;
    };

    const startChoiceTimer = () => {
        clearChoiceTimer();
        view.deadline = Date.now() + CHOICE_MS;
        const tick = () => {
            if (view.disposed || view.screen !== 'match' || !view.match) return;
            if (view.match.phase !== 'choose') return;
            const label = container.querySelector('[data-choice-timer]');
            const fill = container.querySelector('.sc-timer-fill');
            const remaining = Math.max(0, view.deadline - Date.now());
            if (label) label.textContent = `${Math.ceil(remaining / 1000)}s`;
            if (fill) fill.style.width = `${Math.max(0, Math.min(100, (remaining / CHOICE_MS) * 100))}%`;
            if (remaining <= 0) {
                clearChoiceTimer();
                autoPlay();
            }
        };
        tick();
        view.choiceInterval = setInterval(tick, 400);
    };

    const autoPlay = () => {
        if (!view.match || view.match.phase !== 'choose' || view.match.pending[0]) return;
        const hand = view.match.hands[0];
        if (!hand.length) return;
        showToast('Tempo scaduto: carta giocata d’ufficio.');
        selectCard(hand[Math.floor(Math.random() * hand.length)]);
    };

    const startMatch = ({ difficulty = view.difficulty, mode = 'bot', seed, composition } = {}) => {
        clearTimers();
        clearChoiceTimer();
        const deck = composition && validateDeckComposition(composition).valid
            ? validateDeckComposition(composition).composition
            : getActiveComposition(view.profile);
        let nextMatch;
        try {
            nextMatch = createMatch({
                seed: seed ?? Math.floor(Math.random() * 0xffffffff),
                decks: [deck, { ...DEFAULT_DECK_COMPOSITION }],
                maxTurns: REGULATION_TURNS
            });
        } catch (error) {
            showToast(error.message || 'Impossibile iniziare la partita.');
            return;
        }
        view.match = nextMatch;
        view.matchDeck = deck;
        view.difficulty = difficulty;
        view.mode = mode;
        view.screen = 'match';
        view.resultRecorded = false;
        view.botBusy = false;
        rerender();
        startChoiceTimer();
    };

    const selectCard = cardId => {
        if (!view.match || view.match.phase !== 'choose' || view.match.pending[0]) return;
        const result = playCard(view.match, 0, cardId);
        if (!result.ok) {
            showToast(result.error || 'Mossa non valida.');
            return;
        }
        view.match = result.match;
        clearChoiceTimer();
        audio.play('select');
        rerender();
        if (view.match.phase === 'reveal') {
            handleReveal();
            return;
        }
        scheduleBot();
    };

    const scheduleBot = () => {
        if (view.botBusy) return;
        view.botBusy = true;
        const delay = 650 + Math.round(Math.random() * 700);
        later(() => {
            view.botBusy = false;
            if (!view.match || view.match.phase !== 'choose') return;
            const rng = createRng((view.match.seed ^ Math.imul(view.match.turn, 2654435761)) >>> 0);
            const card = chooseBotCard({ match: view.match, seat: 1, difficulty: view.difficulty, rng });
            if (!card) return;
            const played = playCard(view.match, 1, card);
            if (!played.ok) return;
            view.match = played.match;
            audio.play('play');
            rerender();
            if (view.match.phase === 'reveal') handleReveal();
        }, delay);
    };

    const handleReveal = () => {
        if (!view.match?.lastTurn) return;
        const { winnerSeat } = view.match.lastTurn;
        audio.play(winnerSeat === 0 ? 'win' : winnerSeat === 1 ? 'lose' : 'draw');
        later(() => {
            if (winnerSeat === 0) audio.play('score');
        }, 240);
        rerender();
        later(() => {
            if (!view.match || view.match.phase !== 'reveal') return;
            view.match = advanceMatch(view.match);
            if (view.match.phase === 'over') {
                recordResult();
                const outcome = outcomeForSeat(view.match, 0);
                audio.play(outcome === 'win' ? 'victory' : outcome === 'loss' ? 'defeat' : 'draw');
                rerender();
            } else {
                rerender();
                startChoiceTimer();
            }
        }, 1750);
    };

    const recordResult = () => {
        if (view.resultRecorded || !view.match?.finished) return;
        view.resultRecorded = true;
        const outcome = outcomeForSeat(view.match, 0) || 'draw';
        const score = view.match.scores[0];
        view.profile = recordScippoMatch(view.profile, {
            outcome,
            mode: 'bot',
            difficulty: view.difficulty,
            score,
            match: view.match
        });
        if (view.mode === 'daily') {
            view.profile = recordDailyResult(view.profile, { score, outcome });
        } else if (view.mode === 'challenge' && view.challenge) {
            view.profile = recordChallengeResult(view.profile, { seed: view.challenge.code, score });
        }
        view.profile = syncDaily(view.profile);
    };

    const exitToTaverna = async () => {
        cleanup();
        try {
            const { showMinigamesList } = await import('../../minigamelist.js');
            showMinigamesList(document.getElementById('app') || container, { filter: 'party' });
        } catch {
            window.location.assign('/minigames');
        }
    };

    const goHome = ({ confirmAbandon = false } = {}) => {
        if (confirmAbandon && view.match && !view.match.finished) {
            if (!window.confirm('Abbandonare la partita? Il risultato non verrà salvato.')) return;
        }
        clearTimers();
        clearChoiceTimer();
        view.match = null;
        view.screen = 'home';
        view.resultRecorded = false;
        rerender();
    };

    const startDaily = () => {
        const daily = getDailyChallenge(new Date());
        startMatch({ difficulty: daily.difficulty, mode: 'daily', seed: daily.seed, composition: daily.composition });
    };

    const startChallenge = () => {
        if (!view.challenge) return;
        startMatch({
            difficulty: view.challenge.difficulty,
            mode: 'challenge',
            seed: view.challenge.seed,
            composition: { ...DEFAULT_DECK_COMPOSITION }
        });
    };

    const copyText = async text => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            try {
                const area = document.createElement('textarea');
                area.value = text;
                area.setAttribute('readonly', '');
                area.style.position = 'fixed';
                area.style.opacity = '0';
                document.body.appendChild(area);
                area.select();
                const done = document.execCommand('copy');
                area.remove();
                return done;
            } catch {
                return false;
            }
        }
    };

    const challengeLink = () => {
        const seed = view.shareSeed.toString(36);
        return `${location.origin}/scippo?sfida=${view.difficulty}-${seed}`;
    };

    const shareChallenge = async () => {
        const link = challengeLink();
        const copied = await copyText(link);
        showToast(copied ? 'Link copiato: stesso mazzo, stesso BOT.' : 'Copia non riuscita: seleziona il link qui sopra.');
        return link;
    };

    const openSheet = kind => {
        const existing = container.querySelector('.sc-sheet');
        existing?.remove();
        const sheet = document.createElement('div');
        sheet.className = 'sc-sheet';
        sheet.innerHTML = sheetMarkup(kind);
        container.querySelector('.scippo-app')?.appendChild(sheet);
        sheet.addEventListener('click', event => {
            if (event.target === sheet || event.target.closest('[data-action="sheet-close"]')) sheet.remove();
        });
        const copy = sheet.querySelector('[data-action="sheet-copy"]');
        if (copy) {
            copy.onclick = async () => {
                const copied = await copyText(challengeLink());
                showToast(copied ? 'Link copiato.' : 'Copia non riuscita.');
            };
        }
        sheet.querySelector('[data-action="sheet-start-share"]')?.addEventListener('click', () => {
            sheet.remove();
            startMatch({ seed: view.shareSeed, mode: 'bot', difficulty: view.difficulty });
        });
    };

    const sheetMarkup = kind => {
        if (kind === 'rules') {
            return `
                <div class="sc-sheet-panel" role="dialog" aria-modal="true" aria-label="Regole di SCIPPO">
                    <header><strong>COME SI GIOCA</strong><button type="button" data-action="sheet-close" aria-label="Chiudi">✕</button></header>
                    <div class="sc-rules-list">
                        <p><b>20 carte</b> nel mazzo: 6 BOTTA, 6 SCUDO, 6 FINTA, 2 JOLLY. Ne peschi 4.</p>
                        <p><b>8 turni.</b> Ogni turno compare un bottino da 1, 2 o 3 punti. Scegli una carta coperta: l’avversario non la vede.</p>
                        <p><b>Il giro:</b> 👊 BOTTA batte 🎭 FINTA · 🛡️ SCUDO batte 👊 BOTTA · 🎭 FINTA batte 🛡️ SCUDO · 🃏 JOLLY batte tutto.</p>
                        <p><b>Pareggio:</b> due carte uguali (anche JOLLY contro JOLLY) e il bottino resta sul tavolo.</p>
                        <p><b>Spareggio:</b> se dopo 8 turni siete pari, si continua con le carte rimaste e bottino da 1 punto. Finiscono le carte? È pareggio, senza carte inventate.</p>
                    </div>
                    <button type="button" class="sc-button sc-button--primary" data-action="sheet-close">HO CAPITO</button>
                </div>
            `;
        }
        return `
            <div class="sc-sheet-panel" role="dialog" aria-modal="true" aria-label="Sfida un amico">
                <header><strong>SFIDA UN AMICO</strong><button type="button" data-action="sheet-close" aria-label="Chiudi">✕</button></header>
                <p class="sc-sheet-copy">Manda il link: chi lo apre gioca <b>la stessa identica partita</b> — stesso mazzo, stesso BOT ${levelName(view.difficulty)}, stesse carte — e poi confrontate i punteggi. Niente account, niente attese.</p>
                <code class="sc-link-box">${escapeHTML(challengeLink())}</code>
                <div class="sc-sheet-actions">
                    <button type="button" class="sc-button" data-action="sheet-copy">COPIA LINK</button>
                    <button type="button" class="sc-button sc-button--primary" data-action="sheet-start-share">GIOCA LA MIA SFIDA</button>
                </div>
                <p class="sc-fineprint">La sfida è asincrona: non serve essere online nello stesso momento.</p>
            </div>
        `;
    };

    const renderScript = () => {
        const screen = view.screen === 'match' && view.match
            ? renderMatch()
            : view.screen === 'deck'
                ? renderDeck()
                : view.screen === 'profile'
                    ? renderProfile()
                    : renderHome();
        return `
            <div class="scippo-app ${view.profile.settings.reduceFx ? 'is-calm' : ''}" data-screen="${view.screen}" data-calm="${view.profile.settings.reduceFx}">
                <div class="sc-noise" aria-hidden="true"></div>
                ${screen}
            </div>
        `;
    };

    const renderHome = () => {
        const daily = getDailyChallenge(new Date());
        const activeDeck = getActiveDeck(view.profile);
        const dailyDone = view.profile.daily.date === daily.key && view.profile.daily.completed;
        const challengeBanner = view.challenge ? `
            <section class="sc-challenge-banner" aria-label="Sfida ricevuta">
                <span class="sc-challenge-tag">SFIDA RICEVUTA</span>
                <strong>Stesso BOT, stesse carte.</strong>
                <p>Difficoltà ${escapeHTML(levelName(view.challenge.difficulty))} · scenario condiviso</p>
                <button type="button" class="sc-button sc-button--primary" data-action="accept-challenge">ACCETTA LA SFIDA</button>
            </section>
        ` : '';

        return `
            <div class="sc-home">
                <header class="sc-chrome">
                    <button type="button" class="sc-chip" data-action="exit-taverna">← TAVERNA</button>
                    <div class="sc-chrome-tools">
                        <button type="button" class="sc-icon-button" data-action="rules" aria-label="Regole">?</button>
                        <button type="button" class="sc-icon-button" data-action="sound" aria-pressed="${view.profile.settings.sound}" aria-label="${view.profile.settings.sound ? 'Disattiva audio' : 'Attiva audio'}">${view.profile.settings.sound ? '🔊' : '🔇'}</button>
                    </div>
                </header>

                ${challengeBanner}

                <section class="sc-hero" aria-labelledby="scippo-title">
                    <span class="sc-kicker">IL GIOCO DI CARTE PIÙ SBAGLIATO DEL TAVOLO</span>
                    <h1 id="scippo-title" class="sc-wordmark">SCIPPO<span class="sc-bang">!</span></h1>
                    <p class="sc-tagline">20 carte. 5 minuti. Un solo vincitore.</p>
                    <div class="sc-fan" aria-hidden="true">
                        ${cardFace('scudo', 'is-fan-left')}
                        ${cardFace('botta', 'is-fan-mid')}
                        ${cardFace('jolly', 'is-fan-right')}
                    </div>
                </section>

                <section class="sc-levels" role="group" aria-label="Difficoltà del bot">
                    ${Object.values(SCIPPO_BOT_LEVELS).map(level => `
                        <button type="button" class="sc-level ${view.difficulty === level.id ? 'is-active' : ''}" data-action="level" data-value="${level.id}" aria-pressed="${view.difficulty === level.id}">
                            <strong>${level.label}</strong>
                            <small>${level.id === 'facile' ? 'per scaldarsi' : level.id === 'normale' ? 'partita vera' : 'massima pressione'}</small>
                        </button>
                    `).join('')}
                </section>

                <button type="button" class="sc-cta" data-action="play">
                    <span>GIOCA SUBITO</span>
                    <small>contro il BOT ${escapeHTML(levelName(view.difficulty))}</small>
                </button>

                <section class="sc-action-grid" aria-label="Altre modalità">
                    <button type="button" class="sc-action ${dailyDone ? 'is-done' : ''}" data-action="daily">
                        <span class="sc-action-icon" aria-hidden="true">📅</span>
                        <span class="sc-action-copy">
                            <strong>SFIDA GIORNALIERA</strong>
                            <small>${dailyDone ? `Fatta · record ${view.profile.daily.bestScore ?? '—'}` : 'Stessa partita per tutti'}</small>
                        </span>
                        <b aria-hidden="true">↗</b>
                    </button>
                    <button type="button" class="sc-action" data-action="friend">
                        <span class="sc-action-icon" aria-hidden="true">🔗</span>
                        <span class="sc-action-copy">
                            <strong>SFIDA UN AMICO</strong>
                            <small>Stesso scenario, link rapido</small>
                        </span>
                        <b aria-hidden="true">↗</b>
                    </button>
                    <button type="button" class="sc-action" data-action="deck">
                        <span class="sc-action-icon" aria-hidden="true">🎨</span>
                        <span class="sc-action-copy">
                            <strong>CREA MAZZO</strong>
                            <small>${view.profile.decks.length}/${MAX_DECKS} mazzi salvati</small>
                        </span>
                        <b aria-hidden="true">↗</b>
                    </button>
                    <button type="button" class="sc-action" data-action="profile">
                        <span class="sc-action-icon" aria-hidden="true">🏅</span>
                        <span class="sc-action-copy">
                            <strong>PROFILO</strong>
                            <small>${profileRank(view.profile)} · ${view.profile.stats.played} partite</small>
                        </span>
                        <b aria-hidden="true">↗</b>
                    </button>
                </section>

                <section class="sc-deck-strip">
                    <span>MAZZO ATTIVO</span>
                    <strong>${escapeHTML(activeDeck.name)}</strong>
                    <small>${deckCompositionLabel(activeDeck.composition)}</small>
                    <button type="button" data-action="deck">MODIFICA</button>
                </section>

                <p class="sc-rules-strip">
                    <span>👊 batte 🎭</span><span>🛡️ batte 👊</span><span>🎭 batte 🛡️</span><span>🃏 batte tutto</span>
                </p>
                <p class="sc-fineprint">Partite contro BOT · nessun vantaggio acquistabile · statistiche salvate su questo dispositivo.</p>
            </div>
        `;
    };

    const slotMarkup = () => {
        const match = view.match;
        const revealed = match.phase === 'reveal' || match.phase === 'over';
        if (revealed && match.lastTurn) {
            const opponentPlay = match.lastTurn.plays.find(play => play.seat === 1);
            const myPlay = match.lastTurn.plays.find(play => play.seat === 0);
            const winner = match.lastTurn.winnerSeat;
            return [1, 0].map(seat => {
                const play = seat === 1 ? opponentPlay : myPlay;
                const tone = winner === null ? 'is-draw' : winner === seat ? 'is-winner' : 'is-loser';
                return `
                    <div class="sc-slot ${tone}">
                        ${cardFace(play.card, 'is-revealed')}
                        <span class="sc-slot-label">${seat === 0 ? 'TU' : levelName(view.difficulty).toUpperCase()}</span>
                    </div>
                `;
            }).join('<span class="sc-vs" aria-hidden="true">VS</span>');
        }

        const myPending = match.pending[0];
        const opponentPending = match.pending[1];
        return `
            <div class="sc-slot ${opponentPending ? 'is-committed' : 'is-empty'}">
                ${opponentPending ? cardBack('is-covered') : '<span class="sc-slot-ghost">?</span>'}
                <span class="sc-slot-label">${opponentPending ? 'COPERTA' : 'IN ATTESA'}</span>
            </div>
            <span class="sc-vs" aria-hidden="true">VS</span>
            <div class="sc-slot ${myPending ? 'is-committed' : 'is-empty'}">
                ${myPending ? cardBack('is-covered') : '<span class="sc-slot-ghost">SCEGLI</span>'}
                <span class="sc-slot-label">${myPending ? 'COPERTA' : 'LA TUA CARTA'}</span>
            </div>
        `;
    };

    const verdictMarkup = () => {
        const match = view.match;
        const revealed = match.phase === 'reveal' || match.phase === 'over';
        if (revealed && match.lastTurn) {
            const { winnerSeat, bottino, result } = match.lastTurn;
            const label = winnerSeat === 0 ? `BOTTINO TUO +${bottino}` : winnerSeat === 1 ? `BOTTINO AVVERSARIO +${bottino}` : 'PAREGGIO · BOTTINO SUL TAVOLO';
            return `<div class="sc-verdict ${winnerSeat === 0 ? 'is-good' : winnerSeat === 1 ? 'is-bad' : 'is-draw'}"><strong>${label}</strong><small>${escapeHTML(match.lastTurn.taunt)}</small></div>`;
        }
        return `<div class="sc-verdict is-waiting"><span>${match.pending[0] ? 'Carta coperta. Il BOT sceglie…' : `Bottino da ${match.bottino} ${match.bottino === 1 ? 'punto' : 'punti'}. Scegli una carta.`}</span></div>`;
    };

    const resultOverlay = () => {
        if (!view.match?.finished) return '';
        const outcome = outcomeForSeat(view.match, 0);
        const winnerTitle = outcome === 'win' ? 'HAI SCIPPATO!' : outcome === 'loss' ? 'TI HANNO SCIPPATO' : 'PAREGGIO SECCO';
        const subtitle = view.match.endReason === 'spareggio'
            ? 'Deciso allo spareggio.'
            : view.match.endReason === 'carte'
                ? 'Carte finite: nessuno prevale.'
                : view.match.endReason === 'punti'
                    ? 'Otto turni, conti chiusi.'
                    : 'Nessuno porta a casa il bottino.';
        const isDaily = view.mode === 'daily';
        const isChallenge = view.mode === 'challenge';
        return `
            <div class="sc-result-overlay">
                <section class="sc-result ${outcome === 'win' ? 'is-win' : outcome === 'loss' ? 'is-loss' : 'is-draw'}" role="dialog" aria-modal="true" aria-label="Risultato della partita">
                    <span class="sc-result-tag">${isDaily ? 'SFIDA GIORNALIERA' : isChallenge ? 'SFIDA CONDIVISA' : `BOT ${escapeHTML(levelName(view.difficulty).toUpperCase())}`}</span>
                    <h2>${winnerTitle}</h2>
                    <p class="sc-final-score"><span>${view.match.scores[0]}</span><b>–</b><span>${view.match.scores[1]}</span></p>
                    <p class="sc-result-sub">${subtitle}</p>
                    <p class="sc-result-taunt">${escapeHTML(pickTaunt('end', view.match.seed + view.match.scores[0]))}</p>
                    <div class="sc-result-actions">
                        <button type="button" class="sc-button sc-button--primary" data-action="rematch">RIVINCITA</button>
                        <button type="button" class="sc-button" data-action="deck">CAMBIA MAZZO</button>
                        <button type="button" class="sc-button" data-action="home">HOME</button>
                    </div>
                    <button type="button" class="sc-text-button" data-action="copy-result">COPIA IL RISULTATO</button>
                </section>
            </div>
        `;
    };

    const renderMatch = () => {
        const match = view.match;
        const roundLabel = match.overtime ? `SPAREGGIO ${match.turn - match.maxTurns}` : `TURNO ${match.turn}/${match.maxTurns}`;
        const myTurn = match.phase === 'choose' && !match.pending[0];
        const status = match.phase === 'choose'
            ? (match.pending[0] ? 'Carta coperta: aspetta la rivelazione.' : 'Tocca a te: scegli una carta.')
            : 'Rivelazione…';

        return `
            <div class="sc-match">
                <header class="sc-match-top">
                    <button type="button" class="sc-chip" data-action="home" data-confirm="1">← ESCI</button>
                    <span class="sc-round ${match.overtime ? 'is-overtime' : ''}">${roundLabel}</span>
                    <div class="sc-chrome-tools">
                        <button type="button" class="sc-icon-button" data-action="fullscreen" aria-label="Schermo intero">⛶</button>
                        <button type="button" class="sc-icon-button" data-action="sound" aria-pressed="${view.profile.settings.sound}" aria-label="${view.profile.settings.sound ? 'Disattiva audio' : 'Attiva audio'}">${view.profile.settings.sound ? '🔊' : '🔇'}</button>
                    </div>
                </header>

                <section class="sc-opponent" aria-label="Avversario">
                    <span class="sc-avatar" aria-hidden="true">🤖</span>
                    <div class="sc-opponent-copy">
                        <strong>${escapeHTML(levelName(view.difficulty).toUpperCase())}</strong>
                        <small>${match.hands[1].length + match.piles[1].length} carte rimaste</small>
                    </div>
                    <div class="sc-mini-hand" aria-hidden="true">
                        ${Array.from({ length: Math.max(0, match.hands[1].length) }, () => '<span></span>').join('')}
                    </div>
                    <div class="sc-score"><span>${match.scores[1]}</span><small>PUNTI</small></div>
                </section>

                <section class="sc-arena" aria-label="Arena di gioco">
                    <div class="sc-bottino ${match.bottino === 3 ? 'is-hot' : ''}">
                        <small>BOTTINO</small>
                        <strong>+${match.bottino}</strong>
                    </div>
                    <div class="sc-duel">
                        ${slotMarkup()}
                    </div>
                    ${verdictMarkup()}
                    <p class="sc-sr-only" aria-live="polite">${status}</p>
                </section>

                <section class="sc-me" aria-label="La tua mano">
                    <div class="sc-me-head">
                        <span class="sc-avatar is-me" aria-hidden="true">🫵</span>
                        <div class="sc-me-copy">
                            <strong>TU</strong>
                            <small>mazzo ${match.piles[0].length} · scarti ${match.discards[0].length}</small>
                        </div>
                        <div class="sc-timer-wrap">
                            <span data-choice-timer>${myTurn ? `${CHOICE_SECONDS}s` : '—'}</span>
                            <div class="sc-timer-track"><span class="sc-timer-fill"></span></div>
                        </div>
                        <div class="sc-score is-mine"><span>${match.scores[0]}</span><small>PUNTI</small></div>
                    </div>
                    <div class="sc-hand" role="group" aria-label="Carte in mano">
                        ${match.hands[0].map((card, index) => `
                            <button type="button" class="sc-hand-card" data-action="select" data-card="${card}" data-index="${index}"
                                ${myTurn ? '' : 'disabled'} aria-label="${CARD_TYPES[card].label}: ${CARD_TYPES[card].rule}">
                                ${cardFace(card)}
                            </button>
                        `).join('')}
                    </div>
                </section>

                ${resultOverlay()}
            </div>
        `;
    };

    const renderDeck = () => {
        const composition = view.draft.composition;
        const validation = validateDeckComposition(composition);
        const total = deckTotal(composition);
        const active = getActiveDeck(view.profile);
        return `
            <div class="sc-deck-screen">
                <header class="sc-chrome">
                    <button type="button" class="sc-chip" data-action="home">← INDIETRO</button>
                    <span class="sc-round">MAZZIERE</span>
                    <button type="button" class="sc-icon-button" data-action="sound" aria-label="Audio">${view.profile.settings.sound ? '🔊' : '🔇'}</button>
                </header>

                <section class="sc-page-head">
                    <h1>CREA MAZZO</h1>
                    <p>20 carte, sempre. Da 3 a 10 copie per ogni carta normale, massimo 2 JOLLY. Il mazzo vale sia per te sia per chi accetta le tue sfide.</p>
                </section>

                <section class="sc-deck-editor" aria-label="Composizione del mazzo">
                    ${CARD_ORDER.map(id => {
                        const card = CARD_TYPES[id];
                        const count = composition[id] || 0;
                        const min = id === 'jolly' ? 0 : 3;
                        const max = id === 'jolly' ? 2 : 10;
                        return `
                            <div class="sc-deck-row sc-deck-row--${id}">
                                <span class="sc-deck-swatch" aria-hidden="true">${card.icon}</span>
                                <div class="sc-deck-info">
                                    <strong>${card.label}</strong>
                                    <small>${card.rule}</small>
                                </div>
                                <div class="sc-stepper" role="group" aria-label="${card.label}">
                                    <button type="button" data-action="deck-dec" data-card="${id}" aria-label="Rimuovi ${card.label}" ${count <= min ? 'disabled' : ''}>−</button>
                                    <output aria-live="polite">${count}</output>
                                    <button type="button" data-action="deck-inc" data-card="${id}" aria-label="Aggiungi ${card.label}" ${count >= max ? 'disabled' : ''}>+</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </section>

                <div class="sc-deck-total ${validation.valid ? 'is-valid' : 'is-invalid'}">
                    <span>${total} / ${validateDeckComposition(DEFAULT_DECK_COMPOSITION).total}</span>
                    <small>${validation.valid ? 'Mazzo pronto' : 'Mazzo incompleto'}</small>
                </div>
                ${validation.valid ? '' : `<ul class="sc-deck-errors">${validation.errors.map(error => `<li>${escapeHTML(error)}</li>`).join('')}</ul>`}

                <section class="sc-save-deck">
                    <label for="sc-deck-name">NOME DEL MAZZO</label>
                    <div class="sc-save-row">
                        <input id="sc-deck-name" type="text" maxlength="28" placeholder="Es. Mazzo del baro" value="${escapeHTML(view.draft.name || '')}" autocomplete="off">
                        <button type="button" class="sc-button" data-action="deck-save" ${validation.valid ? '' : 'disabled'}>SALVA</button>
                    </div>
                </section>

                <section class="sc-saved-decks" aria-label="Mazzi salvati">
                    <header><strong>I TUOI MAZZI</strong><span>${view.profile.decks.length}/${MAX_DECKS}</span></header>
                    <div class="sc-deck-item ${view.profile.activeDeckId === 'standard' ? 'is-active' : ''}">
                        <div><strong>Mazzo standard</strong><small>${deckSummary({ composition: DEFAULT_DECK_COMPOSITION })}</small></div>
                        <button type="button" data-action="deck-use" data-deck="standard">${view.profile.activeDeckId === 'standard' ? 'ATTIVO' : 'USA'}</button>
                    </div>
                    ${view.profile.decks.map(deck => `
                        <div class="sc-deck-item ${view.profile.activeDeckId === deck.id ? 'is-active' : ''}">
                            <div><strong>${escapeHTML(deck.name)}</strong><small>${deckSummary(deck)}</small></div>
                            <div class="sc-deck-item-actions">
                                <button type="button" data-action="deck-use" data-deck="${escapeHTML(deck.id)}">${view.profile.activeDeckId === deck.id ? 'ATTIVO' : 'USA'}</button>
                                <button type="button" data-action="deck-delete" data-deck="${escapeHTML(deck.id)}" aria-label="Elimina ${escapeHTML(deck.name)}">✕</button>
                            </div>
                        </div>
                    `).join('')}
                </section>

                <div class="sc-deck-footer">
                    <button type="button" class="sc-button" data-action="deck-reset">RIPRISTINA STANDARD</button>
                    <button type="button" class="sc-button sc-button--primary" data-action="deck-play" ${validation.valid ? '' : 'disabled'}>GIOCA CON QUESTO MAZZO</button>
                </div>
                <p class="sc-fineprint">Mazzo attivo: ${escapeHTML(active.name)}. Le modifiche non salvate valgono solo per la prossima partita.</p>
            </div>
        `;
    };

    const renderProfile = () => {
        const stats = view.profile.stats;
        const rate = winRate(view.profile);
        const badges = scippoBadges(view.profile);
        return `
            <div class="sc-profile-screen">
                <header class="sc-chrome">
                    <button type="button" class="sc-chip" data-action="home">← INDIETRO</button>
                    <span class="sc-round">PROFILO</span>
                    <button type="button" class="sc-icon-button" data-action="sound" aria-label="Audio">${view.profile.settings.sound ? '🔊' : '🔇'}</button>
                </header>

                <section class="sc-profile-hero">
                    <span class="sc-profile-mark" aria-hidden="true">!</span>
                    <div>
                        <h1>${escapeHTML(profileRank(view.profile))}</h1>
                        <p>${stats.played} partite al tavolo · serie attuale ${stats.streak}${stats.bestStreak ? ` · record ${stats.bestStreak}` : ''}</p>
                    </div>
                </section>

                <section class="sc-stat-grid" aria-label="Statistiche">
                    <div><strong>${stats.played}</strong><small>PARTITE</small></div>
                    <div><strong>${stats.wins}</strong><small>VINTE</small></div>
                    <div><strong>${stats.losses}</strong><small>PERSE</small></div>
                    <div><strong>${stats.draws}</strong><small>PATTE</small></div>
                    <div><strong>${rate === null ? '—' : `${rate}%`}</strong><small>VITTORIE</small></div>
                    <div><strong>${stats.bestScore ?? '—'}</strong><small>RECORD PUNTI</small></div>
                </section>

                <section class="sc-panel">
                    <header><strong>CONTRO I BOT</strong></header>
                    <div class="sc-bot-stats">
                        ${Object.values(SCIPPO_BOT_LEVELS).map(level => `
                            <div><span>${level.label}</span><b>${stats.winsByLevel?.[level.id] || 0}</b></div>
                        `).join('')}
                    </div>
                    <p class="sc-fineprint">Punti segnati ${stats.pointsScored} · subiti ${stats.pointsAllowed} · vittorie senza JOLLY ${stats.jollylessWins}</p>
                </section>

                <section class="sc-panel">
                    <header><strong>BADGE</strong><span>${badges.filter(badge => badge.earned).length}/${badges.length}</span></header>
                    <div class="sc-badges">
                        ${badges.map(badge => `
                            <div class="sc-badge ${badge.earned ? 'is-earned' : ''}" title="${escapeHTML(badge.description)}">
                                <span aria-hidden="true">${badge.icon}</span>
                                <strong>${escapeHTML(badge.label)}</strong>
                                <small>${escapeHTML(badge.description)}</small>
                            </div>
                        `).join('')}
                    </div>
                </section>

                <section class="sc-panel">
                    <header><strong>PREFERENZE</strong></header>
                    <div class="sc-setting-row">
                        <div><strong>Audio</strong><small>Effetti di gioco, nessuna musica automatica.</small></div>
                        <button type="button" class="sc-switch ${view.profile.settings.sound ? 'is-on' : ''}" data-action="toggle-sound" aria-pressed="${view.profile.settings.sound}"><span></span></button>
                    </div>
                    <div class="sc-setting-row">
                        <div><strong>Riduci effetti</strong><small>Meno animazioni, stessa partita.</small></div>
                        <button type="button" class="sc-switch ${view.profile.settings.reduceFx ? 'is-on' : ''}" data-action="toggle-fx" aria-pressed="${view.profile.settings.reduceFx}"><span></span></button>
                    </div>
                </section>

                <div class="sc-profile-footer">
                    <button type="button" class="sc-text-button" data-action="reset-stats">Azzera statistiche locali</button>
                </div>
                <p class="sc-fineprint">Sfida giornaliera di oggi: ${dailyChallengeKey()} · ${view.profile.daily.completed ? `completata, record ${view.profile.daily.bestScore ?? '—'}` : 'non ancora giocata'}.</p>
            </div>
        `;
    };

    const updateDraft = composition => {
        view.draft.composition = composition;
        rerender({ keepScroll: true });
    };

    const handleAction = async (action, target) => {
        switch (action) {
            case 'exit-taverna':
                await exitToTaverna();
                return;
            case 'play':
                startMatch({ difficulty: view.difficulty, mode: 'bot' });
                return;
            case 'level': {
                const level = target.dataset.value;
                if (!isBotDifficulty(level)) return;
                view.difficulty = level;
                view.shareSeed = Math.floor(Math.random() * 0xffffffff) >>> 0;
                rerender({ keepScroll: true });
                return;
            }
            case 'daily':
                startDaily();
                return;
            case 'friend':
                openSheet('friend');
                return;
            case 'rules':
                openSheet('rules');
                return;
            case 'sound': {
                view.profile = updateScippoSettings(view.profile, { sound: !view.profile.settings.sound });
                audio.setMuted(!view.profile.settings.sound);
                if (view.profile.settings.sound) audio.play('select');
                rerender({ keepScroll: true });
                return;
            }
            case 'profile':
                view.screen = 'profile';
                rerender();
                return;
            case 'deck':
                view.draft = {
                    composition: { ...(view.match ? view.matchDeck : getActiveComposition(view.profile)) },
                    name: ''
                };
                view.screen = 'deck';
                rerender();
                return;
            case 'home':
                goHome({ confirmAbandon: target.dataset.confirm === '1' });
                return;
            case 'select':
                selectCard(target.dataset.card);
                return;
            case 'rematch':
                startMatch({
                    difficulty: view.difficulty,
                    mode: view.mode,
                    seed: view.mode === 'bot' ? undefined : view.match?.seed,
                    composition: view.matchDeck
                });
                return;
            case 'fullscreen':
                try {
                    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
                    else await document.exitFullscreen();
                } catch {
                    showToast('Schermo intero non disponibile su questo browser.');
                }
                return;
            case 'copy-result': {
                if (!view.match) return;
                const line = `SCIPPO! ${view.match.scores[0]}-${view.match.scores[1]} contro il BOT ${levelName(view.difficulty)}. Rivincita? ${location.origin}/scippo`;
                const copied = await copyText(line);
                showToast(copied ? 'Risultato copiato.' : 'Copia non riuscita.');
                return;
            }
            case 'accept-challenge':
                startChallenge();
                return;
            case 'deck-inc':
            case 'deck-dec': {
                const card = target.dataset.card;
                if (!CARD_IDS.includes(card)) return;
                const delta = action === 'deck-inc' ? 1 : -1;
                const composition = { ...view.draft.composition };
                const min = card === 'jolly' ? 0 : 3;
                const max = card === 'jolly' ? 2 : 10;
                composition[card] = Math.max(min, Math.min(max, (composition[card] || 0) + delta));
                updateDraft(composition);
                return;
            }
            case 'deck-save': {
                const input = container.querySelector('#sc-deck-name');
                view.draft.name = input?.value || '';
                const result = saveDeck(view.profile, { name: view.draft.name, composition: view.draft.composition });
                view.profile = result.profile;
                if (result.error) showToast(result.error);
                else {
                    view.draft.name = '';
                    showToast(`Mazzo “${result.deck.name}” salvato e attivo.`);
                }
                rerender({ keepScroll: true });
                return;
            }
            case 'deck-use': {
                const deckId = target.dataset.deck;
                const result = setActiveDeck(view.profile, deckId);
                if (result.error) {
                    showToast(result.error);
                    return;
                }
                view.profile = result.profile;
                view.draft.composition = getActiveComposition(view.profile);
                showToast('Mazzo attivo aggiornato.');
                rerender({ keepScroll: true });
                return;
            }
            case 'deck-delete': {
                const deckId = target.dataset.deck;
                if (!window.confirm('Eliminare questo mazzo?')) return;
                view.profile = deleteDeck(view.profile, deckId);
                showToast('Mazzo eliminato.');
                rerender({ keepScroll: true });
                return;
            }
            case 'deck-reset': {
                view.draft.composition = { ...DEFAULT_DECK_COMPOSITION };
                showToast('Composizione standard ripristinata.');
                rerender({ keepScroll: true });
                return;
            }
            case 'deck-play': {
                const validation = validateDeckComposition(view.draft.composition);
                if (!validation.valid) {
                    showToast(validation.errors[0] || 'Mazzo non valido.');
                    return;
                }
                startMatch({ difficulty: view.difficulty, mode: 'bot', composition: validation.composition });
                return;
            }
            case 'toggle-sound': {
                view.profile = updateScippoSettings(view.profile, { sound: !view.profile.settings.sound });
                audio.setMuted(!view.profile.settings.sound);
                rerender({ keepScroll: true });
                return;
            }
            case 'toggle-fx':
                view.profile = updateScippoSettings(view.profile, { reduceFx: !view.profile.settings.reduceFx });
                rerender({ keepScroll: true });
                return;
            case 'reset-stats':
                if (!window.confirm('Azzerare tutte le statistiche di SCIPPO su questo dispositivo?')) return;
                view.profile = resetScippoStats(view.profile);
                showToast('Statistiche azzerate.');
                rerender({ keepScroll: true });
                return;
            default:
                return;
        }
    };

    const onClick = event => {
        if (event.target.classList?.contains('sc-sheet')) {
            event.target.remove();
            return;
        }
        const target = event.target.closest('[data-action]');
        if (!target || target.disabled) return;
        const action = target.dataset.action;
        if (!action || action.startsWith('sheet-')) return;
        event.preventDefault();
        void handleAction(action, target);
    };

    const onInput = event => {
        if (event.target.id === 'sc-deck-name') view.draft.name = event.target.value;
    };

    const cleanup = () => {
        if (view.disposed) return;
        view.disposed = true;
        clearTimers();
        clearChoiceTimer();
        clearTimeout(view.toastTimer);
        container.removeEventListener('click', onClick);
        container.removeEventListener('input', onInput);
        observer.disconnect();
        audio.dispose();
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        try { view.profile = syncDaily(view.profile); } catch { /* preferenze non bloccanti */ }
        if (window.__scippoCleanup === cleanup) window.__scippoCleanup = null;
    };

    container.addEventListener('click', onClick);
    container.addEventListener('input', onInput);
    const observer = new MutationObserver(() => {
        if (!container.querySelector('.scippo-app')) cleanup();
    });
    observer.observe(container, { childList: true });

    window.__scippoCleanup = cleanup;
    rerender();
}
