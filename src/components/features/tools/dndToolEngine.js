export const ABILITIES = [
    { id: 'str', label: 'Forza', short: 'FOR' },
    { id: 'dex', label: 'Destrezza', short: 'DES' },
    { id: 'con', label: 'Costituzione', short: 'COS' },
    { id: 'int', label: 'Intelligenza', short: 'INT' },
    { id: 'wis', label: 'Saggezza', short: 'SAG' },
    { id: 'cha', label: 'Carisma', short: 'CAR' }
];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_COSTS = Object.freeze({
    8: 0,
    9: 1,
    10: 2,
    11: 3,
    12: 4,
    13: 5,
    14: 7,
    15: 9
});

export const CR_ROWS = [
    { cr: '0', value: 0, xp: 10, proficiency: 2, ac: 13, hp: [1, 6], attack: 3, dpr: [0, 1], saveDc: 13 },
    { cr: '1/8', value: 0.125, xp: 25, proficiency: 2, ac: 13, hp: [7, 35], attack: 3, dpr: [2, 3], saveDc: 13 },
    { cr: '1/4', value: 0.25, xp: 50, proficiency: 2, ac: 13, hp: [36, 49], attack: 3, dpr: [4, 5], saveDc: 13 },
    { cr: '1/2', value: 0.5, xp: 100, proficiency: 2, ac: 13, hp: [50, 70], attack: 3, dpr: [6, 8], saveDc: 13 },
    { cr: '1', value: 1, xp: 200, proficiency: 2, ac: 13, hp: [71, 85], attack: 3, dpr: [9, 14], saveDc: 13 },
    { cr: '2', value: 2, xp: 450, proficiency: 2, ac: 13, hp: [86, 100], attack: 3, dpr: [15, 20], saveDc: 13 },
    { cr: '3', value: 3, xp: 700, proficiency: 2, ac: 13, hp: [101, 115], attack: 4, dpr: [21, 26], saveDc: 13 },
    { cr: '4', value: 4, xp: 1100, proficiency: 2, ac: 14, hp: [116, 130], attack: 5, dpr: [27, 32], saveDc: 14 },
    { cr: '5', value: 5, xp: 1800, proficiency: 3, ac: 15, hp: [131, 145], attack: 6, dpr: [33, 38], saveDc: 15 },
    { cr: '6', value: 6, xp: 2300, proficiency: 3, ac: 15, hp: [146, 160], attack: 6, dpr: [39, 44], saveDc: 15 },
    { cr: '7', value: 7, xp: 2900, proficiency: 3, ac: 15, hp: [161, 175], attack: 6, dpr: [45, 50], saveDc: 15 },
    { cr: '8', value: 8, xp: 3900, proficiency: 3, ac: 16, hp: [176, 190], attack: 7, dpr: [51, 56], saveDc: 16 },
    { cr: '9', value: 9, xp: 5000, proficiency: 4, ac: 16, hp: [191, 205], attack: 7, dpr: [57, 62], saveDc: 16 },
    { cr: '10', value: 10, xp: 5900, proficiency: 4, ac: 17, hp: [206, 220], attack: 7, dpr: [63, 68], saveDc: 16 },
    { cr: '11', value: 11, xp: 7200, proficiency: 4, ac: 17, hp: [221, 235], attack: 8, dpr: [69, 74], saveDc: 17 },
    { cr: '12', value: 12, xp: 8400, proficiency: 4, ac: 17, hp: [236, 250], attack: 8, dpr: [75, 80], saveDc: 17 },
    { cr: '13', value: 13, xp: 10000, proficiency: 5, ac: 18, hp: [251, 265], attack: 8, dpr: [81, 86], saveDc: 18 },
    { cr: '14', value: 14, xp: 11500, proficiency: 5, ac: 18, hp: [266, 280], attack: 8, dpr: [87, 92], saveDc: 18 },
    { cr: '15', value: 15, xp: 13000, proficiency: 5, ac: 18, hp: [281, 295], attack: 8, dpr: [93, 98], saveDc: 18 },
    { cr: '16', value: 16, xp: 15000, proficiency: 5, ac: 18, hp: [296, 310], attack: 9, dpr: [99, 104], saveDc: 18 },
    { cr: '17', value: 17, xp: 18000, proficiency: 6, ac: 19, hp: [311, 325], attack: 10, dpr: [105, 110], saveDc: 19 },
    { cr: '18', value: 18, xp: 20000, proficiency: 6, ac: 19, hp: [326, 340], attack: 10, dpr: [111, 116], saveDc: 19 },
    { cr: '19', value: 19, xp: 22000, proficiency: 6, ac: 19, hp: [341, 355], attack: 10, dpr: [117, 122], saveDc: 19 },
    { cr: '20', value: 20, xp: 25000, proficiency: 6, ac: 19, hp: [356, 400], attack: 10, dpr: [123, 140], saveDc: 19 },
    { cr: '21', value: 21, xp: 33000, proficiency: 7, ac: 19, hp: [401, 445], attack: 11, dpr: [141, 158], saveDc: 20 },
    { cr: '22', value: 22, xp: 41000, proficiency: 7, ac: 19, hp: [446, 490], attack: 11, dpr: [159, 176], saveDc: 20 },
    { cr: '23', value: 23, xp: 50000, proficiency: 7, ac: 19, hp: [491, 535], attack: 11, dpr: [177, 194], saveDc: 20 },
    { cr: '24', value: 24, xp: 62000, proficiency: 7, ac: 19, hp: [536, 580], attack: 12, dpr: [195, 212], saveDc: 21 },
    { cr: '25', value: 25, xp: 75000, proficiency: 8, ac: 19, hp: [581, 625], attack: 12, dpr: [213, 230], saveDc: 21 },
    { cr: '26', value: 26, xp: 90000, proficiency: 8, ac: 19, hp: [626, 670], attack: 12, dpr: [231, 248], saveDc: 21 },
    { cr: '27', value: 27, xp: 105000, proficiency: 8, ac: 19, hp: [671, 715], attack: 13, dpr: [249, 266], saveDc: 22 },
    { cr: '28', value: 28, xp: 120000, proficiency: 8, ac: 19, hp: [716, 760], attack: 13, dpr: [267, 284], saveDc: 22 },
    { cr: '29', value: 29, xp: 135000, proficiency: 9, ac: 19, hp: [761, 805], attack: 13, dpr: [285, 302], saveDc: 22 },
    { cr: '30', value: 30, xp: 155000, proficiency: 9, ac: 19, hp: [806, 850], attack: 14, dpr: [303, 320], saveDc: 23 }
];

export const CR_OPTIONS = CR_ROWS.map(row => ({ value: row.cr, label: `GS ${row.cr}`, xp: row.xp }));

export const XP_THRESHOLDS = [
    [25, 50, 75, 100],
    [50, 100, 150, 200],
    [75, 150, 225, 400],
    [125, 250, 375, 500],
    [250, 500, 750, 1100],
    [300, 600, 900, 1400],
    [350, 750, 1100, 1700],
    [450, 900, 1400, 2100],
    [550, 1100, 1600, 2400],
    [600, 1200, 1900, 2800],
    [800, 1600, 2400, 3600],
    [1000, 2000, 3000, 4500],
    [1100, 2200, 3400, 5100],
    [1250, 2500, 3800, 5700],
    [1400, 2800, 4300, 6400],
    [1600, 3200, 4800, 7200],
    [2000, 3900, 5900, 8800],
    [2100, 4200, 6300, 9500],
    [2400, 4900, 7300, 10900],
    [2800, 5700, 8500, 12700]
];

const ENCOUNTER_MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];

const LOOT_PROFILES = {
    1: {
        label: 'Livelli 1–4',
        coin: [['ma', '4d6', 10], ['mo', '2d6', 10]],
        valuables: ['gemme grezze', 'piccoli oggetti d’arte', 'una curiosità arcana', 'un documento utile'],
        rarity: ['comune', 'non comune'],
        magicChance: 0.28
    },
    2: {
        label: 'Livelli 5–10',
        coin: [['mo', '6d6', 100], ['mp', '2d6', 10]],
        valuables: ['gemme lavorate', 'opere d’arte pregiate', 'un cimelio di fazione', 'materiali alchemici rari'],
        rarity: ['non comune', 'raro'],
        magicChance: 0.52
    },
    3: {
        label: 'Livelli 11–16',
        coin: [['mo', '8d6', 1000], ['mp', '4d6', 100]],
        valuables: ['gioielli nobiliari', 'reliquie dimenticate', 'componenti planari', 'un’opera d’arte magistrale'],
        rarity: ['raro', 'molto raro'],
        magicChance: 0.74
    },
    4: {
        label: 'Livelli 17–20',
        coin: [['mo', '12d6', 1000], ['mp', '8d6', 1000]],
        valuables: ['tesori regali', 'reliquie planari', 'un manufatto storico', 'gemme leggendarie'],
        rarity: ['molto raro', 'leggendario'],
        magicChance: 0.9
    }
};

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || min, min), max);
const randomInt = (max, rng = Math.random) => Math.floor(rng() * max) + 1;
const signedStep = (difference) => difference >= 0 ? Math.floor(difference / 2) : Math.ceil(difference / 2);

export const abilityModifier = (score = 10) => Math.floor((Number(score) - 10) / 2);
export const formatModifier = (value = 0) => `${Number(value) >= 0 ? '+' : ''}${Number(value)}`;

export function rollAbility(rng = Math.random) {
    const rolls = Array.from({ length: 4 }, () => randomInt(6, rng));
    const sorted = [...rolls].sort((a, b) => b - a);
    return {
        rolls,
        kept: sorted.slice(0, 3),
        discarded: sorted[3],
        total: sorted.slice(0, 3).reduce((sum, value) => sum + value, 0)
    };
}

export function rollAbilitySet(rng = Math.random) {
    return Object.fromEntries(ABILITIES.map(ability => [ability.id, rollAbility(rng)]));
}

export function createStandardAbilitySet() {
    return Object.fromEntries(ABILITIES.map((ability, index) => [ability.id, STANDARD_ARRAY[index]]));
}

export function pointBuyCost(scores = {}) {
    return ABILITIES.reduce((total, ability) => {
        const value = clamp(scores[ability.id] ?? 8, 8, 15);
        return total + POINT_BUY_COSTS[value];
    }, 0);
}

export function parseDiceFormula(formula = '') {
    const compact = String(formula).toLowerCase().replace(/\s+/g, '');
    const match = compact.match(/^(\d*)d(\d+|%)([+-]\d+)?(?:x(\d+))?$/);
    if (!match) return null;
    const count = clamp(Number(match[1] || 1), 1, 100);
    const faces = match[2] === '%' ? 100 : clamp(Number(match[2]), 2, 1000);
    const modifier = Number(match[3] || 0);
    const multiplier = clamp(Number(match[4] || 1), 1, 100000);
    return { count, faces, modifier, multiplier };
}

export function rollFormula(formula = '', rng = Math.random) {
    const parsed = parseDiceFormula(formula);
    if (!parsed) return null;
    const rolls = Array.from({ length: parsed.count }, () => randomInt(parsed.faces, rng));
    const subtotal = rolls.reduce((sum, value) => sum + value, 0) + parsed.modifier;
    return { ...parsed, formula, rolls, subtotal, total: subtotal * parsed.multiplier };
}

export const formatNumber = (value = 0) => new Intl.NumberFormat('it-IT').format(Math.round(Number(value) || 0));

const getMultiplierIndex = (monsterCount) => {
    if (monsterCount <= 0) return 0;
    if (monsterCount === 1) return 1;
    if (monsterCount === 2) return 2;
    if (monsterCount <= 6) return 3;
    if (monsterCount <= 10) return 4;
    if (monsterCount <= 14) return 5;
    return 6;
};

export function getEncounterMultiplier(monsterCount, partySize) {
    let index = getMultiplierIndex(monsterCount);
    if (partySize > 0 && partySize < 3) index += 1;
    if (partySize >= 6) index -= 1;
    return ENCOUNTER_MULTIPLIERS[clamp(index, 0, ENCOUNTER_MULTIPLIERS.length - 1)];
}

export function calculateEncounter(partyRows = [], monsterRows = []) {
    const party = partyRows
        .map(row => ({ level: clamp(row.level, 1, 20), count: clamp(row.count, 0, 20) }))
        .filter(row => row.count > 0);
    const monsters = monsterRows
        .map(row => ({
            name: String(row.name || 'Creatura').trim() || 'Creatura',
            cr: String(row.cr ?? '0'),
            count: clamp(row.count, 0, 50)
        }))
        .filter(row => row.count > 0);
    const partySize = party.reduce((sum, row) => sum + row.count, 0);
    const thresholds = party.reduce((totals, row) => {
        const values = XP_THRESHOLDS[row.level - 1];
        return totals.map((value, index) => value + values[index] * row.count);
    }, [0, 0, 0, 0]);
    const baseXp = monsters.reduce((sum, row) => {
        const cr = CR_ROWS.find(item => item.cr === row.cr) || CR_ROWS[0];
        return sum + cr.xp * row.count;
    }, 0);
    const monsterCount = monsters.reduce((sum, row) => sum + row.count, 0);
    const multiplier = getEncounterMultiplier(monsterCount, partySize);
    const adjustedXp = Math.round(baseXp * multiplier);
    const [easy, medium, hard, deadly] = thresholds;
    let difficulty = 'Triviale';
    if (adjustedXp >= deadly && deadly > 0) difficulty = 'Letale';
    else if (adjustedXp >= hard && hard > 0) difficulty = 'Difficile';
    else if (adjustedXp >= medium && medium > 0) difficulty = 'Medio';
    else if (adjustedXp >= easy && easy > 0) difficulty = 'Facile';

    return {
        party,
        monsters,
        partySize,
        monsterCount,
        thresholds: { easy, medium, hard, deadly },
        baseXp,
        multiplier,
        adjustedXp,
        difficulty,
        xpPerCharacter: partySize ? Math.floor(baseXp / partySize) : 0
    };
}

const findRowIndexForRange = (value, key) => {
    const number = Math.max(0, Number(value) || 0);
    const index = CR_ROWS.findIndex(row => number >= row[key][0] && number <= row[key][1]);
    if (index >= 0) return index;
    return number > CR_ROWS.at(-1)[key][1] ? CR_ROWS.length - 1 : 0;
};

const adjustedCrIndex = (baseIndex, actual, expected) => clamp(
    baseIndex + signedStep(Number(actual) - Number(expected)),
    0,
    CR_ROWS.length - 1
);

export function calculateChallengeRating({
    hp = 1,
    ac = 10,
    dpr = 0,
    attack = 0,
    saveDc = 10,
    useSaveDc = false,
    hpMultiplier = 1,
    fliesAndRanged = false,
    saveProficiencies = 0
} = {}) {
    const effectiveHp = Math.max(1, Math.round((Number(hp) || 1) * (Number(hpMultiplier) || 1)));
    const defensiveBaseIndex = findRowIndexForRange(effectiveHp, 'hp');
    const defensiveBase = CR_ROWS[defensiveBaseIndex];
    const saveAcBonus = Number(saveProficiencies) >= 5 ? 4 : Number(saveProficiencies) >= 3 ? 2 : 0;
    const flightAcBonus = fliesAndRanged && defensiveBase.value <= 10 ? 2 : 0;
    const effectiveAc = (Number(ac) || 10) + saveAcBonus + flightAcBonus;
    const defensiveIndex = adjustedCrIndex(defensiveBaseIndex, effectiveAc, defensiveBase.ac);

    const offensiveBaseIndex = findRowIndexForRange(dpr, 'dpr');
    const offensiveBase = CR_ROWS[offensiveBaseIndex];
    const offensiveActual = useSaveDc ? Number(saveDc) || 10 : Number(attack) || 0;
    const offensiveExpected = useSaveDc ? offensiveBase.saveDc : offensiveBase.attack;
    const offensiveIndex = adjustedCrIndex(offensiveBaseIndex, offensiveActual, offensiveExpected);
    const finalIndex = clamp(Math.round((defensiveIndex + offensiveIndex) / 2), 0, CR_ROWS.length - 1);

    return {
        cr: CR_ROWS[finalIndex],
        defensiveCr: CR_ROWS[defensiveIndex],
        offensiveCr: CR_ROWS[offensiveIndex],
        defensiveBase,
        offensiveBase,
        effectiveHp,
        effectiveAc,
        attackMetric: useSaveDc ? `CD ${offensiveActual}` : formatModifier(offensiveActual)
    };
}

export function generateLoot({ tier = 1, wealth = 'standard', includeMagic = true } = {}, rng = Math.random) {
    const selectedTier = clamp(tier, 1, 4);
    const profile = LOOT_PROFILES[selectedTier];
    const wealthFactors = { scarso: 0.55, standard: 1, ricco: 1.8 };
    const factor = wealthFactors[wealth] || 1;
    const coins = profile.coin.map(([currency, formula, multiplier]) => {
        const roll = rollFormula(formula, rng);
        return {
            currency,
            formula: `${formula} × ${multiplier}`,
            total: Math.max(0, Math.round(roll.total * multiplier * factor))
        };
    });
    const valuablesCount = Math.max(1, Math.round((randomInt(4, rng) + selectedTier - 1) * factor));
    const valuable = profile.valuables[Math.floor(rng() * profile.valuables.length)];
    const magicRoll = rng();
    const magicCount = includeMagic && magicRoll <= profile.magicChance
        ? Math.max(1, Math.min(3, Math.ceil((selectedTier + factor - 1) / 2)))
        : 0;
    const rarity = profile.rarity[Math.floor(rng() * profile.rarity.length)];
    const hookPool = [
        'porta il sigillo di una casata scomparsa',
        'è reclamato da una fazione locale',
        'nasconde un indizio per la prossima scena',
        'richiede un favore per essere venduto al suo vero valore',
        'è legato a una creatura ancora in vita',
        'sembra ordinario, ma reagisce alla magia'
    ];

    return {
        tier: selectedTier,
        tierLabel: profile.label,
        wealth,
        coins,
        valuables: { count: valuablesCount, label: valuable },
        magic: magicCount ? { count: magicCount, rarity } : null,
        hook: hookPool[Math.floor(rng() * hookPool.length)]
    };
}

export function formatLootSummary(loot) {
    const coinText = loot.coins.map(item => `${formatNumber(item.total)} ${item.currency}`).join(', ');
    const magicText = loot.magic
        ? `${loot.magic.count} ricompens${loot.magic.count === 1 ? 'a' : 'e'} magic${loot.magic.count === 1 ? 'a' : 'he'} di rarità ${loot.magic.rarity}`
        : 'nessuna ricompensa magica automatica';
    return `${loot.tierLabel}: ${coinText}; ${loot.valuables.count} ${loot.valuables.label}; ${magicText}. Spunto: ${loot.hook}.`;
}

export function formatEncounterSummary(result) {
    const party = result.party.map(row => `${row.count} PG livello ${row.level}`).join(', ');
    const monsters = result.monsters.map(row => `${row.count}× ${row.name} (GS ${row.cr})`).join(', ');
    return `Gruppo: ${party || 'non impostato'}. Incontro: ${monsters || 'nessuna creatura'}. Difficoltà ${result.difficulty}; ${formatNumber(result.baseXp)} PE base, ${formatNumber(result.adjustedXp)} PE modificati (×${result.multiplier}).`;
}
