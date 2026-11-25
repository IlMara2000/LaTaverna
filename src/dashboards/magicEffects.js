// Effetti delle carte Magic: dal testo Oracle alle istruzioni applicate allo stato.
//
// Questo è un interprete a modelli, non un motore di regole completo: riconosce
// le frasi che sa applicare senza ambiguità (danno, distruzione, pescate, vite,
// pedine, pompaggi, parole chiave, ricerca di terre base…) e dichiara le altre
// come «da gestire a mano». Non inventa mai un effetto plausibile: se una frase
// non è capita, finisce nel diario con il testo originale, così al tavolo si sa
// cosa resta da fare invece di scoprirlo dopo.
//
// Nessuna dipendenza esterna: il modulo è puro e vive nel bundle client.

// Catturante di proposito: ogni modello che lo usa legge la quantità in
// `match[...]`, e un gruppo non catturante sfaserebbe gli indici (bug pagato).
const COUNT = '(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|x|\\d+)';
const COUNT_WORDS = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12
};
const KEYWORDS = [
    'flying', 'reach', 'trample', 'deathtouch', 'lifelink', 'vigilance', 'haste',
    'menace', 'first strike', 'double strike', 'hexproof', 'indestructible',
    'defender', 'flash', 'ward'
];

const toCount = (raw, xValue = 0) => {
    const value = String(raw ?? '').trim().toLowerCase();
    if (value === 'x') return Math.max(0, Number(xValue) || 0);
    if (Object.prototype.hasOwnProperty.call(COUNT_WORDS, value)) return COUNT_WORDS[value];
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Testo normalizzato: senza testo fra parentesi, con il nome della carta reso «this». */
export const normalizeText = card => {
    let text = String(card?.oracleText || card?.oracle_text || '')
        .replace(/\r/g, '')
        .replace(/\([^)]*\)/g, ' ');
    const name = String(card?.name || '').trim();
    if (name) text = text.replace(new RegExp(escapeRegExp(name), 'gi'), 'this');
    return text.replace(/\u2212/g, '-');
};

const typeLine = card => String(card?.typeLine || card?.type_line || '');
const isCreature = card => /\bcreature\b/i.test(typeLine(card));
const isLand = card => /\bland\b/i.test(typeLine(card));
const isBasicLand = card => /\bbasic\b/i.test(typeLine(card)) && isLand(card);
const oracleOf = card => String(card?.oracleText || card?.oracle_text || '');
const keywordsOf = card => (card?.keywords || []).map(word => String(word).toLowerCase());
export const hasKeyword = (card, word) => {
    const wanted = String(word).toLowerCase();
    if (keywordsOf(card).includes(wanted)) return true;
    // Parole chiave concesse da un anthem («… and have vigilance»).
    if ((card?.anthemKeywords || []).some(keyword => String(keyword).toLowerCase() === wanted)) return true;
    return new RegExp(`\\b${escapeRegExp(wanted)}\\b`, 'i').test(oracleOf(card));
};
const basePowerOf = card => Number.parseInt(card?.power, 10) || 0;
const baseToughnessOf = card => Number.parseInt(card?.toughness, 10) || 0;
// anthemBoost è il bonus continuo degli anthem (vedi recomputeStatics): sta
// separato da turnBoost perché i pompaggi «fino a fine turno» si azzerano al
// cambio di turno, mentre un anthem resta finché il permanente resta in campo.
export const powerOf = card => basePowerOf(card)
    + (card?.counters?.plusOne || 0)
    + (card?.turnBoost?.power || 0)
    + (card?.anthemBoost?.power || 0);
const toughnessOf = card => baseToughnessOf(card)
    + (card?.counters?.plusOne || 0)
    + (card?.turnBoost?.toughness || 0)
    + (card?.anthemBoost?.toughness || 0);
const idOf = card => String(card?.instanceId ?? card?.uid ?? card?.id ?? '');
const stripRuntime = card => {
    const { instanceId, damageMarked, turnBoost, counters, attacking, blocking, summoningSick, tapped, ...rest } = card;
    return rest;
};

/* ───────────────────────────── clausole ───────────────────────────── */

const damageTargets = raw => {
    const text = String(raw || '').trim().toLowerCase().replace(/\.$/, '');
    if (/^(any target|target creature or player|target player or planeswalker|target permanent or player)$/.test(text)) return 'target';
    if (/^target creature$/.test(text)) return 'targetCreature';
    if (/^target player$/.test(text)) return 'targetPlayer';
    if (/^target opponent$/.test(text)) return 'targetOpponent';
    if (/^target permanent$/.test(text)) return 'targetPermanent';
    if (/^each creature$/.test(text)) return 'eachCreature';
    if (/^each other creature$/.test(text)) return 'eachOtherCreature';
    if (/^each opponent$/.test(text)) return 'eachOpponent';
    if (/^each player$/.test(text)) return 'eachPlayer';
    if (/^(that creature|it)$/.test(text)) return 'thatCreature';
    // «quella creatura»/«quel giocatore» puntano al bersaglio già scelto.
    if (/^(that player|defending player)$/.test(text)) return 'targetPlayer';
    // «This artifact deals 2 damage to you»: il danno va al controllore.
    if (/^(you|its controller)$/.test(text)) return 'controller';
    return null;
};

const destructionScope = raw => {
    const text = String(raw || '').trim().toLowerCase().replace(/\.$/, '');
    if (/^(target creature|target permanent|target artifact|target enchantment|target planeswalker|target nonland permanent|target artifact or enchantment|target creature or planeswalker)$/.test(text)) return 'target';
    if (/^(all creatures|each creature)$/.test(text)) return 'allCreatures';
    if (/^(all artifacts|each artifact)$/.test(text)) return 'allArtifacts';
    if (/^(all enchantments|each enchantment)$/.test(text)) return 'allEnchantments';
    if (/^(all lands|each land)$/.test(text)) return 'allLands';
    if (/^all permanents$/.test(text)) return 'allPermanents';
    return null;
};

// Il nome della carta è già diventato «this» in normalizeText: il soggetto è la
// carta stessa con qualunque tipologia («this artifact», «this creature»…).
const subjectIsSelf = raw => /^(?:this(?:\s+[a-z]+)*|it|)$/i.test(String(raw || '').trim());

/** Una frase → un effetto, o null se non è riconosciuta. */
function parseSentence(raw) {
    const line = String(raw || '').trim().replace(/^[•\s]+/, '').replace(/\s+/g, ' ').replace(/\.$/, '');
    if (!line) return null;
    let match;

    if ((match = line.match(new RegExp(`^(?:you )?draw ${COUNT} cards?$`, 'i'))))
        return { type: 'draw', count: toCount(match[1]) };

    if ((match = line.match(new RegExp(`^(?:you )?gain ${COUNT} life$`, 'i'))))
        return { type: 'gainLife', count: toCount(match[1]) };

    if ((match = line.match(new RegExp(`^(each opponent|target player|target opponent|each player|that player) loses ${COUNT} life$`, 'i'))))
        return { type: 'loseLife', who: match[1].toLowerCase(), count: toCount(match[2]) };

    // «Perdi 1 vita»: il soggetto è implicito nel controllore della carta.
    if ((match = line.match(new RegExp(`^(?:you )?lose ${COUNT} life$`, 'i'))))
        return { type: 'loseLife', who: 'controller', count: toCount(match[1]) };

    if ((match = line.match(new RegExp(`^(.*?)\\s*deals? ${COUNT} damage to (.+)$`, 'i')))) {
        const to = damageTargets(match[3]);
        if (!to || !subjectIsSelf(match[1])) return null;
        return { type: 'damage', amount: toCount(match[2]), to };
    }

    if ((match = line.match(/^(destroy|exile) (.+)$/i))) {
        const scope = destructionScope(match[2]);
        if (!scope) return null;
        if (scope === 'target' && !/^target /i.test(match[2].trim())) return null;
        return { type: match[1].toLowerCase(), scope };
    }

    if ((match = line.match(new RegExp(`^(target creature|this(?: creature)?) gets ([+-]\\d+)/([+-]\\d+)(?: until end of turn)?$`, 'i'))))
        return {
            type: 'pump',
            to: /^target/i.test(match[1]) ? 'target' : 'self',
            power: Number(match[2]), toughness: Number(match[3])
        };

    if ((match = line.match(new RegExp(`^(target creature|this(?: creature)?) gains? (${KEYWORDS.join('|')})(?: until end of turn)?$`, 'i'))))
        return {
            type: 'grantKeyword',
            to: /^target/i.test(match[1]) ? 'target' : 'self',
            keyword: match[2].toLowerCase()
        };

    if ((match = line.match(new RegExp(`^put ${COUNT} \\+1/\\+1 counters? on (target creature|this(?: creature)?)$`, 'i'))))
        return { type: 'counters', count: toCount(match[1]), to: /^target/i.test(match[2]) ? 'target' : 'self' };

    if ((match = line.match(new RegExp(`^create ${COUNT} (?:tapped )?(\\d+)/(\\d+) (.+?) creature tokens?$`, 'i'))))
        return { type: 'tokens', count: toCount(match[1]), power: Number(match[2]), toughness: Number(match[3]), label: match[4] };

    if ((match = line.match(/^return (target (?:creature|permanent|artifact|enchantment|land|nonland permanent)) to (?:its|their) owner'?s hand$/i)))
        return { type: 'bounce', scope: 'target' };

    if ((match = line.match(/^(tap|untap) (target creature|target permanent|this(?: creature)?)$/i)))
        return { type: match[1].toLowerCase(), scope: /^target/i.test(match[2]) ? 'target' : 'self' };

    // «Support 2»: un +1/+1 su ciascuna di fino a due creature che controlli.
    if ((match = line.match(new RegExp(`^support ${COUNT}$`, 'i'))))
        return { type: 'support', count: toCount(match[1]) };

    if ((match = line.match(new RegExp(`^mill ${COUNT} cards?$`, 'i'))))
        return { type: 'mill', count: toCount(match[1]) };

    if ((match = line.match(new RegExp(`^search your library for (?:a|one|up to two) basic land cards?,?`, 'i'))))
        return { type: 'searchBasic', count: /up to two/i.test(line) ? 2 : 1 };

    if ((match = line.match(/^(target creature|this(?: creature)?) can'?t block(?: this turn)?$/i)))
        return { type: 'cantBlock', to: /^target/i.test(match[1]) ? 'target' : 'self' };

    // «Add {G}» / «Add one mana of any color»: la produzione la gestisce già il
    // sistema mana con il pulsante Mana, non è un effetto da risolvere a mano.
    if (/^add (?:one mana of any color|\{[^}]+\}|\d+ mana)/i.test(line)) return { type: 'mana' };

    return null;
}

// Una riga fatta solo di parole chiave («Flying, vigilance») è testo statico già
// applicato dal motore: non è un effetto mancante.
const KEYWORD_LINE = new RegExp(`^(?:${KEYWORDS.join('|')})(?:\\s*,\\s*(?:${KEYWORDS.join('|')}))*$`, 'i');
// Parole e costi che non cambiano lo stato da soli (equip, aura, ciclaggio,
// restrizioni di lancio): riconosciuti come statici, non come «da gestire».
const STATIC_LINE = /^(?:equip|enchant|(?:plains|island|swamp|mountain|forest)cycling|cycling|activate only|spend this mana only|this spell can'?t be countered|you can'?t lose the game|support \d+|evolve|crew|ward)\b/i;

// Niente lookbehind: Safari più vecchi non la supportano e il tavolo deve
// funzionare anche lì. Si spezza su «. » e la punteggiatura finale non serve.
const sentencesOf = text => String(text || '')
    .split(/\.\s+/)
    .map(part => part.trim())
    .filter(Boolean);

/** Un corpo di testo può contenere più frasi; una frase non capita non ferma le altre. */
function parseBody(text) {
    const effects = [];
    const unsupported = [];
    for (const sentence of sentencesOf(text)) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;
        // «se controlli una creatura con forza 4 o più, pesca una carta»: la
        // condizione resta attaccata all'effetto e viene valutata al momento.
        const conditional = trimmed.match(/^if (.+?), (.+)$/i);
        if (conditional) {
            const condition = parseCondition(conditional[1]);
            const inner = condition ? parseSentence(conditional[2]) : null;
            if (inner) { effects.push({ ...inner, condition }); continue; }
        }
        const effect = parseSentence(trimmed);
        if (effect) { effects.push(effect); continue; }
        // «Activate only as a sorcery», «spend this mana only…», «support 2»:
        // restrizioni e parole chiave, non effetti da risolvere a mano.
        if (KEYWORD_LINE.test(trimmed) || STATIC_LINE.test(trimmed)) continue;
        unsupported.push(trimmed);
    }
    return { effects, unsupported };
}

const CONDITION = /^you control (?:(a|an|another|at least one|one|two|three|four|five|six|seven|eight|nine|ten|\d+) )?(?:(or more|plus) )?(creatures?|artifacts?|enchantments?|lands?|permanents?)(?: with power (\d+) or (?:greater|more))?$/i;

function parseCondition(raw) {
    const match = String(raw || '').trim().replace(/\.$/, '').match(CONDITION);
    if (!match) return null;
    const kind = match[3].toLowerCase().replace(/s$/, '');
    return {
        kind: ['creature', 'artifact', 'enchantment', 'land', 'permanent'].includes(kind) ? kind : 'permanent',
        count: match[2] ? Math.max(1, toCount(match[1])) : 1,
        minPower: match[4] ? Number(match[4]) : null
    };
}

/* ─────────────────────── abilità: attivate e innescate ─────────────────────── */

const ETB_TRIGGER = /^(?:when|whenever)\s+(?:this|it)(?:\s+(?:creature|permanent|artifact|enchantment|land|planeswalker))?\s+enters(?:\s+the battlefield)?(?:\s+or\s+dies)?\s*,?\s*(.+)$/i;
const ATTACK_TRIGGER = /^whenever\s+(?:this|it)(?:\s+creature)?\s+attacks\s*,?\s*(.+)$/i;
// Solo il mantenimento «tuo»: «all'inizio di ogni mantenimento» ha un soggetto
// diverso e passa dal modello generico qui sotto.
const UPKEEP_TRIGGER = /^at the beginning of your upkeep\s*,?\s*(.+)$/i;
const OTHER_TRIGGER = /^(?:when|whenever|at the beginning of|at the end of)\b/i;
// Innesco con un soggetto che non è la carta stessa: «Quando un'altra creatura
// che controlli entra…». Il soggetto si conserva e il motore decide se l'evento
// lo riguarda (triggerMatches), così un innesco non scatta per eventi altrui.
const GENERIC_TRIGGER = /^(when|whenever|at the beginning of)\s+(.+?)\s*,\s*(.+)$/i;

function parseCost(prefix) {
    const text = String(prefix || '');
    const symbols = [...text.matchAll(/\{([^}]+)\}/g)].map(match => match[1].toUpperCase());
    const manaSymbols = symbols.filter(symbol => symbol !== 'T');
    const sacrifice = /sacrifice/i.test(text);
    return {
        tap: symbols.includes('T'),
        manaCost: manaSymbols.map(symbol => `{${symbol}}`).join(''),
        // Sacrificare la carta stessa è automatico; sacrificare altro richiede
        // una scelta che il tavolo non sa fare, quindi l'abilità resta manuale.
        sacrificeSelf: sacrifice && /sacrifice this/i.test(text),
        sacrificeOther: sacrifice && !/sacrifice this/i.test(text)
    };
}

/* ─────────────────── soggetti, modi e testi statici ─────────────────── */

const creatureTypesOf = card => String(typeLine(card).split(/[—–]/)[1] || '')
    .split(/\s+/).map(part => part.trim()).filter(Boolean);

const isPermanentCard = card => /\b(?:creature|artifact|enchantment|planeswalker)\b/i.test(typeLine(card));

// Un sottotipo è la parola con l'iniziale maiuscola dopo l'articolo:
// «un'altra creatura Angelo» → «Angelo». La maiuscola evita di prendere «creatura».
const subtypeOf = raw => {
    const match = String(raw || '').match(/\b(?:an?|another|each other|other|each)\s+([A-Z][a-z]+)(?:\s+creatures?)?\b/);
    return match ? match[1] : '';
};

const subtypeFromDescriptor = descriptor => {
    const match = String(descriptor || '').match(/^([A-Z][\w']+)\s+creatures?$/);
    return match ? match[1] : '';
};

const keywordListOf = raw => String(raw || '').split(/\s*,\s*|\s+and\s+/i)
    .map(word => word.trim().toLowerCase())
    .filter(word => word && KEYWORDS.includes(word));

const anthem = (scope, subtype, excludeSelf, power, toughness, keywords) => ({
    type: 'anthem', scope, subtype: subtype || '', excludeSelf, power, toughness, keywords: keywords || []
});

/**
 * Testo statico di un permanente che cambia i numeri in campo: anthem e scelta
 * del tipo. Restituisce null per tutto il resto, che resta «da gestire a mano».
 */
function parseStatic(line) {
    const text = String(line || '').trim().replace(/\.$/, '');
    let match;
    if (/^as this(?:\s+\w+)? enters,? choose a creature type$/i.test(text)) return { type: 'chooseType' };
    if ((match = text.match(/^(other |nontoken |other nontoken )?creatures? you control of the chosen type gets? ([+-]\d+)\/([+-]\d+)(?: and (?:has|have) ([a-z ,]+))?$/i)))
        return anthem('chosenType', '', /^other/i.test(match[1] || ''), Number(match[2]), Number(match[3]), keywordListOf(match[4]));
    if ((match = text.match(/^(other |each other |nontoken |other nontoken )?((?:[A-Z][\w']+ )?creatures?) you control gets? ([+-]\d+)\/([+-]\d+)(?: and (?:has|have) ([a-z ,]+))?$/i)))
        return anthem(/nontoken/i.test(match[1] || '') ? 'nontoken' : 'creatures', subtypeFromDescriptor(match[2]), /other/i.test(match[1] || ''), Number(match[3]), Number(match[4]), keywordListOf(match[5]));
    if ((match = text.match(/^(?:each other|other|each) ([A-Z][\w']+) you control gets? ([+-]\d+)\/([+-]\d+)(?: and (?:has|have) ([a-z ,]+))?$/i)))
        return anthem('creatures', match[1], true, Number(match[2]), Number(match[3]), keywordListOf(match[4]));
    return null;
}

/**
 * Soggetto di un innesco: chi lo fa scattare, non solo la carta stessa.
 * `null` quando il soggetto non è verificabile (morente, chiudi turno…): in quel
 * caso la riga resta manuale invece di scattare a sproposito.
 */
function parseTriggerSubject(raw, prefix) {
    const original = String(raw || '').trim();
    const text = original.toLowerCase();
    const subject = {
        self: false,
        who: /you control/.test(text) ? 'you' : 'any',
        kind: /creature/.test(text) ? 'creature'
            : /artifact/.test(text) ? 'artifact'
                : /enchantment/.test(text) ? 'enchantment' : 'permanent',
        subtype: subtypeOf(original),
        excludeSelf: /\banother\b|\bother\b/.test(text),
        nontoken: /\bnontoken\b/.test(text),
        minPower: null,
        event: null
    };
    if (/^at the beginning of$/i.test(prefix)) {
        if (/\bupkeep$/.test(text)) {
            subject.event = 'upkeep';
            subject.who = /^your\b/.test(text) ? 'you' : 'any';
            return subject;
        }
        return null;
    }
    // «Attacca te / un avversario» o «attacca da solo» richiedono un filtro che
    // il tavolo non ha: meglio manuale che un innesco sempre acceso.
    if (/attacks? (?:you|a player|an opponent|alone)\b/.test(text)) return null;
    if (/\benters?\b/.test(text)) subject.event = 'etb';
    else if (/\battacks?\b/.test(text)) subject.event = 'attack';
    else return null;
    const power = text.match(new RegExp(`power ${COUNT} or (?:greater|more)`));
    if (power) subject.minPower = toCount(power[1]);
    return subject;
}

function triggerOf(event, subject, bodyText, line) {
    const body = parseBody(bodyText);
    return { event, subject, effects: body.effects, unsupported: body.unsupported, text: line };
}

function parseTriggerLine(line) {
    let match = line.match(ETB_TRIGGER);
    if (match) return triggerOf('etb', { self: true }, match[1], line);
    match = line.match(ATTACK_TRIGGER);
    if (match) return triggerOf('attack', { self: true }, match[1], line);
    match = line.match(UPKEEP_TRIGGER);
    if (match) return triggerOf('upkeep', { self: true, who: 'you' }, match[1], line);
    match = line.match(GENERIC_TRIGGER);
    if (!match) return null;
    const subject = parseTriggerSubject(match[2], match[1]);
    if (!subject) return null;
    return triggerOf(subject.event, subject, match[3], line);
}

const MODAL_HEADER = /^choose (one|two|one or both)\s*[—–-]\s*$/i;
const BULLET = /^[•·▪]\s*/;

/** I modi di una magia modale: l'intestazione «Choose one —» e le righe «• …». */
function parseModes(lines, start) {
    const modes = [];
    let index = start + 1;
    while (index < lines.length && BULLET.test(lines[index])) {
        const text = lines[index].replace(BULLET, '').trim();
        const body = parseBody(text);
        modes.push({ text, effects: body.effects, unsupported: body.unsupported });
        index += 1;
    }
    return { modes, next: index };
}

// L'interpretazione di una carta dipende solo dal suo testo: lo stesso mago
// viene parsato a ogni ridisegno del tavolo (rivelatore, pulsanti, inneschi).
// La cache per testo evita di rifare decine di regex per ogni mossa; è limitata
// e a scorrimento, così non cresce con le partite. Il risultato è di sola
// lettura: chi lo riceve non lo modifica.
const PARSE_CACHE_LIMIT = 400;
const PARSE_CACHE = new Map();
const parseCacheKey = card => [
    String(card?.name || ''),
    String(card?.typeLine || card?.type_line || ''),
    String(card?.oracleText || card?.oracle_text || ''),
    (card?.keywords || []).map(word => String(word).toLowerCase()).join(',')
].join('\u0001');

/**
 * Divide il testo della carta in abilità innescate, attivate, frasi da magia,
 * modi tra cui scegliere e testi statici (anthem, tipo scelto). Restituisce
 * anche ciò che non è stato capito, così l'interfaccia può dirlo.
 */
export function parseCardAbilities(card) {
    const key = parseCacheKey(card);
    const cached = PARSE_CACHE.get(key);
    if (cached) return cached;
    const parsed = parseCardAbilitiesUncached(card);
    if (PARSE_CACHE.size >= PARSE_CACHE_LIMIT) {
        PARSE_CACHE.delete(PARSE_CACHE.keys().next().value);
    }
    PARSE_CACHE.set(key, parsed);
    return parsed;
}

function parseCardAbilitiesUncached(card) {
    const text = normalizeText(card);
    const triggers = [];
    const activated = [];
    const spells = [];
    const statics = [];
    const manual = [];
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];

        if (MODAL_HEADER.test(line)) {
            const parsed = parseModes(lines, index);
            index = parsed.next - 1;
            const supported = parsed.modes.filter(mode => mode.effects.length && !mode.unsupported.length).length;
            spells.push({ modes: parsed.modes, effects: [], unsupported: [], text: line, supported });
            for (const mode of parsed.modes) manual.push(...mode.unsupported);
            continue;
        }
        // Un «•» orfano (senza intestazione) resta una frase come le altre.
        if (BULLET.test(line)) {
            const body = parseBody(line.replace(BULLET, ''));
            spells.push({ effects: body.effects, unsupported: body.unsupported, text: line });
            manual.push(...body.unsupported);
            continue;
        }

        const trigger = parseTriggerLine(line);
        if (trigger) {
            triggers.push(trigger);
            manual.push(...trigger.unsupported);
            continue;
        }
        if (OTHER_TRIGGER.test(line)) {
            manual.push(line);
            continue;
        }

        // Abilità attivata: «{costo}: effetto». Il prefisso non contiene punti e
        // porta almeno un simbolo di mana o un {T}.
        const colon = line.indexOf(':');
        if (colon > 0 && colon < 80 && !/\./.test(line.slice(0, colon))) {
            const prefix = line.slice(0, colon);
            const cost = parseCost(prefix);
            if (cost.tap || cost.manaCost || cost.sacrificeSelf || cost.sacrificeOther) {
                const body = parseBody(line.slice(colon + 1));
                // Se l'abilità produce solo mana, la gestisce il pulsante Mana:
                // non è un'abilità da attivare con un effetto a parte.
                if (body.effects.length && body.effects.every(effect => effect.type === 'mana') && !body.unsupported.length) continue;
                activated.push({
                    cost,
                    effects: body.effects,
                    unsupported: body.unsupported,
                    text: line,
                    supported: !cost.sacrificeOther && body.effects.length > 0 && body.unsupported.length === 0
                });
                manual.push(...body.unsupported);
                continue;
            }
        }

        if (KEYWORD_LINE.test(line) || STATIC_LINE.test(line)) continue;

        // Anthem e tipi scelti sono testo continuo di un permanente, non frasi
        // di magia: li applica recomputeStatics finché la carta resta in campo.
        const staticEffect = isPermanentCard(card) ? parseStatic(line) : null;
        if (staticEffect) {
            statics.push({ effects: [staticEffect], unsupported: [], text: line });
            continue;
        }

        // Frasi di magia: per un permanente non vengono mai risolte dal motore
        // (si risolvono solo gli inneschi ETB), quindi qui si registrano e basta.
        // Una riga può contenere più frasi («Distruggi… Guadagni 4 vite»): si
        // spezzano, altrimenti la seconda rende manuale anche la prima.
        const body = parseBody(line);
        const skipped = body.unsupported.length ? body.unsupported : (body.effects.length ? [] : [line]);
        spells.push({ effects: body.effects, unsupported: skipped, text: line });
        manual.push(...skipped);
    }

    return { triggers, activated, spells, statics, manual: [...new Set(manual)] };
}

/** Etichetta breve per il pulsante dell'abilità attivata. */
export function abilityLabel(ability) {
    if (!ability) return 'Attiva';
    const { cost } = ability;
    const parts = [];
    if (cost.tap) parts.push('T');
    if (cost.manaCost) parts.push(cost.manaCost.replace(/\{([^}]+)\}/g, '$1'));
    if (cost.sacrificeSelf) parts.push('sac');
    const label = parts.length ? parts.join(' ') : 'Attiva';
    return label.length > 12 ? `${label.slice(0, 11)}…` : label;
}

/** Quanti effetti il motore applica davvero, senza contare i modi mancanti. */
export function automatedEffectCount(parsed = {}) {
    const triggers = (parsed.triggers || []).reduce((sum, trigger) => sum + trigger.effects.length, 0);
    const activated = (parsed.activated || []).reduce((sum, ability) => sum + (ability.supported ? ability.effects.length : 0), 0);
    const spells = (parsed.spells || []).reduce((sum, spell) => sum + (spell.modes ? (spell.supported || 0) : spell.effects.length), 0);
    const statics = (parsed.statics || []).reduce((sum, entry) => sum + entry.effects.length, 0);
    return triggers + activated + spells + statics;
}

/** Quante frasi della carta sono automatiche e quante restano manuali. */
export function textSupport(card) {
    const parsed = parseCardAbilities(card);
    return { automated: automatedEffectCount(parsed), manual: parsed.manual.length };
}

/* ───────────────────── effetti continui (anthem) ───────────────────── */

/**
 * Ricalcola i bonus statici: «le creature che controlli prendono +1/+1», i tipi
 * scelti e le parole chiave concesse. Scrivono in anthemBoost e anthemKeywords,
 * non in turnBoost: così i pompaggi «fino a fine turno» scadono senza toccare
 * gli anthem e viceversa. Va chiamato dopo ogni azione che cambia il campo.
 */
export function recomputeStatics(state) {
    if (!state?.playersData) return;
    for (const data of Object.values(state.playersData)) {
        for (const card of data.battlefield || []) {
            card.anthemBoost = { power: 0, toughness: 0 };
            card.anthemKeywords = [];
        }
    }
    for (const data of Object.values(state.playersData)) {
        const battlefield = data.battlefield || [];
        for (const watcher of battlefield) {
            const statics = parseCardAbilities(watcher).statics;
            if (!statics.length) continue;
            for (const entry of statics) {
                for (const effect of entry.effects) {
                    if (effect.type !== 'anthem') continue;
                    const subtype = effect.scope === 'chosenType' ? watcher.chosenType : effect.subtype;
                    for (const card of battlefield) {
                        if (!isCreature(card)) continue;
                        if (effect.excludeSelf && card === watcher) continue;
                        if (effect.scope === 'nontoken' && card.isToken) continue;
                        if (subtype && !new RegExp(`\\b${escapeRegExp(subtype)}\\b`, 'i').test(typeLine(card))) continue;
                        card.anthemBoost.power += effect.power;
                        card.anthemBoost.toughness += effect.toughness;
                        for (const keyword of effect.keywords) {
                            if (!card.anthemKeywords.includes(keyword)) card.anthemKeywords.push(keyword);
                        }
                    }
                }
            }
        }
    }
}

/**
 * «As this artifact enters, choose a creature type»: la scelta è fatta dal
 * motore (il tipo più diffuso fra le creature del controllore, a parità il
 * primo in ordine alfabetico) e scritta nel diario, quindi è visibile e
 * correggibile invece di restare nascosta.
 */
export function applyEntryStatics(state, controllerId, permanent) {
    const log = [];
    if (!state?.playersData?.[controllerId] || !permanent) return log;
    const statics = parseCardAbilities(permanent).statics.flatMap(entry => entry.effects);
    if (!permanent.chosenType && statics.some(effect => effect.type === 'chooseType')) {
        const counts = new Map();
        for (const card of state.playersData[controllerId].battlefield || []) {
            if (!isCreature(card) || card === permanent) continue;
            for (const type of creatureTypesOf(card)) counts.set(type, (counts.get(type) || 0) + 1);
        }
        const chosen = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '';
        permanent.chosenType = chosen;
        log.push(chosen
            ? `${permanent.name}: tipo scelto ${chosen} (il più diffuso fra le tue creature).`
            : `${permanent.name}: nessuna creatura fra cui scegliere il tipo.`);
    }
    recomputeStatics(state);
    return log;
}

/**
 * L'evento riguarda questo innesco? «When this enters» guarda solo la carta,
 * «whenever a creature you control with power 3 or greater enters» guarda il
 * soggetto che è entrato davvero, con il controllore giusto.
 */
export function triggerMatches(trigger, context = {}) {
    const subject = trigger.subject || { self: true };
    const { watcher, watcherOwnerId, source, sourceOwnerId, activePlayerId } = context;
    // L'evento sta sull'innesco; il soggetto può non ripeterlo (mantenimento).
    const event = subject.event || trigger.event;
    if (event === 'upkeep' || event === 'end') {
        return subject.who !== 'you' || watcherOwnerId === activePlayerId;
    }
    if (subject.self) return source === watcher;
    if (!source) return false;
    if (subject.excludeSelf && source === watcher) return false;
    if (subject.who === 'you' && sourceOwnerId !== watcherOwnerId) return false;
    if (subject.kind === 'creature' && !isCreature(source)) return false;
    if (subject.kind === 'artifact' && !/\bartifact\b/i.test(typeLine(source))) return false;
    if (subject.kind === 'enchantment' && !/\benchantment\b/i.test(typeLine(source))) return false;
    if (subject.nontoken && source.isToken) return false;
    if (subject.subtype && !new RegExp(`\\b${escapeRegExp(subject.subtype)}\\b`, 'i').test(typeLine(source))) return false;
    if (subject.minPower != null && powerOf(source) < subject.minPower) return false;
    return true;
}

function conditionMatches(state, controllerId, condition) {
    if (!condition) return true;
    const matching = (state.playersData?.[controllerId]?.battlefield || []).filter(card => {
        if (condition.kind === 'creature' && !isCreature(card)) return false;
        if (condition.kind === 'artifact' && !/\bartifact\b/i.test(typeLine(card))) return false;
        if (condition.kind === 'enchantment' && !/\benchantment\b/i.test(typeLine(card))) return false;
        if (condition.kind === 'land' && !isLand(card)) return false;
        return condition.minPower == null || powerOf(card) >= condition.minPower;
    });
    return matching.length >= (condition.count || 1);
}

/* ─────────────────────────── applicazione allo stato ─────────────────────────── */

const stripPunct = value => String(value || '').trim().toLowerCase().replace(/\.$/, '');

function parseTarget(state, target) {
    if (!target) return null;
    // L'identificativo di una carta contiene a sua volta dei «:»
    // (clientId:scryfallId:indice): si separano solo i primi due campi, il
    // resto è l'uid completo, altrimenti il bersaglio non viene mai trovato.
    const [kind, ownerId, ...rest] = String(target).split(':');
    const cardId = rest.join(':');
    if (kind === 'player') {
        const player = state.playersData?.[ownerId];
        return player ? { kind, player, ownerId } : null;
    }
    if (kind === 'card') {
        const player = state.playersData?.[ownerId];
        const card = (player?.battlefield || []).find(item => idOf(item) === cardId);
        return card ? { kind, player, card, ownerId } : null;
    }
    return null;
}

// Un permanente protetto o con velo non è un bersaglio legale per la magia.
function isIllegalTarget(card, controllerId, ownerId, spellColors = []) {
    if (ownerId === controllerId) return false;
    if (hasKeyword(card, 'hexproof')) return true;
    const text = oracleOf(card);
    const protection = text.match(/protection from ([\w\s,]+)/i);
    if (!protection) return false;
    const colours = protection[1].toLowerCase();
    if (/\beverything\b/.test(colours)) return true;
    const names = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };
    return spellColors.some(colour => colours.includes(names[colour] || '\u0000'));
}

function killPermanent(state, ownerId, card, reason, zone = 'graveyard') {
    const owner = state.playersData[ownerId];
    if (!owner) return [];
    if (zone === 'destroy' && hasKeyword(card, 'indestructible')) return [`${card.name} è indistruttibile.`];
    owner.battlefield = owner.battlefield.filter(item => item !== card);
    if (card.isCommander) {
        owner.commandZone = owner.commandZone || [];
        owner.commandZone.push(stripRuntime(card));
        return [`${card.name} ${reason === 'esiliata' ? 'esiliata' : 'distrutta'}: torna nella zona di comando.`];
    }
    if (zone === 'exile' || reason === 'esiliata') {
        owner.exile = owner.exile || [];
        owner.exile.push(stripRuntime(card));
        return [`${card.name} esiliata.`];
    }
    owner.graveyard = owner.graveyard || [];
    owner.graveyard.push(stripRuntime(card));
    return [`${card.name} ${reason || 'muore'}.`];
}

function loseLife(state, playerId, amount, note) {
    const player = state.playersData[playerId];
    if (!player || player.eliminated) return [];
    player.life -= amount;
    const log = [`${state.playerNames?.[playerId] || 'Un giocatore'}: ${amount} vite perse (${player.life}). ${note || ''}`.trim()];
    if (player.life <= 0) {
        player.life = 0;
        player.eliminated = true;
        log.push(`${state.playerNames?.[playerId] || 'Un giocatore'} è fuori: punti vita a zero.`);
    }
    return log;
}

function markedDamage(state, ownerId, card, amount) {
    const owner = state.playersData[ownerId];
    card.damageMarked = (card.damageMarked || 0) + amount;
    const log = [`${amount} danni a ${card.name} (${card.damageMarked}/${toughnessOf(card)}).`];
    if (toughnessOf(card) > 0 && card.damageMarked >= toughnessOf(card) && !hasKeyword(card, 'indestructible')) {
        log.push(...killPermanent(state, ownerId, card, 'muore'));
        return log;
    }
    if (hasKeyword(card, 'indestructible') && card.damageMarked >= toughnessOf(card)) log.push(`${card.name} è indistruttibile: resta in campo.`);
    if (owner) owner.landsPlayed = owner.landsPlayed || 0;
    return log;
}

const controllerName = (state, id) => state.playerNames?.[id] || 'il controllore';

/**
 * Applica una lista di effetti. Restituisce le righe di diario prodotte.
 * `context`: { state, controllerId, target, xValue, card, sourceName }.
 */
export function applyEffects(effects, context = {}) {
    const { state, controllerId, target = '', xValue = 0 } = context;
    const log = [];
    const unsupported = [];
    if (!state?.playersData?.[controllerId]) return { log, applied: 0, unsupported };
    const player = state.playersData[controllerId];
    const targetData = parseTarget(state, target);
    const spellColors = context.card?.colors || [];
    const sourceName = context.sourceName || context.card?.name || 'Effetto';
    let applied = 0;

    const needsTarget = () => {
        if (!targetData) return false;
        if (targetData.kind === 'card' && isIllegalTarget(targetData.card, controllerId, targetData.ownerId, spellColors)) {
            log.push(`${sourceName}: ${targetData.card.name} non è un bersaglio legale (velo o protezione).`);
            return false;
        }
        return true;
    };
    // I campi di gioco possono mancare sulle carte appena arrivate (pedine,
    // permanente appena lanciato): si assicurano prima di scriverci sopra.
    const ensureFields = card => {
        if (!card) return;
        card.counters = card.counters || { plusOne: 0 };
        card.turnBoost = card.turnBoost || { power: 0, toughness: 0 };
    };
    const targetCard = () => (targetData?.kind === 'card' ? targetData.card : null);
    const selfCard = () => (context.card && player.battlefield.includes(context.card) ? context.card : null);

    for (const effect of effects) {
        // «se controlli…»: la condizione si valuta ora, non quando si legge il testo.
        if (effect.condition && !conditionMatches(state, controllerId, effect.condition)) {
            log.push(`${sourceName}: condizione non soddisfatta (${effect.condition.kind}).`);
            continue;
        }
        switch (effect.type) {
            case 'draw': {
                let drawn = 0;
                for (let index = 0; index < effect.count; index += 1) {
                    if (!player.library.length) break;
                    player.hand.push(player.library.shift());
                    drawn += 1;
                }
                if (drawn < effect.count) {
                    player.eliminated = true;
                    log.push(`${controllerName(state, controllerId)} resta senza grimorio ed esce dalla partita.`);
                }
                log.push(`${sourceName}: peschi ${drawn} ${drawn === 1 ? 'carta' : 'carte'}.`);
                applied += 1;
                break;
            }
            case 'gainLife': {
                player.life += effect.count;
                log.push(`${sourceName}: guadagni ${effect.count} vite (${player.life}).`);
                applied += 1;
                break;
            }
            case 'loseLife': {
                const who = effect.who;
                if (who === 'each opponent') {
                    for (const id of state.players.filter(id => id !== controllerId && !state.playersData[id]?.eliminated)) {
                        log.push(...loseLife(state, id, effect.count, sourceName));
                    }
                } else if (who === 'each player') {
                    for (const id of state.players.filter(id => !state.playersData[id]?.eliminated)) {
                        log.push(...loseLife(state, id, effect.count, sourceName));
                    }
                } else if (who === 'controller' || who === 'you') {
                    log.push(...loseLife(state, controllerId, effect.count, sourceName));
                } else if (targetData?.kind === 'player' && needsTarget()) {
                    log.push(...loseLife(state, targetData.ownerId, effect.count, sourceName));
                } else {
                    unsupported.push(effect.who === 'that player' ? 'perdita di vita di «quel giocatore»' : 'perdita di vita senza bersaglio');
                    break;
                }
                log.push(`${sourceName}: ${effect.count} vite perse.`);
                applied += 1;
                break;
            }
            case 'damage': {
                const amount = effect.amount;
                if (effect.to === 'controller') {
                    log.push(...loseLife(state, controllerId, amount, sourceName));
                    applied += 1;
                    break;
                }
                if (effect.to === 'target' || effect.to === 'targetCreature' || effect.to === 'targetPermanent') {
                    if (!targetData) { unsupported.push('danno senza bersaglio'); break; }
                    if (!needsTarget()) break;
                    if (targetData.kind === 'player') log.push(...loseLife(state, targetData.ownerId, amount, sourceName));
                    else log.push(...markedDamage(state, targetData.ownerId, targetData.card, amount));
                } else if (effect.to === 'targetPlayer' || effect.to === 'targetOpponent') {
                    if (targetData?.kind !== 'player') { unsupported.push('danno a giocatore senza bersaglio'); break; }
                    if (!needsTarget()) break;
                    log.push(...loseLife(state, targetData.ownerId, amount, sourceName));
                } else if (effect.to === 'eachCreature' || effect.to === 'eachOtherCreature') {
                    const victims = [];
                    for (const [ownerId, data] of Object.entries(state.playersData)) {
                        for (const card of [...data.battlefield]) {
                            if (!isCreature(card)) continue;
                            if (effect.to === 'eachOtherCreature' && card === selfCard()) continue;
                            victims.push([ownerId, card]);
                        }
                    }
                    for (const [ownerId, card] of victims) log.push(...markedDamage(state, ownerId, card, amount));
                    log.push(`${sourceName}: ${amount} danni a ogni creatura.`);
                } else if (effect.to === 'eachOpponent' || effect.to === 'eachPlayer') {
                    const ids = effect.to === 'eachOpponent'
                        ? state.players.filter(id => id !== controllerId)
                        : state.players;
                    for (const id of ids) if (!state.playersData[id]?.eliminated) log.push(...loseLife(state, id, amount, sourceName));
                } else if (effect.to === 'thatCreature') {
                    if (!targetData || targetData.kind !== 'card') { unsupported.push('danno a «quella creatura» senza bersaglio'); break; }
                    log.push(...markedDamage(state, targetData.ownerId, targetData.card, amount));
                } else {
                    unsupported.push('danno su un bersaglio non gestito');
                    break;
                }
                applied += 1;
                break;
            }
            case 'destroy':
            case 'exile': {
                const zone = effect.type === 'exile' ? 'exile' : 'destroy';
                if (effect.scope === 'target') {
                    if (!targetData || targetData.kind !== 'card') { unsupported.push('distruzione senza bersaglio'); break; }
                    if (!needsTarget()) break;
                    log.push(...killPermanent(state, targetData.ownerId, targetData.card, effect.type === 'exile' ? 'esiliata' : 'distrutta', zone));
                } else {
                    const filter = effect.scope === 'allCreatures' ? isCreature
                        : effect.scope === 'allArtifacts' ? card => /\bartifact\b/i.test(typeLine(card))
                            : effect.scope === 'allEnchantments' ? card => /\benchantment\b/i.test(typeLine(card))
                                : effect.scope === 'allLands' ? isLand
                                    : () => true;
                    const victims = [];
                    for (const [ownerId, data] of Object.entries(state.playersData)) {
                        for (const card of [...data.battlefield]) if (filter(card)) victims.push([ownerId, card]);
                    }
                    for (const [ownerId, card] of victims) {
                        log.push(...killPermanent(state, ownerId, card, effect.type === 'exile' ? 'esiliata' : 'distrutta', zone));
                    }
                    log.push(`${sourceName}: ${victims.length} permanenti ${effect.type === 'exile' ? 'esiliati' : 'distrutti'}.`);
                }
                applied += 1;
                break;
            }
            case 'pump': {
                const card = effect.to === 'self' ? selfCard() : targetCard();
                if (!card) { unsupported.push('pompaggio senza bersaglio'); break; }
                if (effect.to === 'target' && !needsTarget()) break;
                ensureFields(card);
                card.turnBoost.power += effect.power;
                card.turnBoost.toughness += effect.toughness;
                log.push(`${sourceName}: ${card.name} ${effect.power >= 0 ? '+' : ''}${effect.power}/${effect.toughness >= 0 ? '+' : ''}${effect.toughness}.`);
                if (toughnessOf(card) <= 0) log.push(...killPermanent(state, targetData?.ownerId || controllerId, card, 'muore'));
                applied += 1;
                break;
            }
            case 'grantKeyword': {
                const card = effect.to === 'self' ? selfCard() : targetCard();
                if (!card) { unsupported.push('parola chiave senza bersaglio'); break; }
                if (effect.to === 'target' && !needsTarget()) break;
                card.grantedKeywords = [...new Set([...(card.grantedKeywords || []), effect.keyword])];
                card.keywords = [...new Set([...(card.keywords || []), effect.keyword])];
                log.push(`${sourceName}: ${card.name} ha ${effect.keyword} fino a fine turno.`);
                applied += 1;
                break;
            }
            case 'counters': {
                const card = effect.to === 'self' ? selfCard() : targetCard();
                if (!card) { unsupported.push('segnalini senza bersaglio'); break; }
                if (effect.to === 'target' && !needsTarget()) break;
                ensureFields(card);
                card.counters.plusOne += effect.count;
                log.push(`${sourceName}: ${effect.count} segnalini +1/+1 su ${card.name}.`);
                applied += 1;
                break;
            }
            case 'tokens': {
                player.battlefield = player.battlefield || [];
                for (let index = 0; index < effect.count; index += 1) {
                    player.battlefield.push({
                        id: `token-${crypto.randomUUID()}`,
                        instanceId: `token-${crypto.randomUUID()}`,
                        name: `${effect.label || 'Creatura'} Token`,
                        typeLine: `Token Creature — ${effect.label || 'Creatura'}`,
                        power: String(effect.power), toughness: String(effect.toughness),
                        manaCost: '', cmc: 0, image: '', tapped: false, summoningSick: true,
                        enteredThisTurn: true,
                        counters: { plusOne: 0 }, turnBoost: { power: 0, toughness: 0 }, damageMarked: 0,
                        isToken: true
                    });
                }
                log.push(`${sourceName}: crei ${effect.count} pedine ${effect.power}/${effect.toughness}.`);
                applied += 1;
                break;
            }
            case 'bounce': {
                if (!targetData || targetData.kind !== 'card') { unsupported.push('ritorno in mano senza bersaglio'); break; }
                if (!needsTarget()) break;
                const owner = state.playersData[targetData.ownerId];
                owner.battlefield = owner.battlefield.filter(item => item !== targetData.card);
                owner.hand.push(stripRuntime(targetData.card));
                log.push(`${sourceName}: ${targetData.card.name} torna in mano a ${controllerName(state, targetData.ownerId)}.`);
                applied += 1;
                break;
            }
            case 'tap':
            case 'untap': {
                const cards = effect.scope === 'self'
                    ? [selfCard()].filter(Boolean)
                    : [targetCard()].filter(Boolean);
                if (!cards.length) { unsupported.push('tappare senza bersaglio'); break; }
                if (effect.scope === 'target' && !needsTarget()) break;
                for (const card of cards) card.tapped = effect.type === 'tap';
                log.push(`${sourceName}: ${cards.map(card => card.name).join(', ')} ${effect.type === 'tap' ? 'tappata' : 'stappata'}.`);
                applied += 1;
                break;
            }
            case 'mill': {
                let milled = 0;
                for (let index = 0; index < effect.count; index += 1) {
                    if (!player.library.length) break;
                    player.graveyard = player.graveyard || [];
                    player.graveyard.push(player.library.shift());
                    milled += 1;
                }
                log.push(`${sourceName}: metti ${milled} carte dal grimorio al cimitero.`);
                applied += 1;
                break;
            }
            case 'searchBasic': {
                const found = [];
                for (let index = 0; index < effect.count; index += 1) {
                    const position = player.library.findIndex(card => isBasicLand(card) && !card.tapped);
                    if (position < 0) break;
                    found.push(player.library.splice(position, 1)[0]);
                }
                for (const land of found) {
                    player.battlefield.push({
                        ...land, instanceId: land.uid || land.instanceId, tapped: true, summoningSick: false,
                        counters: { plusOne: 0 }, turnBoost: { power: 0, toughness: 0 }, damageMarked: 0
                    });
                }
                log.push(found.length
                    ? `${sourceName}: cerchi ${found.map(land => land.name).join(', ')} e la metti in campo tappata.`
                    : `${sourceName}: nessuna terra base nel grimorio.`);
                applied += 1;
                break;
            }
            case 'support': {
                // «Support 2»: un +1/+1 su ciascuna di fino a due creature che
                // controlli, scelte fra le più forti. La scelta è nel diario.
                const helpers = (player.battlefield || [])
                    .filter(card => isCreature(card) && card !== selfCard())
                    .sort((a, b) => powerOf(b) - powerOf(a))
                    .slice(0, effect.count);
                for (const card of helpers) {
                    ensureFields(card);
                    card.counters.plusOne += 1;
                }
                log.push(helpers.length
                    ? `${sourceName}: supporto ${effect.count}, +1/+1 su ${helpers.map(card => card.name).join(', ')}.`
                    : `${sourceName}: nessuna creatura da supportare.`);
                if (helpers.length) applied += 1;
                break;
            }
            case 'cantBlock': {
                const card = effect.to === 'self' ? selfCard() : targetCard();
                if (!card) { unsupported.push('divieto di bloccare senza bersaglio'); break; }
                card.cannotBlock = true;
                log.push(`${sourceName}: ${card.name} non può bloccare in questo turno.`);
                applied += 1;
                break;
            }
            case 'mana':
                // Riconosciuto, ma senza effetto sullo stato: la produzione di mana
                // passa dal pulsante Mana (magicRules.manaAbilityOptions).
                break;

            default:
                unsupported.push(`effetto «${effect.type}» non gestito`);
        }
    }

    // Gli effetti possono aver cambiato il campo (pedine, permanenti): i bonus
    // statici vanno ricalcolati prima di restituire lo stato.
    recomputeStatics(state);
    return { log, applied, unsupported: [...new Set(unsupported)] };
}

/** Le frasi non riconosciute diventano una riga di diario, mai un silenzio. */
export const manualNotice = (name, unsupported) => `${name}: da gestire a mano (${unsupported.slice(0, 2).join('; ')}).`;
