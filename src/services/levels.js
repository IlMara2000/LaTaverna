import { getPreference, setPreference } from './userPreferences.js';
import {
    getLevelDifficultyChance,
    getLevelWindow,
    LEVEL_DIFFICULTY_STEP,
    normalizeLevel
} from './levelProgression.js';

export {
    getLevelDifficultyChance,
    getLevelWindow,
    LEVEL_DIFFICULTY_STEP,
    LEVEL_WINDOW_SIZE
} from './levelProgression.js';

const levelCache = new Map();
const prefKey = (gameName) => `levels.${gameName}`;

export function getUnlockedLevel(gameName) {
    return levelCache.get(gameName) || 1;
}

async function hydrateLevel(gameName, containerElement, onLevelSelect) {
    const nextLevel = normalizeLevel(await getPreference(prefKey(gameName), 1));
    if (nextLevel !== getUnlockedLevel(gameName)) {
        levelCache.set(gameName, nextLevel);
        renderLevelLadder(gameName, containerElement, onLevelSelect, true);
    }
}

export function unlockNextLevel(gameName, currentLevel) {
    const maxLevel = getUnlockedLevel(gameName);
    const completedLevel = normalizeLevel(currentLevel);
    if (completedLevel >= maxLevel) {
        const nextLevel = completedLevel + 1;
        levelCache.set(gameName, nextLevel);
        setPreference(prefKey(gameName), nextLevel);
    }
}

export function renderLevelLadder(gameName, containerElement, onLevelSelect, hydrated = false) {
    containerElement.innerHTML = '';
    const maxLevel = getUnlockedLevel(gameName);
    const visibleLevels = getLevelWindow(maxLevel);
    containerElement.classList.add('game-level-ladder');
    containerElement.setAttribute(
        'aria-label',
        `Livelli disponibili dal ${visibleLevels[0]} al ${visibleLevels[visibleLevels.length - 1]}`
    );

    visibleLevels.forEach((level) => {
        const btn = document.createElement('button');
        const isCurrent = level === maxLevel;
        const difficultyIncrease = ((level - 1) * LEVEL_DIFFICULTY_STEP * 100).toFixed(1);
        btn.className = `game-level-button ${isCurrent ? 'active' : 'past'}`;
        btn.setAttribute('aria-label', `Livello ${level}, difficoltà aumentata del ${difficultyIncrease}%`);
        btn.innerHTML = `
            <span class="game-level-number">${level}</span>
            <span class="game-level-copy">
                <strong>LIVELLO ${level}</strong>
                <small>DIFFICOLTÀ +${difficultyIncrease}%</small>
            </span>
            <span class="game-level-state">${isCurrent ? 'ATTUALE' : 'RIGIOCA'}</span>
        `;
        btn.onclick = (e) => {
            e.preventDefault();
            onLevelSelect(level);
        };

        containerElement.appendChild(btn);
    });

    if (!hydrated) hydrateLevel(gameName, containerElement, onLevelSelect);
}
