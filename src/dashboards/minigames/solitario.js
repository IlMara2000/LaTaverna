import { renderOnlineModeButton, bindOnlineModeButton } from './onlineModeButton.js';
import { connectOnlineChallenge } from './onlineChallenge.js';
import { setExperienceTheme } from '../../services/experienceTheme.js';
import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import {
    SOLITAIRE_SUITS, createSolitaireGame, solitaireRankLabel, solitaireCardName,
    solitaireSourceCards, canMoveSolitaire, moveSolitaire, drawSolitaire, solitaireFoundationTarget
} from './solitarioEngine.js';
import './solitario.css';

export function initSolitario(container) {
    if (!container) return;
    try { updateSidebarContext('minigames'); } catch { /* Sidebar opzionale. */ }
    setExperienceTheme('solitario', 'experience');
    let state = createSolitaireGame();
    const online = { onlineMode: false };
    let challengeFinished = false;
    let selected = null;
    let history = [];
    let message = 'Scegli una carta, poi la colonna o la base di destinazione.';
    let disposed = false;
    let helpOpen = false;
    let focusBeforeHelp = null;

    container.innerHTML = `
        <section class="solitario-game fade-in" aria-label="Solitario Klondike">
            <div class="solitario-shell">
                <header class="solitario-topbar">
                    <button type="button" class="solitario-control" data-action="exit" aria-label="Esci dal Solitario">← <span>ESCI</span></button>
                    <div class="solitario-brand"><span aria-hidden="true">♠</span><div><small>LA TAVERNA</small><h1>SOLITARIO</h1></div></div>
                    <button type="button" class="solitario-control" data-action="help" aria-label="Come si gioca">?</button>
                </header>
                <div class="solitario-toolbar">
                    <div class="solitario-game-info"><strong>KLONDIKE</strong><span>52 carte da poker · pesca 1</span></div>
                    <div class="solitario-actions">
                        <button type="button" class="solitario-control" data-action="undo">↶ <span>Annulla</span></button>
                        <button type="button" class="solitario-control" data-action="foundation">↑ <span>Alla base</span></button>
                        <button type="button" class="solitario-control" data-action="restart">↻ <span>Nuova partita</span></button>
                    </div>
                </div>
                ${renderOnlineModeButton('solitario')}<div class="solitario-scoreline"><span id="solitario-moves">0 mosse</span><span id="solitario-progress">0 / 52 alle basi</span></div>
                <div class="solitario-message" id="solitario-status" role="status" aria-live="polite"></div>
                <main class="solitario-table" aria-label="Tavolo da gioco">
                    <div id="solitario-upper" class="solitario-upper"></div>
                    <div id="solitario-tableau" class="solitario-tableau" aria-label="Sette colonne"></div>
                </main>
                <p class="solitario-footer">Colonne: colori alternati, dal Re all’Asso. Basi: stesso seme, dall’Asso al Re.</p>
            </div>
            <div class="solitario-dialog-backdrop" id="solitario-help" hidden>
                <section class="solitario-dialog" role="dialog" aria-modal="true" aria-labelledby="solitario-help-title" tabindex="-1">
                    <button type="button" class="solitario-control solitario-close" data-action="close-help" aria-label="Chiudi le regole">×</button>
                    <span class="solitario-eyebrow">REGOLE RAPIDE</span><h2 id="solitario-help-title">IL TUO MOMENTO DI CALMA</h2>
                    <p>Usi tutte le <b>52 carte da poker</b>: A, 2–10, J, Q e K di cuori, quadri, fiori e picche.</p>
                    <ol>
                        <li><b>Completa le quattro basi.</b> Ciascuna raccoglie un seme, dall’Asso al Re.</li>
                        <li><b>Ordina le colonne.</b> Disponi le carte in ordine decrescente alternando rosso e nero. Puoi spostare anche una sequenza completa. Solo un Re può iniziare una colonna vuota.</li>
                        <li><b>Pesca dal mazzo.</b> Scopri una carta alla volta. Finito il mazzo, toccalo per riciclare gli scarti senza limiti.</li>
                        <li><b>Tocca per spostare.</b> Seleziona una carta e poi una colonna o una base evidenziata. “Alla base” sposta la carta selezionata quando possibile. Le carte coperte si girano automaticamente quando le liberi.</li>
                        <li><b>Ripensa una mossa.</b> “Annulla” recupera anche le pescate. Puoi riportare una carta dalla base alle colonne.</li>
                    </ol>
                    <p>Alcune distribuzioni possono bloccarsi: puoi annullare le mosse o iniziare una nuova partita.</p>
                    <button type="button" class="solitario-control solitario-primary" data-action="close-help">HO CAPITO</button>
                </section>
            </div>
        </section>`;
    const root = container.querySelector('.solitario-game');

    function render() {
        if (disposed) return;
        const focusedKey = root.contains(document.activeElement) ? document.activeElement?.dataset.focusKey : null;
        const movedCards = solitaireSourceCards(state, selected);
        const selectedIds = new Set(movedCards.map(card => card.id));
        const stockText = state.stock.length ? `Pesca una carta, ${state.stock.length} nel mazzo` : state.waste.length ? 'Ricicla gli scarti nel mazzo' : 'Mazzo vuoto';
        const waste = state.waste.at(-1);
        root.querySelector('#solitario-upper').innerHTML = `
            <section class="solitario-pile-wrap"><span class="solitario-pile-label">MAZZO <b>${state.stock.length}</b></span>
                <button type="button" class="solitario-card ${state.stock.length ? 'solitario-card-back' : 'solitario-slot'}" data-action="draw" data-focus-key="stock" aria-label="${stockText}" ${state.won || (!state.stock.length && !state.waste.length) ? 'disabled' : ''}>
                    <span aria-hidden="true">${state.stock.length ? '♠' : '↻'}</span>${state.stock.length ? '' : '<small>RICICLA</small>'}
                </button>
            </section>
            <section class="solitario-pile-wrap"><span class="solitario-pile-label">SCARTI <b>${state.waste.length}</b></span>
                ${waste ? renderCard(waste, { type: 'waste' }, selectedIds.has(waste.id)) : '<div class="solitario-card solitario-slot" aria-label="Scarti vuoti"><span aria-hidden="true">·</span></div>'}
            </section>
            <div class="solitario-upper-gap" aria-hidden="true"></div>
            ${SOLITAIRE_SUITS.map((suit, pile) => {
                const cards = state.foundations[pile];
                const top = cards.at(-1);
                const valid = canMoveSolitaire(state, selected, { type: 'foundation', pile });
                return `<section class="solitario-pile-wrap"><span class="solitario-pile-label">${suit.name.toUpperCase()}</span>
                    ${top ? renderCard(top, { type: 'foundation', pile }, selectedIds.has(top.id), valid) : `<button type="button" class="solitario-card solitario-slot ${valid ? 'is-target' : ''} ${suit.color === 'red' ? 'solitario-red' : ''}" data-target="foundation" data-pile="${pile}" data-focus-key="foundation-${pile}" aria-label="Base di ${suit.name}, vuota: inizia con un Asso"><span aria-hidden="true">${suit.symbol}</span><small>A → K</small></button>`}
                </section>`;
            }).join('')}`;
        root.querySelector('#solitario-tableau').innerHTML = state.tableau.map((cards, pile) => {
            const valid = canMoveSolitaire(state, selected, { type: 'tableau', pile });
            return `<section class="solitario-column ${valid ? 'is-target-column' : ''}" aria-label="Colonna ${pile + 1}, ${cards.length} carte" style="--pile-length:${Math.max(0, cards.length - 1)}">
                <span class="solitario-pile-label">${pile + 1}</span>
                <div class="solitario-column-cards">
                    ${cards.length ? cards.map((card, index) => card.faceUp
                        ? renderCard(card, { type: 'tableau', pile, index }, selectedIds.has(card.id), valid, index)
                        : `<div class="solitario-card solitario-card-back solitario-stacked" style="--card-position:${index}" aria-label="Carta coperta"><span aria-hidden="true">♠</span></div>`).join('')
                        : `<button type="button" class="solitario-card solitario-slot ${valid ? 'is-target' : ''}" data-target="tableau" data-pile="${pile}" data-focus-key="tableau-${pile}" aria-label="Colonna ${pile + 1} vuota: puoi mettere un Re"><span aria-hidden="true">K</span></button>`}
                </div>
            </section>`;
        }).join('');
        root.querySelector('#solitario-moves').textContent = `${state.moves} ${state.moves === 1 ? 'mossa' : 'mosse'}`;
        root.querySelector('#solitario-progress').textContent = `${state.foundations.reduce((sum, pile) => sum + pile.length, 0)} / 52 alle basi`;
        root.querySelector('#solitario-status').textContent = state.won ? 'Hai vinto! Tutte le 52 carte sono alle basi. Inizia una nuova partita per giocare ancora.' : message;
        root.querySelector('#solitario-status').classList.toggle('solitario-victory', state.won);
        root.querySelector('[data-action="undo"]').disabled = !history.length;
        root.querySelector('[data-action="foundation"]').disabled = !solitaireFoundationTarget(state, selected);
        root.classList.toggle('solitario-has-selection', Boolean(selected));
        if (focusedKey) {
            const sameButton = [...root.querySelectorAll('[data-focus-key]')].find(button => button.dataset.focusKey === focusedKey);
            if (sameButton) sameButton.focus({ preventScroll: true });
        }
    }

    function apply(next, status) {
        if (next === state) return false;
        history.push(state);
        state = next;
        selected = null;
        message = status;
        render();
        return true;
    }

    function moveTo(target) {
        if (!selected) return false;
        const card = solitaireSourceCards(state, selected)[0];
        if (apply(moveSolitaire(state, selected, target), `${solitaireCardName(card)} spostato ${target.type === 'foundation' ? 'alla base' : `nella colonna ${target.pile + 1}`}.`)) return true;
        message = target.type === 'foundation'
            ? 'La base richiede una carta dello stesso seme, in ordine dall’Asso al Re.'
            : 'Serve una carta di un valore inferiore e colore diverso. Una colonna vuota accetta solo un Re.';
        render();
        return false;
    }

    function select(source) {
        if (state.won) return;
        const same = selected && selected.type === source.type && selected.pile === source.pile && selected.index === source.index;
        if (same) {
            selected = null;
            message = 'Selezione annullata. Scegli una carta da spostare.';
        } else {
            const cards = solitaireSourceCards(state, source);
            if (!cards.length) return;
            selected = source;
            const validTargets = [...state.tableau.map((_, pile) => ({ type: 'tableau', pile })), ...state.foundations.map((_, pile) => ({ type: 'foundation', pile }))].some(target => canMoveSolitaire(state, source, target));
            message = `${solitaireCardName(cards[0])}${cards.length > 1 ? ` e ${cards.length - 1} carte al seguito` : ''}: ${validTargets ? 'scegli una destinazione evidenziata.' : 'nessuna destinazione disponibile. Scegli un’altra carta o pesca.'}`;
        }
        render();
    }

    function setHelp(open) {
        helpOpen = open;
        const overlay = root.querySelector('#solitario-help');
        if (open) focusBeforeHelp = document.activeElement;
        overlay.hidden = !open;
        root.querySelector('.solitario-shell').inert = open;
        if (open) overlay.querySelector('[data-action="close-help"]').focus();
        else if (focusBeforeHelp?.isConnected) focusBeforeHelp.focus();
    }

    function cleanup() {
        if (disposed) return;
        disposed = true;
        stopOnline();
        observer.disconnect();
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKeyDown);
        history = [];
    }

    async function leave() {
        cleanup();
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    }

    function onClick(event) {
        const button = event.target.closest('button');
        if (!button || !root.contains(button) || button.disabled) return;
        const action = button.dataset.action;
        if (action === 'exit') { void leave(); return; }
        if (action === 'help') { setHelp(true); return; }
        if (action === 'close-help') { setHelp(false); return; }
        if (online.onlineMode && (challengeFinished || !online.onlineReady || action === 'restart' || action === 'undo')) return;
        if (action === 'restart') {
            history = []; state = createSolitaireGame(); selected = null;
            message = 'Nuova partita. Porta tutte le carte alle quattro basi.'; render(); return;
        }
        if (action === 'undo' && history.length) {
            state = history.pop(); selected = null; message = 'Ultima mossa annullata.'; render(); return;
        }
        if (action === 'draw') {
            const recycling = !state.stock.length;
            const next = drawSolitaire(state);
            apply(next, recycling ? 'Scarti riciclati. Tocca il mazzo per pescare.' : `Hai pescato ${solitaireCardName(next.waste.at(-1))}.`); return;
        }
        if (action === 'foundation') {
            const target = solitaireFoundationTarget(state, selected);
            if (target) moveTo(target);
            return;
        }
        if (button.dataset.target) {
            if (selected) moveTo({ type: button.dataset.target, pile: Number(button.dataset.pile) });
            else { message = 'Seleziona prima la carta che vuoi spostare.'; render(); }
            return;
        }
        if (button.dataset.source) {
            const source = { type: button.dataset.source };
            if (button.dataset.pile !== undefined) source.pile = Number(button.dataset.pile);
            if (button.dataset.index !== undefined) source.index = Number(button.dataset.index);
            const isAnotherPile = selected && (selected.type !== source.type || selected.pile !== source.pile);
            if (isAnotherPile && source.type !== 'waste' && canMoveSolitaire(state, selected, { type: source.type, pile: source.pile })) {
                moveTo({ type: source.type, pile: source.pile });
            } else select(source);
        }
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            if (helpOpen) setHelp(false);
            else if (selected) { selected = null; message = 'Selezione annullata.'; render(); }
            return;
        }
        if (event.key !== 'Tab' || !helpOpen) return;
        const focusable = [...root.querySelector('#solitario-help').querySelectorAll('button:not([disabled])')];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    const stopOnline = bindOnlineModeButton(container, {
        gameId: 'solitario', gameName: 'Solitario', maxPlayers: 8,
        onConnected: room => {
            online.onlineMode = true;
            root.querySelector('.minigame-online-mode-panel').hidden = true;
            root.querySelector('#solitario-online-status').hidden = true;
            root.querySelector('[data-action="restart"]').hidden = true;
            root.querySelector('[data-action="undo"]').hidden = true;
            return connectOnlineChallenge(container, online, {
                gameId: 'solitario', room, create: () => createSolitaireGame(),
                start: initial => { state = structuredClone(initial); selected = null; history = []; render(); },
                result: () => ({score:state.foundations.reduce((sum, pile) => sum + pile.length,0), moves:state.moves, won:state.won, finished:state.won || challengeFinished}),
                finish: () => { challengeFinished = true; message = 'La tua sfida è conclusa. Attendi gli altri risultati.'; render(); }
            });
        }
    });
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    // Sidebar navigation can replace the page without using the game's exit button.
    const observer = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
    observer.observe(container, { childList: true });
    if (container.parentNode) observer.observe(container.parentNode, { childList: true });
    render();
    return cleanup;
}

function renderCard(card, source, selected = false, target = false, position = null) {
    const suit = SOLITAIRE_SUITS.find(entry => entry.id === card.suit);
    const rank = solitaireRankLabel(card.rank);
    const sourceData = `data-source="${source.type}"${source.pile === undefined ? '' : ` data-pile="${source.pile}"`}${source.index === undefined ? '' : ` data-index="${source.index}"`}`;
    const location = source.type === 'tableau' ? `colonna ${source.pile + 1}` : source.type === 'foundation' ? 'base' : 'scarti';
    return `<button type="button" class="solitario-card solitario-card-face ${suit.color === 'red' ? 'solitario-red' : ''} ${selected ? 'is-selected' : ''} ${target ? 'is-target' : ''} ${position === null ? '' : 'solitario-stacked'}" ${position === null ? '' : `style="--card-position:${position}"`} ${sourceData} data-focus-key="${card.id}" aria-pressed="${selected}" aria-label="${solitaireCardName(card)}, ${location}${selected ? ', selezionata' : ''}">
        <span class="solitario-card-corner" aria-hidden="true"><b>${rank}</b><i>${suit.symbol}</i></span>
        <span class="solitario-card-center" aria-hidden="true">${card.rank > 10 ? `<small>${rank === 'J' ? 'JACK' : rank === 'Q' ? 'DONNA' : 'RE'}</small>` : ''}${suit.symbol}</span>
        <span class="solitario-card-corner solitario-card-corner-bottom" aria-hidden="true"><b>${rank}</b><i>${suit.symbol}</i></span>
    </button>`;
}
