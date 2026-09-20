import {img, esc} from './dom.js';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let queue = [], playbackTimer, playing = false;


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

function showNext() {
  const host = document.getElementById('activity-current');
  if (!host || !queue.length) { playing = false; return; }
  playing = true;
  const entry = queue.shift();
  host.innerHTML = `<div class="activity-move ${entry.publication ? 'is-publication' : ''}">${img(entry.art,'activity-art')}<div><span class="activity-player">${esc(entry.player || 'La academia')}</span><strong>${esc(entry.title)}</strong>${entry.detail ? `<p>${esc(entry.detail)}</p>` : ''}</div></div>
    ${entry.study ? `<div class="activity-progress">${entry.study.publicado ? `◆ Publicado · ${entry.study.carta.prestigio + entry.study.prestigioExtra} prestigio` : `${entry.previous && entry.previous.trabajo !== entry.study.trabajo ? `${entry.previous.trabajo} → ` : ''}${entry.study.trabajo} / ${entry.study.carta.trabajo} trabajo`}<progress value="${entry.study.trabajo}" max="${entry.study.carta.trabajo}" aria-label="Trabajo del estudio"></progress></div>` : ''}
    <div class="activity-resources">${(entry.resources || []).map(r => `<span>${img(r.icon === 'idea' ? 'cartas/reverso_idea.png' : `recursos/${r.icon}.png`)}${r.value > 0 ? '+' : '−'}${Math.abs(r.value)} ${r.label}</span>`).join('')}</div>`;
  if (!reducedMotion()) host.animate([{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:250});
  playbackTimer = setTimeout(showNext, 2400);
}
export function resetFeedback() {
  clearTimeout(playbackTimer); queue = []; playing = false;


}
export function feedback(before, after) {
  const changes = tableChanges(before,after);
  const events = after.eventos.filter(e => e.numero > (before?.eventos.at(-1)?.numero || 0));
  if (!before) {
    resetFeedback();
    // Reconnection shows a summary, never replays old resource gains or card flights.
    queue.push({title:'La mesa está al día',detail:after.eventos.at(-1)?.texto || `Ronda ${after.ronda}`,art:'Logo/logo_tesis.png'});
  } else {
    queue.push(...changes);
    if (!changes.length && events.length && before.fase === 'TURNO_JUGADOR' && after.fase === before.fase && before.actual === after.actual)
      queue.push({title:'Habilidad en la mesa',detail:events.map(e => e.texto).join(' '),art:'cartas/reverso_personaje.png'});
  }
  // Keep live play responsive after a burst; the full record stays in Crónica.
  if (queue.length > 4) queue = queue.slice(-4);
  if (!playing) showNext();
}
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
