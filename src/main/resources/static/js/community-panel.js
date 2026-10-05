import {esc} from './dom.js';

const integer=value=>Math.max(0,Math.floor(Number(value)||0));
const format=value=>integer(value).toLocaleString('es-ES');
export const academyTabs=active=>`<nav class="community-tabs" aria-label="Secciones de tu academia">${[['profile','Mi perfil'],['friends','Amigos'],['ranking','Ranking global'],['missions','Misiones']].map(([id,title])=>`<button type="button" data-academy-page="${id}" ${active===id?'aria-current="page"':''}>${title}</button>`).join('')}</nav>`;
const action=(code,value,label)=>`<button type="button" class="community-action" data-friend-action="${value}" data-code="${esc(code)}">${label}</button>`;
function people(title,items,kind) {
  return `<section class="community-card"><h3>${title} <small>${items.length}</small></h3>${items.length?`<ul class="community-people">${items.map(person=>`<li><span class="community-avatar" aria-hidden="true">${esc(Array.from(person.nombre||'?')[0].toUpperCase())}</span><div><strong>${esc(person.nombre)}</strong><span>Nivel ${format(person.nivel)} · ${esc(person.codigo)}</span></div><div class="community-person-actions">${kind==='friends'?action(person.codigo,'eliminar','Eliminar'):kind==='received'?action(person.codigo,'aceptar','Aceptar')+action(person.codigo,'rechazar','Rechazar'):action(person.codigo,'cancelar','Cancelar')}</div></li>`).join('')}</ul>`:`<p class="community-empty">${kind==='friends'?'Todavía no tienes amigos. Comparte tu código o envía una solicitud para empezar.':kind==='received'?'No tienes solicitudes pendientes de aceptar.':'No tienes solicitudes enviadas pendientes.'}</p>`}</section>`;
}
export function friendsView(data) {
  return `<header class="community-heading"><span class="eyebrow">INVESTIGAR EN COMPAÑÍA</span><h2>Tu círculo académico</h2><p>Conecta por código. La otra persona decide si acepta tu solicitud. Puedes tener hasta 100 contactos, incluidas las solicitudes pendientes.</p><button type="button" class="community-action" data-community-refresh>Actualizar amigos</button></header><div class="friend-invite community-card"><div><label for="friend-own-code">Tu código de amistad</label><div class="friend-code-line"><input id="friend-own-code" readonly value="${esc(data.codigo)}" aria-label="Tu código de amistad"><button type="button" class="community-action" data-copy-code>Copiar</button></div><p>Este código público identifica tu perfil; para entrar en una partida usa el código de sala.</p></div><form id="friend-request"><label for="friend-code">Añadir un amigo por código</label><div class="friend-code-line"><input id="friend-code" name="codigo" required maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Código de tu amigo"><button class="gold-button">Enviar solicitud</button></div></form></div><div class="community-friend-grid">${people('Amigos',data.amigos||[],'friends')}${people('Solicitudes recibidas',data.recibidas||[],'received')}${people('Solicitudes enviadas',data.enviadas||[],'sent')}</div>`;
}
const labels={xp:'Experiencia',victorias:'Victorias',partidas:'Partidas terminadas'};
function rankRow(entry) {
  return `<tr ${entry.yo?'class="ranking-self"':''}><th scope="row">${format(entry.posicion)}</th><td><strong>${esc(entry.nombre)}${entry.yo?' <span class="ranking-you">TÚ</span>':''}</strong><small>Nivel ${format(entry.nivel)}</small></td><td>${format(entry.xp)}</td><td>${format(entry.victorias)}</td><td>${format(entry.partidas)}</td></tr>`;
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
  let alive=true,generation=0,busy=false,criterion='xp',data=null,loadError=false;
  const identity=accounts.identity();
  const valid=current=>alive&&generation===current&&accounts.signedIn()&&accounts.identity()===identity;
  const message=text=>{const node=root.querySelector('[data-community-message]');if(node)node.textContent=text;};
  function render(status='') {
    if(!alive)return;
    const view=data?(page==='friends'?friendsView(data):page==='ranking'?rankingView(data,criterion):missionsView(data)):`<p class="community-empty">${loadError?'No se pudo cargar esta sección.':'Cargando tu academia…'}</p>`;
    root.innerHTML=`<div data-community-content>${view}</div><p data-community-message class="community-message" role="status" aria-live="polite" tabindex="-1">${esc(status)}</p>${data?'':'<button type="button" class="community-action" data-community-refresh>Volver a intentar</button>'}`;
    root.setAttribute('aria-busy',String(busy));
    if(busy)root.querySelectorAll('button,input,select').forEach(control=>control.disabled=true);
  }
  async function run(task,{success='',reward=false,nextCriterion}={}) {
    if(busy||!alive)return;
    busy=true;const current=++generation;
    const active=root.ownerDocument?.activeElement;
    const restoreFocus=Boolean(active&&root.contains(active));
    const focusId=active?.id,focusCode=active?.dataset?.code,focusAction=active?.dataset?.friendAction,focusClaim=active?.dataset?.claimMission;
    const controls=Array.from(root.querySelectorAll('button,input,select'));
    const disabled=controls.map(control=>control.disabled);
    controls.forEach(control=>control.disabled=true);root.setAttribute('aria-busy','true');message('Conectando…');
    try {
      const value=await task();if(!valid(current))return;
      data=value;busy=false;loadError=false;if(nextCriterion)criterion=nextCriterion;render(success);
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
    const button=event.target.closest('button');if(!button||!root.contains(button)||busy)return;
    if(button.hasAttribute('data-community-refresh')){void load();return;}
    if(button.hasAttribute('data-copy-code')) {
      const current=generation;
      try {if(!clipboard?.writeText)throw new Error();await clipboard.writeText(data.codigo);if(valid(current))message('Código copiado. Compártelo con tu amigo.');}
      catch {if(valid(current)){const input=root.querySelector('#friend-own-code');input?.focus();input?.select();message('Selecciona el código y cópialo manualmente.');}}
      return;
    }
    if(button.dataset.friendAction) {
      const action=button.dataset.friendAction;
      if(action==='eliminar'&&!confirm('¿Eliminar a esta persona de tus amigos? Para volver a añadirla tendrás que enviar una nueva solicitud.'))return;
      const messages={aceptar:'Solicitud aceptada. Ya sois amigos.',rechazar:'Solicitud rechazada.',cancelar:'Solicitud cancelada.',eliminar:'Amigo eliminado.'};
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
  root.addEventListener('click',click);root.addEventListener('submit',submit);root.addEventListener('change',change);
  render();void load();
  return {destroy(){alive=false;++generation;root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.removeEventListener('change',change);}};
}
