// node --experimental-vm-modules tests/community.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({setTimeout,clearTimeout,AbortController,Intl,Date});
const modules=new Map();
async function module(name){
  if(modules.has(name))return modules.get(name);
  const value=new vm.SourceTextModule(await readFile(new URL(`../src/main/resources/static/js/${name}`,import.meta.url),'utf8'),{context});
  modules.set(name,value);await value.link(spec=>module(spec.replace('./','')));await value.evaluate();return value;
}
const {friendsView,rankingView,missionsView,mountCommunity}= (await module('community-panel.js')).namespace;
const hostile='<img src=x onerror="bad()">';
const {publicProfileView}=(await module('public-profile.js')).namespace;
const publicHtml=publicProfileView({nombre:hostile,codigo:'0000000000000001',nivel:20,xp:9620,partidasTerminadas:60,victorias:24,enLinea:true,presenciaDisponible:false});
assert.ok(!publicHtml.includes('<img src=x'));
assert.match(publicHtml,/40%/);assert.match(publicHtml,/Presencia no disponible/);
assert.ok(!publicHtml.includes('account-edit')&&!publicHtml.includes('account-logout'));
const personLink=friendsView({codigo:'0000000000000000',amigos:[{nombre:'Bruno',codigo:'0000000000000001',nivel:20}]});
assert.match(personLink,/data-public-profile="0000000000000001"/);
assert.ok(!friendsView({codigo:hostile,amigos:[{codigo:hostile,nombre:hostile,nivel:2}]}).includes('<img src=x'));
assert.match(friendsView({codigo:'ABC',amigos:[],recibidas:[],enviadas:[]}),/Todavía no tienes amigos/);
const ranked=rankingView({entradas:[{posicion:1,nombre:hostile,nivel:2,xp:500,victorias:3,partidas:5,yo:true}],propia:{posicion:90,nivel:1,xp:10}},'victorias');
assert.match(ranked,/#90/);assert.match(ranked,/ranking-self/);assert.ok(!ranked.includes('<img src=x'));
const missions=missionsView({diarias:[{id:hostile,titulo:hostile,objetivo:1,progreso:9,xp:50,completada:true,reclamada:false},{id:'claimed',titulo:'Ya recibida',objetivo:3,progreso:3,xp:75,completada:true,reclamada:true}],semanales:[],reinicioDiario:'2026-10-07T00:00:00Z',reinicioSemanal:'2026-10-12T00:00:00Z'});
assert.ok(!missions.includes('<img src=x'));assert.match(missions,/value="1" max="1"/);assert.match(missions,/data-claim-mission="claimed" disabled/);assert.match(missions,/tu hora local/);assert.match(missions,/00:00 UTC/);

class Root {
  constructor(){this.listeners={};this.controls=[];this.message={textContent:'',focus:()=>{this.ownerDocument.activeElement=this.message;}};this.ownerDocument={activeElement:null};}
  set innerHTML(value){this.html=value;this.controls=[];for(const found of value.matchAll(/<(button|input|select)\b([^>]*)>/g)){
    const attributes=new Map([...found[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(match=>[match[1],match[2]??'']));
    const control={id:attributes.get('id')||'',value:attributes.get('value')||'',dataset:{},disabled:attributes.has('disabled'),hasAttribute:key=>attributes.has(key),focus:()=>{this.ownerDocument.activeElement=control;},select(){},closest(){return this;}};
    for(const [key,val] of attributes)if(key.startsWith('data-'))control.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=val;
    this.controls.push(control);
  }}
  get innerHTML(){return this.html;}
  querySelectorAll(){return this.controls;}
  querySelector(selector){if(selector==='[data-community-message]')return this.message;if(selector[0]==='#')return this.controls.find(control=>control.id===selector.slice(1));return this.controls.find(control=>control.hasAttribute(selector.slice(1,-1)));}
  contains(control){return this.controls.includes(control);}
  setAttribute(){}addEventListener(type,listener){this.listeners[type]=listener;}removeEventListener(type){delete this.listeners[type];}
  click(control){return this.listeners.click({target:control});}
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const community={codigo:'ABCDEF',amigos:[],recibidas:[],enviadas:[]};
let actor='one';const account={identity:()=>actor,signedIn:()=>true,community:async()=>community};
let resolve;
const deferred=new Promise(value=>resolve=value);
const stale=new Root();const controller=mountCommunity(stale,{accounts:{...account,community:()=>deferred},page:'friends'});
controller.destroy();resolve(community);await tick();assert.ok(!stale.innerHTML.includes('ABCDEF'),'Cerrar impide renderizar una respuesta pendiente');
let resolveAccount;
const changed=new Root();mountCommunity(changed,{accounts:{...account,community:()=>new Promise(value=>resolveAccount=value)},page:'friends'});
actor='two';resolveAccount(community);await tick();assert.ok(!changed.innerHTML.includes('ABCDEF'),'Cambio de cuenta descarta datos de la anterior');

let requests=0;
const failed=new Root();mountCommunity(failed,{accounts:{...account,community:async()=>{requests++;throw new Error('Sin conexión');}},page:'friends'});
await tick();assert.equal(requests,1);assert.match(failed.innerHTML,/No se pudo cargar/);assert.equal(failed.message.textContent,'Sin conexión');

const rankRoot=new Root();let criteria=[];
mountCommunity(rankRoot,{accounts:{...account,ranking:async criterion=>{criteria.push(criterion);if(criterion==='victorias')throw new Error('Servicio temporalmente no disponible');return {entradas:[],propia:null};}},page:'ranking'});
await tick();let select=rankRoot.querySelector('#ranking-criterion');select.focus();select.value='partidas';rankRoot.listeners.change({target:select});await tick();
select=rankRoot.querySelector('#ranking-criterion');assert.equal(rankRoot.ownerDocument.activeElement,select,'Cambio de orden mantiene el foco del teclado');
select.value='victorias';rankRoot.listeners.change({target:select});await tick();
assert.deepEqual(criteria,['xp','partidas','victorias']);assert.equal(select.value,'partidas','Fallo conserva criterio de los datos actuales');assert.match(rankRoot.innerHTML,/Tu posición aparecerá/);

let claims=0,rewards=0,resolveClaim;
const missionData={diarias:[{id:'d',titulo:'Juega una partida',objetivo:1,progreso:1,xp:50,completada:true,reclamada:false}],semanales:[]};
const missionRoot=new Root();mountCommunity(missionRoot,{accounts:{...account,missions:async()=>missionData,claimMission:()=>{claims++;return new Promise(value=>resolveClaim=value);}},page:'missions',onReward:()=>rewards++});
await tick();const claim=missionRoot.querySelector('[data-claim-mission]');missionRoot.ownerDocument.activeElement=claim;
await missionRoot.click(claim);await missionRoot.click(claim);assert.equal(claims,1,'Reclamo concurrente bloqueado');
assert.equal(missionRoot.ownerDocument.activeElement,missionRoot.message,'Una acción pendiente mantiene el foco dentro del panel para permitir Escape');
resolveClaim({...missionData,diarias:[{...missionData.diarias[0],reclamada:true}]});await tick();assert.equal(rewards,1);assert.match(missionRoot.innerHTML,/Reclamada ✓/);

let removals=0;
const friendRoot=new Root();mountCommunity(friendRoot,{accounts:{...account,community:async()=>({...community,amigos:[{codigo:'FRIEND',nombre:'Ana',nivel:1}]}),friendship:async()=>{removals++;return community;}},page:'friends',confirm:()=>false});
await tick();await friendRoot.click(friendRoot.querySelector('[data-friend-action]'));assert.equal(removals,0,'Eliminar requiere confirmación explícita');

const {createAccounts}=(await module('auth.js')).namespace;
let authCallback;const session={access_token:'account-token',user:{id:'auth-user'}};
const paths=[];const auth=createAccounts({storage:{getItem:()=>null},sdk:()=>({createClient:()=>({auth:{onAuthStateChange:fn=>authCallback=fn,getSession:async()=>({data:{session}})}})}),fetcher:async(path,init)=>{paths.push({path,init});return {ok:true,json:async()=>path.endsWith('config')?{habilitado:true,url:'https://example.com',publishableKey:'p'}:{}};}});
await auth.initialize();await auth.community();await auth.friendship('ABC','solicitar');await auth.ranking('victorias');await auth.missions();await auth.claimMission('d');
assert.deepEqual(paths.slice(1).map(value=>value.path),['/api/comunidad','/api/amigos','/api/ranking?criterio=victorias','/api/misiones','/api/misiones/reclamar']);
for(const {init} of paths.slice(1)){assert.equal(init.headers.Authorization,'Bearer account-token');assert.ok(init.signal);assert.equal(init.headers['X-Tesis-Account-Authorization'],undefined);}
assert.equal(paths[2].init.body,'{"codigo":"ABC","accion":"solicitar"}');assert.equal(paths[5].init.body,'{"id":"d"}');
authCallback('SIGNED_OUT',null);assert.equal(auth.identity(),null);
// Account mutations must retain the originating actor even while the SDK renews a token.
for(const returnToA of [false,true]) {
  let sdkCallback,finishSession,delay=false;
  const a={access_token:'token-a',user:{id:'A'}},b={access_token:'token-b',user:{id:'B'}};
  let sdkSession=a,mutations=0;
  const raced=createAccounts({storage:{getItem:()=>null},sdk:()=>({createClient:()=>({auth:{onAuthStateChange:fn=>sdkCallback=fn,getSession:()=>delay?new Promise(resolve=>finishSession=resolve):Promise.resolve({data:{session:sdkSession}})}})}),fetcher:async(path)=>{if(!path.endsWith('config'))mutations++;return {ok:true,json:async()=>({habilitado:true,url:'https://example.com',publishableKey:'p'})};}});
  await raced.initialize();delay=true;
  const action=raced.friendship('FRIEND','solicitar');await tick();
  sdkSession=b;sdkCallback('SIGNED_IN',b);
  if(returnToA){sdkSession=a;sdkCallback('SIGNED_IN',a);}
  finishSession({data:{session:sdkSession}});
  await assert.rejects(action,/cuenta ha cambiado/);assert.equal(mutations,0,'No enviar una acción iniciada en otra generación de cuenta');
  assert.equal(raced.identity(),returnToA?'A':'B');
}
// A changed identity discovered by getSession (without callback) also cancels mutation.
let silentlyChanged=false,silentMutations=0;
const silent=createAccounts({storage:{getItem:()=>null},sdk:()=>({createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{access_token:silentlyChanged?'B':'A',user:{id:silentlyChanged?'B':'A'}}}})}})}),fetcher:async path=>{if(!path.endsWith('config'))silentMutations++;return {ok:true,json:async()=>({habilitado:true,url:'https://example.com',publishableKey:'p'})};}});
await silent.initialize();silentlyChanged=true;
await assert.rejects(silent.claimMission('d'),/cuenta ha cambiado/);assert.equal(silentMutations,0);assert.equal(silent.identity(),'B');
console.log('Comunidad: contrato, escape, cuenta/cierre, errores, confirmación y recompensas verificados');
