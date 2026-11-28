// Azioni basate sullo stato (CR 704.5).
//
// Non usano lo stack e nessuno può rispondervi: si controllano appena un
// giocatore sta per ricevere la priorità, e si ripetono finché non cambia più
// nulla. Se una creatura con danno letale e due carte leggendarie omonime
// cadono nello stesso momento, devono cadere tutte, non solo la prima.
//
// Le regole che il modello di carte non sa ancora esprimere (lealtà dei
// planeswalker, aure e battaglie, veleno) non sono simulate qui: restano
// elencate in `SBA_UNSUPPORTED`, così ciò che manca è scritto e non silenzioso.

import { MATCH_RULES, eliminatePlayer, powerOf, settleState, toughnessOf } from '../../magicMatchEngine.js';
import { hasKeyword } from '../../magicEffects.js';

export const SBA_RULES = Object.freeze({
    life: '704.5a',
    commanderDamage: '903.10a',
    counters: '122.3',
    toughness: '704.5f',
    lethalDamage: '704.5g',
    deathtouch: '704.5h',
    legend: '704.5j',
    loyalty: '704.5i',
    aura: '704.5m',
    tokens: '704.5n'
});

export const SBA_UNSUPPORTED = Object.freeze(['704.5c (veleno)', '704.5m (battaglie)']);

const typeLine = card => String(card?.typeLine || '');
const isCreature = card => /\bcreature\b/i.test(typeLine(card));
const isAura = card => /\baura\b/i.test(typeLine(card))
    || (/\benchantment\b/i.test(typeLine(card)) && /^enchant\b/im.test(String(card?.oracleText || '')));
export const idOf = card => String(card?.instanceId ?? card?.uid ?? card?.id ?? '');
const log = (state, line) => { state.log = [line, ...(state.log || [])].slice(0, 40); };
const playerName = (state, id) => state.playerNames?.[id] || `Giocatore ${state.players.indexOf(id) + 1}`;

/** La carta come deve stare in una zona pubblica: senza stato di campo. */
function zoneCard(card) {
    const { instanceId, damageMarked, turnBoost, counters, attacking, blocking, summoningSick, tapped, attachedTo, printedLoyalty, ...rest } = card;
    // La lealtà è una risorsa del campo: fuori dal campo torna quella stampata,
    // così un planeswalker rilanciato entra di nuovo pieno.
    return printedLoyalty !== undefined ? { ...rest, loyalty: printedLoyalty } : rest;
}

/** Una carta che lascia il campo: un segnalino non esiste più, un comandante torna in zona di comando. */
function leaveBattlefield(state, ownerId, card, destination = 'graveyard') {
    const player = state.playersData[ownerId];
    if (!player) return;
    if (card.isToken) {
        state.log = [`${card.name || 'Segnalino'}: cessa di esistere.`, ...(state.log || [])].slice(0, 40);
        return;
    }
    if (card.isCommander) {
        player.commandZone = player.commandZone || [];
        player.commandZone.push(zoneCard(card));
        return;
    }
    (player[destination] = player[destination] || []).push(zoneCard(card));
}

/** La creatura incantata è ancora in campo? Basta che ci sia, anche se cambiata di controllo. */
function hostOnBattlefield(state, attachedTo) {
    const wanted = String(attachedTo);
    return state.players.some(id => (state.playersData?.[id]?.battlefield || []).some(card => idOf(card) === wanted));
}

function destroy(state, ownerId, card, performed, rule) {
    const player = state.playersData[ownerId];
    if (!player) return false;
    const index = (player.battlefield || []).indexOf(card);
    if (index < 0) return false;
    player.battlefield.splice(index, 1);
    leaveBattlefield(state, ownerId, card);
    log(state, `${card.name || 'Carta'} muore.`);
    performed.push({ rule, card: card.name || idOf(card), ownerId });
    return true;
}

/** 122.3: un +1/+1 e un −1/−1 sullo stesso permanente si annullano. */
function annihilateCounters(card) {
    const plus = Number(card.counters?.plusOne || 0) || 0;
    const minus = Number(card.counters?.minusOne || 0) || 0;
    if (plus <= 0 || minus <= 0) return false;
    const cancel = Math.min(plus, minus);
    card.counters = { ...(card.counters || {}), plusOne: plus - cancel, minusOne: minus - cancel };
    return true;
}

const minusCounters = card => Number(card.counters?.minusOne || 0) || 0;
const effectiveToughness = card => toughnessOf(card) - minusCounters(card);

/**
 * Applica le azioni basate sullo stato finché ce ne sono, poi verifica il
 * vincitore. Restituisce lo stato con `lastSba` (le regole applicate), che è
 * ciò che i test leggono per sapere *perché* una carta è morta.
 */
export function applyStateBasedActions(currentState) {
    const state = structuredClone(currentState);
    // Il vincitore non ferma il controllo: tutte le SBA di un momento si
    // applicano insieme (CR 704.5), e solo alla fine si annuncia chi ha vinto.
    if (!state) return state;
    const performed = [];
    for (let guard = 0; guard < 32; guard += 1) {
        let changed = false;

        // 704.5a — un giocatore a 0 o meno vite ha perso.
        for (const id of state.players) {
            const player = state.playersData?.[id];
            if (!player || player.eliminated || Number(player.life) > 0) continue;
            performed.push({ rule: SBA_RULES.life, playerId: id, reason: 'punti vita a zero' });
            eliminatePlayer(state, id, 'punti vita a zero');
            changed = true;
        }

        // 903.10a — 21 danni da comandante da una singola fonte.
        for (const id of state.players) {
            const player = state.playersData?.[id];
            if (!player || player.eliminated) continue;
            const lethal = Object.values(player.commanderDamage || {}).some(amount => Number(amount) >= MATCH_RULES.commanderDamageLethal);
            if (!lethal) continue;
            performed.push({ rule: SBA_RULES.commanderDamage, playerId: id, reason: '21 danni da comandante' });
            eliminatePlayer(state, id, '21 danni da un singolo comandante');
            changed = true;
        }

        for (const ownerId of state.players) {
            const player = state.playersData?.[ownerId];
            if (!player || player.eliminated) continue;
            const battlefield = [...(player.battlefield || [])];

            for (const card of battlefield) {
                // 122.3 — i segnalini opposti si annullano.
                if (annihilateCounters(card)) {
                    performed.push({ rule: SBA_RULES.counters, card: card.name || idOf(card), ownerId });
                    changed = true;
                }
                // 704.5i — un planeswalker a zero lealtà va al cimitero. Senza
                // lealtà conosciuta (dati carta incompleti) non si uccide nulla.
                if (/\bplaneswalker\b/i.test(typeLine(card)) && Number.isFinite(Number(card.loyalty)) && Number(card.loyalty) <= 0) {
                    if (destroy(state, ownerId, card, performed, SBA_RULES.loyalty)) changed = true;
                    continue;
                }
                // 704.5m — un'Aura senza la creatura a cui era attaccata va al cimitero.
                if (isAura(card) && card.attachedTo && !hostOnBattlefield(state, card.attachedTo)) {
                    if (destroy(state, ownerId, card, performed, SBA_RULES.aura)) changed = true;
                    continue;
                }
                if (!isCreature(card)) continue;

                // 704.5f — costituzione 0 o meno: la creatura va al cimitero.
                if (effectiveToughness(card) <= 0) {
                    if (destroy(state, ownerId, card, performed, SBA_RULES.toughness)) changed = true;
                    continue;
                }
                const damage = Number(card.damageMarked || 0) || 0;
                if (damage <= 0) continue;
                if (hasKeyword(card, 'indestructible')) continue;

                // 704.5g — danno pari o superiore alla costituzione; 704.5h — tocco letale.
                if (damage >= effectiveToughness(card)) {
                    if (destroy(state, ownerId, card, performed, SBA_RULES.lethalDamage)) changed = true;
                    continue;
                }
                if (card.deathtouchDamage > 0) {
                    if (destroy(state, ownerId, card, performed, SBA_RULES.deathtouch)) changed = true;
                }
            }

            // 704.5j — regola delle leggende: lo stesso giocatore non può controllare
            // due permanenti omonimi. Restano il primo in campo, gli altri cadono.
            const byName = new Map();
            for (const card of player.battlefield || []) {
                const name = String(card?.name || '').toLowerCase();
                if (!name) continue;
                if (!byName.has(name)) { byName.set(name, [card]); continue; }
                byName.get(name).push(card);
            }
            for (const [, group] of byName) {
                if (group.length < 2) continue;
                for (const duplicate of group.slice(1)) {
                    if (destroy(state, ownerId, duplicate, performed, SBA_RULES.legend)) changed = true;
                }
            }

            // 704.5n — un segnalino fuori dal campo cessa di esistere.
            for (const zone of ['graveyard', 'exile', 'commandZone']) {
                const list = player[zone] || [];
                const kept = list.filter(card => !card?.isToken);
                if (kept.length !== list.length) {
                    player[zone] = kept;
                    performed.push({ rule: SBA_RULES.tokens, ownerId, zone, removed: list.length - kept.length });
                    changed = true;
                }
            }
        }

        if (!changed) break;
    }
    state.lastSba = performed;
    return settleState(state);
}

/** Legge comoda per i test e per il diario: quanti permanenti sono caduti per danno. */
export const lethalDamageDeaths = state => (state?.lastSba || [])
    .filter(entry => entry.rule === SBA_RULES.lethalDamage || entry.rule === SBA_RULES.deathtouch);

export const powerSnapshot = state => (state?.players || []).flatMap(id =>
    (state.playersData?.[id]?.battlefield || []).map(card => `${id}:${card.name}:${powerOf(card)}`));
