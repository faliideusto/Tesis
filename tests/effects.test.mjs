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
        const a={finished,cancelled:false,completed:false,finish(){this.completed=true;resolve?.();},cancel(){this.cancelled=true;resolve?.();}}; pending.push(a); return a;
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
  const click=listeners=>{
    const event={prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
    listeners.click(event);return event;
  };
  for(const reduce of [false,true]) {
    const {fx,nodes,calls,pending,listeners}=await setup({hold:true,reduce});
    const playing=fx.transition(before,after(event('turno.vetado',{rolPublico:role})));
    await tick();
    assert(click(listeners).stopped);await tick();
    assert.equal(calls.length,2,'Un clic pasa del aviso a la carta, sin saltarla');
    assert(nodes.find(n=>n.className?.includes('fx-role-reveal')).isConnected);
    assert(click(listeners).prevented);await tick();
    assert.equal(calls.length,3,'Otro clic pasa de la carta al veto');
    assert(nodes.find(n=>n.className?.includes('fx-ethics-file')).isConnected);
    click(listeners);await playing;
    assert(nodes.every(n=>!n.isConnected));
    assert(!click(listeners).stopped,'Sin presentación el clic sigue su curso');
    assert(pending.every(a=>!a.cancelled),'Saltar no equivale a reiniciar efectos');count++;
  }
  {
    const {fx,listeners,pending,card}=await setup({hold:true});
    const playing=fx.glow(card);
    assert(!click(listeners).stopped,'Un brillo pequeño no se puede saltar');
    assert(!pending[0].cancelled && !pending[0].completed);pending[0].finish();await playing;count++;
  }
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
  const drawCard={indice:0,nombre:'Cohortes',arte:'articulos/04_cohortes.webp',marco:'cartas/marco_articulo_raro.webp',coste:4,trabajo:3,prestigio:5};
  const ownDraw=()=>({...after(event('accion.pensar',{robo:true,actor:'Yo'})),mano:[drawCard]});
  {
    const {fx,listeners,pending,card,nodes}=await setup({hold:true});
    const small=fx.glow(card), playing=fx.transition(before,ownDraw());
    click(listeners);await playing;
    assert(nodes.every(n=>!n.isConnected),'El robo grande desaparece al saltarlo');
    assert(!pending[0].cancelled && !pending[0].completed);
    assert.equal(pending.length,2);
    pending[0].finish();await small;count++;
  }
  for(const reduce of [false,true]) {
    const {fx,nodes,calls}=await setup({reduce});const next=ownDraw();
    await fx.transition(before,next);
    const drawn=nodes.find(n=>n.className?.includes('fx-private-draw'));
    assert(drawn && drawn.innerHTML.includes(drawCard.marco) && drawn.innerHTML.includes(drawCard.arte));
    assert(drawn.innerHTML.includes('card-stats'));assert(!drawn.innerHTML.includes('reverso_idea.webp'));
    const presentation=calls.find(c=>c.element===drawn);assert.equal(presentation.options.duration,2400);
    if(reduce) {
      assert(presentation.frames.every(f=>!f.transform));assert.equal(drawn.style.top,`${844*.43}px`);
    } else {
      assert.equal(presentation.options.easing,'linear');
      assert((presentation.frames[2].offset-presentation.frames[1].offset)*2400>=1400,'Tiempo para reconocer la carta');
    }
    assert(nodes.every(n=>!n.isConnected));const countBefore=nodes.length;
    await fx.transition(next,next);await fx.transition(null,next);assert.equal(nodes.length,countBefore);count++;
  }
  {
    const {fx,nodes}=await setup();
    // Even with a local hand and spoofed public card metadata, a rival draw is a back.
    await fx.transition({...before,mano:[drawCard]}, {...after(event('accion.pensar',{robo:true,carta:drawCard})),mano:[drawCard]});
    assert(nodes.some(n=>n.innerHTML?.includes('reverso_idea.webp')));
    assert(nodes.every(n=>!n.innerHTML?.includes(drawCard.nombre) && !n.innerHTML?.includes(drawCard.arte) && !n.innerHTML?.includes(drawCard.marco)));count++;
  }
  for(const kind of ['blocked','changed-viewer','swap','removed','two-draws']) {
    const {fx,nodes}=await setup();let previous=before;const next=ownDraw();
    if(kind==='blocked') next.bloqueada=true;
    if(kind==='changed-viewer') previous={...before,yo:'Otro'};
    if(kind==='swap') next.eventos.push(event('habilidad.plagiador',{numero:12,objetivo:'Yo'}));
    if(kind==='removed') previous={...before,mano:[{nombre:'Otra idea'}]};
    if(kind==='two-draws') {next.eventos.push(event('accion.pensar',{numero:12,robo:true,actor:'Yo'}));next.mano.push({...drawCard,indice:1});}
    await fx.transition(previous,next);
    assert(!nodes.some(n=>n.className?.includes('fx-private-draw')),`No adivinar la carta en ${kind}`);count++;
  }
  {
    const {fx,nodes,pending}=await setup({hold:true});const playing=fx.transition(before,ownDraw());
    fx.resetEffects();await playing;assert(pending.every(a=>a.cancelled));assert(nodes.every(n=>!n.isConnected));count++;
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
    const {fx,nodes,pending,listeners}=await setup({hold:true});
    const previous=started(), next={...previous,eventos:[...previous.eventos,event('accion.trabajar',{numero:12,estudio:0,cantidad:1,publicacion:true})]};
    const playing=fx.transition(previous,next);
    click(listeners);await tick();
    assert(nodes.filter(n=>/fx-ceremonial|fx-veil|fx-publication|fx-particle/.test(n.className)).every(n=>!n.isConnected),
      'Una publicación retira juntos carta, fondo, sello y partículas');
    assert(nodes.some(n=>n.className?.includes('fx-label') && n.isConnected),'Los avisos pequeños continúan');
    assert(pending.some(a=>!a.completed && !a.cancelled));
    for(const a of pending) a.finish();await playing;count++;
  }
  const patentStarted=()=>{
    const next=started();next.jugadores[1].estudios[0].carta.nombre='Patente';return next;
  };
  {
    const {fx,nodes,calls,pending}=await setup({hold:true});const next=patentStarted();
    fx.settled(before,next);
    const sparks=nodes.filter(n=>n.className?.includes('fx-patent-spark'));
    assert.equal(sparks.length,32);
    assert.equal(nodes.filter(n=>n.className?.includes('fx-patent-flash')).length,1);
    for(const call of calls.filter(c=>c.element.className?.includes('fx-patent'))) {
      assert.equal(call.options.easing,'linear');
      assert.equal(call.frames[1].opacity,0);
      assert(Math.abs(call.frames[1].offset*call.options.duration-720*.38)<.01,'El destello empieza al tocar la mesa');
      assert.equal(call.frames.at(-1).opacity,0);
    }
    fx.settled(before,next);assert.equal(nodes.filter(n=>n.className?.includes('fx-patent-spark')).length,32,'El polling no duplica las chispas');
    fx.resetEffects();await tick();
    assert(nodes.every(n=>!n.isConnected));assert(pending.every(a=>a.cancelled));
    fx.settled(before,next);assert.equal(nodes.length,33,'Cancelar no reproduce el destello');count++;
  }
  for(const option of [{reduce:true},{hidden:true}]) {
    const {fx,nodes,document}=await setup(option);document.hidden=!!option.hidden;
    fx.settled(before,patentStarted());await tick();
    assert.equal(nodes.length,0,'Sin partículas con movimiento reducido ni en segundo plano');count++;
  }
  {
    const {fx,nodes}=await setup();fx.settled(before,started());await tick();
    assert.equal(nodes.length,0,'Las cartas comunes conservan su colocación');
    fx.settled(null,patentStarted());assert.equal(nodes.length,0,'Reconectar no reproduce el destello');count++;
  }
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
