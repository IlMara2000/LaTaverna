const WORDS = [['Pizza','Focaccia'],['Cinema','Teatro'],['Montagna','Collina'],['Leone','Tigre'],['Vino','Birra'],['Calcio','Calcetto'],['Spiaggia','Scogliera']];
const shuffle = (items, random) => {
    const copy = [...items];
    for (let i=copy.length-1;i>0;i--) { const j=Math.floor(random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; }
    return copy;
};
export function createPartyGame(gameId, count, round = 1, config = {}, random = Math.random) {
    if (!Number.isInteger(count) || count < (gameId === 'impostore' ? 3 : 2) || count > 8) throw new Error('Numero di partecipanti non valido.');
    const base = {gameId, count, round, config, phase:'reveal', ready:Array(count).fill(false), chat:[], order:Array.from({length:count},(_,i)=>i)};
    if (gameId === 'numeri') {
        const size = Math.min(round, Math.floor(100/count));
        const numbers = shuffle(Array.from({length:100},(_,i)=>i+1),random);
        return {...base, numbers:Array.from({length:count},(_,i)=>numbers.slice(i*size,(i+1)*size).sort((a,b)=>a-b))};
    }
    const roles = Array(count).fill('civil');
    const seats = shuffle(base.order,random);
    const impostors = Math.min(count-2,Math.max(1,Number(config.impostors)||1));
    const undercover = Math.min(count-impostors-1,Math.max(0,Number(config.undercover)||0));
    for(let i=0;i<impostors;i++) roles[seats.pop()]='impostor';
    for(let i=0;i<undercover;i++) roles[seats.pop()]='undercover';
    return {...base,roles,words:WORDS[Math.floor(random()*WORDS.length)],alive:Array(count).fill(true),votes:Array(count).fill(null),winner:null,guessSeat:null};
}
const settle = state => {
    const active = state.roles.filter((_,i)=>state.alive[i]);
    const bad = active.filter(role=>role!=='civil').length;
    if (!bad || bad >= active.length-bad) { state.winner = !bad ? 'civil' : 'impostor'; state.phase='result'; }
    else { state.phase='discuss'; state.votes.fill(null); }
};
export function partyAction(current, seat, action, random = Math.random) {
    if (!Number.isInteger(seat) || seat<0 || seat>=current.count) throw new Error('Partecipante non valido.');
    const state = structuredClone(current);
    if (action.type==='chat' && ['discuss','guess'].includes(state.phase)) {
        const text=String(action.text||'').trim().slice(0,240);
        if(text) state.chat=[...state.chat,{seat,text}].slice(-40);
        return state;
    }
    if(action.type==='ready' && state.phase==='reveal') {
        state.ready[seat]=true;
        if(state.ready.every(Boolean)) state.phase='discuss';
        return state;
    }
    if(action.type==='next' && seat===0 && state.phase==='result') return createPartyGame(state.gameId,state.count,state.round+1,state.config,random);
    if(state.gameId==='numeri') {
        if (seat!==0 || state.phase!=='discuss') return state;
        if(action.type==='order' && Array.isArray(action.order) && action.order.length===state.count && new Set(action.order).size===state.count && action.order.every(n=>Number.isInteger(n)&&n>=0&&n<state.count)) state.order=action.order;
        if(action.type==='check') {
            const means=state.numbers.map(nums=>nums.reduce((sum,n)=>sum+n,0)/nums.length);
            state.correct=state.order.every((id,i)=>i===0||means[state.order[i-1]]<=means[id]);
            state.phase='result';
        }
        return state;
    }
    if(action.type==='vote' && state.phase==='discuss' && state.alive[seat] && state.votes[seat]===null && Number.isInteger(action.target) && action.target!==seat && state.alive[action.target]) {
        state.votes[seat]=action.target;
        if(state.alive.every((alive,i)=>!alive||state.votes[i]!==null)) {
            const counts=Array(state.count).fill(0);
            state.votes.forEach((target,i)=>{if(state.alive[i]&&target!==null)counts[target]++;});
            const top=Math.max(...counts), leaders=counts.flatMap((n,i)=>n===top?[i]:[]);
            if(leaders.length>1) {state.votes.fill(null);state.chat.push({seat:-1,text:'Voto pari: discutete e votate di nuovo.'});}
            else {
                const target=leaders[0];state.alive[target]=false;
                state.chat.push({seat:-1,text:`Giocatore ${target+1} eliminato: ${state.roles[target]}.`});
                if(state.roles[target]==='impostor') {state.phase='guess';state.guessSeat=target;}
                else settle(state);
            }
        }
    }
    if(action.type==='guess' && state.phase==='guess' && state.guessSeat===seat) {
        if(String(action.text||'').trim().toLocaleLowerCase()===state.words[0].toLocaleLowerCase()) {state.winner='impostor';state.phase='result';}
        else settle(state);
    }
    return state;
}
