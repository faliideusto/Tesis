// Contratos del transporte preparado para la futura UI, sin renderizar Misiones.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({setTimeout,clearTimeout,AbortController});
const auth=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/auth.js',import.meta.url),'utf8'),{context});
await auth.link(()=>{});await auth.evaluate();
const calls=[],stored=new Map([['tesis.sala','room-token']]);
let session={access_token:'account-token',user:{id:'account-id'}},fail=false;
const accounts=auth.namespace.createAccounts({
 storage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)},
 sdk:()=>({createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session}})}})}),
 fetcher:async(path,options)=>{
  calls.push({path,options});
  if(path==='/api/cuentas/config')return {ok:true,json:async()=>({habilitado:true,url:'https://example.supabase.co',publishableKey:'public'})};
  if(fail)throw new TypeError('Respuesta perdida');
  return {ok:true,json:async()=>({})};
 }
});
await accounts.initialize();await accounts.seasonPass();
assert.equal(calls.at(-1).path,'/api/pase');assert.equal(calls.at(-1).options.method,'GET');
await accounts.seasonPass('temporada:2026-10');
assert.equal(calls.at(-1).path,'/api/pase?temporada=temporada%3A2026-10');
await accounts.claimSeasonReward('temporada:2026-10','reward-placeholder');
assert.deepEqual(JSON.parse(calls.at(-1).options.body),{temporada:'temporada:2026-10',id:'reward-placeholder'});
assert.equal(calls.at(-1).options.headers.Authorization,'Bearer account-token');
assert.equal(calls.at(-1).options.headers['X-Tesis'],'1');
assert.equal(calls.at(-1).options.method,'POST');
assert(!calls.at(-1).options.body.includes('puntos'));assert(!calls.at(-1).options.body.includes('actor'));
await accounts.cosmetics();assert.equal(calls.at(-1).path,'/api/cosmeticos');
await accounts.equipCosmetic('avatar','placeholder-avatar');
assert.equal(calls.at(-1).path,'/api/cosmeticos/equipar');
assert.deepEqual(JSON.parse(calls.at(-1).options.body),{tipo:'avatar',id:'placeholder-avatar'});
await accounts.equipCosmetic('avatar',null);
assert.deepEqual(JSON.parse(calls.at(-1).options.body),{tipo:'avatar',id:null});
await accounts.equipCosmetic('placa','archivo-tinta-dorada');
assert.deepEqual(JSON.parse(calls.at(-1).options.body),{tipo:'placa',id:'archivo-tinta-dorada'});
const count=calls.length;fail=true;
await assert.rejects(()=>accounts.claimSeasonReward('temporada:2026-10','reward-placeholder'),/Respuesta perdida/);
assert.equal(calls.length,count+1,'No se reintenta una reclamación ambigua');
assert.equal(stored.get('tesis.sala'),'room-token','El equipamiento y pase no sustituyen el token de sala');
fail=false;session=null;const before=calls.length;
await assert.rejects(()=>accounts.cosmetics(),/La cuenta ha cambiado/);
await assert.rejects(()=>accounts.cosmetics(),/Inicia sesión/);
assert.equal(calls.length,before,'Una consulta privada sin cuenta no llega al servidor');
console.log('Pase: transporte autenticado, temporada codificada, equipamiento/vaciado, sin actor/puntos ni reintentos ambiguos');
