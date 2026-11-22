// Schema dello stato di partita e suoi controlli.
//
// Il motore storico conosce quattro fasi (`main1`, `combat`, `main2`, `end`):
// qui vive la mappa verso i dodici passi delle Comprehensive Rules (500–514),
// così l'interfaccia può mostrare il passo vero senza che il motore cambi
// semantica in un colpo solo. `stateViolations` è la rete di sicurezza dei
// test: una carta non può stare in due zone, e un identificativo non può
// comparire due volte.

export const GAME_VERSION = 4;

export const STEPS = Object.freeze([
    { id: 'untap', label: 'Stappa' },
    { id: 'upkeep', label: 'Mantenimento' },
    { id: 'draw', label: 'Pescata' },
    { id: 'main1', label: 'Principale I' },
    { id: 'beginCombat', label: 'Inizio combattimento' },
    { id: 'declareAttackers', label: 'Attaccanti' },
    { id: 'declareBlockers', label: 'Bloccanti' },
    { id: 'combatDamage', label: 'Danno' },
    { id: 'endCombat', label: 'Fine combattimento' },
    { id: 'main2', label: 'Principale II' },
    { id: 'end', label: 'Fine turno' },
    { id: 'cleanup', label: 'Pulizia' }
]);

export const STEP_INDEX = Object.freeze(Object.fromEntries(STEPS.map((step, index) => [step.id, index])));

export const ZONES = Object.freeze(['library', 'hand', 'battlefield', 'graveyard', 'exile', 'commandZone', 'stack']);

export const isStep = id => Object.prototype.hasOwnProperty.call(STEP_INDEX, id);

/** L'identificativo fisico di una carta: `instanceId` prima di `uid`, come il tavolo. */
export const cardIdOf = card => String(card?.instanceId ?? card?.uid ?? card?.id ?? '');

/**
 * Il passo corrente. Finché il motore storico non ha i passi veri, il
 * combattimento si deduce dal suo sotto-stato: nessun dato inventato.
 */
export function stepOf(state) {
    if (!state) return 'main1';
    if (isStep(state.step)) return state.step;
    if (state.phase === 'combat') {
        const step = state.combat?.step;
        if (step === 'blockers') return 'declareBlockers';
        if (step === 'damage') return 'combatDamage';
        if (step === 'done') return 'endCombat';
        return 'declareAttackers';
    }
    if (state.phase === 'main2') return 'main2';
    if (state.phase === 'end') return 'end';
    return 'main1';
}

/** I dodici passi con quello corrente acceso: forma unica per ogni UI. */
export function stepsView(state) {
    const current = stepOf(state);
    const index = STEP_INDEX[current];
    return STEPS.map((step, position) => ({
        id: step.id,
        label: step.label,
        active: step.id === current,
        done: position < index
    }));
}

/** Tutte le carte nello stato, con la zona in cui si trovano. */
export function locatedCards(state) {
    const out = [];
    for (const zone of ZONES) {
        if (zone === 'stack') {
            for (const item of state?.stack || []) {
                const card = item?.card || item;
                if (card) out.push({ card, zone, ownerId: item?.controllerId || card.ownerId || '', item });
            }
            continue;
        }
        if (zone === 'commandZone' || zone === 'graveyard' || zone === 'exile') {
            for (const playerId of state?.players || []) {
                for (const card of state.playersData?.[playerId]?.[zone] || []) out.push({ card, zone, ownerId: playerId });
            }
            continue;
        }
        for (const playerId of state?.players || []) {
            const data = state.playersData?.[playerId] || {};
            const list = zone === 'battlefield'
                ? [...(data.battlefield || []), ...(data.creatures || [])]
                : data[zone] || [];
            for (const card of list) out.push({ card, zone, ownerId: playerId });
        }
    }
    return out;
}

/**
 * Violazioni dello schema: una carta in due zone, un identificativo ripetuto,
 * una carta senza identificativo. Il motore non deve mai produrle; i test le
 * cercano dopo ogni scenario per non scoprirle a partita in corso.
 */
export function stateViolations(state) {
    const problems = [];
    const seen = new Map();
    for (const { card, zone, ownerId } of locatedCards(state)) {
        const id = cardIdOf(card);
        if (!id) {
            problems.push({ reason: 'carta senza identificativo', zone, ownerId, card: card?.name || '' });
            continue;
        }
        const key = `${id}`;
        if (seen.has(key)) {
            const before = seen.get(key);
            problems.push({
                reason: 'carta in due zone', id, card: card?.name || '',
                zones: [before.zone, zone], owners: [before.ownerId, ownerId]
            });
            continue;
        }
        seen.set(key, { zone, ownerId });
    }
    if (state?.playersData) {
        for (const [playerId, data] of Object.entries(state.playersData)) {
            for (const zone of ['hand', 'library', 'battlefield', 'graveyard', 'exile']) {
                const list = data?.[zone] || [];
                if (new Set(list).size !== list.length) {
                    problems.push({ reason: 'la stessa carta compare due volte nella lista', zone, ownerId: playerId });
                }
            }
        }
    }
    return problems;
}

/** Serializzazione stabile: chiavi ordinate, così l'hash non dipende dall'ordine. */
export function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const keys = Object.keys(value).filter(key => value[key] !== undefined).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

/** FNV-1a a 32 bit: un'impronta basta a dire «stessa partita» in un replay. */
export function stateHash(state) {
    const text = stableStringify(state);
    let hash = 0x811C9DC5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}
