import {img, esc, update} from './dom.js';
import {ideaCard} from './cards.js';
import {rival, localPlayer, tableStudies, positionRolePreview} from './players.js';
import {orientTableStudies} from './table-perspective.js';

const icons = {COBRAR:'cobrar', PENSAR:'pensar', INICIAR:'iniciar_estudio', TRABAJAR:'trabajar', FIN_TURNO:'finalizar_turno'};
const renderedHands = new WeakMap();
const previewBoards = new WeakSet();
window.addEventListener('resize', () => {
  orientTableStudies(document.getElementById('board'));
  for (const anchor of document.querySelectorAll('.rival:is(:hover,:focus-visible), .local-role-button:is(:hover,:focus-visible)')) positionRolePreview(anchor);
});
export function board(state) {
  if (!document.getElementById('board')) document.getElementById('app').innerHTML = `
    <section id="board" class="board" aria-label="Mesa de Tesis">
      <header class="board-header"><button class="brand" data-command="home" aria-label="Menú principal">${img('Logo/logo_tesis.webp')}</button>
      <div id="turn-panel" class="turn-panel" aria-live="polite"></div><nav class="utility"><button data-command="history">Crónica</button><button data-command="help">Reglas</button></nav></header>
      <div id="rivals" class="rivals"></div><section id="decks" class="decks" aria-label="Mazos de la mesa"></section>
      <div id="phase-message" class="phase-message"></div>
      <section class="player-zone"><div class="local-academy"><aside id="local" class="local-panel"></aside><section id="studies" class="studies-panel" aria-label="Tus artículos en mesa"></section></div><section class="hand-zone" aria-label="Tu mano"><span class="hand-caption">TU MANO · IDEAS POR EXPLORAR</span><div id="hand" class="hand"></div></section></section>
      <footer><p id="action-hint" class="action-hint"></p><div id="actions" class="actions"></div></footer>
    </section>`;
  const table = document.getElementById('board');
  if (!previewBoards.has(table)) {
    previewBoards.add(table);
    for (const type of ['pointerover','focusin']) table.addEventListener(type, event => {
      const anchor = event.target.closest('.rival, .local-role-button');
      if (anchor) positionRolePreview(anchor);
    });
  }
  const me = state.jugadores.find(p => p.nombre === state.yo);
  const others = state.jugadores.filter(p => p !== me);
  document.getElementById('board').dataset.players = state.jugadores.length;
  document.getElementById('board').classList.toggle('privacy', state.bloqueada);
  update('turn-panel', `<span>RONDA ${state.ronda}${state.ultimaRonda ? ' · ÚLTIMA' : ''}</span><strong>${state.fase === 'SELECCION_ROLES' ? 'Elige ' : state.fase === 'FIN_PARTIDA' ? 'Partida finalizada' : state.fase === 'FIN_RONDA' ? 'Cierre de ronda' : 'Turno de '}${['SELECCION_ROLES','TURNO_JUGADOR'].includes(state.fase) ? esc(state.actual) : ''}</strong>`);
  // Whoever the table is waiting on is lit, both on their turn and while choosing a character.
  const spotlight = ['SELECCION_ROLES','TURNO_JUGADOR'].includes(state.fase);
  document.getElementById('rivals').dataset.count = others.length;
  update('rivals', others.map(p=>rival({...p,activo:spotlight && p.activo},state)).join(''));
  if (!document.getElementById('activity-current')) update('decks', `<section class="table-activity" aria-label="Narrador de la mesa"><span class="eyebrow">CRÓNICA DE TESIS</span><div id="activity-current" role="status" aria-live="polite" aria-atomic="true"></div><div id="activity-controls" class="activity-controls"></div></section>`);
  document.getElementById('local').classList.toggle('active', spotlight && me.activo);
  update('local', localPlayer(me, state)); update('studies', tableStudies(me, true));
  for (const anchor of table.querySelectorAll('.rival:is(:hover,:focus-visible), .local-role-button:is(:hover,:focus-visible)')) positionRolePreview(anchor);
  document.getElementById('studies').classList.toggle('no-studies', !me.estudios.length);
  document.getElementById('hand').style.setProperty('--hand-count', Math.max(1,state.mano.length));
  const hand = document.getElementById('hand');
  const handHtml = state.mano.map(c => ideaCard(c)).join('') || '<p class="empty-hand">Sin ideas en la mano<br><small>Consulta las acciones disponibles.</small></p>';
  // Keep the focused/hovered card alive when a public update leaves our hand unchanged.
  if (renderedHands.get(hand) !== handHtml) {
    hand.innerHTML = handHtml;
    hand.querySelectorAll('.game-card').forEach((card,index)=>{
      card.style.setProperty('--hand-angle', `${Math.max(-12,Math.min(12,(index-(state.mano.length-1)/2)*5))}deg`);
    });
    renderedHands.set(hand, handHtml);
  }
  update('phase-message', state.aviso ? `<div class="table-notice">${esc(state.aviso)}</div>` : '');
  update('action-hint', state.fase === 'FIN_RONDA' ? state.ultimaRonda ? 'Preparando resultados' : 'Preparando la siguiente ronda' : state.actual !== state.yo && state.fase !== 'FIN_PARTIDA' ? `Esperando a ${esc(state.actual)}` : state.fase === 'TURNO_JUGADOR' ? state.habilidadPendiente ? 'Resuelve tu habilidad inicial' : state.accionesRestantes ? 'Elige tu próximo paso' : 'Acciones agotadas · usa tu habilidad o termina el turno' : 'INVESTIGA · PUBLICA · TRASCIENDE');
  const phaseAction = state.fase === 'FIN_PARTIDA' ? {command:'phase', label:'Ver resultados'} : null;
  const tableActions = state.acciones.filter(a => a.id !== 'SIGUIENTE_RONDA');
  update('activity-controls', state.fase === 'SELECCION_ROLES' && state.seleccion.length
    ? '<button class="narrator-link" data-command="phase">Ver personajes</button>' : '');
  document.getElementById('actions').classList.toggle('single-action', !!phaseAction || tableActions.length === 1);
  update('actions', phaseAction
    ? `<button class="action-button phase-action" data-command="${phaseAction.command}"><span class="action-content"><span class="action-label">${phaseAction.label}</span></span></button>`
    : tableActions.map(a => {
      const label = a.id === 'FIN_TURNO' ? 'Terminar turno' : a.nombre;
      const disabled = state.accionesRestantes === 0 && !a.disponible;
      return `<button class="action-button ${a.id === 'FIN_TURNO' ? 'end-turn' : ''} ${a.id === 'HABILIDAD' ? 'ability-action' : ''}" data-command="action" data-action="${a.id}" ${disabled ? 'disabled' : ''} aria-disabled="${!a.disponible}" aria-label="${esc(label + (!a.disponible ? '. ' + a.motivo + (disabled ? '' : ' Pulsa para ver el motivo.') : ''))}" data-tip="${esc(a.disponible ? a.descripcion : a.motivo)}">
    <span class="action-content">${img(icons[a.id] ? `acciones/${icons[a.id]}.webp` : 'recursos/prestigio.webp')}<span class="action-label">${esc(label)}</span></span></button>`;
    }).join(''));
  orientTableStudies(table);
}
