import './scippo.css';
import './scippo2.css';
import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { setExperienceTheme } from '../../services/experienceTheme.js';
import { createScippoAudio } from '../../services/scippoAudio.js';
import {
    CARD_IDS,
    CARD_TYPES,
    DEFAULT_DECK_COMPOSITION,
    SCIPPO_MULTIPLIER,
    deckCompositionLabel,
    deckTotal,
    createMatch,
    createRng,
    advanceMatch,
    cardVictoryLine,
    effectiveBottino,
    outcomeForSeat,
    playCard,
    scippoAvailable,
    validateDeckComposition,
    REGULATION_TURNS
} from '../../services/scippoEngine.js';
import { SCIPPO_BOT_LEVELS, chooseBotMove, isBotDifficulty } from '../../services/scippoBot.js';
import { mascotForOutcome, mascotForTurn, scippoMascot } from './scippoArt.js';
import { pickMessage, resetMessageMemory, resultMessage } from './scippoMessages.js';
import { shareScippoResult } from './scippoShare.js';
import { renderCantina, renderQuaderno, renderQuadernoEntry } from './scippoQuaderno.js';
import {
    CANTINA_COPY,
    canPersistQuaderno,
    chooseCantina,
    isDrunkDeck,
    isMisspelledDeckName,
    isWitchingHour,
    loadQuaderno,
    noteQuadernoVisit,
    openCantina,
    parseChallengeCode,
    quadernoProgress,
    registerEgg,
    saveQuaderno
} from '../../services/scippoSecret.js';
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

const vibrate = pattern => {
    try { navigator.vibrate?.(pattern); } catch { /* feedback non disponibile */ }
};

function installScippoChrome() {
    const head = document.head;
    const previousTitle = document.title;
    const theme = document.querySelector('meta[name="theme-color"]');
    const previousTheme = theme?.getAttribute('content') || '';
    const icon = document.querySelector('link[rel="icon"]');
    const manifest = document.querySelector('link[rel="manifest"]');
    const previousIcon = icon?.getAttribute('href') || '';
    const previousIconType = icon?.getAttribute('type') || '';
    const previousManifest = manifest?.getAttribute('href') || '';
    const created = [];

    document.documentElement.classList.add('scippo-shell');
    document.body.classList.add('scippo-shell-body');
    document.title = 'SCIPPO! — il gioco di carte più sbagliato del tavolo';
    theme?.setAttribute('content', '#08070b');

    if (icon) {
        icon.setAttribute('href', '/assets/games/scippo-icon.svg');
        icon.setAttribute('type', 'image/svg+xml');
    } else {
        const next = document.createElement('link');
        next.rel = 'icon';
        next.type = 'image/svg+xml';
        next.href = '/assets/games/scippo-icon.svg';
        head.appendChild(next);
        created.push(next);
    }

    if (manifest) {
        manifest.setAttribute('href', '/assets/games/scippo-manifest.json');
    } else {
        const next = document.createElement('link');
        next.rel = 'manifest';
        next.href = '/assets/games/scippo-manifest.json';
        head.appendChild(next);
        created.push(next);
    }

    return () => {
        document.documentElement.classList.remove('scippo-shell');
        document.body.classList.remove('scippo-shell-body');
        document.title = previousTitle;
        if (previousTheme) theme?.setAttribute('content', previousTheme);
        if (icon) {
            if (previousIcon) icon.setAttribute('href', previousIcon);
            if (previousIconType) icon.setAttribute('type', previousIconType);
            else icon.removeAttribute('type');
        }
        if (manifest && previousManifest) manifest.setAttribute('href', previousManifest);
        created.forEach(node => node.remove());
    };
}

function challengeFromUrl() {
    try {
        return parseChallengeCode(new URLSearchParams(location.search).get('sfida') || '');
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
    const restoreChrome = installScippoChrome();

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
        sessionMatches: 0,
        exitRegrets: 0,
        scippoArmed: false,
        lastOutcome: null,
        disposed: false,
        toast: null,
        toastTimer: null,
        quaderno: loadQuaderno(),
        quadernoCanPersist: canPersistQuaderno(),
        quadernoPlain: false,
        cantinaOpen: false,
        cantinaStage: 'table'
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

    /**
     * Il toast vive nello stato, non solo nel DOM: `rerender()` sostituisce
     * innerHTML di .scippo-app, quindi un nodo appeso lì muore al ridisegno
     * successivo. Tenendolo in `view.toast` lo rimette ogni render.
     */
    const showToast = message => {
        view.toast = message;
        container.querySelector('.sc-toast')?.remove();
        const app = container.querySelector('.scippo-app');
        if (app) {
            const toast = document.createElement('p');
            toast.className = 'sc-toast';
            toast.setAttribute('role', 'status');
            toast.textContent = message;
            app.appendChild(toast);
        }
        clearTimeout(view.toastTimer);
        view.toastTimer = setTimeout(() => {
            view.toast = null;
            container.querySelector('.sc-toast')?.remove();
        }, 2400);
    };

    /**
     * Segna uno sbaglio sul Quaderno. Ritorna true solo la prima volta, così
     * gli easter egg non si pagano due volte e non interrompono la partita.
     */
    const awardEgg = (eggId, message = CANTINA_COPY.eggFound) => {
        const result = registerEgg(view.quaderno, eggId);
        if (!result.added) return false;
        view.quaderno = saveQuaderno(result.quaderno);
        view.quadernoCanPersist = canPersistQuaderno();
        audio.play('score');
        vibrate([8, 24, 8]);
        const progress = quadernoProgress(view.quaderno);
        showToast(`${message} QUADERNO ${progress.found}/${progress.total}.`);
        return true;
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
        selectCard(hand[Math.floor(Math.random() * hand.length)], { scippo: view.scippoArmed });
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
        view.exitRegrets = 0;
        view.lastOutcome = null;
        view.scippoArmed = false;
        view.botBusy = false;
        resetMessageMemory();
        rerender();
        startChoiceTimer();
    };

    const selectCard = (cardId, { scippo = view.scippoArmed } = {}) => {
        if (!view.match || view.match.phase !== 'choose' || view.match.pending[0]) return;
        const result = playCard(view.match, 0, cardId, { scippo });
        if (!result.ok) {
            showToast(result.error || 'Mossa non valida.');
            return;
        }
        view.match = result.match;
        view.scippoArmed = false;
        clearChoiceTimer();
        audio.play(scippo ? 'scippo' : 'select');
        if (scippo) {
            vibrate([18, 30, 55]);
            showToast('SCIPPATA confermata: tu rischi, tu incassi. Forse.');
        }
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
            const move = chooseBotMove({ match: view.match, seat: 1, difficulty: view.difficulty, rng });
            if (!move.card) return;
            const played = playCard(view.match, 1, move.card, { scippo: move.scippo });
            if (!played.ok) return;
            view.match = played.match;
            audio.play(move.scippo ? 'scippo' : 'play');
            rerender();
            if (view.match.phase === 'reveal') handleReveal();
        }, delay);
    };

    const triggerScippoFx = () => {
        const app = container.querySelector('.scippo-app');
        if (!app) return;
        app.classList.add('is-scippo-turn');
        const burst = document.createElement('div');
        burst.className = 'sc-scippo-burst';
        burst.setAttribute('aria-hidden', 'true');
        burst.innerHTML = `<strong>SCIPPOOOOO!</strong><span>${escapeHTML(pickMessage('scippo', Date.now()))}</span>`;
        app.appendChild(burst);
        later(() => {
            burst.remove();
            app.classList.remove('is-scippo-turn');
        }, 1450);
    };

    const handleReveal = () => {
        if (!view.match?.lastTurn) return;
        const { winnerSeat, scippo } = view.match.lastTurn;
        if (scippo) {
            audio.play('scippoHit');
            vibrate([40, 35, 90]);
            later(() => {
                audio.play(winnerSeat === 0 ? 'win' : winnerSeat === 1 ? 'lose' : 'draw');
            }, 280);
        } else {
            audio.play(winnerSeat === 0 ? 'win' : winnerSeat === 1 ? 'lose' : 'draw');
        }
        later(() => {
            if (winnerSeat === 0) audio.play('score');
        }, 240);
        rerender();
        if (scippo) triggerScippoFx();
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
        view.lastOutcome = outcome;
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
        view.sessionMatches += 1;
        if (view.sessionMatches === 7) {
            awardEgg('scontrino', 'SCONTRINO N. 7. TOTALE: ZERO.');
        }
    };

    const leaveForTaverna = ({ forfeit = false } = {}) => {
        if (forfeit && view.match && !view.match.finished) {
            view.profile = recordScippoMatch(view.profile, {
                outcome: 'loss',
                mode: 'bot',
                difficulty: view.difficulty,
                score: view.match.scores[0],
                match: view.match
            });
        }
        cleanup();
        window.location.assign('/');
    };

    const exitToTaverna = async () => {
        if (view.match && !view.match.finished) {
            openSheet('exit');
            return;
        }
        leaveForTaverna();
    };

    const goHome = () => {
        clearTimers();
        clearChoiceTimer();
        view.match = null;
        view.screen = 'home';
        view.scippoArmed = false;
        view.resultRecorded = false;
        rerender();
    };

    const startDaily = () => {
        const now = new Date();
        const daily = getDailyChallenge(now);
        startMatch({ difficulty: daily.difficulty, mode: 'daily', seed: daily.seed, composition: daily.composition });
        if (isWitchingHour(now)) {
            awardEgg('orario', 'ALLE TRE E TRENTATRÉ NON GI OCO. VA BENE, GI OCO.');
        }
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
                        <p><b>SCIPPATA:</b> una volta a partita puoi raddoppiare il bottino del turno. Se vinci incassi il doppio, se perdi lo regali doppio. In pareggio non incassa nessuno. Non si cumula.</p>
                        <p><b>Pareggio:</b> due carte uguali (anche JOLLY contro JOLLY): non incassa nessuno e il bottino non passa al turno dopo.</p>
                        <p><b>Spareggio:</b> se dopo 8 turni siete pari, si continua con le carte rimaste e bottino da 1 punto. Finiscono le carte? È pareggio, senza carte inventate.</p>
                    </div>
                    <button type="button" class="sc-button sc-button--primary" data-action="sheet-close">HO CAPITO</button>
                </div>
            `;
        }
        if (kind === 'scippo') {
            return `
                <div class="sc-sheet-panel sc-scippo-risk" role="dialog" aria-modal="true" aria-label="Conferma la SCIPPATA">
                    <header><strong>🫳 SCIPPOOOOO!</strong><button type="button" data-action="sheet-close" aria-label="Annulla">✕</button></header>
                    <p class="sc-sheet-copy">Il bottino di questo turno <b>raddoppia</b>. Vale per entrambi: se vinci incassi il doppio, se perdi l’avversario incassa il doppio. Se pareggiate, non incassa nessuno.</p>
                    <p class="sc-risk-note">Una sola SCIPPATA per partita. Non si cumula. Nessun rimborso se ti va male.</p>
                    <div class="sc-sheet-actions">
                        <button type="button" class="sc-button" data-action="sheet-close">RIPENSACI</button>
                        <button type="button" class="sc-button sc-button--scippo" data-action="scippo-confirm">SCIPPO! ×2</button>
                    </div>
                </div>
            `;
        }
        if (kind === 'exit') {
            return `
                <div class="sc-sheet-panel sc-exit-sheet" role="dialog" aria-modal="true" aria-label="Conferma uscita">
                    <header><strong>TE NE VAI DAVVERO?</strong><button type="button" data-action="exit-reconsider" aria-label="Resta">✕</button></header>
                    <p class="sc-exit-question">E LA DIGNITÀ?</p>
                    <p class="sc-sheet-copy">La partita è ancora aperta. Uscire ora vale come <b>sconfitta a tavolino</b> e la sconfitta finisce nelle statistiche. Il bottino resta al BOT, che non se lo merita.</p>
                    <div class="sc-sheet-actions">
                        <button type="button" class="sc-button sc-button--primary" data-action="exit-reconsider">RESTO A COMBATTERE</button>
                        <button type="button" class="sc-button sc-button--danger" data-action="exit-confirm">FUGGO ALLA TAVERNA</button>
                    </div>
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
                <p class="sc-fineprint">La sfida è asincrona: non è una stanza PvP in tempo reale. Nessun dato viene pubblicato automaticamente.</p>
            </div>
        `;
    };

    const renderScript = () => {
        const screen = view.screen === 'quaderno'
            ? view.cantinaOpen
                ? renderCantina({ quaderno: view.quaderno, stage: view.cantinaStage, plain: view.quadernoPlain })
                : renderQuaderno({ quaderno: view.quaderno, plain: view.quadernoPlain, canPersist: view.quadernoCanPersist })
            : view.screen === 'match' && view.match
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
                ${view.toast ? `<p class="sc-toast" role="status">${escapeHTML(view.toast)}</p>` : ''}
            </div>
        `;
    };

    const renderHome = () => {
        const daily = getDailyChallenge(new Date());
        const activeDeck = getActiveDeck(view.profile);
        const dailyDone = view.profile.daily.date === daily.key && view.profile.daily.completed;
        const challengeBanner = view.challenge ? `
            <section class="sc-challenge-banner" aria-label="Sfida ricevuta">
                <span class="sc-challenge-tag">${view.challenge.unknown ? 'TAVOLO SCONOSCIUTO' : 'SFIDA RICEVUTA'}</span>
                <strong>${view.challenge.unknown ? 'Non conosco questo tavolo. Mi sta simpatico.' : 'Stesso BOT, stesse carte.'}</strong>
                <p>${view.challenge.unknown
                    ? `Codice “${escapeHTML(view.challenge.requested)}” · scenario condiviso`
                    : `Difficoltà ${escapeHTML(levelName(view.challenge.difficulty))} · scenario condiviso`}</p>
                <button type="button" class="sc-button sc-button--primary" data-action="accept-challenge">ACCETTA LA SFIDA</button>
            </section>
        ` : '';

        return `
            <div class="sc-home">
                <header class="sc-chrome">
                    <button type="button" class="sc-chip sc-exit" data-action="exit-taverna" aria-label="Esci e torna alla Taverna">
                        <span aria-hidden="true">←</span> ESCI <span class="sc-exit-long">— TORNA ALLA TAVERNA</span>
                    </button>
                    <div class="sc-chrome-tools">
                        <button type="button" class="sc-icon-button" data-action="fullscreen" aria-label="Schermo intero">⛶</button>
                        <button type="button" class="sc-icon-button" data-action="rules" aria-label="Regole">?</button>
                        <button type="button" class="sc-icon-button" data-action="sound" aria-pressed="${view.profile.settings.sound}" aria-label="${view.profile.settings.sound ? 'Disattiva audio' : 'Attiva audio'}">${view.profile.settings.sound ? '🔊' : '🔇'}</button>
                    </div>
                </header>

                ${challengeBanner}

                <section class="sc-hero" aria-labelledby="scippo-title">
                    <div class="sc-hero-mascot">
                        ${scippoMascot('felice', 'is-home')}
                        <span class="sc-mascot-bubble">${view.profile.settings.taunts ? 'Tutto questo bottino e nessuno che lo guardi.' : 'Scegli una carta. Basta.'}</span>
                    </div>
                    <div class="sc-hero-copy">
                        <span class="sc-kicker">IL GIOCO DI CARTE PIÙ SBAGLIATO DEL TAVOLO</span>
                        <h1 id="scippo-title" class="sc-wordmark">SCIPPO<span class="sc-bang">!</span></h1>
                        <p class="sc-tagline">20 carte. 5 minuti. Un solo vincitore.</p>
                        <p class="sc-hero-hint">Bluffa, incassa, raddoppia il rischio. Una SCIPPATA può cambiare tutto.</p>
                    </div>
                </section>

                <section class="sc-start-panel">
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
                </section>

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
                            <strong>SCIPPA UN AMICO</strong>
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

                <section class="sc-scippo-explainer">
                    <span class="sc-scippo-explainer-icon" aria-hidden="true">🫳</span>
                    <div>
                        <strong>SCIPPATA: UNA A PARTITA.</strong>
                        <small>Raddoppia il bottino. Se perdi, l’avversario incassa il doppio. Se pareggi, non incassa nessuno.</small>
                    </div>
                </section>

                <section class="sc-deck-strip">
                    <span>MAZZO ATTIVO</span>
                    <strong>${escapeHTML(activeDeck.name)}</strong>
                    <small>${deckCompositionLabel(activeDeck.composition)}</small>
                    <button type="button" data-action="deck">MODIFICA</button>
                </section>

                ${renderQuadernoEntry(view.quaderno)}

                <p class="sc-rules-strip">
                    <span>👊 batte 🎭</span><span>🛡️ batte 👊</span><span>🎭 batte 🛡️</span><span>🃏 batte tutto</span>
                </p>
                <p class="sc-fineprint">BOT e sfide asincrone in questa build · nessun pay-to-win · statistiche salvate su questo dispositivo.</p>
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
        const taunts = view.profile.settings.taunts;
        if (revealed && match.lastTurn) {
            const { winnerSeat, points, scippo, plays } = match.lastTurn;
            const label = winnerSeat === 0 ? `BOTTINO TUO +${points}` : winnerSeat === 1 ? `BOTTINO AVVERSARIO +${points}` : 'PAREGGIO · BOTTINO SUL TAVOLO';
            const winningPlay = winnerSeat === null ? null : plays.find(play => play.seat === winnerSeat);
            const line = taunts
                ? (winnerSeat === null ? pickMessage('draw', match.turn + match.seed) : cardVictoryLine(winningPlay?.card))
                : '';
            return `<div class="sc-verdict ${winnerSeat === 0 ? 'is-good' : winnerSeat === 1 ? 'is-bad' : 'is-draw'}">
                ${scippo ? '<em class="sc-scippo-stamp">SCIPPATA ×2</em>' : ''}
                <strong>${label}</strong>
                ${line ? `<small>${escapeHTML(line)}</small>` : ''}
            </div>`;
        }
        const pot = effectiveBottino(match);
        const declared = Boolean(match.pendingScippo?.[0] || match.pendingScippo?.[1]);
        const text = match.pending[0]
            ? 'Carta coperta. Il BOT sceglie…'
            : declared
                ? `SCIPPATA attiva: bottino da ${pot} punti sul tavolo.`
                : `Bottino da ${match.bottino} ${match.bottino === 1 ? 'punto' : 'punti'}. Scegli una carta.`;
        return `<div class="sc-verdict is-waiting"><span>${text}</span></div>`;
    };

    const resultOverlay = () => {
        if (!view.match?.finished) return '';
        const outcome = outcomeForSeat(view.match, 0);
        const headline = outcome === 'win' ? 'SCIPPO LEGALE!' : outcome === 'loss' ? 'UMILIATO.' : 'PAREGGIO DI QI.';
        const subtitle = view.match.endReason === 'spareggio'
            ? 'Deciso allo spareggio.'
            : view.match.endReason === 'carte'
                ? 'Carte finite: nessuno prevale.'
                : view.match.endReason === 'punti'
                    ? 'Otto turni, conti chiusi.'
                    : 'Nessuno porta a casa il bottino.';
        const isDaily = view.mode === 'daily';
        const isChallenge = view.mode === 'challenge';
        const message = view.profile.settings.taunts
            ? resultMessage(outcome, view.match.seed + view.match.scores[0] + view.match.history.length)
            : '';
        const scippoTurns = view.match.history.filter(entry => entry.scippo).length;
        const topPot = view.match.history.reduce((max, entry) => Math.max(max, entry.points || 0), 0);
        return `
            <div class="sc-result-overlay">
                <section class="sc-result ${outcome === 'win' ? 'is-win' : outcome === 'loss' ? 'is-loss' : 'is-draw'}" role="dialog" aria-modal="true" aria-label="Risultato della partita">
                    <span class="sc-result-tag">${isDaily ? 'SFIDA GIORNALIERA' : isChallenge ? 'SFIDA CONDIVISA' : `BOT ${escapeHTML(levelName(view.difficulty).toUpperCase())}`}</span>
                    <div class="sc-result-mascot">${scippoMascot(mascotForOutcome(outcome), 'is-result')}</div>
                    <h2>${headline}</h2>
                    <p class="sc-final-score"><span>${view.match.scores[0]}</span><b>–</b><span>${view.match.scores[1]}</span></p>
                    ${message ? `<p class="sc-result-line">${escapeHTML(message)}</p>` : ''}
                    <p class="sc-result-sub">${subtitle}</p>
                    <div class="sc-result-stats">
                        <span><b>${view.match.history.length}</b> TURNI</span>
                        <span><b>${topPot}</b> BOTTINO MAX</span>
                        <span><b>${scippoTurns}</b> ${scippoTurns === 1 ? 'SCIPPATA' : 'SCIPPATE'}</span>
                    </div>
                    ${view.sessionMatches >= 7 ? `
                        <p class="sc-receipt" aria-label="Scontrino numero ${view.sessionMatches}: totale zero, ultima riga bruciata">
                            <span>SCONTRINO N. ${view.sessionMatches}</span>
                            <b>TOTALE: 0</b>
                            <em aria-hidden="true"></em>
                        </p>
                    ` : ''}
                    <div class="sc-result-actions">
                        <button type="button" class="sc-button sc-button--primary" data-action="rematch">RIVINCITA</button>
                        <button type="button" class="sc-button" data-action="share-result">CONDIVIDI L’UMILIAZIONE</button>
                        <button type="button" class="sc-button" data-action="home">TORNA ALLA HOME</button>
                    </div>
                </section>
            </div>
        `;
    };

    const renderMatch = () => {
        const match = view.match;
        const revealed = match.phase === 'reveal' || match.phase === 'over';
        const roundLabel = match.overtime ? `SPAREGGIO ${match.turn - match.maxTurns}` : `TURNO ${match.turn}/${match.maxTurns}`;
        const myTurn = match.phase === 'choose' && !match.pending[0];
        const pot = revealed && match.lastTurn
            ? match.lastTurn.bottino * (match.lastTurn.multiplier || 1)
            : effectiveBottino(match);
        const declared = revealed && match.lastTurn
            ? Boolean(match.lastTurn.scippo)
            : Boolean(match.pendingScippo?.[0] || match.pendingScippo?.[1]);
        const scippoLeft = scippoAvailable(match, 0);
        const armed = view.scippoArmed;
        const status = match.phase === 'choose'
            ? (match.pending[0] ? 'Carta coperta: aspetta la rivelazione.' : armed ? 'SCIPPATA armata: scegli la carta.' : 'Tocca a te: scegli una carta.')
            : 'Rivelazione…';
        const opponentMascot = mascotForTurn(revealed ? match.lastTurn : null, 1);
        const myMascot = mascotForTurn(revealed ? match.lastTurn : null, 0);

        return `
            <div class="sc-match">
                <header class="sc-match-top">
                    <button type="button" class="sc-chip sc-exit" data-action="exit-taverna" aria-label="Esci e torna alla Taverna"><span aria-hidden="true">←</span> ESCI <span class="sc-exit-long">— TORNA ALLA TAVERNA</span></button>
                    <span class="sc-round ${match.overtime ? 'is-overtime' : ''}">${roundLabel}</span>
                    <div class="sc-chrome-tools">
                        <button type="button" class="sc-icon-button" data-action="fullscreen" aria-label="Schermo intero">⛶</button>
                        <button type="button" class="sc-icon-button" data-action="sound" aria-pressed="${view.profile.settings.sound}" aria-label="${view.profile.settings.sound ? 'Disattiva audio' : 'Attiva audio'}">${view.profile.settings.sound ? '🔊' : '🔇'}</button>
                    </div>
                </header>

                <section class="sc-opponent" aria-label="Avversario">
                    <span class="sc-avatar sc-avatar--mascot" aria-hidden="true">${scippoMascot(opponentMascot, 'is-mini')}</span>
                    <div class="sc-opponent-copy">
                        <strong>${escapeHTML(levelName(view.difficulty).toUpperCase())}</strong>
                        <small>${match.hands[1].length + match.piles[1].length} carte rimaste</small>
                    </div>
                    <div class="sc-mini-hand" aria-hidden="true">
                        ${Array.from({ length: Math.max(0, match.hands[1].length) }, () => '<span></span>').join('')}
                    </div>
                    <div class="sc-score"><span>${match.scores[1]}</span><small>PUNTI</small></div>
                </section>

                <section class="sc-arena ${declared ? 'is-scippo-pot' : ''}" aria-label="Arena di gioco">
                    <div class="sc-bottino ${match.bottino === 3 || declared ? 'is-hot' : ''}">
                        <small>BOTTINO</small>
                        <strong>+${pot}</strong>
                        ${declared ? `<em class="sc-mult">×${SCIPPO_MULTIPLIER}</em>` : ''}
                    </div>
                    <div class="sc-duel">
                        ${slotMarkup()}
                    </div>
                    ${verdictMarkup()}
                    <p class="sc-sr-only" aria-live="polite">${status}</p>
                </section>

                <section class="sc-scippo-bar" aria-label="Scipata">
                    <button type="button" class="sc-scippo-button ${armed ? 'is-armed' : ''}" data-action="arm-scippo"
                        ${myTurn && scippoLeft ? '' : 'disabled'} aria-pressed="${armed}">
                        <span class="sc-scippo-hand" aria-hidden="true">🫳</span>
                        <span class="sc-scippo-copy">
                            <strong>${scippoLeft ? (armed ? 'SCIPPATA ARMATO' : 'SCIPPOOOOO!') : 'SCIPPATA USATA'}</strong>
                            <small>${scippoLeft ? (armed ? 'Scegli la carta: il rischio è già tuo.' : 'Raddoppia il bottino. Una volta a partita.') : 'Niente bis. Niente pietà.'}</small>
                        </span>
                        <em aria-hidden="true">×2</em>
                    </button>
                    ${armed ? '<button type="button" class="sc-scippo-cancel" data-action="cancel-scippo">ANNULLA</button>' : ''}
                </section>

                <section class="sc-me" aria-label="La tua mano">
                    <div class="sc-me-head">
                        <span class="sc-avatar sc-avatar--mascot is-me" aria-hidden="true">${scippoMascot(myMascot, 'is-mini')}</span>
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
                    <div class="sc-hand ${armed ? 'is-armed' : ''}" role="group" aria-label="Carte in mano">
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
                    <div class="sc-chrome-tools">
                        <button type="button" class="sc-chip sc-exit" data-action="exit-taverna" aria-label="Esci e torna alla Taverna">ESCI</button>
                        <button type="button" class="sc-icon-button" data-action="fullscreen" aria-label="Schermo intero">⛶</button>
                        <button type="button" class="sc-icon-button" data-action="sound" aria-label="Audio">${view.profile.settings.sound ? '🔊' : '🔇'}</button>
                    </div>
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
                    <!-- La quinta riga non esiste: sta in zero pixel e compare
                         solo quando la si raggiunge da tastiera. -->
                    <div class="sc-deck-row sc-deck-row--ghost">
                        <span class="sc-deck-swatch" aria-hidden="true">🂠</span>
                        <div class="sc-deck-info">
                            <strong>?</strong>
                            <small>carta non prevista dal regolamento</small>
                        </div>
                        <div class="sc-stepper" role="group" aria-label="carta non prevista dal regolamento">
                            <output aria-live="polite">0</output>
                            <button type="button" data-action="deck-ghost" aria-label="carta non prevista dal regolamento, quantità zero">+</button>
                        </div>
                    </div>
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
                    <div class="sc-chrome-tools">
                        <button type="button" class="sc-chip sc-exit" data-action="exit-taverna" aria-label="Esci e torna alla Taverna">ESCI</button>
                        <button type="button" class="sc-icon-button" data-action="fullscreen" aria-label="Schermo intero">⛶</button>
                        <button type="button" class="sc-icon-button" data-action="sound" aria-label="Audio">${view.profile.settings.sound ? '🔊' : '🔇'}</button>
                    </div>
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
                    <div class="sc-setting-row">
                        <div><strong>Provocazioni</strong><small>Battute e meme durante la partita.</small></div>
                        <button type="button" class="sc-switch ${view.profile.settings.taunts ? 'is-on' : ''}" data-action="toggle-taunts" aria-pressed="${view.profile.settings.taunts}"><span></span></button>
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
            case 'quaderno':
                view.quaderno = saveQuaderno(noteQuadernoVisit(view.quaderno));
                view.quadernoCanPersist = canPersistQuaderno();
                view.cantinaOpen = false;
                view.screen = 'quaderno';
                rerender();
                return;
            case 'quaderno-close':
                view.cantinaOpen = false;
                view.screen = 'home';
                rerender();
                return;
            case 'quaderno-card':
                showToast(CANTINA_COPY.notYourTurn);
                return;
            case 'quaderno-plain':
                view.quadernoPlain = !view.quadernoPlain;
                rerender({ keepScroll: true });
                return;
            case 'cantina-sit':
                if (!quadernoProgress(view.quaderno).complete) {
                    showToast(CANTINA_COPY.refusal);
                    return;
                }
                view.cantinaOpen = true;
                view.cantinaStage = view.quaderno.cantina === 'locked' ? 'table' : 'reveal';
                view.screen = 'quaderno';
                audio.play('select');
                rerender();
                return;
            case 'cantina-play':
                view.quaderno = saveQuaderno(openCantina(view.quaderno));
                view.cantinaStage = 'reveal';
                audio.play('reveal');
                later(() => audio.play('defeat'), 280);
                vibrate([12, 40, 70]);
                rerender({ keepScroll: true });
                return;
            case 'cantina-choose': {
                const mode = target.dataset.mode;
                if (mode !== 'write' && mode !== 'keep') return;
                view.quaderno = saveQuaderno(chooseCantina(view.quaderno, mode));
                audio.play(mode === 'write' ? 'scippo' : 'score');
                rerender({ keepScroll: true });
                return;
            }
            case 'cantina-back':
                view.cantinaOpen = false;
                view.screen = 'quaderno';
                rerender();
                return;
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
                goHome();
                return;
            case 'select':
                view.exitRegrets = 0;
                selectCard(target.dataset.card);
                return;
            case 'exit-reconsider':
                container.querySelector('.sc-sheet')?.remove();
                view.exitRegrets += 1;
                if (view.exitRegrets === 3) {
                    awardEgg('annulla', 'TRE VOLTE. TRE. VA BENE, TE LA DO.');
                }
                return;
            case 'arm-scippo':
                if (!view.match || !scippoAvailable(view.match, 0) || view.match.phase !== 'choose' || view.match.pending[0]) return;
                openSheet('scippo');
                return;
            case 'scippo-confirm':
                if (!view.match || !scippoAvailable(view.match, 0)) return;
                container.querySelector('.sc-sheet')?.remove();
                view.scippoArmed = true;
                audio.play('scippo');
                vibrate([15, 25, 40]);
                rerender({ keepScroll: true });
                showToast('SCIPPATA ARMATO: scegli la carta. Se perdi, l’avversario incassa il doppio.');
                return;
            case 'cancel-scippo':
                view.scippoArmed = false;
                rerender({ keepScroll: true });
                showToast('SCIPPATA annullata. Il bottino torna normale.');
                return;
            case 'exit-confirm':
                container.querySelector('.sc-sheet')?.remove();
                leaveForTaverna({ forfeit: true });
                return;
            case 'share-result': {
                if (!view.match?.finished) return;
                const outcome = outcomeForSeat(view.match, 0) || 'draw';
                try {
                    const result = await shareScippoResult({
                        outcome,
                        scores: view.match.scores,
                        modeLabel: view.mode === 'daily' ? 'SFIDA GIORNALIERA' : view.mode === 'challenge' ? 'SFIDA CONDIVISA' : `BOT ${levelName(view.difficulty).toUpperCase()}`,
                        message: view.profile.settings.taunts
                            ? resultMessage(outcome, view.match.seed + view.match.scores[0])
                            : 'Rivincita?',
                        url: `${location.origin}/scippo`,
                        scippo: view.match.history.some(entry => entry.scippo)
                    });
                    if (result.method === 'download') showToast('Cartolina scaricata. Ora fai vedere a tutti che non hai dignità.');
                    else if (result.method === 'share' || result.method === 'share-link') showToast('Condivisione aperta. Nessun post automatico.');
                } catch (error) {
                    console.warn('Condivisione SCIPPO non riuscita:', error);
                    showToast('Non riesco a creare la cartolina su questo browser.');
                }
                return;
            }
            case 'toggle-taunts':
                view.profile = updateScippoSettings(view.profile, { taunts: !view.profile.settings.taunts });
                rerender({ keepScroll: true });
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
            case 'accept-challenge':
                startChallenge();
                if (view.challenge?.unknown) {
                    awardEgg('tavolo', 'NON CONOSCO IL TAVOLO. GIOCACI LO STESSO.');
                }
                return;
            case 'deck-ghost':
                awardEgg('pulsante', 'NON ESISTE. È PER QUESTO CHE HA FUNZIONATO.');
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
                if (delta > 0 && isDrunkDeck(composition)) {
                    awardEgg('bilancia', 'LA BILANCIA È UBRIACA. HA PESATO TUTTO E DUE VOLTE.');
                }
                return;
            }
            case 'deck-save': {
                const input = container.querySelector('#sc-deck-name');
                view.draft.name = input?.value || '';
                const misspelled = isMisspelledDeckName(view.draft.name);
                const result = saveDeck(view.profile, { name: view.draft.name, composition: view.draft.composition });
                view.profile = result.profile;
                if (result.error) showToast(result.error);
                else {
                    view.draft.name = '';
                    showToast(`Mazzo “${result.deck.name}” salvato e attivo.`);
                }
                rerender({ keepScroll: true });
                if (!result.error && misspelled) awardEgg('refuso', 'MI HAI CHIAMATO MALE. UNA P. TI PERDONO UNA VOLTA.');
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

    const onKeydown = event => {
        if (event.key !== 'Escape' || view.screen !== 'quaderno') return;
        event.preventDefault();
        if (view.cantinaOpen) {
            view.cantinaOpen = false;
            view.screen = 'quaderno';
        } else {
            view.screen = 'home';
        }
        rerender();
    };

    const cleanup = () => {
        if (view.disposed) return;
        view.disposed = true;
        clearTimers();
        clearChoiceTimer();
        clearTimeout(view.toastTimer);
        container.removeEventListener('click', onClick);
        container.removeEventListener('input', onInput);
        document.removeEventListener('keydown', onKeydown);
        observer.disconnect();
        audio.dispose();
        restoreChrome();
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
        document.body.style.backgroundColor = '';
        try { view.profile = syncDaily(view.profile); } catch { /* preferenze non bloccanti */ }
        if (window.__scippoCleanup === cleanup) window.__scippoCleanup = null;
    };

    container.addEventListener('click', onClick);
    container.addEventListener('input', onInput);
    document.addEventListener('keydown', onKeydown);
    const observer = new MutationObserver(() => {
        if (!container.querySelector('.scippo-app')) cleanup();
    });
    observer.observe(container, { childList: true });

    window.__scippoCleanup = cleanup;
    rerender();
}
