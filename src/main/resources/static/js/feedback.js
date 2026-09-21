import {img, esc, update} from './dom.js';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;



export function notify(message, kind = '') {
  const item = document.createElement('div'); item.className = `toast ${kind}`; item.textContent = message;
  const notifications = document.getElementById('notifications');
  notifications.append(item);
  while (notifications.children.length > 3) notifications.firstElementChild.remove();
  setTimeout(() => item.remove(), 5500);
}
// Only compare the public view and our own hand. Rival cards remain face down.
export function tableChanges(before, after) {
  if (!before) return [];
  const changes = [];
  const events = after.eventos.filter(e => e.numero > (before.eventos.at(-1)?.numero || 0));
  for (const player of after.jugadores) {
    const old = before.jugadores.find(p => p.nombre === player.nombre);
    if (!old) continue;
    const exchange = events.find(e => e.tipo === 'habilidad.plagiador' && [e.actor,e.objetivo].includes(player.nombre));
    const resources = [['monedas','moneda','monedas'], ['prestigio','prestigio','prestigio'], ['cartas','idea','ideas']]
      .filter(([key]) => old[key] !== player[key])
      .map(([key, icon, label]) => ({icon, label, value:player[key] - old[key]}));
    const ownChanges = [];
    for (const study of player.estudios) {
      const previous = old.estudios.find(e => e.indice === study.indice);
      let title;
      if (study.publicado && !previous?.publicado) title = 'Artículo publicado';
      else if (!previous) title = 'Nuevo estudio';
      else if (previous.trabajo !== study.trabajo) title = study.trabajo > previous.trabajo ? 'Avanza el estudio' : 'Revisión del estudio';
      else if (previous.prestigioExtra !== study.prestigioExtra) title = 'Más prestigio';
      if (title) ownChanges.push({player:player.nombre, title, study, previous, art:study.carta.arte,
        detail:study.carta.nombre, publication:study.publicado && !previous?.publicado});
    }
    if ((resources.length || exchange) && !ownChanges.length) ownChanges.push({player:player.nombre,
      title:exchange ? 'Mano intercambiada' : resources.some(r => r.icon === 'idea' && r.value > 0) ? 'Nuevas ideas' : 'Recursos de la academia',
      detail:exchange ? exchange.texto : '',
      art:exchange || resources.some(r => r.icon === 'idea') ? 'cartas/reverso_idea.png' : 'recursos/moneda.png'});
    if (ownChanges.length) ownChanges[0].resources = resources;
    changes.push(...ownChanges);
    if (player.rol && old.rol?.nombre !== player.rol.nombre) changes.push({player:player.nombre,
      title:player.nombre === after.yo && after.fase === 'SELECCION_ROLES' ? 'Tu personaje elegido' : 'Personaje revelado', detail:player.rol.nombre, art:player.rol.arte});
  }
  return changes;
}

// Current authoritative phase, never a queue of past actions or private choices.
export function currentActivity(state) {
  const own=state.actual===state.yo;
  if(state.fase==='SELECCION_ROLES') return {player:state.actual,
    title:own?'Elige tu personaje':`${state.actual} est\u00e1 eligiendo personaje`,
    detail:own?'Abre las cartas para elegir. Tu elecci\u00f3n es privada.':'La elecci\u00f3n es privada. Enseguida contin\u00faa la mesa.',art:'cartas/reverso_personaje.png'};
  if(state.fase==='FIN_PARTIDA') return {player:'La academia',title:'Partida finalizada',
    detail:state.ganadores.length ? `Victoria: ${state.ganadores.join(' \u00b7 ')}`:'Consulta los resultados.',art:'recursos/prestigio.png'};
  if(state.fase==='FIN_RONDA') return {player:`Ronda ${state.ronda}`,title:'Cierre de ronda',
    detail:own ? (state.ultimaRonda?'Puedes abrir el resultado final.':'Puedes comenzar la siguiente ronda.')
      : `Esperando a ${state.actual} para continuar.`,art:'cartas/reverso_personaje.png'};
  if(own && state.habilidadPendiente) return {player:state.actual,title:'Resuelve el Comit\u00e9 de \u00c9tica',
    detail:'Elige en privado el personaje vetado antes de actuar.',art:'cartas/reverso_personaje.png'};
  return {player:state.actual,title:own?'Es tu turno':`${state.actual} est\u00e1 jugando su turno`,
    detail:own ? (state.accionesRestantes>0 ? `${state.accionesRestantes} ${state.accionesRestantes===1?'acci\u00f3n disponible':'acciones disponibles'}. Elige tu siguiente paso.`
      :'Sin acciones base. Puedes usar tu habilidad si est\u00e1 disponible o terminar el turno.')
      :'La mesa espera su siguiente acci\u00f3n.',art:'recursos/prestigio.png'};
}
export function showActivity({player='',title,detail='',art='cartas/reverso_personaje.png'}) {
  const host=document.getElementById('activity-current');
  if(!host) return;
  const html=`<div class="activity-move activity-now">${img(art,'activity-art')}<div><span class="activity-player">${esc(player)}</span><strong>${esc(title)}</strong><p>${esc(detail)}</p></div></div>`;
  if(host.innerHTML===html) return;
  update('activity-current',html);
  if(!reducedMotion()) host.animate([{opacity:.5},{opacity:1}],{duration:180});
}
export function resetFeedback() {
  // No timers: the live status always follows the current phase or ceremony.
}
export function feedback(before, after) { showActivity(currentActivity(after)); }
const tooltip = document.getElementById('tooltip');
function show(target) {
  const item = target.closest?.('[data-tip]');
  if (!item || document.getElementById('modal').open) { tooltip.hidden = true; return; }
  tooltip.textContent = item.dataset.tip; tooltip.hidden = false;
  const rect = item.getBoundingClientRect();
  const {width, height} = tooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
  const above = rect.top - height - 10;
  const top = above >= 8 ? above : Math.max(8, Math.min(rect.bottom + 10, innerHeight - height - 8));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}
document.addEventListener('pointerover', e => show(e.target));
document.addEventListener('focusin', e => show(e.target));
document.addEventListener('pointerout', () => tooltip.hidden = true);
document.addEventListener('focusout', () => tooltip.hidden = true);
document.addEventListener('click', () => tooltip.hidden = true);
document.addEventListener('scroll', () => tooltip.hidden = true, true);
window.addEventListener('resize', () => tooltip.hidden = true);
