import { applyEffects, manualNotice, parseCardAbilities } from './magicEffects.js';

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];
const COLOR_NAMES = { W: 'bianco', U: 'blu', B: 'nero', R: 'rosso', G: 'verde', C: 'incolore' };

export const emptyManaPool = () => ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });

const normalizedPool = pool => Object.fromEntries(COLORS.map(color => [color, Math.max(0, Number(pool?.[color]) || 0)]));

const parseCost = (cost = '', xValue = 0, extraGeneric = 0) => {
    const symbols = [...String(cost || '').matchAll(/\{([^}]+)\}/g)].map(match => match[1].toUpperCase());
    let generic = Math.max(0, Number(extraGeneric) || 0);
    const choices = [];
    for (const symbol of symbols) {
        if (/^\d+$/.test(symbol)) { generic += Number(symbol); continue; }
        if (symbol === 'X') { generic += Math.max(0, Number(xValue) || 0); continue; }
        if (COLORS.includes(symbol)) { choices.push([{ color: symbol, generic: 0 }]); continue; }
        const hybrid = symbol.split('/');
        if (hybrid.length === 2 && hybrid.includes('P')) {
            const colored = hybrid.find(part => COLORS.includes(part));
            if (colored) choices.push([{ color: colored, generic: 0 }]); // Paying life is a separate choice, never generic mana.
            else return null;
            continue;
        }
        if (hybrid.length === 2 && hybrid.every(part => COLORS.includes(part))) {
            choices.push(hybrid.map(color => ({ color, generic: 0 })));
            continue;
        }
        if (hybrid.length === 2 && hybrid.some(part => /^\d+$/.test(part)) && hybrid.some(part => COLORS.includes(part))) {
            const color = hybrid.find(part => COLORS.includes(part));
            const amount = Number(hybrid.find(part => /^\d+$/.test(part)));
            choices.push([{ color, generic: 0 }, { color: null, generic: amount }]);
            continue;
        }
        // Snow mana needs snow-producing sources, which are not modeled yet.
        if (symbol === 'S') return null;
        return null;
    }
    choices.sort((a, b) => a.length - b.length);
    return { generic, choices };
};

const spendMana = (pool, cost) => {
    const parsed = parseCost(cost?.manaCost ?? cost, cost?.xValue ?? 0, cost?.extraGeneric ?? 0);
    if (!parsed) return null;
    const available = normalizedPool(pool);
    const choose = (index, generic) => {
        if (index === parsed.choices.length) {
            if (Object.values(available).reduce((sum, count) => sum + count, 0) < generic) return false;
            // Preserve colored mana when possible; colorless is the most restrictive pool.
            for (const color of ['C', 'W', 'U', 'B', 'R', 'G']) {
                const used = Math.min(available[color], generic);
                available[color] -= used;
                generic -= used;
                if (!generic) break;
            }
            return generic === 0;
        }
        for (const option of parsed.choices[index]) {
            if (option.color) {
                if (!available[option.color]) continue;
                available[option.color]--;
                if (choose(index + 1, generic)) return true;
                available[option.color]++;
            } else if (choose(index + 1, generic + option.generic)) return true;
        }
        return false;
    };
    return choose(0, parsed.generic) ? available : null;
};

export const canPayMana = (pool, cost, xValue = 0, extraGeneric = 0) => spendMana(pool, { manaCost: cost, xValue, extraGeneric }) !== null;

export const payMana = (pool, cost, xValue = 0, extraGeneric = 0) => spendMana(pool, { manaCost: cost, xValue, extraGeneric });

export const manaPoolLabel = pool => {
    const normalized = normalizedPool(pool);
    return COLORS.filter(color => normalized[color] > 0).map(color => `${normalized[color]} ${COLOR_NAMES[color]}`).join(' · ') || 'vuota';
};

// Recognize only abilities whose complete costs and effects we can apply.
export const manaAbilityOptions = (card, colorIdentity = []) => {
    const options = [];
    const text = String(card?.oracleText || card?.oracle_text || '');
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\([^)]*\)/g, '').trim();
        const match = line.match(/^((?:\{[0-9WUBRGC]+\}\s*)*)(?:,\s*)?\{T\}:\s*Add\s+(.+?)\.?$/i);
        if (!match) continue;
        const cost = match[1].replace(/\s/g, '');
        const expression = match[2].replace(/\.$/, '').trim();
        const any = expression.match(/^one mana of any color( in your commander's color identity)?$/i);
        let productions;
        if (any) productions = (any[1] ? COLORS.filter(c => c !== 'C' && colorIdentity.includes(c)) : COLORS.slice(0,5)).map(c => [c]);
        else productions = expression.split(/\s+or\s+/i).map(part => {
            const stripped = part.replace(/\{([WUBRGC])\}/gi, '').replace(/\s+and\s+/gi, '');
            return stripped.trim() ? null : [...part.matchAll(/\{([WUBRGC])\}/gi)].map(m => m[1].toUpperCase());
        });
        if (productions.every(p => p?.length)) options.push(...productions.map(production => ({production,cost})));
    }
    const type = String(card?.typeLine || card?.type_line || '');
    if (/\bland\b/i.test(type)) {
        const subtypes = type.split(/[—–]/)[1] || '';
        for (const [subtype, color] of [['Plains','W'],['Island','U'],['Swamp','B'],['Mountain','R'],['Forest','G']]) {
            if (new RegExp(`\\b${subtype}\\b`, 'i').test(subtypes)) options.push({production:[color],cost:''});
        }
        if (/\bwastes\b/i.test(type)) options.push({production:['C'],cost:''});
    }
    return options.filter((entry,i) => options.findIndex(other => JSON.stringify(other) === JSON.stringify(entry)) === i);
};

export const manaProductionOptions = (card, colorIdentity = []) => manaAbilityOptions(card,colorIdentity).map(entry => entry.production);

export const isManaSource = (card, colorIdentity = []) => manaProductionOptions(card, colorIdentity).length > 0;

export const addManaProduction = (player, card, optionIndex = 0) => {
    const ability = manaAbilityOptions(card, player.colorIdentity || [])[optionIndex];
    if (!ability) return [];
    const paid = payMana(player.manaPool, ability.cost);
    if (!paid) return [];
    player.manaPool ||= emptyManaPool();
    Object.assign(player.manaPool, paid);
    for (const color of ability.production) player.manaPool[color]++;
    return ability.production;
};

export const tapManaSource = (player, card, choice = 'auto', desiredCosts = []) => {
    if (!card || card.tapped) throw new Error('Questa carta è già tappata.');
    const haste = card.keywords?.some(word => word.toLowerCase() === 'haste') || /\bhaste\b/i.test(card.oracleText || '');
    if (card.summoningSick && /\bcreature\b/i.test(card.typeLine || '') && !haste) throw new Error('Questa creatura ha debolezza da evocazione.');
    const options = manaProductionOptions(card, player.colorIdentity || []);
    const index = options.length === 1 ? 0 : choice === 'auto'
        ? chooseManaProductionOption(player, card, desiredCosts) : options.findIndex(option => option.includes(choice));
    if (index < 0) throw new Error('Scegli un colore prodotto da questa fonte o usa Automatico.');
    const added = addManaProduction(player, card, index);
    if (!added.length) throw new Error('Mana insufficiente per attivare questa fonte, oppure abilità non automatizzata.');
    card.tapped = true;
    return added;
};

// Permanent abilities mentioning a target do not make that permanent a targeted spell.
export const spellNeedsTarget = card => /\btarget\b/i.test(card?.oracleText || '') && !isPermanentCard(card) && !/\bup to\b/i.test(card?.oracleText || '');

/** Pick the automatic color that best advances spells currently available to cast. */
export const chooseManaProductionOption = (player, card, desiredCosts = []) => {
    const options = manaProductionOptions(card, player.colorIdentity || []);
    if (options.length < 2) return options.length ? 0 : -1;
    const pool = normalizedPool(player.manaPool);
    const costs = desiredCosts.map(entry => typeof entry === 'string' ? { manaCost: entry } : entry).filter(Boolean);
    let bestIndex = -1, bestScore = -Infinity;
    options.forEach((production, index) => {
        const nextPool = payMana(pool, manaAbilityOptions(card, player.colorIdentity || [])[index].cost);
        if (!nextPool) return;
        for (const color of production) if (COLORS.includes(color)) nextPool[color]++;
        let score = 0;
        for (const entry of costs) {
            const cost = entry.manaCost || '';
            const extra = Number(entry.extraGeneric) || 0;
            if (!canPayMana(pool, cost, 0, extra) && canPayMana(nextPool, cost, 0, extra)) score += 1000;
            const needed = new Set([...String(cost).matchAll(/\{([WUBRG])\}/gi)].map(match => match[1].toUpperCase()));
            for (const color of needed) if (!pool[color] && production.includes(color)) score += 20;
        }
        if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
    return bestIndex;
};

/**
 * Risolve il testo di una carta sullo stato. Il lavoro vero sta in
 * magicEffects.js: qui restano l'interfaccia storica e la distinzione fra
 * un permanente che entra in campo (solo inneschi ETB) e una magia che si
 * risolve. Le frasi non riconosciute finiscono nel diario, non nel silenzio.
 */
export const resolveOracleText = (card, state, controllerId, target = '', xValue = 0, entry = false, mode = null) => {
    const parsed = parseCardAbilities(card);
    const log = [], unsupported = [];
    let resolvedCount = 0;
    // In ingresso si risolvono solo gli inneschi della carta stessa: quelli che
    // osservano altre creature li fa scattare il motore (runTriggers).
    const groups = entry
        ? parsed.triggers.filter(trigger => trigger.event === 'etb' && trigger.subject?.self)
        : parsed.spells;
    for (const group of groups) {
        let chosen = group;
        if (group.modes) {
            chosen = mode != null && group.modes[mode]
                ? group.modes[mode]
                : group.modes.find(option => option.effects.length && !option.unsupported.length) || group.modes[0];
            if (!chosen) continue;
            log.push(`Modo scelto: ${chosen.text}.`);
        }
        const result = applyEffects(chosen.effects, { state, controllerId, target, xValue, card });
        log.push(...result.log);
        resolvedCount += result.applied;
        unsupported.push(...result.unsupported, ...(chosen.unsupported || []));
    }
    const unique = [...new Set(unsupported)];
    if (unique.length) log.push(manualNotice(card?.name || 'Carta', unique));
    const targetWords = String(card?.oracleText || '').toLowerCase();
    return {
        log,
        resolvedCount,
        unsupported: unique,
        targetHint: /target creature|target permanent|any target|target player/i.test(targetWords)
    };
};

export const isPermanentCard = card => /\b(?:creature|artifact|enchantment|planeswalker|battle)\b/i.test(String(card?.typeLine || ''));
