// Run with node --experimental-vm-modules tests/effects.test.mjs
// DOM contract tests; these deliberately do not claim to verify browser layout.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

export async function runEffectsTests(root) {
  let count=0;
  const source=await readFile(`${root}/src/main/resources/static/js/effects.js`,'utf8');
  async function setup({reduce=false,hold=false}={}) {
    const nodes=[], calls=[], listeners={}, pending=[];
    class Element {
      constructor(name='') {this.name=name; this.style={visibility:''}; this.dataset={}; this.isConnected=true; this.classList={toggle(){}};}
      setAttribute() {} removeAttribute() {}
      getBoundingClientRect() {return {left:10,top:20,width:100,height:80,bottom:100,right:110};}
      querySelector(selector) {return selector.includes('resource') ? counter : null;}
      remove() {this.isConnected=false;}
      animate(frames,options) {
        calls.push({element:this,frames,options});
        let resolve;
        const finished=hold ? new Promise(r=>resolve=r) : Promise.resolve();
        const a={finished,cancel(){resolve?.();}}; pending.push(a); return a;
      }
    }
    const local=new Element('local'), rival=new Element('rival'), counter=new Element('counter'), card=new Element('study');
    rival.dataset.player='Rival'; card.dataset={player:'Rival',index:'0'};
    const hand=new Element('hand');
    const document={hidden:false,body:{append(n){nodes.push(n);}},createElement(){return new Element();},
      getElementById(id){return id==='local'?local:id==='hand'?hand:local;},
      querySelector(){return local;},
      querySelectorAll(selector){return selector.includes('[data-player][data-index]')?[card]:[rival];},
      addEventListener(name,fn){listeners[name]=fn;}};
    const context=vm.createContext({document,innerWidth:390,innerHeight:844,matchMedia:()=>({matches:reduce}),
      performance:{now:()=>0},requestAnimationFrame:fn=>fn(600),window:{addEventListener(name,fn){listeners[name]=fn;}}});
    const mod=new vm.SourceTextModule(source,{context});
    await mod.link(()=>new vm.SourceTextModule('export const img = path => `<img src="${path}">`;', {context}));
    await mod.evaluate();
    return {fx:mod.namespace,nodes,calls,pending,document,listeners,card};
  }
  const before={yo:'Yo',fase:'TURNO_JUGADOR',actual:'Yo',ronda:1,mano:[],eventos:[{numero:10}],
    jugadores:[{nombre:'Yo',estudios:[]},{nombre:'Rival',publicados:0,estudios:[]}]};
  const event=(tipo,extra={})=>({numero:11,tipo,actor:'Rival',...extra});
  const after=e=>({...before,eventos:[...before.eventos,e]});
  {
    const {fx}=await setup();
    assert.equal(fx.freshEvents(null,after(event('accion.pensar'))).length,0);
    assert.equal(fx.freshEvents(before,before).length,0);
    assert.equal(fx.freshEvents(before,after(event('accion.pensar'))).length,1);
    assert.equal(fx.freshEvents(after(event('accion.pensar')),after(event('accion.pensar'))).length,0); count++;
  }
  {
    const {fx,nodes}=await setup();
    await fx.transition(before,after(event('accion.pensar',{robo:true})));
    assert(nodes.some(n=>n.innerHTML?.includes('reverso_idea.png')));
    assert(nodes.every(n=>!n.innerHTML?.includes('SECRETO')));
    assert(nodes.every(n=>!n.isConnected)); count++;
  }
  {
    const {fx,nodes}=await setup();
    await fx.transition(before,after(event('accion.cobrar',{cantidad:2})));
    assert(nodes.some(n=>n.innerHTML?.includes('moneda.png')));
    assert(nodes.some(n=>n.textContent==='+2')); count++;
  }
  {
    const {fx,nodes}=await setup();
    await fx.transition(before,after(event('accion.seleccionar_personaje')));
    assert.equal(nodes.length,0); count++;
  }
  {
    const {fx,nodes,calls}=await setup({reduce:true});
    await fx.transition(before,after(event('habilidad.decana')));
    assert(nodes.some(n=>n.textContent.includes('INMUNIDAD')));
    assert(nodes.every(n=>!n.className.includes('fx-particle')));
    assert(calls.every(c=>c.frames.every(f=>!f.transform)));
    assert(calls.some(c=>c.element.textContent.includes('INMUNIDAD') && c.options.duration>=1800)); count++;
  }
  {
    const {fx,nodes,card}=await setup({hold:true});
    const next=after(event('accion.trabajar',{cantidad:2,estudio:0,publicacion:true}));
    next.jugadores=[before.jugadores[0],{nombre:'Rival',publicados:1,estudios:[{indice:0,trabajo:2,carta:{arte:'publica.png'}}]}];
    const playing=fx.transition(before,next);
    assert.equal(card.style.visibility,'hidden');
    fx.resetEffects(); await playing;
    assert.equal(card.style.visibility,''); assert(nodes.every(n=>!n.isConnected)); count++;
  }
  {
    const {fx,nodes,listeners}=await setup({hold:true});
    const playing=fx.transition(before,after(event('accion.cobrar',{cantidad:2})));
    listeners.resize(); await playing;
    assert(nodes.every(n=>!n.isConnected)); count++;
  }
  {
    const {fx,nodes,document}=await setup(); document.hidden=true;
    await fx.transition(before,after(event('accion.cobrar',{cantidad:2})));
    assert.equal(nodes.length,0); count++;
  }
  {
    const {fx,nodes,calls}=await setup();
    fx.settled(before,before); assert.equal(nodes.length,0);
    fx.settled(before,{...before,actual:'Rival'});
    assert.equal(nodes.filter(n=>n.className.includes('fx-banner')).length,1);
    assert(calls.some(c=>c.element.className?.includes('fx-banner') && c.options.duration>=3500)); count++;
  }
  {
    const {fx,nodes,calls}=await setup();
    const next=after(event('accion.trabajar',{cantidad:2,estudio:0,publicacion:true}));
    next.jugadores=[before.jugadores[0],{nombre:'Rival',publicados:1,estudios:[{indice:0,trabajo:2,carta:{arte:'publica.png'}}]}];
    await fx.transition(before,next);
    assert(nodes.some(n=>n.className.includes('fx-publication-halo')));
    assert(calls.some(c=>c.element.className?.includes('fx-ceremonial') && c.options.duration===2800));
    assert(nodes.every(n=>!n.isConnected)); count++;
  }
  return `${count} pruebas de efectos superadas`;
}
console.log(await runEffectsTests(fileURLToPath(new URL('..',import.meta.url))));
