// Lo stack (CR 405, 608) e il lancio delle magie che ci passano (CR 601).
//
// Il motore storico risolveva una magia nello stesso istante in cui veniva
// lanciata: nessuno poteva rispondere, e «lancio un istantaneo» e «risolvo
// l'istantaneo» erano la stessa cosa. Qui il lancio e la risoluzione sono due
// momenti separati: la carta va sullo stack, i giocatori ricevono priorità, e
// solo quando tutti passano la cima si risolve (last in, first out).
//
// L'effetto vero resta nel motore storico (`resolveSpell`): qui si decide
// *quando* accade, non *cosa* accade.

import {
    isPermanentCard, manaPoolLabel, spellNeedsTarget
} from '../../magicRules.js';
import { applyEffects, manualNotice, parseCardAbilities } from '../../magicEffects.js';
import {
    MATCH_RULES, paySpellCost, resolveSpell, settleState, spellCost
} from '../../magicMatchEngine.js';
import { hasPriority, resetPriority } from './priority.js';
import { stepOf } from './state.js';

const idOf = card => String(card?.instanceId ?? card?.uid ?? card?.id ?? '');
const isLand = card => /\bland\b/i.test(String(card?.typeLine || ''));
const isInstant = card => /\binstant\b/i.test(String(card?.typeLine || ''));
const hasKeyword = (card, word) => (card?.keywords || []).some(key => String(key).toLowerCase() === word);
const playerName = (state, id) => state.playerNames?.[id] || `Giocatore ${state.players.indexOf(id) + 1}`;
const log = (state, line) => { state.log = [line, ...(state.log || [])].slice(0, 40); };
// Le righe di un effetto si leggono in ordine, ma il diario tiene la più
// recente in cima: si inseriscono rovesciate. Stessa regola di logLines nel
// motore storico.
const logLines = (state, lines = []) => {
    if (lines.length) state.log = [...lines.slice().reverse(), ...(state.log || [])].slice(0, 40);
};

const nextStackId = state => {
    const n = Math.max(0, Number(state.stackSeq) || 0) + 1;
    state.stackSeq = n;
    return `s${n}`;
};

/** L'etichetta leggibile di un bersaglio nel formato `card:<giocatore>:<uid>`. */
export function targetLabelOf(state, target = '') {
    const match = /^card:([^:]+):(.+)$/.exec(String(target || ''));
    if (!match) return '';
    const [, ownerId, uid] = match;
    const zones = ['battlefield', 'graveyard', 'exile', 'commandZone', 'hand', 'library'];
    for (const id of [...(state.players || []), ownerId]) {
        for (const zone of zones) {
            const found = (state.playersData?.[id]?.[zone] || []).find(card => idOf(card) === uid);
            if (found) return found.name || uid;
        }
    }
    return '';
}

/**
 * Una magia va sullo stack. Il costo si paga subito (CR 601.2h), la carta
 * esce dalla mano subito, l'effetto aspetta. Le magie non istantanee hanno il
 * vincolo delle fasi principali e dello stack vuoto (CR 307.1, 308.1).
 */
export function castToStack(currentState, playerId, { uid, target = '', mode = null, xValue = 0 } = {}) {
    const state = structuredClone(currentState);
    const player = state.playersData?.[playerId];
    if (!player) throw new Error('Non fai parte di questa partita.');
    if (player.eliminated) throw new Error('Sei fuori dalla partita.');
    if (state.winner) throw new Error('La partita è conclusa.');
    if (state.mulliganActive) throw new Error('Prima scegliete la mano iniziale.');
    if (state.pendingChoice) throw new Error('C’è una scelta in sospeso: prima si risolve quella.');
    if (!hasPriority(state, playerId)) throw new Error('Non hai la priorità.');

    let index = (player.hand || []).findIndex(card => card.uid === uid);
    let fromCommandZone = false;
    if (index < 0) {
        const zoneIndex = (player.commandZone || []).findIndex(card => card.uid === uid);
        if (zoneIndex < 0) throw new Error('La carta non è nella tua mano.');
        fromCommandZone = true;
        index = zoneIndex;
    }
    const card = fromCommandZone ? player.commandZone[index] : player.hand[index];
    if (isLand(card)) throw new Error('Le terre non vanno sullo stack: si giocano con «Gioca terra».');

    const instantSpeed = isInstant(card) || hasKeyword(card, 'flash');
    if (!instantSpeed) {
        if (state.activePlayer !== playerId) throw new Error('Non è il tuo turno: solo un istantaneo può rispondere.');
        if ((state.stack || []).length) throw new Error('Lo stack non è vuoto: aspetta che si risolva.');
        if (!['main1', 'main2'].includes(stepOf(state))) {
            throw new Error('Una magia normale si lancia solo durante una fase principale.');
        }
    }

    paySpellCost(state, player, spellCost(player, card, fromCommandZone), 0, Number(xValue) || 0);
    if (fromCommandZone) {
        player.commandZone.splice(index, 1);
        player.commanderCasts = player.commanderCasts || {};
        player.commanderCasts[card.uid] = (player.commanderCasts[card.uid] || 0) + 1;
    } else {
        player.hand.splice(index, 1);
    }

    const item = {
        id: nextStackId(state),
        kind: 'spell',
        controllerId: playerId,
        sourceId: card.uid,
        card,
        fromCommandZone,
        target: String(target || ''),
        targetLabel: targetLabelOf(state, target),
        targets: target ? [String(target)] : [],
        mode: mode ?? null,
        xValue: Math.max(0, Number(xValue) || 0),
        requiresTarget: spellNeedsTarget(card)
    };
    state.stack = [...(state.stack || []), item];
    // Chi lancia riceve di nuovo la priorità (CR 117.3d): può rispondere a se
    // stesso, e gli altri ricevono la priorità solo dopo che passa.
    resetPriority(state, playerId);
    log(state, `${playerName(state, playerId)} mette ${card.name} sullo stack.`);
    return state;
}

/**
 * Un'abilità attivata va sullo stack (CR 602.2) e i suoi costi si pagano
 * all'attivazione: tappare la fonte non aspetta la risoluzione. L'effetto resta
 * l'elenco già compilato da `parseCardAbilities`: se la fonte sparisce prima
 * della risoluzione, l'abilità si risolve lo stesso (608.2b) — è il caso di
 * «sacrifica questa creatura: pesca una carta».
 */
export function activateToStack(currentState, playerId, { uid, index = 0, target = '' } = {}) {
    const state = structuredClone(currentState);
    const player = state.playersData?.[playerId];
    if (!player) throw new Error('Non fai parte di questa partita.');
    if (state.winner) throw new Error('La partita è conclusa.');
    if (state.mulliganActive) throw new Error('Prima scegliete la mano iniziale.');
    if (state.pendingChoice) throw new Error('C’è una scelta in sospeso: prima si risolve quella.');
    if (!hasPriority(state, playerId)) throw new Error('Non hai la priorità.');
    const card = (player.battlefield || []).find(item => idOf(item) === uid);
    if (!card) throw new Error('La carta non è sul tuo campo.');
    const ability = parseCardAbilities(card).activated[Number(index)];
    if (!ability) throw new Error('Questa carta non ha abilità automatiche.');
    if (!ability.supported) throw new Error(`${card.name}: abilità da risolvere a mano.`);
    if (ability.cost.tap) {
        if (card.tapped) throw new Error(`${card.name} è già tappata.`);
        if (card.summoningSick && /\bcreature\b/i.test(String(card.typeLine || '')) && !hasKeyword(card, 'haste')) {
            throw new Error(`${card.name} ha ancora la debolezza da evocazione.`);
        }
    }
    if (ability.cost.manaCost) paySpellCost(state, player, ability.cost.manaCost);
    if (ability.cost.tap) card.tapped = true;
    if (ability.cost.sacrificeSelf) {
        player.battlefield = player.battlefield.filter(item => item !== card);
        player.graveyard.push(card);
        log(state, `${card.name} viene sacrificata.`);
    }
    state.stack = [...(state.stack || []), {
        id: nextStackId(state),
        kind: 'ability',
        controllerId: playerId,
        sourceId: uid,
        cardName: card.name,
        abilityText: ability.text,
        effects: ability.effects,
        target: String(target || ''),
        targetLabel: targetLabelOf(state, target),
        targets: target ? [String(target)] : [],
        mode: null,
        requiresTarget: /target/i.test(ability.text || '')
    }];
    resetPriority(state, playerId);
    log(state, `${playerName(state, playerId)} attiva ${card.name} (sullo stack).`);
    return state;
}

/** Risolve la cima dello stack (CR 608.1): l'ultima magia entrata è la prima a uscire. */
export function resolveTop(currentState) {
    const state = structuredClone(currentState);
    const items = state.stack || [];
    if (!items.length) throw new Error('Lo stack è vuoto: non c’è niente da risolvere.');
    const item = items[items.length - 1];
    state.stack = items.slice(0, -1);
    if (item.kind === 'ability') {
        const player = state.playersData?.[item.controllerId];
        if (!player || player.eliminated) return settleState(state);
        const source = (player.battlefield || []).find(card => idOf(card) === item.sourceId);
        const result = applyEffects(item.effects || [], {
            state,
            controllerId: item.controllerId,
            card: source || { name: item.cardName },
            target: item.target || '',
            sourceName: item.cardName || 'Abilità'
        });
        logLines(state, result.log);
        if (result.unsupported.length) logLines(state, [manualNotice(item.cardName || 'Abilità', result.unsupported)]);
        return settleState(state);
    }
    if (!state.playersData?.[item.controllerId]) return settleState(state);
    return resolveSpell(state, item.controllerId, item.card, item.target || '', item.mode ?? null, item.xValue || 0);
}

/** Svuota lo stack risolvendo dalla cima: comodo nei test e nelle partite automatiche. */
export function resolveStack(currentState) {
    let state = structuredClone(currentState);
    let guard = 0;
    while ((state.stack || []).length) {
        state = resolveTop(state);
        guard += 1;
        if (guard > 64) throw new Error('Lo stack non si svuota: controllo interrotto.');
    }
    return state;
}

/** L'etichetta per l'interfaccia: «Fulmine (Tu) → Goblin». */
export const stackLabel = (state, item) => {
    const who = item?.controllerId === state.activePlayer ? playerName(state, item.controllerId) : playerName(state, item?.controllerId || '');
    const name = item?.kind === 'ability' ? `${item.cardName} · abilità` : (item?.card?.name || 'Magia');
    return item?.targetLabel ? `${name} (${who}) → ${item.targetLabel}` : `${name} (${who})`;
};

/** Quanto mana resta: serve ai messaggi d'errore e alla barra del tavolo. */
export const manaAfterCast = state => (state?.playersData?.[state?.priority?.playerId]?.manaPool
    ? manaPoolLabel(state.playersData[state.priority.playerId].manaPool)
    : 'vuota');

/** Un permanente lanciato è una magia: non basta `isPermanentCard`, le terre non si lanciano. */
export const isSpellCard = card => isPermanentCard(card) && !isLand(card);

export { MATCH_RULES };
