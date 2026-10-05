// node --experimental-vm-modules tests/accounts.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const store=new Map([['tesis.sala','{"codigo":"ABCDE","playerToken":"room-token"}']]);
const storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
const context=vm.createContext({setTimeout,clearTimeout,AbortController,sessionStorage:storage});
const auth=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/auth.js',import.meta.url),'utf8'),{context});
await auth.link(()=>{});await auth.evaluate();
let callback,session={access_token:'account-token'},options,signups=0,requests=[];
const client={auth:{
  onAuthStateChange:fn=>{callback=fn;},getSession:async()=>({data:{session}}),
  signInWithPassword:async()=>({data:{session}}),
  signUp:async payload=>{assert.equal(payload.options.data.display_name,'Ana');signups++;return {data:{session}};},
  signOut:async({scope})=>{assert.equal(scope,'local');session=null;callback('SIGNED_OUT',null);return {};}
}};
const accounts=auth.namespace.createAccounts({storage,sdk:()=>({createClient:(_url,_key,opts)=>{options=opts;return client;}}),
  fetcher:async(path,init)=>{
    requests.push({path,init});
    return {ok:true,json:async()=>path.endsWith('/config')?{habilitado:true,url:'https://project.supabase.co',publishableKey:'public'}:{nombre:'Ana',xp:500,nivel:2,partidasTerminadas:5,victorias:0}};
  }});
await accounts.initialize();
assert.equal(options.auth.storageKey,'tesis.cuenta');assert.equal(options.auth.storage,storage);
assert.equal(options.auth.autoRefreshToken,true);assert.equal(options.auth.detectSessionInUrl,false);
assert.equal(await accounts.accessToken(),'account-token');
await accounts.refreshProfile();assert.equal(accounts.profile().nivel,2);
assert.equal(requests.at(-1).init.headers.Authorization,'Bearer account-token');
await accounts.rename('Ana');assert.equal(requests.at(-1).init.method,'POST');assert.equal(requests.at(-1).init.headers['X-Tesis'],'1');
await accounts.register('ana@example.com','123456','Ana');assert.equal(signups,1);
const api=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/api.js',import.meta.url),'utf8'),{context});
const fakeAuth=new vm.SyntheticModule(['accounts'],function(){this.setExport('accounts',accounts);},{context});
context.fetch=async(path,init)=>{
  requests.push({path,init});
  return {ok:true,json:async()=>path==='/api/salas'?{codigo:'ABCDE',playerToken:'new-room-token',sala:{revision:1}}:{revision:1}};
};
await api.link(()=>fakeAuth);await api.evaluate();
await api.namespace.api.create('Ana');
assert.equal(requests.at(-1).init.headers['X-Tesis-Account-Authorization'],'Bearer account-token');
assert.equal(requests.at(-1).init.headers.Authorization,undefined);
await api.namespace.api.state();assert.equal(requests.at(-1).init.headers.Authorization,'Bearer new-room-token');
assert.equal(requests.at(-1).init.headers['X-Tesis-Account-Authorization'],undefined);
await accounts.logout();assert.equal(accounts.signedIn(),false);assert.equal(accounts.profile(),null);
assert.match(store.get('tesis.sala'),/new-room-token/);
await api.namespace.api.create('Invitado');assert.equal(requests.at(-1).init.headers['X-Tesis-Account-Authorization'],undefined);
store.set('tesis.cuenta','saved-account');
accounts.forgetStoredSession();
assert.equal(store.has('tesis.cuenta'),false);
assert.match(store.get('tesis.sala'),/new-room-token/,'La elección explícita de invitado conserva la sala');
// Una cuenta guardada debe esperar la configuración y restauración, antes del POST.
let resolveConfig;
const pendingConfig=new Promise(resolve=>{resolveConfig=resolve;});
const knownStorage={getItem:key=>key==='tesis.cuenta'?'{"access_token":"restored-token"}':null};
const restoredClient={auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{access_token:'restored-token'}}})}};
const delayed=auth.namespace.createAccounts({storage:knownStorage,sdk:()=>({createClient:()=>restoredClient}),
  fetcher:()=>pendingConfig});
const delayedDependency=new vm.SyntheticModule(['accounts'],function(){this.setExport('accounts',delayed);},{context});
const delayedApi=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/api.js',import.meta.url),'utf8'),{context});
await delayedApi.link(()=>delayedDependency);await delayedApi.evaluate();
const start=requests.length;
const entering=delayedApi.namespace.api.create('Restaurada');
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(requests.length,start,'No debe entrar como invitado mientras Auth está pendiente');
resolveConfig({ok:true,json:async()=>({habilitado:true,url:'https://project.supabase.co',publishableKey:'public'})});
await entering;
assert.equal(requests.at(-1).init.headers['X-Tesis-Account-Authorization'],'Bearer restored-token');
const configFailure=async()=>{throw new Error('Sin servicio');};
const failedKnown=auth.namespace.createAccounts({storage:knownStorage,fetcher:configFailure});
await assert.rejects(()=>failedKnown.accessToken(),/No se pudo recuperar tu cuenta/);
const failedGuest=auth.namespace.createAccounts({storage:{getItem:()=>null},fetcher:configFailure});
assert.equal(await failedGuest.accessToken(),null,'Supabase indisponible permite invitados sin cuenta guardada');
const disabledKnown=auth.namespace.createAccounts({storage:knownStorage,
  fetcher:async()=>({ok:true,json:async()=>({habilitado:false})})});
await assert.rejects(()=>disabledKnown.initialize(),/deshabilitadas/);
await assert.rejects(()=>disabledKnown.accessToken(),/recuperar/);
const panel=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/account-panel.js',import.meta.url),'utf8'),{context});
await panel.link(async spec=>spec.includes('auth')?fakeAuth:new vm.SourceTextModule(await readFile(new URL(spec.includes('profile-ranks')?'../src/main/resources/static/js/profile-ranks.js':'../src/main/resources/static/js/dom.js',import.meta.url),'utf8'),{context}));await panel.evaluate();
assert.match(panel.namespace.progressText({estado:'CONFIRMADA',xp:150}),/150 XP/);
assert.match(panel.namespace.progressText({estado:'INVITADO'}),/no acumula/);
assert.match(panel.namespace.progressText({estado:'PENDIENTE'}),/puede perderse/);
const hostile=panel.namespace.profileView({nombre:'<img src=x onerror="alert(1)">',nivel:75,xp:37000,partidasTerminadas:2,victorias:1});
assert.ok(!hostile.includes('<img src=x'),'El nombre del perfil debe quedar escapado');
assert.match(hostile,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
assert.match(hostile,/tier-eterno/);assert.match(hostile,/aria-valuenow="0"/);
console.log('Cuentas: almacenamiento, headers separados, invitado, cierre y progreso verificados');
