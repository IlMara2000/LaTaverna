export const SUITS=['♠','♥','♦','♣'];
export const label=c=>c.rank===0?'Jolly':`${({1:'A',11:'J',12:'Q',13:'K'})[c.rank]||c.rank}${SUITS[c.suit]}`;
export const penalty=c=>c.rank===0?25:c.rank===1?11:Math.min(c.rank,10);
const shuffle=(a,rng=Math.random)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export function newScala40(rng=Math.random){
    const stock=shuffle(Array.from({length:2},(_,d)=>[...SUITS.flatMap((_,suit)=>Array.from({length:13},(_,r)=>({id:`${d}-${suit}-${r+1}`,suit,rank:r+1}))),...Array.from({length:2},(_,i)=>({id:`${d}-j-${i}`,suit:-1,rank:0}))]).flat(),rng);
    const hands=[[],[]];for(let i=0;i<13;i++){hands[0].push(stock.pop());hands[1].push(stock.pop());}
    return {stock,hands,discard:[stock.pop()],melds:[],opened:[false,false],turn:0,phase:'draw',staged:[],mustPlay:[],turns:0,winner:null};
}
export function meldInfo(cards){
    if(cards.length<3||cards.length>14||new Set(cards.map(c=>c.id)).size!==cards.length)return null;
    const naturals=cards.filter(c=>c.rank),jokers=cards.filter(c=>!c.rank);if(jokers.length>1||naturals.length<2)return null;
    if(cards.length<=4&&naturals.every(c=>c.rank===naturals[0].rank)&&new Set(naturals.map(c=>c.suit)).size===naturals.length)return {type:'set',points:cards.length*penalty(naturals[0]),cards:[...naturals,...jokers]};
    if(!naturals.every(c=>c.suit===naturals[0].suit))return null;
    for(let start=1;start+cards.length-1<=14;start++){
        const slots=Array.from({length:cards.length},(_,i)=>start+i);const used=new Set();const ordered=[];let valid=true;
        for(const rank of slots){const c=naturals.find(c=>!used.has(c.id)&&c.rank===(rank===14?1:rank));if(c){used.add(c.id);ordered.push({...c,representedRank:rank});}else if(jokers.length&&!used.has(jokers[0].id)){used.add(jokers[0].id);ordered.push({...jokers[0],representedRank:rank});}else{valid=false;break;}}
        if(valid&&used.size===cards.length&&!(start===1&&slots.at(-1)===14&&naturals.filter(c=>c.rank===1).length>1))return {type:'run',points:slots.reduce((sum,r)=>sum+(r===14?11:Math.min(r,10)),0),cards:ordered};
    }
    return null;
}
const fail=m=>{throw new Error(m);};
const handCards=(s,ids)=>{if(!Array.isArray(ids)||new Set(ids).size!==ids.length)fail('Selezione non valida.');const cards=ids.map(id=>s.hands[s.turn].find(c=>c.id===id));if(cards.some(c=>!c))fail('Carta non presente nella mano.');return cards;};
const take=(s,cards)=>{const ids=new Set(cards.map(c=>c.id));s.hands[s.turn]=s.hands[s.turn].filter(c=>!ids.has(c.id));s.mustPlay=s.mustPlay.filter(id=>!ids.has(id));};
export function scalaMove(state,action,rng=Math.random){
    const s=structuredClone(state);if(s.winner!==null)fail('La smazzata è conclusa.');
    if(action.type==='draw'){
        if(s.phase!=='draw')fail('Hai già pescato.');
        if(action.source==='discard'){
            if(!s.opened[s.turn]||!s.discard.length)fail('Apri prima di raccogliere dagli scarti.');
            const c=s.discard.pop();s.hands[s.turn].push(c);s.mustPlay.push(c.id);
        }else{
            if(!s.stock.length){const top=s.discard.pop();s.stock=shuffle(s.discard,rng);s.discard=top?[top]:[];}
            if(!s.stock.length){s.winner='draw';return s;}
            s.hands[s.turn].push(s.stock.pop());
        }
        s.phase='play';return s;
    }
    if(s.phase!=='play')fail('Pesca una carta prima di giocare.');
    if(action.type==='meld'){
        const cards=handCards(s,action.ids),info=meldInfo(cards);if(!info)fail('Scegli un tris di semi diversi o una scala dello stesso seme, con al massimo un jolly.');
        if(cards.length>=s.hands[s.turn].length)fail('Conserva una carta per lo scarto finale.');
        take(s,cards);if(s.opened[s.turn])s.melds.push({...info,owner:s.turn});else s.staged.push({...info,owner:s.turn});return s;
    }
    if(action.type==='open'){
        if(s.opened[s.turn]||s.staged.reduce((n,m)=>n+m.points,0)<40)fail('Prepara combinazioni per almeno 40 punti.');
        s.opened[s.turn]=true;s.melds.push(...s.staged);s.staged=[];return s;
    }
    if(action.type==='cancel'){
        s.hands[s.turn].push(...s.staged.flatMap(m=>m.cards));s.staged=[];return s;
    }
    if(action.type==='attach'){
        if(!s.opened[s.turn])fail('Devi prima aprire.');
        const cards=handCards(s,action.ids),meld=s.melds[action.index];if(!meld||!cards.length)fail('Seleziona una carta e un gioco sul tavolo.');
        if(cards.length>=s.hands[s.turn].length)fail('Conserva una carta per scartare.');
        const info=meldInfo([...meld.cards,...cards]);if(!info||info.type!==meld.type)fail('Le carte non si possono attaccare a questo gioco.');
        // A joker already laid must retain the represented rank until explicitly exchanged.
        if(meld.type==='run'&&meld.cards.some(c=>!c.rank&&info.cards.find(n=>n.id===c.id)?.representedRank!==c.representedRank))fail('Sostituisci il jolly prima di spostarne il valore.');
        take(s,cards);s.melds[action.index]={...info,owner:meld.owner};return s;
    }
    if(action.type==='replace'){
        if(!s.opened[s.turn])fail('Devi prima aprire.');
        const [card]=handCards(s,action.ids);if(action.ids.length!==1||!card.rank)fail('Seleziona una carta naturale.');
        const meld=s.melds[action.index],joker=meld?.cards.find(c=>!c.rank);if(!joker)fail('Questo gioco non contiene un jolly.');
        if(meld.type==='run'&&(card.rank!==(joker.representedRank===14?1:joker.representedRank)||card.suit!==meld.cards.find(c=>c.rank).suit))fail('Serve la carta rappresentata dal jolly.');
        const info=meldInfo(meld.cards.map(c=>c.id===joker.id?card:c));if(!info||info.type!==meld.type)fail('Questa carta non sostituisce il jolly.');
        take(s,[card]);s.hands[s.turn].push({...joker,representedRank:undefined});s.mustPlay.push(joker.id);s.melds[action.index]={...info,owner:meld.owner};return s;
    }
    if(action.type==='discard'){
        if(s.staged.length)fail('Conferma l’apertura o riprendi le carte preparate.');
        if(s.mustPlay.length)fail('Devi giocare la carta raccolta o il jolly recuperato prima di scartare.');
        const [card]=handCards(s,[action.id]);
        if(s.hands[s.turn].length===1&&s.turns<2)fail('Non si può chiudere al primo giro.');
        if(!s.opened[s.turn]&&s.hands[s.turn].length>1&&s.melds.some(m=>meldInfo([...m.cards,card])))fail('Prima di aprire non puoi scartare una carta che si attacca al tavolo.');
        take(s,[card]);s.discard.push(card);s.turns++;
        if(!s.hands[s.turn].length){s.winner=s.turn;return s;}
        s.turn=1-s.turn;s.phase='draw';return s;
    }
    fail('Mossa non riconosciuta.');
}
export function findMelds(hand){
    const found=[],joker=hand.find(c=>!c.rank),seen=new Set();
    const add=cards=>{const key=cards.map(c=>c.id).sort().join('|');if(seen.has(key))return;const info=meldInfo(cards);if(info){found.push(info);seen.add(key);}};
    for(let rank=1;rank<=13;rank++){
        const cards=SUITS.map((_,suit)=>hand.find(c=>c.rank===rank&&c.suit===suit)).filter(Boolean);
        for(let mask=0;mask<(1<<cards.length);mask++){const group=cards.filter((_,i)=>mask&(1<<i));if(group.length>=3)add(group);if(joker&&group.length>=2&&group.length<=3)add([...group,joker]);}
    }
    for(let suit=0;suit<4;suit++)for(let start=1;start<=12;start++)for(let end=start+2;end<=14;end++){
        const cards=[],used=new Set();let missing=0;
        for(let rank=start;rank<=end;rank++){const card=hand.find(c=>c.suit===suit&&c.rank===(rank===14?1:rank)&&!used.has(c.id));if(card){cards.push(card);used.add(card.id);}else if(joker&&missing===0){cards.push(joker);missing++;}else{missing=2;break;}}
        if(missing<2)add(cards);
    }
    return found.sort((a,b)=>b.points-a.points);
}
export function scalaBotTurn(state,rng=Math.random){
    let s=scalaMove(state,{type:'draw'},rng),guard=0;
    if(s.winner!==null)return s;
    if(!s.opened[s.turn]){
        const candidates=findMelds(s.hands[s.turn]);let plan=null;
        const search=(chosen,used,points,start)=>{if(plan)return;if(points>=40){plan=chosen;return;}if(chosen.length===4)return;for(let i=start;i<candidates.length;i++){const m=candidates[i];if(m.cards.some(c=>used.has(c.id))||used.size+m.cards.length>=s.hands[s.turn].length)continue;search([...chosen,m],new Set([...used,...m.cards.map(c=>c.id)]),points+m.points,i+1);if(plan)return;}};
        search([],new Set(),0,0);
        if(plan){for(const m of plan)s=scalaMove(s,{type:'meld',ids:m.cards.map(c=>c.id)});s=scalaMove(s,{type:'open'});}
    }
    if(s.opened[s.turn]){
        while(guard++<14){const m=findMelds(s.hands[s.turn]).find(m=>m.cards.length<s.hands[s.turn].length);if(!m)break;s=scalaMove(s,{type:'meld',ids:m.cards.map(c=>c.id)});}
        for(const c of [...s.hands[s.turn]]){if(s.hands[s.turn].length<2)break;for(let i=0;i<s.melds.length;i++){try{s=scalaMove(s,{type:'attach',ids:[c.id],index:i});break;}catch{/* Try another meld. */}}}
    }
    const discardScore=c=>c.rank===0?-100:penalty(c)-s.hands[s.turn].filter(n=>n.id!==c.id&&(n.rank===c.rank||(n.suit===c.suit&&Math.abs(n.rank-c.rank)<=2))).length*9;
    for(const card of [...s.hands[s.turn]].sort((a,b)=>discardScore(b)-discardScore(a))){try{return scalaMove(s,{type:'discard',id:card.id});}catch{/* Try a legal discard. */}}
    // Pathological blocked hand: draw is declared only when no legal discard exists.
    return {...s,winner:'draw'};
}
