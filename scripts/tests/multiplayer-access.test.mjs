import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function harness(auth) {
  const calls=[];
  const context=vm.createContext({SUPABASE_CONFIG:{},isSupabaseConfigured:true,supabase:{auth,from(){calls.push('table');throw Error('unexpected table access');},rpc(){calls.push('rpc');return {error:Error('invite rejected')};}}});
  const source=readFileSync(new URL('../../src/services/minigameMultiplayer.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','');
  vm.runInContext(`${source}\nglobalThis.api={createMinigameRoom,joinMinigameRoom,joinMagicRoom};`,context);
  return {api:context.api,calls};
}
test('room operations fail closed when account and anonymous login are unavailable',async()=>{
  const {api,calls}=harness({getUser:async()=>({data:{user:null}}),signInAnonymously:async()=>({error:{message:'disabled'}})});
  for(const result of [await api.createMinigameRoom(),await api.joinMinigameRoom('ABC234'),await api.joinMagicRoom('ABC234')]) assert.ok(result.error);
  assert.deepEqual(calls,[]);
});
test('both invitation flows require server authorization before reading the room',async()=>{
  const {api,calls}=harness({getUser:async()=>({data:{user:{id:'signed-in'}}})});
  assert.ok((await api.joinMinigameRoom('ABC234')).error);
  assert.ok((await api.joinMagicRoom('ABC234')).error);
  assert.deepEqual(calls,['rpc','rpc']);
});
