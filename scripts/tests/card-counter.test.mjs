import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,changeScore,validateMatch,loadMatch,saveMatch} from '../../src/services/cardCounter.js';
test('presets initialize independent players and counters',()=>{
 for(const [preset,initial] of [['yugioh',8000],['magic',20],['commander',40],['pokemon',6],['custom',0]]){
  const s=createMatch(preset,4);assert.equal(s.players.length,4);assert.equal(s.players[0].value,initial);assert.ok(validateMatch(s));
 }
});
test('score changes do not mutate history and respect the preset boundaries',()=>{
 const y=createMatch();const n=changeScore(y,0,-1500);assert.equal(n.players[0].value,6500);assert.equal(y.players[0].value,8000);
 assert.equal(changeScore(y,0,-9000).players[0].value,0);
 const m=createMatch('magic');assert.equal(changeScore(m,0,-21).players[0].value,-1);
 const p=createMatch('pokemon');assert.equal(changeScore(p,0,5).players[0].value,6);assert.equal(changeScore(p,0,-7).players[0].value,0);
});
test('damage counters increment separately and never become negative',()=>{
 const s=createMatch('pokemon');const n=changeScore(s,1,10,'default-0');assert.equal(n.players[1].counters[0].value,10);assert.equal(n.players[1].value,6);
 assert.equal(changeScore(n,1,-20,'default-0').players[1].counters[0].value,0);
 assert.throws(()=>changeScore(s,0,NaN));assert.throws(()=>changeScore(s,9,1));assert.throws(()=>changeScore(s,0,1,'missing'));
});
test('saved games round-trip and corrupt storage is rejected',()=>{
 const store=new Map();const storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
 const s=changeScore(createMatch('magic'),0,-3);assert.equal(saveMatch(s,storage),true);assert.deepEqual(loadMatch(storage),s);
 assert.equal(loadMatch({getItem:()=>'{bad'}),null);assert.equal(saveMatch(s,{setItem:()=>{throw Error();}}),false);
 const bad=structuredClone(s);bad.players[0].counters[0].value=-1;assert.equal(validateMatch(bad),null);
 assert.throws(()=>createMatch('bogus'));assert.throws(()=>createMatch('magic',7));
});
