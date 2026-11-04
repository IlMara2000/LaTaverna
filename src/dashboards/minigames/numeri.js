import { renderOnlineModeButton, bindOnlineModeButton } from './onlineModeButton.js';
import { startOnlineParty } from './onlineParty.js';
import { setExperienceTheme } from '../../services/experienceTheme.js';
import { recordMinigameResult } from '../../services/minigameRecords.js';
import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { esc } from '../../services/communityUi.js';
import './party.css';

// ==========================================
// GIOCO: NUMERI — memorizza e ordina
// ==========================================

let gameData = {
    players: [],
    playerNumbers: [],
    round: 1,
    currentIndex: 0
};

export function initNumeri(container) {
    if (!container) return;
    try { updateSidebarContext('minigames'); } catch { /* Sidebar opzionale. */ }
    setExperienceTheme('numeri', 'experience');

    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = 'pan-y';
    window.scrollTo(0, 0);

    gameData.round = 1;
    renderSetup(container);
}

const quitGame = async container => {
    try {
        const { showMinigamesList } = await import('../../minigamelist.js');
        showMinigamesList(document.getElementById('app') || container);
    } catch { window.location.reload(); }
};

const header = () => `
    <div class="party-header">
        <button type="button" class="party-ghost party-back" id="quit-btn">← Libreria</button>
        <div class="party-brand"><span aria-hidden="true">🔢</span><div><small>LA TAVERNA</small><b>NUMERI</b></div></div>
    </div>`;

const createPlayerInputHTML = (value = '') => `
    <div class="party-row player-input-wrapper">
        <span class="party-index" aria-hidden="true">👤</span>
        <input type="text" class="party-input player-input" placeholder="Nome giocatore" value="${esc(value)}" aria-label="Nome giocatore">
        <button type="button" class="party-remove delete-player" aria-label="Rimuovi giocatore">✕</button>
    </div>`;

function renderSetup(container) {
    const initialPlayers = gameData.players.length > 0 ? gameData.players : ['', '', ''];

    container.innerHTML = `
    <div class="party-game"><div class="party-shell">
        ${header()}
        <div class="party-intro">
            <span class="party-eyebrow">MEMORIZZA · ORDINA · VINCI</span>
            <h1 class="party-title">Numeri</h1>
            <p class="party-subtitle">Ognuno riceve i propri numeri: memorizzali, poi rimettete i nomi in ordine dal più piccolo al più grande.</p>
        </div>
        ${renderOnlineModeButton('numeri')}
        <form class="party-panel" id="setup-form">
            <div class="party-panel-head"><b>GIOCATORI</b><span>da 2 a 8</span></div>
            <div class="party-field" id="inputs-area">${initialPlayers.map(name => createPlayerInputHTML(name)).join('')}</div>
            <button type="button" class="party-add" id="add-p">+ AGGIUNGI GIOCATORE</button>
            <button type="submit" class="party-primary" id="start-btn">INIZIA PARTITA</button>
        </form>
    </div></div>`;

    const stopOnline = bindOnlineModeButton(container, {
        gameId: 'numeri', gameName: 'Numeri', minPlayers: 2, maxPlayers: 8,
        onConnected: room => startOnlineParty(container, 'numeri', room, {})
    });
    container.querySelector('#quit-btn').onclick = () => quitGame(container);
    container.querySelector('#add-p').onclick = () => {
        container.querySelector('#inputs-area').insertAdjacentHTML('beforeend', createPlayerInputHTML(''));
    };
    container.querySelector('#inputs-area').onclick = event => {
        if (event.target.closest('.delete-player')) event.target.closest('.player-input-wrapper').remove();
    };
    container.querySelector('#setup-form').onsubmit = event => {
        event.preventDefault();
        stopOnline();
        const names = [...container.querySelectorAll('.player-input')].map(input => input.value.trim()).filter(Boolean);
        if (names.length < 2) { alert('Minimo 2 giocatori!'); return; }
        gameData.players = names;
        startNewRound(container);
    };
}

function startNewRound(container) {
    const pool = Array.from({ length: 100 }, (_, index) => index + 1);
    const selected = [];
    for (let index = 0; index < gameData.players.length * gameData.round; index += 1) {
        selected.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    gameData.playerNumbers = gameData.players.map((name, index) => ({
        name,
        numbers: selected.slice(index * gameData.round, (index + 1) * gameData.round).sort((a, b) => a - b)
    }));
    gameData.currentIndex = 0;
    renderReveal(container);
}

function renderReveal(container) {
    const player = gameData.playerNumbers[gameData.currentIndex];

    container.innerHTML = `
    <div class="party-game"><div class="party-shell">
        ${header()}
        <div class="party-turn">
            <span class="party-eyebrow">ROUND ${gameData.round} · ${gameData.currentIndex + 1}/${gameData.players.length}</span>
            <p class="party-reveal-note">PASSA IL TELEFONO A</p>
            <h1 class="party-turn-name">${esc(player.name)}</h1>
            <button type="button" class="party-reveal" id="reveal-box">
                <span class="party-reveal-note">TOCCA PER SCOPRIRE</span>
                <span id="reveal-text">I TUOI NUMERI</span>
            </button>
            <button type="button" class="party-primary" id="next-btn" hidden>HO MEMORIZZATO</button>
        </div>
    </div></div>`;

    container.querySelector('#quit-btn').onclick = () => quitGame(container);
    const box = container.querySelector('#reveal-box');
    box.onclick = () => {
        box.classList.add('is-open');
        container.querySelector('#reveal-text').innerHTML = `<span class="party-dots">${player.numbers.map(number => `<b>${number}</b>`).join('<i>·</i>')}</span>`;
        container.querySelector('#next-btn').hidden = false;
        box.onclick = null;
    };
    container.querySelector('#next-btn').onclick = () => {
        if (gameData.currentIndex < gameData.players.length - 1) {
            gameData.currentIndex += 1;
            renderReveal(container);
        } else {
            renderOrdering(container);
        }
    };
}

function renderOrdering(container) {
    container.innerHTML = `
    <div class="party-game"><div class="party-shell">
        ${header()}
        <div class="party-intro">
            <span class="party-eyebrow">ROUND ${gameData.round}</span>
            <h1 class="party-title">Ordina i nomi</h1>
            <p class="party-subtitle">Trascina i nomi dal numero più piccolo al più grande, poi conferma.</p>
        </div>
        <div class="party-panel">
            <ul id="sort-list" class="party-sortable">
                ${gameData.players.map((name, index) => `<li class="party-sort-item sortable-item" draggable="true" data-name="${esc(name)}"><span class="party-grip" aria-hidden="true">☰</span><span>${esc(name)}</span><span class="party-order">${index + 1}</span></li>`).join('')}
            </ul>
        </div>
        <button type="button" class="party-primary" id="check-btn">CONFERMA ORDINE</button>
    </div></div>`;

    container.querySelector('#quit-btn').onclick = () => quitGame(container);
    initSortable(container.querySelector('#sort-list'));
    container.querySelector('#check-btn').onclick = () => renderResult(container);
}

function initSortable(list) {
    let dragItem = null;
    const refreshOrder = () => [...list.querySelectorAll('.sortable-item')].forEach((item, index) => {
        const badge = item.querySelector('.party-order');
        if (badge) badge.textContent = String(index + 1);
    });
    const getTarget = y => {
        const items = [...list.querySelectorAll('.sortable-item:not(.dragging)')];
        return items.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset, element: child };
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    list.addEventListener('dragstart', event => {
        dragItem = event.target.closest('.sortable-item');
        dragItem?.classList.add('dragging');
    });
    list.addEventListener('dragend', () => {
        dragItem?.classList.remove('dragging');
        dragItem = null;
        refreshOrder();
    });
    list.addEventListener('dragover', event => {
        event.preventDefault();
        if (!dragItem) return;
        const after = getTarget(event.clientY);
        if (!after) list.appendChild(dragItem);
        else list.insertBefore(dragItem, after);
    });
    list.addEventListener('touchstart', event => {
        dragItem = event.target.closest('.sortable-item');
        dragItem?.classList.add('dragging');
    }, { passive: false });
    list.addEventListener('touchmove', event => {
        if (!dragItem) return;
        event.preventDefault();
        const after = getTarget(event.touches[0].clientY);
        if (!after) list.appendChild(dragItem);
        else list.insertBefore(dragItem, after);
    }, { passive: false });
    list.addEventListener('touchend', () => {
        dragItem?.classList.remove('dragging');
        dragItem = null;
        refreshOrder();
    });
}

function renderResult(container) {
    const userOrder = [...container.querySelectorAll('.sortable-item')].map(item => item.dataset.name);
    const sorted = gameData.playerNumbers
        .map(player => ({
            name: player.name,
            value: player.numbers.reduce((total, number) => total + number, 0) / player.numbers.length,
            numbers: player.numbers
        }))
        .sort((a, b) => a.value - b.value);
    const isCorrect = JSON.stringify(userOrder) === JSON.stringify(sorted.map(player => player.name));
    recordMinigameResult('numeri', isCorrect ? 'win' : 'loss', { score: gameData.round });

    container.innerHTML = `
    <div class="party-game"><div class="party-shell">
        ${header()}
        <div class="party-result">
            <span class="party-result-glyph" aria-hidden="true">${isCorrect ? '🏆' : '💀'}</span>
            <h1 class="party-result-title">${isCorrect ? 'Ordine perfetto!' : 'Ordine sbagliato'}</h1>
            <p class="party-subtitle">${isCorrect ? 'Avete ricordato tutti i numeri.' : 'Ecco l’ordine corretto, dal più piccolo al più grande.'}</p>
            <div class="party-summary">
                ${sorted.map((player, index) => `<div class="party-summary-row"><span>${index + 1}. ${esc(player.name)}</span><b>${player.numbers.join(' · ')}</b></div>`).join('')}
            </div>
            <div class="party-actions" style="width:100%">
                <button type="button" class="party-primary" id="next-r">PROSSIMO ROUND</button>
                <button type="button" class="party-ghost" id="quit">ESCI</button>
            </div>
        </div>
    </div></div>`;

    container.querySelector('#quit-btn').onclick = () => quitGame(container);
    container.querySelector('#next-r').onclick = () => { gameData.round += 1; startNewRound(container); };
    container.querySelector('#quit').onclick = () => quitGame(container);
}
