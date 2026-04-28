import { getPreference, setPreference } from './userPreferences.js';

const levelCache = new Map();
const prefKey = (gameName) => `levels.${gameName}`;

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

export function renderLevelLadder(gameName, containerElement, onLevelSelect, hydrated = false) {
    containerElement.innerHTML = '';
    const maxLevel = getUnlockedLevel(gameName);

    for (let i = maxLevel; i >= 1; i--) {
        const btn = document.createElement('button');
        btn.className = 'game-btn-action';
        btn.innerText = `LIVELLO ${i}`;
        btn.style.width = '100%';
        btn.style.marginBottom = '10px';
        btn.style.transition = 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)';
        btn.style.flexShrink = '0';

        if (i === maxLevel) {
            btn.style.background = 'var(--accent-gradient)';
            btn.style.border = 'none';
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 0 20px var(--amethyst-glow)';
            btn.style.zIndex = '2';
        } else {
            btn.style.opacity = '0.4';
            btn.style.background = 'rgba(255,255,255,0.02)';
            btn.style.border = '1px solid rgba(255,255,255,0.1)';
            btn.style.transform = 'scale(0.95)';
        }

        btn.onmouseenter = () => { if (i !== maxLevel) btn.style.opacity = '0.8'; };
        btn.onmouseleave = () => { if (i !== maxLevel) btn.style.opacity = '0.4'; };
        btn.onclick = (e) => {
            e.preventDefault();
            onLevelSelect(i);
        };

        containerElement.appendChild(btn);
    }

    if (!hydrated) hydrateLevel(gameName, containerElement, onLevelSelect);
}
