const identity = card => new Set(card?.colorIdentity || []);
const isSubset = (colors, commanderColors) => [...colors].every(color => commanderColors.has(color));

export const isCommanderEligible = card => {
    const type = String(card?.typeLine || '').toLowerCase();
    const text = String(card?.oracleText || '').toLowerCase();
    return Boolean(card && card.commanderLegality === 'legal'
        && ((type.includes('legendary') && type.includes('creature')) || /can be your commander/.test(text)));
};

export const canPairCommanders = (first, second) => {
    const isBackground = card => /legendary enchantment[^.]*background/i.test(String(card?.typeLine || ''));
    if (!isCommanderEligible(first) || !(isCommanderEligible(second) || isBackground(second)) || first.id === second.id) return false;
    const a = String(first.oracleText || '').toLowerCase();
    const b = String(second.oracleText || '').toLowerCase();
    const firstName = String(first.name || '').toLowerCase();
    const secondName = String(second.name || '').toLowerCase();
    const sharedPartner = /\bpartner\b/.test(a) && /\bpartner\b/.test(b);
    const matchingPartner = new RegExp(`partner with ${secondName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(first.oracleText || '')
        || new RegExp(`partner with ${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(second.oracleText || '');
    const friendsForever = /friends forever/.test(a) && /friends forever/.test(b);
    const background = (/choose a background/.test(a) && isBackground(second))
        || (/choose a background/.test(b) && isBackground(first));
    const doctor = (/doctor's companion/.test(a) && /time lord[^.]*doctor/.test(String(second.typeLine || '').toLowerCase()))
        || (/doctor's companion/.test(b) && /time lord[^.]*doctor/.test(String(first.typeLine || '').toLowerCase()));
    return sharedPartner || matchingPartner || friendsForever || background || doctor;
};

const isBasicLand = card => String(card?.typeLine || '').split('—')[0].toLowerCase().includes('basic');
const duplicateAllowed = card => new RegExp(`a deck can have any number of cards named ${String(card?.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(card?.oracleText || '');

export function validateCommanderDeck(cards = [], commanders = []) {
    const errors = [];
    if (commanders.length < 1 || commanders.length > 2) errors.push('Scegli uno o due comandanti.');
    const selected = commanders.map(id => cards.find(card => card.id === id)).filter(Boolean);
    if (selected.length !== commanders.length || !isCommanderEligible(selected[0])) errors.push('Il comandante deve essere una creatura leggendaria legale in Commander.');
    if (selected.length === 2 && !canPairCommanders(selected[0], selected[1])) errors.push('I due comandanti non hanno un’abilità che consente di usarli insieme.');
    if (cards.length !== 100) errors.push(`Il mazzo deve contenere esattamente 100 carte, comandanti inclusi (ora ${cards.length}).`);
    const commanderColors = new Set(selected.flatMap(card => [...identity(card)]));
    for (const card of cards) {
        if (!isSubset(identity(card), commanderColors)) errors.push(`${card.name}: identità di colore fuori dai colori del comandante.`);
        if (card.commanderLegality !== 'legal') errors.push(`${card.name}: carta non legale in Commander o legalità non verificata.`);
    }
    const counts = new Map();
    for (const card of cards) counts.set(card.name, [...(counts.get(card.name) || []), card]);
    for (const [name, copies] of counts) {
        if (copies.length > 1 && !copies.every(isBasicLand) && !copies.every(duplicateAllowed)) errors.push(`${name}: in Commander è consentita una sola copia, eccetto le terre base.`);
    }
    for (const id of commanders) {
        if ((counts.get(cards.find(card => card.id === id)?.name) || []).length !== 1) errors.push('Ogni comandante deve comparire una sola volta nel mazzo.');
    }
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
}
