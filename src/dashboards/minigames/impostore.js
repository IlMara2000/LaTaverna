import { renderOnlineModeButton, bindOnlineModeButton } from './onlineModeButton.js';
import { startOnlineParty } from './onlineParty.js';
import { setExperienceTheme } from '../../services/experienceTheme.js';
import { updateSidebarContext } from '../../components/layout/Sidebar.js';
import { esc } from '../../services/communityUi.js';
import './party.css';

// ==========================================
// GIOCO: IMPOSTORE — chi bluffa?
// ==========================================

let gameData = {
    players: [],
    wordObj: { word: '', alt: '' },
    currentIndex: 0,
    config: { impostors: 1, undercover: 0 }
};

const WORDS_DATABASE = [
    { word: 'Pizza', alt: 'Focaccia' }, { word: 'Colosseo', alt: 'Arena' },
    { word: 'Calcio', alt: 'Calcetto' }, { word: 'Smartphone', alt: 'Tablet' },
    { word: 'Venezia', alt: 'Amsterdam' }, { word: 'Leone', alt: 'Tigre' },
    { word: 'Cinema', alt: 'Teatro' }, { word: 'Ferrari', alt: 'Lamborghini' },
    { word: 'Montagna', alt: 'Collina' }, { word: 'Caffè', alt: 'Tè' },
    { word: 'Vino', alt: 'Birra' }, { word: 'Aeroplano', alt: 'Elicottero' },
    { word: 'Spiaggia', alt: 'Scogliera' }, { word: 'Zaino', alt: 'Borsa' }
];

const ROLE_LABELS = { civil: 'CIVILE', undercover: 'UNDERCOVER', impostor: 'IMPOSTORE' };

export function initImpostore(container) {
    if (!container) return;
    try { updateSidebarContext('minigames'); } catch { /* Sidebar opzionale. */ }
    setExperienceTheme('impostore', 'experience');

    document.body.style.overflowX = 'hidden';
    document.body.style.overflowY = 'auto';
    document.body.style.touchAction = 'pan-y';
    window.scrollTo(0, 0);

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
        <div class="party-brand"><span aria-hidden="true">🕵️</span><div><small>LA TAVERNA</small><b>IMPOSTORE</b></div></div>
    </div>`;

const createPlayerInputHTML = (value = '') => `
    <div class="party-row player-input-wrapper">
        <span class="party-index" aria-hidden="true">👤</span>
        <input type="text" class="party-input player-input" placeholder="Nome giocatore" value="${esc(value)}" aria-label="Nome giocatore">
        <button type="button" class="party-remove delete-player" aria-label="Rimuovi giocatore">✕</button>
    </div>`;

const stepper = (id, label, value, min) => `
    <div class="party-stepper">
        <span>${label}</span>
        <div class="party-stepper-controls">
            <button type="button" data-step="${id}" data-delta="-1" aria-label="Diminuisci ${label}">−</button>
            <input type="number" id="${id}" value="${value}" min="${min}" aria-label="${label}">
            <button type="button" data-step="${id}" data-delta="1" aria-label="Aumenta ${label}">+</button>
        </div>
    </div>`;

function renderSetup(container) {
    const playersNames = gameData.players.length > 0 ? gameData.players.map(player => player.name) : ['', '', ''];

    container.innerHTML = `
    <div class="party-game"><div class="party-shell">
        ${header()}
        <div class="party-intro">
            <span class="party-eyebrow">LOCAL PARTY MODE</span>
            <h1 class="party-title">Impostore</h1>
            <p class="party-subtitle">Tutti conoscono la parola segreta tranne l’impostore. Discutete, votate e scoprite chi sta bluffando.</p>
        </div>
        ${renderOnlineModeButton('impostore')}
        <form class="party-panel" id="setup-form">
            <div class="party-panel-head"><b>RUOLI</b><span>almeno 3 giocatori</span></div>
            ${stepper('num-imp', '🕵️ Impostori', gameData.config.impostors, 1)}
            ${stepper('num-und', '🕶️ Undercover', gameData.config.undercover, 0)}
            <div class="party-panel-head"><b>GIOCATORI</b><span>da 3 a 8</span></div>
            <div class="party-field" id="inputs-area">${playersNames.map(name => createPlayerInputHTML(name)).join('')}</div>
            <button type="button" class="party-add" id="add-p">+ AGGIUNGI GIOCATORE</button>
            <button type="submit" class="party-primary" id="start-btn">INIZIA PARTITA</button>
        </form>
    </div></div>`;

    const stopOnline = bindOnlineModeButton(container, {
        gameId: 'impostore', gameName: 'Impostore', minPlayers: 3, maxPlayers: 8,
        onConnected: room => startOnlineParty(container, 'impostore', room, {
            impostors: Number(container.querySelector('#num-imp').value) || 1,
            undercover: Number(container.querySelector('#num-und').value) || 0
        })
    });
    container.querySelector('#quit-btn').onclick = () => quitGame(container);
    container.querySelector('#add-p').onclick = () => {
        container.querySelector('#inputs-area').insertAdjacentHTML('beforeend', createPlayerInputHTML(''));
    };
    container.querySelector('#inputs-area').onclick = event => {
        if (event.target.closest('.delete-player')) event.target.closest('.player-input-wrapper').remove();
    };
    container.querySelectorAll('[data-step]').forEach(button => {
        button.onclick = () => {
            const input = container.querySelector(`#${button.dataset.step}`);
            const min = Number(input.min) || 0;
            const next = (Number(input.value) || 0) + Number(button.dataset.delta);
            input.value = String(Math.max(min, next));
        };
    });
    container.querySelector('#setup-form').onsubmit = event => {
        event.preventDefault();
        stopOnline();
        const names = [...container.querySelectorAll('.player-input')].map(input => input.value.trim()).filter(Boolean);
        if (names.length < 3) { alert('Servono almeno 3 giocatori!'); return; }

        let impostors = parseInt(container.querySelector('#num-imp').value, 10) || 1;
        let undercover = parseInt(container.querySelector('#num-und').value, 10) || 0;
        const maxSpecial = names.length - 1;

        if (impostors + undercover > maxSpecial) {
            impostors = 1;
            undercover = Math.max(0, maxSpecial - 1);
            alert(`Auto-bilanciamento: 🕵️ ${impostors} | 🕶️ ${undercover}`);
        }

        gameData.config.impostors = impostors;
        gameData.config.undercover = undercover;
        setupRoles(names, impostors, undercover);
        startNewRound(container);
    };
}

function setupRoles(names, impostors, undercover) {
    gameData.players = names.map(name => ({ name, role: 'civil' }));
    const indexes = [...Array(names.length).keys()].sort(() => Math.random() - 0.5);
    for (let index = 0; index < impostors; index += 1) gameData.players[indexes.pop()].role = 'impostor';
    for (let index = 0; index < undercover; index += 1) gameData.players[indexes.pop()].role = 'undercover';
    gameData.wordObj = WORDS_DATABASE[Math.floor(Math.random() * WORDS_DATABASE.length)];
}

function rotateStartingPlayer() {
    if (gameData.players.length <= 1) return;
    const startIndex = Math.floor(Math.random() * gameData.players.length);
    gameData.players = [...gameData.players.slice(startIndex), ...gameData.players.slice(0, startIndex)];
}

function startNewRound(container) {
    rotateStartingPlayer();
    gameData.currentIndex = 0;
    renderReveal(container);
}

function renderReveal(container) {
    const player = gameData.players[gameData.currentIndex];

    container.innerHTML = `
    <div class="party-game"><div class="party-shell">
        ${header()}
        <div class="party-turn">
            <span class="party-eyebrow">${gameData.currentIndex + 1}/${gameData.players.length} · PAROLA SEGRETA</span>
            <p class="party-reveal-note">PASSA IL TELEFONO A</p>
            <h1 class="party-turn-name">${esc(player.name)}</h1>
            <button type="button" class="party-reveal" id="reveal-box">
                <span class="party-reveal-note">TOCCA PER SCOPRIRE</span>
                <span id="reveal-text">IL TUO RUOLO</span>
            </button>
            <button type="button" class="party-primary" id="next-btn" hidden>HO VISTO</button>
        </div>
    </div></div>`;

    container.querySelector('#quit-btn').onclick = () => quitGame(container);
    const box = container.querySelector('#reveal-box');
    box.onclick = () => {
        let content = '';
        if (player.role === 'impostor') {
            content = `<span class="party-reveal-value is-red">SEI L’IMPOSTORE</span>`;
        } else if (player.role === 'undercover') {
            content = `<span class="party-reveal-note">SEI UNDERCOVER</span><span class="party-reveal-value is-gold">${esc(gameData.wordObj.alt.toUpperCase())}</span>`;
        } else {
            content = `<span class="party-reveal-note">SEI CIVILE</span><span class="party-reveal-value">${esc(gameData.wordObj.word.toUpperCase())}</span>`;
        }
        box.classList.add('is-open');
        container.querySelector('#reveal-text').innerHTML = content;
        container.querySelector('#next-btn').hidden = false;
        box.onclick = null;
    };
    container.querySelector('#next-btn').onclick = () => {
        if (gameData.currentIndex < gameData.players.length - 1) {
            gameData.currentIndex += 1;
            renderReveal(container);
        } else {
            renderGameField(container);
        }
    };
}

function renderGameField(container) {
    container.innerHTML = `
    <div class="party-game"><div class="party-shell">
        ${header()}
        <div class="party-intro">
            <span class="party-eyebrow">DISCUSSIONE</span>
            <h1 class="party-title">Chi è l’impostore?</h1>
            <p class="party-subtitle">A turno ognuno dice una parola legata al tema. Poi votate chi vi sembra fuori posto.</p>
        </div>
        <div class="party-panel">
            <div class="party-panel-head"><b>GIOCATORI</b><span>tocca SVELA per il ruolo</span></div>
            <div class="party-list">
                ${gameData.players.map((player, index) => `
                    <div class="party-list-item">
                        <span>${esc(player.name)}</span>
                        <button type="button" class="party-ghost vote-btn" data-idx="${index}" style="width:auto;padding:8px 14px">SVELA</button>
                    </div>`).join('')}
            </div>
        </div>
        <div class="party-panel" id="guess-panel" hidden>
            <div class="party-panel-head"><b>ULTIMA CHANCE</b><span>l’impostore può indovinare</span></div>
            <p class="party-subtitle" style="text-align:left">Se l’impostore indovina la parola segreta, vince comunque.</p>
            <input type="text" id="guess-input" class="party-input" placeholder="Qual era la parola?">
            <button type="button" class="party-primary" id="guess-btn">CONFERMA</button>
        </div>
        <div class="party-actions">
            <button type="button" class="party-ghost" id="end-btn">RISULTATI FINALI</button>
        </div>
    </div></div>`;

    container.querySelector('#quit-btn').onclick = () => quitGame(container);
    container.querySelectorAll('.vote-btn').forEach(button => {
        button.onclick = () => {
            const player = gameData.players[button.dataset.idx];
            const row = button.closest('.party-list-item');
            row.innerHTML = `<span>${esc(player.name)}</span><span class="party-role is-${player.role}">${ROLE_LABELS[player.role]}</span>`;
            if (player.role === 'impostor') {
                container.querySelector('#guess-panel').hidden = false;
                container.querySelector('#end-btn').hidden = true;
            }
        };
    });
    container.querySelector('#guess-btn').onclick = () => {
        const guess = container.querySelector('#guess-input').value.trim().toLowerCase();
        renderResult(container, guess === gameData.wordObj.word.toLowerCase());
    };
    container.querySelector('#end-btn').onclick = () => renderResult(container, null);
}

function renderResult(container, impostorWon) {
    const summary = gameData.players.map(player => `
        <div class="party-summary-row">
            <span>${esc(player.name)}</span>
            <span class="party-role is-${player.role}">${ROLE_LABELS[player.role]}</span>
        </div>`).join('');

    container.innerHTML = `
    <div class="party-game"><div class="party-shell">
        ${header()}
        <div class="party-result">
            <span class="party-result-glyph" aria-hidden="true">${impostorWon === true ? '💀' : '🏆'}</span>
            <h1 class="party-result-title">${impostorWon === true ? 'L’impostore vince!' : 'Civili vittoriosi!'}</h1>
            <p class="party-subtitle">${impostorWon === true ? 'Ha indovinato la parola segreta.' : 'L’impostore è stato smascherato.'}</p>
            <div class="party-summary">${summary}</div>
            <p class="party-word">Parola segreta: <b>${esc(gameData.wordObj.word)}</b></p>
            <div class="party-actions" style="width:100%">
                <button type="button" class="party-primary" id="replay">NUOVO ROUND</button>
                <button type="button" class="party-ghost" id="quit">ESCI</button>
            </div>
        </div>
    </div></div>`;

    container.querySelector('#quit-btn').onclick = () => quitGame(container);
    container.querySelector('#replay').onclick = () => {
        setupRoles(gameData.players.map(player => player.name), gameData.config.impostors, gameData.config.undercover);
        startNewRound(container);
    };
    container.querySelector('#quit').onclick = () => quitGame(container);
}
