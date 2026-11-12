export const COUNTER_KEY = 'taverna_card_counter_v1';
export const PRESETS = Object.freeze({
    yugioh: { name: 'Yu-Gi-Oh!', label: 'Life Points', initial: 8000, steps: [100,500,1000], counters: ['Segnalini'] },
    commander: { name: 'Magic', label: 'Punti vita', initial: 40, steps: [1,5,10], counters: ['Veleno','Lanci comandante'] },
    pokemon: { name: 'Pokémon', label: 'Premi rimasti', initial: 6, steps: [1], counters: ['Danni · Pokémon attivo'] },
    custom: { name: 'Personalizzato', label: 'Punti', initial: 0, steps: [1,5,10], counters: [] }
});
export function createMatch(preset='yugioh', count=2, initial) {
    if (preset === 'magic') preset = 'commander'; // Accept old links without a duplicate UI preset.
    if (initial === undefined) initial = PRESETS[preset]?.initial;
    if (!PRESETS[preset] || !Number.isInteger(count) || count<2 || count>6 || !Number.isSafeInteger(initial) || Math.abs(initial)>999999) throw new Error('Configurazione non valida.');
    return { version:1, preset, initial, turn:1, active:0, log:[], players:Array.from({length:count},(_,i)=>({
        name:`Giocatore ${i+1}`, value:initial,
        ...(preset === 'commander' ? { commanderDamage: Array.from({length:count}, () => [0,0]) } : {}),
        counters:PRESETS[preset].counters.map((name,j)=>({id:`default-${j}`,name,value:0,step:preset==='pokemon'?10:1})),
        extras:[]
    })) };
}
export function validateMatch(value) {
    if (value?.preset === 'magic') value = { ...value, preset: 'commander' }; // Preserve legacy saved scores.
    if (!value || value.version!==1 || !PRESETS[value.preset] || !Array.isArray(value.players) || value.players.length<2 || value.players.length>6) return null;
    if (!Number.isSafeInteger(value.initial) || Math.abs(value.initial)>999999 || !Number.isSafeInteger(value.turn) || value.turn<1 || !Number.isInteger(value.active) || value.active<0 || value.active>=value.players.length) return null;
    for (const p of value.players) {
        if(!p||typeof p!=='object')return null;
        if (value.preset === 'commander' && p.commanderDamage !== undefined &&
            (!Array.isArray(p.commanderDamage) || p.commanderDamage.length !== value.players.length ||
            p.commanderDamage.some(pair => !Array.isArray(pair) || pair.length !== 2 || pair.some(n => !Number.isSafeInteger(n) || n < 0 || n > 999999)))) return null;
        if(typeof p.name!=='string'||p.name.length>40||!Number.isSafeInteger(p.value)||Math.abs(p.value)>999999||!Array.isArray(p.counters)||p.counters.length>30) return null;
        const ids=new Set();
        for(const c of p.counters) {
            if(!c||typeof c!=='object')return null;
            if(typeof c.id!=='string'||c.id.length>80||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>50||!Number.isSafeInteger(c.value)||c.value<0||c.value>999999||!Number.isSafeInteger(c.step)||c.step<1||c.step>1000) return null;
            ids.add(c.id);
        }
        if (p.extras !== undefined) {
            if (!Array.isArray(p.extras) || p.extras.length > 30) return null;
            const extraIds = new Set();
            for (const c of p.extras) {
                if (!c || typeof c !== 'object') return null;
                if (typeof c.id !== 'string' || c.id.length > 80 || extraIds.has(c.id)) return null;
                if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 30) return null;
                if (!Number.isSafeInteger(c.limit) || c.limit < 1 || c.limit > 999) return null;
                if (!Number.isSafeInteger(c.value) || c.value < 0 || c.value > c.limit) return null;
                extraIds.add(c.id);
            }
        }
    }
    return {...value,players:value.players.map(p => ({
        ...p,
        extras: p.extras ?? [],
        ...(value.preset === 'commander' ? { commanderDamage: p.commanderDamage ?? Array.from({length:value.players.length},()=>[0,0]) } : {})
    })),log:Array.isArray(value.log)?value.log.filter(s=>typeof s==='string').map(s=>s.slice(0,200)).slice(-50):[]};
}
// Each physical commander has its own combat-damage total, including partners.
export function changeCommanderDamage(state, recipient, source, commander, delta, adjustLife = false) {
    if (state.preset !== 'commander' || !Number.isInteger(recipient) || !Number.isInteger(source) ||
        !state.players[recipient] || !state.players[source] || ![0,1].includes(commander) ||
        !Number.isSafeInteger(delta) || Math.abs(delta) > 999999) throw new Error('Danni da comandante non validi.');
    const next = structuredClone(state), player = next.players[recipient];
    const old = player.commanderDamage[source][commander];
    const value = Math.max(0, Math.min(999999, old + delta));
    player.commanderDamage[source][commander] = value;
    if (adjustLife) player.value = Math.max(-999999, Math.min(999999, player.value - (value-old)));
    next.log.push(`${player.name} · Danni dal comandante ${commander+1} di ${next.players[source].name}: ${old} → ${value}${adjustLife ? ' (vite aggiornate)' : ''}`);
    next.log = next.log.slice(-50);
    return next;
}
export function hasLethalCommanderDamage(player) {
    return Boolean(player.commanderDamage?.some(pair => pair.some(damage => damage >= 21)));
}
export function changeScore(state,index,delta,counterId=null) {
    if(!Number.isSafeInteger(delta)||Math.abs(delta)>999999) throw new Error('Inserisci un numero intero valido.');
    const next=structuredClone(state), player=next.players[index];
    if(!player) throw new Error('Giocatore non trovato.');
    const target=counterId===null?player:player.counters.find(c=>c.id===counterId);
    if(!target) throw new Error('Segnalino non trovato.');
    const min=counterId!==null||state.preset==='pokemon'||state.preset==='yugioh'?0:-999999;
    const max=counterId===null&&state.preset==='pokemon'?state.initial:999999;
    const old=target.value; target.value=Math.min(max,Math.max(min,old+delta));
    next.log.push(`${player.name} · ${counterId===null?PRESETS[state.preset].label:target.name}: ${old} → ${target.value}`);
    next.log=next.log.slice(-50);return next;
}
// Contatori liberi ("Altri Danni"): nome, valore da 0 al limite scelto, per giocatore.
export function addExtraCounter(state, index, name, limit) {
    const player = state.players[index];
    if (!player) throw new Error('Giocatore non trovato.');
    const clean = String(name ?? '').trim();
    if (!clean || clean.length > 30) throw new Error('Il nome deve avere da 1 a 30 caratteri.');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 999) throw new Error('Il limite deve essere un intero fra 1 e 999.');
    const extras = player.extras || [];
    if (extras.length >= 30) throw new Error('Questo giocatore ha già troppi contatori.');
    if (extras.some(c => c.name.toLowerCase() === clean.toLowerCase())) throw new Error(`"${clean}" esiste già per ${player.name}.`);
    const next = structuredClone(state);
    next.players[index].extras = [...extras, { id: crypto.randomUUID(), name: clean, value: 0, limit }];
    next.log.push(`${player.name} · Nuovo danno "${clean}" (limite ${limit})`);
    next.log = next.log.slice(-50);
    return next;
}
export function changeExtraCounter(state, index, id, delta) {
    const player = state.players[index], counter = player?.extras?.find(c => c.id === id);
    if (!counter) throw new Error('Contatore non trovato.');
    if (!Number.isSafeInteger(delta) || delta === 0) throw new Error('Variazione non valida.');
    const next = structuredClone(state), target = next.players[index].extras.find(c => c.id === id);
    const old = target.value;
    target.value = Math.max(0, Math.min(target.limit, old + delta));
    if (target.value === old) return state;
    next.log.push(`${player.name} · ${counter.name}: ${old} → ${target.value}`);
    next.log = next.log.slice(-50);
    return next;
}
export function removeExtraCounter(state, index, id) {
    const player = state.players[index], counter = player?.extras?.find(c => c.id === id);
    if (!counter) throw new Error('Contatore non trovato.');
    const next = structuredClone(state);
    next.players[index].extras = next.players[index].extras.filter(c => c.id !== id);
    next.log.push(`${player.name} · Rimosso danno "${counter.name}"`);
    next.log = next.log.slice(-50);
    return next;
}
export function loadMatch(storage) { try { return validateMatch(JSON.parse(storage.getItem(COUNTER_KEY))); } catch { return null; } }
export function saveMatch(state,storage) { try { storage.setItem(COUNTER_KEY,JSON.stringify(state));return true; } catch { return false; } }
