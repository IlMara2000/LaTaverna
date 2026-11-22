// Vista per un singolo giocatore.
//
// L'interfaccia non legge lo stato di partita: legge questo view model. Due
// conseguenze volute: le mani e i grimori avversari non escono da qui (prima
// viaggiavano interi nel payload delle stanze), e ogni controllo che si vede
// corrisponde a una mossa presente in `legalActions`.
//
// Il view model è serializzabile: può essere spedito in multiplayer senza
// trascinarsi dietro oggetti o funzioni.

import { legalActions } from './actions.js';
import { choiceViewFor } from './choices.js';
import { GAME_VERSION, stepsView, stepOf, STEPS, STEP_INDEX } from './state.js';
import { manaPoolLabel } from '../../magicRules.js';

const isCreature = card => /\bcreature\b/i.test(String(card?.typeLine || ''));
const idOf = card => String(card?.instanceId ?? card?.uid ?? card?.id ?? '');
const counterPlus = card => Number(card?.counters?.plusOne || 0) || 0;

const num = value => (Number.isFinite(Number(value)) && String(value) !== '' ? Number(value) : 0);

const cardView = (card, zone) => ({
    id: idOf(card),
    uid: card?.uid || idOf(card),
    name: card?.name || 'Carta',
    image: card?.image || '',
    typeLine: card?.typeLine || '',
    manaCost: card?.manaCost || '',
    tapped: Boolean(card?.tapped),
    summoningSick: Boolean(card?.summoningSick),
    counters: counterPlus(card),
    damage: num(card?.damageMarked),
    power: isCreature(card) ? String(num(card?.power) + counterPlus(card)
        + num(card?.turnBoost?.power) + num(card?.anthemBoost?.power)) : '',
    toughness: isCreature(card) ? String(num(card?.toughness) + counterPlus(card)
        + num(card?.turnBoost?.toughness) + num(card?.anthemBoost?.toughness)) : '',
    attacking: Boolean(card?.attacking),
    blocking: Boolean(card?.blocking),
    commander: Boolean(card?.isCommander),
    token: Boolean(card?.isToken),
    zone
});

const zoneSummary = data => ({
    library: (data?.library || []).length,
    hand: (data?.hand || []).length,
    graveyard: (data?.graveyard || []).map(card => cardView(card, 'graveyard')),
    exile: (data?.exile || []).map(card => cardView(card, 'exile')),
    command: (data?.commandZone || []).map(card => cardView(card, 'commandZone'))
});

const commanderDamageOf = data => {
    const values = Object.values(data?.commanderDamage || {}).map(num);
    return values.length ? Math.max(0, ...values) : 0;
};

/**
 * Lo stato visto da `playerId`. `playerId` può non essere in partita (spettatore):
 * in quel caso `me` è null e non c'è alcuna mossa legale.
 */
export function viewFor(state, playerId) {
    if (!state || !state.playersData) throw new Error('viewFor: stato di partita mancante.');
    const me = state.playersData[playerId] || null;
    const step = stepOf(state);
    const opponents = (state.players || [])
        .filter(id => id !== playerId)
        .map(id => {
            const data = state.playersData[id] || {};
            return {
                id,
                name: state.playerNames?.[id] || `Giocatore ${state.players.indexOf(id) + 1}`,
                life: num(data.life),
                eliminated: Boolean(data.eliminated),
                handCount: (data.hand || []).length,
                libraryCount: (data.library || []).length,
                graveyardCount: (data.graveyard || []).length,
                commanderDamage: commanderDamageOf(data),
                battlefield: (data.battlefield || []).map(card => cardView(card, 'battlefield'))
            };
        });

    const activeName = state.playerNames?.[state.activePlayer] || '';
    // Con lo stack attivo la priorità non è più «il turno»: è di chi deve
    // rispondere adesso. Prima dello strato M1 la priorità era del giocatore
    // attivo, e la differenza non si vedeva.
    const priority = state.winner
        ? { playerId: '', mine: false, label: 'Partita conclusa', passed: [] }
        : state.priority
            ? {
                playerId: state.priority.playerId || '',
                mine: state.priority.playerId === playerId,
                label: state.priority.playerId === playerId
                    ? 'La tua priorità'
                    : `Priorità di ${state.playerNames?.[state.priority.playerId] || 'un avversario'}`,
                passed: [...(state.priority.passed || [])]
            }
            : state.activePlayer === playerId
                ? { playerId, mine: true, label: 'La tua priorità', passed: [] }
                : { playerId: state.activePlayer, mine: false, label: `In attesa di ${activeName}`, passed: [] };

    return {
        schema: 1,
        gameVersion: GAME_VERSION,
        revision: Number(state.revision || 0),
        turn: num(state.turn),
        activePlayerId: state.activePlayer || '',
        activePlayerName: activeName,
        step: { id: step, index: STEP_INDEX[step], label: STEPS[STEP_INDEX[step]]?.label || step },
        steps: stepsView(state),
        priority,
        stack: (state.stack || []).map(item => ({
            id: item?.id || '',
            controllerId: item?.controllerId || '',
            controllerName: state.playerNames?.[item?.controllerId] || (item?.controllerId === playerId ? 'Tu' : 'Un giocatore'),
            mine: item?.controllerId === playerId,
            sourceId: item?.sourceId || idOf(item?.card),
            sourceName: item?.kind === 'ability'
                ? `${item?.cardName || 'Abilità'} · abilità`
                : (item?.card?.name || item?.name || 'Magia'),
            kind: item?.kind || 'spell',
            targetLabel: item?.targetLabel || '',
            requiresTarget: Boolean(item?.requiresTarget),
            targets: item?.targets || []
        })),
        me: me ? {
            id: playerId,
            name: state.playerNames?.[playerId] || 'Tu',
            life: num(me.life),
            eliminated: Boolean(me.eliminated),
            landsPlayed: num(me.landsPlayed),
            commanderDamage: commanderDamageOf(me),
            manaPool: { ...(me.manaPool || {}) },
            manaLabel: manaPoolLabel(me.manaPool),
            hand: (me.hand || []).map(card => cardView(card, 'hand')),
            battlefield: (me.battlefield || []).map(card => cardView(card, 'battlefield')),
            zones: zoneSummary(me)
        } : null,
        opponents,
        pendingChoice: choiceViewFor(state, playerId),
        legalActions: me ? legalActions(state, playerId) : [],
        log: (state.log || []).slice(0, 8)
    };
}
