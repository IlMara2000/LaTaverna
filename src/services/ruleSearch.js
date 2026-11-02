// Ricerca full-testo sulle regole aperte del SRD 5.1 (CC BY 4.0).
// Il corpus è caricato in modo pigro: solo quando la vista "Regole" viene aperta.

const STOPWORDS = new Set([
    // italiano
    'a', 'ad', 'al', 'alla', 'alle', 'allo', 'ai', 'agli', 'anche', 'avere', 'che', 'chi',
    'come', 'con', 'contro', 'da', 'dal', 'dalla', 'dalle', 'dal', 'dei', 'delle', 'del',
    'di', 'dopo', 'dove', 'e', 'ed', 'egli', 'era', 'erano', 'essere', 'essi', 'fin',
    'fra', 'fu', 'giu', 'ha', 'hanno', 'ho', 'i', 'il', 'in', 'io', 'la', 'le', 'lei',
    'lo', 'lui', 'ma', 'me', 'mia', 'miei', 'mie', 'mio', 'ne', 'nel', 'nella', 'nelle',
    'nello', 'nei', 'negli', 'noi', 'non', 'nostra', 'nostro', 'o', 'ogni', 'per', 'perche',
    'piu', 'puo', 'qualche', 'quale', 'quali', 'quando', 'quelli', 'quello', 'questa',
    'queste', 'questi', 'questo', 'sei', 'suo', 'sua', 'suoi', 'sue', 'se', 'sempre',
    'si', 'sia', 'siamo', 'sono', 'sta', 'stato', 'stessa', 'stesso', 'su', 'sul', 'sulla',
    'tuo', 'tua', 'tuoi', 'tue', 'tu', 'tutti', 'tutto', 'un', 'una', 'uno', 'vostra',
    'vostro', 'voi', 'funziona', 'funzionare', 'fare', 'fatto', 'gioco', 'regola', 'regole',
    // english
    'the', 'a', 'an', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'was',
    'were', 'be', 'been', 'it', 'its', 'this', 'that', 'these', 'those', 'at', 'by',
    'from', 'as', 'with', 'which', 'who', 'whom', 'what', 'when', 'where', 'how', 'do',
    'does', 'did', 'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might',
    'you', 'your', 'they', 'them', 'their', 'we', 'our', 'us', 'i', 'me', 'my', 'he',
    'she', 'his', 'her', 'not', 'no', 'if', 'then', 'than', 'into', 'about', 'also',
    'use', 'used', 'using', 'one', 'two', 'per', 'each', 'any', 'all', 'more', 'most',
]);

// Dizionario italiano → inglese: traduce i termini delle regole nelle query
// sul testo ufficiale del SRD, che è disponibile solo in inglese con licenza aperta.
const IT_EN = {
    // caratteristiche e prove
    abilita: 'ability skill', prova: 'check', prove: 'check',
    salvifico: 'saving', salvifica: 'saving', salvifici: 'saving', tiro: 'roll',
    forza: 'strength', destrezza: 'dexterity', costituzione: 'constitution',
    intelligenza: 'intelligence', saggezza: 'wisdom', carisma: 'charisma',
    caratteristica: 'ability', caratteristiche: 'ability', statistiche: 'ability scores',
    // combattimento
    opportunita: 'opportunity', attacco: 'attack', colpire: 'attack', difesa: 'defense',
    reazione: 'reaction', azione: 'action', azioni: 'action', turno: 'round turn',
    movimento: 'movement', iniziativa: 'initiative', copertura: 'cover',
    portata: 'range reach', gittata: 'range', danno: 'damage',
    ferite: 'hit points', ferita: 'hit points',
    punti: 'points', morte: 'death', morente: 'dying', scappare: 'escape',
    occultamento: 'stealth', furtivo: 'stealth', furtivita: 'stealth', nascosto: 'hidden',
    passivo: 'passive',    vantaggio: 'advantage feat', svantaggio: 'disadvantage',
    penalita: 'penalty', bonus: 'bonus', incontro: 'encounter', combattimento: 'combat',
    battaglia: 'combat', minaccia: 'threat', bersaglio: 'target', colpo: 'strike',
    disarmo: 'disarm', slancio: 'shove', presa: 'grapple', stordito: 'stunned',
    // incantesimi
    incantesimo: 'spell', incantesimi: 'spell', magia: 'magic', magico: 'magic',
    concentrazione: 'concentration', slot: 'slot', verbo: 'verbal', verbale: 'verbal',
    sommossa: 'somatic', sommatico: 'somatic', materiale: 'material',
    preparare: 'prepare', preparato: 'prepared', lancio: 'cast', lanciare: 'cast',
    // personaggio
    classe: 'class', razza: 'race', livello: 'level', esperienza: 'experience',
    xp: 'experience points', vantaggi: 'feat', vantaggio_: 'feat', origine: 'background',
    origini: 'background', linguaggio: 'language', linguaggi: 'languages',
    multiclasse: 'multiclassing', ispirazione: 'inspiration',
    // equipaggiamento
    arma: 'weapon', armi: 'weapon', armatura: 'armor', scudo: 'shield',
    equipaggiamento: 'equipment', oggetto: 'item', oggetti: 'items', zaino: 'pack',
    denaro: 'money', monete: 'coin', peso: 'weight', munizioni: 'ammunition',
    torcia: 'light', pozione: 'potion', pergamena: 'scroll',
    // condizioni
    avvelenato: 'poisoned', paralizzato: 'paralyzed', accecato: 'blinded',
    assordato: 'deafened', invisibile: 'invisible', spaventato: 'frightened',
    impedito: 'restrained', legato: 'restrained', pietrificato: 'petrified',
    incosciente: 'unconscious', addormentato: 'asleep', aterra: 'prone', caduto: 'prone',
    confuso: 'confused',
    // ambienti e movimento
    terreno: 'terrain', griglia: 'grid', casella: 'square', spazio: 'space',
    volo: 'fly flying', nuoto: 'swim', arrampicata: 'climb', caduta: 'fall',
    scivoloso: 'difficult terrain',
    // avventura e regole
    allineamento: 'alignment', buono: 'good', malvagio: 'evil', neutrale: 'neutral',
    legale: 'lawful', caotico: 'chaotic', riposo: 'rest', sonno: 'sleep',
    accampamento: 'camp', avventura: 'adventure', avventuriero: 'adventurer',
    perceptione: 'perception', percezione: 'perception', investigazione: 'investigation',
    religione: 'religion', arcano: 'arcana', storia: 'history', natura: 'nature',
    sopravvivenza: 'survival', medicina: 'medicine', artigianato: 'artisan',
    ladro: 'rogue thief', furto: 'sleight', monaco: 'monk', sacerdote: 'cleric',
    mago: 'wizard', guerriero: 'fighter', barabaro: 'barbarian', barbaro: 'barbarian',
    bardo: 'bard', druido: 'druid', paladino: 'paladin',
    cacciatore: 'ranger', stregone: 'sorcerer', warlock: 'warlock', patto: 'pact',
    mostro: 'monster', mostri: 'monsters', creatura: 'creature', creatture: 'creatures',
    nemico: 'enemy', alleato: 'ally', png: 'npc', seguito: 'follower',
    guarigione: 'healing', curare: 'healing', resurrezione: 'resurrection',
    guarito: 'healing', colpo: 'hit strike', colpi: 'hits', stordito: 'stunned',
};

const normalize = value => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function tokenize(query) {
    const words = normalize(query).match(/[a-z0-9']+/g) || [];
    const tokens = [];
    const seen = new Set();
    const add = token => {
        if (token.length < 2 || seen.has(token)) return;
        seen.add(token);
        tokens.push(token);
    };
    for (const word of words) {
        if (STOPWORDS.has(word)) continue;
        add(word);
        // plurale inglese → singolare (il testo contiene anche i plurali)
        if (word.length > 3 && word.endsWith('s')) add(word.slice(0, -1));
        for (const mapped of (IT_EN[word] || '').split(' ')) add(mapped);
    }
    return tokens;
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function countOccurrences(haystack, needle) {
    let count = 0;
    let index = haystack.indexOf(needle);
    while (index !== -1 && count < 8) {
        count += 1;
        index = haystack.indexOf(needle, index + needle.length);
    }
    return count;
}

// Ritorna la finestra di testo intorno al primo termine trovato, spezzettata
// in segmenti con flag "mark" per l'evidenziazione, senza interpretare HTML.
export function snippetSegments(text, tokens, windowSize = 260) {
    const normalized = normalize(text);
    let center = -1;
    for (const token of tokens) {
        const index = normalized.indexOf(token);
        if (index !== -1 && (center === -1 || index < center)) center = index;
    }
    if (center === -1) center = 0;
    let start = Math.max(0, center - Math.floor(windowSize / 3));
    while (start > 0 && normalized[start - 1] !== ' ') start -= 1;
    let end = Math.min(text.length, start + windowSize);
    if (end < text.length) {
        const space = normalized.indexOf(' ', end);
        if (space !== -1 && space - start < windowSize + 40) end = space;
    }
    const slice = text.slice(start, end);
    const sliceNormalized = normalized.slice(start, end);
    const ordered = [...tokens].sort((a, b) => b.length - a.length);
    const segments = [];
    let index = 0;
    let buffer = '';
    while (index < sliceNormalized.length) {
        const match = ordered.find(token => sliceNormalized.startsWith(token, index));
        if (match) {
            if (buffer) { segments.push({ t: buffer, mark: false }); buffer = ''; }
            segments.push({ t: slice.slice(index, index + match.length), mark: true });
            index += match.length;
        } else {
            buffer += slice[index];
            index += 1;
        }
    }
    if (buffer) segments.push({ t: buffer, mark: false });
    if (start > 0) segments.unshift({ t: '…', mark: false });
    if (end < text.length) segments.push({ t: '…', mark: false });
    return segments;
}

const CATEGORY_LABELS = {
    Abilities: 'Caratteristiche', Backgrounds: 'Origini', 'Between Adventures': 'Tra le avventure',
    Character: 'Personaggio', Classes: 'Classi', Combat: 'Combattimento', Conditions: 'Condizioni',
    Diseases: 'Malattie', Environment: 'Ambiente', Equipment: 'Equipaggiamento', Feats: 'Vantaggi',
    Gods: 'Divinità', Madness: 'Follia', 'Magic Items': 'Oggetti magici', Monsters: 'Mostri',
    Movement: 'Movimento', NPCs: 'PNG', Objects: 'Oggetti', Planes: 'Piani', Poisons: 'Veleni',
    Races: 'Razze', Resting: 'Riposo', Spellcasting: 'Lancio di incantesimi', Spells: 'Incantesimi',
    Time: 'Tempo', Traps: 'Trappole',
};

export function categoryLabel(category) {
    const [top, ...rest] = String(category || '').split(' / ');
    return [CATEGORY_LABELS[top] || top, ...rest].join(' / ');
}

// Il corpus viene iniettato nei test; in produzione lo carica loadRuleSearch().
export function createRuleSearch(corpus) {
    const passages = Array.isArray(corpus) ? corpus : corpus?.passages || [];
    let prepared = null;
    return function search(query, { limit = 8 } = {}) {
        const tokens = tokenize(query);
        if (!tokens.length || !passages.length) return [];
        if (!prepared) {
            prepared = passages.map(passage => ({
                ...passage,
                normalizedTitle: normalize(passage.t),
                normalizedText: normalize(passage.x),
            }));
        }
        const phrase = normalize(query)
            .replace(/[^a-z0-9' ]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const phraseWords = phrase.split(' ').filter(word => word.length > 1 && !STOPWORDS.has(word));
        // Peso IDF: i termini tecnici rari ("opportunity") pesano più dei termini
        // comuni ("creature"), così la regola esatta scala sopra i richiami generici.
        const weights = new Map();
        for (const token of tokens) {
            let docs = 0;
            for (const passage of prepared) {
                if (passage.normalizedText.includes(token) || passage.normalizedTitle.includes(token)) docs += 1;
            }
            weights.set(token, Math.log((prepared.length + 1) / (docs + 1)) + 1);
        }
        const scored = [];
        for (const passage of prepared) {
            let score = 0;
            let matched = 0;
            for (const token of tokens) {
                const weight = weights.get(token);
                const inText = countOccurrences(passage.normalizedText, token);
                const inTitle = passage.normalizedTitle.includes(token) ? 1 : 0;
                if (!inText && !inTitle) continue;
                matched += 1;
                score += Math.min(inText, 4) * weight + inTitle * 2 * weight;
            }
            if (!matched) continue;
            if (matched === tokens.length) score += 5;
            if (phraseWords.length > 1 && passage.normalizedText.includes(phrase)) score += 8;
            scored.push({ passage, score });
        }
        scored.sort((a, b) => b.score - a.score || a.passage.x.length - b.passage.x.length);
        return scored.slice(0, limit).map(({ passage, score }) => ({
            category: passage.c,
            title: passage.t,
            score,
            segments: snippetSegments(passage.x, tokens),
        }));
    };
}

let loader;
export function loadRuleSearch() {
    loader ||= import('../data/srd/corpus.json')
        .then(module => createRuleSearch(module.default || module));
    return loader;
}
