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
            if (colored) choices.push([{ color: colored, generic: 0 }, { color: null, generic: 2 }]);
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

const parseProductionText = text => {
    const productions = [];
    if (/spend this mana only/i.test(String(text || ''))) return productions;
    for (const line of String(text || '').split('\n')) {
        if (/^\s*\{T\}\s*:\s*Add one mana of any color(?: in your commander's color identity)?\.?\s*$/i.test(line)) {
            productions.push(...['W', 'U', 'B', 'R', 'G'].map(color => [color]));
            continue;
        }
        // Only model an ability whose sole activation cost is tapping. Scryfall's
        // produced_mana also lists mana from sacrifice/pay-mana abilities; using
        // that metadata alone would incorrectly make Lotus Petal/Signets free.
        const match = line.match(/^\s*\{T\}\s*:\s*Add\s+(.+?)(?:\.|$)/i);
        if (!match) continue;
        const expression = match[1].trim();
        if (/^one mana of any color(?: in your commander's color identity)?$/i.test(expression)) {
            productions.push(...['W', 'U', 'B', 'R', 'G'].map(color => [color]));
            continue;
        }
        const alternatives = expression.split(/\s+or\s+/i).map(part => {
            const stripped = part.replace(/\{([WUBRGC])\}/gi, '').replace(/\s+and\s+/gi, '');
            if (stripped.trim()) return null;
            return [...part.matchAll(/\{([WUBRGC])\}/gi)].map(symbol => symbol[1].toUpperCase());
        });
        if (alternatives.length && alternatives.every(group => group?.length)) productions.push(...alternatives);
    }
    return productions;
};

export const manaProductionOptions = (card, colorIdentity = []) => {
    const fromText = parseProductionText(card?.oracleText || card?.oracle_text);
    let options = fromText;
    if (!options.length) {
        const type = String(card?.typeLine || card?.type_line || '').toLowerCase();
        if (type.includes('plains')) options.push(['W']);
        if (type.includes('island')) options.push(['U']);
        if (type.includes('swamp')) options.push(['B']);
        if (type.includes('mountain')) options.push(['R']);
        if (type.includes('forest')) options.push(['G']);
        if (type.includes('wastes')) options.push(['C']);
    }
    // Only effects that explicitly refer to the commander's identity, such as Command Tower,
    // restrict their choices. Commander no longer converts other off-identity mana to {C}.
    if (/mana of any color in your commander's color identity/i.test(String(card?.oracleText || card?.oracle_text || ''))) {
        const identity = new Set(colorIdentity || []);
        options = options.filter(option => option.every(color => identity.has(color)));
    }
    return options;
};

export const isManaSource = (card, colorIdentity = []) => manaProductionOptions(card, colorIdentity).length > 0;

export const addManaProduction = (player, card, optionIndex = 0) => {
    const options = manaProductionOptions(card, player.colorIdentity || []);
    const production = options[optionIndex];
    if (!production?.length) return [];
    player.manaPool ||= emptyManaPool();
    const added = production;
    for (const color of added) if (COLORS.includes(color)) player.manaPool[color] = (Number(player.manaPool[color]) || 0) + 1;
    return added;
};

/** Pick the automatic color that best advances spells currently available to cast. */
export const chooseManaProductionOption = (player, card, desiredCosts = []) => {
    const options = manaProductionOptions(card, player.colorIdentity || []);
    if (options.length < 2) return options.length ? 0 : -1;
    const pool = normalizedPool(player.manaPool);
    const costs = desiredCosts.map(entry => typeof entry === 'string' ? { manaCost: entry } : entry).filter(Boolean);
    let bestIndex = 0, bestScore = -Infinity;
    options.forEach((production, index) => {
        const nextPool = { ...pool };
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

const numberFromText = value => {
    const words = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    if (/^x$/i.test(value)) return null;
    return Number(value) || words[value.toLowerCase()] || 0;
};

const targetObject = (state, target) => {
    if (!target) return null;
    const [kind, ownerId, cardId] = target.split(':');
    if (kind === 'player') return { kind, player: state.playersData[ownerId], ownerId };
    if (kind === 'card') {
        const player = state.playersData[ownerId];
        const card = player?.battlefield?.find(item => item.id === cardId);
        return card ? { kind, player, card, ownerId } : null;
    }
    return null;
};

/** Resolve a safe subset of common Oracle instructions; unsupported lines are reported, never guessed. */
export const resolveOracleText = (card, state, controllerId, target = '', xValue = 0, entry = false) => {
    const text = String(card?.oracleText || '').replace(/\r/g, '');
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const log = [], unsupported = [];
    const player = state.playersData[controllerId];
    const targetData = targetObject(state, target);
    const targetWords = lines.join(' ').toLowerCase();
    const instructions = lines.flatMap(line => {
        if (entry) {
            const match = line.match(/^When (?:this creature|this permanent|this enchantment|this artifact|this land|this planeswalker) enters(?: the battlefield)?,?\s*(.+)$/i);
            if (!match && /^(?:When|Whenever|At the beginning|At the end)/i.test(line)) unsupported.push(line);
            return match ? [match[1]] : [];
        }
        if (/^(?:When|Whenever|At the beginning|At the end|As long as|As this|If |Kicker|Flashback|Equip|Ward|Reach|Flying|Trample|Deathtouch|Lifelink|Haste|Vigilance|Defender|Menace|First strike|Double strike|Protection|Whenever)/i.test(line)) return [];
        return [line];
    });
    let resolvedCount = 0;
    for (const instruction of instructions) {
        const line = instruction.replace(/^[•\s]+/, '');
        let match;
        if ((match = line.match(/^(?:You )?draw (a|one|two|three|four|five|six|seven|eight|nine|ten|\d+|X) cards?\.?$/i))) {
            const count = numberFromText(match[1]) ?? Math.max(0, Number(xValue) || 0);
            const drawn = Math.min(count, player.library.length);
            for (let index = 0; index < drawn; index++) player.hand.push(player.library.shift());
            if (drawn < count) player.eliminated = true;
            log.push(`${card.name}: peschi ${drawn} carte${drawn < count ? ' · mazzo esaurito, giocatore eliminato' : ''}.`); resolvedCount++; continue;
        }
        if ((match = line.match(/^(?:You )?gain (a|one|two|three|four|five|six|seven|eight|nine|ten|\d+|X) life\.?$/i))) {
            const amount = numberFromText(match[1]) ?? Math.max(0, Number(xValue) || 0);
            player.life = (Number(player.life) || 0) + amount;
            log.push(`${card.name}: guadagni ${amount} vite.`); resolvedCount++; continue;
        }
        if ((match = line.match(/^(?:Target player|Any target|Target creature|Target permanent|Target artifact|Target enchantment|Target planeswalker) gets? (\+\d+\/\+\d+) until end of turn\.?$/i))) {
            if (targetData?.card && String(targetData.card.typeLine || '').toLowerCase().includes('creature')) {
                const [, boost] = match, [power, toughness] = boost.split('/').map(value => Number(value));
                targetData.card.turnBoost ||= { power: 0, toughness: 0 };
                targetData.card.turnBoost.power += power; targetData.card.turnBoost.toughness += toughness;
                log.push(`${card.name}: ${targetData.card.name} prende ${boost}.`); resolvedCount++;
            } else unsupported.push(instruction);
            continue;
        }
        if ((match = line.match(/^(?:This spell|.+?) deals (\d+|X) damage to (?:any target|target player|target creature|target permanent)\.?$/i))) {
            const amount = numberFromText(match[1]) ?? Math.max(0, Number(xValue) || 0);
            if (targetData?.player && (/player/.test(match[0]) || /any target/i.test(match[0]))) {
                targetData.player.life = Math.max(0, targetData.player.life - amount);
                if (targetData.player.life === 0) targetData.player.eliminated = true;
                log.push(`${card.name}: ${amount} danni a ${state.playerNames?.[targetData.ownerId] || 'un giocatore'}.`); resolvedCount++;
            } else if (targetData?.card && (/creature|permanent/.test(match[0]) || /any target/i.test(match[0]))) {
                targetData.card.damageMarked = (targetData.card.damageMarked || 0) + amount;
                const toughness = (Number.parseInt(targetData.card.toughness, 10) || 0) + (targetData.card.turnBoost?.toughness || 0);
                if (toughness > 0 && targetData.card.damageMarked >= toughness) {
                    targetData.player.battlefield = targetData.player.battlefield.filter(item => item.id !== targetData.card.id);
                    targetData.player.graveyard ||= [];
                    if (targetData.card.isCommander) { targetData.player.commandZone ||= []; targetData.player.commandZone.push(targetData.card); }
                    else targetData.player.graveyard.push(targetData.card);
                }
                log.push(`${card.name}: ${amount} danni a ${targetData.card.name}.`); resolvedCount++;
            } else unsupported.push(instruction);
            continue;
        }
        if ((match = line.match(/^(?:Destroy|Exile) target (creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\.?$/i))) {
            const kind = line.startsWith('Exile') ? 'exile' : 'destroy';
            if (!targetData?.card || (match[1].toLowerCase().includes('creature') && !String(targetData.card.typeLine || '').toLowerCase().includes('creature'))) { unsupported.push(instruction); continue; }
            const zone = kind === 'exile' ? 'exile' : 'graveyard';
            targetData.player[zone] ||= [];
            targetData.player.battlefield = targetData.player.battlefield.filter(item => item.id !== targetData.card.id);
            if (targetData.card.isCommander) { targetData.player.commandZone ||= []; targetData.player.commandZone.push(targetData.card); } else targetData.player[zone].push(targetData.card);
            log.push(`${card.name}: ${targetData.card.name} ${kind === 'exile' ? 'esiliata' : 'distrutta'}.`); resolvedCount++; continue;
        }
        if ((match = line.match(/^Put (a|one|two|three|four|five|\d+) \+1\/\+1 counters? on target creature\.?$/i))) {
            const count = numberFromText(match[1]);
            if (targetData?.card && String(targetData.card.typeLine || '').toLowerCase().includes('creature')) {
                targetData.card.counters ||= { plusOne: 0 };
                targetData.card.counters.plusOne += count;
                log.push(`${card.name}: ${count} segnalini +1/+1 su ${targetData.card.name}.`); resolvedCount++;
            } else unsupported.push(instruction);
            continue;
        }
        if ((match = line.match(/^Create (a|one|two|three|four|five|\d+) (?:tapped )?(\d+)\/(\d+) ([\w-]+ )?creature tokens?\.?$/i))) {
            const [, amountText, power, toughness, colorText = ''] = match, count = numberFromText(amountText);
            player.battlefield ||= [];
            for (let index = 0; index < count; index++) player.battlefield.push({ id: `token-${crypto.randomUUID()}`, name: `${colorText.trim() || 'Creature'} Token`, typeLine: 'Token Creature', power, toughness, cmc: 0, manaCost: '', image: '', tapped: /tapped/i.test(line), summoningSick: true, counters: { plusOne: 0 }, turnBoost: { power: 0, toughness: 0 } });
            log.push(`${card.name}: crei ${count} pedine ${power}/${toughness}.`); resolvedCount++; continue;
        }
        if (/\btarget\b/i.test(line) && !targetData && /^(?:deals|destroy|exile|put|return|tap|sacrifice)/i.test(line)) unsupported.push(instruction);
        else if (/^(?:You |Each player|Each opponent|Target |Destroy |Exile |Return |Put |Create |Scry |Mill |Search |Shuffle |Counter |Tap |Untap |Sacrifice |Add )/i.test(line)) unsupported.push(instruction);
    }
    if (!instructions.length && text.trim() && !entry) unsupported.push('Abilità statiche/innescate non gestite da questa risoluzione.');
    if (!resolvedCount && text.trim() && !unsupported.length && /\b(?:draw|gain|deals|destroy|exile|create|counter|return|search|mill|scry)\b/i.test(text)) unsupported.push('Testo Oracle non riconosciuto dal risolutore automatico.');
    if (unsupported.length) log.push(`${card.name}: effetto da risolvere manualmente (${[...new Set(unsupported)].slice(0, 2).join('; ')}).`);
    return { log, resolvedCount, unsupported: [...new Set(unsupported)], targetHint: /target creature|target permanent|any target|target player/i.test(targetWords) };
};

export const isPermanentCard = card => /\b(?:creature|artifact|enchantment|planeswalker|battle)\b/i.test(String(card?.typeLine || ''));
