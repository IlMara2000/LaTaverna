export const LEVEL_WINDOW_SIZE = 5;
export const LEVEL_DIFFICULTY_STEP = 0.005;

export const normalizeLevel = (value) => {
    const level = Math.floor(Number(value));
    return Number.isFinite(level) && level > 0 ? level : 1;
};

export function getLevelWindow(maxLevel, windowSize = LEVEL_WINDOW_SIZE) {
    const normalizedMax = normalizeLevel(maxLevel);
    const normalizedWindow = Math.max(1, Math.floor(Number(windowSize)) || LEVEL_WINDOW_SIZE);
    const firstLevel = Math.max(1, normalizedMax - normalizedWindow + 1);
    return Array.from(
        { length: normalizedMax - firstLevel + 1 },
        (_, index) => firstLevel + index
    );
}

export function getLevelDifficultyChance(currentLevel, baseChance = 0, maxChance = 1) {
    const completedLevels = normalizeLevel(currentLevel) - 1;
    const chance = baseChance + (completedLevels * LEVEL_DIFFICULTY_STEP);
    return Math.min(maxChance, Math.max(0, chance));
}
