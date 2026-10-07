import {esc} from './dom.js';
import {badge,progression} from './profile-ranks.js';
import {createPublicProfile} from './public-profile.js';

const integer=value=>Math.max(0,Math.floor(Number(value)||0));
const format=value=>integer(value).toLocaleString('es-ES');
const academyTabIcons={
  profile:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-4a8 8 0 0 1 16 0v4z"/>',
  friends:'<circle cx="12" cy="7" r="3"/><circle cx="4" cy="9" r="2.5"/><circle cx="20" cy="9" r="2.5"/><path d="M7 22v-6a5 5 0 0 1 10 0v6zM0 21v-5a4 4 0 0 1 5-4v9zM19 21v-9a4 4 0 0 1 5 4v5z"/>',
  ranking:'<path d="M8 3h8v8a4 4 0 0 1-8 0zM10 16h4v5h-4zM7 21h10v2H7z"/><path d="M8 5H3v3a5 5 0 0 0 5 5m8-8h5v3a5 5 0 0 1-5 5" fill="none" stroke="currentColor" stroke-width="2"/>',
  missions:'<path d="M2 4q5-2 10 1 5-3 10-1v16q-5-2-10 1-5-3-10-1zM12 5v16M5 8h4M5 11h4M5 14h4M15 8h4M15 11h4M15 14h4" fill="none" stroke="currentColor" stroke-width="1.5"/>'
};
export const academyTabs=active=>`<nav class="community-tabs" aria-label="Secciones de tu academia">${[['profile','Mi perfil'],['friends','Amigos'],['ranking','Ranking global'],['missions','Misiones']].map(([id,title])=>`<button type="button" data-academy-page="${id}" ${active===id?'aria-current="page"':''}><svg class="academy-tab-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${academyTabIcons[id]}</svg><span>${title}</span></button>`).join('')}</nav>`;
const icons={friends:academyTabIcons.friends,received:'<path d="M2 5h20v14H2z"/><path d="m2 5 10 8L22 5" fill="none" stroke="#132331" stroke-width="1.8"/>',sent:'<path d="m2 10 20-8-5 20-5-8z"/><path d="m12 14 10-12" fill="none" stroke="#132331" stroke-width="1.5"/>',link:'<path d="m9 15 6-6M8 11l-2 2a4 4 0 0 0 6 6l3-3M16 13l2-2a4 4 0 0 0-6-6L9 8" fill="none" stroke="currentColor" stroke-width="2.2"/>',add:'<circle cx="9" cy="7" r="4"/><path d="M1 22v-5a8 8 0 0 1 16 0v5M20 3v8M16 7h8" stroke="currentColor" stroke-width="2"/>',copy:'<path d="M8 3h12v16H8zM4 7v16h12" fill="none" stroke="currentColor" stroke-width="1.8"/>',refresh:'<path d="M21 9a9 9 0 0 0-16-3L2 9m0-6v6h6M3 15a9 9 0 0 0 16 3l3-3m0 6v-6h-6" fill="none" stroke="currentColor" stroke-width="1.8"/>',search:'<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15 15 7 7" stroke="currentColor" stroke-width="1.8"/>',share:'<circle cx="5" cy="12" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="m5 12 14-7M5 12l14 7" stroke="currentColor" stroke-width="2"/>'};
const icon=id=>`<svg class="friend-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[id]||icons.friends}</svg>`;
const corners=()=>'<span class="friend-frame-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const action=(code,value,label,disabled=false)=>`<button type="button" ${disabled?'disabled title="Has alcanzado el límite de 100 contactos"':''} class="community-action" data-friend-action="${value}" data-code="${esc(code)}">${value==='solicitar'?icon('add'):''}${label}</button>`;
const rankFor=person=>progression({nivel:integer(person.nivel)||1}).rank;
function profileTrigger(person,caption='',presence='',withBadge=true) {
  const content=(withBadge?badge(rankFor(person).id,{small:true}):'')+`<span class="public-person-copy"><strong>${esc(person.nombre)}${person.yo?' <span class="ranking-you">TÚ</span>':''}</strong>${caption?`<small>${caption}</small>`:''}${presence}</span>`;
  return person.codigo?`<button type="button" class="public-person" data-public-profile="${esc(person.codigo)}" aria-label="Ver perfil de ${esc(person.nombre)}" title="Ver perfil de ${esc(person.nombre)}">${content}</button>`:content;
}
function peopleBody(items,kind,filter='',presenceAvailable=true) {
  const visible=kind==='friends'?items.filter(person=>(person.nombre+' '+person.codigo).toLocaleLowerCase('es').includes(filter.toLocaleLowerCase('es'))):items;
  if(visible.length)return `<ul class="community-people">${visible.map(person=>`<li>${profileTrigger(person,`Nivel ${format(person.nivel)} · ${esc(person.codigo)}`,kind==='friends'?`<span class="friend-presence ${presenceAvailable&&person.enLinea?'is-online':''}"><i aria-hidden="true"></i>${!presenceAvailable?'Presencia no disponible':person.enLinea?'En línea':'Desconectado'}</span>`:'')}<div class="community-person-actions">${kind==='friends'?action(person.codigo,'eliminar','Eliminar'):kind==='received'?action(person.codigo,'aceptar','Aceptar')+action(person.codigo,'rechazar','Rechazar'):action(person.codigo,'cancelar','Cancelar')}</div></li>`).join('')}</ul>`;
  if(items.length&&filter)return '<p class="friend-no-results">No hay amigos que coincidan con tu búsqueda.</p>';
  const empty=kind==='friends'?`<strong>Todavía no tienes amigos.</strong><p>Comparte tu código o envía una solicitud para empezar<br>a formar tu círculo académico.</p><button type="button" class="community-action friend-gold" data-share-code>${icon('share')}Compartir mi código</button>`:kind==='received'?'<strong>No tienes solicitudes pendientes<br>de aceptar.</strong><p>Cuando alguien te envíe una solicitud, aparecerá aquí.</p>':'<strong>No tienes solicitudes enviadas<br>pendientes.</strong><p>Aquí verás las solicitudes que has enviado<br>a otros jugadores.</p>';
  return `<div class="friend-empty-scene"><div class="friend-empty-art" aria-hidden="true"></div><div class="friend-empty-copy">${empty}</div></div>`;
}
function people(title,items,kind,filter='',presenceAvailable=true) {
  return `<section class="community-card friend-list-panel friend-list-${kind}">${corners()}<div class="friend-panel-heading"><h3>${icon(kind)}${title} <small>(${format(items.length)})</small></h3>${kind==='friends'?`<label class="friend-search" for="friend-search">${icon('search')}<input id="friend-search" type="search" placeholder="Buscar amigo..." aria-label="Buscar amigo por nombre o código" value="${esc(filter)}"></label>`:''}</div><div data-friend-list-body>${peopleBody(items,kind,filter,presenceAvailable)}</div></section>`;
}
function suggestionsView(items,offset=0,atCapacity=false) {
  const page=items.slice(offset,offset+4);
  return `<section class="community-card friend-suggestions">${corners()}<div class="friend-panel-heading"><div><h3>${icon('friends')}Sugerencias académicas</h3><p>Conoce a otros estudiantes de la Academia.</p></div><button type="button" class="community-action" data-suggestions-next ${items.length<=4?'disabled':''}>Ver más sugerencias <span aria-hidden="true">›</span></button></div>${page.length?`<div class="friend-suggestion-carousel"><button type="button" class="friend-carousel-arrow" data-suggestions-prev aria-label="Sugerencias anteriores" ${items.length<=4?'disabled':''}>‹</button><ul class="friend-suggestion-grid">${page.map(person=>{const rank=rankFor(person);return `<li>${profileTrigger(person,`Nivel ${format(person.nivel)} · ${esc(rank.name)}`)}${action(person.codigo,'solicitar','Añadir',atCapacity)}</li>`;}).join('')}</ul><button type="button" class="friend-carousel-arrow" data-suggestions-next aria-label="Siguientes sugerencias" ${items.length<=4?'disabled':''}>›</button></div>`:'<p class="friend-suggestions-empty">Aún no hay sugerencias disponibles. Vuelve más tarde para conocer a otros investigadores.</p>'}</section>`;
}
export function friendsView(data,{filter='',suggestionOffset=0}={}) {
  const friends=data.amigos||[],received=data.recibidas||[],sent=data.enviadas||[],presenceAvailable=data.presenciaDisponible===true;
  const atCapacity=friends.length+received.length+sent.length>=100;
  const stats=[['friends','Amigos',friends.length],['received','Solicitudes recibidas',received.length],['sent','Solicitudes enviadas',sent.length],['online','En línea ahora',presenceAvailable?friends.filter(person=>person.enLinea).length:null]];
  return `<header class="community-heading friend-heading"><span class="eyebrow">INVESTIGAR EN COMPAÑÍA</span><h2>Tu círculo académico</h2><p>Conecta por código, añade compañeros y forma tu círculo en la Academia.<br>Puedes tener hasta 100 contactos, incluidas las solicitudes pendientes.</p></header><div class="friend-stat-grid">${stats.map(([kind,label,count])=>`<article class="community-card friend-stat friend-stat-${kind}">${corners()}<span class="friend-stat-glyph">${kind==='online'?'<i class="friend-online-light" aria-hidden="true"></i>':icon(kind)}</span><div><h3>${label}</h3><strong ${count===null?'aria-label="Presencia no disponible"':''}>${count===null?'—':format(count)}</strong></div></article>`).join('')}</div><div class="friend-invite community-card">${corners()}<div class="friend-own-code"><label for="friend-own-code">${icon('link')}Tu código de amistad</label><div class="friend-code-line"><input id="friend-own-code" readonly value="${esc(data.codigo)}" aria-label="Tu código de amistad"><button type="button" class="community-action friend-gold" data-copy-code>${icon('copy')}Copiar</button></div><p>Este código público identifica tu perfil; para entrar en una partida usa el código de sala.</p></div><form id="friend-request"><label for="friend-code">${icon('add')}Añadir un amigo por código</label><div class="friend-code-line"><input id="friend-code" name="codigo" required maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Código de tu amigo"><button class="gold-button friend-gold" ${atCapacity?'disabled title="Has alcanzado el límite de 100 contactos"':''}>${icon('sent')}Enviar solicitud</button></div><button type="button" class="community-action friend-refresh" data-community-refresh>${icon('refresh')}Actualizar amigos</button></form></div><div class="community-friend-grid">${people('Tus amigos',friends,'friends',filter,presenceAvailable)}${people('Solicitudes recibidas',received,'received')}${people('Solicitudes enviadas',sent,'sent')}</div>${suggestionsView(data.sugerencias||[],suggestionOffset,atCapacity)}`;
}
const labels={xp:'Experiencia',victorias:'Victorias',partidas:'Partidas terminadas'};
function rankRow(entry) {
  return `<tr ${entry.yo?'class="ranking-self"':''}><th scope="row">${format(entry.posicion)}</th><td>${profileTrigger(entry,`Nivel ${format(entry.nivel)}`,'',false)}</td><td>${format(entry.xp)}</td><td>${format(entry.victorias)}</td><td>${format(entry.partidas)}</td></tr>`;
}
export function rankingView(data,criterion='xp') {
  const own=data.propia,entries=data.entradas||[];
  return `<header class="community-heading"><span class="eyebrow">EL LEGADO DE LA COMUNIDAD</span><h2>Ranking global</h2><p>Las 50 primeras posiciones de la academia. La experiencia incluye las recompensas de misiones.</p><p class="community-fine-print">Tu nombre visible, nivel, experiencia, victorias y partidas terminadas aparecen para las otras cuentas en el ranking.</p></header><div class="ranking-controls"><label for="ranking-criterion">Ordenar por</label><select id="ranking-criterion">${Object.entries(labels).map(([value,label])=>`<option value="${value}" ${value===criterion?'selected':''}>${label}</option>`).join('')}</select><button type="button" class="community-action" data-community-refresh>Actualizar</button></div><section class="community-card ranking-position" aria-label="Tu posición">${own?`<span>Tu posición · ${esc(labels[criterion])}</span><strong>#${format(own.posicion)}</strong><p>Nivel ${format(own.nivel)} · ${format(own.xp)} XP · ${format(own.victorias)} victorias · ${format(own.partidas)} partidas terminadas</p>`:'<p class="ranking-no-position">Tu posición aparecerá cuando el servidor registre tu perfil.</p>'}</section>${entries.length?`<div class="community-card ranking-scroll" tabindex="0" role="region" aria-label="Clasificación global, desliza para ver todas las columnas"><table class="ranking-table"><caption>${esc(labels[criterion])} · clasificación global</caption><thead><tr><th scope="col">Posición</th><th scope="col">Investigador</th><th scope="col">XP</th><th scope="col">Victorias</th><th scope="col">Partidas</th></tr></thead><tbody>${entries.map(rankRow).join('')}</tbody></table></div>`:'<p class="community-card community-empty">La clasificación aún no tiene investigadores.</p>'}`;
}
export function resetTime(value) {
  const time=new Date(value);
  if(!Number.isFinite(time.getTime()))return 'Pendiente de confirmar';
  return `${new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short'}).format(time)} (tu hora local)`;
}
function missionGroup(title,missions,reset) {
  return `<section class="mission-section"><div class="mission-section-heading"><h3>${title}</h3><p>Se renuevan ${esc(resetTime(reset))}</p></div><div class="mission-grid">${missions.length?missions.map(mission=>{
    const goal=Math.max(1,integer(mission.objetivo)),progress=Math.min(goal,integer(mission.progreso));
    return `<article class="community-card mission-card ${mission.reclamada?'mission-claimed':''}"><span class="mission-reward">+${format(mission.xp)} XP</span><h4>${esc(mission.titulo)}</h4><p>${progress} / ${goal} · ${mission.reclamada?'Recompensa recibida':mission.completada?'Completada':'En curso'}</p><progress value="${progress}" max="${goal}" aria-label="${esc(mission.titulo)}: ${progress} de ${goal}">${progress} / ${goal}</progress><button type="button" class="${mission.completada&&!mission.reclamada?'gold-button':'community-action'}" data-claim-mission="${esc(mission.id)}" ${!mission.completada||mission.reclamada?'disabled':''}>${mission.reclamada?'Reclamada ✓':mission.completada?'Reclamar recompensa':'Sigue jugando'}</button></article>`;
  }).join(''):'<p class="community-empty">No hay misiones disponibles en este periodo.</p>'}</div></section>`;
}
export function missionsView(data) {
  return `<header class="community-heading"><span class="eyebrow">UN NUEVO RETO EN CADA ETAPA</span><h2>Misiones de la academia</h2><p>Termina partidas con tu cuenta vinculada y reclama experiencia adicional. Las victorias en empate también cuentan.</p><p class="community-fine-print">Periodos diarios a las 00:00 UTC y semanales los lunes a las 00:00 UTC. Reclama antes de que se renueven. Solo cuentan resultados desde la activación de las misiones.</p><button type="button" class="community-action" data-community-refresh>Actualizar progreso</button></header>${missionGroup('Misiones diarias',data.diarias||[],data.reinicioDiario)}${missionGroup('Misiones semanales',data.semanales||[],data.reinicioSemanal)}`;
}

// Each mount owns its generation. Leaving the page/account invalidates every pending response.
export function mountCommunity(root,{accounts,page,onReward=()=>{},clipboard=globalThis.navigator?.clipboard,confirm=message=>globalThis.confirm(message)}={}) {
  let alive=true,generation=0,busy=false,criterion='xp',data=null,loadError=false,friendFilter='',suggestionOffset=0,refreshTimer=null;
  const identity=accounts.identity();
  const publicProfiles=createPublicProfile(root,{accounts});
  const valid=current=>alive&&generation===current&&accounts.signedIn()&&accounts.identity()===identity;
  const message=text=>{const node=root.querySelector('[data-community-message]');if(node)node.textContent=text;};
  function render(status='') {
    if(!alive)return;
    if(suggestionOffset>=(data?.sugerencias||[]).length)suggestionOffset=0;
    const view=data?(page==='friends'?friendsView(data,{filter:friendFilter,suggestionOffset}):page==='ranking'?rankingView(data,criterion):missionsView(data)):`<p class="community-empty">${loadError?'No se pudo cargar esta sección.':'Cargando tu academia…'}</p>`;
    root.innerHTML=`<div data-community-content>${view}</div><p data-community-message class="community-message" role="status" aria-live="polite" tabindex="-1">${esc(status)}</p>${data?'':'<button type="button" class="community-action" data-community-refresh>Volver a intentar</button>'}`;
    root.setAttribute('aria-busy',String(busy));
    if(busy)root.querySelectorAll('button,input,select').forEach(control=>control.disabled=true);
  }
  async function run(task,{success='',reward=false,nextCriterion}={}) {
    if(busy||!alive)return;
    busy=true;const current=++generation;
    const active=root.ownerDocument?.activeElement;
    const restoreFocus=Boolean(active&&root.contains(active));
    const requestCode=root.querySelector('#friend-code')?.value;
    const focusId=active?.id,focusCode=active?.dataset?.code,focusAction=active?.dataset?.friendAction,focusClaim=active?.dataset?.claimMission;
    const controls=Array.from(root.querySelectorAll('button,input,select'));
    const disabled=controls.map(control=>control.disabled);
    controls.forEach(control=>control.disabled=true);root.setAttribute('aria-busy','true');message('Conectando…');
    // A disabled focused button sends focus to body in Chromium. Keep Escape and
    // the account panel's keyboard handling reachable until the response arrives.
    if(restoreFocus)root.querySelector('[data-community-message]')?.focus({preventScroll:true});
    try {
      const value=await task();if(!valid(current))return;
      data=value;busy=false;loadError=false;if(nextCriterion)criterion=nextCriterion;render(success);
      if(page==='friends'&&requestCode&&root.querySelector('#friend-code'))root.querySelector('#friend-code').value=requestCode;
      if(restoreFocus) {
        const match=Array.from(root.querySelectorAll('button,input,select')).find(control=>!control.disabled&&(focusId?control.id===focusId:focusClaim?control.dataset.claimMission===focusClaim:focusCode?control.dataset.code===focusCode&&control.dataset.friendAction===focusAction:control.hasAttribute('data-community-refresh')));
        (match||root.querySelector(page==='friends'?'#friend-code':'[data-community-message]'))?.focus({preventScroll:true});
      }
      if(reward)onReward();
    } catch(error) {
      if(!valid(current))return;
      busy=false;root.setAttribute('aria-busy','false');controls.forEach((control,index)=>control.disabled=disabled[index]);
      if(!data){loadError=true;render();}
      else if(page==='ranking')root.querySelector('#ranking-criterion').value=criterion;
      message(error.name==='AbortError'?'La conexión tardó demasiado. Actualiza para comprobar el estado antes de repetir una acción.':error.name==='TypeError'?'No se pudo conectar. Actualiza para comprobar el estado antes de repetir una acción.':error.message||'No se pudo completar la operación.');
    }
  }
  const load=(selected=criterion)=>run(()=>page==='friends'?accounts.community():page==='ranking'?accounts.ranking(selected):accounts.missions(),{nextCriterion:page==='ranking'?selected:undefined});
  const click=async event=>{
    const button=event.target.closest('button');if(!button||!root.contains(button)||busy||button.disabled)return;
    if(button.hasAttribute('data-public-profile')){publicProfiles.open(button.dataset.publicProfile,button);return;}
    if(button.hasAttribute('data-community-refresh')){void load();return;}
    if(button.hasAttribute('data-suggestions-next')||button.hasAttribute('data-suggestions-prev')) {
      const count=(data?.sugerencias||[]).length;if(!count)return;
      const pages=Math.ceil(count/4),direction=button.hasAttribute('data-suggestions-next')?1:-1;
      suggestionOffset=((Math.floor(suggestionOffset/4)+direction+pages)%pages)*4;
      const focusSelector=button.hasAttribute('data-suggestions-next')?'[data-suggestions-next]':'[data-suggestions-prev]';
      const focusIndex=Array.from(root.querySelectorAll(focusSelector)).indexOf(button);
      const code=root.querySelector('#friend-code')?.value;const status=root.querySelector('[data-community-message]')?.textContent;render(status);
      if(code)root.querySelector('#friend-code').value=code;
      root.querySelectorAll(focusSelector)[focusIndex]?.focus({preventScroll:true});return;
    }
    if(button.hasAttribute('data-share-code')||button.hasAttribute('data-copy-code')) {
      const current=generation;
      try {
        if(button.hasAttribute('data-share-code')&&globalThis.navigator?.share){await globalThis.navigator.share({title:'Mi código de amistad en Tesis',text:`Forma parte de mi círculo académico en Tesis. Mi código de amistad: ${data.codigo}`});if(valid(current))message('Código compartido.');}
        else {if(!clipboard?.writeText)throw new Error();await clipboard.writeText(data.codigo);if(valid(current))message('Código copiado. Compártelo con tu amigo.');}
      }
      catch(error) {if(error.name==='AbortError')return;if(valid(current)){const input=root.querySelector('#friend-own-code');input?.focus();input?.select();message('Selecciona el código y cópialo manualmente.');}}
      return;
    }
    if(button.dataset.friendAction) {
      const action=button.dataset.friendAction;
      if(action==='eliminar'&&!confirm('¿Eliminar a esta persona de tus amigos? Para volver a añadirla tendrás que enviar una nueva solicitud.'))return;
      const messages={solicitar:'Solicitud enviada. Revisa tus solicitudes pendientes.',aceptar:'Solicitud aceptada. Ya sois amigos.',rechazar:'Solicitud rechazada.',cancelar:'Solicitud cancelada.',eliminar:'Amigo eliminado.'};
      void run(()=>accounts.friendship(button.dataset.code,action),{success:messages[action]});
    } else if(button.hasAttribute('data-claim-mission'))void run(()=>accounts.claimMission(button.dataset.claimMission),{success:'Recompensa recibida. Tu experiencia se ha actualizado.',reward:true});
  };
  const submit=event=>{
    if(event.target.id!=='friend-request')return;
    event.preventDefault();const code=root.querySelector('#friend-code').value.trim().toUpperCase();
    if(!code){message('Introduce el código de tu amigo.');return;}
    void run(()=>accounts.friendship(code,'solicitar'),{success:'Lista de solicitudes actualizada. Revisa tus solicitudes pendientes.'});
  };
  const change=event=>{if(event.target.id==='ranking-criterion'&&!busy)void load(event.target.value);};
  const input=event=>{
    if(event.target.id!=='friend-search'||busy||!data)return;friendFilter=event.target.value;
    const body=root.querySelector('.friend-list-friends [data-friend-list-body]');
    if(body)body.innerHTML=peopleBody(data.amigos||[],'friends',friendFilter,data.presenciaDisponible===true);
  };
  // Only informative reads repeat. Mutations retain the explicit click and generation guard.
  // Preserve drafts, selection, keyboard focus, messages and list scroll during a live update.
  async function refreshFriends() {
    try {
      if(!alive||busy||publicProfiles.isOpen||!data||root.ownerDocument?.visibilityState==='hidden')return;
      const current=generation,value=await accounts.community();
      if(!valid(current)||busy||publicProfiles.isOpen||JSON.stringify(value)===JSON.stringify(data))return;
      const active=root.ownerDocument?.activeElement;
      const focused=Boolean(active&&root.contains(active));
      const focusId=active?.id,code=active?.dataset?.code,action=active?.dataset?.friendAction,publicCode=active?.dataset?.publicProfile;
      const focusKey=['data-copy-code','data-share-code','data-community-refresh','data-suggestions-next','data-suggestions-prev','data-community-message'].find(key=>active?.hasAttribute?.(key));
      const focusIndex=focusKey?Array.from(root.querySelectorAll(`[${focusKey}]`)).indexOf(active):0;
      const draft=root.querySelector('#friend-code')?.value,start=active?.selectionStart,end=active?.selectionEnd;
      const status=root.querySelector('[data-community-message]')?.textContent||'';
      const scroll=Array.from(root.querySelectorAll('.community-people')).map(list=>list.scrollTop);
      data=value;render(status);
      if(draft)root.querySelector('#friend-code').value=draft;
      Array.from(root.querySelectorAll('.community-people')).forEach((list,i)=>list.scrollTop=scroll[i]||0);
      if(focused){
        const match=focusKey?root.querySelectorAll(`[${focusKey}]`)[focusIndex]:Array.from(root.querySelectorAll('button,input,select')).find(control=>!control.disabled&&(focusId?control.id===focusId:publicCode?control.dataset.publicProfile===publicCode:code&&control.dataset.code===code&&control.dataset.friendAction===action));
        const next=match||root.querySelector('#friend-search');next?.focus({preventScroll:true});
        if(match&&Number.isInteger(start)&&Number.isInteger(end))match.setSelectionRange?.(start,end);
      }
    } catch { /* Keep the last usable data and existing action feedback; manual refresh reports errors. */ }
    finally {if(alive)refreshTimer=setTimeout(refreshFriends,30000);}
  }
  root.addEventListener('input',input);root.addEventListener('click',click);root.addEventListener('submit',submit);root.addEventListener('change',change);
  render();void load();
  if(page==='friends'&&root.ownerDocument?.visibilityState!==undefined)refreshTimer=setTimeout(refreshFriends,30000);
  return {destroy(){alive=false;++generation;publicProfiles.destroy();clearTimeout(refreshTimer);root.removeEventListener('input',input);root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.removeEventListener('change',change);}};
}
