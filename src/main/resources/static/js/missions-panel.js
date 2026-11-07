import {esc} from './dom.js';
import {cosmeticArt} from './profile-customization.js';
import {remainingCountdown,updatePeriodCountdowns} from './period-countdown.js';

const number=value=>Math.max(0,Math.floor(Number(value)||0));
const fmt=value=>number(value).toLocaleString('es-ES');
const corners='<span class="missions-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const periods=[['diarias','Misiones diarias','☀','reinicioDiario'],['semanales','Misiones semanales','▥','reinicioSemanal'],['temporada','Misiones de temporada','✦','reinicioTemporada'],['especiales','Misiones especiales','★',null]];
// Temporada y pase ocultos en este curso: solo misiones diarias, semanales y especiales con XP.
export const SHOW_SEASON=false;
// Diarias y semanales también ocultas: el panel solo muestra las misiones especiales.
export const SHOW_ROUTINE=false;
const passActive=pass=>Boolean(pass?.temporada?.activa)&&new Date(pass.temporada.fin).getTime()>Date.now();
const types={avatar:'Avatar',marco:'Marco de perfil',titulo:'Título',insignia:'Insignia',placa:'Placa de nombre',reverso:'Reverso de cartas',interaccion:'Interacción'};
export function missionState(mission){return mission.reclamada?'reclamada':mission.completada?'completada':'progreso';}
export function seasonCountdown(fin,now=Date.now()){return remainingCountdown(fin,now,'Temporada finalizada');}
function card(mission,busy,season=SHOW_SEASON){
  const state=missionState(mission),goal=Math.max(1,number(mission.objetivo)),progress=Math.min(goal,number(mission.progreso));
  const stateLabel={reclamada:'Reclamada',completada:'Completada',progreso:'En progreso'}[state],prize=mission.recompensa,xp=number(mission.xp);
  const inPerson=!prize&&!xp;
  // Premio en persona (Llaverito): sin XP ni cosmético en el juego; lo entrega el profesor.
  const reward=prize?esc(types[prize.tipo]||'Recompensa'):inPerson?'Llavero':`+${fmt(xp)} XP`,rewardNote=inPerson?'<small>Premio en persona: te lo entrega tu profesor</small>':prize?`<small>${esc((types[prize.tipo]||'Cosmético')+' «'+prize.nombre+'»')}${xp?` · +${fmt(xp)} XP`:''}</small>`:season&&number(mission.puntosPase)>0?`<small>+${fmt(mission.puntosPase)} puntos de pase</small>`:'<small>Recompensa de experiencia</small>';
  return `<article class="mission-card missions-ornament is-${state==='reclamada'?'claimed':state==='completada'?'completed':'progress'}" data-mission-id="${esc(mission.id)}">${corners}<div class="mission-card-heading">${prize?`<span class="mission-emblem mission-prize" aria-hidden="true">${cosmeticArt(prize)}</span>`:`<span class="mission-emblem" aria-hidden="true">${inPerson?'⚷':/gan|victoria/i.test(mission.titulo)?'♛':'⚔'}</span>`}<div><h4>${esc(mission.titulo)}</h4><p>${esc(mission.descripcion||'Completa este reto en partidas con tu cuenta vinculada.')}</p></div><span class="mission-xp">${reward}</span></div><div class="mission-progress-copy"><strong>${fmt(progress)} / ${fmt(goal)}</strong><span class="mission-state">${stateLabel}</span></div><progress class="missions-progress" max="${goal}" value="${progress}" aria-label="${esc(mission.titulo)}: ${fmt(progress)} de ${fmt(goal)}">${progress}/${goal}</progress><div class="mission-card-bottom">${rewardNote}<button type="button" class="missions-button ${state==='completada'?'is-gold':''}" data-mission-claim="${esc(mission.id)}" ${busy||state!=='completada'?'disabled':''}>${state==='reclamada'?'✓ Reclamada':state==='completada'?'Reclamar':'Seguir jugando'}</button></div></article>`;
}
function rewardCard(reward,{busy,compact=false,active=true}={}){
  const state=reward.reclamada?'claimed':reward.desbloqueada?'unlocked':'locked';
  return `<article class="mission-reward is-${state} ${reward.nivel===10?'is-legendary':''} ${compact?'is-compact':''}" data-reward-id="${esc(reward.id)}"><span class="mission-reward-level">${fmt(reward.nivel)}</span><div class="mission-reward-art">${(reward.cosmeticos||[]).map(item=>cosmeticArt(item)).join('')}</div><div class="mission-reward-copy"><h4>${esc(reward.nombre)}</h4><p>${reward.nivel===10?'Set legendario · Gran premio final':(reward.cosmeticos||[]).map(item=>types[item.tipo]||item.tipo).join(' · ')}</p>${reward.nivel===10?`<ul>${(reward.cosmeticos||[]).map(item=>`<li>${esc(types[item.tipo]||item.tipo)}: ${esc(item.nombre)}</li>`).join('')}</ul>`:''}<span class="mission-reward-state">${reward.reclamada?'✓ Reclamada':reward.desbloqueada?'✦ Desbloqueada':'Bloqueada · Nivel '+fmt(reward.nivel)}</span>${reward.desbloqueada&&!reward.reclamada?`<button type="button" class="missions-button is-gold" data-season-claim="${esc(reward.id)}" ${busy||!active?'disabled':''}>Reclamar recompensa</button>`:''}</div></article>`;
}
function passView(pass,busy,expanded){
  if(!pass)return '<div class="missions-empty">El pase de temporada no está disponible. Actualiza el progreso para volver a consultar.</div>';
  const {temporada,progreso}=pass,rewards=[...(pass.recompensas||[])].sort((a,b)=>a.nivel-b.nivel),next=rewards.find(row=>row.desbloqueada&&!row.reclamada)||rewards.find(row=>!row.desbloqueada);
  const per=Math.max(1,number(progreso.puntosPorNivel)),base=Math.max(0,(number(progreso.nivel)-1)*per),max=progreso.puntosSiguienteNivel==null,progress=max?per:Math.max(0,Math.min(per,number(progreso.puntos)-base));
  const featured=[next,rewards.find(row=>row.nivel===5),rewards.find(row=>row.nivel===10)].filter((row,i,all)=>row&&all.findIndex(other=>other?.id===row.id)===i);
  return `<span class="missions-eyebrow">✦ PROGRESO DE TEMPORADA</span><h3>${esc(temporada.nombre)}</h3><div class="missions-pass-progress"><span class="missions-level">${fmt(progreso.nivel)}</span><div><strong>Nivel ${fmt(progreso.nivel)} <small>/ ${fmt(progreso.maxNivel)}</small></strong><progress class="missions-progress" max="${per}" value="${progress}" aria-label="Progreso hacia el siguiente nivel">${progress}/${per}</progress><p>${fmt(progreso.puntos)} puntos de pase</p><small>${max?'Has alcanzado el nivel máximo':`${fmt(Math.max(0,number(progreso.puntosSiguienteNivel)-number(progreso.puntos)))} puntos para el siguiente nivel`}</small></div></div><div class="missions-pass-featured">${featured.map(row=>rewardCard(row,{busy,compact:true,active:passActive(pass)})).join('')}</div><p class="missions-pass-note">Pase gratuito · Solo cosméticos.<br>Tu colección se conserva para siempre.</p><button type="button" class="missions-button is-gold missions-rewards-toggle" data-rewards-toggle aria-expanded="${expanded}">${expanded?'Ocultar recorrido':'Ver las '+fmt(progreso.maxNivel)+' recompensas'}</button>`;
}
export function missionsView(data,pass,{busy=false,period='todos',filter='todos',expanded=false,notice='',missionError='',passError='',season=SHOW_SEASON,routine=SHOW_ROUTINE}={}){
  const shown=periods.filter(([id])=>(season||id!=='temporada')&&(routine||(id!=='diarias'&&id!=='semanales')));
  const completed=items=>items.filter(item=>item.completada||item.reclamada).length,daily=data?.diarias||[],weekly=data?.semanales||[],seasonal=data?.temporada||[];
  const special=data?.especiales||[];
  const stats=[['▤','Misiones completadas hoy',data?`${completed(daily)} / ${daily.length}`:'—'],['XP','XP pendiente hoy',data?fmt(daily.filter(item=>!item.reclamada).reduce((total,item)=>total+number(item.xp),0))+' XP':'—'],['▥','Progreso semanal',data?`${completed(weekly)} / ${weekly.length}`:'—'],...(season?[['✦','Retos de temporada',data?`${completed(seasonal)} / ${seasonal.length}`:'—'],['★','Nivel del pase',pass?`${fmt(pass.progreso.nivel)} / ${fmt(pass.progreso.maxNivel)}`:'—']]:[['★','Misiones especiales',data?`${completed(special)} / ${special.length}`:'—']])];
  return `<div class="missions-root"><header class="missions-hero"><div><span class="missions-eyebrow">UN NUEVO RETO EN CADA ETAPA</span><h2 id="missions-title" tabindex="-1">Misiones de la academia</h2><p>${routine?'Completa misiones, gana XP y avanza en tu camino dentro de la Academia.':'Retos permanentes de la Academia: cúmplelos en tus partidas y reclama su recompensa.'}${season?'<br>El pase tiene su propio progreso y recompensas cosméticas permanentes.':''}</p></div>${season?`<section class="missions-season-banner missions-ornament">${corners}<span class="missions-eyebrow">TEMPORADA ACTUAL</span><h3>${esc(pass?.temporada?.nombre||'Consultando temporada…')}</h3><div><span data-season-countdown data-countdown-end="${esc(pass?.temporada?.fin||'')}" data-countdown-ended="Temporada finalizada">${pass?esc(seasonCountdown(pass.temporada.fin)):'Tiempo restante no disponible'}</span><button type="button" class="missions-button is-gold" data-missions-refresh ${busy?'disabled':''}>↻ Actualizar progreso</button></div></section>`:`<div class="missions-refresh-only"><button type="button" class="missions-button is-gold" data-missions-refresh ${busy?'disabled':''}>↻ Actualizar progreso</button></div>`}</header>${routine||season?`<div class="missions-stats ${season?'':'is-compact'}">${stats.map(([icon,label,value])=>`<article class="missions-stat missions-ornament">${corners}<span aria-hidden="true">${icon}</span><div><h3>${label}</h3><strong>${value}</strong></div></article>`).join('')}</div>`:''}<div class="missions-toolbar">${routine||season?`<div role="group" aria-label="Periodo de misiones">${[['todos','Todas','▤'],...(routine?[['diarias','Diarias','☀'],['semanales','Semanales','▥']]:[]),...(season?[['temporada','Temporada','✦']]:[]),['especiales','Especiales','★']].map(([id,label,icon])=>`<button type="button" class="missions-button" data-mission-period="${id}" aria-pressed="${period===id}">${icon} ${label}</button>`).join('')}</div>`:'<div></div>'}<div role="group" aria-label="Estado de misiones">${[['todos','Todas'],['progreso','En progreso'],['completada','Completadas'],['reclamada','Reclamadas']].map(([id,label])=>`<button type="button" class="missions-button" data-mission-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div></div><p class="missions-status" role="status" aria-live="polite">${esc(notice)}</p><div class="missions-layout ${season?'':'is-single'}"><div class="missions-sections">${missionError?`<p class="missions-error" role="alert">${esc(missionError)}</p>`:''}${!data?'<p class="missions-empty">No hay información de misiones disponible.</p>':shown.filter(([id])=>period==='todos'||period===id).map(([id,title,,reset])=>{const items=(data[id]||[]).filter(item=>filter==='todos'||missionState(item)===filter);return `<section class="missions-group missions-group-${id}"><header><h3>${title}</h3><p>${!reset?'<span>Permanentes · se reclaman una sola vez</span>':`<span data-countdown-end="${esc(data[reset]||(id==='temporada'?pass?.temporada?.fin:null)||'')}" data-countdown-label="Renovación" data-countdown-ended="Renovando misiones…">Renovación: ${esc(remainingCountdown(data[reset]||(id==='temporada'?pass?.temporada?.fin:null),Date.now(),'Renovando misiones…'))}</span>`}</p></header><div class="missions-card-grid">${items.length?items.map(item=>card(item,busy,season)).join(''):`<p class="missions-empty">${(data[id]||[]).length?'No hay misiones con este estado.':'No hay retos disponibles para este periodo.'}</p>`}</div></section>`;}).join('')}</div>${season?`<aside class="missions-pass missions-ornament" aria-label="Pase de temporada">${corners}${passError?`<p class="missions-error" role="alert">${esc(passError)}</p>`:''}${passView(pass,busy,expanded)}</aside>`:''}</div>${season&&expanded&&pass?`<section class="missions-reward-track missions-ornament">${corners}<header><span class="missions-eyebrow">TU RECORRIDO EN EL ARCHIVO</span><h3>Las ${fmt(pass.progreso.maxNivel)} recompensas de ${esc(pass.temporada.nombre)}</h3><p>Reclama tus cosméticos desbloqueados. No conceden XP ni afectan al ranking.</p></header><div class="missions-reward-grid">${[...(pass.recompensas||[])].sort((a,b)=>a.nivel-b.nivel).map(row=>rewardCard(row,{busy,active:passActive(pass)})).join('')}</div></section>`:''}</div>`;
}

// Claims and progression are authoritative on the server. Each mount owns its identity and generation.
export function mountMissions(root,{accounts,onReward=()=>{},season=SHOW_SEASON,routine=SHOW_ROUTINE}){
  let alive=true,generation=0,busy=false,data=null,pass=null,period='todos',filter='todos',expanded=false,notice='',missionError='',passError='',lastRefresh=0,expiredRefreshKey='';
  const identity=accounts.identity?.(),valid=token=>alive&&token===generation&&accounts.identity?.()===identity;
  function render(){
    if(!alive)return;
    const active=root.ownerDocument?.activeElement,keys=['data-mission-claim','data-season-claim','data-missions-refresh','data-rewards-toggle','data-mission-period','data-mission-filter'];
    const inPanel=active&&root.contains(active),focus=inPanel?keys.find(key=>active.hasAttribute?.(key)):null,value=focus?active.getAttribute(focus):null,statusFocused=inPanel&&active.classList?.contains('missions-status');
    root.innerHTML=missionsView(data,pass,{busy,period,filter,expanded,notice,missionError,passError,season,routine});root.setAttribute('aria-busy',String(busy));
    if(focus){const buttons=[...root.querySelectorAll?.(`[${focus}]`)||[]],restored=buttons.find(button=>button.getAttribute(focus)===value&&!button.disabled);if(restored)restored.focus();else{const status=root.querySelector('.missions-status');status?.setAttribute('tabindex','-1');status?.focus();}}
    else if(statusFocused){const status=root.querySelector('.missions-status');status?.setAttribute('tabindex','-1');status?.focus();}
  }
  async function refresh(){
    if(busy||!alive)return;
    busy=true;lastRefresh=Date.now();const token=++generation;render();
    const results=await Promise.allSettled([Promise.resolve().then(()=>accounts.missions()),season?Promise.resolve().then(()=>accounts.seasonPass()):Promise.resolve(null)]);
    if(!valid(token))return;
    if(results[0].status==='fulfilled'){data=results[0].value;missionError='';}else{missionError='No se han podido actualizar las misiones. '+(results[0].reason?.message||'');}
    if(results[1].status==='fulfilled'){pass=results[1].value;passError='';}else{passError='No se ha podido actualizar el pase. '+(results[1].reason?.message||'');}
    busy=false;render();
  }
  async function claim(kind,id){
    if(busy||!alive)return;
    const mission=periods.flatMap(([key])=>data?.[key]||[]).find(item=>item.id===id),reward=pass?.recompensas?.find(item=>item.id===id);
    if(kind==='mission'? !mission?.completada||mission.reclamada:!reward?.desbloqueada||reward.reclamada||!passActive(pass))return;
    busy=true;notice='Reclamando recompensa…';const token=++generation;render();
    try{
      const updated=await(kind==='mission'?accounts.claimMission(id):accounts.claimSeasonReward(pass.temporada.id,id));
      if(!valid(token))return;
      if(kind==='mission')data=updated;else pass=updated;
      notice=kind==='mission'?(mission.recompensa?`${types[mission.recompensa.tipo]||'Cosmético'} «${mission.recompensa.nombre}» añadido a tu colección y equipado en tu perfil.`:!number(mission.xp)?'¡Misión reclamada! Enséñasela a tu profesor para recibir tu llavero.':'Misión reclamada. Progreso actualizado desde el servidor.'):'Cosméticos reclamados: ya están en tu colección permanente.';
      if(kind==='mission')await Promise.resolve(onReward());
    }catch(error){if(!valid(token))return;notice=(error?.message||'No se pudo confirmar la reclamación.')+' Actualiza el progreso para comprobar su estado antes de volver a reclamar.';}
    if(!valid(token))return;
    busy=false;await refresh();
  }
  const click=event=>{
    const button=event.target.closest('button');if(!button||!root.contains(button)||button.disabled)return;
    if(button.hasAttribute('data-missions-refresh')){notice='';void refresh();}
    else if(button.hasAttribute('data-mission-period')){period=button.dataset.missionPeriod;render();root.querySelector(`[data-mission-period="${period}"]`)?.focus();}
    else if(button.hasAttribute('data-mission-filter')){filter=button.dataset.missionFilter;render();root.querySelector(`[data-mission-filter="${filter}"]`)?.focus();}
    else if(button.hasAttribute('data-rewards-toggle')){expanded=!expanded;render();root.querySelector('[data-rewards-toggle]')?.focus();}
    else if(button.hasAttribute('data-mission-claim'))void claim('mission',button.dataset.missionClaim);
    else if(button.hasAttribute('data-season-claim'))void claim('season',button.dataset.seasonClaim);
  };
  root.addEventListener('click',click);void refresh();
  const tick=()=>{
    if(!alive||accounts.identity?.()!==identity)return;
    updatePeriodCountdowns(root);
    const now=Date.now(),ends=[data?.reinicioDiario,data?.reinicioSemanal,data?.reinicioTemporada,pass?.temporada?.fin].filter(Boolean).map(value=>new Date(value).getTime());
    const expired=ends.filter(end=>Number.isFinite(end)&&end<=now).join('|');
    if(expired&&(expired!==expiredRefreshKey||now-lastRefresh>=60000)&&!busy){expiredRefreshKey=expired;render();void refresh();}
  };
  const visibility=()=>{if(root.ownerDocument?.visibilityState==='visible'&&Date.now()-lastRefresh>=30000)void refresh();};
  const timer=globalThis.setInterval?.(tick,1000);root.ownerDocument?.addEventListener?.('visibilitychange',visibility);
  return {refresh,destroy(){alive=false;generation++;globalThis.clearInterval?.(timer);root.removeEventListener('click',click);root.ownerDocument?.removeEventListener?.('visibilitychange',visibility);}};
}
