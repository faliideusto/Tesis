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
      matches(selector) {return this===card && selector==='.table-study';}
      closest(selector) {return this===card && selector==='.table-study-slot' ? slot : null;}
      getBoundingClientRect() {return {left:10,top:20,width:100,height:80,bottom:100,right:110};}
      querySelector(selector) {return selector.includes('resource') || selector==='.ethics-review' || selector==='button' ? counter : null;}
      append(...children) {nodes.push(...children);}
      remove() {this.isConnected=false;}
      animate(frames,options) {
        calls.push({element:this,frames,options});
        let resolve;
        const finished=hold ? new Promise(r=>resolve=r) : Promise.resolve();
        const a={finished,cancelled:false,finish(){resolve?.();},cancel(){this.cancelled=true;resolve?.();}}; pending.push(a); return a;
      }
    }
    const local=new Element('local'), rival=new Element('rival'), counter=new Element('counter'), card=new Element('study');
    const slot=new Element('table-study-slot');
    rival.dataset.player='Rival'; card.dataset={player:'Rival',index:'0'};
    const hand=new Element('hand');
    const document={hidden:false,body:{append(n){nodes.push(n);}},createElement(){return new Element();},
      getElementById(id){return id==='local'?local:id==='hand'?hand:local;},
      querySelector(selector){return selector.includes('.fx-ethics-file') || selector==='.ethics-grid.reviewing' ? null : local;},
      querySelectorAll(selector){return selector.includes('[data-player][data-index]')?[card]:[rival];},
      addEventListener(name,fn){listeners[name]=fn;}};
    const context=vm.createContext({document,innerWidth:390,innerHeight:844,matchMedia:()=>({matches:reduce}),
      performance:{now:()=>0},requestAnimationFrame:fn=>fn(600),window:{addEventListener(name,fn){listeners[name]=fn;}}});
    const mod=new vm.SourceTextModule(source,{context});
    const dom=new vm.SourceTextModule('export const img = (path, cls="") => `<img src="${path}" class="${cls}">`; export const esc = value => String(value);', {context});
    const cards=new vm.SourceTextModule(await readFile(`${root}/src/main/resources/static/js/cards.js`,'utf8'), {context});
    const feedback=new vm.SourceTextModule('export function showActivity() {}', {context});
    await mod.link(specifier=>specifier==='./cards.js' ? cards : specifier==='./feedback.js' ? feedback : dom);
    await mod.evaluate();
    return {fx:mod.namespace,nodes,calls,pending,document,listeners,card,slot};
  }
  const before={yo:'Yo',fase:'TURNO_JUGADOR',actual:'Yo',ronda:1,mano:[],eventos:[{numero:10}],
    jugadores:[{nombre:'Yo',estudios:[]},{nombre:'Rival',publicados:0,estudios:[]}]};
  const event=(tipo,extra={})=>({numero:11,tipo,actor:'Rival',...extra});
  const after=e=>({...before,eventos:[...before.eventos,e]});
  const role={indice:-1,nombre:'Estadístico',orden:2,habilidad:'Añade 1 de prestigio. Una vez por turno.',arte:'personajes/02_estadistico.webp'};
  const tick=async()=>{for(let i=0;i<30;i++) await Promise.resolve();};
  {
    const {fx,calls}=await setup();
    await fx.transition(before,after(event('turno.vetado',{rolPublico:role})));
    assert(calls[0].element.className.includes('fx-banner'));
    assert(calls[1].element.className.includes('fx-role-reveal'));
    assert.equal(calls[1].options.duration,3850);
    assert(calls[2].element.className.includes('fx-ethics-file')); count++;
  }
  {
    const {fx,calls}=await setup();
    await fx.transition(before,{...before,eventos:[...before.eventos,
      event('habilidad.decana'),event('fase.turno',{numero:12,rolPublico:role})]});
    assert(calls[0].element.className.includes('fx-banner'));
    assert(calls[1].element.className.includes('fx-role-reveal'));
    assert(calls[2].element.className.includes('fx-label')); count++;
  }
  {
    const {fx,nodes,calls,pending}=await setup({hold:true});
    const playing=fx.transition(before,after(event('fase.turno',{rolPublico:role})));
    await tick();
    assert.equal(calls.length,1);
    assert.equal(calls[0].options.duration,3600);
    assert(!nodes.some(n=>n.className?.includes('fx-role-reveal')));
    pending[0].finish(); await tick();
    assert(!nodes.find(n=>n.className?.includes('fx-banner')).isConnected);
    assert(nodes.some(n=>n.innerHTML?.includes('marco_personaje.webp')));
    assert.equal(calls[1].options.duration,3850);
    assert.equal(calls[1].options.easing,'linear');
    assert.equal(Math.round((calls[1].frames[2].offset-calls[1].frames[1].offset)*3850),3000);
    assert.equal(Math.round((1-calls[1].frames[2].offset)*3850),250);
    assert(!nodes.some(n=>n.className?.includes('fx-ethics-file')));
    pending[1].finish(); await tick();
    assert(!nodes.find(n=>n.className?.includes('fx-role-reveal')).isConnected);
    assert(!nodes.some(n=>n.className?.includes('fx-ethics-file')));
    await playing; count++;
  }
  {
    const {fx,nodes,calls}=await setup({reduce:true});
    const next=after(event('fase.turno',{rolPublico:role}));
    await fx.transition(before,next);
    assert(nodes.some(n=>n.innerHTML?.includes('marco_personaje.webp')));
    assert(calls.every(c=>c.frames.every(f=>!f.transform)));
    assert(calls.some(c=>c.options.duration===3850));
    const length=nodes.length;
    await fx.transition(next,next); await fx.transition(null,next); fx.settled(before,next);
    assert.equal(nodes.length,length); count++;
  }
  {
    const {fx,nodes}=await setup();
    const privateBefore={...before,jugadores:[before.jugadores[0],{...before.jugadores[1],rol:role}]};
    await fx.transition(privateBefore,after(event('turno.vetado')));
    assert(!nodes.some(n=>n.className?.includes('fx-role-reveal')));
    assert(nodes.some(n=>n.className?.includes('fx-ethics-file'))); count++;
  }
  {
    const {fx,nodes,calls}=await setup();
    await fx.transition(before,after(event('turno.vetado')));
    assert(nodes.some(n=>n.textContent==='Comienza el turno de Rival'));
    assert(nodes.some(n=>n.textContent==='Rival ha sido vetado por el Comité de Ética'));
    assert(nodes.some(n=>n.textContent==='VETADO'));
    assert(calls.some(c=>c.element.textContent==='Comienza el turno de Rival' && c.options.duration===3600));
    assert(calls.some(c=>c.element.className==='ethics-verdict' && c.options.duration===1800));
    assert(!nodes.some(n=>n.innerHTML?.includes('role-art'))); count++;
  }
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
    assert(nodes.some(n=>n.innerHTML?.includes('reverso_idea.webp')));
    assert(nodes.every(n=>!n.innerHTML?.includes('SECRETO')));
    assert(nodes.every(n=>!n.isConnected)); count++;
  }
  {
    const {fx,nodes}=await setup();
    await fx.transition(before,after(event('accion.cobrar',{cantidad:2})));
    assert(nodes.some(n=>n.innerHTML?.includes('moneda.webp')));
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
    next.jugadores=[before.jugadores[0],{nombre:'Rival',publicados:1,estudios:[{indice:0,trabajo:2,carta:{arte:'publica.png',prestigio:5}}]}];
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
    assert.equal(nodes.filter(n=>n.className.includes('fx-banner')).length,0);
    assert.equal(calls.length,0); count++;
  }
  {
    const {fx,nodes,calls}=await setup();
    const next=after(event('accion.trabajar',{cantidad:2,estudio:0,publicacion:true}));
    next.jugadores=[before.jugadores[0],{nombre:'Rival',publicados:1,estudios:[{indice:0,trabajo:2,carta:{arte:'publica.png',prestigio:5}}]}];
    await fx.transition(before,next);
    assert(nodes.some(n=>n.className.includes('fx-publication-halo')));
    assert(calls.some(c=>c.element.className?.includes('fx-ceremonial') && c.options.duration===2800));
    assert(nodes.every(n=>!n.isConnected)); count++;
  }
  for (const tipo of ['accion.trabajar','habilidad.pre_doctoral']) {
    const {fx,nodes}=await setup();
    const next=after(event(tipo,{cantidad:1,estudio:0,publicacion:true}));
    next.jugadores=[before.jugadores[0],{nombre:'Rival',publicados:1,rol:{nombre:'Pre-Doctoral'},
      estudios:[{indice:0,trabajo:3,prestigioExtra:1,carta:{arte:'publica.png',prestigio:5}}]}];
    await fx.transition(before,next);
    assert(nodes.some(n=>n.textContent==='+6 prestigio'));
    assert(nodes.some(n=>n.textContent===(tipo==='habilidad.pre_doctoral'?'+1 trabajo · Pre-Doctoral':'+1 trabajo')));
    assert.equal(nodes.some(n=>n.textContent?.includes('Pre-Doctoral')),tipo==='habilidad.pre_doctoral');
    count++;
  }
  const started=()=>({...after(event('accion.iniciar_estudio',{estudio:0})),jugadores:[before.jugadores[0],
    {nombre:'Rival',publicados:0,estudios:[{indice:0,trabajo:0,carta:{nombre:'Idea pública',arte:'idea.webp'}}]}]});
  {
    const {fx,calls,slot,card}=await setup();const next=started();
    await fx.transition(before,next);
    assert(!calls.some(c=>c.element===slot),'El destino todavía no se ha renderizado durante transition');
    fx.settled(before,next);
    const landings=()=>calls.filter(c=>c.element===slot);
    assert.equal(landings().length,1);assert.equal(landings()[0].options.duration,720);
    const frames=landings()[0].frames;
    assert(frames[0].transform.includes('-22px'));assert(frames[2].transform.includes('-4px'));
    assert(frames[4].transform.includes('-1.5px'));assert(frames.every(f=>f.filter.includes('drop-shadow')));
    const cardGlow=calls.find(c=>c.element===card);
    assert(cardGlow && cardGlow.frames.every(f=>!f.transform),'El brillo deja intactas perspectiva, inclinación y hover CSS de la carta');
    assert(cardGlow.frames.some(f=>f.boxShadow),'El brillo existente de la carta se conserva');
    fx.settled(before,next);fx.settled(next,next);fx.resetEffects();fx.settled(before,next);
    assert.equal(landings().length,1,'Ni polling duplicado ni cancelación repiten el aterrizaje');count++;
  }
  {
    const {fx,calls,slot}=await setup({reduce:true});fx.settled(before,started());
    const landing=calls.find(c=>c.element===slot);assert(landing);
    assert.equal(landing.options.duration,180);assert(landing.frames.every(f=>!f.transform&&!f.filter));count++;
  }
  {
    const {fx,calls,slot,document}=await setup();const next=started();
    fx.settled(null,next);fx.settled(before,next);
    assert(!calls.some(c=>c.element===slot),'La reconexión inicial omite historial y lo deduplica');
    const newer={...next,eventos:[...next.eventos,event('accion.iniciar_estudio',{numero:12,estudio:1})]};
    document.hidden=true;fx.settled(next,newer);assert(!calls.some(c=>c.element===slot));count++;
  }
  {
    const {fx,calls,slot,card}=await setup();const next=started();
    card.dataset.player='Yo';fx.settled(before,next);
    assert(!calls.some(c=>c.element===slot),'El índice coincidente de otro jugador no es el destino');
    card.dataset.player='Rival';card.dataset.index='1';fx.resetEffects();fx.settled(null,before);fx.settled(before,next);
    assert(!calls.some(c=>c.element===slot),'Una carta de otro índice tampoco aterriza');
    card.dataset.index='0';fx.settled(null,before);fx.settled({...before,jugadores:next.jugadores},next);
    assert(!calls.some(c=>c.element===slot),'Los estudios existentes no se colocan otra vez');count++;
  }
  {
    const {fx,calls,slot,pending}=await setup({hold:true});const next=started();
    fx.settled(before,next);const index=calls.findIndex(c=>c.element===slot);
    assert(index>=0);fx.resetEffects();await tick();
    assert(pending[index].cancelled,'resetEffects cancela la animación del wrapper');
    assert.equal(slot.style.transform,undefined,'No quedan transformaciones inline tras cancelar');count++;
  }
  {
    const {fx,calls,slot,document}=await setup();const next=started();document.hidden=true;
    fx.settled(before,next);document.hidden=false;fx.settled(before,next);
    assert(!calls.some(c=>c.element===slot),'Una colocación recibida en segundo plano no se reproduce al volver');count++;
  }
  {
    const {fx,calls,slot}=await setup({hold:true});const next=started();
    const transitioning=fx.transition(before,next);fx.resetEffects();await transitioning;
    fx.settled(before,next);
    assert(!calls.some(c=>c.element===slot),'Cancelar el vuelo impide un aterrizaje tardío de la misma transición');count++;
  }
  for (const legendaria of [false,true]) {
    const {fx,nodes}=await setup();const next=started();
    next.jugadores[1].estudios[0].carta={nombre:legendaria?'Patente':'Artículo',arte:legendaria?'patente.webp':'foto.webp',marco:legendaria?'patente.webp':'marco.webp',legendaria,coste:2,trabajo:3,prestigio:4};
    await fx.transition(before,next);
    const flying=nodes.find(n=>n.className?.includes('fx-complete-card'));
    assert(flying,'El vuelo lleva una carta completa');
    assert.equal((flying.innerHTML.match(/class="card-frame"/g)||[]).length,1);
    assert.equal((flying.innerHTML.match(/class="card-art"/g)||[]).length,legendaria?0:1);
    assert.equal((flying.innerHTML.match(/patente.webp/g)||[]).length,legendaria?1:0,'Patente usa una única imagen integrada');
    assert(flying.innerHTML.includes('card-stats'));count++;
  }
  return `${count} pruebas de efectos superadas`;
}
console.log(await runEffectsTests(fileURLToPath(new URL('..',import.meta.url))));
