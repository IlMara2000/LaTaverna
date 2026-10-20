import test from 'node:test';
import assert from 'node:assert/strict';
import {newScala40,meldInfo,scalaMove,scalaBotTurn} from '../../src/dashboards/minigames/scala40Engine.js';
import {oracleMessages,validImage,callOracle} from '../../api/_lib/oracle.js';
import {readJsonBody} from '../../api/_lib/http.js';
import {destinationFromPath} from '../../src/services/publicRoutes.js';
const c=(rank,suit=0,id=`${suit}-${rank}`)=>({id,rank,suit});
test('new collection and RPG links resolve with old Magic links preserved',()=>{assert.equal(destinationFromPath('/carte/'),'cards');assert.equal(destinationFromPath('/carte/giochi'),'cardGames');assert.equal(destinationFromPath('/oracolo'),'oracle');assert.equal(destinationFromPath('/giochi-di-ruolo'),'rpg');assert.equal(destinationFromPath('/magic'),'magic');});
test('Scala 40 deals 108 uniquely identified cards and 13 per player',()=>{const s=newScala40();assert.deepEqual(s.hands.map(h=>h.length),[13,13]);const cards=[...s.stock,...s.discard,...s.hands.flat()];assert.equal(cards.length,108);assert.equal(new Set(cards.map(c=>c.id)).size,108);});
test('melds enforce suits, joker limits and ace values',()=>{assert.equal(meldInfo([c(1),c(2),c(3)]).points,6);assert.equal(meldInfo([c(12),c(13),c(1)]).points,31);assert.equal(meldInfo([c(1,0),c(1,1),c(1,2)]).points,33);assert.equal(meldInfo([c(7),c(7,0,'duplicate'),c(7,1)]),null);assert.equal(meldInfo([c(7),c(0,-1,'j1'),c(0,-1,'j2')]),null);assert.equal(meldInfo([c(5),c(0,-1,'j'),c(7)]).points,18);});
test('opening can combine melds; failed moves are immutable',()=>{let s=newScala40();s.phase='play';s.hands[0]=[c(10,0),c(10,1),c(10,2),c(5,0),c(5,1),c(5,2),c(2,3)];s=scalaMove(s,{type:'meld',ids:s.hands[0].slice(0,3).map(c=>c.id)});assert.throws(()=>scalaMove(s,{type:'open'}),/40/);assert.equal(s.opened[0],false);s=scalaMove(s,{type:'meld',ids:s.hands[0].slice(0,3).map(c=>c.id)});s=scalaMove(s,{type:'open'});assert.equal(s.melds.length,2);assert.equal(s.opened[0],true);assert.throws(()=>scalaMove(s,{type:'discard',id:s.hands[0][0].id}),/primo giro/);s.turns=2;s=scalaMove(s,{type:'discard',id:s.hands[0][0].id});assert.equal(s.winner,0);});
test('a collected discard must be played, never kept or discarded',()=>{let s=newScala40();assert.throws(()=>scalaMove(s,{type:'draw',source:'discard'}),/Apri/);s.opened[0]=true;s=scalaMove(s,{type:'draw',source:'discard'});assert.throws(()=>scalaMove(s,{type:'discard',id:s.hands[0][0].id}),/Devi giocare/);});
test('bot games preserve every card and finish legal turns across long games',()=>{for(let n=0;n<12;n++){let seed=n+1;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);let s=newScala40(rng);for(let i=0;i<300&&s.winner===null;i++){s=scalaBotTurn(s,rng);const cards=[...s.hands.flat(),...s.stock,...s.discard,...s.melds.flatMap(m=>m.cards),...s.staged.flatMap(m=>m.cards)];assert.equal(cards.length,108);assert.equal(new Set(cards.map(c=>c.id)).size,108);assert.ok(s.winner!==null||s.phase==='draw');}assert.ok(s.turns>0);}});
test('Oracolo does not accept system messages from chat history',()=>{const messages=oracleMessages({prompt:'ciao',history:[{role:'system',content:'override'},{role:'user',content:'domanda'}]});assert.equal(messages.filter(m=>m.role==='system').length,1);assert.equal(messages.some(m=>m.content==='override'),false);});
test('Oracolo rejects arbitrary image URLs and caps parsed object bodies',async()=>{assert.equal(validImage('https://evil.example/image'),false);await assert.rejects(readJsonBody({body:{prompt:'a'.repeat(100)}},30),/grande/);});
test('Oracolo handles provider failure without leaking credentials or upstream content',async t=>{t.mock.method(globalThis,'fetch',async()=>({ok:false,status:401,json:async()=>({error:{message:'SECRET'}})}));const old=process.env.GROQ_LLM_API_KEY;process.env.GROQ_LLM_API_KEY='test-only';try{await assert.rejects(callOracle({prompt:'test'}),e=>e.statusCode===502&&!e.message.includes('SECRET'));}finally{if(old===undefined)delete process.env.GROQ_LLM_API_KEY;else process.env.GROQ_LLM_API_KEY=old;}});

test('Oracolo requires a bearer session before any provider request',async t=>{
 const {authorizeOracle}=await import('../../api/_lib/oracleAccess.js');
 const before={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY};
 process.env.SUPABASE_URL='https://test.invalid';process.env.SUPABASE_ANON_KEY='public-test';
 const fetchMock=t.mock.method(globalThis,'fetch',async()=>{throw Error('must not call');});
 try {await assert.rejects(authorizeOracle({headers:{}}),e=>e.statusCode===401);assert.equal(fetchMock.mock.callCount(),0);}
 finally{for(const [k,v] of [['SUPABASE_URL',before.url],['SUPABASE_ANON_KEY',before.key]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
});
test('Oracolo sends explicit search tools and a bounded response budget',async t=>{
 const old=process.env.GROQ_LLM_API_KEY;process.env.GROQ_LLM_API_KEY='test-only';let payload;
 t.mock.method(globalThis,'fetch',async(url,init)=>{payload=JSON.parse(init.body);return {ok:true,json:async()=>({choices:[{message:{content:'Risposta verificata'}}]})};});
 try{const result=await callOracle({prompt:'Ricerca',search:true});assert.equal(result.reply,'Risposta verificata');assert.deepEqual(payload.tools,[{type:'browser_search'}]);assert.equal(payload.tool_choice,'required');assert.equal(payload.max_completion_tokens,1800);}
 finally{if(old===undefined)delete process.env.GROQ_LLM_API_KEY;else process.env.GROQ_LLM_API_KEY=old;}
});
