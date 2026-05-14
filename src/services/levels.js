import { getPreference, setPreference } from './userPreferences.js';

const levelCache = new Map();
const prefKey = (gameName) => `levels.${gameName}`;
const LEVEL_DIFFICULTY_STEP = 0.03;

export function getUnlockedLevel(gameName) {
    return levelCache.get(gameName) || 1;
}

async function hydrateLevel(gameName, containerElement, onLevelSelect) {
    const storedLevel = Number(await getPreference(prefKey(gameName), 1));
    const nextLevel = Number.isFinite(storedLevel) && storedLevel > 0 ? storedLevel : 1;
    if (nextLevel !== getUnlockedLevel(gameName)) {
        levelCache.set(gameName, nextLevel);
        renderLevelLadder(gameName, containerElement, onLevelSelect, true);
    }
}

export function unlockNextLevel(gameName, currentLevel) {
    const maxLevel = getUnlockedLevel(gameName);
    if (currentLevel >= maxLevel) {
        const nextLevel = currentLevel + 1;
        levelCache.set(gameName, nextLevel);
        setPreference(prefKey(gameName), nextLevel);
    }
}

export function getLevelDifficultyChance(currentLevel, baseChance = 0, maxChance = 0.95) {
    const level = Number(currentLevel);
    const completedLevels = Number.isFinite(level) && level > 1 ? Math.floor(level) - 1 : 0;
    const chance = baseChance + (completedLevels * LEVEL_DIFFICULTY_STEP);
    return Math.min(maxChance, Math.max(0, chance));
}

export function renderLevelLadder(gameName, containerElement, onLevelSelect, hydrated = false) {
    containerElement.innerHTML = '';
    const maxLevel = getUnlockedLevel(gameName);

    for (let i = maxLevel; i >= 1; i--) {
        const btn = document.createElement('button');
        btn.className = `game-btn-action game-level-button ${i === maxLevel ? 'active' : 'past'}`;
        btn.innerText = `LIVELLO ${i}`;
        btn.style.width = '100%';
        btn.style.marginBottom = '10px';
        btn.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
        btn.style.flexShrink = '0';
        btn.style.minHeight = '44px';

        if (i === maxLevel) {
            btn.style.background = 'linear-gradient(135deg, rgba(157, 78, 221, 0.82), rgba(104, 63, 197, 0.82))';
            btn.style.border = '1px solid rgba(255,255,255,0.16)';
            btn.style.transform = 'none';
            btn.style.boxShadow = '0 10px 28px rgba(0,0,0,0.32)';
            btn.style.zIndex = '2';
        } else {
            btn.style.opacity = '0.62';
            btn.style.background = 'rgba(255,255,255,0.045)';
            btn.style.border = '1px solid rgba(255,255,255,0.1)';
            btn.style.transform = 'none';
        }

        btn.onmouseenter = () => { if (i !== maxLevel) btn.style.opacity = '0.88'; };
        btn.onmouseleave = () => { if (i !== maxLevel) btn.style.opacity = '0.62'; };
        btn.onclick = (e) => {
            e.preventDefault();
            onLevelSelect(i);
        };

        containerElement.appendChild(btn);
    }

    if (!hydrated) hydrateLevel(gameName, containerElement, onLevelSelect);
}
