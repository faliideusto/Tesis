import {img, esc} from './dom.js';
import {roleCard} from './cards.js';

const modal = document.getElementById('modal');
let previousFocus;
export const informationalDialogOpen = () => modal.open && modal.dataset.kind === 'info';
export function reconcileDialog(sameRoom) {
  if (!sameRoom || !informationalDialogOpen()) { closeDialog(); return; }
  if (modal.dataset.snapshot === 'true' && !modal.querySelector('.consultation-update')) {
    const note = document.createElement('p');
    note.className = 'consultation-update'; note.setAttribute('role','status');
    note.textContent = 'La mesa se ha actualizado. Esta consulta conserva la información que abriste.';
    modal.querySelector('.dialog-body').append(note);
  }
}
export function closeDialog() {
  if (!modal.open) return;
  modal.close(); previousFocus?.focus?.({preventScroll:true});
}
export function dialog(title, content, {wide = false, locked = false, subtitle = '', kind = 'decision', snapshot = false} = {}) {
  if (!modal.open) previousFocus = document.activeElement;
  modal.className = `${wide ? 'wide' : ''} ${locked ? 'locked' : ''}`;
  modal.dataset.locked = String(locked);
  modal.dataset.kind = kind;
  modal.dataset.snapshot = String(snapshot);
  document.getElementById('modal-content').innerHTML = `<div class="dialog-heading"><span class="eyebrow">TESIS</span><h1 id="modal-title">${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${!locked ? '<button class="dialog-close" data-command="close" aria-label="Cerrar">Cerrar</button>' : ''}<div class="dialog-body">${content}</div>`;
  if (!modal.open) modal.showModal();
  modal.scrollTop = 0;
}
modal.addEventListener('cancel', e => { if (modal.dataset.locked === 'true') e.preventDefault(); });

export function phaseDialog(state) {
  if (state.fase === 'SELECCION_ROLES' && state.seleccion.length) {
    dialog('Elige tu personaje', `<div class="role-selection">${(state.catalogoSeleccion || state.seleccion).map(r => roleCard(r, {unavailable:r.indice < 0, command:r.indice < 0 ? 'unavailable-role' : 'role'})).join('')}</div><p class="selection-caption">Selecciona una carta para leer su habilidad y confirmar tu elección. Puedes cerrar esta ventana para mirar la mesa.</p>`, {wide:true, subtitle:`${state.actual} · el orden del personaje determina cuándo jugarás.`});
  } else if (state.fase === 'FIN_RONDA') {
    dialog(`La ronda ${state.ronda} ha terminado`, `<div class="round-summary"><span class="round-summary-kicker">BALANCE DE LA ACADEMIA</span>${ranking(state)}<p>${state.ultimaRonda ? 'Se ha alcanzado la tercera publicación. Es hora de reconocer el legado de cada academia.' : 'Los personajes regresan al mazo. Una nueva ronda trae nuevas posibilidades.'}</p><div class="round-transition" role="status"><span>${state.ultimaRonda ? 'Preparando el resultado final' : 'Preparando la siguiente ronda'}</span><span class="round-transition-track" aria-hidden="true"><span></span></span></div></div>`, {locked:true,kind:'round'});
  } else if (state.fase === 'FIN_PARTIDA') {
    dialog('TESIS COMPLETADA', `<div class="final-result">${img('recursos/prestigio.webp','victory-medal')}<h2>${state.ganadores.map(esc).join(' · ')}</h2><p>${victoryReason(state)}</p>${state.jugadores.filter(p=>state.ganadores.includes(p.nombre)).map(p=>`<div class="victory-publications" aria-label="Publicaciones de ${esc(p.nombre)}">${p.estudios.filter(e=>e.publicado).map(e=>img(e.carta.arte,'',e.carta.nombre)).join('')}</div>`).join('')}${ranking(state)}<div class="dialog-buttons"><button class="gold-button" data-command="home">Nueva partida</button><button class="plain-button" data-command="close">Explorar la mesa</button></div></div>`, {locked:false, subtitle:`Partida completada en ${state.ronda} rondas`});
  } else closeDialog();
}
// El servidor decide quién gana; aquí solo se explica el criterio que resolvió el resultado.
function victoryReason(state) {
  if (state.ganadores.length > 1) return 'Comparten la victoria: empatan en prestigio, monedas y cartas.';
  const winner = state.jugadores.find(p => p.nombre === state.ganadores[0]);
  const tied = winner ? state.jugadores.filter(p => p !== winner && p.prestigio === winner.prestigio) : [];
  if (!tied.length) return 'Obtiene la victoria por prestigio.';
  return tied.some(p => p.monedas === winner.monedas) ? 'Empate en prestigio y monedas: obtiene la victoria por tener más cartas.'
    : 'Empate en prestigio: obtiene la victoria por tener más monedas.';
}
function ranking(state) {
  return `<ol class="ranking">${[...state.jugadores].sort((a,b) => b.prestigio-a.prestigio || b.monedas-a.monedas || b.cartas-a.cartas).map(p => `<li><strong>${esc(p.nombre)}</strong><span>${p.publicados} ${p.publicados === 1 ? 'publicación' : 'publicaciones'}</span><b>${p.prestigio} prestigio</b></li>`).join('')}</ol>`;
}
