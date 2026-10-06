// node --experimental-vm-modules tests/matchmaking.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {setImmediate} from 'node:timers/promises';
const store=new Map(), calls=[];
const context=vm.createContext({crypto:{getRandomValues:bytes=>webcrypto.getRandomValues(bytes)},AbortController,setTimeout,clearTimeout,
  sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  fetch:async(path,init)=>{
    calls.push({path,init});
    if(path==='/api/matchmaking')throw new Error('Respuesta perdida');
    return {ok:true,json:async()=>({fase:'BUSCANDO',jugadores:4,reunidos:1})};
  }});
const auth=new vm.SyntheticModule(['accounts'],function(){this.setExport('accounts',{accessToken:async()=> 'account-token'});},{context});
async function loadApi(){
  const mod=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/api.js',import.meta.url),'utf8'),{context});
  await mod.link(()=>auth);await mod.evaluate();return mod.namespace.api;
}
const api=await loadApi();
await assert.rejects(api.matchSearch('Ana',4),/perdida/);
const saved=JSON.parse(store.get('tesis.matchmaking'));
assert.match(saved.token,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(saved.jugadores,4);
assert.equal(calls[0].init.headers.Authorization,`Bearer ${saved.token}`);
assert.equal(calls[0].init.headers['X-Tesis-Account-Authorization'],'Bearer account-token');
assert.throws(()=>api.matchSearch('Ana',3),/pendiente/);
const restored=await loadApi();
await restored.matchState();
assert.equal(calls.at(-1).path,'/api/matchmaking/estado');
assert.equal(calls.at(-1).init.headers.Authorization,`Bearer ${saved.token}`);
assert.equal(calls.at(-1).init.headers['X-Tesis-Account-Authorization'],undefined);
await restored.matchConfirm('grupo-vigente');
assert.equal(JSON.parse(calls.at(-1).init.body).grupo,'grupo-vigente');
await restored.matchCancel();assert.equal(calls.at(-1).path,'/api/matchmaking/cancelar');
restored.matchAccept({codigo:'ABCDE',playerToken:'private-token',sala:{fase:'EN_PARTIDA'}});
assert.equal(store.has('tesis.matchmaking'),false);
await restored.state();assert.equal(calls.at(-1).init.headers.Authorization,'Bearer private-token');

// UI: cancelación, respuesta ambigua, consulta de recuperación y grupo obsoleto.
const timers=new Map();let timerId=0, pending=null, identity=null, confirms=[], status=[], homes=0,rooms=[];
const nodes=new Map();
const host={innerHTML:'',querySelector:key=>{
  if(!nodes.has(key))nodes.set(key,{textContent:'',focus(){}});return nodes.get(key);
},querySelectorAll:()=>[]};
const uiContext=vm.createContext({Date,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
const dom=new vm.SyntheticModule(['esc'],function(){this.setExport('esc',String);},{context:uiContext});
const ui=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/matchmaking.js',import.meta.url),'utf8'),{context:uiContext});
await ui.link(()=>dom);await ui.evaluate();
let next={fase:'BUSCANDO',jugadores:3,reunidos:1};
const fake={matchIdentity:()=>identity,matchForget:()=>{identity=null;},
  matchSearch:async(_name,jugadores)=>{identity={token:'saved',jugadores};throw new Error('Sin respuesta');},
  matchState:()=>pending || Promise.resolve(next),
  matchConfirm:async grupo=>{confirms.push(grupo);return {...next,listo:true};},
  matchCancel:async()=>({fase:'CANCELADA'}),matchAccept:access=>access.sala};
const controller=ui.namespace.createMatchmaking({api:fake,panel:()=>host,onRoom:sala=>rooms.push(sala),onHome:()=>homes++,status:message=>status.push(message)});
async function poll(){const [id,fn]=[...timers].at(-1);timers.delete(id);await fn();}
controller.open();assert.match(host.innerHTML,/Tamaño de la mesa/);
await controller.submit('Ana',3);
assert.match(host.innerHTML,/Cancelar búsqueda/);
assert(identity);assert.match(status.at(-1),/Consultando/);
await poll();assert.equal(nodes.get('#match-count').textContent,'1/3 jugadores');
next={fase:'CONFIRMACION',jugadores:3,reunidos:3,confirmados:0,grupo:'primero',hasta:Date.now()+20000};
await poll();assert.match(host.innerHTML,/Estoy listo/);
await controller.command('ready');assert.deepEqual(confirms,['primero']);
next={...next,grupo:'sustituto',listo:false};await poll();
await controller.command('ready');assert.deepEqual(confirms,['primero','sustituto']);
await controller.command('cancel');assert.equal(homes,1);assert.equal(controller.active(),false);assert.equal(identity,null);assert.equal(timers.size,0);

// Una cancelación que compite con la asignación se resuelve consultando, sin repetir POST.
identity={token:'saved',jugadores:4};next={fase:'BUSCANDO',jugadores:4,reunidos:1};controller.open();
await setImmediate();
fake.matchCancel=async()=>{const error=new Error('Ya asignada');error.status=409;throw error;};
await controller.command('cancel');
next={fase:'ASIGNADA',acceso:{sala:{codigo:'MATCH'}}};await poll();
assert.equal(rooms.length,1);assert.equal(rooms[0].codigo,'MATCH');assert.equal(timers.size,0);

// Abrir de nuevo invalida un GET viejo que llegaría después.
identity={token:'saved',jugadores:3};next={fase:'BUSCANDO',jugadores:3,reunidos:1};controller.open();
await setImmediate();
let resolve;pending=new Promise(r=>{resolve=r;});const old=poll();
pending=null;controller.open();resolve({fase:'ASIGNADA',acceso:{sala:{codigo:'STALE'}}});await old;
assert.equal(rooms.length,1,'No admite una asignación de una generación anterior');
console.log('Matchmaking: identidad, recuperación, tamaños, confirmación, cancelación y respuestas antiguas verificados');
