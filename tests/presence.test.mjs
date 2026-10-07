// node --experimental-vm-modules tests/presence.test.mjs
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const mod=new vm.SourceTextModule(await readFile(new URL('../src/main/resources/static/js/presence.js',import.meta.url),'utf8'));
await mod.link(()=>{throw new Error('La presencia no necesita estado del motor');});await mod.evaluate();
const {startPresence}=mod.namespace;
let time=0,serial=0,actor=null,calls=0,reply=()=>Promise.resolve({activa:true});
const timers=new Map(),listeners=new Map(),authListeners=new Set();
const surface={visibilityState:'visible',addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:(key)=>listeners.delete(key)};
const accounts={signedIn:()=>Boolean(actor),identity:()=>actor,presence:()=>{calls++;return reply();},
  onChange:fn=>{authListeners.add(fn);return()=>authListeners.delete(fn);}};
const notify=()=>authListeners.forEach(fn=>fn());
const tick=async()=>{
  const ready=[...timers].filter(([,entry])=>entry.due<=time);
  for(const [id,entry] of ready){timers.delete(id);await entry.fn();}
};
const next=()=>[...timers.values()][0]?.due;
const presence=startPresence(accounts,{document:surface,window:surface,now:()=>time,
  setTimer:(fn,delay)=>{const id=++serial;timers.set(id,{fn,due:time+delay});return id;},clearTimer:id=>timers.delete(id)});
assert.equal(timers.size,0,'Invitados no generan presencia');
actor='cuenta-a';notify();assert.equal(calls,0,'No llamar Auth dentro de onAuthStateChange');
await tick();assert.equal(calls,1);assert.equal(next(),30000);
notify();await tick();assert.equal(calls,1,'Renovar perfil no adelanta otra señal');
time=30000;await tick();assert.equal(calls,2);
surface.visibilityState='hidden';listeners.get('visibilitychange')();assert.equal(timers.size,0);
time=90000;await tick();assert.equal(calls,2,'Página oculta no mantiene una cuenta en línea');
surface.visibilityState='visible';listeners.get('visibilitychange')();await tick();assert.equal(calls,3);
reply=()=>Promise.reject(new Error('Fallo de red'));time=120000;await tick();assert.equal(next(),180000);
time=180000;await tick();assert.equal(next(),300000,'Backoff acotado ante fallo de conexión');
reply=()=>Promise.resolve({activa:true});actor='cuenta-b';notify();await tick();assert.equal(next(),210000);
let resolve;reply=()=>new Promise(done=>resolve=done);time=210000;
const pending=tick();await Promise.resolve();
const before=calls;actor='cuenta-c';notify();await tick();assert.equal(calls,before,'No superponer señales');
reply=()=>Promise.resolve({activa:true});resolve({activa:true});await pending;
assert.equal(next(),210000,'Respuesta anterior no retrasa nueva identidad');await tick();
assert.equal(calls,before+1);
listeners.get('pagehide')();assert.equal(timers.size,0);
time=300000;listeners.get('pageshow')();await tick();assert.equal(calls,before+2,'Restaurar desde bfcache reactiva señal');
actor=null;notify();assert.equal(timers.size,0,'Cerrar sesión cancela planificación');
presence.destroy();assert.equal(authListeners.size,0);assert.equal(listeners.size,0);
console.log('Presencia: invitado, cuenta visible, cadencia, página oculta, backoff, cambios de identidad, bfcache y limpieza verificados');
