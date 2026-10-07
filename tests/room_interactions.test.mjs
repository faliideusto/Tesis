import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({AbortController,console});
const mod=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/room-interactions.js',import.meta.url),'utf8'),{context});await mod.link(()=>{});await mod.evaluate();
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(equipped=true) {
  let time=1000,account='a',changed,channel={ultimo:8,ahora:1000,propia:{interactionId:equipped?'archivo_lanzamiento_libro':null,disponibleEn:0},eventos:[{numero:8,emisor:'Rival',objetivo:'Yo',interactionId:'archivo_lanzamiento_libro'}]},reads=[],posts=[],effects=[],timers=[];
  const listeners=new Map(),classes=new Set(),control={disabled:false,attrs:{},dataset:{},setAttribute(k,v){this.attrs[k]=v;}},count={textContent:''};
  const slot={innerHTML:'',querySelector:selector=>selector==='[data-room-interaction]'?slot.innerHTML?control:null:count,replaceChildren(){this.innerHTML='';}};
  const rival={dataset:{player:'Rival'},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,on){on?classes.add(x):classes.delete(x);}}};
  const document={getElementById:()=>({hidden:false}),querySelector:selector=>selector==='#local .room-interaction-slot'?slot:selector==='[data-room-interaction]'&&slot.innerHTML?control:null,querySelectorAll:()=>[rival],addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  let state={yo:'Yo',fase:'TURNO_JUGADOR',jugadores:[{nombre:'Yo'},{nombre:'Rival'}]},room={codigo:'ABCDE'},seat={codigo:'ABCDE',playerToken:'seat'};
  const api={identity:()=>seat,interacciones:async desde=>{reads.push(desde);return channel;},interactuar:async(id,objetivo)=>{posts.push({id,objetivo});channel={ultimo:9,ahora:time,propia:{interactionId:id,disponibleEn:time+15000},eventos:[{numero:9,emisor:'Yo',objetivo,interactionId:id}]};return channel;}};
  const controller=mod.namespace.createRoomInteractions({api,accounts:{identity:()=>account,signedIn:()=>!!account,onChange:fn=>{changed=fn;}},document,getRoom:()=>room,getState:()=>state,now:()=>time,schedule:(fn,delay)=>{const entry={fn,delay};timers.push(entry);return entry;},cancel:entry=>{if(entry)entry.cancelled=true;},play:async(event,options)=>effects.push({event,options})});
  const click=(kind,name)=>{let prevented=false;const target={closest:selector=>selector==='[data-room-interaction]'&&kind==='control'?control:selector==='.rival[data-player]'&&kind==='rival'?{dataset:{player:name}}:null};listeners.get('click')({target,preventDefault(){prevented=true;},stopImmediatePropagation(){}});return prevented;};
  return {controller,slot,control,classes,reads,posts,effects,channel,click,async tick(delay){const timer=timers.find(entry=>!entry.cancelled&&entry.delay===delay);assert(timer);timer.cancelled=true;timer.fn();await flush();},setTime(value){time=value;channel={...channel,ahora:time};},logout(){account=null;changed();},changeAccount(){account='other';changed();},escape(){listeners.get('keydown')({key:'Escape',preventDefault(){},stopImmediatePropagation(){}});},leave(){state=null;room=null;controller.update();}};
}
const absent=fixture(false);absent.controller.update();await flush();assert.equal(absent.slot.innerHTML,'');assert.equal(absent.effects.length,0,'Baseline skips historical events');absent.controller.destroy();
const game=fixture();game.controller.update();await flush();assert(game.slot.innerHTML.includes('<svg'));assert.equal(game.reads[0],undefined);assert.equal(game.effects.length,0);
game.click('control');assert(game.classes.has('room-interaction-target'));game.escape();assert(!game.classes.has('room-interaction-target'));
game.click('control');assert.equal(game.click('rival','Yo'),false);assert.equal(game.posts.length,0,'Self cannot be targeted');assert(!game.classes.has('room-interaction-target'));
game.click('control');assert.equal(game.click('rival','Rival'),true);await flush();assert.equal(game.posts.length,1);assert.equal(game.posts[0].objetivo,'Rival');assert.equal(game.effects.length,1);assert.equal(game.control.disabled,true);
await game.tick(900);assert.equal(game.effects.length,1,'POST and polling deduplicate the same event');game.click('control');game.click('rival','Rival');assert.equal(game.posts.length,1,'Cooldown prevents sending');
game.setTime(16000);await game.tick(900);assert.equal(game.control.disabled,false);game.changeAccount();await flush();assert.equal(game.slot.innerHTML,'','New account cannot use the old linked seat');game.logout();assert.equal(game.slot.innerHTML,'');game.leave();assert.equal(game.effects[0].options.signal.aborted,true);game.controller.destroy();

// A pending functional request must never delay this independent channel.
const requests=[];let release;
const apiContext=vm.createContext({AbortController,setTimeout,clearTimeout,sessionStorage:{getItem:key=>key==='tesis.sala'?JSON.stringify({codigo:'ABCDE',playerToken:'seat'}):null,setItem(){},removeItem(){}},fetch:async(path,init)=>{requests.push({path,init});if(path.endsWith('/estado'))await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({ultimo:0,eventos:[]})};}});
const dependency=new vm.SyntheticModule(['accounts'],function(){this.setExport('accounts',{identity:()=> 'a',accessToken:async()=> 'account'});},{context:apiContext});
const apiMod=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/api.js',import.meta.url),'utf8'),{context:apiContext});await apiMod.link(()=>dependency);await apiMod.evaluate();const api=apiMod.namespace.api;
const pending=api.state();await flush();await api.interacciones(7);assert.equal(requests.at(-1).path,'/api/salas/ABCDE/interacciones?desde=7');assert.equal(requests.at(-1).init.headers.Authorization,'Bearer seat');
await api.interactuar('archivo_lanzamiento_libro','Rival');assert.equal(requests.at(-1).init.headers['X-Tesis-Account-Authorization'],'Bearer account');assert.equal(requests.at(-1).init.body,'{"interactionId":"archivo_lanzamiento_libro","objetivo":"Rival"}');release();await pending;
console.log('Interacciones: control privado, selección, cancelación, no self, eventos únicos, cooldown, identidad y transporte independiente PASS');
