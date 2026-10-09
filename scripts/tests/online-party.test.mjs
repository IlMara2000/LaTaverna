import test from 'node:test';
import assert from 'node:assert/strict';
import {createPartyGame,partyAction} from '../../src/dashboards/minigames/onlinePartyEngine.js';
import {cardPerspective,scopaPerspective,enterMatch,changeMatch} from '../../src/dashboards/minigames/onlineMatchProtocol.js';
import {createScopaMatch,playScopaMove,captureOptions,nextScopaRound} from '../../src/dashboards/minigames/scopaEngine.js';
test('Numeri uses distinct finite numbers even after 100 rounds and accepts tied averages',()=>{
 for(let n=2;n<=8;n++)for(let r of [1,8,50,100]){
  let s=createPartyGame('numeri',n,r);
  const nums=s.numbers.flat();assert.equal(new Set(nums).size,nums.length);assert.ok(nums.every(Number.isFinite));
  for(let i=0;i<n;i++)s=partyAction(s,i,{type:'ready'});
  const order=s.numbers.map((v,i)=>({i,mean:v.reduce((a,b)=>a+b)/v.length})).sort((a,b)=>a.mean-b.mean).map(v=>v.i);
  s=partyAction(s,0,{type:'order',order});s=partyAction(s,0,{type:'check'});assert.equal(s.correct,true);
 }
});
test('Impostore waits for every human, counts votes once, and gives the eliminated impostor a guess',()=>{
 let s=createPartyGame('impostore',3);
 for(let i=0;i<2;i++)s=partyAction(s,i,{type:'ready'});assert.equal(s.phase,'reveal');
 s=partyAction(s,2,{type:'ready'});const imp=s.roles.indexOf('impostor'),civ=s.roles.findIndex(r=>r==='civil');
 for(let i=0;i<3;i++)s=partyAction(s,i,{type:'vote',target:i===imp?civ:imp});
 assert.equal(s.phase,'guess');assert.equal(s.guessSeat,imp);
 assert.equal(partyAction(s,civ,{type:'guess',text:s.words[0]}).phase,'guess');
 assert.equal(partyAction(s,imp,{type:'guess',text:s.words[0]}).winner,'impostor');
 assert.equal(partyAction(s,imp,{type:'guess',text:'wrong'}).winner,'civil');
});
test('Numeri only host can reorder or advance a result; invalid permutations are rejected',()=>{
 let s=createPartyGame('numeri',3);for(let i=0;i<3;i++)s=partyAction(s,i,{type:'ready'});
 assert.deepEqual(partyAction(s,1,{type:'order',order:[2,1,0]}).order,[0,1,2]);
 assert.deepEqual(partyAction(s,0,{type:'order',order:[0,0,1]}).order,[0,1,2]);
 s=partyAction(s,0,{type:'check'});assert.equal(partyAction(s,1,{type:'next'}).round,1);assert.equal(partyAction(s,0,{type:'next'}).round,2);
});
test('Solo 3–8 player perspectives preserve all hands, seats and turns in both directions',()=>{
 for(let n=2;n<=8;n++)for(let seat=0;seat<n;seat++){
  const original={players:Array.from({length:n},(_,i)=>[i]),turn:seat,winner:(seat+1)%n};
  const local=cardPerspective(original,seat);assert.deepEqual(local.players[0],[seat]);assert.equal(local.turn,0);
  assert.deepEqual(cardPerspective(local,seat,true),original);
 }
});
test('Scopa perspective preserves captured cards, round scores and next-round starter',()=>{
 let s=createScopaMatch();while(!s.round.over){const p=s.round.turn,c=s.round.hands[p][0];playScopaMove(s,p,0,captureOptions(c,s.round.table)[0]||[]);}
 const other=scopaPerspective(s,1);assert.equal(other.totals[0],s.totals[1]);assert.deepEqual(scopaPerspective(other,1),s);
 nextScopaRound(s);assert.equal(s.round.starter,1);assert.equal(scopaPerspective(s,1).round.starter,0);
});
test('multiplayer protocol waits for all three seats and rejects out of turn writes',()=>{
 const now=100000,roster=['a','b','c'];let data={};
 for(let i=0;i<3;i++)data=enterMatch(data,'solo',i,{turn:0},roster,now);
 assert.throws(()=>changeMatch(data,data.onlineMatch.id,1,0,{turn:2},now),/turno/);
 assert.equal(changeMatch(data,data.onlineMatch.id,0,0,{turn:1},now).onlineMatch.state.turn,1);
});
