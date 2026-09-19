import {img, esc} from './dom.js';
import {roleCard} from './cards.js';

const modal = document.getElementById('modal');
let previousFocus;
export function closeDialog() { modal.close(); previousFocus?.focus?.(); }
export function dialog(title, content, {wide = false, locked = false, subtitle = ''} = {}) {
  if (!modal.open) previousFocus = document.activeElement;
  modal.className = `${wide ? 'wide' : ''} ${locked ? 'locked' : ''}`;
  modal.dataset.locked = String(locked);
  document.getElementById('modal-content').innerHTML = `<div class="dialog-heading"><span class="eyebrow">CIUDADELA ACADÉMICA</span><h1 id="modal-title">${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${!locked ? '<button class="dialog-close" data-command="close" aria-label="Cerrar">Cerrar</button>' : ''}<div class="dialog-body">${content}</div>`;
  if (!modal.open) modal.showModal();
  modal.scrollTop = 0;
}
modal.addEventListener('cancel', e => { if (modal.dataset.locked === 'true') e.preventDefault(); });

export function phaseDialog(state) {
  if (state.bloqueada) {
    dialog(`Tu turno, ${state.actual}`, `<div class="handoff">${img('cartas/reverso_personaje.png')}<p>Pasa el control a <strong>${esc(state.actual)}</strong>.</p><p class="muted">Las manos y las elecciones se mantienen privadas entre turnos.</p><button class="gold-button" data-command="reveal">Soy ${esc(state.actual)} · continuar</button></div>`, {locked:true, subtitle:state.fase === 'SELECCION_ROLES' ? `Ronda ${state.ronda} · selección de personaje` : `Ronda ${state.ronda} · turno de acción`});
  } else if (state.fase === 'SELECCION_ROLES') {
    dialog('Elige tu personaje', `<div class="role-selection">${state.seleccion.map(r => roleCard(r)).join('')}</div><p class="selection-caption">Selecciona una carta para leer su habilidad y confirmar tu elección.</p>`, {wide:true, locked:true, subtitle:`${state.actual} · el orden del personaje determina cuándo jugarás.`});
  } else if (state.fase === 'FIN_RONDA') {
    dialog(`La ronda ${state.ronda} ha terminado`, `<div class="round-summary">${ranking(state)}<p>${state.ultimaRonda ? 'Se ha alcanzado la tercera publicación. Es hora de reconocer el legado de cada academia.' : 'Los personajes regresan al mazo. Una nueva ronda trae nuevas posibilidades.'}</p><button class="gold-button" data-command="next-round">${state.ultimaRonda ? 'Descubrir el resultado' : 'Comenzar siguiente ronda'}</button></div>`, {locked:true});
  } else if (state.fase === 'FIN_PARTIDA') {
    dialog(state.ganadores.length > 1 ? 'Una victoria compartida' : 'Un legado para la academia', `<div class="final-result">${img('recursos/prestigio.png','victory-medal')}<h2>${state.ganadores.map(esc).join(' · ')}</h2><p>${state.ganadores.length > 1 ? 'Comparten' : 'Obtiene'} la victoria por prestigio.</p>${ranking(state)}<div class="dialog-buttons"><button class="gold-button" data-command="home">Nueva partida</button><button class="plain-button" data-command="close">Explorar la mesa</button></div></div>`, {locked:false, subtitle:`Partida completada en ${state.ronda} rondas`});
  } else closeDialog();
}
function ranking(state) {
  return `<ol class="ranking">${[...state.jugadores].sort((a,b) => b.prestigio-a.prestigio).map(p => `<li><strong>${esc(p.nombre)}</strong><span>${p.publicados} publicaciones</span><b>${p.prestigio} prestigio</b></li>`).join('')}</ol>`;
}
