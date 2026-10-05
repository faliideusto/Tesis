// node --experimental-vm-modules tests/academy_navigation.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function fixture(initialHash='',offline=false,refresh=async()=>{}) {
  const events=new Map(),windowEvents=new Map(),mounts=[];
  let identity=null,listener;
  const document={activeElement:null,title:'',addEventListener:(type,fn)=>events.set(type,fn),dispatchEvent(){}};
  const element=()=>({hidden:false,inert:false,isConnected:true,dataset:{},innerHTML:'',children:[],
    classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},insertAdjacentHTML(){},
    focus(){document.activeElement=this;},addEventListener(){},contains(){return false;},matches(){return false;}});
  const panel=element(),opener=element(),app=element(),body=element();panel.hidden=true;document.body=body;
  const panelEvents=new Map();panel.addEventListener=(type,fn)=>panelEvents.set(type,fn);
  const nodes=new Map();
  panel.querySelector=selector=>{if(selector==='#account-rename:not([hidden])')return null;if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);};
  panel.querySelectorAll=selector=>selector==='[data-academy-page]'?['profile','friends','ranking','missions'].map(page=>{const node=panel.querySelector(`[data-academy-page="${page}"]`);node.dataset.academyPage=page;return node;}):[];
  document.getElementById=id=>({'account-panel':panel,'account-open':opener,app}[id]);
  const location={pathname:'/',search:'',hash:initialHash};
  const stack=[{hash:initialHash,state:null}];let index=0;
  const history={state:null,
    pushState(state,_,url){stack.splice(++index);stack.push({hash:url.includes('#')?url.slice(url.indexOf('#')):'',state});location.hash=stack[index].hash;this.state=state;},
    replaceState(state,_,url){stack[index]={hash:url.includes('#')?url.slice(url.indexOf('#')):'',state};location.hash=stack[index].hash;this.state=state;},
    go(step){index+=step;location.hash=stack[index].hash;this.state=stack[index].state;windowEvents.get('popstate')();windowEvents.get('hashchange')();},
    back(){this.go(-1);}};
  const accounts={identity:()=>identity,signedIn:()=>!!identity,profile:()=>identity?{nombre:identity,xp:0}:null,
    enabled:()=>true,onChange:fn=>listener=fn,initialize:async()=>{if(offline)throw new Error('503');},refreshProfile:refresh,
    login:async()=>{identity='Ana';listener();}};
  const context=vm.createContext({document,location,history,FormData:class{get(key){return {email:'ana@example.test',password:'clave123'}[key];}},Event:class{},window:{scrollY:100,scrollTo(){},addEventListener:(type,fn)=>windowEvents.set(type,fn)}});
  const exports={accounts,esc:String,RANKS:[],progression:()=>({rank:{id:'madera',name:'Madera'},level:1,index:0}),badge:()=>'',academyTabs:()=>'',
    mountCommunity:(_,options)=>{const mount={page:options.page,destroyed:false,destroy(){this.destroyed=true;}};mounts.push(mount);return mount;}};
  const dependency=new vm.SyntheticModule(Object.keys(exports),function(){for(const [key,value] of Object.entries(exports))this.setExport(key,value);},{context});
  const module=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/account-panel.js',import.meta.url),'utf8'),{context});
  await module.link(()=>dependency);await module.evaluate();module.namespace.initAccountPanel();await Promise.resolve();await Promise.resolve();
  return {panel,opener,app,mounts,location,history,stack,nodes,get active(){return document.activeElement;},
    login(name='Ana'){identity=name;listener();},logout(){identity=null;listener();},
    click(hash){const link=element();link.getAttribute=()=>hash;events.get('click')({target:{closest:()=>link},preventDefault(){},button:0});return link;},
    tab(page){panel.querySelector(`[data-academy-page="${page}"]`).onclick();},
    submitLogin(){panelEvents.get('submit')({target:{id:'account-login'},preventDefault(){}});},
    close(){panel.querySelector('.account-close').onclick();}};
}

const direct=await fixture('#misiones');
assert.equal(direct.panel.dataset.page,'missions');assert.equal(direct.panel.dataset.view,'auth');
direct.login();assert.equal(direct.mounts.at(-1).page,'missions','Login conserva el destino directo');
direct.close();assert.equal(direct.location.hash,'');assert.equal(direct.app.hidden,false);

const nav=await fixture();nav.login();const origin=nav.click('#amigos');
assert.equal(nav.mounts.at(-1).page,'friends');const friends=nav.mounts.at(-1);
nav.tab('ranking');assert.equal(nav.location.hash,'#ranking');assert.equal(nav.stack.length,2,'Las pestañas reemplazan una entrada');assert.ok(friends.destroyed);
nav.close();assert.equal(nav.location.hash,'');assert.equal(nav.active,origin,'Cerrar devuelve foco al enlace de inicio');
nav.history.go(1);assert.equal(nav.panel.dataset.page,'ranking','Forward restaura la sección');
nav.logout();assert.ok(nav.mounts.at(-1).destroyed,'Cerrar sesión destruye la vista privada');assert.equal(nav.panel.dataset.view,'auth');
nav.login('Bea');assert.equal(nav.mounts.at(-1).page,'ranking','Otra identidad monta datos nuevos');
nav.opener.onclick();assert.equal(nav.location.hash,'#perfil','Mi perfil siempre abre perfil');assert.equal(nav.panel.dataset.page,'profile');
const offline=await fixture('',true);offline.click('#amigos');
assert.match(offline.panel.innerHTML,/La academia está desconectada/,'Los enlaces respetan el fallo de configuración');
assert.equal(offline.location.hash,'#amigos','Se conserva el destino para recargar');
assert.equal(offline.mounts.length,0);
const failedProfile=await fixture('#misiones',false,async()=>{throw new Error('Perfil 503');});
failedProfile.submitLogin();for(let i=0;i<8;i++)await Promise.resolve();
assert.match(failedProfile.nodes.get('#account-message').textContent,/Sesión iniciada.*No se pudo cargar tu perfil/,'El login correcto conserva el mensaje si falla cargar el perfil');
assert.equal(failedProfile.panel.dataset.page,'missions');
let rejectOldProfile;
const changedAccount=await fixture('#amigos',false,()=>new Promise((_,reject)=>rejectOldProfile=reject));
changedAccount.submitLogin();for(let i=0;i<4;i++)await Promise.resolve();
changedAccount.login('Bea');changedAccount.nodes.get('#account-message').textContent='Mensaje de Bea';
rejectOldProfile(new Error('Perfil anterior 503'));for(let i=0;i<8;i++)await Promise.resolve();
assert.equal(changedAccount.nodes.get('#account-message').textContent,'Mensaje de Bea','Una respuesta de la cuenta anterior no modifica la cuenta actual');
console.log('Navegación academia: rutas directas, login, historial, sección y destrucción de vistas privadas verificadas');
