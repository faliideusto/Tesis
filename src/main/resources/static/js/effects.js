import {img,esc} from './dom.js';
import {ideaCardContents, roleCard} from './cards.js';
import {showActivity} from './feedback.js';

// One cancellable lifetime for every visual operation. No game state is mutated here.
const animations = new Set(), nodes = new Set(), hidden = new Map();
const presentations = [];
// Each ceremony owns its animations; skipping never resets the visual lifetime.
async function presentation(run) {
  const group={animations:new Set(),skipped:false};
  presentations.push(group);
  try {return await run(group);}
  finally {presentations.splice(presentations.indexOf(group),1);}
}
document.addEventListener('click',event=>{
  const group=presentations.find(p=>!p.skipped);
  if(!presentations.length) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if(!group) return;
  group.skipped=true;
  for(const animation of group.animations) animation.finish();
},true);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let epoch = 0;
let turnSequences = 0;
// Kept across cancellation so a resize/background cycle cannot replay a landing.
// Initial boards establish a new room's watermark without staging its history.
let placementNumber = 0;
const placementEpochs = new Map();
const timing={flight:900, label:1800, glow:950, turn:3600, publication:2800, third:3400};
const turnFrames=[{opacity:0,transform:'translate(-50%,-16px) scale(.96)'},
  {opacity:1,transform:'translate(-50%,0) scale(1)',offset:.12},
  {opacity:1,transform:'translate(-50%,0) scale(1)',offset:.88},
  {opacity:0,transform:'translate(-50%,-6px) scale(1)'}];
export const freshEvents = (before, after) => before
  ? after.eventos.filter(e => e.numero > (before.eventos.at(-1)?.numero || 0)) : [];
const player = (name, state) => name === state.yo ? document.getElementById('local')
  : [...document.querySelectorAll('#board .rival')].find(n => n.dataset.player === name);
const study = (name, index) => [...document.querySelectorAll('#board [data-player][data-index]')]
  .find(n => n.dataset.player === name && Number(n.dataset.index) === index);
const hand = (name, state) => name === state.yo ? document.getElementById('hand') : player(name, state);
// Only the public owner's loadout selects a hidden card back. Never inspect a rival hand.
export function ownerCardBack(state,name) {
  const back=state.jugadores?.find(p=>p.nombre===name)?.cosmeticos?.reverso;
  return back?.tipo==='reverso' && /^\/assets\/(?:Tesis-assets|seasons)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:webp|png|svg)$/.test(back.asset||'')
    ? back.asset : '/assets/Tesis-assets/cartas/reverso_idea.webp';
}
function rect(element) {
  const r = element?.getBoundingClientRect();
  if (r?.width && r.height && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth)
    return {x:Math.max(30, Math.min(innerWidth-30, r.left+r.width/2)), y:Math.max(30, Math.min(innerHeight-30, r.top+r.height/2))};
  const fallback = document.getElementById('turn-panel')?.getBoundingClientRect();
  return {x:innerWidth/2, y:Math.max(40, Math.min(innerHeight-40, fallback?.bottom || 80))};
}
function node(cls, text, anchor) {
  const n = document.createElement('div'); n.className = `fx ${cls}`; n.setAttribute('aria-hidden','true');
  if (text) n.textContent = text;
  if (anchor) {const p = rect(anchor); n.style.left=`${p.x}px`; n.style.top=`${p.y}px`;}
  document.body.append(n); nodes.add(n); return n;
}
async function animate(element, frames, duration=800, readable=false, easing='cubic-bezier(.2,.7,.25,1)', group=null) {
  if (!element?.isConnected || document.hidden || group?.skipped) return;
  const a = element.animate(reduced() ? (readable ? [{opacity:0},{opacity:1,offset:.08},{opacity:1,offset:.92},{opacity:0}] : [{opacity:.45},{opacity:1}]) : frames,
    {duration:reduced() && !readable ? Math.min(duration,180) : duration, easing});
  animations.add(a);
  group?.animations.add(a);
  try {await a.finished;} catch { /* Cancelled on navigation, resize or backgrounding. */ }
  finally {animations.delete(a); group?.animations.delete(a);}
}
async function ephemeral(n, frames, duration, easing, group=null) {
  try {await animate(n,frames,duration,/fx-label|fx-banner|fx-publication-seal/.test(n.className),easing,group);} finally {n.remove(); nodes.delete(n);}
}
function conceal(element) {
  if (!element || hidden.has(element)) return;
  hidden.set(element,element.style.visibility); element.style.visibility='hidden';
}
function restore() {for (const [n,visibility] of hidden) n.style.visibility=visibility; hidden.clear();}
export function resetEffects() {
  epoch++;
  for (const a of animations) a.cancel();
  for (const n of nodes) n.remove();
  nodes.clear(); restore();
}
export function glow(element, color='#e6c578') {
  // Table cards already have a composed CSS perspective, tilt and hover lift.
  // Their existing glow remains a light effect; only the outer slot may move.
  const tableCard=element?.matches?.('.table-study');
  return animate(element,[{boxShadow:`0 0 0 1px ${color}, 0 0 30px ${color}88`,...(tableCard?{}:{transform:'scale(1.025)'})},
    {boxShadow:'0 0 0 transparent',...(tableCard?{}:{transform:'scale(1)'})}],timing.glow);
}
async function progressTo(element, value) {
  if (!element || value == null) return;
  const initial=element.value, current=epoch, started=performance.now();
  const frame=now=>{
    if(current!==epoch || !element.isConnected) return;
    const t=reduced()?1:Math.min(1,(now-started)/900);
    element.value=initial+(value-initial)*t;
    if(t<1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  await glow(element);
}
export function floating(text, anchor, tone='gold') {
  const n=node(`fx-label fx-${tone}`,text,anchor);
  return ephemeral(n,[{opacity:0,transform:'translate(-50%,0) scale(.94)'},
    {opacity:1,offset:.12},{opacity:1,offset:.82}, {opacity:0,transform:'translate(-50%,-38px) scale(1)'}],timing.label);
}
function particles(anchor, large=false, tone='gold', group=null) {
  if (reduced() || document.hidden) return Promise.resolve();
  return Promise.all(Array.from({length:large?36:12},(_,i)=>{
    const n=node(`fx-particle fx-${tone}`,'',anchor), angle=i*2.399, radius=(large?Math.min(innerWidth*.4,240):85)+(i%3)*12;
    return ephemeral(n,[{opacity:0,transform:'translate(0,0) rotate(0)'},{opacity:.9,offset:.15},
      {opacity:0,transform:`translate(${Math.cos(angle)*radius}px,${Math.sin(angle)*radius}px) rotate(${i*35}deg)`}],large?2600:1500,undefined,group);
  }));
}
async function flight(art, source, destination, {card=null, coin=false, replace=false, ceremonial=false, privateDraw=false, duration=timing.flight, tone='gold',group=null}={}) {
  const from=rect(source), to=rect(destination);
  if (replace) conceal(source);
  const n=node(`fx-flight ${card?'game-card idea-card fx-complete-card':''} ${coin?'fx-coin':''} ${ceremonial?'fx-ceremonial':''} ${privateDraw?'fx-private-draw':''} fx-${tone}`);
  n.innerHTML=card ? ideaCardContents(card) : art.startsWith('/assets/') ? `<img src="${esc(art)}" alt="" draggable="false">` : img(art); n.style.left=`${from.x}px`; n.style.top=`${from.y}px`;
  if(privateDraw && reduced()) {n.style.left=`${innerWidth/2}px`;n.style.top=`${innerHeight*.43}px`;}
  const dx=to.x-from.x, dy=to.y-from.y;
  const cx=innerWidth/2-from.x, cy=innerHeight*.43-from.y;
  const frames=privateDraw ? [
    {opacity:0,transform:'translate(-50%,-50%) scale(.4)',easing:'ease-out'},
    {opacity:1,transform:`translate(calc(-50% + ${cx}px),calc(-50% + ${cy}px)) scale(1)`,offset:.2},
    {opacity:1,transform:`translate(calc(-50% + ${cx}px),calc(-50% + ${cy}px)) scale(1)`,offset:.82,easing:'ease-in'},
    {opacity:0,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.45)`}
  ] : ceremonial ? [
    {opacity:0,transform:'translate(-50%,-50%) scale(.55)'},
    {opacity:1,transform:`translate(calc(-50% + ${cx}px),calc(-50% + ${cy}px)) rotate(-3deg) scale(1.08)`,offset:.24},
    {opacity:1,transform:`translate(calc(-50% + ${cx}px),calc(-50% + ${cy}px)) rotate(0) scale(1.13)`,offset:.74},
    {opacity:0,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.55)`}
  ] : [{opacity:1,transform:'translate(-50%,-50%) scale(1)'},
    {opacity:1,transform:`translate(calc(-50% + ${dx*.25}px),calc(-50% + ${dy*.25-24}px)) rotate(-7deg) scale(1.12)`,offset:.3},
    {opacity:1,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(0) scale(${coin?.7:1})`}];
  try {await animate(n,frames,duration,privateDraw,privateDraw?'linear':undefined,group);}
  finally {n.remove(); nodes.delete(n);}
}
function ownDrawnCard(event, events, before, after) {
  // Never read card data from public events or a rival. The server appends a
  // draw to this viewer's private hand. Bursts with edits/swaps are ambiguous.
  if(event.actor!==after.yo || before.yo!==after.yo || before.bloqueada || after.bloqueada
    || events.filter(e=>e.robo && e.actor===after.yo).length!==1
    || events.some(e=>e.tipo==='accion.iniciar_estudio' && e.actor===after.yo
      || e.tipo==='habilidad.plagiador' && [e.actor,e.objetivo].includes(after.yo))
    || after.mano.length!==before.mano.length+1
    || !before.mano.every((c,i)=>c.nombre===after.mano[i].nombre)) return null;
  return after.mano.at(-1);
}
function publication(card, source, destination, third) {
  return presentation(group=>publicationScene(card,source,destination,third,group));
}
function publicationScene(card, source, destination, third, group) {
  for(const n of nodes) if(n.className.includes('fx-banner')) n.remove();
  const duration=third?timing.third:timing.publication;
  const center={getBoundingClientRect:()=>({left:innerWidth/2,top:innerHeight*.43,width:1,height:1,right:innerWidth/2+1,bottom:innerHeight*.43+1})};
  const veil=node('fx-veil');
  const seal=node('fx-publication-seal',third?'TERCER ARTÍCULO · PUBLICADO':'PUBLICADO');
  const tasks=[flight(card.arte,source,destination,{card,replace:true,ceremonial:true,duration,group}),
    ephemeral(veil,[{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.75},{opacity:0}],duration,undefined,group),
    ephemeral(seal,[{opacity:0,transform:'translate(-50%,12px) scale(1.2)'},{opacity:1,transform:'translate(-50%,0) scale(1)',offset:.3},
      {opacity:1,offset:.8},{opacity:0,transform:'translate(-50%,-8px) scale(1)'}],duration,undefined,group)];
  if(!reduced()) {
    const halo=node('fx-publication-halo','',center), flash=node('fx-publication-flash');
    tasks.push(particles(center,true,'gold',group),
      ephemeral(halo,[{opacity:0,transform:'translate(-50%,-50%) scale(.4) rotate(-25deg)'},{opacity:1,offset:.28},
        {opacity:.8,offset:.7},{opacity:0,transform:'translate(-50%,-50%) scale(1.3) rotate(25deg)'}],duration,undefined,group),
      ephemeral(flash,[{opacity:0},{opacity:.6,offset:.27},{opacity:0,offset:.6},{opacity:0}],duration,undefined,group));
  }
  return Promise.all(tasks);
}
const identities = {
  'habilidad.plagiador':['MANOS INTERCAMBIADAS','plagiarism'],
  'habilidad.comite_etica':['EXPEDIENTE · VETO REGISTRADO','ethics'],
  'habilidad.revisor_2':['REVISADO · −2 trabajo como máximo','review'],
  'habilidad.decana':['DECANA · INMUNIDAD','gold'],
  'habilidad.estadistico':['SIGNIFICATIVO · +1 prestigio','statistics'],
  'habilidad.investigador_principal':['PRIORIDAD · Próxima ronda','research'],
  'habilidad.editorial.inicio':['EDITORIAL · Ingresos por publicaciones','gold']
};

export async function chooseRole(element) {
  const siblings=[...document.querySelectorAll('.role-selection .game-card')].filter(n=>n!==element);
  await Promise.all([animate(element,[{transform:'scale(1)'},{transform:'translateY(-12px) scale(1.07)'}],400),
    ...siblings.map(n=>animate(n,[{opacity:1},{opacity:.32}],400))]);
}

// Private, local ceremony. Only the caller submits the original action afterwards.
export async function chooseVeto(element) {
  const current=epoch, grid=element.closest('.ethics-grid');
  const status=document.querySelector('.ethics-status');
  grid.classList.add('reviewing'); element.classList.add('veto-selected');
  status.textContent='Expediente abierto · Revisión en curso…';
  await animate(element,[{transform:'translateY(0)'},{transform:'translateY(-10px) scale(1.025)'}],650,true);
  if(current!==epoch) return;
  const seal=document.createElement('span'); seal.className='ethics-stamp'; seal.textContent='VETADO';
  element.append(seal);
  status.textContent='Dictamen emitido · Registrando veto privado';
  await animate(seal,[{opacity:0,transform:'rotate(-12deg) scale(2.4)'},
    {opacity:1,transform:'rotate(-12deg) scale(.94)',offset:.7},
    {opacity:1,transform:'rotate(-12deg) scale(1)'}],420,true);
  if(current!==epoch) return;
  await animate(element,[{filter:'drop-shadow(0 0 22px #a72c32)'},
    {filter:'drop-shadow(0 0 8px #a72c32)',offset:.25},
    {filter:'drop-shadow(0 0 8px #a72c32)'}],850,true);
}

async function revealVeto(event, state) {
  return presentation(group=>vetoScene(event,state,group));
}
async function vetoScene(event, state, group) {
  showActivity({player:event.actor,title:'El Comité de Ética está resolviendo el veto',detail:'Se está revisando el expediente.'});
  const current=epoch, anchor=player(event.actor,state);
  const veil=node('fx-veil fx-veto-veil');
  const file=node('fx-ethics-file');
  file.innerHTML='<span class="ethics-classification">COMITÉ DE ÉTICA · RESOLUCIÓN</span><div class="ethics-file-lines" aria-hidden="true"></div><strong class="ethics-review">Expediente en revisión</strong>';
  try {
    await animate(file,[{opacity:0,transform:'translate(-50%,-45%) rotate(-4deg)'},
      {opacity:1,transform:'translate(-50%,-50%) rotate(0)'}],600,true,undefined,group);
    if(current!==epoch || group.skipped) return;
    const seal=document.createElement('div'); seal.className='ethics-stamp'; seal.textContent='VETADO';
    const message=document.createElement('p'); message.className='ethics-verdict';
    message.textContent=`${event.actor} ha sido vetado por el Comité de Ética`;
    showActivity({player:event.actor,title:'Turno vetado',detail:'La mesa pasa al siguiente turno.'});
    message.setAttribute('role','status'); file.append(seal,message);
    file.querySelector('.ethics-review').textContent='DICTAMEN · TURNO DENEGADO';
    void glow(anchor,'#af3942');
    await Promise.all([
      animate(seal,[{opacity:0,transform:'rotate(-12deg) scale(2.4)'},
        {opacity:1,transform:'rotate(-12deg) scale(.95)',offset:.7},
        {opacity:1,transform:'rotate(-12deg) scale(1)'}],400,true,undefined,group),
      particles(file,false,'review',group),
      animate(message,[{opacity:1},{opacity:1}],1800,true,undefined,group)]);
    if(current!==epoch || group.skipped) return;
    await animate(file,[{opacity:1},{opacity:1,offset:.85},{opacity:0}],600,true,undefined,group);
  } finally {
    file.remove(); veil.remove(); nodes.delete(file); nodes.delete(veil);
  }
}

async function revealRole(event, state) {
  // Only the server's explicitly public event payload is eligible, including
  // for the local player: their private role must never authorize a revelation.
  if (!['fase.turno','turno.vetado'].includes(event.tipo) || !event.rolPublico) return;
  return presentation(group=>roleScene(event,state,group));
}
async function roleScene(event, state, group) {
  showActivity({player:event.actor,title:'Revelando personaje',detail:'La carta se presenta a toda la mesa.'});
  const veil=node('fx-veil fx-role-veil');
  const card=node('fx-role-reveal');
  card.innerHTML=roleCard(event.rolPublico,{command:'noop'});
  card.removeAttribute('aria-hidden'); card.setAttribute('role','status');
  card.setAttribute('aria-label',`${event.actor}: ${event.rolPublico.nombre}. ${event.rolPublico.habilidad}`);
  card.querySelector('button').tabIndex=-1;
  const destination=rect(player(event.actor,state));
  const dx=destination.x-innerWidth/2, dy=destination.y-innerHeight/2;
  try {
    // Linear timeline preserves the actual reading time; easing only on movement.
    // 600 ms entrance, 3000 ms stationary, then a quick 250 ms exit to the table.
    await animate(card,[
      {opacity:0,transform:'translate(-50%,-44%) perspective(900px) rotateY(-24deg) scale(.82)',easing:'ease-out'},
      {opacity:1,transform:'translate(-50%,-50%) perspective(900px) rotateY(0) scale(1)',offset:600/3850},
      {opacity:1,transform:'translate(-50%,-50%) perspective(900px) rotateY(0) scale(1)',offset:3600/3850,easing:'ease-in'},
      {opacity:0,transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.25)`}
    ],3850,true,'linear',group);
  } finally {
    card.remove(); veil.remove(); nodes.delete(card); nodes.delete(veil);
  }
}

const whenVisible=()=>document.hidden ? new Promise(resolve=>{
  const resume=()=>{if(!document.hidden){document.removeEventListener('visibilitychange',resume);resolve();}};
  document.addEventListener('visibilitychange',resume);
}) : Promise.resolve();

async function openTurn(event, state) {
  turnSequences++;
  const turn=document.querySelector('#turn-panel strong'), previousTurn=turn?.textContent;
  try {
    if(turn) turn.textContent=`Turno de ${event.actor}`;
    const stages=[()=>{
      showActivity({player:event.actor,title:'Comienza su turno',detail:'La mesa da paso a su personaje.'});
      const intro=node(`fx-banner ${event.actor===state.yo?'fx-own-turn':''}`,`Comienza el turno de ${event.actor}`);
      intro.removeAttribute('aria-hidden'); intro.setAttribute('role','status');
      return presentation(group=>ephemeral(intro,turnFrames,timing.turn,undefined,group));
    },()=>revealRole(event,state)];
    if(event.tipo==='turno.vetado') stages.push(()=>revealVeto(event,state));
    for(const stage of stages) {
      do {
        await whenVisible();
        const current=epoch;
        await stage();
        if(current!==epoch && !document.hidden) return false;
      } while(document.hidden);
    }
    return true;
  } finally {
    if(turn) turn.textContent=previousTurn;
    turnSequences--;
  }
}

export async function transition(before, after) {
  const events=freshEvents(before,after);
  for(const e of events) if(e.tipo==='accion.iniciar_estudio') placementEpochs.set(e.numero,epoch);
  // A background tab keeps its last painted board until it can show the verdict.
  // Initial loads still skip history because freshEvents(null, ...) is empty.
  if(events.some(e=>['fase.turno','turno.vetado'].includes(e.tipo))) await whenVisible();
  let current=epoch;
  if (!events.length || document.hidden) return;
  const tasks=[];
  try {
    // A reconnect/burst is summarized by the existing activity panel. Do not stage
    // ordinary effects against stale studies; public turn ceremonies stay ordered.
    // The engine emits automatic income/ability events before fase.turno. Present
    // those effects after its banner and card, without changing server order/state.
    const ordered=[], openingEffects=[];
    const automatic=new Set(['articulo.ingresos','habilidad.editorial.inicio',
      'habilidad.investigador_principal','habilidad.decana']);
    for(const event of events) {
      if(automatic.has(event.tipo)) { openingEffects.push(event); continue; }
      if(event.tipo==='fase.turno' && openingEffects.every(e=>e.actor===event.actor)) {
        ordered.push(event,...openingEffects.splice(0));
      } else ordered.push(...openingEffects.splice(0),event);
    }
    ordered.push(...openingEffects);
    const visibleEvents=ordered.filter((e,i)=>e.estudio==null || !ordered.slice(i+1).some(later=>
      later.estudio===e.estudio && (later.objetivo || later.actor)===(e.objetivo || e.actor)));
    for (const e of visibleEvents) {
      if (['fase.turno','turno.vetado'].includes(e.tipo)) {
        await Promise.all(tasks.splice(0));
        if(current!==epoch) return;
        if(!await openTurn(e,before)) return;
        current=epoch;
        continue;
      }
      if(events.length>16) continue;
      const actor=player(e.actor,before), owner=e.objetivo || e.actor;
      const target=e.estudio != null ? study(owner,e.estudio) || player(owner,before) : actor;
      const nextPlayer=after.jugadores.find(p=>p.nombre===owner);
      const nextStudy=nextPlayer?.estudios.find(s=>s.indice===e.estudio);
      if (e.tipo==='accion.seleccionar_personaje' && e.actor===after.yo) {
        tasks.push(animate(document.querySelector('.role-confirm .game-card'),[
          {opacity:1,transform:'scale(1)'},{opacity:0,transform:'translateY(-18px) scale(1.09)'}],550));
      }
      if (e.cantidad > 0 && ['accion.cobrar','habilidad.editorial.inicio','articulo.ingresos'].includes(e.tipo)) {
        const counter=actor?.querySelector('.resources .resource');
        tasks.push(flight('recursos/moneda.webp',document.querySelector('.idea-deck'),counter,{coin:true})
          .then(()=>current===epoch ? Promise.all([glow(counter),floating(`+${e.cantidad}`,counter)]) : undefined));
      }
      if (e.robo) {
        const card=ownDrawnCard(e,events,before,after);
        const draw=group=>flight(card?.arte || ownerCardBack(after,e.actor),document.querySelector('.idea-deck'),hand(e.actor,before),
          card ? {card,privateDraw:true,duration:2400,group} : {});
        tasks.push(card ? presentation(draw) : draw(null));
      }
      if (e.tipo==='accion.iniciar_estudio' && nextStudy) {
        const card=e.actor===after.yo ? before.mano.find(c=>c.nombre===nextStudy.carta.nombre) : null;
        const source=card ? document.querySelector(`#hand [data-index="${card.indice}"]`) : hand(e.actor,before);
        tasks.push(flight(nextStudy.carta.arte,source,e.actor===after.yo?document.getElementById('studies'):actor,{card:nextStudy.carta,replace:!!card}));
      }
      if (['accion.trabajar','habilidad.pre_doctoral'].includes(e.tipo)) {
        const predoc=e.tipo==='habilidad.pre_doctoral';
        tasks.push(floating(`+${e.cantidad} trabajo${predoc?' · Pre-Doctoral':''}`,target,predoc?'research':'gold'),glow(target));
        const progress=target?.querySelector('progress') || target?.closest('.table-study-slot')?.querySelector('progress');
        if (progress) tasks.push(progressTo(progress,nextStudy?.trabajo));
      }
      if (e.publicacion && nextStudy) {
        const third=nextPlayer.publicados>=3 && before.jugadores.find(p=>p.nombre===owner)?.publicados<3
          && visibleEvents.filter(item=>item.publicacion && item.actor===e.actor).at(-1)===e;
        const destination=third ? document.querySelector('.table-activity') : owner===after.yo
          ? document.querySelector('#studies .publications') : actor;
        tasks.push(publication(nextStudy.carta,study(owner,e.estudio),destination,third));
        tasks.push(floating(`+${nextStudy.carta.prestigio + (nextStudy.prestigioExtra || 0)} prestigio`,player(owner,before)));
      }
      if (identities[e.tipo]) {
        const [label,tone]=identities[e.tipo]; tasks.push(floating(label,target,tone),particles(target,false,tone));
        if (e.tipo==='habilidad.plagiador') tasks.push(
          flight(ownerCardBack(before,e.actor),actor,player(e.objetivo,before),{tone}),
          flight(ownerCardBack(before,e.objetivo),player(e.objetivo,before),actor,{tone}));
        if (e.tipo==='habilidad.revisor_2') {
          const mark=node('fx-correction','╱',target); tasks.push(ephemeral(mark,[{opacity:0,transform:'scaleX(.2)'},{opacity:1,offset:.3},{opacity:0,transform:'scaleX(1)'}],1400));
        }
      }
    }
    await Promise.all(tasks);
  } finally {restore();}
}

export function settled(before, after) {
  const active=after.fase==='TURNO_JUGADOR';
  document.getElementById('local')?.classList.toggle('fx-active',active && after.actual===after.yo);
  for (const n of document.querySelectorAll('#board .rival')) n.classList.toggle('fx-active',active && n.dataset.player===after.actual);
  const events=freshEvents(before,after);
  const previousPlacement=placementNumber;
  placementNumber=Math.max(placementNumber,after.eventos.at(-1)?.numero || 0);
  if(!before) {placementNumber=after.eventos.at(-1)?.numero || 0;placementEpochs.clear();}
  for (const e of events) {
    if(e.tipo==='accion.iniciar_estudio' && e.numero>previousPlacement && e.estudio!=null
      && (!placementEpochs.has(e.numero) || placementEpochs.get(e.numero)===epoch)) {
      const previous=before.jugadores.find(p=>p.nombre===e.actor)?.estudios;
      const next=after.jugadores.find(p=>p.nombre===e.actor)?.estudios.find(s=>s.indice===e.estudio);
      // An existing article changing status is never a newly placed card.
      if(next && previous && !previous.some(s=>s.indice===e.estudio)) {
        const destination=[...document.querySelectorAll('#board .table-study[data-player][data-index]')]
          .find(n=>n.dataset.player===e.actor && Number(n.dataset.index)===e.estudio);
        const slot=destination?.closest('.table-study-slot');
        if(slot) void landStudy(slot,destination,next.carta.nombre==='Patente').catch(()=>{});
      }
    }
    if (e.estudio != null) {
      const placed=e.tipo==='accion.iniciar_estudio'
        ? after.jugadores.find(p=>p.nombre===e.actor)?.estudios.find(s=>s.indice===e.estudio) : null;
      void glow(study(e.objetivo || e.actor,e.estudio),placed?.carta.nombre==='Patente'?'#c282ff':undefined);
    }
    if (e.cantidad>0 && e.tipo!=='accion.trabajar') void glow(player(e.actor,after)?.querySelector('.resources .resource b'));
    if (e.robo && e.actor===after.yo) void glow(document.querySelector('#hand .game-card:last-child'));
  }
  for(const number of placementEpochs.keys()) if(number<=placementNumber) placementEpochs.delete(number);
}
function patentSparks(anchor) {
  if(reduced() || document.hidden) return Promise.resolve();
  // The first contact is 38% into the 720 ms landing. Use animation offsets
  // rather than timers so resetEffects also cancels a burst before impact.
  const impact=720*.38, duration=2400, contact=impact/duration;
  const origin=rect(anchor), board=document.getElementById('board')?.getBoundingClientRect();
  const left=Math.max(12,board?.left ?? 12), right=Math.min(innerWidth-12,board?.right ?? innerWidth-12);
  const top=Math.max(12,board?.top ?? 12), bottom=Math.min(innerHeight-12,board?.bottom ?? innerHeight-12);
  const flash=node('fx-patent-flash','',anchor);
  const tasks=[ephemeral(flash,[
    {opacity:0,transform:'translate(-50%,-50%) scale(.25)'},
    {opacity:0,transform:'translate(-50%,-50%) scale(.25)',offset:contact},
    {opacity:1,transform:'translate(-50%,-50%) scale(.8)',offset:contact+.035},
    {opacity:0,transform:'translate(-50%,-50%) scale(1.6)',offset:contact+.22},
    {opacity:0,transform:'translate(-50%,-50%) scale(1.6)'}
  ],duration,'linear')];
  for(let i=0;i<32;i++) {
    const n=node(`fx-particle fx-patent-spark ${i%4===0?'fx-patent-star':''}`,'',anchor);
    const lifetime=duration+(i%4)*120, sparkContact=impact/lifetime;
    const angle=i*2.399, radius=55+(i%5)*22;
    const dx=Math.max(left,Math.min(right,origin.x+Math.cos(angle)*radius))-origin.x;
    const dy=Math.max(top,Math.min(bottom,origin.y+Math.sin(angle)*radius*.45-24))-origin.y;
    // After the burst, embers drift upward and towards the middle of the table.
    const x=Math.max(left,Math.min(right,origin.x+dx+(innerWidth/2-origin.x)*.18))-origin.x;
    const y=Math.max(top,Math.min(bottom,origin.y+dy-55-(i%4)*22))-origin.y;
    tasks.push(ephemeral(n,[
      {opacity:0,transform:'translate(-50%,-50%) scale(.2)'},
      {opacity:0,transform:'translate(-50%,-50%) scale(.2)',offset:sparkContact},
      {opacity:1,transform:'translate(-50%,-50%) scale(1.3)',offset:sparkContact+.025},
      {opacity:.9,transform:`translate(${dx}px,${dy}px) rotate(${i*31}deg) scale(1)`,offset:.32},
      {opacity:.55,transform:`translate(${x*.85}px,${y*.8}px) rotate(${i*31+60}deg) scale(.75)`,offset:.7},
      {opacity:0,transform:`translate(${x}px,${y}px) rotate(${i*31+100}deg) scale(.15)`}
    ],lifetime,'linear'));
  }
  return Promise.all(tasks);
}
function landStudy(slot, card, patent=false) {
  // Only the outer slot moves: the card retains its CSS perspective and hover.
  // Two decreasing rebounds and a tightening shadow suggest a light paper card.
  // Measure the impact point before the slot is lifted for its landing.
  const sparks=patent ? patentSparks(card) : null;
  const landing=animate(slot,[
    {transform:'translate3d(0,-22px,0) scale(1.008)',filter:'drop-shadow(0 18px 12px #0005)',easing:'ease-in'},
    {transform:'translate3d(0,0,0) scale(1)',filter:'drop-shadow(0 2px 2px #0009)',offset:.38,easing:'ease-out'},
    {transform:'translate3d(0,-4px,0) scale(1.002)',filter:'drop-shadow(0 7px 5px #0007)',offset:.55,easing:'ease-in'},
    {transform:'translate3d(0,0,0) scale(1)',filter:'drop-shadow(0 2px 2px #0009)',offset:.71,easing:'ease-out'},
    {transform:'translate3d(0,-1.5px,0) scale(1)',filter:'drop-shadow(0 3px 3px #0008)',offset:.82,easing:'ease-in'},
    {transform:'translate3d(0,0,0) scale(1)',filter:'drop-shadow(0 1px 1px #0006)',offset:.93},
    {transform:'translate3d(0,0,0) scale(1)',filter:'drop-shadow(0 0 0 #0000)'}
  ],720,false,'linear');
  return sparks ? Promise.all([landing,sparks]) : landing;
}
export function victory() {
  void animate(document.querySelector('#modal .final-result'),[{opacity:0,transform:'translateY(20px) scale(.94)'},{opacity:1,transform:'translateY(0) scale(1)'}],1200);
}
window.addEventListener('resize',()=>{
  // The document and card layouts are responsive; resizing must not skip a verdict.
  if(!turnSequences && !document.querySelector('.ethics-grid.reviewing')) resetEffects();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden) resetEffects();});
